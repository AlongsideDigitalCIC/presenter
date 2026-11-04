/**
 * Canonical section name normalization, chord stripping, and Markdown serialization
 * for Presenter's Universal Song Library Importer.
 */

const SHORTHAND_MAP = {
  v: 'Verse',
  verse: 'Verse',
  strophe: 'Verse',
  vers: 'Verse',
  s: 'Verse',
  c: 'Chorus',
  ch: 'Chorus',
  chor: 'Chorus',
  chorus: 'Chorus',
  r: 'Refrain',
  ref: 'Refrain',
  refrain: 'Refrain',
  p: 'Pre-Chorus',
  pc: 'Pre-Chorus',
  pre: 'Pre-Chorus',
  prechorus: 'Pre-Chorus',
  'pre-chorus': 'Pre-Chorus',
  'pre chorus': 'Pre-Chorus',
  post: 'Post-Chorus',
  postchorus: 'Post-Chorus',
  'post-chorus': 'Post-Chorus',
  'post chorus': 'Post-Chorus',
  b: 'Bridge',
  br: 'Bridge',
  bridge: 'Bridge',
  m: 'Bridge', // Middle 8
  t: 'Tag',
  tag: 'Tag',
  coda: 'Tag',
  i: 'Intro',
  int: 'Intro',
  intro: 'Intro',
  introduction: 'Intro',
  o: 'Outro',
  out: 'Outro',
  outro: 'Outro',
  e: 'Ending',
  end: 'Ending',
  ending: 'Ending',
  ins: 'Instrumental',
  inst: 'Instrumental',
  instr: 'Instrumental',
  instrumental: 'Instrumental',
  interlude: 'Interlude',
  turn: 'Turnaround',
  turnaround: 'Turnaround',
  vamp: 'Vamp',
  hook: 'Hook',
  misc: 'Misc'
};

/**
 * Normalizes shorthand or raw section tags (e.g. "v1", "C", "pc2", "CHORUS 1", "Verse 1:")
 * into Presenter's standard section labels ("Verse 1", "Chorus", "Pre-Chorus 2", etc.).
 */
export function normalizeSectionName(rawName, fallbackIndex = 1) {
  if (!rawName || typeof rawName !== 'string') {
    return `Verse ${fallbackIndex}`;
  }

  let cleaned = rawName
    .replace(/^\[|\]$/g, '')
    .replace(/[:\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || /^group$/i.test(cleaned) || /^slide\s*\d*$/i.test(cleaned)) {
    return `Verse ${fallbackIndex}`;
  }

  // Match prefix + optional trailing number/letter (e.g., "v1", "v1a", "Verse 2", "Pre-Chorus 1")
  const match = cleaned.match(/^([a-zA-Z\s-]+?)\s*(\d+[a-zA-Z]?)?$/);
  if (match) {
    const rawKey = match[1].trim().toLowerCase();
    const compactKey = rawKey.replace(/[\s_-]+/g, '');
    const suffix = match[2] ? match[2].trim() : '';

    // Special case: OpenLP uses "O1" for "Other 1" whereas OpenSong/VideoPsalm use "O" for "Outro"
    const mapped = SHORTHAND_MAP[rawKey] || SHORTHAND_MAP[compactKey];
    if (mapped) {
      return suffix ? `${mapped} ${suffix}` : mapped;
    }
  }

  // Title-case clean custom labels while preserving numbers
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 2) {
    cleaned = cleaned
      .toLowerCase()
      .replace(/\b\w/g, ch => ch.toUpperCase());
  }

  return cleaned;
}

/**
 * Expands a space- or comma-delimited verse order string (e.g. "v1 c1 v2 c1 b1 c1")
 * and aligns tokens against the actual section names present in the song.
 */
