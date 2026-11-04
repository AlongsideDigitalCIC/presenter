/**
 * XML-based church presentation song parsers:
 * - OpenLyrics XML (OpenLP, FreeShow, Quelea, VideoPsalm, ZionWorx)
 * - ProPresenter 4, 5, 6 XML (.pro4, .pro5, .pro6)
 * - Quelea XML (.xml & inside .qsp packs)
 * - OpenSong XML (extensionless & .xml, including interleaved hymn verses)
 * - EasySlides / EasiSlides XML (.xml multi-song exports)
 * - MediaShout XML (.xml)
 */

import { decodeBase64ToTextOrRtf, rtfToPlainText } from './rtfParser.js';
import {
  cleanLyricLines,
  normalizeSectionName,
  resolveArrangementOrder
} from './sectionNormalizer.js';

/**
 * Strips illegal XML 1.0 control characters and UTF-8 BOM, and repairs unescaped ampersands
 * when legacy church exports contain raw '&' in titles/credits.
 */
function parseXmlSafe(rawXml) {
  if (!rawXml || typeof rawXml !== 'string') return null;

  const withoutBom = rawXml.replace(/^\uFEFF/, '');
  let cleaned = '';
  for (let i = 0; i < withoutBom.length; i++) {
    const code = withoutBom.charCodeAt(i);
    if (code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20) {
      cleaned += withoutBom[i];
    }
  }
  cleaned = cleaned.trim();

  if (!cleaned.startsWith('<')) return null;

  const parser = new DOMParser();
  let doc = parser.parseFromString(cleaned, 'text/xml');
  if (!doc.querySelector('parsererror')) {
    return doc;
  }

  // Retry after escaping stray ampersands outside CDATA sections
  const repaired = cleaned.replace(
    /<!\[CDATA\[[\s\S]*?\]\]>|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,
    match => (match === '&' ? '&amp;' : match)
  );
  doc = parser.parseFromString(repaired, 'text/xml');
  if (!doc.querySelector('parsererror')) {
    return doc;
  }

  return null;
}

function getDirectChildText(parent, localName) {
  if (!parent) return '';
  const target = localName.toLowerCase();
  for (const child of Array.from(parent.children || [])) {
    const tag = (child.localName || child.nodeName || '').toLowerCase();
    if (tag === target) {
      return (child.textContent || '').trim();
    }
  }
  return '';
}

function getAllDirectChildren(parent, localName) {
  if (!parent) return [];
  const target = localName.toLowerCase();
  return Array.from(parent.children || []).filter(
    child => (child.localName || child.nodeName || '').toLowerCase() === target
  );
}

/**
 * Recursively extracts plain text from an OpenLyrics <lines> or <verse> node,
 * converting <br/> into newline and skipping <comment> nodes.
 */
function extractOpenLyricsNodeText(node) {
  if (!node) return '';
  if (node.nodeType === 3 || node.nodeType === 4) {
    // Text or CDATA node — collapse XML indentation around newlines into single spaces
    return node.nodeValue || '';
  }
  if (node.nodeType !== 1) return '';

  const tag = (node.localName || node.nodeName || '').toLowerCase();
  if (tag === 'br') return '\n';
  if (tag === 'comment') return '';

  let acc = '';
  for (const child of Array.from(node.childNodes || [])) {
    acc += extractOpenLyricsNodeText(child);
  }
  return acc;
}

/**
 * 1. OpenLyrics XML Parser (<song xmlns="http://openlyrics.info/...">)
 */
