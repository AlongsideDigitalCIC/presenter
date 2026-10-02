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
 * @param {string} rawText 
 * @returns {{ metadata: {title: string, ccli: string}, slides: Array<{type: string, content: string[], index: number}> }}
 */
export function parseSongMarkdown(rawText, maxLines = 4) {
  let textToParse = rawText.trim();
  const metadata = { title: 'Unknown Song', ccli: '', artist: '' };
  
  // 1. Extract metadata if present
  const yamlMatch = textToParse.match(/^---\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    const yamlStr = yamlMatch[1];
    const lines = yamlStr.split('\n');
    lines.forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        const val = rest.join(':').trim();
        if (key.trim().toLowerCase() === 'title') metadata.title = val;
        if (key.trim().toLowerCase() === 'ccli') metadata.ccli = val;
        if (key.trim().toLowerCase() === 'artist') metadata.artist = val;
      }
    });
    textToParse = textToParse.replace(yamlMatch[0], '').trim();
  }

  // 2. Split by tags like [Verse 1], [Chorus]
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
