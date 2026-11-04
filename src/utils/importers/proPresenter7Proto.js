/**
 * Zero-dependency Google Protocol Buffers binary decoder for ProPresenter 7 (.pro) files.
 * Follows the exact `rv.data.Presentation` wire schema (ProPresenter 7.0 through 7.19+).
 */

import { bytesToRtfOrUtf8, decodeBase64ToTextOrRtf, rtfToPlainText } from './rtfParser.js';
import { cleanLyricLines, normalizeSectionName } from './sectionNormalizer.js';

const utf8Decoder = new TextDecoder('utf-8', { fatal: false });

class ProtoReader {
  constructor(bytes, start = 0, end = bytes.length) {
    this.buf = bytes;
    this.pos = start;
    this.end = end;
  }

  hasMore() {
    return this.pos < this.end;
  }

  readVarint() {
    let result = 0n;
    let shift = 0n;
    while (this.pos < this.end) {
      const b = this.buf[this.pos++];
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        return result;
      }
      shift += 7n;
      if (shift > 70n) throw new Error('Malformed protobuf varint');
    }
    throw new Error('Unexpected EOF reading protobuf varint');
  }

  readTag() {
    if (this.pos >= this.end) return null;
    const tagVal = Number(this.readVarint());
    if (tagVal === 0) return null;
    return {
      fieldNumber: tagVal >>> 3,
      wireType: tagVal & 0x07
    };
  }

  readBytesRange() {
    const len = Number(this.readVarint());
    if (len < 0 || this.pos + len > this.end) {
      throw new Error('Protobuf length-delimited field exceeds buffer');
    }
    const start = this.pos;
    this.pos += len;
    return { start, end: this.pos };
  }

  readBytes() {
    const { start, end } = this.readBytesRange();
    return this.buf.subarray(start, end);
  }

  readString() {
    const sub = this.readBytes();
    return utf8Decoder.decode(sub);
  }

  readSubReader() {
    const { start, end } = this.readBytesRange();
    return new ProtoReader(this.buf, start, end);
  }

  skip(wireType) {
    switch (wireType) {
      case 0: // Varint
        this.readVarint();
        break;
      case 1: // 64-bit
        if (this.pos + 8 > this.end) throw new Error('Unexpected EOF skipping 64-bit');
        this.pos += 8;
        break;
      case 2: // Length-delimited
        this.readBytesRange();
        break;
      case 5: // 32-bit
        if (this.pos + 4 > this.end) throw new Error('Unexpected EOF skipping 32-bit');
        this.pos += 4;
        break;
      default:
        throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }
  }
}

function decodeUuid(reader) {
  let uuidStr = '';
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) {
      uuidStr = reader.readString();
    } else {
      reader.skip(tag.wireType);
    }
  }
  return uuidStr;
}

function decodeCcli(reader) {
  const ccli = {
    author: '',
    artistCredits: '',
    songTitle: '',
    publisher: '',
    copyrightYear: 0,
    songNumber: 0
  };
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) ccli.author = reader.readString();
    else if (tag.fieldNumber === 2 && tag.wireType === 2) ccli.artistCredits = reader.readString();
    else if (tag.fieldNumber === 3 && tag.wireType === 2) ccli.songTitle = reader.readString();
    else if (tag.fieldNumber === 4 && tag.wireType === 2) ccli.publisher = reader.readString();
    else if (tag.fieldNumber === 5 && tag.wireType === 0) ccli.copyrightYear = Number(reader.readVarint());
    else if (tag.fieldNumber === 6 && tag.wireType === 0) ccli.songNumber = Number(reader.readVarint());
    else reader.skip(tag.wireType);
  }
  return ccli;
}

function decodeArrangement(reader) {
  const arr = { uuid: '', name: '', groupIds: [] };
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) arr.uuid = decodeUuid(reader.readSubReader());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) arr.name = reader.readString();
    else if (tag.fieldNumber === 3 && tag.wireType === 2) {
      const id = decodeUuid(reader.readSubReader());
      if (id) arr.groupIds.push(id);
    } else {
      reader.skip(tag.wireType);
    }
  }
  return arr;
}

