import { useState, useEffect, useRef, useMemo } from 'react';
import { fetchYouVersionPassage, fetchLocalBiblePassage, fetchBibleVersions } from '../services/bibleService';
import { Book, Search, Loader2, ChevronRight, ChevronLeft, X } from 'lucide-react';

// Complete Bible book data with chapter counts
const BIBLE_BOOKS = [
  // Old Testament
  { name: 'Genesis', abbr: 'Gen', usfm: 'GEN', chapters: 50, testament: 'OT' },
  { name: 'Exodus', abbr: 'Exod', usfm: 'EXO', chapters: 40, testament: 'OT' },
  { name: 'Leviticus', abbr: 'Lev', usfm: 'LEV', chapters: 27, testament: 'OT' },
  { name: 'Numbers', abbr: 'Num', usfm: 'NUM', chapters: 36, testament: 'OT' },
  { name: 'Deuteronomy', abbr: 'Deut', usfm: 'DEU', chapters: 34, testament: 'OT' },
  { name: 'Joshua', abbr: 'Josh', usfm: 'JOS', chapters: 24, testament: 'OT' },
  { name: 'Judges', abbr: 'Judg', usfm: 'JDG', chapters: 21, testament: 'OT' },
  { name: 'Ruth', abbr: 'Ruth', usfm: 'RUT', chapters: 4, testament: 'OT' },
  { name: '1 Samuel', abbr: '1Sam', usfm: '1SA', chapters: 31, testament: 'OT' },
  { name: '2 Samuel', abbr: '2Sam', usfm: '2SA', chapters: 24, testament: 'OT' },
  { name: '1 Kings', abbr: '1Kgs', usfm: '1KI', chapters: 22, testament: 'OT' },
  { name: '2 Kings', abbr: '2Kgs', usfm: '2KI', chapters: 25, testament: 'OT' },
  { name: '1 Chronicles', abbr: '1Chr', usfm: '1CH', chapters: 29, testament: 'OT' },
  { name: '2 Chronicles', abbr: '2Chr', usfm: '2CH', chapters: 36, testament: 'OT' },
  { name: 'Ezra', abbr: 'Ezra', usfm: 'EZR', chapters: 10, testament: 'OT' },
  { name: 'Nehemiah', abbr: 'Neh', usfm: 'NEH', chapters: 13, testament: 'OT' },
  { name: 'Esther', abbr: 'Esth', usfm: 'EST', chapters: 10, testament: 'OT' },
  { name: 'Job', abbr: 'Job', usfm: 'JOB', chapters: 42, testament: 'OT' },
  { name: 'Psalms', abbr: 'Ps', usfm: 'PSA', chapters: 150, testament: 'OT' },
  { name: 'Proverbs', abbr: 'Prov', usfm: 'PRO', chapters: 31, testament: 'OT' },
  { name: 'Ecclesiastes', abbr: 'Eccl', usfm: 'ECC', chapters: 12, testament: 'OT' },
  { name: 'Song of Solomon', abbr: 'Song', usfm: 'SNG', chapters: 8, testament: 'OT' },
  { name: 'Isaiah', abbr: 'Isa', usfm: 'ISA', chapters: 66, testament: 'OT' },
  { name: 'Jeremiah', abbr: 'Jer', usfm: 'JER', chapters: 52, testament: 'OT' },
  { name: 'Lamentations', abbr: 'Lam', usfm: 'LAM', chapters: 5, testament: 'OT' },
  { name: 'Ezekiel', abbr: 'Ezek', usfm: 'EZK', chapters: 48, testament: 'OT' },
  { name: 'Daniel', abbr: 'Dan', usfm: 'DAN', chapters: 12, testament: 'OT' },
  { name: 'Hosea', abbr: 'Hos', usfm: 'HOS', chapters: 14, testament: 'OT' },
  { name: 'Joel', abbr: 'Joel', usfm: 'JOL', chapters: 3, testament: 'OT' },
  { name: 'Amos', abbr: 'Amos', usfm: 'AMO', chapters: 9, testament: 'OT' },
  { name: 'Obadiah', abbr: 'Obad', usfm: 'OBA', chapters: 1, testament: 'OT' },
  { name: 'Jonah', abbr: 'Jonah', usfm: 'JON', chapters: 4, testament: 'OT' },
  { name: 'Micah', abbr: 'Mic', usfm: 'MIC', chapters: 7, testament: 'OT' },
  { name: 'Nahum', abbr: 'Nah', usfm: 'NAM', chapters: 3, testament: 'OT' },
  { name: 'Habakkuk', abbr: 'Hab', usfm: 'HAB', chapters: 3, testament: 'OT' },
  { name: 'Zephaniah', abbr: 'Zeph', usfm: 'ZEP', chapters: 3, testament: 'OT' },
  { name: 'Haggai', abbr: 'Hag', usfm: 'HAG', chapters: 2, testament: 'OT' },
  { name: 'Zechariah', abbr: 'Zech', usfm: 'ZEC', chapters: 14, testament: 'OT' },
  { name: 'Malachi', abbr: 'Mal', usfm: 'MAL', chapters: 4, testament: 'OT' },
  // New Testament
  { name: 'Matthew', abbr: 'Matt', usfm: 'MAT', chapters: 28, testament: 'NT' },
  { name: 'Mark', abbr: 'Mark', usfm: 'MRK', chapters: 16, testament: 'NT' },
  { name: 'Luke', abbr: 'Luke', usfm: 'LUK', chapters: 24, testament: 'NT' },
  { name: 'John', abbr: 'John', usfm: 'JHN', chapters: 21, testament: 'NT' },
  { name: 'Acts', abbr: 'Acts', usfm: 'ACT', chapters: 28, testament: 'NT' },
  { name: 'Romans', abbr: 'Rom', usfm: 'ROM', chapters: 16, testament: 'NT' },
  { name: '1 Corinthians', abbr: '1Cor', usfm: '1CO', chapters: 16, testament: 'NT' },
  { name: '2 Corinthians', abbr: '2Cor', usfm: '2CO', chapters: 13, testament: 'NT' },
  { name: 'Galatians', abbr: 'Gal', usfm: 'GAL', chapters: 6, testament: 'NT' },
  { name: 'Ephesians', abbr: 'Eph', usfm: 'EPH', chapters: 6, testament: 'NT' },
  { name: 'Philippians', abbr: 'Phil', usfm: 'PHP', chapters: 4, testament: 'NT' },
  { name: 'Colossians', abbr: 'Col', usfm: 'COL', chapters: 4, testament: 'NT' },
  { name: '1 Thessalonians', abbr: '1Thess', usfm: '1TH', chapters: 5, testament: 'NT' },
  { name: '2 Thessalonians', abbr: '2Thess', usfm: '2TH', chapters: 3, testament: 'NT' },
  { name: '1 Timothy', abbr: '1Tim', usfm: '1TI', chapters: 6, testament: 'NT' },
  { name: '2 Timothy', abbr: '2Tim', usfm: '2TI', chapters: 4, testament: 'NT' },
  { name: 'Titus', abbr: 'Titus', usfm: 'TIT', chapters: 3, testament: 'NT' },
  { name: 'Philemon', abbr: 'Phlm', usfm: 'PHM', chapters: 1, testament: 'NT' },
  { name: 'Hebrews', abbr: 'Heb', usfm: 'HEB', chapters: 13, testament: 'NT' },
  { name: 'James', abbr: 'Jas', usfm: 'JAS', chapters: 5, testament: 'NT' },
  { name: '1 Peter', abbr: '1Pet', usfm: '1PE', chapters: 5, testament: 'NT' },
  { name: '2 Peter', abbr: '2Pet', usfm: '2PE', chapters: 3, testament: 'NT' },
  { name: '1 John', abbr: '1John', usfm: '1JN', chapters: 5, testament: 'NT' },
  { name: '2 John', abbr: '2John', usfm: '2JN', chapters: 1, testament: 'NT' },
  { name: '3 John', abbr: '3John', usfm: '3JN', chapters: 1, testament: 'NT' },
  { name: 'Jude', abbr: 'Jude', usfm: 'JUD', chapters: 1, testament: 'NT' },
  { name: 'Revelation', abbr: 'Rev', usfm: 'REV', chapters: 22, testament: 'NT' },
];

