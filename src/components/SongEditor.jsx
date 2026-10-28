import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sparkles, Search, Plus, Trash2 } from 'lucide-react';

const SHORTCUT_LABELS = [
  ...Array.from({ length: 10 }, (_, i) => ({ key: `v${i + 1}`, label: `Verse ${i + 1}`, replace: `[Verse ${i + 1}]\n` })),
  { key: 'p', label: 'Pre-Chorus', replace: '[Pre-Chorus]\n' },
  { key: 'pc', label: 'Pre-Chorus', replace: '[Pre-Chorus]\n' },
  ...Array.from({ length: 4 }, (_, i) => ({ key: `p${i + 1}`, label: `Pre-Chorus ${i + 1}`, replace: `[Pre-Chorus ${i + 1}]\n` })),
  ...Array.from({ length: 4 }, (_, i) => ({ key: `pc${i + 1}`, label: `Pre-Chorus ${i + 1}`, replace: `[Pre-Chorus ${i + 1}]\n` })),
  { key: 'c', label: 'Chorus', replace: '[Chorus]\n' },
  ...Array.from({ length: 4 }, (_, i) => ({ key: `c${i + 1}`, label: `Chorus ${i + 1}`, replace: `[Chorus ${i + 1}]\n` })),
  { key: 'b', label: 'Bridge', replace: '[Bridge]\n' },
  ...Array.from({ length: 4 }, (_, i) => ({ key: `b${i + 1}`, label: `Bridge ${i + 1}`, replace: `[Bridge ${i + 1}]\n` })),
  { key: 'i', label: 'Intro', replace: '[Intro]\n' },
  { key: 'o', label: 'Outro', replace: '[Outro]\n' },
  { key: 't', label: 'Tag', replace: '[Tag]\n' },
  { key: 'ins', label: 'Instrumental', replace: '[Instrumental]\n' },
];