function decodeGroup(reader) {
  const grp = { uuid: '', name: '', appGroupName: '' };
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) grp.uuid = decodeUuid(reader.readSubReader());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) grp.name = reader.readString();
    else if (tag.fieldNumber === 6 && tag.wireType === 2) grp.appGroupName = reader.readString();
    else reader.skip(tag.wireType);
  }
  return grp;
}

function decodeCueGroup(reader) {
  const cg = { group: { uuid: '', name: '', appGroupName: '' }, cueIds: [] };
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) cg.group = decodeGroup(reader.readSubReader());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) {
      const id = decodeUuid(reader.readSubReader());
      if (id) cg.cueIds.push(id);
    } else {
      reader.skip(tag.wireType);
    }
  }
  return cg;
}

function decodeGraphicsText(reader) {
  let rtfBytes = null;
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 5 && tag.wireType === 2) {
      rtfBytes = reader.readBytes();
    } else {
      reader.skip(tag.wireType);
    }
  }
  return rtfBytes;
}

function decodeGraphicsElement(reader) {
  const el = { name: '', hidden: false, rtfBytes: null };
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 2 && tag.wireType === 2) el.name = reader.readString();
    else if (tag.fieldNumber === 13 && tag.wireType === 2) el.rtfBytes = decodeGraphicsText(reader.readSubReader());
    else if (tag.fieldNumber === 16 && tag.wireType === 0) el.hidden = reader.readVarint() !== 0n;
    else reader.skip(tag.wireType);
  }
  return el;
}

function hasNonLyricDataLink(reader) {
  // DataLink field 14 = ccli_text, 3 = timer_text, 4 = clock_text, 15 = group_name
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if ([3, 4, 14, 15, 22].includes(tag.fieldNumber)) {
      return true;
    }
    reader.skip(tag.wireType);
  }
  return false;
}

function decodeSlideElement(reader) {
  let graphicsEl = null;
  let isSystemLinked = false;
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) {
      graphicsEl = decodeGraphicsElement(reader.readSubReader());
    } else if (tag.fieldNumber === 6 && tag.wireType === 2) {
      if (hasNonLyricDataLink(reader.readSubReader())) {
        isSystemLinked = true;
      }
    } else {
      reader.skip(tag.wireType);
    }
  }
  if (!graphicsEl || graphicsEl.hidden || isSystemLinked || !graphicsEl.rtfBytes) {
    return null;
  }
  return bytesToRtfOrUtf8(graphicsEl.rtfBytes);
}

function decodeBaseSlide(reader) {
  const texts = [];
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) {
      const txt = decodeSlideElement(reader.readSubReader());
      if (txt && txt.trim()) texts.push(txt.trim());
    } else {
      reader.skip(tag.wireType);
    }
  }
  return texts;
}

function decodePresentationSlide(reader) {
  let texts = [];
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) {
      texts = decodeBaseSlide(reader.readSubReader());
    } else {
      reader.skip(tag.wireType);
    }
  }
  return texts;
}

function decodeActionSlideType(reader) {
  let texts = [];
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 2 && tag.wireType === 2) {
      texts = decodePresentationSlide(reader.readSubReader());
    } else {
      reader.skip(tag.wireType);
    }
  }
  return texts;
}

function decodeAction(reader) {
  let slideTexts = null;
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 23 && tag.wireType === 2) {
      slideTexts = decodeActionSlideType(reader.readSubReader());
    } else {
      reader.skip(tag.wireType);
    }
  }
  return slideTexts;
}

function decodeCue(reader) {
  const cue = { uuid: '', name: '', texts: [] };
  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;
    if (tag.fieldNumber === 1 && tag.wireType === 2) cue.uuid = decodeUuid(reader.readSubReader());
    else if (tag.fieldNumber === 2 && tag.wireType === 2) cue.name = reader.readString();
    else if (tag.fieldNumber === 10 && tag.wireType === 2) {
      const actionTexts = decodeAction(reader.readSubReader());
      if (actionTexts && actionTexts.length > 0) {
        cue.texts.push(...actionTexts);
      }
    } else {
      reader.skip(tag.wireType);
    }
  }
  return cue;
}

/**
 * Parses a JSON-formatted ProPresenter 7 object if encountered.
 */
