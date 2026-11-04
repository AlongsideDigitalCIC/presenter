/**
 * SQLite3 database parsers powered by WebAssembly (`sql.js`):
 * - OpenLP (`songs.sqlite`)
 * - EasyWorship 6 & 7 (`Songs.db` + `SongWords.db` dual-database schema)
 * - SoftProjector (`.spb` / `Songs` table)
 * - Generic SQLite song tables
 */

import { parseEasyWorshipRtfSlides, rtfToPlainText } from './rtfParser.js';
import {
  cleanLyricLines,
  normalizeSectionName,
  resolveArrangementOrder
} from './sectionNormalizer.js';
import { parseSectionedPlainLyrics } from './xmlParsers.js';

let sqlEnginePromise = null;

async function getSqlEngine() {
  if (!sqlEnginePromise) {
    sqlEnginePromise = (async () => {
      const mod = await import('sql.js');
      const initSqlJs = mod.default || mod;

      if (typeof window !== 'undefined') {
        const wasmUrlMod = await import('sql.js/dist/sql-wasm-browser.wasm?url');
        const wasmUrl = wasmUrlMod.default || wasmUrlMod;
        return initSqlJs({ locateFile: () => wasmUrl });
      }
      return initSqlJs();
    })();
  }
  return sqlEnginePromise;
}

const SECTION_HEADER_REGEX =
  /^(?:verse|v|chorus|ch|c|refrain|ref|pre[-\s]?chorus|pc|post[-\s]?chorus|bridge|br|b|tag|coda|intro|int|outro|out|ending|end|interlude|instrumental|inst|instr|turnaround|vamp|hook|misc|slide)(?:\s*\d+[a-z]?)?$/i;