export default function SongEditor({ libraryHandle, onSaved, initialData }) {
  const initialMeta = (() => {
    if (!initialData?.rawText) return {};
    const match = initialData.rawText.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const meta = {};
    match[1].split('\n').forEach(line => {
      const [k, ...v] = line.split(':');
      if (k && v.length) meta[k.trim().toLowerCase()] = v.join(':').trim();
    });
    return meta;
  })();

  const [title, setTitle] = useState(initialData?.title || initialMeta.title || '');
  const [artist, setArtist] = useState(initialData?.artist || initialMeta.artist || initialMeta.author || '');
  const [ccli, setCcli] = useState(initialData?.ccli || initialMeta.ccli || '');
  const [copyright, setCopyright] = useState(initialData?.copyright || initialMeta.copyright || '');
  const [lyrics, setLyrics] = useState(() => {
    if (!initialData?.rawText) return '';
    return initialData.rawText.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  });
  
  // Shortcut states
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [shortcutFilter, setShortcutFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);

  const applyLyricsText = useCallback((text) => {
    if (!text) return;
    const lines = text.split('\n').map(l => l.trim());
    let autoTitle = '';
    let autoArtist = '';
    let autoCcli = '';
    let autoCopyright = '';
    let cleanedLyrics = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) {
           if (cleanedLyrics.length > 0 && cleanedLyrics[cleanedLyrics.length - 1] !== "") {
              cleanedLyrics.push("");
           }
           continue;
        }
        
        // Metadata Extraction
        const ccliMatch = line.match(/(?:CCLI Song #|CCLI #)\s*(\d+)/i);
        if (ccliMatch) { 
            autoCcli = ccliMatch[1]; 
            // If the last added lyric line is short and looks like an artist, and we don't have an artist yet
            if (!autoArtist && cleanedLyrics.length > 0) {
                let lastIdx = cleanedLyrics.length - 1;
                while (lastIdx >= 0 && cleanedLyrics[lastIdx] === "") {
                    lastIdx--;
                }
                if (lastIdx >= 0) {
                    const possibleArtist = cleanedLyrics[lastIdx];
                    if (possibleArtist !== autoTitle && possibleArtist.length < 100 && !possibleArtist.startsWith('[')) {
                        autoArtist = possibleArtist;
                        // remove the artist and any trailing empty lines we just skipped
                        cleanedLyrics.splice(lastIdx);
                    }
                }
            }
            continue; 
        }

        const copyrightMatch = line.match(/^(?:©|\(c\)|Copyright)\s*(.*)/i);
        if (copyrightMatch) {
            autoCopyright = line;
            continue;
        }
        if (/^Public Domain$/i.test(line)) {
            autoCopyright = 'Public Domain';
            continue;
        }
        
        const artistMatch = line.match(/(?:Author|Artist|Written By|Words & Music by|Words and Music by|By):\s*(.*)/i);
        if (artistMatch) { autoArtist = artistMatch[1]; continue; }

        if (line.includes('|') && !autoArtist) {
            const parts = line.split('|');
            if (parts.length > 1) {
                autoArtist = parts.map(n => n.trim()).join(', ');
                continue;
            }
        }
        
        // Label formatting (e.g. "Verse 1" -> "[Verse 1]", "Pre-Chorus" -> "[Pre-Chorus]")
        const labelMatch = line.match(/^(Verse|Chorus|Pre[\s-]?Chorus|Post[\s-]?Chorus|Bridge|Intro|Outro|Ending|Tag|Instrumental|Interlude|Refrain|Vamp|Hook)(\s*\d+)?$/i);
        if (labelMatch) {
            let type = labelMatch[1].trim();
            if (/^pre[\s-]?chorus$/i.test(type)) {
                type = 'Pre-Chorus';
            } else if (/^post[\s-]?chorus$/i.test(type)) {
                type = 'Post-Chorus';
            } else {
                type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            }
            const num = labelMatch[2] ? labelMatch[2].trim() : "";
            cleanedLyrics.push(`[${type}${num ? ' ' + num : ''}]`);
            continue;
        }
        
        // Final Title Detection (Heuristic: first non-label line if short)
        if (!autoTitle && cleanedLyrics.length === 0 && line.length < 50 && !line.includes('[')) {
            autoTitle = line;
            continue;
        }

        // Filter repetitive metadata
        const isNoise = line.match(/^(CCLI|©|\(c\)|Public Domain|Words|Music|For use solely|Song #|All rights reserved|www\.ccli\.com)/i);
        if (!isNoise) cleanedLyrics.push(line);
    }

    if (autoTitle) setTitle(autoTitle);
    if (autoArtist) setArtist(autoArtist);
    if (autoCcli) setCcli(autoCcli);
    if (autoCopyright) setCopyright(autoCopyright);
    setLyrics(cleanedLyrics.join('\n').trim());
  }, []);

  // Listen for virtual imports from Sidebar (e.g. from Lyrics.ovh results)
  useEffect(() => {
    const checkImport = () => {
      if (window.lyricsToImport) {
        const payload = window.lyricsToImport;
        window.lyricsToImport = null;
        if (typeof payload === 'object') {
            setTitle(payload.title || '');
            applyLyricsText(payload.content || '');
        } else {
            applyLyricsText(payload);
        }
      }
    };
    const timer = setInterval(checkImport, 500);
    return () => clearInterval(timer);
  }, [applyLyricsText]);

  const filteredShortcuts = useMemo(() => {
    let base = SHORTCUT_LABELS;
    
    if (shortcutFilter) {
      const match = shortcutFilter.match(/^([vcbp]|pc)(\d+)$/i);
      if (match) {
        const [_, type, num] = match;
        const low = type.toLowerCase();
        const typeLabel = low === 'v' ? 'Verse' : low === 'c' ? 'Chorus' : low === 'b' ? 'Bridge' : 'Pre-Chorus';
        const key = `${low}${num}`;
        if (!base.find(s => s.key === key)) {
          base = [{ key, label: `${typeLabel} ${num}`, replace: `[${typeLabel} ${num}]\n` }, ...base];
        }
      }
    }

    if (!shortcutFilter) return base;
    const f = shortcutFilter.toLowerCase();
    return base.filter(s => 
      s.key.toLowerCase().startsWith(f) || 
      s.label.toLowerCase().includes(f)
    );
  }, [shortcutFilter]);

  const insertShortcut = (shortcut) => {
    const text = lyrics;
    const before = text.substring(0, cursorPosition - (shortcutFilter.length + 1));
    const after = text.substring(cursorPosition);
    const newText = before + shortcut.replace + after;
    setLyrics(newText);
    setShowShortcuts(false);
    setShortcutFilter('');
    
    setTimeout(() => {
      if (textareaRef.current) {
         textareaRef.current.focus();
         const newPos = before.length + shortcut.replace.length;
         textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (showShortcuts) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredShortcuts.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredShortcuts.length) % filteredShortcuts.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredShortcuts[selectedIndex]) {
          insertShortcut(filteredShortcuts[selectedIndex]);
        }
      } else if (e.key === 'Escape' || e.key === ' ') {
        setShowShortcuts(false);
        setShortcutFilter('');
      }
    }
  };

  const handleLyricsChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setLyrics(val);
    setCursorPosition(pos);

    const textBeforeCursor = val.substring(0, pos);
    const lastSlash = textBeforeCursor.lastIndexOf('/');
    
    if (lastSlash !== -1 && lastSlash >= textBeforeCursor.lastIndexOf('\n')) {
      const filter = textBeforeCursor.substring(lastSlash + 1);
      if (lastSlash === 0 || val[lastSlash - 1] === ' ' || val[lastSlash - 1] === '\n') {
        setShowShortcuts(true);
        setShortcutFilter(filter);
        setSelectedIndex(0);
      } else {
        setShowShortcuts(false);
      }
    } else {
      setShowShortcuts(false);
    }
  };

  const handleMagicImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyLyricsText(text);
    } catch {
      alert("Clipboard access is required for Magic Import.");
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (file.name.endsWith('.xml')) {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, 'text/xml');
          
          setTitle(xmlDoc.querySelector('properties titles title')?.textContent || '');
          setArtist(xmlDoc.querySelector('properties authors author')?.textContent || '');
          
          const verses = xmlDoc.querySelectorAll('lyrics verse');
          const parsedLyrics = Array.from(verses).map(v => {
            const name = v.getAttribute('name') || 'Verse';
            const lines = Array.from(v.querySelectorAll('lines')).map(l => l.textContent).join('\n');
            return `[${name.toUpperCase()}]\n${lines}`;
          }).join('\n\n');
          
          setLyrics(parsedLyrics);
        } catch {
          alert("Failed to parse OpenLyrics XML");
        }
      } else {
        applyLyricsText(content);
      }
    };
    reader.readAsText(file);
    // Reset target so same file can be imported twice
    e.target.value = null;
  };



  const handleSave = async () => {
    if (!title.trim()) return alert("Song Title is required");
    
    const md = `---
Title: ${title}
Artist: ${artist}
CCLI: ${ccli}
Copyright: ${copyright}
---

${lyrics}
`;
    try {
      const songsFolder = await libraryHandle.getDirectoryHandle('Songs', { create: true });
      const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const filename = initialData?.id?.endsWith('.md') ? initialData.id : `${safeTitle}.md`;
      
      const fileHandle = await songsFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(md);
      await writable.close();
      
      onSaved();
    } catch (err) {
       alert("Failed to save song: " + err.message);
    }
  };

  return (
     <div className="w-full h-full bg-[#FAF6F0] rounded-2xl p-8 border border-[#E4E1DA] flex flex-col focus:outline-none overflow-y-auto custom-scrollbar animate-in fade-in relative">
       {/* Shortcut Menu */}
       {showShortcuts && filteredShortcuts.length > 0 && (
         <div className="absolute z-50 left-8 right-8 bottom-32 bg-white border border-[#E4E1DA] rounded-2xl shadow-lg p-2 max-h-48 overflow-y-auto custom-scrollbar flex flex-wrap gap-2 animate-in slide-in-from-bottom-4 duration-200">
           {filteredShortcuts.map((s, i) => (
             <div 
               key={s.key} 
               onClick={() => insertShortcut(s)}
               className={`px-4 py-2 rounded-xl cursor-pointer transition-colors flex items-center gap-3 border ${
                i === selectedIndex 
                  ? 'bg-[#1C355E] border-[#1C355E] text-white' 
                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#526075] hover:text-[#1C355E] hover:bg-[#F0EBE1]'
               }`}
             >
               <span className="text-[10px] font-bold uppercase opacity-75 tracking-wider">/{s.key}</span>
               <span className="font-bold text-sm tracking-tight">{s.label}</span>
             </div>
           ))}
         </div>
       )}

       <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-extrabold text-[#1C355E] tracking-tight">{initialData ? 'Edit Song' : 'Create New Song'}</h2>
         
         <div className="flex items-center gap-3">
            <label className="text-[10px] bg-white text-[#1C355E] border border-[#E4E1DA] hover:bg-[#F0EBE1] px-4 py-2 rounded-xl font-bold uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-2 shadow-sm">
                <Plus size={14} className="text-[#3D7B8C]" />
                Import File
                <input type="file" accept=".txt,.xml" className="hidden" onChange={handleFileImport} />
            </label>

           <button 
             onClick={handleMagicImport}
             className="flex items-center gap-2 px-4 py-2 bg-[#3D7B8C] hover:bg-[#2F6473] text-white rounded-xl transition-colors shadow-sm text-[10px] font-bold uppercase tracking-widest group cursor-pointer"
             title="Import from Clipboard"
           >
             <Sparkles size={14} className="group-hover:animate-pulse" />
             Import Song Select
           </button>
         </div>
       </div>
       
       <div className="flex gap-4 mb-5">
         <div className="flex-1">
           <label className="text-[10px] font-bold text-[#526075] uppercase tracking-widest mb-2 block">Song Title *</label>
           <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white border border-[#E4E1DA] rounded-xl p-3.5 text-[#1C355E] placeholder:text-[#526075]/60 font-semibold focus:border-[#3D7B8C] outline-none transition-colors" placeholder="e.g. Amazing Grace" autoFocus />
         </div>
         <div className="flex-1">
           <label className="text-[10px] font-bold text-[#526075] uppercase tracking-widest mb-2 block">Artist</label>
           <input type="text" value={artist} onChange={e => setArtist(e.target.value)} className="w-full bg-white border border-[#E4E1DA] rounded-xl p-3.5 text-[#1C355E] placeholder:text-[#526075]/60 focus:border-[#3D7B8C] outline-none transition-colors" placeholder="e.g. John Newton" />
         </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
         <div>
            <label className="text-[10px] font-bold text-[#526075] uppercase tracking-widest mb-2 block">CCLI Song #</label>
            <input 
              type="text" 
              value={ccli} 
              onChange={e => setCcli(e.target.value)} 
              className="w-full bg-white border border-[#E4E1DA] rounded-xl p-3.5 text-[#1C355E] placeholder:text-[#526075]/60 focus:border-[#3D7B8C] outline-none transition-colors font-medium text-sm" 
              placeholder="e.g. 6016351 (Optional)" 
            />
         </div>
         <div>
            <label className="text-[10px] font-bold text-[#526075] uppercase tracking-widest mb-2 block">Copyright / Publisher</label>
            <input 
              type="text" 
              value={copyright} 
              onChange={e => setCopyright(e.target.value)} 
              className="w-full bg-white border border-[#E4E1DA] rounded-xl p-3.5 text-[#1C355E] placeholder:text-[#526075]/60 focus:border-[#3D7B8C] outline-none transition-colors font-medium text-sm" 
              placeholder="e.g. © 2011 Thankyou Music / Public Domain" 
            />
         </div>
       </div>

       <div className="flex-1 flex flex-col mb-6">
           <div className="flex items-end justify-between mb-2">
               <label className="text-[10px] font-bold text-[#526075] uppercase tracking-widest block">Lyrics</label>
               <span className="text-[10px] text-[#526075] font-bold uppercase tracking-[0.15em]">Type / for labels</span>
           </div>
           
           <textarea 
              ref={textareaRef}
              value={lyrics} 
              onKeyDown={handleKeyDown}
              onChange={handleLyricsChange} 
              className="flex-1 w-full bg-white border border-[#E4E1DA] rounded-xl p-5 text-[#1C355E] placeholder:text-[#526075]/55 font-mono text-sm leading-relaxed focus:border-[#3D7B8C] outline-none resize-none transition-colors" 
              placeholder={"[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\n\n[Pre-Chorus]\nWhen the music fades\n\n[Chorus]\nMy chains are gone\nI've been set free"}
           />
       </div>

       <div className="flex justify-end gap-3 mt-auto pt-6 border-t border-[#E4E1DA]">
          <button onClick={() => onSaved()} className="px-6 py-3 font-bold text-[#526075] hover:text-[#1C355E] hover:bg-[#F0EBE1] rounded-xl transition-colors uppercase tracking-wider text-xs cursor-pointer">Cancel</button>
          <button onClick={handleSave} className="px-8 py-3 bg-[#7A502A] hover:bg-[#654121] text-white font-bold rounded-xl shadow-sm transition-colors tracking-wider uppercase text-xs cursor-pointer">Save Song</button>
       </div>
     </div>
  );
}