function parseProPresenter7Json(obj, fallbackTitle, options) {
  const ccli = obj.ccli || {};
  const title = ccli.songTitle || ccli.song_title || (obj.name !== 'Untitled' ? obj.name : '') || fallbackTitle;
  const artist = ccli.author || ccli.artistCredits || ccli.artist_credits || '';
  const ccliNum = ccli.songNumber || ccli.song_number ? String(ccli.songNumber || ccli.song_number) : '';
  const year = ccli.copyrightYear || ccli.copyright_year || '';
  const publisher = ccli.publisher || '';
  const copyright = [year ? `© ${year}` : '', publisher].filter(Boolean).join(' ').trim();

  const cueMap = new Map();
  (obj.cues || []).forEach(cue => {
    const id = cue.uuid?.string || cue.uuid || '';
    const texts = [];
    (cue.actions || []).forEach(act => {
      const elements = act.slide?.presentation?.baseSlide?.elements || act.slide?.presentation?.base_slide?.elements || [];
      elements.forEach(el => {
        const rtfB64 = el.element?.text?.rtfData || el.element?.text?.rtf_data;
        if (rtfB64) {
          const decoded = rtfToPlainText(decodeBase64ToTextOrRtf(rtfB64));
          if (decoded.trim()) texts.push(decoded.trim());
        }
      });
    });
    if (id) cueMap.set(id, { name: cue.name || '', texts });
  });

  const sections = [];
  const groupIdToSectionName = new Map();

  (obj.cueGroups || obj.cue_groups || []).forEach((cg, idx) => {
    const grpId = cg.group?.uuid?.string || cg.group?.uuid || '';
    const rawGroupName = cg.group?.name || cg.group?.applicationGroupName || '';
    const secName = normalizeSectionName(rawGroupName, idx + 1);
    const cueIds = (cg.cueIdentifiers || cg.cue_identifiers || []).map(u => u?.string || u).filter(Boolean);
    const lines = [];
    cueIds.forEach(cid => {
      const cue = cueMap.get(cid);
      if (cue) {
        lines.push(...cleanLyricLines(cue.texts.join('\n'), options));
      }
    });
    if (lines.length > 0) {
      sections.push({ name: secName, lines });
      if (grpId) groupIdToSectionName.set(grpId, secName);
    }
  });

  if (sections.length === 0 && cueMap.size > 0) {
    const allLines = [];
    cueMap.forEach(cue => {
      allLines.push(...cleanLyricLines(cue.texts.join('\n'), options));
    });
    if (allLines.length > 0) {
      sections.push({ name: 'Verse 1', lines: allLines });
    }
  }

  if (sections.length === 0) return [];

  let arrangement = null;
  const arrangements = obj.arrangements || [];
  const selectedArrId = obj.selectedArrangement?.string || obj.selected_arrangement?.string || '';
  const activeArr = arrangements.find(a => (a.uuid?.string || a.uuid) === selectedArrId) || arrangements[0];
  if (activeArr) {
    const grpIds = (activeArr.groupIdentifiers || activeArr.group_identifiers || []).map(u => u?.string || u);
    const mapped = grpIds.map(gid => groupIdToSectionName.get(gid)).filter(Boolean);
    if (mapped.length > 0) arrangement = mapped;
  }

  return [{
    title: title || fallbackTitle,
    artist,
    ccli: ccliNum && ccliNum !== '0' ? ccliNum : '',
    copyright,
    arrangement,
    sections,
    sourceFormat: 'ProPresenter 7'
  }];
}

/**
 * Decodes a ProPresenter 7 `.pro` binary (or JSON) Uint8Array into Presenter song object(s).
 */
