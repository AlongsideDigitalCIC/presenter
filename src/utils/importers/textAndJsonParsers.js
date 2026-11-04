/**
 * Text, JSON, Pseudo-JSON, INI, ChordPro, SongBeamer, RTF, and CSV parsers:
 * - FreeShow (.show, .json, .project, .shows)
 * - VideoPsalm (.vpc relaxed-JSON songbooks)
 * - CCLI SongSelect (.usr & .txt)
 * - WorshipTools / OnSong / ChordPro (.cho, .crd, .chopro, .chordpro, .onsong, .txt)
 * - SongBeamer (.sng)
 * - CSV Spreadsheets (.csv)
 * - Presenter Markdown (.md) & Plain Text / RTF (.txt, .rtf)
 */

import { rtfToPlainText } from './rtfParser.js';
import {
  cleanLyricLines,
  normalizeSectionName,
  resolveArrangementOrder
} from './sectionNormalizer.js';
import { parseSectionedPlainLyrics } from './xmlParsers.js';

const SECTION_LABEL_CHECK =
  /^(?:verse|v|chorus|ch|c|refrain|ref|pre[-\s]?chorus|pc|post[-\s]?chorus|bridge|br|b|tag|coda|intro|int|outro|out|ending|end|interlude|instrumental|inst|instr|turnaround|vamp|hook|misc|strophe)(?:\s*\d+[a-z]?)?$/i;

/**
 * 1. FreeShow Parser (.show, .json, .project, .shows)
 */
