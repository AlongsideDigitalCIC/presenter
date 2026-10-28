/**
 * Splits lines into chunks of max 4 lines with balanced splitting.
 * Examples:
 * 5 lines -> 3, 2 (or 3, 2)
 * 6 lines -> 3, 3
 * 7 lines -> 4, 3
 * 8 lines -> 4, 4
 * @param {string[]} lines 
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
 * Supports YAML frontmatter and [Verse 1] tags.
 * Also automatically extracts copyright, artist, and CCLI song numbers.
 * @param {string} rawText 
 * @returns {{ metadata: {title: string, ccli: string, artist: string, copyright: string}, slides: Array<{type: string, content: string[], index: number}> }}
 */
export function parseSongMarkdown(rawText, maxLines = 4) {
  let textToParse = (rawText || '').trim();
  const metadata = { title: 'Unknown Song', ccli: '', artist: '', copyright: '' };
  
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
    // If the line immediately before firstMetaIdx is an author line with pipes (e.g. "Jonas Myrin | Matt Redman")
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

  // 3. Auto-bracket standard song sections if they aren't bracketed yet (e.g. from SongSelect copy-paste or raw text)
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
  
  let currentGroup = 'Intro'; // Default if no tag at start
  const slides = [];
  let slideIndex = 1;

  // Handle text before the very first tag
  if (parts[0].trim()) {
      const chunks = balanceLines(parts[0].trim().split('\n').filter(l => l.trim() !== ''), maxLines);
      chunks.forEach(chunk => {
          slides.push({
              type: currentGroup,
              content: chunk,
              index: slideIndex++
          });
      });
  }

  // parts format: [text before tag, tag1, text1, tag2, text2...]
  for (let i = 1; i < parts.length; i += 2) {
      currentGroup = parts[i].trim();
      const sectionText = parts[i+1] ? parts[i+1].trim() : '';
      
      if (!sectionText) continue;

      const lines = sectionText.split('\n').map(l => l.trim()).filter(l => l !== '');
      if (lines.length === 0) continue;

      const chunks = balanceLines(lines, maxLines);
      
      chunks.forEach(chunk => {
          slides.push({
              type: currentGroup,
              content: chunk,
              index: slideIndex++
          });
      });
  }

  return { metadata, slides };
}