export function resolveArrangementOrder(rawOrder, availableSectionNames = []) {
  if (!rawOrder) return null;

  const tokens = Array.isArray(rawOrder)
    ? rawOrder.map(t => String(t).trim()).filter(Boolean)
    : String(rawOrder)
        .split(/[\s,;]+/)
        .map(t => t.trim())
        .filter(Boolean);

  if (tokens.length === 0) return null;

  const availableLowerMap = new Map();
  availableSectionNames.forEach(sec => {
    availableLowerMap.set(sec.toLowerCase(), sec);
    // Also map without trailing " 1" so "Chorus" matches "Chorus 1" and vice versa
    if (/\s+1$/i.test(sec)) {
      const base = sec.replace(/\s+1$/i, '').toLowerCase();
      if (!availableLowerMap.has(base)) availableLowerMap.set(base, sec);
    } else {
      const withOne = `${sec.toLowerCase()} 1`;
      if (!availableLowerMap.has(withOne)) availableLowerMap.set(withOne, sec);
    }
  });

  const resolved = [];
  for (const token of tokens) {
    const directMatch = availableLowerMap.get(token.toLowerCase());
    if (directMatch) {
      resolved.push(directMatch);
      continue;
    }

    const norm = normalizeSectionName(token);
    const normMatch = availableLowerMap.get(norm.toLowerCase());
    if (normMatch) {
      resolved.push(normMatch);
    } else if (availableSectionNames.length === 0) {
      resolved.push(norm);
    }
  }

  return resolved.length > 0 ? resolved : null;
}