function parseSingleFreeShowObject(showObj, fallbackTitle = 'Untitled Song', options = { stripChords: true }) {
  if (!showObj || typeof showObj !== 'object' || !showObj.slides) return null;

  // Skip non-lyric FreeShow items like empty presentations or pure media shows if category explicitly excludes songs and has no text
  const meta = showObj.meta || {};
  const title = (meta.title || showObj.name || fallbackTitle || 'Untitled Song').trim();
  const artist = [meta.artist, meta.author, meta.composer]
    .map(s => (s || '').trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');

  const ccli = String(meta.CCLI || meta.ccli || '').trim();
  let copyright = String(meta.copyright || '').trim();
  if (!copyright) {
    const year = String(meta.year || '').trim();
    const pub = String(meta.publisher || '').trim();
    copyright = [year ? `© ${year}` : '', pub].filter(Boolean).join(' ');
  }

  const slidesDict = showObj.slides || {};

  const extractSingleSlideLines = slide => {
    if (!slide || !Array.isArray(slide.items)) return [];
    const rawLines = [];
    for (const item of slide.items) {
      if (item.type && item.type !== 'text') continue;
      if (!Array.isArray(item.lines)) continue;
      for (const lineObj of item.lines) {
        if (!Array.isArray(lineObj.text)) continue;
        const textLine = lineObj.text.map(seg => seg?.value || '').join('').trim();
        if (textLine) rawLines.push(textLine);
      }
    }
    return cleanLyricLines(rawLines, options);
  };

  // Build parent slide groups (parent slide + its children array)
  const parentSlideMap = new Map();
  let autoIndex = 1;

  for (const [slideId, slide] of Object.entries(slidesDict)) {
    // Child slides in FreeShow have group === null and are referenced inside a parent's `children` array
    if (slide.group === null && !slide.globalGroup) {
      continue;
    }

    const rawGroup = slide.group || slide.globalGroup || `Verse ${autoIndex}`;
    const secName = normalizeSectionName(rawGroup, autoIndex++);
    const combinedLines = [...extractSingleSlideLines(slide)];

    if (Array.isArray(slide.children)) {
      for (const childId of slide.children) {
        const childSlide = slidesDict[childId];
        if (childSlide) {
          combinedLines.push(...extractSingleSlideLines(childSlide));
        }
      }
    }

    if (combinedLines.length > 0) {
      parentSlideMap.set(slideId, { name: secName, lines: combinedLines });
    }
  }

  // Fallback if all slides had group === null (e.g. imported flat slides)
  if (parentSlideMap.size === 0) {
    let idx = 1;
    for (const [slideId, slide] of Object.entries(slidesDict)) {
      const lines = extractSingleSlideLines(slide);
      if (lines.length > 0) {
        parentSlideMap.set(slideId, { name: `Verse ${idx++}`, lines });
      }
    }
  }

  if (parentSlideMap.size === 0) return null;

  const sections = [];
  const slideIdToUniqueName = new Map();
  const usedNames = new Map();

  for (const [slideId, secData] of parentSlideMap.entries()) {
    let finalName = secData.name;
    const lower = finalName.toLowerCase();
    if (usedNames.has(lower)) {
      const existingLines = usedNames.get(lower).lines.join('\n').toLowerCase();
      const curLines = secData.lines.join('\n').toLowerCase();
      if (existingLines === curLines) {
        slideIdToUniqueName.set(slideId, usedNames.get(lower).name);
        continue;
      }
      const base = finalName.replace(/\s+\d+$/, '');
      let n = 2;
      while (usedNames.has(`${base} ${n}`.toLowerCase())) n++;
      finalName = `${base} ${n}`;
    }

    const entry = { name: finalName, lines: secData.lines };
    sections.push(entry);
    usedNames.set(finalName.toLowerCase(), entry);
    slideIdToUniqueName.set(slideId, finalName);
  }

  // Resolve active layout order into Presenter Arrangement
  let arrangement = null;
  const layouts = showObj.layouts || {};
  const activeLayoutId = showObj.activeLayout || Object.keys(layouts)[0];
  const activeLayout = activeLayoutId ? layouts[activeLayoutId] : null;

  if (activeLayout && Array.isArray(activeLayout.slides)) {
    const orderedNames = activeLayout.slides
      .filter(s => s && !s.disabled)
      .map(s => slideIdToUniqueName.get(s.id))
      .filter(Boolean);

    if (orderedNames.length > 0) {
      arrangement = orderedNames;
    }
  }

  return {
    title,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat: 'FreeShow'
  };
}

export function parseFreeShowJson(jsonText, filename = 'Song.show', options = { stripChords: true }) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText.replace(/^\uFEFF/, ''));
  } catch {
    return [];
  }

  const fallbackTitle = filename.replace(/\.[^.]+$/, '') || 'Untitled Song';
  const results = [];

  // Format A: ["showId", { name, slides, layouts, meta }]
  if (Array.isArray(parsed)) {
    if (parsed.length === 2 && typeof parsed[0] === 'string' && parsed[1] && typeof parsed[1] === 'object') {
      const song = parseSingleFreeShowObject(parsed[1], fallbackTitle, options);
      if (song) results.push(song);
      return results;
    }
    // Array of show objects
    for (const item of parsed) {
      const song = parseSingleFreeShowObject(item, fallbackTitle, options);
      if (song) results.push(song);
    }
    return results;
  }

  if (parsed && typeof parsed === 'object') {
    // Format B: Direct show object
    if (parsed.slides && typeof parsed.slides === 'object') {
      const song = parseSingleFreeShowObject(parsed, fallbackTitle, options);
      if (song) results.push(song);
      return results;
    }

    // Format C: FreeShow project or Shows backup ({ shows: { id: showObj } } or { id: showObj })
    const container = parsed.shows && typeof parsed.shows === 'object' ? parsed.shows : parsed;
    for (const val of Object.values(container)) {
      if (val && typeof val === 'object' && val.slides) {
        const song = parseSingleFreeShowObject(val, val.name || fallbackTitle, options);
        if (song) results.push(song);
      }
    }
  }

  return results;
}

/**
 * 2. VideoPsalm Parser (.vpc relaxed pseudo-JSON songbooks)
 * Safely converts VideoPsalm's unquoted keys and multiline strings into strict RFC-8259 JSON.
 */
