/**
 * Universal Song Library Importer Orchestrator & Batch Writer.
 *
 * Unpacks archives (.zip, .qsp, .proBundle, .pro6x), pairs dual-database formats
 * (EasyWorship Songs.db + SongWords.db), auto-detects binary/database/XML/JSON/text
 * schemas across 15+ church presentation platforms, and writes normalized Markdown
 * songs into Presenter's `Songs/` directory.
 */

import JSZip from 'jszip';
import { parseProPresenter7Bytes } from './proPresenter7Proto.js';
import {
  sanitizeSongFilename,
  serializeSongToMarkdown
} from './sectionNormalizer.js';
import {
  parseEasyWorshipDatabasePair,
  parseSingleSqliteDatabase
} from './sqliteParsers.js';
import {
  parseChordProSong,
  parseCsvSongs,
  parseFreeShowJson,
  parsePlainOrMarkdownSong,
  parseSongBeamerSng,
  parseSongSelectUsr,
  parseVideoPsalmVpc
} from './textAndJsonParsers.js';
import { parseXmlSongContent } from './xmlParsers.js';

const IGNORED_MEDIA_EXTENSIONS = new Set([
  'mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', 'wmv',
  'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg', 'tif', 'tiff',
  'pdf', 'pptx', 'ppt', 'docx', 'doc', 'xlsx', 'xls',
  'ttf', 'otf', 'woff', 'woff2',
  'exe', 'dll', 'so', 'dylib', 'msi', 'dmg', 'pkg',
  'sqlite-shm', 'sqlite-wal', 'db-shm', 'db-wal', 'journal', 'lock', 'bak'
]);

const ZIP_ARCHIVE_EXTENSIONS = new Set(['zip', 'qsp', 'probundle', 'pro6x', 'fsb']);

/**
 * Supported file input accept string for <input type="file" accept={SUPPORTED_SONG_IMPORT_ACCEPT} />
 */
export const SUPPORTED_SONG_IMPORT_ACCEPT = [
  '.xml',
  '.pro',
  '.pro4',
  '.pro5',
  '.pro6',
  '.pro6x',
  '.proBundle',
  '.show',
  '.shows',
  '.project',
  '.fsb',
  '.json',
  '.qsp',
  '.sqlite',
  '.sqlite3',
  '.db',
  '.spb',
  '.vpc',
  '.usr',
  '.cho',
  '.crd',
  '.chopro',
  '.chordpro',
  '.onsong',
  '.sng',
  '.csv',
  '.tsv',
  '.rtf',
  '.txt',
  '.md',
  '.zip'
].join(',');

function getExtension(filename) {
  const base = String(filename || '').split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function getBasename(filepath) {
  return String(filepath || '').split(/[\\/]/).pop() || '';
}

function getDirname(filepath) {
  const norm = String(filepath || '').replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '' : norm.slice(0, idx).toLowerCase();
}

function isIgnorablePath(filepath) {
  const norm = String(filepath || '').replace(/\\/g, '/');
  if (!norm) return true;
  if (norm.includes('__MACOSX/')) return true;
  const base = getBasename(norm);
  if (!base || base.startsWith('.')) return true;
  if (/^(?:thumbs\.db|desktop\.ini)$/i.test(base)) return true;

  const ext = getExtension(base);
  if (ext && IGNORED_MEDIA_EXTENSIONS.has(ext)) return true;
  return false;
}

function hasZipMagic(u8) {
  return (
    u8.length >= 4 &&
    u8[0] === 0x50 &&
    u8[1] === 0x4b &&
    (u8[2] === 0x03 || u8[2] === 0x05) &&
    (u8[3] === 0x04 || u8[3] === 0x06)
  );
}

function hasSqliteMagic(u8) {
  if (u8.length < 16) return false;
  // "SQLite format 3\0"
  const magic = 'SQLite format 3\0';
  for (let i = 0; i < 16; i++) {
    if (u8[i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

function looksMostlyPrintableText(u8) {
  if (u8.length === 0) return false;
  // UTF-16 BOMs are text
  if (u8.length >= 2 && ((u8[0] === 0xff && u8[1] === 0xfe) || (u8[0] === 0xfe && u8[1] === 0xff))) {
    return true;
  }
  const sampleLen = Math.min(u8.length, 2048);
  let binaryCount = 0;
  for (let i = 0; i < sampleLen; i++) {
    const b = u8[i];
    if (b === 0x00) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) {
      binaryCount++;
    }
  }
  return binaryCount / sampleLen < 0.02;
}

/**
 * Decodes text files cleanly across UTF-8, UTF-16LE/BE, and legacy Windows-1252 ANSI church exports.
 */
export function decodeBytesToText(u8) {
  if (!u8 || u8.length === 0) return '';
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2));
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(u8.subarray(2));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(u8);
    } catch {
      return new TextDecoder('utf-8', { fatal: false }).decode(u8);
    }
  }
}

