/**
 * Stack-based RTF (Rich Text Format) to Plain Text converter.
 * Used by ProPresenter 4–7, EasyWorship 6–7, MediaShout, and raw .rtf song imports.
 */

const CHARSET_TO_ENCODING = {
  128: 'shift_jis',
  129: 'windows-949',
  134: 'gbk',
  136: 'big5',
  161: 'windows-1253',
  162: 'windows-1254',
  177: 'windows-1255',
  178: 'windows-1256',
  186: 'windows-1257',
  204: 'windows-1251',
  238: 'windows-1250'
};

const IGNORED_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'footer',
  'headerl',
  'headerr',
  'footerl',
  'footerr',
  'footnote',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'mmathPr',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore'
]);

function detectRtfEncoding(rtf) {
  const cpgMatch = rtf.match(/\\ansicpg(\d+)/);
  if (cpgMatch) {
    const cpg = parseInt(cpgMatch[1], 10);
    if (cpg === 65001) return 'utf-8';
    if (cpg === 932) return 'shift_jis';
    if (cpg === 936 || cpg === 54936) return 'gbk';
    if (cpg === 949) return 'windows-949';
    if (cpg === 950) return 'big5';
    if (cpg >= 1250 && cpg <= 1258) return `windows-${cpg}`;
  }

  const charsetMatch = rtf.match(/\\fcharset(\d+)/);
  if (charsetMatch) {
    const enc = CHARSET_TO_ENCODING[parseInt(charsetMatch[1], 10)];
    if (enc) return enc;
  }

  if (rtf.includes('\\mac')) return 'macintosh';
  return 'windows-1252';
}

function createTextDecoder(encoding) {
  try {
    return new TextDecoder(encoding);
  } catch {
    return new TextDecoder('utf-8');
  }
}

/**
 * Decodes Base64 string into either UTF-8 text or raw RTF string.
 */
export function decodeBase64ToTextOrRtf(b64) {
  if (!b64 || typeof b64 !== 'string') return '';
  const cleaned = b64.replace(/\s+/g, '');
  try {
    const binStr = atob(cleaned);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytesToRtfOrUtf8(bytes);
  } catch {
    return b64;
  }
}

/**
 * Converts a Uint8Array (e.g. from ProPresenter 7 protobuf rtf_data) into plain text.
 */
export function bytesToRtfOrUtf8(bytes) {
  if (!bytes || bytes.length === 0) return '';
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // Check if it starts with "{\rtf" in ASCII
  if (u8[0] === 0x7b && u8[1] === 0x5c && u8[2] === 0x72 && u8[3] === 0x74 && u8[4] === 0x66) {
    // Decode ASCII/Latin1 container so RTF hex escapes remain intact for codepage decoding
    let rawRtf = '';
    const chunkSize = 8192;
    for (let i = 0; i < u8.length; i += chunkSize) {
      rawRtf += String.fromCharCode(...u8.subarray(i, i + chunkSize));
    }
    return rtfToPlainText(rawRtf);
  }

  const text = new TextDecoder('utf-8', { fatal: false }).decode(u8);
  if (text.trimStart().startsWith('{\\rtf')) {
    return rtfToPlainText(text);
  }
  return text;
}

/**
 * Full stack-based RTF parser that cleanly extracts plain text and line breaks
 * without leaking font tables, stylesheets, or formatting metadata.
 */