function normalizeVideoPsalmToStrictJson(raw) {
  const src = raw.replace(/^\uFEFF/, '').trim();
  let out = '';
  let inString = false;
  let i = 0;
  const len = src.length;

  while (i < len) {
    const ch = src[i];

    if (inString) {
      if (ch === '\\') {
        const next = src[i + 1];
        if (next !== undefined) {
          // Ensure valid JSON escape sequence
          if ('"\\/bfnrtu'.includes(next)) {
            out += ch + next;
          } else {
            out += '\\\\' + next;
          }
          i += 2;
          continue;
        }
      }
      if (ch === '"') {
        inString = false;
        out += '"';
        i++;
        continue;
      }
      if (ch === '\r') {
        i++;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        i++;
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += '"';
      i++;
      continue;
    }

    // Match unquoted object key after '{' or ','
    if (/[A-Za-z_$]/.test(ch)) {
      let idEnd = i + 1;
      while (idEnd < len && /[A-Za-z0-9_$]/.test(src[idEnd])) idEnd++;
      const ident = src.slice(i, idEnd);

      let wsEnd = idEnd;
      while (wsEnd < len && /\s/.test(src[wsEnd])) wsEnd++;

      if (src[wsEnd] === ':') {
        out += `"${ident}":`;
        i = wsEnd + 1;
        continue;
      }

      out += ident;
      i = idEnd;
      continue;
    }

    // Strip trailing commas before '}' or ']'
    if (ch === ',') {
      let look = i + 1;
      while (look < len && /\s/.test(src[look])) look++;
      if (src[look] === '}' || src[look] === ']') {
        i++;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

const VIDEOPSALM_TAG_MAP = {
  0: 'Verse',
  1: 'Chorus',
  2: 'Pre-Chorus',
  3: 'Bridge',
  4: 'Tag',
  5: 'Intro',
  6: 'Outro',
  7: 'Interlude'
};

export function parseVideoPsalmVpc(rawText, options = { stripChords: true }) {
  if (!rawText || typeof rawText !== 'string') return [];

  let data;
  try {
    data = JSON.parse(rawText.replace(/^\uFEFF/, ''));
  } catch {
    try {
      const strictJson = normalizeVideoPsalmToStrictJson(rawText);
      data = JSON.parse(strictJson);
    } catch {
      return [];
    }
  }

  const rawSongs = Array.isArray(data?.Songs)
    ? data.Songs
    : Array.isArray(data)
    ? data
    : data?.Verses
    ? [data]
    : [];

  const songs = [];

  for (const s of rawSongs) {
    const title = String(s.Text || s.Title || '').replace(/<[^>]+>/g, '').trim();
    const artist = [s.Author, s.Composer]
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .join(', ');

    const ccli = String(s.CCLI || '').trim();
    const copyright = String(s.Copyright || '').trim();
    const rawSeq = String(s.Sequence || '').trim();

    const verses = Array.isArray(s.Verses) ? s.Verses : [];
    const sections = [];
    const codeToSecName = new Map();

    verses.forEach((v, idx) => {
      const rawBody = String(v.Text || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?[a-z][^>]*>/gi, ''); // Strip HTML styling tags

      const cleaned = cleanLyricLines(rawBody, options);
      if (cleaned.length === 0) return;

      let secName = '';
      let shortCode = '';
      if (typeof v.Tag === 'number' || /^\d+$/.test(String(v.Tag ?? ''))) {
        const tagNum = v.Tag !== undefined ? Number(v.Tag) : 0;
        const baseType = VIDEOPSALM_TAG_MAP[tagNum] || 'Verse';
        const idNum = v.ID ? Number(v.ID) : baseType === 'Verse' ? idx + 1 : 0;
        secName = idNum > 0 ? `${baseType} ${idNum}` : baseType;
        shortCode = `${baseType[0].toLowerCase()}${idNum || 1}`;
      } else if (v.Tag) {
        secName = normalizeSectionName(String(v.Tag), idx + 1);
        shortCode = String(v.Tag).toLowerCase();
      } else {
        const idNum = v.ID ? Number(v.ID) : idx + 1;
        secName = `Verse ${idNum}`;
        shortCode = `v${idNum}`;
      }

      sections.push({ name: secName, lines: cleaned });
      if (shortCode) codeToSecName.set(shortCode, secName);
    });

    if (sections.length === 0) continue;

    let arrangement = null;
    if (rawSeq) {
      const tokens = rawSeq.split(/[\s,;]+/).filter(Boolean);
      const mapped = tokens.map(t => codeToSecName.get(t.toLowerCase()) || normalizeSectionName(t));
      arrangement = resolveArrangementOrder(mapped, sections.map(sec => sec.name));
    }

    songs.push({
      title: title || 'Untitled Song',
      artist,
      ccli,
      copyright,
      arrangement,
      sections,
      sourceFormat: 'VideoPsalm'
    });
  }

  return songs;
}

/**
 * 3. CCLI SongSelect .usr Parser
 */
export function parseSongSelectUsr(rawText, filename = 'Song.usr', options = { stripChords: true }) {
  if (!rawText || typeof rawText !== 'string') return [];

  const fallbackTitle = filename.replace(/\.[^.]+$/, '') || 'Untitled Song';
  const lines = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let title = '';
  let artist = '';
  let copyright = '';
  let admin = '';
  let ccli = '';
  let fieldsRaw = '';
  let wordsRaw = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Header [S A2672885] contains the CCLI song number
    const secMatch = trimmed.match(/^\[S\s+A?(\d+)\]/i);
    if (secMatch) {
      ccli = secMatch[1];
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim().toLowerCase();
    const val = trimmed.slice(eqIdx + 1).trim();

    if (key === 'title') title = val;
    else if (key === 'author') artist = val.split(/[|/]/).map(s => s.trim()).filter(Boolean).join(', ');
    else if (key === 'copyright') copyright = val.split('|').map(s => s.trim()).filter(Boolean).join(', ');
    else if (key === 'admin') admin = val.split('|').map(s => s.trim()).filter(Boolean).join(', ');
    else if (key === 'ccli' || key === 'cclinumber') ccli = val;
    else if (key === 'fields') fieldsRaw = val;
    else if (key === 'words') wordsRaw = val;
  }

  if (!wordsRaw) return [];

  const fieldNames = fieldsRaw.split('\t').map(f => f.trim());
  const wordBlocks = wordsRaw.split('\t');

  const sections = [];
  wordBlocks.forEach((blk, idx) => {
    // SongSelect .usr encodes line breaks inside Words= as '/n'
    const expanded = blk.replace(/\/n/g, '\n').replace(/\\n/g, '\n');
    const cleaned = cleanLyricLines(expanded, options);
    if (cleaned.length > 0) {
      const rawSec = fieldNames[idx] || `Verse ${idx + 1}`;
      sections.push({
        name: normalizeSectionName(rawSec, idx + 1),
        lines: cleaned
      });
    }
  });

  if (sections.length === 0) return [];

  const fullCopyright = [copyright, admin && !copyright.includes(admin) ? `Admin. by ${admin}` : '']
    .filter(Boolean)
    .join(' ');

  return [{
    title: title || fallbackTitle,
    artist,
    ccli,
    copyright: fullCopyright,
    arrangement: null,
    sections,
    sourceFormat: 'CCLI SongSelect (.usr)'
  }];
}

/**
 * 4. ChordPro / OnSong / WorshipTools Chart Parser
 * (.cho, .crd, .chopro, .chordpro, .onsong, or text with {title:} / [C] chords)
 */
export function parseChordProSong(rawText, filename = 'Song.cho', options = { stripChords: true }) {
  if (!rawText || typeof rawText !== 'string') return [];

  const fallbackTitle = filename.replace(/\.[^.]+$/, '') || 'Untitled Song';
  const lines = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let title = '';
  let artist = '';
  let ccli = '';
  let copyright = '';
  let rawFlow = '';

  const sections = [];
  let currentSection = null;
  let inTabOrGrid = false;
  let chorusCounter = 0;
  let verseCounter = 0;
  let bridgeCounter = 0;

  const startSection = rawLabel => {
    const secName = normalizeSectionName(rawLabel, sections.length + 1);
    currentSection = { name: secName, rawLines: [] };
    sections.push(currentSection);
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // OnSong / WorshipTools top-of-file metadata key-value headers (before first section)
    if (sections.length === 0) {
      const metaMatch = trimmed.match(/^(Title|Artist|Author|Authors|CCLI|Copyright|Flow|Order|Arrangement|Key|Tempo|Time|Capo|Duration|BPM)\s*:\s*(.*)$/i);
      if (metaMatch) {
        const mKey = metaMatch[1].toLowerCase();
        const mVal = metaMatch[2].trim();
        if (mKey === 'title' && !title) title = mVal;
        else if ((mKey === 'artist' || mKey === 'author' || mKey === 'authors') && !artist) artist = mVal;
        else if (mKey === 'ccli' && !ccli) ccli = mVal.replace(/^#?\s*/, '');
        else if (mKey === 'copyright' && !copyright) copyright = mVal;
        else if (mKey === 'flow' || mKey === 'order' || mKey === 'arrangement') rawFlow = mVal;
        continue;
      }
    }

    // ChordPro {directive: value} or {directive}
    const dirMatch = trimmed.match(/^\{([a-zA-Z_]+)(?:\s*[:\s]\s*(.*?))?\}$/);
    if (dirMatch) {
      const cmd = dirMatch[1].toLowerCase();
      const arg = (dirMatch[2] || '').trim();

      if (cmd === 'title' || cmd === 't') {
        if (!title) title = arg;
      } else if (cmd === 'subtitle' || cmd === 'st' || cmd === 'artist' || cmd === 'author' || cmd === 'composer' || cmd === 'lyricist') {
        if (arg && !artist) {
          // Ignore subtitles that are purely key/tempo notes
          if (!/^(?:key|tempo|bpm|capo)\b/i.test(arg)) {
            artist = arg;
          }
        }
      } else if (cmd === 'ccli') {
        ccli = arg;
      } else if (cmd === 'copyright' || cmd === 'footer') {
        if (arg && !copyright) copyright = arg;
      } else if (cmd === 'flow' || cmd === 'order') {
        rawFlow = arg;
      } else if (cmd === 'start_of_tab' || cmd === 'sot' || cmd === 'start_of_grid' || cmd === 'sog') {
        if (options.stripChords) inTabOrGrid = true;
      } else if (cmd === 'end_of_tab' || cmd === 'eot' || cmd === 'end_of_grid' || cmd === 'eog') {
        inTabOrGrid = false;
      } else if (cmd === 'start_of_chorus' || cmd === 'soc') {
        chorusCounter++;
        startSection(arg || (chorusCounter > 1 ? `Chorus ${chorusCounter}` : 'Chorus'));
      } else if (cmd === 'start_of_verse' || cmd === 'sov') {
        verseCounter++;
        startSection(arg || `Verse ${verseCounter}`);
      } else if (cmd === 'start_of_bridge' || cmd === 'sob') {
        bridgeCounter++;
        startSection(arg || (bridgeCounter > 1 ? `Bridge ${bridgeCounter}` : 'Bridge'));
      } else if (cmd.startsWith('start_of_')) {
        const partType = cmd.replace(/^start_of_/, '');
        startSection(arg || partType);
      } else if (cmd.startsWith('end_of_') || cmd === 'eoc' || cmd === 'eov' || cmd === 'eob') {
        currentSection = null;
      } else if (cmd === 'comment' || cmd === 'c' || cmd === 'comment_italic' || cmd === 'ci' || cmd === 'comment_box' || cmd === 'cb') {
        if (arg && SECTION_LABEL_CHECK.test(arg.replace(/[:-]+$/, '').trim())) {
          startSection(arg);
        }
      }
      continue;
    }

    if (inTabOrGrid) continue;

    // SongSelect / WorshipTools footer boilerplate check
    if (/^CCLI\s+Song\s*#\s*(\d+)/i.test(trimmed)) {
      const m = trimmed.match(/^CCLI\s+Song\s*#\s*(\d+)/i);
      if (m && !ccli) ccli = m[1];
      continue;
    }
    if (/^CCLI\s+Licen[sc]e\s*#/i.test(trimmed) || /^For use solely with the SongSelect/i.test(trimmed)) {
      continue;
    }
    if (/^©\s*\d{4}/.test(trimmed) && !copyright) {
      copyright = trimmed;
      continue;
    }

    // Explicit [Verse 1] or "Verse 1:" section header
    const secBracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (secBracketMatch && SECTION_LABEL_CHECK.test(secBracketMatch[1].trim())) {
      startSection(secBracketMatch[1]);
      continue;
    }
    const secPlainMatch = trimmed.match(/^([A-Za-z][A-Za-z\s-]*?(?:\s+\d+[a-z]?)?)\s*:?$/);
    if (secPlainMatch && SECTION_LABEL_CHECK.test(secPlainMatch[1].trim()) && trimmed.length <= 28) {
      startSection(secPlainMatch[1]);
      continue;
    }

    if (!currentSection) {
      verseCounter++;
      startSection(`Verse ${verseCounter}`);
    }
    currentSection.rawLines.push(rawLine);
  }

  const finalSections = sections
    .map(sec => ({
      name: sec.name,
      lines: cleanLyricLines(sec.rawLines, options)
    }))
    .filter(sec => sec.lines.length > 0);

  if (finalSections.length === 0) return [];

  const arrangement = rawFlow
    ? resolveArrangementOrder(rawFlow, finalSections.map(s => s.name))
    : null;

  return [{
    title: title || fallbackTitle,
    artist,
    ccli,
    copyright,
    arrangement,
    sections: finalSections,
    sourceFormat: 'ChordPro / WorshipTools'
  }];
}

/**
 * 5. SongBeamer (.sng) Parser
 */
export function parseSongBeamerSng(rawText, filename = 'Song.sng', options = { stripChords: true }) {
  if (!rawText || typeof rawText !== 'string') return [];

  const fallbackTitle = filename.replace(/\.[^.]+$/, '') || 'Untitled Song';
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const allLines = normalized.split('\n');

  let title = '';
  let author = '';
  let melody = '';
  let copyright = '';
  let ccli = '';
  let verseOrder = '';

  let bodyStartIdx = 0;
  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (line === '---') {
      bodyStartIdx = i + 1;
      break;
    }
    if (line.startsWith('#')) {
      const eq = line.indexOf('=');
      if (eq !== -1) {
        const key = line.slice(1, eq).trim().toLowerCase();
        const val = line.slice(eq + 1).trim();
        if (key === 'title') title = val;
        else if (key === 'author') author = val;
        else if (key === 'melody') melody = val;
        else if (key === '(c)' || key === 'copyright' || key === 'rights') copyright = val;
        else if (key === 'ccli') ccli = val.replace(/^#?\s*/, '');
        else if (key === 'verseorder') verseOrder = val;
      }
    } else if (line) {
      // Reached lyrics without "---"
      bodyStartIdx = i;
      break;
    }
  }

  const bodyText = allLines.slice(bodyStartIdx).join('\n');
  const rawBlocks = bodyText.split(/\n---?\s*\n/);
  const sections = [];
  let currentSec = null;

  rawBlocks.forEach((blk, idx) => {
    const blkLines = blk
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('$$'));

    if (blkLines.length === 0) return;

    let label = '';
    let contentLines = blkLines;

    if (SECTION_LABEL_CHECK.test(blkLines[0].replace(/[:-]+$/, '').trim())) {
      label = blkLines[0];
      contentLines = blkLines.slice(1);
    }

    const cleaned = cleanLyricLines(contentLines, options);
    if (cleaned.length === 0) return;

    if (label) {
      currentSec = {
        name: normalizeSectionName(label, sections.length + 1),
        lines: [...cleaned]
      };
      sections.push(currentSec);
    } else if (currentSec) {
      // Continuation slide "--" inside the same SongBeamer section
      currentSec.lines.push(...cleaned);
    } else {
      currentSec = {
        name: `Verse ${idx + 1}`,
        lines: [...cleaned]
      };
      sections.push(currentSec);
    }
  });

  if (sections.length === 0) return [];

  const artist = [author, melody]
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(', ');

  const arrangement = verseOrder
    ? resolveArrangementOrder(verseOrder, sections.map(s => s.name))
    : null;

  return [{
    title: title || fallbackTitle,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat: 'SongBeamer (.sng)'
  }];
}

/**
 * 6. RFC-4180 Multi-line CSV Parser (WorshipTools, Planning Center, Elvanto, Spreadsheets)
 */
function parseCsvRows(csvText, delimiter = ',') {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  const text = csvText.replace(/^\uFEFF/, '');
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
}

export function parseCsvSongs(csvText, filename = 'Songs.csv', options = { stripChords: true }) {
  if (!csvText || typeof csvText !== 'string') {
    return { songs: [], warnings: [] };
  }

  const firstLine = csvText.replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '';
  let delimiter = ',';
  if (!firstLine.includes(',') && firstLine.includes('\t')) delimiter = '\t';
  else if (!firstLine.includes(',') && firstLine.includes(';')) delimiter = ';';

  const rows = parseCsvRows(csvText, delimiter);
  if (rows.length < 2) {
    return { songs: [], warnings: [] };
  }

  const headers = rows[0].map(h => h.trim().toLowerCase().replace(/[_-]+/g, ' '));
  const findCol = candidates => headers.findIndex(h => candidates.includes(h));

  const titleIdx = findCol(['title', 'song title', 'name', 'song name', 'song']);
  const artistIdx = findCol(['artist', 'author', 'authors', 'writer', 'writers', 'composer', 'credits']);
  const ccliIdx = findCol(['ccli', 'ccli number', 'ccli #', 'ccli no', 'song number', 'ccli id']);
  const copyIdx = findCol(['copyright', 'copyright info', 'publisher', 'rights']);
  const arrIdx = findCol(['arrangement', 'sequence', 'order', 'verse order', 'flow']);
  const lyricsIdx = findCol([
    'lyrics',
    'words',
    'text',
    'content',
    'body',
    'song text',
    'chord chart',
    'chart',
    'plain text'
  ]);

  if (lyricsIdx === -1) {
    if (titleIdx !== -1) {
      return {
        songs: [],
        warnings: [
          `${filename}: CSV contains song metadata (${rows.length - 1} rows) without a Lyrics column. Export ChordPro, SongSelect .txt/.usr, or OpenLyrics files to include full lyrics.`
        ]
      };
    }
    return { songs: [], warnings: [] };
  }

  const songs = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => !c || !c.trim())) continue;

    const rawLyrics = row[lyricsIdx] || '';
    if (!rawLyrics.trim()) continue;

    const title = (titleIdx !== -1 ? row[titleIdx] : '')?.trim() || `Imported Song ${r}`;
    const artist = (artistIdx !== -1 ? row[artistIdx] : '')?.trim() || '';
    const ccli = (ccliIdx !== -1 ? row[ccliIdx] : '')?.trim() || '';
    const copyright = (copyIdx !== -1 ? row[copyIdx] : '')?.trim() || '';
    const rawArr = (arrIdx !== -1 ? row[arrIdx] : '')?.trim() || '';

    const sections = parseSectionedPlainLyrics(rawLyrics, options);
    if (sections.length === 0) continue;

    const arrangement = rawArr
      ? resolveArrangementOrder(rawArr, sections.map(s => s.name))
      : null;

    songs.push({
      title,
      artist,
      ccli,
      copyright,
      arrangement,
      sections,
      sourceFormat: 'CSV Spreadsheet'
    });
  }

  return { songs, warnings: [] };
}

/**
 * 7. Plain Text / SongSelect .txt / Presenter .md / RTF Parser
 */
export function parsePlainOrMarkdownSong(rawInput, filename = 'Song.txt', options = { stripChords: true }) {
  if (!rawInput || typeof rawInput !== 'string') return [];

  let text = rawInput.replace(/^\uFEFF/, '');
  let sourceFormat = 'Plain Text';

  if (text.trimStart().startsWith('{\\rtf')) {
    text = rtfToPlainText(text);
    sourceFormat = 'RTF Document';
  }

  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if ChordPro directives exist in a .txt file
  if (/\{(?:title|t|start_of_verse|sov|start_of_chorus|soc|ccli|comment|c)\s*[:}]/i.test(text)) {
    return parseChordProSong(text, filename, options);
  }

  const fallbackTitle = filename.replace(/\.[^.]+$/, '') || 'Untitled Song';
  let title = '';
  let artist = '';
  let ccli = '';
  let copyright = '';
  let rawArrangement = '';
  let bodyText = text;

  // Check for Presenter YAML Frontmatter (--- ... ---)
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fmMatch) {
    sourceFormat = 'Presenter Markdown';
    const yamlBlock = fmMatch[1];
    bodyText = fmMatch[2];
    for (const line of yamlBlock.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      let val = line.slice(colonIdx + 1).trim();
      val = val.replace(/^["']|["']$/g, '');
      if (key === 'title') title = val;
      else if (key === 'artist' || key === 'author') artist = val;
      else if (key === 'ccli') ccli = val;
      else if (key === 'copyright') copyright = val;
      else if (key === 'arrangement') {
        rawArrangement = val.replace(/^\[|\]$/g, '');
      }
    }
  } else {
    // Check for SongSelect Lyrics .txt format (Title on line 1 + "CCLI Song # 123456" footer)
    const ccliFooterIdx = bodyText.search(/\nCCLI\s+Song\s*#\s*\d+/i);
    if (ccliFooterIdx !== -1) {
      sourceFormat = 'CCLI SongSelect (.txt)';
      const footerPart = bodyText.slice(ccliFooterIdx).trim();
      bodyText = bodyText.slice(0, ccliFooterIdx).trim();

      const footerLines = footerPart.split('\n').map(l => l.trim()).filter(Boolean);
      const ccliMatch = footerLines[0]?.match(/CCLI\s+Song\s*#\s*(\d+)/i);
      if (ccliMatch) ccli = ccliMatch[1];

      for (let i = 1; i < footerLines.length; i++) {
        const fl = footerLines[i];
        if (/^For use solely with/i.test(fl) || /^CCLI\s+Licen[sc]e/i.test(fl)) continue;
        if (/^(?:©|\(c\)|\d{4}\s)/i.test(fl)) {
          if (!copyright) copyright = fl;
        } else if (!artist) {
          artist = fl;
        }
      }

      // First non-empty line in SongSelect .txt (if followed by blank line and not a section header) is the Title
      const bodyLines = bodyText.split('\n');
      if (
        bodyLines.length >= 2 &&
        bodyLines[0].trim() &&
        !bodyLines[1].trim() &&
        !SECTION_LABEL_CHECK.test(bodyLines[0].trim())
      ) {
        title = bodyLines[0].trim();
        bodyText = bodyLines.slice(2).join('\n');
      }
    }
  }

  const sections = parseSectionedPlainLyrics(bodyText, options);
  if (sections.length === 0) return [];

  const arrangement = rawArrangement
    ? resolveArrangementOrder(rawArrangement, sections.map(s => s.name))
    : null;

  return [{
    title: title || fallbackTitle,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat
  }];
}