function queryRowsAsObjects(db, sqlQuery) {
  const res = db.exec(sqlQuery);
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function getTableNames(db) {
  const rows = queryRowsAsObjects(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  return rows.map(r => String(r.name || ''));
}

function getTableColumns(db, tableName) {
  const safeName = tableName.replace(/"/g, '""');
  const rows = queryRowsAsObjects(db, `PRAGMA table_info("${safeName}")`);
  return rows.map(r => String(r.name || ''));
}

const OPENLP_TYPE_MAP = {
  v: 'Verse',
  verse: 'Verse',
  c: 'Chorus',
  chorus: 'Chorus',
  b: 'Bridge',
  bridge: 'Bridge',
  p: 'Pre-Chorus',
  'pre-chorus': 'Pre-Chorus',
  i: 'Intro',
  intro: 'Intro',
  e: 'Ending',
  ending: 'Ending',
  o: 'Misc',
  other: 'Misc'
};

/**
 * Parses OpenLP's internal `<song><lyrics><verse type="v" label="1">...</verse></lyrics></song>` XML string.
 */
function parseOpenLpLyricsColumn(rawLyrics, options) {
  if (!rawLyrics || typeof rawLyrics !== 'string') {
    return { sections: [], codeMap: new Map() };
  }

  const trimmed = rawLyrics.trim();
  if (!trimmed.startsWith('<')) {
    return {
      sections: parseSectionedPlainLyrics(trimmed, options),
      codeMap: new Map()
    };
  }

  const sections = [];
  const codeMap = new Map();

  // Regex extraction works reliably in both Browser DOM and headless workers, including CDATA blocks
  const verseRegex = /<verse\b([^>]*)>([\s\S]*?)<\/verse>/gi;
  let match;
  let idx = 0;

  while ((match = verseRegex.exec(trimmed)) !== null) {
    idx++;
    const attrs = match[1] || '';
    let inner = match[2] || '';

    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const labelMatch = attrs.match(/\blabel\s*=\s*["']([^"']+)["']/i);
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/i);

    let rawCode = '';
    let secName = '';

    if (nameMatch) {
      rawCode = nameMatch[1].toLowerCase();
      secName = normalizeSectionName(nameMatch[1], idx);
    } else {
      const vType = (typeMatch ? typeMatch[1] : 'v').toLowerCase();
      const vLabel = labelMatch ? labelMatch[1] : '';
      const mappedType = OPENLP_TYPE_MAP[vType] || normalizeSectionName(vType, idx);
      rawCode = `${vType[0]}${vLabel || '1'}`.toLowerCase();
      secName = vLabel ? `${mappedType} ${vLabel}` : mappedType;
    }

    // Unwrap CDATA if present and decode basic XML entities
    inner = inner
      .replace(/^[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*$/, '$1')
      .replace(/\[---\]|\[--\}\{--\]/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    const cleaned = cleanLyricLines(inner, options);
    if (cleaned.length > 0) {
      sections.push({ name: secName, lines: cleaned });
      if (rawCode && !codeMap.has(rawCode)) {
        codeMap.set(rawCode, secName);
      }
    }
  }

  if (sections.length === 0) {
    return {
      sections: parseSectionedPlainLyrics(trimmed.replace(/<[^>]+>/g, ''), options),
      codeMap
    };
  }

  return { sections, codeMap };
}

/**
 * 1. OpenLP SQLite Parser (`songs.sqlite`)
 */
function parseOpenLpDatabase(db, tables, options) {
  const cols = getTableColumns(db, 'songs');
  const hasAuthorsJoin =
    tables.some(t => t.toLowerCase() === 'authors') &&
    tables.some(t => t.toLowerCase() === 'authors_songs');

  const authorMap = new Map();
  if (hasAuthorsJoin) {
    try {
      const aRows = queryRowsAsObjects(
        db,
        `SELECT asg.song_id, a.display_name, a.first_name, a.last_name
         FROM authors_songs asg
         JOIN authors a ON a.id = asg.author_id`
      );
      for (const r of aRows) {
        const name = (
          r.display_name ||
          [r.first_name, r.last_name].filter(Boolean).join(' ') ||
          ''
        ).trim();
        if (!name) continue;
        if (!authorMap.has(r.song_id)) authorMap.set(r.song_id, []);
        const list = authorMap.get(r.song_id);
        if (!list.includes(name)) list.push(name);
      }
    } catch {
      // Ignore author join errors on custom schemas
    }
  }

  const selectCols = ['id', 'title', 'lyrics'];
  if (cols.includes('copyright')) selectCols.push('copyright');
  if (cols.includes('ccli_number')) selectCols.push('ccli_number');
  if (cols.includes('verse_order')) selectCols.push('verse_order');
  if (cols.includes('authors')) selectCols.push('authors');

  const songRows = queryRowsAsObjects(db, `SELECT ${selectCols.join(', ')} FROM songs`);
  const songs = [];

  for (const row of songRows) {
    const { sections, codeMap } = parseOpenLpLyricsColumn(String(row.lyrics || ''), options);
    if (sections.length === 0) continue;

    const title = String(row.title || 'Untitled Song').trim();
    const joinedAuthors = authorMap.get(row.id)
      ? authorMap.get(row.id).join(', ')
      : String(row.authors || '').trim();

    const ccli = String(row.ccli_number || '').trim();
    const copyright = String(row.copyright || '').trim();
    const rawOrder = String(row.verse_order || '').trim();

    let arrangement = null;
    if (rawOrder) {
      const tokens = rawOrder.split(/\s+/).filter(Boolean);
      const mapped = tokens.map(t => codeMap.get(t.toLowerCase()) || normalizeSectionName(t));
      arrangement = resolveArrangementOrder(mapped, sections.map(s => s.name));
    }

    songs.push({
      title,
      artist: joinedAuthors,
      ccli,
      copyright,
      arrangement,
      sections,
      sourceFormat: 'OpenLP Database'
    });
  }

  return songs;
}

/**
 * Converts EasyWorship RTF slide blocks into structured Presenter sections.
 */
function convertEasyWorshipWordsToSections(rawWords, options) {
  const blocks = parseEasyWorshipRtfSlides(rawWords);
  if (blocks.length === 0) return [];

  const sections = [];
  let currentSec = null;
  let pendingHeader = null;

  for (const blkLines of blocks) {
    const firstClean = blkLines[0].replace(/[:-]+$/, '').trim();
    const isHeader = SECTION_HEADER_REGEX.test(firstClean) && firstClean.length <= 28;

    if (isHeader && blkLines.length === 1) {
      pendingHeader = firstClean;
      continue;
    }

    if (isHeader) {
      const cleaned = cleanLyricLines(blkLines.slice(1), options);
      if (cleaned.length > 0) {
        currentSec = {
          name: normalizeSectionName(firstClean, sections.length + 1),
          lines: [...cleaned]
        };
        sections.push(currentSec);
      }
      pendingHeader = null;
      continue;
    }

    const cleaned = cleanLyricLines(blkLines, options);
    if (cleaned.length === 0) continue;

    if (pendingHeader) {
      currentSec = {
        name: normalizeSectionName(pendingHeader, sections.length + 1),
        lines: [...cleaned]
      };
      sections.push(currentSec);
      pendingHeader = null;
    } else if (currentSec) {
      currentSec.lines.push(...cleaned);
    } else {
      currentSec = {
        name: `Verse ${sections.length + 1}`,
        lines: [...cleaned]
      };
      sections.push(currentSec);
    }
  }

  return sections;
}

/**
 * 2. Paired EasyWorship 6 & 7 Parser (`Songs.db` + `SongWords.db`)
 */
export async function parseEasyWorshipDatabasePair(songsDbBytes, songWordsDbBytes, options = { stripChords: true }) {
  const SQL = await getSqlEngine();
  const warnings = [];
  const songs = [];

  let metaById = new Map();
  if (songsDbBytes) {
    const dbMeta = new SQL.Database(songsDbBytes instanceof Uint8Array ? songsDbBytes : new Uint8Array(songsDbBytes));
    try {
      const cols = getTableColumns(dbMeta, 'song');
      const selectParts = ['rowid AS _rowid'];
      for (const c of ['uid', 'song_item_uid', 'title', 'author', 'copyright', 'administrator', 'reference_number']) {
        if (cols.includes(c)) selectParts.push(c);
      }
      const rows = queryRowsAsObjects(dbMeta, `SELECT ${selectParts.join(', ')} FROM song`);
      for (const r of rows) {
        metaById.set(Number(r._rowid), r);
      }
    } finally {
      dbMeta.close();
    }
  }

  if (!songWordsDbBytes) {
    warnings.push(
      'EasyWorship stores song titles in Songs.db and lyrics in SongWords.db. Please select SongWords.db alongside Songs.db (found in the same EasyWorship Data/Keys folder) to import song lyrics.'
    );
    return { songs: [], warnings };
  }

  if (!songsDbBytes) {
    warnings.push(
      'Imported lyrics from SongWords.db using first-line titles. Include Songs.db alongside SongWords.db if you also want EasyWorship titles, authors, and CCLI numbers.'
    );
  }

  const dbWords = new SQL.Database(
    songWordsDbBytes instanceof Uint8Array ? songWordsDbBytes : new Uint8Array(songWordsDbBytes)
  );

  try {
    const wordCols = getTableColumns(dbWords, 'word');
    const idCol = wordCols.includes('song_id') ? 'song_id' : 'rowid';
    const wordsCol = wordCols.includes('words') ? 'words' : wordCols.find(c => /word|text|lyric/i.test(c)) || 'words';

    const wordRows = queryRowsAsObjects(dbWords, `SELECT ${idCol} AS song_id, ${wordsCol} AS words FROM word`);

    for (const wRow of wordRows) {
      let rawWords = wRow.words;
      if (rawWords instanceof Uint8Array) {
        rawWords = new TextDecoder('utf-8', { fatal: false }).decode(rawWords);
      } else {
        rawWords = String(rawWords || '');
      }

      const sections = convertEasyWorshipWordsToSections(rawWords, options);
      if (sections.length === 0) continue;

      const meta = metaById.get(Number(wRow.song_id));
      const fallbackTitle = sections[0]?.lines[0]?.slice(0, 60) || `EasyWorship Song ${wRow.song_id}`;

      const title = String(meta?.title || fallbackTitle).trim();
      const artist = String(meta?.author || '').trim();
      const ccli = String(meta?.reference_number || '').replace(/^CCLI\s*#?\s*/i, '').trim();
      const copyParts = [meta?.copyright, meta?.administrator]
        .map(v => String(v || '').trim())
        .filter(Boolean);

      songs.push({
        title,
        artist,
        ccli,
        copyright: copyParts.join(' '),
        arrangement: null,
        sections,
        sourceFormat: 'EasyWorship Database'
      });
    }
  } finally {
    dbWords.close();
  }

  return { songs, warnings };
}

/**
 * 3. SoftProjector & Generic SQLite Song Database Parser
 */
function parseSoftProjectorOrGenericDb(db, tables, filename, options) {
  // SoftProjector has `Songs` table with `song_text`, `title`, `words`, `music`
  const songsTableName =
    tables.find(t => /^songs$/i.test(t)) ||
    tables.find(t => /^song$/i.test(t)) ||
    tables.find(t => /song|lyric/i.test(t));

  if (!songsTableName) return [];

  const cols = getTableColumns(db, songsTableName);
  const colsLower = cols.map(c => c.toLowerCase());
  const pickCol = candidates => {
    for (const cand of candidates) {
      const idx = colsLower.indexOf(cand);
      if (idx !== -1) return cols[idx];
    }
    return null;
  };

  const titleCol = pickCol(['title', 'song_title', 'name']);
  const lyricsCol = pickCol(['song_text', 'lyrics', 'words', 'text', 'content', 'body']);
  if (!lyricsCol) return [];

  const wordsAuthorCol = colsLower.includes('song_text') ? pickCol(['words']) : null;
  const musicAuthorCol = pickCol(['music', 'composer']);
  const authorCol = pickCol(['author', 'authors', 'artist', 'writer']);
  const ccliCol = pickCol(['ccli', 'ccli_number', 'reference_number']);
  const copyCol = pickCol(['copyright', 'notes']);

  const safeTable = songsTableName.replace(/"/g, '""');
  const rows = queryRowsAsObjects(db, `SELECT * FROM "${safeTable}"`);

  const isSoftProjector = colsLower.includes('song_text') || filename.toLowerCase().endsWith('.spb');
  const songs = [];

  for (const r of rows) {
    let rawLyrics = r[lyricsCol];
    if (rawLyrics instanceof Uint8Array) {
      rawLyrics = new TextDecoder('utf-8', { fatal: false }).decode(rawLyrics);
    } else {
      rawLyrics = String(rawLyrics || '');
    }

    if (rawLyrics.trimStart().startsWith('{\\rtf')) {
      rawLyrics = rtfToPlainText(rawLyrics);
    }

    const sections = parseSectionedPlainLyrics(rawLyrics, options);
    if (sections.length === 0) continue;

    const title = String((titleCol ? r[titleCol] : '') || sections[0].lines[0] || 'Untitled Song').trim();
    const artistParts = [
      authorCol ? r[authorCol] : '',
      wordsAuthorCol ? r[wordsAuthorCol] : '',
      musicAuthorCol ? r[musicAuthorCol] : ''
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .filter((v, idx, arr) => arr.indexOf(v) === idx);

    songs.push({
      title,
      artist: artistParts.join(', '),
      ccli: String((ccliCol ? r[ccliCol] : '') || '').trim(),
      copyright: String((copyCol ? r[copyCol] : '') || '').trim(),
      arrangement: null,
      sections,
      sourceFormat: isSoftProjector ? 'SoftProjector Database' : 'SQLite Database'
    });
  }

  return songs;
}

/**
 * Inspects a single SQLite3 file and extracts songs according to its detected schema.
 */
export async function parseSingleSqliteDatabase(bytes, filename = 'songs.sqlite', options = { stripChords: true }) {
  const SQL = await getSqlEngine();
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const db = new SQL.Database(u8);

  try {
    const tables = getTableNames(db);
    const lowerTables = tables.map(t => t.toLowerCase());

    // Check EasyWorship single-file edge cases first
    if (lowerTables.includes('word')) {
      const wordCols = getTableColumns(db, tables[lowerTables.indexOf('word')]).map(c => c.toLowerCase());
      if (wordCols.includes('song_id') && wordCols.includes('words')) {
        db.close();
        return parseEasyWorshipDatabasePair(null, u8, options);
      }
    }

    if (lowerTables.includes('song') && !lowerTables.includes('word')) {
      const songCols = getTableColumns(db, tables[lowerTables.indexOf('song')]).map(c => c.toLowerCase());
      if (songCols.includes('reference_number') && !songCols.some(c => /lyric|word|text|body/.test(c))) {
        db.close();
        return parseEasyWorshipDatabasePair(u8, null, options);
      }
    }

    // Check OpenLP (`songs` table with `lyrics` + `verse_order` or `ccli_number` or `authors_songs`)
    if (lowerTables.includes('songs')) {
      const sCols = getTableColumns(db, tables[lowerTables.indexOf('songs')]).map(c => c.toLowerCase());
      if (
        sCols.includes('lyrics') &&
        (sCols.includes('verse_order') || sCols.includes('ccli_number') || lowerTables.includes('authors_songs'))
      ) {
        const songs = parseOpenLpDatabase(db, tables, options);
        return { songs, warnings: [] };
      }
    }

    const songs = parseSoftProjectorOrGenericDb(db, tables, filename, options);
    return { songs, warnings: [] };
  } finally {
    try {
      db.close();
    } catch {
      // Already closed
    }
  }
}
