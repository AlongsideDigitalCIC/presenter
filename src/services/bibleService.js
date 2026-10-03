import { balanceLines } from '../utils/songParser';

const NETLIFY_YOUVERSION_PROXY = 'https://alongsidedigital.co.uk/.netlify/functions/youversion';

/**
 * Fetches the list of available Bible versions from YouVersion API via proxy.
 */
export async function fetchBibleVersions() {
  const res = await fetch(`${NETLIFY_YOUVERSION_PROXY}?endpoint=/bibles&language_ranges[]=eng`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!res.ok) throw new Error("Failed to fetch Bible versions");
  const data = await res.json();
  return data.data; // Array of bibles
}

/**
 * Fetches the list of books for a given Bible version.
 */
export async function fetchBibleBooks(bibleId) {
  const res = await fetch(`${NETLIFY_YOUVERSION_PROXY}?endpoint=/bibles/${bibleId}/books`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!res.ok) throw new Error("Failed to fetch Bible books");
  const data = await res.json();
  return data.data; // Array of books
}

/**
 * Fetches the list of chapters for a given Book in a Bible version.
 */
export async function fetchBibleChapters(bibleId, bookId) {
  const res = await fetch(`${NETLIFY_YOUVERSION_PROXY}?endpoint=/bibles/${bibleId}/books/${bookId}/chapters`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (!res.ok) throw new Error("Failed to fetch Bible chapters");
  const data = await res.json();
  return data.data; // Array of chapters
}

/**
 * Fetches a specific passage (chapter or verse range) from YouVersion API
 * and formats it into Presenter slide structure.
 */
export async function fetchYouVersionPassage(bibleId, passageReference) {
  const res = await fetch(`${NETLIFY_YOUVERSION_PROXY}?endpoint=/bibles/${bibleId}/passages/${passageReference}&response_type=html&format=html`, {
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error(`YouVersion API Error: ${res.status} ${res.statusText} on ${res.url}. Response:`, errorText);
    throw new Error(`Passage not found or unauthorized (${res.status})`);
  }
  const data = await res.json();
  
  return processYouVersionPassage(data, bibleId);
}

/**
 * Converts YouVersion passage payload into Presenter Slides array.
 */
export function processYouVersionPassage(passageData, bibleId) {
  if (!passageData) {
    throw new Error("YouVersion API returned an empty or invalid passage response.");
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = passageData.content || "";
  
  const labels = tempDiv.querySelectorAll('.label, .yv-vlbl');
  labels.forEach(lbl => {
      const vNum = lbl.textContent.trim();
      if (vNum) {
          lbl.textContent = `[${vNum}] `;
      }
  });
  
  const verses = tempDiv.querySelectorAll('.v, .verse, [data-usfm]');
  let extractedText = "";

  if (verses.length > 0) {
     extractedText = Array.from(verses).map(v => {
       const usfm = v.getAttribute('data-usfm') || "";
       let vNum = usfm.split('.').pop();
       
       const label = v.querySelector('.label');
       if (!vNum && label) {
         vNum = label.textContent.trim();
       }
       if (vNum && !v.querySelector('.label') && !v.querySelector('.yv-vlbl')) {
           return `[${vNum}] ${v.textContent.trim()}`;
       }
       return v.textContent.trim();
     }).join(' ');
  } else {
     extractedText = tempDiv.textContent || tempDiv.innerText || "";
  }
  
  extractedText = extractedText.replace(/\s+/g, ' ').trim();

  const slides = parseBibleText(extractedText, passageData.reference, 4);

  return {
    reference: passageData.reference,
    translation: passageData.version_abbreviation || bibleId,
    rawText: extractedText,
    slides
  };
}

export function parseBibleText(rawText, reference, linesPerSlide = 4) {
  const slides = [];
  let slideIndex = 1;

  const hasVerseMarkers = /\[\d+[a-z]?(?:-\d+[a-z]?)?(?:,\d+[a-z]?)?\]/i.test(rawText);
  let rawLines = [];
  
  if (hasVerseMarkers) {
      rawLines = rawText
        .replace(/(\s*)(?=\[\d+[a-z]?(?:-\d+[a-z]?)?(?:,\d+[a-z]?)?\])/gi, "\n")
        .split('\n')
        .map(l => l.trim())
        .filter(l => l !== '');
  } else {
      rawLines = rawText
        .replace(/([.?!;"'])\s+(?=[A-Z0-9\[])/g, "$1\n")
        .split('\n')
        .map(l => l.trim())
        .filter(l => l !== '');
  }
  let currentVerseMatch = "";

  const chunks = balanceLines(rawLines, linesPerSlide);
  chunks.forEach(chunk => {
    let firstLine = chunk[0];
    const verseMatch = firstLine.match(/^\[?(\d+[a-z]?(?:-\d+[a-z]?)?(?:,\d+[a-z]?)?)\]?/i);
    
    if (verseMatch) {
       currentVerseMatch = `[${verseMatch[1]}]`;
       chunk[0] = firstLine.replace(/^\[?(\d+[a-z]?(?:-\d+[a-z]?)?(?:,\d+[a-z]?)?)\]?\s*/i, `[${verseMatch[1]}] `);
    } else if (currentVerseMatch) {
       chunk[0] = `${currentVerseMatch} ${firstLine}`;
    }

    slides.push({
      type: reference,
      content: chunk,
      index: slideIndex++
    });
  });

  return slides;
}

export function processBibleJson(rawData) {
    if (!rawData.book || !rawData.chapters) throw new Error("Invalid Bible JSON");
    return {
        book: rawData.book,
        translation: rawData.translation || 'Local',
        chapters: rawData.chapters
    };
}

export function generateSlidesForChapter(bookData, chapterNum, linesPerSlide = 1) {
    const chapter = bookData.chapters.find(c => c.num === parseInt(chapterNum));
    if (!chapter) return [];
    const rawText = chapter.verses.map(v => `[${v.num}] ${v.text}`).join(' ');
    const reference = `${bookData.book} ${chapterNum}`;
    return parseBibleText(rawText, reference, linesPerSlide);
}

export async function fetchLocalBiblePassage(libraryHandle, folderName, reference) {
  const bibleFolder = await libraryHandle.getDirectoryHandle('Bible');
  const transFolder = await bibleFolder.getDirectoryHandle(folderName);

  const parseReference = (ref) => {
    const match = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (!match) return null;
    return { bookName: match[1], chapterNum: parseInt(match[2]), startVerse: match[3] ? parseInt(match[3]) : null, endVerse: match[4] ? parseInt(match[4]) : null };
  };

  const parsed = parseReference(reference);
  if (!parsed) throw new Error("Invalid reference format. Try: Genesis 1, Genesis 1-2, Genesis 1:5-10, or Genesis 1:13-2:10");

  const { bookName } = parsed;

  let fileHandle;
  for await (const entry of transFolder.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase() === `${bookName.toLowerCase()}.json`) {
       fileHandle = entry;
       break;
    }
  }

  if (!fileHandle) {
     throw new Error(`Book "${bookName}" not found in local library for ${folderName}`);
  }

  const fileData = await fileHandle.getFile();
  const text = await fileData.text();
  const bookData = JSON.parse(text);

  let combinedRawText = "";
  
  if (parsed.startVerse) {
      let currentChap = parsed.chapterNum;
      let startV = parsed.startVerse;
      let endV = parsed.endVerse || startV;
      
      const chapterData = bookData.chapters.find(c => c.num === currentChap);
      if (!chapterData) throw new Error(`Chapter ${currentChap} not found`);
      
      chapterData.verses.forEach(v => {
          if (v.num >= startV && v.num <= endV) {
              combinedRawText += `[${v.num}] ${v.text} `;
          }
      });
  } else {
      const chapterData = bookData.chapters.find(c => c.num === parsed.chapterNum);
      if (!chapterData) throw new Error(`Chapter ${parsed.chapterNum} not found`);
      
      chapterData.verses.forEach(v => {
          combinedRawText += `[${v.num}] ${v.text} `;
      });
  }
  
  combinedRawText = combinedRawText.replace(/\s+/g, ' ').trim();
  
  if (!combinedRawText) throw new Error("No verses found for the specified reference");

  const slides = parseBibleText(combinedRawText, reference, 4);

  return {
    reference: reference,
    translation: folderName,
    rawText: combinedRawText,
    slides
  };
}
