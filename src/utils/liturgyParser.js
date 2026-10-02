/**
 * Parses a liturgy markdown file into slide objects.
 *
 * Format:
 *   [/speaker:left]
 *   Lord have mercy upon us.
 *
 *   [/response:center]
 *   Lord have mercy.
 *
 * Each block is split into slides based on linesPerSlide.
 *
 * @param {string} rawText
 * @param {number} linesPerSlide - optional limit for lines in one slide
 * @returns {{ metadata: object, slides: Array<{type: 'speaker'|'response', alignment: 'left'|'center'|'right', content: string[], index: number}> }}
 */
export function parseLiturgyMarkdown(rawText, linesPerSlide = 0) {
  let text = rawText || '';
  const metadata = { title: 'Untitled Liturgy' };

  // Extract optional YAML frontmatter
  const yamlMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    const lines = yamlMatch[1].split('\n');
    lines.forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        const val = rest.join(':').trim();
        if (key.trim().toLowerCase() === 'title') metadata.title = val;
      }
    });
    text = text.replace(yamlMatch[0], '').trim();
  }

  // Split by [/speaker:alignment], [/response:alignment], [/candidate:alignment], and [/group:alignment] tags
  // Regex captures: 1=type(speaker/response/candidate/group), 2=alignment(left/center/right)
  // Flags: g (global), m (multiline), i (case-insensitive)
  const tagRegex = /^\[\/\s*(speaker|response|candidate|group)\s*(?::\s*(left|center|right)\s*)?\]\s*$/gmi;
  const tagMatches = [...text.matchAll(tagRegex)];

  const slides = [];
  let slideIndex = 1;

  const pushSlides = (type, alignment, blockText) => {
    const normalizedType = (type || 'speaker').toLowerCase();
    const normalizedAlignment = (alignment || 'center').toLowerCase();
    
    const lines = blockText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    if (linesPerSlide > 0) {
      for (let i = 0; i < lines.length; i += linesPerSlide) {
        slides.push({
          type: normalizedType,
          alignment: normalizedAlignment,
          content: lines.slice(i, i + linesPerSlide),
          index: slideIndex++
        });
      }
    } else {
      slides.push({
        type: normalizedType,
        alignment: normalizedAlignment,
        content: lines,
        index: slideIndex++
      });
    }
  };

  if (tagMatches.length === 0) {
    pushSlides('speaker', 'center', text);
    return { metadata, slides };
  }

  // Content before the first tag
  if (tagMatches[0].index > 0) {
    const before = text.slice(0, tagMatches[0].index).trim();
    if (before) pushSlides('speaker', 'center', before);
  }

  // Process each tagged block
  tagMatches.forEach((match, i) => {
    const tagLine = match[0];
    const type = match[1]; // 'speaker' | 'response'
    const alignment = match[2] || 'center'; // 'left' | 'center' | 'right'
    
    const blockStart = match.index + tagLine.length;
    const blockEnd = i + 1 < tagMatches.length ? tagMatches[i + 1].index : text.length;
    const blockText = text.slice(blockStart, blockEnd).trim();

    pushSlides(type, alignment, blockText);
  });

  return { metadata, slides };
}

/**
 * Converts slides back to raw markdown text for saving.
 * Inverse of parseLiturgyMarkdown (for the section body only).
 *
 * @param {string} title
 * @param {string} body  — the raw editor text (already has [/speaker]/[/response] tags)
 * @returns {string}
 */
export function buildLiturgyMarkdown(title, body) {
  const frontmatter = `---\ntitle: ${title}\n---`;
  return `${frontmatter}\n\n${body.trim()}\n`;
}