async function readEntryBytes(inputItem) {
  if (inputItem instanceof Uint8Array) return inputItem;
  if (inputItem.bytes instanceof Uint8Array) return inputItem.bytes;
  if (inputItem.bytes instanceof ArrayBuffer) return new Uint8Array(inputItem.bytes);
  if (Array.isArray(inputItem.bytes)) return new Uint8Array(inputItem.bytes);
  if (typeof inputItem.arrayBuffer === 'function') {
    const ab = await inputItem.arrayBuffer();
    return new Uint8Array(ab);
  }
  throw new Error(`Unsupported file input object: ${inputItem?.name || 'unknown'}`);
}

/**
 * Unpacks any .zip / .qsp / .proBundle / .pro6x containers up to 2 levels deep.
 */
async function flattenInputsAndUnpackZips(rawInputs, warnings, depth = 0) {
  const flatEntries = [];

  for (const item of rawInputs) {
    const relPath = item.webkitRelativePath || item.path || item.name || 'Untitled';
    if (isIgnorablePath(relPath)) continue;

    let bytes;
    try {
      bytes = await readEntryBytes(item);
    } catch (err) {
      warnings.push(`Could not read "${getBasename(relPath)}": ${err.message}`);
      continue;
    }

    if (!bytes || bytes.length === 0) continue;

    const ext = getExtension(relPath);
    const shouldUnpackZip =
      depth < 2 &&
      (ZIP_ARCHIVE_EXTENSIONS.has(ext) || (hasZipMagic(bytes) && !IGNORED_MEDIA_EXTENSIONS.has(ext)));

    if (shouldUnpackZip) {
      try {
        const zip = await JSZip.loadAsync(bytes);
        const nestedItems = [];
        for (const [entryPath, zipObj] of Object.entries(zip.files)) {
          if (zipObj.dir || isIgnorablePath(entryPath)) continue;
          const entryBytes = await zipObj.async('uint8array');
          nestedItems.push({
            name: getBasename(entryPath),
            path: `${relPath}/${entryPath}`,
            bytes: entryBytes
          });
        }
        const unpacked = await flattenInputsAndUnpackZips(nestedItems, warnings, depth + 1);
        flatEntries.push(...unpacked);
        continue;
      } catch (err) {
        warnings.push(`Failed to unpack archive "${getBasename(relPath)}": ${err.message}`);
        continue;
      }
    }

    flatEntries.push({
      name: getBasename(relPath),
      path: relPath,
      bytes
    });
  }

  return flatEntries;
}

/**
 * Parses a single flattened file entry into 0 or more normalized song objects.
 */