export function parseOpenLyricsDoc(doc, fallbackTitle = 'Untitled Song', options = { stripChords: true }) {
  const root = doc.documentElement;
  const props = getAllDirectChildren(root, 'properties')[0];

  let title = '';
  let artist = '';
  let ccli = '';
  let copyright = '';
  let rawVerseOrder = '';

  if (props) {
    const titlesNode = getAllDirectChildren(props, 'titles')[0];
    if (titlesNode) {
      const titleEls = getAllDirectChildren(titlesNode, 'title');
      if (titleEls.length > 0) {
        title = (titleEls[0].textContent || '').trim();
      }
    }

    const authorsNode = getAllDirectChildren(props, 'authors')[0];
    if (authorsNode) {
      const authorEls = getAllDirectChildren(authorsNode, 'author');
      const names = [];
      for (const a of authorEls) {
        const val = (a.textContent || '').trim();
        if (val && !names.includes(val)) names.push(val);
      }
      artist = names.join(', ');
    }

    ccli = getDirectChildText(props, 'ccliNo');
    copyright = getDirectChildText(props, 'copyright');
    if (!copyright) {
      const pub = getDirectChildText(props, 'publisher');
      const rel = getDirectChildText(props, 'released');
      copyright = [rel ? `© ${rel}` : '', pub].filter(Boolean).join(' ');
    }
    rawVerseOrder = getDirectChildText(props, 'verseOrder');
  }

  const lyricsNode = getAllDirectChildren(root, 'lyrics')[0];
  const sections = [];
  const rawCodeToName = new Map();

  if (lyricsNode) {
    const verseEls = getAllDirectChildren(lyricsNode, 'verse');
    verseEls.forEach((verseEl, idx) => {
      const rawName = verseEl.getAttribute('name') || `v${idx + 1}`;
      const lang = verseEl.getAttribute('lang') || '';
      const linesEls = getAllDirectChildren(verseEl, 'lines');

      let blockText = '';
      if (linesEls.length > 0) {
        blockText = linesEls
          .map(le => extractOpenLyricsNodeText(le).trim())
          .filter(Boolean)
          .join('\n');
      } else {
        blockText = extractOpenLyricsNodeText(verseEl).trim();
      }

      // Normalize XML pretty-print whitespace on each line
      const rawLines = blockText
        .split('\n')
        .map(l => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      const cleaned = cleanLyricLines(rawLines, options);
      if (cleaned.length > 0) {
        let secName = normalizeSectionName(rawName, idx + 1);
        if (lang && rawCodeToName.has(rawName.toLowerCase())) {
          secName = `${secName} (${lang})`;
        }
        sections.push({ name: secName, lines: cleaned });
        if (!rawCodeToName.has(rawName.toLowerCase())) {
          rawCodeToName.set(rawName.toLowerCase(), secName);
        }
      }
    });
  }

  if (sections.length === 0) return [];

  let arrangement = null;
  if (rawVerseOrder) {
    const tokens = rawVerseOrder.split(/\s+/).filter(Boolean);
    const mapped = tokens.map(tok => rawCodeToName.get(tok.toLowerCase()) || normalizeSectionName(tok));
    arrangement = resolveArrangementOrder(mapped, sections.map(s => s.name));
  }

  return [{
    title: title || fallbackTitle,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat: 'OpenLyrics XML'
  }];
}

/**
 * Extracts text from a ProPresenter 4/5/6 <RVDisplaySlide> element.
 */
function extractProPresenterSlideText(slideEl, options) {
  const enabledAttr = slideEl.getAttribute('enabled');
  if (enabledAttr === '0' || enabledAttr === 'false') return [];

  const textElements = Array.from(slideEl.getElementsByTagName('RVTextElement'));
  const lines = [];

  for (const te of textElements) {
    if (te.getAttribute('fromTemplate') === 'true' || te.getAttribute('fromTemplate') === '1') {
      continue;
    }

    let decoded = '';

    // ProPresenter 6: <NSString rvXMLIvarName="PlainText"> or <NSString rvXMLIvarName="RTFData">
    const nsStrings = Array.from(te.getElementsByTagName('NSString'));
    const plainNode = nsStrings.find(n => n.getAttribute('rvXMLIvarName') === 'PlainText');
    const rtfNode = nsStrings.find(n => n.getAttribute('rvXMLIvarName') === 'RTFData');

    if (plainNode && (plainNode.textContent || '').trim()) {
      decoded = decodeBase64ToTextOrRtf(plainNode.textContent.trim());
    } else if (rtfNode && (rtfNode.textContent || '').trim()) {
      decoded = rtfToPlainText(decodeBase64ToTextOrRtf(rtfNode.textContent.trim()));
    } else if (te.getAttribute('RTFData')) {
      // ProPresenter 4 / 5 attribute
      decoded = rtfToPlainText(decodeBase64ToTextOrRtf(te.getAttribute('RTFData')));
    } else {
      const childRtf = getDirectChildText(te, 'RTFData');
      if (childRtf) {
        decoded = rtfToPlainText(decodeBase64ToTextOrRtf(childRtf));
      }
    }

    if (decoded && decoded.trim()) {
      lines.push(...cleanLyricLines(decoded, options));
    }
  }

  return lines;
}

/**
 * 2. ProPresenter 4 / 5 / 6 XML Parser (<RVPresentationDocument>)
 */
export function parseProPresenterXmlDoc(doc, fallbackTitle = 'Untitled Song', options = { stripChords: true }) {
  const root = doc.documentElement;
  const versionNum = root.getAttribute('versionNumber') || '';
  let formatLabel = 'ProPresenter XML';
  if (versionNum.startsWith('6')) formatLabel = 'ProPresenter 6';
  else if (versionNum.startsWith('5')) formatLabel = 'ProPresenter 5';
  else if (versionNum.startsWith('4')) formatLabel = 'ProPresenter 4';

  const title =
    (root.getAttribute('CCLISongTitle') || '').trim() ||
    fallbackTitle;

  const artist = (
    root.getAttribute('CCLIAuthor') ||
    root.getAttribute('CCLIArtistCredits') ||
    root.getAttribute('artist') ||
    root.getAttribute('author') ||
    ''
  ).trim();

  const ccli = (root.getAttribute('CCLISongNumber') || '').trim();
  const year = (root.getAttribute('CCLICopyrightYear') || root.getAttribute('CCLICopyrightInfo') || '').trim();
  const pub = (root.getAttribute('CCLIPublisher') || '').trim();
  const copyright = [year ? (year.startsWith('©') ? year : `© ${year}`) : '', pub]
    .filter(Boolean)
    .join(' ')
    .trim();

  const sections = [];
  const groupUuidToName = new Map();

  const groupings = Array.from(root.getElementsByTagName('RVSlideGrouping'));
  if (groupings.length > 0) {
    // ProPresenter 5 & 6
    groupings.forEach((grp, idx) => {
      const rawName = grp.getAttribute('name') || '';
      const uuid = grp.getAttribute('uuid') || '';
      const secName = normalizeSectionName(rawName, idx + 1);
      const slideEls = Array.from(grp.getElementsByTagName('RVDisplaySlide'));
      const lines = [];

      for (const slideEl of slideEls) {
        lines.push(...extractProPresenterSlideText(slideEl, options));
      }

      if (lines.length > 0) {
        sections.push({ name: secName, lines });
        if (uuid) groupUuidToName.set(uuid, secName);
      }
    });
  } else {
    // ProPresenter 4 (slides directly under <slides>, grouped by @label)
    const slideEls = Array.from(root.getElementsByTagName('RVDisplaySlide'));
    let currentSection = null;

    slideEls.forEach(slideEl => {
      const slideLines = extractProPresenterSlideText(slideEl, options);
      if (slideLines.length === 0) return;

      const label = (slideEl.getAttribute('label') || '').trim();
      if (label || !currentSection) {
        const secName = normalizeSectionName(label || `Verse ${sections.length + 1}`, sections.length + 1);
        currentSection = { name: secName, lines: [...slideLines] };
        sections.push(currentSection);
      } else {
        currentSection.lines.push(...slideLines);
      }
    });
  }

  if (sections.length === 0) return [];

  // Parse RVSongArrangement if present
  let arrangement = null;
  const selectedArrId = root.getAttribute('selectedArrangementID') || '';
  const arrEls = Array.from(root.getElementsByTagName('RVSongArrangement'));
  if (arrEls.length > 0 && groupUuidToName.size > 0) {
    const activeArrEl =
      (selectedArrId && arrEls.find(el => el.getAttribute('uuid') === selectedArrId)) ||
      arrEls[0];

    if (activeArrEl) {
      const uuidNodes = Array.from(activeArrEl.getElementsByTagName('NSString'));
      const uuids =
        uuidNodes.length > 0
          ? uuidNodes.map(n => (n.textContent || '').trim()).filter(Boolean)
          : Array.from(activeArrEl.children || [])
              .flatMap(ch => Array.from(ch.children || []))
              .map(n => (n.textContent || '').trim())
              .filter(Boolean);

      const mapped = uuids.map(id => groupUuidToName.get(id)).filter(Boolean);
      if (mapped.length > 0) {
        arrangement = mapped;
      }
    }
  }

  return [{
    title,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat: formatLabel
  }];
}

/**
 * Helper to split plain text lyrics with optional [Section] or Verse/Chorus headers into sections.
 */
export function parseSectionedPlainLyrics(rawText, options = { stripChords: true }) {
  if (!rawText || typeof rawText !== 'string') return [];

  const HEADER_LINE_REGEX =
    /^(?:\[([^\]]+)\]|((?:verse|chorus|refrain|pre[-\s]?chorus|post[-\s]?chorus|bridge|tag|coda|intro|outro|ending|interlude|instrumental|vamp|turnaround|misc|slide)(?:\s+\d+[a-z]?)?)\s*:?)$/i;

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const sections = [];
  let current = null;
  let blankRun = 0;
  let explicitHeadersFound = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      blankRun++;
      continue;
    }

    const headerMatch = trimmed.match(HEADER_LINE_REGEX);
    if (headerMatch) {
      explicitHeadersFound = true;
      const rawSecName = headerMatch[1] || headerMatch[2];
      current = {
        name: normalizeSectionName(rawSecName, sections.length + 1),
        rawLines: []
      };
      sections.push(current);
      blankRun = 0;
      continue;
    }

    // If no explicit headers are used in the song, split double-blank paragraphs into Verse 1, Verse 2...
    if (!explicitHeadersFound && blankRun >= 1 && current && current.rawLines.length > 0) {
      current = {
        name: `Verse ${sections.length + 1}`,
        rawLines: []
      };
      sections.push(current);
    } else if (!current) {
      current = {
        name: 'Verse 1',
        rawLines: []
      };
      sections.push(current);
    }

    blankRun = 0;
    current.rawLines.push(rawLine);
  }

  return sections
    .map(sec => ({
      name: sec.name,
      lines: cleanLyricLines(sec.rawLines, options)
    }))
    .filter(sec => sec.lines.length > 0);
}

