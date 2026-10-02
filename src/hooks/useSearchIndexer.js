import { useState, useEffect, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { get, set } from 'idb-keyval';
import { parseSongMarkdown } from '../utils/songParser';

const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 2 },
    { name: 'artist', weight: 1.5 },
    { name: 'ccli', weight: 1 },
    { name: 'lyrics', weight: 0.5 },
    { name: 'rawText', weight: 0.1 }
  ],
  includeMatches: true,
  threshold: 0.3,
  ignoreLocation: true, // CRITICAL for full-text search, otherwise matches deep in lyrics are ignored
  useExtendedSearch: true
};

/**
 * Hook to maintain a localized search index using Fuse.js.
 * Only re-reads and parses files that have changed based on lastModified timing.
 */
export function useSearchIndexer(libraryHandle, watcherTrigger) {
  const [isReady, setIsReady] = useState(false);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState('');
  
  const [indexedData, setIndexedData] = useState([]);
  const fuseRef = useRef(new Fuse([], FUSE_OPTIONS));
  const fileCacheRef = useRef(new Map()); // map of filename -> { lastModified }

  useEffect(() => {
    if (!libraryHandle) return;

    let isCancelled = false;
    
    const synchronizeIndex = async () => {
      try {
        const songsHandle = await libraryHandle.getDirectoryHandle('Songs', { create: true });
        let hasUpdates = false;
        let nextData = [...indexedData];
        
        // Load from idb on first mount
        if (!isReady && fileCacheRef.current.size === 0) {
          const cachedData = await get('presenter-search-data-v2');
          const cachedMapArr = await get('presenter-search-map-v2');
          if (cachedData && cachedMapArr) {
            nextData = cachedData;
            fileCacheRef.current = new Map(cachedMapArr);
            fuseRef.current = new Fuse(cachedData, FUSE_OPTIONS);
            setIndexedData(cachedData);
            setIsReady(true);
          }
        }
        
        const currentFiles = [];
        for await (const entry of songsHandle.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            currentFiles.push(entry);
          }
        }
        
        const currentFileNames = new Set(currentFiles.map(e => e.name));
        
        // Remove deleted files from index
        const initialLen = nextData.length;
        nextData = nextData.filter(d => currentFileNames.has(d.id));
        if (nextData.length !== initialLen) hasUpdates = true;

        for (const [name] of fileCacheRef.current.entries()) {
          if (!currentFileNames.has(name)) {
            fileCacheRef.current.delete(name);
          }
        }
        
        // Check for new or modified files
        for (const entry of currentFiles) {
          const file = await entry.getFile();
          const lastModified = file.lastModified;
          const name = entry.name;
          
          const cached = fileCacheRef.current.get(name);
          if (!cached || cached.lastModified !== lastModified) {
            const text = await file.text();
            const parsed = parseSongMarkdown(text);
            
            const rawLyrics = parsed.slides.map(s => s.content.join('\n')).join('\n\n');
            const doc = {
              id: name,
              title: parsed.metadata.title || name.replace('.md', ''),
              artist: parsed.metadata.artist || '',
              ccli: parsed.metadata.ccli || '',
              lyrics: rawLyrics,
              rawText: text,
              handle: entry
            };
            
            fileCacheRef.current.set(name, { lastModified });
            
            // Remove old version if it exists
            nextData = nextData.filter(d => d.id !== name);
            nextData.push(doc);
            hasUpdates = true;
          }
        }
        
        if (hasUpdates && !isCancelled) {
          fuseRef.current = new Fuse(nextData, FUSE_OPTIONS);
          setIndexedData(nextData);
          await set('presenter-search-data-v2', nextData);
          await set('presenter-search-map-v2', Array.from(fileCacheRef.current.entries()));
          if (!isReady) setIsReady(true);
        } else if (!isReady && !isCancelled) {
          setIsReady(true);
        }
      } catch (err) {
        console.warn("Failed to synchronize search index", err);
      }
    };
    
    synchronizeIndex();
  }, [libraryHandle, watcherTrigger]);

  const search = useCallback((searchQuery) => {
    setQuery(searchQuery);
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    const res = fuseRef.current.search(searchQuery).map(r => r.item);
    setResults(res);
  }, []);

  return { isReady, results, search, query, allItems: indexedData };
}