async function parseSingleEntry(entry, options, warnings) {
  const { name, bytes } = entry;
  const ext = getExtension(name);

  // 1. SQLite3 database files (OpenLP, SoftProjector, standalone EasyWorship DB, etc.)
  if (hasSqliteMagic(bytes)) {
    try {
      const res = await parseSingleSqliteDatabase(bytes, name, options);
      if (res.warnings?.length) warnings.push(...res.warnings);
      return res.songs || [];
    } catch (err) {
      warnings.push(`Database error in "${name}": ${err.message}`);
      return [];
    }
  }

  // 2. ProPresenter 7 binary (.pro) vs ChordPro text (.pro)
  if (ext === 'pro') {
    if (!looksMostlyPrintableText(bytes)) {
      try {
        return parseProPresenter7Bytes(bytes, name, options);
      } catch (err) {
        warnings.push(`Could not decode ProPresenter 7 file "${name}": ${err.message}`);
        return [];
      }
    }
    // Printable .pro — could be JSON-encoded Pro7 or ChordPro text
    const text = decodeBytesToText(bytes);
    const trimmed = text.trimStart();
    if (trimmed.startsWith('{') && /"cue_?groups"|"cues"|"arrangements"/.test(trimmed)) {
      return parseProPresenter7Bytes(bytes, name, options);
    }
    return parseChordProSong(text, name, options);
  }

  // Skip unknown binary files so random non-song binaries inside folder drops don't produce garbage
  if (!looksMostlyPrintableText(bytes)) {
    return [];
  }

  const text = decodeBytesToText(bytes);
  const trimmedStart = text.replace(/^\uFEFF/, '').trimStart();
  if (!trimmedStart) return [];

  // 3. XML-based formats (.xml, .pro4, .pro5, .pro6, plus extensionless OpenSong XMLs)
  if (
    ext === 'xml' ||
    ext === 'pro4' ||
    ext === 'pro5' ||
    ext === 'pro6' ||
    ext === 'opensong' ||
    trimmedStart.startsWith('<?xml') ||
    /^<(?:song|songs|RVPresentationDocument|Easyslides|EasiSlides|MediaShout)/i.test(trimmedStart)
  ) {
    return parseXmlSongContent(text, name, options);
  }

  // 4. VideoPsalm (.vpc)
  if (ext === 'vpc') {
    return parseVideoPsalmVpc(text, options);
  }

  // 5. FreeShow (.show, .shows, .project, or .json)
  if (ext === 'show' || ext === 'shows' || ext === 'project' || ext === 'json') {
    const fsSongs = parseFreeShowJson(text, name, options);
    if (fsSongs.length > 0) return fsSongs;
    if (ext === 'json') {
      return parseVideoPsalmVpc(text, options);
    }
    return [];
  }

  // 6. CCLI SongSelect (.usr)
  if (ext === 'usr' || /^\[File\]\s*\r?\nType=SongSelect/i.test(trimmedStart)) {
    return parseSongSelectUsr(text, name, options);
  }

  // 7. SongBeamer (.sng)
  if (ext === 'sng' || /^#(?:LangCount|Title|Editor)=/i.test(trimmedStart)) {
    return parseSongBeamerSng(text, name, options);
  }

  // 8. ChordPro / WorshipTools / OnSong
  if (['cho', 'crd', 'chopro', 'chordpro', 'onsong'].includes(ext)) {
    return parseChordProSong(text, name, options);
  }

  // 9. CSV / TSV Spreadsheets
  if (ext === 'csv' || ext === 'tsv') {
    const { songs, warnings: csvWarnings } = parseCsvSongs(text, name, options);
    if (csvWarnings?.length) warnings.push(...csvWarnings);
    return songs;
  }

  // 10. Markdown, RTF, SongSelect .txt, Plain Text, or extensionless OpenSong plain files
  if (['md', 'txt', 'rtf', ''].includes(ext)) {
    // Extensionless OpenSong files without <?xml?> header still have <song>...</song> (handled above),
    // so only parse extensionless files if they clearly contain text lines rather than config data
    if (ext === '' && name.includes('Globals')) return [];
    return parsePlainOrMarkdownSong(text, name, options);
  }

  return [];
}

/**
 * Main entry point to parse any batch of dropped/selected files, folders, databases, or archives.
 *
 * @param {Array<File|{name: string, path?: string, bytes: Uint8Array}>} inputFiles
 * @param {{
 *   stripChords?: boolean,
 *   existingTitles?: Set<string>|string[],
 *   onProgress?: (info: { phase: string, current: number, total: number, label?: string }) => void
 * }} options
 */