/**
 * 3. Quelea XML Parser (<song> with <lyrics><section> or Quelea metadata tags)
 */
export function parseQueleaXmlDoc(doc, fallbackTitle = 'Untitled Song', options = { stripChords: true }) {
  const root = doc.documentElement;
  const title = getDirectChildText(root, 'title') || fallbackTitle;
  const artist = getDirectChildText(root, 'author');
  const ccli = getDirectChildText(root, 'ccli');
  let copyright = getDirectChildText(root, 'copyright');
  if (!copyright) {
    const year = getDirectChildText(root, 'year');
    const pub = getDirectChildText(root, 'publisher');
    copyright = [year ? `© ${year}` : '', pub].filter(Boolean).join(' ');
  }
  const rawSequence = getDirectChildText(root, 'sequence');

  const lyricsEl = getAllDirectChildren(root, 'lyrics')[0];
  const sections = [];

  if (lyricsEl) {
    const sectionEls = getAllDirectChildren(lyricsEl, 'section');
    if (sectionEls.length > 0) {
      sectionEls.forEach((secEl, idx) => {
        const rawTitle = secEl.getAttribute('title') || secEl.getAttribute('name') || '';
        const secName = normalizeSectionName(rawTitle || `Verse ${idx + 1}`, idx + 1);
        const cleaned = cleanLyricLines(secEl.textContent || '', options);
        if (cleaned.length > 0) {
          sections.push({ name: secName, lines: cleaned });
        }
      });
    } else {
      sections.push(...parseSectionedPlainLyrics(lyricsEl.textContent || '', options));
    }
  }

  if (sections.length === 0) return [];

  const arrangement = rawSequence
    ? resolveArrangementOrder(rawSequence, sections.map(s => s.name))
    : null;

  return [{
    title,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat: 'Quelea XML'
  }];
}