export function rtfToPlainText(rtf) {
  if (!rtf || typeof rtf !== 'string') return '';
  if (!rtf.trimStart().startsWith('{\\rtf') && !rtf.includes('\\par') && !rtf.includes('\\f0')) {
    return rtf;
  }

  const encoding = detectRtfEncoding(rtf);
  const decoder = createTextDecoder(encoding);

  const stack = [];
  let ucSkip = 1;
  let ignorable = false;
  let out = '';

  const len = rtf.length;
  let i = 0;

  while (i < len) {
    const ch = rtf[i];

    if (ch === '{') {
      stack.push({ ucSkip, ignorable });
      i++;
      // Check for {\* ignorable destination marker
      if (rtf[i] === '\\' && rtf[i + 1] === '*') {
        ignorable = true;
        i += 2;
      }
      continue;
    }

    if (ch === '}') {
      const prev = stack.pop();
      if (prev) {
        ucSkip = prev.ucSkip;
        ignorable = prev.ignorable;
      }
      i++;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      // Raw CR/LF in RTF source are formatting whitespace, not output newlines
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= len) break;
      const next = rtf[i];

      // Escaped literal characters
      if (next === '\\' || next === '{' || next === '}') {
        if (!ignorable) out += next;
        i++;
        continue;
      }
      if (next === '~') {
        if (!ignorable) out += ' ';
        i++;
        continue;
      }
      if (next === '_') {
        if (!ignorable) out += '-';
        i++;
        continue;
      }
      if (next === '\n' || next === '\r') {
        // Escaped newline in RTF acts as \par
        if (!ignorable) out += '\n';
        if (next === '\r' && rtf[i + 1] === '\n') i++;
        i++;
        continue;
      }

      // Hex byte sequence \'xx (coalesce consecutive \'xx for multi-byte UTF-8 / CJK)
      if (next === "'") {
        const bytes = [];
        let cursor = i - 1; // points at '\'
        while (cursor < len && rtf[cursor] === '\\' && rtf[cursor + 1] === "'") {
          const hex = rtf.slice(cursor + 2, cursor + 4);
          if (/^[0-9a-fA-F]{2}$/.test(hex)) {
            bytes.push(parseInt(hex, 16));
            cursor += 4;
          } else {
            break;
          }
        }
        if (bytes.length > 0) {
          if (!ignorable) {
            out += decoder.decode(new Uint8Array(bytes));
          }
          i = cursor;
          continue;
        }
      }

      // Control symbol (non-alpha)
      if (!/[a-zA-Z]/.test(next)) {
        i++;
        continue;
      }

      // Control word: \word[-digits][optional space]
      let wordStart = i;
      while (i < len && /[a-zA-Z]/.test(rtf[i])) i++;
      const word = rtf.slice(wordStart, i);

      let paramStr = '';
      if (i < len && (rtf[i] === '-' || /[0-9]/.test(rtf[i]))) {
        const pStart = i;
        if (rtf[i] === '-') i++;
        while (i < len && /[0-9]/.test(rtf[i])) i++;
        paramStr = rtf.slice(pStart, i);
      }

      // Single space after control word is consumed as delimiter
      if (i < len && rtf[i] === ' ') {
        i++;
      }

      if (IGNORED_DESTINATIONS.has(word)) {
        ignorable = true;
        continue;
      }

      if (ignorable) continue;

      if (word === 'uc' && paramStr !== '') {
        ucSkip = Math.max(0, parseInt(paramStr, 10));
      } else if (word === 'u' && paramStr !== '') {
        let code = parseInt(paramStr, 10);
        if (code < 0) code += 65536;
        out += String.fromCodePoint(code);

        // Skip ucSkip replacement characters (which could be single chars or \'xx escapes)
        let skipped = 0;
        while (skipped < ucSkip && i < len && rtf[i] !== '{' && rtf[i] !== '}') {
          if (rtf[i] === '\\' && rtf[i + 1] === "'" && /^[0-9a-fA-F]{2}$/.test(rtf.slice(i + 2, i + 4))) {
            i += 4;
          } else {
            i++;
          }
          skipped++;
        }
      } else if (word === 'par' || word === 'line' || word === 'row') {
        out += '\n';
      } else if (word === 'tab') {
        out += ' ';
      } else if (word === 'emdash') {
        out += '—';
      } else if (word === 'endash') {
        out += '–';
      } else if (word === 'lquote') {
        out += '‘';
      } else if (word === 'rquote') {
        out += '’';
      } else if (word === 'ldblquote') {
        out += '“';
      } else if (word === 'rdblquote') {
        out += '”';
      } else if (word === 'bullet') {
        out += '•';
      } else if (word === 'sdslidemarker') {
        out += '\n__EW_SLIDE_BREAK__\n';
      }

      continue;
    }

    if (!ignorable) {
      out += ch;
    }
    i++;
  }

  return out
    .split('\0')
    .join('')
    .replace(/f\d*fntnamaut\s*/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

/**
 * Splits EasyWorship RTF words into distinct slide blocks based on `sdslidemarker`
 * and section header lines.
 */
export function parseEasyWorshipRtfSlides(rawWords) {
  if (!rawWords) return [];
  const plain = rtfToPlainText(rawWords);
  if (!plain) return [];

  const rawBlocks = plain
    .split(/__EW_SLIDE_BREAK__|\n{2,}/)
    .map(b =>
      b
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
    )
    .filter(lines => lines.length > 0);

  return rawBlocks;
}