export async function parseImportFiles(inputFiles, options = {}) {
  const stripChords = options.stripChords !== false;
  const onProgress = options.onProgress || null;
  const warnings = [];

  const existingLowerSet = new Set();
  if (options.existingTitles) {
    for (const t of options.existingTitles) {
      if (t) {
        const clean = String(t).replace(/\.md$/i, '').trim().toLowerCase();
        existingLowerSet.add(clean);
        existingLowerSet.add(sanitizeSongFilename(clean).toLowerCase());
      }
    }
  }

  if (onProgress) {
    onProgress({ phase: 'unpacking', current: 0, total: inputFiles.length, label: 'Scanning files & archives...' });
  }

  const entries = await flattenInputsAndUnpackZips(inputFiles, warnings);

  // Detect and pair EasyWorship Songs.db + SongWords.db
  const songsDbEntries = [];
  const songWordsDbEntries = [];
  const remainingEntries = [];

  for (const entry of entries) {
    const lowerName = entry.name.toLowerCase();
    if (lowerName === 'songs.db' && hasSqliteMagic(entry.bytes)) {
      songsDbEntries.push(entry);
    } else if (lowerName === 'songwords.db' && hasSqliteMagic(entry.bytes)) {
      songWordsDbEntries.push(entry);
    } else {
      remainingEntries.push(entry);
    }
  }

  const parsedSongs = [];

  // Process paired EasyWorship DBs
  if (songsDbEntries.length > 0 || songWordsDbEntries.length > 0) {
    const usedWordsIndices = new Set();

    for (const sEntry of songsDbEntries) {
      const sDir = getDirname(sEntry.path);
      let matchIdx = songWordsDbEntries.findIndex(
        (wEntry, idx) => !usedWordsIndices.has(idx) && getDirname(wEntry.path) === sDir
      );
      if (matchIdx === -1 && songWordsDbEntries.length === 1 && songsDbEntries.length === 1) {
        matchIdx = 0;
      }

      if (matchIdx !== -1) {
        usedWordsIndices.add(matchIdx);
        const wEntry = songWordsDbEntries[matchIdx];
        if (onProgress) {
          onProgress({
            phase: 'parsing',
            current: 0,
            total: remainingEntries.length + 1,
            label: 'Reading EasyWorship database...'
          });
        }
        try {
          const { songs, warnings: ewWarnings } = await parseEasyWorshipDatabasePair(
            sEntry.bytes,
            wEntry.bytes,
            { stripChords }
          );
          if (ewWarnings?.length) warnings.push(...ewWarnings);
          songs.forEach(s => {
            s.sourceFile = 'Songs.db + SongWords.db';
            parsedSongs.push(s);
          });
        } catch (err) {
          warnings.push(`EasyWorship import error: ${err.message}`);
        }
      } else {
        remainingEntries.push(sEntry);
      }
    }

    songWordsDbEntries.forEach((wEntry, idx) => {
      if (!usedWordsIndices.has(idx)) {
        remainingEntries.push(wEntry);
      }
    });
  }

  // Parse all remaining entries
  const total = remainingEntries.length;
  for (let i = 0; i < total; i++) {
    const entry = remainingEntries[i];
    if (onProgress && (i % 10 === 0 || i === total - 1)) {
      onProgress({
        phase: 'parsing',
        current: i + 1,
        total,
        label: `Parsing ${entry.name}...`
      });
      // Yield briefly on large batches so the UI progress bar stays responsive
      if (i > 0 && i % 50 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    try {
      const extracted = await parseSingleEntry(entry, { stripChords }, warnings);
      for (const song of extracted) {
        song.sourceFile = entry.name;
        parsedSongs.push(song);
      }
    } catch (err) {
      warnings.push(`Skipped "${entry.name}": ${err.message}`);
    }
  }

  // Finalize song objects, build markdown, compute source counts, and flag duplicates
  const sourceCounts = {};
  const finalizedSongs = parsedSongs.map((song, idx) => {
    const safeBase = sanitizeSongFilename(song.title);
    const markdown = serializeSongToMarkdown(song);
    const isDuplicate =
      existingLowerSet.has(song.title.trim().toLowerCase()) ||
      existingLowerSet.has(safeBase.toLowerCase());

    const fmt = song.sourceFormat || 'Imported';
    sourceCounts[fmt] = (sourceCounts[fmt] || 0) + 1;

    return {
      ...song,
      uid: `imp_${idx}_${safeBase}`,
      safeBaseName: safeBase,
      targetFilename: `${safeBase}.md`,
      markdown,
      isDuplicate
    };
  });

  return {
    songs: finalizedSongs,
    warnings,
    sourceCounts
  };
}

/**
 * Writes selected imported songs into Presenter's `Songs/` folder inside `libraryHandle`.
 *
 * @param {Array} songsToWrite - Array of song objects from `parseImportFiles`
 * @param {FileSystemDirectoryHandle|TauriDirectoryHandle} libraryHandle
 * @param {{
 *   duplicateMode?: 'skip' | 'overwrite' | 'rename',
 *   onProgress?: (info: { completed: number, total: number, currentTitle: string }) => void
 * }} options
 */
export async function writeImportedSongsToLibrary(songsToWrite, libraryHandle, options = {}) {
  if (!libraryHandle) {
    throw new Error('No Presenter library folder is connected. Please choose a storage folder first.');
  }

  const duplicateMode = options.duplicateMode || 'skip';
  const onProgress = options.onProgress || null;

  const songsDir = await libraryHandle.getDirectoryHandle('Songs', { create: true });

  // Build exact case-insensitive map of existing .md files currently in Songs/
  const existingFileMap = new Map(); // lowerFilename -> actualFilename
  if (typeof songsDir.values === 'function') {
    for await (const entry of songsDir.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
        existingFileMap.set(entry.name.toLowerCase(), entry.name);
      }
    }
  }

  let importedCount = 0;
  let overwrittenCount = 0;
  let skippedCount = 0;
  const errors = [];

  const total = songsToWrite.length;

  for (let i = 0; i < total; i++) {
    const song = songsToWrite[i];
    const baseName = song.safeBaseName || sanitizeSongFilename(song.title);
    let targetFilename = `${baseName}.md`;
    let markdownToWrite = song.markdown || serializeSongToMarkdown(song);
    const existsAlready = existingFileMap.has(targetFilename.toLowerCase());

    if (onProgress && (i % 5 === 0 || i === total - 1)) {
      onProgress({
        completed: i + 1,
        total,
        currentTitle: song.title
      });
      if (i > 0 && i % 25 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    if (existsAlready) {
      if (duplicateMode === 'skip') {
        skippedCount++;
        continue;
      } else if (duplicateMode === 'overwrite') {
        // Use exact casing of existing file if present
        targetFilename = existingFileMap.get(targetFilename.toLowerCase()) || targetFilename;
      } else if (duplicateMode === 'rename') {
        let suffix = 2;
        while (existingFileMap.has(`${baseName} (${suffix}).md`.toLowerCase())) {
          suffix++;
        }
        const renamedTitle = `${song.title} (${suffix})`;
        targetFilename = `${baseName} (${suffix}).md`;
        markdownToWrite = serializeSongToMarkdown({
          ...song,
          title: renamedTitle
        });
      }
    }

    try {
      const fileHandle = await songsDir.getFileHandle(targetFilename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(markdownToWrite);
      await writable.close();

      existingFileMap.set(targetFilename.toLowerCase(), targetFilename);
      if (existsAlready && duplicateMode === 'overwrite') {
        overwrittenCount++;
      } else {
        importedCount++;
      }
    } catch (err) {
      errors.push(`Failed to save "${song.title}": ${err.message}`);
    }
  }

  return {
    importedCount,
    overwrittenCount,
    skippedCount,
    errors
  };
}
