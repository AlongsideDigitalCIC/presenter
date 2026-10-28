/**
 * Splits lines into chunks of max 4 lines with balanced splitting.
 * Examples:
 * 5 lines -> 3, 2 (or 3, 2)
 * 6 lines -> 3, 3
 * 7 lines -> 4, 3
 * 8 lines -> 4, 4
 * @param {string[]} lines 
 * @param {number} maxLines
 * @returns {string[][]}
 */
export function balanceLines(lines, maxLines = 4) {
  if (lines.length <= maxLines) return [lines];
  
  const chunks = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines));
  }
  return chunks;
}

/**
 * Parses raw markdown into an array of slide objects.
 * Supports YAML frontmatter, [Verse 1] tags, and dynamic section arrangements.
 * Also automatically extracts copyright, artist, CCLI song numbers, and arrangements.
 * 
 * @param {string} rawText 
 * @param {number} maxLines 
 * @param {string[]|null} customArrangement Optional custom sequence of section names e.g. ['Verse 1', 'Chorus', 'Verse 2', 'Chorus']
 * @returns {{
 *   metadata: {title: string, ccli: string, artist: string, copyright: string, arrangement: string[]|null},
 *   slides: Array<{type: string, content: string[], index: number, arrangementIndex?: number}>,
 *   uniqueSections: string[],
 *   naturalOrder: string[],
 *   arrangement: string[]
 * }}
 */
