const WIDE_FONTS = new Set(['Montserrat', 'Merriweather', 'Playfair Display']);
const COMPACT_FONTS = new Set(['Crimson Pro', 'EB Garamond', 'Lato']);

/**
 * Relative horizontal glyph width factor compared to Inter.
 * Helps estimate line wrapping accurately across all 10 presentation fonts.
 */
export function getFontWidthFactor(fontName) {
  const clean = (fontName || 'Inter').replace(/['"]/g, '').split(',')[0].trim();
  if (WIDE_FONTS.has(clean)) return 1.07;
  if (COMPACT_FONTS.has(clean)) return 0.94;
  return 1.0;
}

/**
 * Converts a 16:9 container-height percentage (cqh) into a matched (cqh, cqw) pair.
 * On any 16:9 display (1920x1080 @ 100%, 1920x1080 @ 125% Windows scaling, 4K, or 16:9 preview cards),
 * Hcqh and (H * 0.5625)cqw are equal. On narrower (4:3 / 16:10) or wider (windowed browser) viewports,
 * min() automatically scales down along the tighter axis so lines never clip or distort.
 */
export function toContainerFluidFont(cqh) {
  const safeCqh = Math.max(1.2, Number(cqh) || 5);
  const matchedCqw = +(safeCqh * 0.5625).toFixed(3);
  return `min(${safeCqh.toFixed(2)}cqh, ${matchedCqw}cqw)`;
}

/**
 * Strips non-rendered or compact markup before estimating visual character count.
 */
export function getCleanCharLength(line, mediaType) {
  const raw = String(line || '').trim();
  if (!raw) return 0;

  if (mediaType === 'bible') {
    let badgeChars = 0;
    const withoutBadges = raw.replace(/\[(\d+[a-z]?(?:-\d+[a-z]?)?(?:,\d+[a-z]?)?)\]\s*/gi, (_, num) => {
      badgeChars += Math.ceil(String(num).length * 0.7) + 1;
      return '';
    });
    return withoutBadges.length + badgeChars;
  }

  if (mediaType === 'liturgy') {
    const headingMatch = raw.match(/^(#{1,3})\s+/);
    const headingBoost = headingMatch ? (headingMatch[1].length === 1 ? 1.12 : 1.05) : 1;
    const stripped = raw
      .replace(/^#{1,3}\s+/, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/<u>(.*?)<\/u>/gi, '$1');
    return Math.ceil(stripped.length * headingBoost);
  }

  return raw.length;
}

/**
 * Estimates total wrapped visual lines at a candidate font size (in cqh) within usable width.
 */
function estimateVisualLines(lineLengths, candidateCqh, usableWidthCqw, fontWidthFactor) {
  // Usable width expressed in 16:9 cqh units (100cqw = 177.78cqh)
  const usableWidthInCqh = usableWidthCqw * (16 / 9);
  // Calibrated average advance width for mixed-case bold proportional text + word-wrap margin
  const avgCharEm = 0.505 * fontWidthFactor;
  const charsPerLine = Math.max(10, Math.floor(usableWidthInCqh / (candidateCqh * avgCharEm)));

  let totalLines = 0;
  for (const len of lineLengths) {
    if (len <= 0) {
      totalLines += 0.5;
    } else {
      totalLines += Math.max(1, Math.ceil(len / charsPerLine));
    }
  }
  return { totalLines, charsPerLine };
}

/**
 * Pure, synchronous, zero-DOM typography calculator for 1920x1080p sanctuary legibility.
 * Guarantees crisp, large text on Projector, Network Viewer, Live Preview, and Workspace Cards
 * without ResizeObserver state flashes during slide transitions.
 */
export function computeSlideTypography({
  lines = [],
  mediaType = 'song',
  fontName = 'Inter',
  textScale = 1,
  linesPerSlide = 0,
  hasSubText = false,
  hasCcliFooter = false,
  isCompact = false
}) {
  const safeLines = Array.isArray(lines) && lines.length > 0 ? lines : [''];
  const scale = Math.min(1.3, Math.max(0.8, Number(textScale) || 1));
  const fontWidthFactor = getFontWidthFactor(fontName);
  const avgCharEm = 0.505 * fontWidthFactor;
  const lineLengths = safeLines.map((l) => getCleanCharLength(l, mediaType));
  const totalChars = lineLengths.reduce((acc, n) => acc + n, 0);
  const maxLineChars = Math.max(1, ...lineLengths);
  const explicitLineCount = safeLines.length;
  const targetLines = Number(linesPerSlide) > 0 ? Number(linesPerSlide) : explicitLineCount;
  const effectiveLineTier = Math.max(explicitLineCount, targetLines);

  // ── 1. BIBLE TYPOGRAPHY (Heroic single-verse scaling + safe reference clearance) ──
  if (mediaType === 'bible') {
    const usableWidthCqw = 87; // px-[6.5%]
    const maxSafeHeightCqh = hasSubText ? 68 : 76;

    let baseCqh;
    if (totalChars <= 75) baseCqh = 8.6;
    else if (totalChars <= 130) baseCqh = 7.9;
    else if (totalChars <= 185) baseCqh = 7.3;
    else if (totalChars <= 250) baseCqh = 6.6;
    else if (totalChars <= 330) baseCqh = 5.9;
    else baseCqh = 5.3;

    let cqh = Math.min(10.8, baseCqh * scale);
    const lineHeight = totalChars > 240 ? 1.28 : 1.32;

    while (cqh > 3.4) {
      const { totalLines } = estimateVisualLines(lineLengths, cqh, usableWidthCqw, fontWidthFactor);
      const interVerseGapCqh = Math.max(0, explicitLineCount - 1) * (cqh * 0.28);
      const renderedHeight = totalLines * cqh * lineHeight + interVerseGapCqh;
      if (renderedHeight <= maxSafeHeightCqh) break;
      cqh -= 0.15;
    }

    const paddingClass = isCompact
      ? 'p-3'
      : hasSubText
      ? 'px-[6.5%] pt-[5.5%] pb-[13%]'
      : 'px-[6.5%] py-[7%]';

    return {
      cqh,
      fontSize: toContainerFluidFont(cqh),
      lineHeight,
      paddingClass,
      subTextFontSize: toContainerFluidFont(Math.min(3.4, 2.85 * Math.sqrt(scale))),
      ccliFontSize: toContainerFluidFont(1.9)
    };
  }

  // ── 2. LITURGY TYPOGRAPHY (Scales progressively with 1, 2, 3, 4+ lines + overflow guard) ──
  if (mediaType === 'liturgy') {
    const usableWidthCqw = 88; // px-[6%]
    const usableWidthInCqh = usableWidthCqw * (16 / 9);
    const maxSafeHeightCqh = 78; // py-[6%] -> 88cqh inner height

    let baseCqh;
    if (effectiveLineTier <= 1) baseCqh = 11.0;
    else if (effectiveLineTier === 2) baseCqh = 9.8;
    else if (effectiveLineTier === 3) baseCqh = 8.5;
    else if (effectiveLineTier === 4) baseCqh = 7.4;
    else if (effectiveLineTier <= 6) baseCqh = 6.4;
    else baseCqh = 5.6;

    let cqh = Math.min(12.6, baseCqh * scale);

    // Gentle nudge (at most 9%) only if a line is within a word of fitting on a single unbroken line;
    // longer lines keep their full size and wrap cleanly via CSS text-balance.
    const singleLineCqh = usableWidthInCqh / (maxLineChars * avgCharEm);
    if (singleLineCqh < cqh && singleLineCqh >= cqh * 0.91) {
      cqh = singleLineCqh;
    }

    const lineHeight = effectiveLineTier >= 4 || totalChars > 240 ? 1.24 : 1.26;

    while (cqh > 3.2) {
      const { totalLines } = estimateVisualLines(lineLengths, cqh, usableWidthCqw, fontWidthFactor);
      const lineGapCqh = Math.max(0, explicitLineCount - 1) * (cqh * 0.16);
      const renderedHeight = totalLines * cqh * lineHeight + lineGapCqh;
      if (renderedHeight <= maxSafeHeightCqh) break;
      cqh -= 0.15;
    }

    return {
      cqh,
      fontSize: toContainerFluidFont(cqh),
      lineHeight,
      paddingClass: isCompact ? 'p-3' : 'px-[6%] py-[6%]',
      subTextFontSize: toContainerFluidFont(2.6),
      ccliFontSize: toContainerFluidFont(1.9)
    };
  }

  // ── 3. SONG / LYRICS TYPOGRAPHY (Bold 1/2/3/4-line progression + sanctuary visibility) ──
  const usableWidthCqw = 89; // px-[5.5%]
  const usableWidthInCqh = usableWidthCqw * (16 / 9);
  const maxSafeHeightCqh = hasCcliFooter ? 73 : 78;

  let baseCqh;
  if (effectiveLineTier <= 1) baseCqh = 11.4;
  else if (effectiveLineTier === 2) baseCqh = 10.2;
  else if (effectiveLineTier === 3) baseCqh = 8.7;
  else if (effectiveLineTier === 4) baseCqh = 7.5;
  else baseCqh = 6.5;

  let cqh = Math.min(13.0, baseCqh * scale);

  // Gentle anti-orphan nudge (at most 9%): keeps ~31-35 char lyrics on one crisp line without
  // shrinking longer 40-55 char lyrics (which stay big and balance-wrap across 2 visual lines).
  const singleLineCqh = usableWidthInCqh / (maxLineChars * avgCharEm);
  if (singleLineCqh < cqh && singleLineCqh >= cqh * 0.91) {
    cqh = singleLineCqh;
  }

  const lineHeight = effectiveLineTier >= 4 ? 1.23 : 1.25;

  while (cqh > 3.5) {
    const { totalLines } = estimateVisualLines(lineLengths, cqh, usableWidthCqw, fontWidthFactor);
    const lineGapCqh = Math.max(0, explicitLineCount - 1) * (cqh * 0.14);
    const renderedHeight = totalLines * cqh * lineHeight + lineGapCqh;
    if (renderedHeight <= maxSafeHeightCqh) break;
    cqh -= 0.15;
  }

  const paddingClass = isCompact
    ? 'p-3'
    : hasCcliFooter
    ? 'px-[5.5%] pt-[5%] pb-[10%]'
    : 'px-[5.5%] py-[6%]';

  return {
    cqh,
    fontSize: toContainerFluidFont(cqh),
    lineHeight,
    paddingClass,
    subTextFontSize: toContainerFluidFont(2.7),
    ccliFontSize: toContainerFluidFont(1.9)
  };
}

/**
 * Splits a Bible text string into structured tokens so [16] verse markers
 * can be rendered as clean, readable superscripts instead of raw brackets.
 */
export function tokenizeBibleLine(line) {
  const str = String(line || '');
  const regex = /\[(\d+[a-z]?(?:-\d+[a-z]?)?(?:,\d+[a-z]?)?)\]\s*/gi;
  const tokens = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: 'text', value: str.slice(lastIdx, match.index) });
    }
    tokens.push({ type: 'verse', value: match[1] });
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < str.length) {
    tokens.push({ type: 'text', value: str.slice(lastIdx) });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: str }];
}

/**
 * Parses safe inline formatting (**bold**, *italic*, <u>underline</u>, # Heading)
 * for Liturgy slides without dangerouslySetInnerHTML.
 */
export function parseLiturgyLineFormatting(line) {
  const raw = String(line || '');
  let headingLevel = 0;
  let content = raw;

  const headingMatch = raw.match(/^(#{1,2})\s+(.*)$/);
  if (headingMatch) {
    headingLevel = headingMatch[1].length;
    content = headingMatch[2];
  }

  const tokens = [];
  const inlineRegex = /(\*\*(.+?)\*\*|<u>(.+?)<\/u>|\*(.+?)\*)/gi;
  let lastIdx = 0;
  let match;

  while ((match = inlineRegex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: 'text', value: content.slice(lastIdx, match.index) });
    }
    if (match[2] !== undefined) {
      tokens.push({ type: 'bold', value: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'underline', value: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'italic', value: match[4] });
    }
    lastIdx = inlineRegex.lastIndex;
  }

  if (lastIdx < content.length) {
    tokens.push({ type: 'text', value: content.slice(lastIdx) });
  }

  return {
    headingLevel,
    tokens: tokens.length > 0 ? tokens : [{ type: 'text', value: content }]
  };
}