/**
 * 4. OpenSong XML Parser (<song> with OpenSong leading-character lyric syntax)
 */
export function parseOpenSongXmlDoc(doc, fallbackTitle = 'Untitled Song', options = { stripChords: true }) {
  const root = doc.documentElement;
  const title = getDirectChildText(root, 'title') || fallbackTitle;
  const artist = getDirectChildText(root, 'author');
  const ccli = getDirectChildText(root, 'ccli');
  const copyright = getDirectChildText(root, 'copyright');
  const presentation = getDirectChildText(root, 'presentation');
  const rawLyrics = getDirectChildText(root, 'lyrics') || '';

  const lines = rawLyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rawBlocks = [];
  let currentBlock = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Section tag: [V], [V1], [C], [B], etc.
    if (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.length <= 40) {
      const rawTag = trimmed.slice(1, -1).trim();
      currentBlock = { rawTag, lines: [] };
      rawBlocks.push(currentBlock);
      continue;
    }

    // Comment or print column/page break
    if (rawLine.startsWith(';') || trimmed.startsWith('---') || trimmed === '-!!') {
      continue;
    }

    // Chord line starts with '.'
    if (rawLine.startsWith('.')) {
      if (!options.stripChords) {
        if (!currentBlock) {
          currentBlock = { rawTag: 'V1', lines: [] };
          rawBlocks.push(currentBlock);
        }
        const chordText = rawLine.slice(1).trimEnd();
        if (chordText.trim()) currentBlock.lines.push({ type: 'chord', text: chordText });
      }
      continue;
    }

    if (!currentBlock) {
      currentBlock = { rawTag: 'V1', lines: [] };
      rawBlocks.push(currentBlock);
    }

    // Check for OpenSong interleaved hymn verse number (e.g. "1Amazing grace..." inside [V])
    const numberedMatch = rawLine.match(/^([1-9])(.*)$/);
    if (numberedMatch && /^[vV]$/.test(currentBlock.rawTag)) {
      currentBlock.lines.push({
        type: 'numbered',
        verseNum: numberedMatch[1],
        text: numberedMatch[2]
      });
    } else {
      // Standard lyric line in OpenSong begins with a single ' ' space
      const lyricBody = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine;
      currentBlock.lines.push({ type: 'lyric', text: lyricBody });
    }
  }

  const sections = [];
  const rawCodeToName = new Map();

  const cleanOpenSongText = str =>
    str
      .replace(/_/g, '') // Strip melisma chord-alignment underscores
      .split('||') // Split explicit OpenSong slide breaks
      .map(s => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

  rawBlocks.forEach((blk, idx) => {
    const hasNumbered = blk.lines.some(l => l.type === 'numbered');
    if (hasNumbered) {
      // Group interleaved numbered lines into Verse 1, Verse 2, etc.
      const byNum = new Map();
      for (const item of blk.lines) {
        if (item.type === 'numbered') {
          if (!byNum.has(item.verseNum)) byNum.set(item.verseNum, []);
          byNum.get(item.verseNum).push(...cleanOpenSongText(item.text));
        } else if (item.type === 'lyric') {
          // Shared refrain/unnumbered line appended to all verses in block
          for (const arr of byNum.values()) {
            arr.push(...cleanOpenSongText(item.text));
          }
        }
      }
      for (const [num, vLines] of byNum.entries()) {
        const cleaned = cleanLyricLines(vLines, options);
        if (cleaned.length > 0) {
          const secName = `Verse ${num}`;
          sections.push({ name: secName, lines: cleaned });
          rawCodeToName.set(`v${num}`, secName);
        }
      }
    } else {
      const expanded = [];
      for (const item of blk.lines) {
        if (item.type === 'chord') {
          expanded.push(item.text);
        } else {
          expanded.push(...cleanOpenSongText(item.text));
        }
      }
      const cleaned = cleanLyricLines(expanded, options);
      if (cleaned.length > 0) {
        const secName = normalizeSectionName(blk.rawTag, idx + 1);
        sections.push({ name: secName, lines: cleaned });
        rawCodeToName.set(blk.rawTag.toLowerCase(), secName);
      }
    }
  });

  if (sections.length === 0) return [];

  let arrangement = null;
  if (presentation) {
    const tokens = presentation.split(/[\s,;]+/).filter(Boolean);
    const mapped = tokens.map(tok => rawCodeToName.get(tok.toLowerCase()) || normalizeSectionName(tok));
    arrangement = resolveArrangementOrder(mapped, sections.map(s => s.name));
  }

  return [{
    title,
    artist,
    ccli,
    copyright,
    arrangement,
    sections,
    sourceFormat: 'OpenSong'
  }];
}