const CHORD_TOKEN_REGEX = /^(?:N\.?C\.?|[A-G][#b♯♭]?(?:m|maj|min|dim|aug|sus|add|no|M|\+|-|°|ø|\d)*(?:\/[A-G][#b♯♭]?)?|\([A-G][#b♯♭]?[^)]*\))$/;
const REPEAT_OR_BAR_TOKEN = /^(?:\|+|\|:|:\||\/+|-+|–+|x\d+|\d+x|\(\d+x\))$/i;

/**
 * Determines whether a line consists solely of musical chords / bar markers
 * (e.g. "G    D/F#   Em7   Cadd9") without misclassifying English lyrics like "I am".
 */
export function isChordOnlyLine(line) {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (!trimmed) return false;

  // OpenSong explicit chord line starts with '.'
  if (trimmed.startsWith('.') && trimmed.length > 1 && !trimmed.startsWith('..')) {
    return true;
  }

  // Strip surrounding parentheses if the entire line is e.g. "(G  D  Em  C)"
  const unwrapped = trimmed.replace(/^\((.*)\)$/, '$1').trim();
  const tokens = unwrapped.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  let ambiguousWordCount = 0;

  for (const tok of tokens) {
    const cleanTok = tok.replace(/^[|([]+|[|)\],]+$/g, '');
    if (!cleanTok) continue;
    if (REPEAT_OR_BAR_TOKEN.test(cleanTok) || REPEAT_OR_BAR_TOKEN.test(tok)) {
      continue;
    }
    if (CHORD_TOKEN_REGEX.test(cleanTok)) {
      chordCount++;
      // "A" and "Am" can also be English words
      if (cleanTok === 'A' || cleanTok === 'Am') {
        ambiguousWordCount++;
      }
    } else {
      return false;
    }
  }

  if (chordCount === 0) return false;
  // Avoid stripping a single-word lyric line that is literally "A" or "Am"
  if (chordCount === ambiguousWordCount && tokens.length === 1 && !/\s{2,}/.test(line)) {
    return false;
  }

  return true;
}

const INLINE_CHORD_BRACKET_REGEX = /\[([A-G][#b♯♭]?(?:m|maj|min|dim|aug|sus|add|no|M|\+|-|°|ø|\d)*(?:\/[A-G][#b♯♭]?)?(?:\s+[A-G][#b♯♭]?[^\]]*)?)\]/g;

/**
 * Strips inline ChordPro / VideoPsalm / OpenLP bracketed chords like "[G]Amazing [D/F#]grace"
 * while preserving structural tags or vocal cues like "[x2]" or "[All]".
 */
export function stripInlineChords(line) {
  if (!line || typeof line !== 'string') return '';
  if (!line.includes('[')) return line;

  return line
    .replace(INLINE_CHORD_BRACKET_REGEX, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Cleans an array or string of lyric lines for a section, optionally stripping chords.
 */
export function cleanLyricLines(inputLines, { stripChords = true } = {}) {
  const rawArr = Array.isArray(inputLines)
    ? inputLines
    : String(inputLines || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const cleaned = [];
  for (let raw of rawArr) {
    if (typeof raw !== 'string') continue;

    // Strip OpenLP formatting tags like {st}, {/st}, {r}, {/r}, {it}, {/it}
    let line = raw
      .replace(/\{(?:\/?[a-z]{1,4})\}/gi, '')
      .replace(/[\u2028\u2029]/g, ' ')
      .replace(/\u00A0/g, ' ');

    if (stripChords) {
      if (isChordOnlyLine(line)) continue;
      line = stripInlineChords(line);
    }

    line = line.trim();
    if (line && line !== 'Double-click to edit') {
      cleaned.push(line);
    }
  }

  return cleaned;
}

/**
 * Produces a safe filesystem filename (without .md extension) for saving into Songs/.
 */
export function sanitizeSongFilename(title) {
  const cleaned = String(title || 'Untitled Song')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/[^\p{L}\p{N}\s'’()\-&,!]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || 'Untitled Song').slice(0, 120).trim();
}

/**
 * Sanitizes single-line YAML frontmatter values so colons or newlines never corrupt frontmatter.
 */
function cleanYamlScalar(val) {
  return String(val || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a normalized imported song object into Presenter's native Markdown (.md) format.
 *
 * @param {{
 *   title: string,
 *   artist?: string,
 *   ccli?: string,
 *   copyright?: string,
 *   arrangement?: string[]|null,
 *   sections: Array<{ name: string, lines: string[] }>
 * }} song
 * @returns {string}
 */
export function serializeSongToMarkdown(song) {
  const title = cleanYamlScalar(song.title || 'Untitled Song');
  const artist = cleanYamlScalar(song.artist || '');
  const ccli = cleanYamlScalar(String(song.ccli || '').replace(/^(?:CCLI\s*(?:Song\s*)?#?\s*)/i, ''));
  const copyright = cleanYamlScalar(song.copyright || '');

  // Deduplicate identical section names while building natural order & unique section map
  const uniqueSections = [];
  const seenMap = new Map();
  const naturalOrder = [];

  for (const sec of song.sections || []) {
    const cleanLines = (sec.lines || []).map(l => String(l).trim()).filter(Boolean);
    if (cleanLines.length === 0) continue;

    let secName = normalizeSectionName(sec.name || 'Verse 1', uniqueSections.length + 1);
    const existing = seenMap.get(secName.toLowerCase());

    if (existing) {
      const existingJoined = existing.lines.join('\n').toLowerCase();
      const currentJoined = cleanLines.join('\n').toLowerCase();
      if (existingJoined === currentJoined) {
        // Exact repeat of Chorus / Verse — record in naturalOrder without duplicating body!
        naturalOrder.push(existing.name);
        continue;
      } else {
        // Same label (e.g. "Verse") used for different lyrics -> disambiguate ("Verse 2", "Verse 3")
        const baseName = secName.replace(/\s+\d+$/, '');
        let num = 2;
        while (seenMap.has(`${baseName} ${num}`.toLowerCase())) {
          num++;
        }
        secName = `${baseName} ${num}`;
      }
    }

    const entry = { name: secName, lines: cleanLines };
    uniqueSections.push(entry);
    seenMap.set(secName.toLowerCase(), entry);
    naturalOrder.push(secName);
  }

  const availableNames = uniqueSections.map(s => s.name);
  let finalArrangement = resolveArrangementOrder(song.arrangement, availableNames);
  if (!finalArrangement && naturalOrder.length > uniqueSections.length) {
    finalArrangement = naturalOrder;
  }

  // Only emit Arrangement frontmatter if it differs from the linear uniqueSections order
  const linearOrder = uniqueSections.map(s => s.name);
  const needsArrangementHeader =
    Array.isArray(finalArrangement) &&
    finalArrangement.length > 0 &&
    (finalArrangement.length !== linearOrder.length ||
      finalArrangement.some((name, idx) => name !== linearOrder[idx]));

  const frontmatterLines = [
    '---',
    `Title: ${title}`,
    `Artist: ${artist}`,
    `CCLI: ${ccli}`,
    `Copyright: ${copyright}`
  ];

  if (needsArrangementHeader) {
    frontmatterLines.push(`Arrangement: [${finalArrangement.join(', ')}]`);
  }
  frontmatterLines.push('---');

  const bodyBlocks = uniqueSections.map(sec => `[${sec.name}]\n${sec.lines.join('\n')}`);

  return `${frontmatterLines.join('\n')}\n\n${bodyBlocks.join('\n\n')}\n`;
}