export function parseProPresenter7Bytes(bytes, filename = 'Song.pro', options = { stripChords: true }) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length === 0) return [];

  const fallbackTitle = filename.replace(/\.[^.]+$/, '');

  // Check if JSON-encoded .pro variant
  let firstNonWs = 0;
  while (firstNonWs < u8.length && (u8[firstNonWs] === 0x20 || u8[firstNonWs] === 0x09 || u8[firstNonWs] === 0x0a || u8[firstNonWs] === 0x0d)) {
    firstNonWs++;
  }
  if (u8[firstNonWs] === 0x7b || u8[firstNonWs] === 0x5b) {
    try {
      const jsonText = utf8Decoder.decode(u8);
      const parsed = JSON.parse(jsonText);
      return parseProPresenter7Json(parsed, fallbackTitle, options);
    } catch {
      // Not JSON — proceed with binary protobuf decoding
    }
  }

  const reader = new ProtoReader(u8);
  let docName = '';
  let selectedArrangementId = '';
  const arrangements = [];
  const cueGroups = [];
  const cues = [];
  let ccli = null;

  while (reader.hasMore()) {
    const tag = reader.readTag();
    if (!tag) break;

    switch (tag.fieldNumber) {
      case 3:
        if (tag.wireType === 2) docName = reader.readString();
        else reader.skip(tag.wireType);
        break;
      case 10:
        if (tag.wireType === 2) selectedArrangementId = decodeUuid(reader.readSubReader());
        else reader.skip(tag.wireType);
        break;
      case 11:
        if (tag.wireType === 2) arrangements.push(decodeArrangement(reader.readSubReader()));
        else reader.skip(tag.wireType);
        break;
      case 12:
        if (tag.wireType === 2) cueGroups.push(decodeCueGroup(reader.readSubReader()));
        else reader.skip(tag.wireType);
        break;
      case 13:
        if (tag.wireType === 2) cues.push(decodeCue(reader.readSubReader()));
        else reader.skip(tag.wireType);
        break;
      case 14:
        if (tag.wireType === 2) ccli = decodeCcli(reader.readSubReader());
        else reader.skip(tag.wireType);
        break;
      default:
        reader.skip(tag.wireType);
        break;
    }
  }

  const cueMap = new Map();
  cues.forEach(c => {
    if (c.uuid) cueMap.set(c.uuid, c);
  });

  const sections = [];
  const groupIdToSectionName = new Map();
  const usedCueIds = new Set();

  cueGroups.forEach((cg, idx) => {
    const rawGroupName = cg.group.name || cg.group.appGroupName || '';
    const secName = normalizeSectionName(rawGroupName, idx + 1);
    const lines = [];

    cg.cueIds.forEach(cid => {
      usedCueIds.add(cid);
      const cue = cueMap.get(cid);
      if (cue && cue.texts.length > 0) {
        lines.push(...cleanLyricLines(cue.texts.join('\n'), options));
      }
    });

    if (lines.length > 0) {
      sections.push({ name: secName, lines });
      if (cg.group.uuid) {
        groupIdToSectionName.set(cg.group.uuid, secName);
      }
    }
  });

  // Fallback if cues weren't grouped inside cue_groups
  if (sections.length === 0 && cues.length > 0) {
    cues.forEach((cue, idx) => {
      if (cue.texts.length > 0) {
        const cleaned = cleanLyricLines(cue.texts.join('\n'), options);
        if (cleaned.length > 0) {
          const secName = cue.name ? normalizeSectionName(cue.name, idx + 1) : `Verse ${sections.length + 1}`;
          sections.push({ name: secName, lines: cleaned });
        }
      }
    });
  }

  if (sections.length === 0) {
    return [];
  }

  let arrangement = null;
  if (arrangements.length > 0) {
    const activeArr =
      (selectedArrangementId && arrangements.find(a => a.uuid === selectedArrangementId)) ||
      arrangements[0];
    if (activeArr && activeArr.groupIds.length > 0) {
      const mapped = activeArr.groupIds.map(gid => groupIdToSectionName.get(gid)).filter(Boolean);
      if (mapped.length > 0) {
        arrangement = mapped;
      }
    }
  }

  const title =
    (ccli?.songTitle && ccli.songTitle.trim()) ||
    (docName && docName !== 'Untitled' ? docName.trim() : '') ||
    fallbackTitle;

  const artist = (ccli?.author || ccli?.artistCredits || '').trim();
  const ccliNum = ccli?.songNumber ? String(ccli.songNumber) : '';
  const copyrightParts = [];
  if (ccli?.copyrightYear && ccli.copyrightYear > 0) {
    copyrightParts.push(`© ${ccli.copyrightYear}`);
  }
  if (ccli?.publisher && ccli.publisher.trim()) {
    copyrightParts.push(ccli.publisher.trim());
  }

  return [{
    title,
    artist,
    ccli: ccliNum,
    copyright: copyrightParts.join(' '),
    arrangement,
    sections,
    sourceFormat: 'ProPresenter 7'
  }];
}