/**
 * 5. EasySlides / EasiSlides XML Parser (<Easyslides> / <EasiSlides>)
 */
export function parseEasySlidesXmlDoc(doc, options = { stripChords: true }) {
  const root = doc.documentElement;
  const items = [
    ...getAllDirectChildren(root, 'Item'),
    ...getAllDirectChildren(root, 'Song')
  ];

  const songs = [];
  for (const item of items) {
    const title =
      getDirectChildText(item, 'Title1') ||
      getDirectChildText(item, 'Title') ||
      getDirectChildText(item, 'Title2');
    const contents =
      getDirectChildText(item, 'Contents') ||
      getDirectChildText(item, 'Lyrics');

    if (!title && !contents) continue;

    const artist = getDirectChildText(item, 'Writer') || getDirectChildText(item, 'Author');
    const copyright = [
      getDirectChildText(item, 'Copyright'),
      getDirectChildText(item, 'LicenceAdmin1'),
      getDirectChildText(item, 'LicenceAdmin2')
    ]
      .filter(Boolean)
      .join(' ');

    const rawSongNum = getDirectChildText(item, 'SongNumber') || getDirectChildText(item, 'CCLI');
    const ccli = /^\d{4,8}$/.test(rawSongNum) ? rawSongNum : '';
    const rawSeq = getDirectChildText(item, 'Sequence');

    // EasySlides uses [1], [2], [c], [p], [b], [e] markers
    const convertedContents = contents.replace(/^\s*\[(\d+)\]\s*$/gm, '[Verse $1]');
    const sections = parseSectionedPlainLyrics(convertedContents, options);
    if (sections.length === 0) continue;

    const normalizedSeqTokens = rawSeq
      ? rawSeq
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map(t => (/^\d+$/.test(t) ? `Verse ${t}` : normalizeSectionName(t)))
      : null;

    const arrangement = normalizedSeqTokens
      ? resolveArrangementOrder(normalizedSeqTokens, sections.map(s => s.name))
      : null;

    songs.push({
      title: title || 'Untitled Song',
      artist,
      ccli,
      copyright,
      arrangement,
      sections,
      sourceFormat: 'EasySlides XML'
    });
  }

  return songs;
}