export default function BibleModule({ libraryHandle, systemTrigger, onSelectDocument }) {
  const [reference, setReference] = useState('');
  const [translation, setTranslation] = useState(() => {
    const saved = localStorage.getItem('defaultBible');
    return (saved && saved !== '1') ? saved : '111';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localTranslations, setLocalTranslations] = useState([]);
  const [onlineTranslations, setOnlineTranslations] = useState([]);
  const [onlineError, setOnlineError] = useState(false);

  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Browser state
  const [browseBook, setBrowseBook] = useState(null); // selected book object or null
  const [showBrowser, setShowBrowser] = useState(false);
  const browserRef = useRef(null);

  // Fetch online translations from proxy
  useEffect(() => {
    setOnlineError(false);
    fetchBibleVersions()
      .then(bibles => {
        setOnlineTranslations(bibles);
        if (bibles.length > 0 && !localTranslations.includes(translation)) {
          const defaultBible = bibles.find(b => b.id === 111 || b.id === '111') || bibles[0];
          setTranslation(defaultBible.id.toString());
        }
      })
      .catch(err => {
        console.error("Failed to fetch YouVersion bibles:", err);
        setOnlineError(true);
        setOnlineTranslations([]);
      });
  }, []);

  useEffect(() => {
    const scanLocalBibles = async () => {
      if (!libraryHandle) return;
      try {
        const bibleFolder = await libraryHandle.getDirectoryHandle('Bible', { create: true });
        const list = [];
        for await (const entry of bibleFolder.values()) {
          if (entry.kind === 'directory') {
            list.push(entry.name);
          }
        }
        setLocalTranslations(list);
      } catch (err) {
        console.error("Failed to scan local bibles", err);
      }
    };
    scanLocalBibles();
  }, [libraryHandle, systemTrigger]);

  // Close suggestions and browser when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (browserRef.current && !browserRef.current.contains(e.target)) {
        setShowBrowser(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Autocomplete suggestions
  const suggestions = useMemo(() => {
    const q = reference.trim().toLowerCase();
    if (!q) return [];
    return BIBLE_BOOKS.filter(b =>
      b.name.toLowerCase().startsWith(q) ||
      b.abbr.toLowerCase().startsWith(q)
    ).slice(0, 8);
  }, [reference]);

  const parseReferenceToYouVersion = (ref) => {
    const match = ref.trim().match(/^(.+?)\s+(\d+)(?::(\d+))?(?:\s*-\s*(\d+)(?::(\d+))?)?$/);
    if (!match) return null;
    const bookStr = match[1].toLowerCase();
    const book = BIBLE_BOOKS.find(b => b.name.toLowerCase() === bookStr || b.abbr.toLowerCase() === bookStr);
    if (!book) return null;
    
    const ch = match[2];
    const vStart = match[3];
    const end1 = match[4];
    const end2 = match[5];
    
    const usfm = book.usfm;
    if (!vStart) {
      if (!end1) return `${usfm}.${ch}`; 
      return `${usfm}.${ch}-${usfm}.${end1}`; 
    }
    if (!end1) {
      return `${usfm}.${ch}.${vStart}`; 
    }
    if (!end2) {
      return `${usfm}.${ch}.${vStart}-${usfm}.${ch}.${end1}`; 
    }
    return `${usfm}.${ch}.${vStart}-${usfm}.${end1}.${end2}`; 
  };

  const handleSearch = async (refOverride) => {
    const ref = refOverride || reference.trim();
    if (!ref || !libraryHandle) return;

    setLoading(true);
    setError(null);
    setShowSuggestions(false);
    try {
      let data;
      const isLocal = localTranslations.includes(translation);
      
      if (isLocal) {
         data = await fetchLocalBiblePassage(libraryHandle, translation, ref);
      } else {
         const yvRef = parseReferenceToYouVersion(ref);
         if (!yvRef) throw new Error("Invalid reference format or unknown book.");
         data = await fetchYouVersionPassage(translation, yvRef);
         // Ensure the human readable reference matches what the user typed/intended
         data.reference = ref;
         
         const matchedVersion = onlineTranslations.find(b => b.id.toString() === translation.toString());
         if (matchedVersion) {
            data.translation = matchedVersion.abbreviation || matchedVersion.title || data.translation;
         }
      }

      if (onSelectDocument) {
         onSelectDocument({ ...data, title: data.reference, id: data.reference });
      }
    } catch (err) {
      setError(err.message || 'Passage not found or network offline.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (book) => {
    setReference(book.name + ' ');
    setShowSuggestions(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        handleSuggestionClick(suggestions[highlightIdx]);
      } else {
        handleSearch();
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleBrowseChapter = (chapter) => {
    const ref = `${browseBook.name} ${chapter}`;
    setReference(ref);
    handleSearch(ref);
    setShowBrowser(false);
  };

  const otBooks = BIBLE_BOOKS.filter(b => b.testament === 'OT');
  const ntBooks = BIBLE_BOOKS.filter(b => b.testament === 'NT');

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2 px-1">
        <Book size={14} className="text-[#3D7B8C]" />
        Bible Quick-Search
      </div>
      
      {/* Translation Picker */}
      <select 
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
        className="w-full bg-white border border-[#3D7B8C]/10 rounded-xl text-sm font-bold text-[#1C355E] px-4 py-3 focus:ring-2 focus:ring-[#3D7B8C] outline-none transition shadow-inner appearance-none cursor-pointer"
      >
        {onlineTranslations.length > 0 ? (
          <optgroup label="YouVersion">
            {onlineTranslations.map(lt => (
              <option key={lt.id} value={lt.id.toString()}>
                {lt.abbreviation} - {lt.title}
              </option>
            ))}
          </optgroup>
        ) : (
          <optgroup label="YouVersion (Popular)">
            <option value="111">NIV - New International Version</option>
            <option value="1">KJV - King James Version</option>
            <option value="12">ASV - American Standard Version</option>
            <option value="59">ESV - English Standard Version</option>
            <option value="116">NLT - New Living Translation</option>
          </optgroup>
        )}
        
        {localTranslations.length > 0 && (
          <optgroup label="Local Bibles (Offline)">
            {localTranslations.map(lt => (
              <option key={lt} value={lt}>{lt.toUpperCase()}</option>
            ))}
          </optgroup>
        )}
      </select>
      
      {/* Search Input with Autocomplete */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input 
            ref={inputRef}
            type="text" 
            placeholder="e.g. Psalm 23, John 3:16, Genesis 1-2"
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              setShowSuggestions(true);
              setHighlightIdx(-1);
            }}
            onFocus={() => { if (reference.trim()) setShowSuggestions(true); }}
            onKeyDown={handleKeyDown}
            className="w-full bg-white border border-[#3D7B8C]/10 rounded-xl text-sm font-medium text-[#1C355E] pl-10 pr-4 py-3 outline-none focus:border-[#3D7B8C] transition shadow-inner"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          
          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div 
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#3D7B8C]/20 rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {suggestions.map((book, i) => (
                <button
                  key={book.name}
                  onClick={() => handleSuggestionClick(book)}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium flex items-center justify-between transition-colors ${
                    i === highlightIdx 
                      ? 'bg-[#3D7B8C]/30 text-[#1C355E]' 
                      : 'text-neutral-700 hover:bg-[#F7F7F7]'
                  }`}
                >
                  <span>{book.name}</span>
                  <span className="text-[10px] text-neutral-400 font-bold">{book.chapters} ch</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button 
          type="button"
          onClick={() => handleSearch()}
          disabled={loading || !reference.trim()}
          className="bg-[#3D7B8C] hover:bg-[#3D7B8C] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl font-extrabold transition flex items-center justify-center shadow-lg"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'FIND'}
        </button>
      </div>

      {error && <div className="text-red-700 font-medium text-xs text-center mt-1 bg-red-50 p-3 rounded-lg border border-red-200 shadow-sm">{error}</div>}

      {/* ─── Browse-Style Picker ─── */}
      <div className="mt-1 relative" ref={browserRef}>
        <button 
          onClick={() => setShowBrowser(!showBrowser)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all shadow-inner ${showBrowser ? 'bg-[#3D7B8C]/20 border-[#3D7B8C]/50 text-[#1C355E]' : 'bg-white border-[#3D7B8C]/10 text-neutral-400 hover:bg-[#F7F7F7] hover:text-[#1C355E]'}`}
        >
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest flex-1 text-left line-clamp-1">
            <Book size={14} className={showBrowser ? "text-[#3D7B8C]" : "text-[#3D7B8C]"} />
            {browseBook ? browseBook.name : "Browse Books"}
          </span>
          {browseBook && showBrowser ? (
            <div 
              onClick={(e) => { e.stopPropagation(); setBrowseBook(null); }}
              className="text-[10px] font-bold bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-700 px-2 py-1 rounded transition flex items-center gap-1"
            >
              <ChevronLeft size={12} /> Back
            </div>
          ) : (
            <ChevronRight size={14} className={`transition-transform duration-200 ${showBrowser ? 'rotate-90 text-[#3D7B8C]' : ''}`} />
          )}
        </button>

        {showBrowser && (
          <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white border border-[#3D7B8C]/20/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {!browseBook ? (
              /* ── Book List ── */
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                {/* Old Testament */}
                <div className="px-3 py-2 text-[9px] font-extrabold text-neutral-600 uppercase tracking-[0.2em] border-b border-[#3D7B8C]/10/50 bg-white/80 sticky top-0 z-10">
                  Old Testament
                </div>
                <div className="grid grid-cols-2 gap-px p-1">
                  {otBooks.map(book => (
                    <button
                      key={book.name}
                      onClick={() => setBrowseBook(book)}
                      className="text-left px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-[#3D7B8C]/20 hover:text-[#1C355E] transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{book.name}</span>
                      <ChevronRight size={12} className="text-neutral-700 group-hover:text-[#3D7B8C] transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>

                {/* New Testament */}
                <div className="px-3 py-2 text-[9px] font-extrabold text-neutral-600 uppercase tracking-[0.2em] border-b border-t border-[#3D7B8C]/10/50 bg-white/80 sticky top-0 z-10">
                  New Testament
                </div>
                <div className="grid grid-cols-2 gap-px p-1">
                  {ntBooks.map(book => (
                    <button
                      key={book.name}
                      onClick={() => setBrowseBook(book)}
                      className="text-left px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 hover:bg-[#3D7B8C]/20 hover:text-[#1C355E] transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{book.name}</span>
                      <ChevronRight size={12} className="text-neutral-700 group-hover:text-[#3D7B8C] transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Chapter Grid ── */
              <div className="flex flex-col max-h-[320px]">
                <div className="px-3 py-2.5 text-sm font-extrabold text-[#1C355E] border-b border-[#3D7B8C]/10/50 bg-white/80 flex items-center gap-2">
                  <Book size={14} className="text-[#3D7B8C]" />
                  {browseBook.name}
                  <span className="text-[10px] text-neutral-400 font-bold ml-auto">{browseBook.chapters} chapters</span>
                </div>
                <div className="p-2 grid grid-cols-5 gap-1.5 overflow-y-auto custom-scrollbar">
                  {Array.from({ length: browseBook.chapters }, (_, i) => i + 1).map(ch => (
                    <button
                      key={ch}
                      onClick={() => handleBrowseChapter(ch)}
                      disabled={loading}
                      className="aspect-square flex items-center justify-center rounded-lg text-sm font-bold text-neutral-700 bg-white/50 hover:bg-[#3D7B8C] hover:text-white active:scale-95 transition-all duration-150 shadow-sm disabled:opacity-50"
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