export function parseSongMarkdown(rawText, maxLines = 4, customArrangement = null) {
  let textToParse = (rawText || '').trim();
  const metadata = { title: 'Unknown Song', ccli: '', artist: '', copyright: '', arrangement: null };
  
  // 1. Extract YAML frontmatter metadata if present
  const yamlMatch = textToParse.match(/^---\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    const yamlStr = yamlMatch[1];
    const lines = yamlStr.split('\n');
    lines.forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        const k = key.trim().toLowerCase();
        const val = rest.join(':').trim();
        if (k === 'title') metadata.title = val;
        if (['ccli', 'ccli_number', 'ccli song #', 'ccli song no', 'cclisong'].includes(k)) metadata.ccli = val;
        if (['artist', 'author', 'writer', 'composer', 'words and music'].includes(k)) metadata.artist = val;
        if (['copyright', 'rights', 'ccli_copyright'].includes(k)) metadata.copyright = val;
        if (['arrangement', 'order', 'sequence'].includes(k)) {
          try {
            if (val.startsWith('[') && val.endsWith(']')) {
              metadata.arrangement = val.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            } else {
              metadata.arrangement = val.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            }
          } catch { /* ignore */ }
        }
      }
    });
    textToParse = textToParse.replace(yamlMatch[0], '').trim();
  }

  // 2. Detect and strip trailing CCLI / copyright metadata if present in lyrics body
  const allLines = textToParse.split('\n');
  let firstMetaIdx = -1;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    
    const isCcliSong = /(?:CCLI Song #|CCLI #)\s*(\d+)/i.test(line);
    const isCopyright = /^(?:©|\(c\)|Copyright|Public Domain)/i.test(line);
    const isSongSelect = /(?:For use solely with|SongSelect|All rights reserved|www\.ccli\.com|CCLI License #)/i.test(line);
    const isAuthorTag = /^(?:Words & Music|Words and Music|Written By|By:)/i.test(line);

    if (isCcliSong || isCopyright || isSongSelect || isAuthorTag) {
      if (firstMetaIdx === -1) {
        firstMetaIdx = i;
      }
    }
  }

  if (firstMetaIdx !== -1) {
    if (firstMetaIdx > 0 && allLines[firstMetaIdx - 1].includes('|') && !allLines[firstMetaIdx - 1].startsWith('[')) {
      firstMetaIdx--;
    }

    const metaBlock = allLines.slice(firstMetaIdx);
    metaBlock.forEach(l => {
      const line = l.trim();
      const ccliMatch = line.match(/(?:CCLI Song #|CCLI #)\s*(\d+)/i);
      if (ccliMatch && !metadata.ccli) metadata.ccli = ccliMatch[1];

      const copyrightMatch = line.match(/^(?:©|\(c\)|Copyright)\s*(.*)/i);
      if (copyrightMatch && !metadata.copyright) metadata.copyright = line;
      if (/^Public Domain$/i.test(line) && !metadata.copyright) metadata.copyright = 'Public Domain';

      if (line.includes('|') && !metadata.artist && !line.startsWith('[')) {
        metadata.artist = line.split('|').map(s => s.trim()).join(', ');
      } else {
        const authorMatch = line.match(/^(?:Words & Music|Words and Music|Written By|By:)\s*(.*)/i);
        if (authorMatch && !metadata.artist) metadata.artist = authorMatch[1].trim();
      }
    });

    textToParse = allLines.slice(0, firstMetaIdx).join('\n').trim();
  }

  // 3. Auto-bracket standard song sections if they aren't bracketed yet
  const SECTION_NAMES = '(?:Verse|Chorus|Pre[\\s-]?Chorus|Post[\\s-]?Chorus|Bridge|Intro|Outro|Ending|Tag|Instrumental|Interlude|Refrain|Vamp|Hook)';
  const unbracketedSectionRegex = new RegExp(`^\\s*(${SECTION_NAMES})\\s*(\\d+)?\\s*$`, 'gim');
  textToParse = textToParse.replace(unbracketedSectionRegex, (match, sec, num) => {
    let normalizedSec = sec.trim();
    if (/^pre[\s-]?chorus$/i.test(normalizedSec)) {
      normalizedSec = 'Pre-Chorus';
    } else if (/^post[\s-]?chorus$/i.test(normalizedSec)) {
      normalizedSec = 'Post-Chorus';
    } else {
      normalizedSec = normalizedSec.charAt(0).toUpperCase() + normalizedSec.slice(1).toLowerCase();
    }
    const numStr = num ? ' ' + num.trim() : '';
    return `[${normalizedSec}${numStr}]`;
  });

  // 4. Split by tags like [Verse 1], [Chorus], [Pre-Chorus]
  const sectionSplitRegex = /^\[(.*?)\]$/gm;
  const parts = textToParse.split(sectionSplitRegex);
  
  const sectionsMap = {};
  const naturalOrder = [];
  const uniqueSections = [];

  let currentGroup = 'Intro';
  if (parts[0].trim()) {
    const lines = parts[0].trim().split('\n').filter(l => l.trim() !== '');
    if (lines.length > 0) {
      sectionsMap[currentGroup] = lines;
      naturalOrder.push(currentGroup);
      uniqueSections.push(currentGroup);
    }
  }

  for (let i = 1; i < parts.length; i += 2) {
    const groupName = parts[i].trim();
    const sectionText = parts[i+1] ? parts[i+1].trim() : '';
    if (!sectionText) continue;

    const lines = sectionText.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) continue;

    if (!sectionsMap[groupName]) {
      sectionsMap[groupName] = lines;
      uniqueSections.push(groupName);
    }
    naturalOrder.push(groupName);
  }

  // Determine active sequence
  const targetArrangement = (Array.isArray(customArrangement) && customArrangement.length > 0)
    ? customArrangement
    : (Array.isArray(metadata.arrangement) && metadata.arrangement.length > 0)
    ? metadata.arrangement
    : naturalOrder;

  const slides = [];
  let slideIndex = 1;

  targetArrangement.forEach((secName, arrIdx) => {
    let lines = sectionsMap[secName];
    if (!lines) {
      const matchKey = Object.keys(sectionsMap).find(k => k.toLowerCase() === secName.toLowerCase());
      if (matchKey) lines = sectionsMap[matchKey];
    }
    if (!lines || lines.length === 0) return;

    const chunks = balanceLines(lines, maxLines);
    chunks.forEach((chunk, chunkIdx) => {
      slides.push({
        type: secName,
        content: chunk,
        index: slideIndex++,
        arrangementIndex: arrIdx,
        chunkIndex: chunkIdx,
        totalChunks: chunks.length
      });
    });
  });

  return {
    metadata,
    slides,
    uniqueSections,
    naturalOrder,
    arrangement: targetArrangement
  };
}

/**
 * Updates a slide's lines inside the master song's raw markdown text.
 * Replaces the old slide text while keeping section headers, frontmatter, and other slides intact.
 * 
 * @param {string} rawText The existing markdown content
 * @param {string[]} oldLines The original lines of the slide
 * @param {string[]} newLines The updated lines of the slide
 * @param {string|null} sectionType The name of the section (e.g. 'Verse 1', 'Chorus')
 * @returns {string} The updated raw markdown text
 */
export function patchSlideInRawText(rawText, oldLines, newLines, sectionType = null) {
  if (!rawText) return rawText;
  const oldBlock = (oldLines || []).map(l => l.trim()).filter(Boolean).join('\n');
  const newBlock = (newLines || []).map(l => l.trim()).filter(Boolean).join('\n');
  if (!oldBlock || oldBlock === newBlock) return rawText;

  // 1. Direct block match
  if (rawText.includes(oldBlock)) {
    return rawText.replace(oldBlock, newBlock);
  }

  // 2. CRLF-normalized direct match
  const normalizedRaw = rawText.replace(/\r\n/g, '\n');
  if (normalizedRaw.includes(oldBlock)) {
    const replaced = normalizedRaw.replace(oldBlock, newBlock);
    return rawText.includes('\r\n') ? replaced.replace(/\n/g, '\r\n') : replaced;
  }

  // 3. Section-scoped replacement
  if (sectionType) {
    const secTag = `[${sectionType}]`;
    const secIdx = normalizedRaw.indexOf(secTag);
    if (secIdx !== -1) {
      const before = normalizedRaw.slice(0, secIdx);
      const after = normalizedRaw.slice(secIdx);
      const nextSecMatch = after.slice(secTag.length).search(/^\[.*?\]$/m);
      const secBody = nextSecMatch !== -1 
        ? after.slice(0, secTag.length + nextSecMatch)
        : after;
      const rest = nextSecMatch !== -1
        ? after.slice(secTag.length + nextSecMatch)
        : '';
      
      if (secBody.includes(oldBlock)) {
        const updatedSecBody = secBody.replace(oldBlock, newBlock);
        const result = before + updatedSecBody + rest;
        return rawText.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result;
      }
    }
  }

  return rawText;
}