/**
 * 6. MediaShout XML Parser (<MediaShout5_Document> / <SongList> / <Songs>)
 */
export function parseMediaShoutXmlDoc(doc, fallbackTitle = 'Untitled Song', options = { stripChords: true }) {
  const root = doc.documentElement;
  const songs = [];

  // MediaShout song library XML (<Songs><Song> or <sc_songs><sc_song>)
  const songNodes = [
    ...Array.from(root.getElementsByTagName('Song')),
    ...Array.from(root.getElementsByTagName('sc_song'))
  ];

  if (songNodes.length > 0) {
    for (const sn of songNodes) {
      const title =
        getDirectChildText(sn, 'Title') ||
        sn.getAttribute('Title') ||
        sn.getAttribute('title') ||
        fallbackTitle;
      const artist =
        getDirectChildText(sn, 'Author') ||
        getDirectChildText(sn, 'Authors') ||
        sn.getAttribute('Author') ||
        '';
      const copyright =
        getDirectChildText(sn, 'Copyright') ||
        sn.getAttribute('Copyright') ||
        '';
      const ccli =
        getDirectChildText(sn, 'CCLI') ||
        getDirectChildText(sn, 'SongID') ||
        getDirectChildText(sn, 'SongNumber') ||
        '';

      const sections = [];
      const partNodes = [
        ...Array.from(sn.getElementsByTagName('Part')),
        ...Array.from(sn.getElementsByTagName('Verse')),
        ...Array.from(sn.getElementsByTagName('Stanza'))
      ];

      if (partNodes.length > 0) {
        partNodes.forEach((pNode, idx) => {
          const typeAttr =
            pNode.getAttribute('Type') ||
            pNode.getAttribute('Name') ||
            getDirectChildText(pNode, 'Type') ||
            '';
          const numAttr = pNode.getAttribute('Number') || getDirectChildText(pNode, 'Number') || '';
          const rawLabel = [typeAttr, numAttr].filter(Boolean).join(' ') || `Verse ${idx + 1}`;
          const rawText = getDirectChildText(pNode, 'Text') || pNode.textContent || '';
          const plain = rtfToPlainText(rawText);
          const cleaned = cleanLyricLines(plain, options);
          if (cleaned.length > 0) {
            sections.push({
              name: normalizeSectionName(rawLabel, idx + 1),
              lines: cleaned
            });
          }
        });
      }

      if (sections.length > 0) {
        songs.push({
          title,
          artist,
          ccli,
          copyright,
          arrangement: null,
          sections,
          sourceFormat: 'MediaShout XML'
        });
      }
    }
    if (songs.length > 0) return songs;
  }

  // MediaShout 5 Cue Script XML (<MediaShout5_Document><Cues><Cue>)
  const cueNodes = Array.from(root.getElementsByTagName('Cue'));
  for (const cue of cueNodes) {
    const title = getDirectChildText(cue, 'Title') || getDirectChildText(cue, 'Name');
    const pageNodes = Array.from(cue.getElementsByTagName('Page'));
    const sections = [];

    pageNodes.forEach((pg, idx) => {
      const label = pg.getAttribute('Name') || getDirectChildText(pg, 'Label') || `Verse ${idx + 1}`;
      const textEls = Array.from(pg.getElementsByTagName('Text'));
      const rawText =
        textEls.length > 0
          ? textEls.map(t => rtfToPlainText(t.textContent || '')).join('\n')
          : rtfToPlainText(pg.textContent || '');
      const cleaned = cleanLyricLines(rawText, options);
      if (cleaned.length > 0) {
        sections.push({
          name: normalizeSectionName(label, idx + 1),
          lines: cleaned
        });
      }
    });

    if (sections.length > 0) {
      songs.push({
        title: title || fallbackTitle,
        artist: getDirectChildText(cue, 'Author'),
        ccli: getDirectChildText(cue, 'CCLI'),
        copyright: getDirectChildText(cue, 'Copyright'),
        arrangement: null,
        sections,
        sourceFormat: 'MediaShout XML'
      });
    }
  }

  return songs;
}

/**
 * Auto-detects the XML schema and dispatches to the appropriate parser.
 */
export function parseXmlSongContent(xmlText, filename = 'Song.xml', options = { stripChords: true }) {
  const doc = parseXmlSafe(xmlText);
  if (!doc || !doc.documentElement) return [];

  const fallbackTitle = filename.replace(/\.[^.]+$/, '') || 'Untitled Song';
  const root = doc.documentElement;
  const rootTag = (root.localName || root.nodeName || '').toLowerCase();
  const rootNs = root.getAttribute('xmlns') || '';

  // 1. ProPresenter 4 / 5 / 6
  if (rootTag === 'rvpresentationdocument') {
    return parseProPresenterXmlDoc(doc, fallbackTitle, options);
  }

  // 2. EasySlides / EasiSlides
  if (rootTag === 'easyslides' || rootTag === 'easislides') {
    return parseEasySlidesXmlDoc(doc, options);
  }

  // 3. MediaShout
  if (rootTag.includes('mediashout') || rootTag === 'sc_songs' || rootTag === 'songlist') {
    return parseMediaShoutXmlDoc(doc, fallbackTitle, options);
  }

  // 4. <song> root — distinguish OpenLyrics vs Quelea vs OpenSong
  if (rootTag === 'song') {
    const hasProperties = getAllDirectChildren(root, 'properties').length > 0;
    if (rootNs.includes('openlyrics') || hasProperties) {
      return parseOpenLyricsDoc(doc, fallbackTitle, options);
    }

    const lyricsNode = getAllDirectChildren(root, 'lyrics')[0];
    const hasQueleaSections = lyricsNode && getAllDirectChildren(lyricsNode, 'section').length > 0;
    const hasUpdateInDb = getAllDirectChildren(root, 'updateInDB').length > 0;

    if (hasQueleaSections || hasUpdateInDb) {
      return parseQueleaXmlDoc(doc, fallbackTitle, options);
    }

    // Check if OpenSong tags or OpenSong lyric line markers exist
    const rawLyrics = lyricsNode ? lyricsNode.textContent || '' : '';
    const hasOpenSongTags =
      getAllDirectChildren(root, 'presentation').length > 0 ||
      getAllDirectChildren(root, 'aka').length > 0 ||
      getAllDirectChildren(root, 'capo').length > 0 ||
      getAllDirectChildren(root, 'hymn_number').length > 0;

    const looksLikeOpenSongLyrics =
      /(?:^|\n)\[[A-Za-z0-9\s-]+\]\s*(?:\r?\n|$)/.test(rawLyrics) &&
      /(?:^|\n)[. ;1-9]/.test(rawLyrics);

    if (hasOpenSongTags || looksLikeOpenSongLyrics) {
      return parseOpenSongXmlDoc(doc, fallbackTitle, options);
    }

    // Otherwise parse as Quelea / generic <song><title><lyrics>
    return parseQueleaXmlDoc(doc, fallbackTitle, options);
  }

  // 5. Multi-song wrapper (<songs><song>...</song></songs>)
  if (rootTag === 'songs') {
    const childSongs = getAllDirectChildren(root, 'song');
    if (childSongs.length > 0) {
      const results = [];
      const serializer = new XMLSerializer();
      childSongs.forEach((childEl, idx) => {
        const subXml = serializer.serializeToString(childEl);
        results.push(...parseXmlSongContent(subXml, `${fallbackTitle} ${idx + 1}`, options));
      });
      if (results.length > 0) return results;
    }
    return parseMediaShoutXmlDoc(doc, fallbackTitle, options);
  }

  return [];
}
