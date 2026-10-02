import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useState, useEffect, useRef, useCallback } from 'react'
import { Peer } from 'peerjs'
import { ExternalLink, Check, Settings, Plus } from 'lucide-react'
import FileSystemSetup from './components/FileSystemSetup'
import { getStoredDirectoryHandle } from './utils/fileSystem'
import { TauriDirectoryHandle } from './utils/TauriFileSystem';
import Sidebar from './components/Sidebar'
import SettingsView from './components/SettingsView'
import PreviewEditor from './components/PreviewEditor'
import LiveControl from './components/LiveControl'
import DragDropZone from './components/DragDropZone'
import ImageArrayViewer from './components/ImageArrayViewer'
import SongEditor from './components/SongEditor'
import LiturgyEditor from './components/LiturgyEditor'
import Logo from './components/Logo'
import { useFileSystemWatcher } from './hooks/useFileSystemWatcher'
import { useSearchIndexer } from './hooks/useSearchIndexer'
import { useFolderContents } from './hooks/useFolderContents'
import { parseSongMarkdown } from './utils/songParser';
import { parseLiturgyMarkdown } from './utils/liturgyParser';
import { parseBibleText } from './services/bibleService';
import ConfirmModal from './components/ConfirmModal'
import { verifyPermission, reResolveMedia, formatVerseRanges, getYoutubeEmbedUrl } from './utils/media'
import OutputScreen from './components/OutputScreen'
import CentralAudioPlayer from './components/CentralAudioPlayer'
import RemoteControl from './components/RemoteControl'
import { addSongPlay } from './services/historyService'

const TABS = ['Service', 'Songs', 'Images', 'Bible', 'Liturgy', 'Videos', 'Music'];

function FolderExplorer({ folderName, handle, onSelectItem, onBack }) {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        let isCancelled = false;
        const load = async () => {
            const arr = [];
            for await (const [name, fileHandle] of handle.entries()) {
                if (fileHandle.kind === 'file' || fileHandle.kind === 'directory') {
                    arr.push({ name, handle: fileHandle, isDirectory: fileHandle.kind === 'directory' });
                }
            }
            if (!isCancelled) {
               setFiles(arr.sort((a,b) => {
                  if (a.isDirectory && !b.isDirectory) return -1;
                  if (!a.isDirectory && b.isDirectory) return 1;
                  return a.name.localeCompare(b.name, undefined, {numeric: true});
               }));
               setIsLoading(false);
            }
        };
        load();
        return () => { isCancelled = true; };
    }, [handle]);

    return (
        <div className="w-full h-full flex flex-col items-center bg-[#F7F7F7] rounded-2xl border border-[#3D7B8C]/10 p-8 shadow-inner overflow-hidden relative">
             <div className="absolute top-4 left-4 z-10 text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                 <button onClick={onBack} className="hover:bg-[#F7F7F7] p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[#3D7B8C]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    BACK
                 </button>
                 <span className="opacity-20 mx-1">|</span>
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3D7B8C]"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                {folderName}
             </div>
               <div className="w-full h-full pt-12 flex flex-col">
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                       {isLoading && <div className="text-neutral-400 italic p-4 text-center text-sm animate-pulse">Scanning folder...</div>}
                       
                       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                           {!isLoading && files.map(f => (
                               <div 
                                   key={f.name}
                                   onClick={() => onSelectItem(f)}
                                   className="group aspect-square p-4 bg-white/50 border border-[#3D7B8C]/10/80 rounded-2xl hover:bg-[#F7F7F7] hover:border-[#3D7B8C]/50 cursor-pointer flex flex-col items-center justify-center gap-3 transition-all text-sm text-neutral-700 shadow hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:-translate-y-1"
                               >
                                   {f.isDirectory 
                                       ? <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#3D7B8C]/80 group-hover:text-[#3D7B8C] transition-colors flex-shrink-0"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                                       : <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400/70 group-hover:text-neutral-700 transition-colors flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                   }
                                   <span className="truncate w-full text-center text-[11px] font-medium leading-tight px-1">{f.name}</span>
                               </div>
                           ))}
                       </div>
                       
                       {!isLoading && files.length === 0 && <div className="text-neutral-400 italic p-4 text-center text-sm col-span-full">Empty Folder</div>}
                   </div>
               </div>
        </div>
    );
}

const initialLibraryPath = localStorage.getItem('presenter-library-path');
const initialHandle = initialLibraryPath ? new TauriDirectoryHandle(initialLibraryPath.replace(/\\/g, '/'), 'Presenter') : null;

function App() {
  const [libraryHandle, setLibraryHandle] = useState(initialHandle)
  
  const handleChangeLibraryPath = async () => {
      try {
         localStorage.removeItem('presenter-library-path');
         setLibraryHandle(null);
      } catch (err) {
         console.error('Failed to clear library handle', err);
      }
  };

  const projectorWindowRef = useRef(null);
  const peerRef = useRef(null);
  // const connectionsRef = useRef([]);
  const wsRef = useRef(null);
  const livePayloadRef = useRef(null);
  const serviceItemsRef = useRef([]);
  const projectorTimeoutRef = useRef(null);
  
  // Routing State
  const [isProjectorView, setIsProjectorView] = useState(false);
  const [isNetworkView, setIsNetworkView] = useState(false);
  const [projectorConnected, setProjectorConnected] = useState(false);
  const [remoteControlRoom, setRemoteControlRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [networkPayload, setNetworkPayload] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  
  // App Global Data State
  const [activeTab, setActiveTab] = useState('Service');
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [serviceItems, setServiceItems] = useState([]); 
  useEffect(() => { serviceItemsRef.current = serviceItems; }, [serviceItems]);
  const [playedItems, setPlayedItems] = useState(new Set());
  const [stickyAudioItem, setStickyAudioItem] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [linesPerSlide, setLinesPerSlide] = useState(2);
  const [presentationPaused, setPresentationPaused] = useState(true);
  const [slideshowInterval, setSlideshowInterval] = useState(5);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);

  // Global Projection State
  const [isLive, setIsLive] = useState(false);
  const [isBlackScreen, setIsBlackScreen] = useState(false);
  const [isShowLogo, setIsShowLogo] = useState(false);
  const [setIsClearText] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [livePayload, setLivePayload] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState({ time: 0, duration: 0, paused: undefined });
  const [churchName, setChurchName] = useState("Alongside Digital - Presenter");
  const [displayFont, setDisplayFont] = useState("Inter");

  // System Hooks
  const [systemTrigger, refreshLibrary] = useFileSystemWatcher(libraryHandle);
  const searchState = useSearchIndexer(libraryHandle, systemTrigger);
  const folderFiles = useFolderContents(libraryHandle, activeTab, systemTrigger);
  const musicFiles = useFolderContents(libraryHandle, 'Music', systemTrigger);

  // Handshake and Init
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('projector')) setIsProjectorView(true);
    if (params.get('network')) setIsNetworkView(true);
    const remoteCode = params.get('remoteControl');
    if (remoteCode) { setRemoteControlRoom(remoteCode); }
    const roomFromUrl = params.get('room');

    const init = async () => {
      try {
        // 1. Directory Handle (Synchronous LocalStorage was handled above)
        let handle = libraryHandle;

        // 2. IDB State Restoration
        try {
            const { get } = await import('idb-keyval');
            
            if (!handle) {
                const idbPath = await get('presenter_library_path_idb');
                if (idbPath) {
                    localStorage.setItem('presenter-library-path', idbPath);
                    handle = new TauriDirectoryHandle(idbPath.replace(/\\/g, '/'), 'Presenter');
                    setLibraryHandle(handle);
                }
            }

            const savedService = await get('presenter_service_state');
            if (savedService) {
                setServiceItems(savedService);
                if (handle) {
                    const resolved = await reResolveMedia(savedService, handle);
                    setServiceItems(resolved);
                }
            }

            const blob = await get('presenter_logo_blob');
            if (blob) setLogoUrl(URL.createObjectURL(blob));
            
            const savedMonitor = await get('presenter_selected_monitor');
            if (savedMonitor) setSelectedMonitor(savedMonitor);
        } catch (idbErr) {
            console.error("IDB Restoration Failed (non-fatal):", idbErr);
        }

      } catch (err) {
        console.error("Presenter Init Failed:", err);
      } finally {
        setIsLoaded(true);
      }
    }
    init()
  }, [])

  // Self-Healing Protocol: Orphaned Blob Resolution
  // Shouts a signal heavily tying the lifecycle of popups to this exact dashboard instance. 
  // If we refresh, popups must reboot to maintain Chrome Blob access scopes.
  useEffect(() => {
     const bc = new BroadcastChannel('presenter-projector-hub');
     bc.postMessage({ type: 'master-reboot' });
     bc.close();
  }, []);

  // Global YouTube API Loader
  useEffect(() => {
    if (!window.YT) {
       const tag = document.createElement('script');
       tag.src = "https://www.youtube.com/iframe_api";
       const firstScriptTag = document.getElementsByTagName('script')[0];
       firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Local WebSocket Master Initialization
  useEffect(() => {
    if (isProjectorView || isNetworkView) return;
    
    let reconnectTimeout;
    const connect = () => {
        let ws = new WebSocket(`ws://127.0.0.1:5179`);
        wsRef.current = ws;
        
        ws.onmessage = async (event) => {
           if (event.data instanceof Blob) return; // Master doesn't need to process blobs sent by itself
           
           try {
               const data = JSON.parse(event.data);
               if (data.type === 'request_state') {
                   if (livePayloadRef.current) {
                      const minItems = serviceItemsRef.current.map(i => ({ id: i.id, type: i.type, title: i.title, filename: i.filename }));
                      const minPayload = { ...livePayloadRef.current };
                        delete minPayload.liveItem;
                        delete minPayload.itemSlides;
                        ws.send(JSON.stringify({ type: 'state', payload: minPayload, serviceItems: minItems }));
                        setTriggerMediaSync(prev => prev + 1);
                   }
               } else if (data.type === 'remote_command') {
                   const bc = new BroadcastChannel('presenter-remote-commands');
                   bc.postMessage({ type: 'remote_command', ...data });
                   bc.close();
               }
           } catch (e) {}
        };

        ws.onclose = () => {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connect, 1000);
        };
    };

    connect();

    return () => {
       clearTimeout(reconnectTimeout);
       if (wsRef.current) wsRef.current.close();
    };
  }, [isProjectorView, isNetworkView]);

    // Live Re-sharding: Automatically re-shard songs and bibles when the linesPerSlide setting changes
    useEffect(() => {
      if (!isLoaded) return;
      
      // Only re-shard if it's a song, liturgy, or bible and has rawText source
      const reShard = (item) => {
         if ((item?.type === 'song' || item?.type === 'liturgy' || item?.type === 'bible') && item.rawText) {
            let parsedSlides;
            if (item.type === 'song') {
                parsedSlides = parseSongMarkdown(item.rawText, linesPerSlide).slides;
            } else if (item.type === 'liturgy') {
                parsedSlides = parseLiturgyMarkdown(item.rawText, linesPerSlide).slides;
            } else if (item.type === 'bible') {
                parsedSlides = parseBibleText(item.rawText, item.reference || item.title, 1);
            }
            return { ...item, slides: parsedSlides };
         }
         return item;
      };

    if (selectedItem) setSelectedItem(prev => reShard(prev));
    if (liveItem) setLiveItem(prev => reShard(prev));
  }, [linesPerSlide]);


  const [remoteCommand, setRemoteCommand] = useState(null);
  
  const [liveItem, setLiveItemState] = useState(null);
  const liveItemRef = useRef(null);
  const setLiveItem = useCallback((val) => {
     setLiveItemState(prev => {
        const next = typeof val === 'function' ? val(prev) : val;
        liveItemRef.current = next;
        return next;
     });
  }, []);

  const selectedItemRef = useRef(null);
  useEffect(() => { selectedItemRef.current = selectedItem; }, [selectedItem]);

  const [liveSlideIndex, setLiveSlideIndex] = useState(0);

  const [isSyncingMedia, setIsSyncingMedia] = useState(false);
  const [syncedMediaUrl, setSyncedMediaUrl] = useState(null);
  const [triggerMediaSync, setTriggerMediaSync] = useState(0);
  const lastUploadedRef = useRef(null);
  useEffect(() => {
    const syncMedia = async () => {
      let targetUrl = null;
      if (isShowLogo && logoUrl?.startsWith('blob:')) targetUrl = logoUrl;
      else if (liveItem?.url?.startsWith('blob:')) {
         if (liveItem.type !== 'audio') targetUrl = liveItem.url;
      }
      else if (liveItem?.type === 'image' || liveItem?.type === 'slide_deck') {
         const img = liveItem.images?.[liveSlideIndex];
         if (img?.url?.startsWith('blob:')) targetUrl = img.url;
      }

      if (targetUrl) {
          if (triggerMediaSync > 0 && targetUrl === lastUploadedRef.current) {
              lastUploadedRef.current = null;
          }
        }

        if (targetUrl && targetUrl !== lastUploadedRef.current) {
        lastUploadedRef.current = targetUrl;
        setIsSyncingMedia(true);
        if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'sync-start', id: targetUrl }));

        try {
          if (liveItem?.type === 'video' || liveItem?.type === 'audio') {
             // Only block ultra-massive raw ultra-HD video buffering to prevent memory crash (e.g. over 200MB)
             // Typical 13MB 1080p clips will process completely fine!
          }

          const res = await fetch(targetUrl);
          const blob = await res.blob();
          const buffer = await blob.arrayBuffer();

          // Yield execution to the main thread briefly so the Projector's <video> element 
          // can smoothly mount and start playing locally before we block the thread to send.
          await new Promise(r => setTimeout(r, 150));

          if (wsRef.current?.readyState === 1) { wsRef.current.send(JSON.stringify({ type: 'media_header', id: targetUrl, mime: blob.type })); wsRef.current.send(buffer); }
          
          setSyncedMediaUrl(targetUrl);
        } catch (e) {
          console.error("Sync Media Failed:", e);
        }
        
        if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'sync-end', id: targetUrl }));
        setIsSyncingMedia(false);
      }
    };
    syncMedia();
  }, [liveItem, liveSlideIndex, logoUrl, isShowLogo, triggerMediaSync]);

  // Projection Engine Compiler
  useEffect(() => {
    const payload = {
       isLive,
       isBlackScreen,
       isShowLogo,
       logoUrl,
       linesPerSlide,
       mediaType: null,
       itemId: liveItem?.id,
       activeSlide: null,
       activeMediaUrl: null,
       currentTime: playbackStatus.time,
       currentTimeTs: playbackStatus.ts || Date.now(),
       duration: playbackStatus.duration,
       isPaused: playbackStatus.paused,
       slideshowInterval: slideshowInterval,
       itemAutoPlay: liveItem?.autoPlay || false,
       churchName: churchName,
       displayFont: displayFont,
       stickyAudioUrl: stickyAudioItem?.url || null,
       slideIndex: liveSlideIndex,
       itemSlides: liveItem?.slides || null,
       itemImagesCount: liveItem?.images?.length || 0
    };

    // Populate content if we have a LIVE selection (Locked to Service Flow)
    if (liveItem) {
       payload.mediaType = liveItem.type;
       
       if (liveItem.type === 'song' || liveItem.type === 'bible') {
          const slides = liveItem.slides || [];
          if (slides[liveSlideIndex]) {
             payload.activeSlide = slides[liveSlideIndex].content;
             if (liveItem.type === 'bible') {
                 payload.slideSubText = slides[liveSlideIndex].type; // This holds the passage reference
             }
          }
        } else if (liveItem.type === 'liturgy') {
           const slides = liveItem.slides || [];
           if (slides[liveSlideIndex]) {
              payload.activeSlide = slides[liveSlideIndex].content;
              payload.liturgyType = slides[liveSlideIndex].type; // 'speaker' | 'response'
              payload.liturgyAlignment = slides[liveSlideIndex].alignment; // 'left' | 'center' | 'right'
           }
        } else if (liveItem.type === 'image' || liveItem.type === 'slide_deck') {
          const imgs = liveItem.images || [];
          if (imgs[liveSlideIndex]) {
             payload.activeMediaUrl = imgs[liveSlideIndex].url;
          }
        } else if (liveItem.type === 'audio') {
           payload.activeMediaUrl = liveItem.url || '';
        } else if (liveItem.type === 'video') {
           let finalUrl = liveItem.url || '';
           const isYouTube = liveItem.isYouTube || finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be');
           const isVimeo = liveItem.isVimeo || finalUrl.includes('vimeo.com');

           if (isYouTube) {
              finalUrl = getYoutubeEmbedUrl(finalUrl);
           } else if (isVimeo && !finalUrl.includes('player.vimeo.com')) {
              let videoId = finalUrl.split('vimeo.com/')[1]?.split('?')[0];
              if (videoId) finalUrl = `https://player.vimeo.com/video/${videoId}?controls=0`;
           }

           payload.activeMediaUrl = finalUrl;
           payload.isYouTube = isYouTube;
           payload.isVimeo = isVimeo;
        }
    }

    setLivePayload(payload);
    
    // Broadcast to local popup instantly
    const bc = new BroadcastChannel('presenter-projector-hub');
    bc.postMessage(payload);
    bc.close();

    // Broadcast to network hub (JSON only)
    const broadcast = async () => {
      // For network broadcast, retain original BLOB URL strings to act as unique cache keys on the follower.
      const networkPayload = { ...payload };
      delete networkPayload.liveItem;
      delete networkPayload.itemSlides;
      // Blobs retained to avoid standby state dropping
      
      networkPayload.isNetworkViewer = true; // Mark specifically for phone viewers
      livePayloadRef.current = networkPayload;

      const minItems = serviceItemsRef.current.map(i => ({ id: i.id, type: i.type, title: i.title, filename: i.filename }));
      if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'state', payload: networkPayload, serviceItems: minItems }));
    };

    broadcast();
  }, [isLive, isBlackScreen, isShowLogo, logoUrl, liveItem, liveSlideIndex, linesPerSlide, playbackStatus, slideshowInterval, syncedMediaUrl, churchName, displayFont, stickyAudioItem]);

  useEffect(() => {
    const bc = new BroadcastChannel('presenter-projector-hub');
     bc.onmessage = (e) => {
        if (!e.data) return;
        
        if (e.data === 'ping') {
           setProjectorConnected(true);
           if (projectorTimeoutRef.current) clearTimeout(projectorTimeoutRef.current);
           projectorTimeoutRef.current = setTimeout(() => setProjectorConnected(false), 2500);
           if (livePayload) bc.postMessage(livePayload);
        }

        if (e.data?.type === 'request-sync' && livePayload) {
           bc.postMessage(livePayload);
        }

        if (e.data?.type === 'heartbeat') {
           setProjectorConnected(true);
           if (projectorTimeoutRef.current) clearTimeout(projectorTimeoutRef.current);
           projectorTimeoutRef.current = setTimeout(() => setProjectorConnected(false), 2500);
        }
        
        if (e.data.type === 'playback') {
           setRemoteCommand({ ...e.data, ts: Date.now() });
           if (e.data.command === 'play') setPresentationPaused(false);
           if (e.data.command === 'pause') setPresentationPaused(true);
           
           // Forward to WebRTC connections
           if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ ...e.data, ts: Date.now() }));
        }

        if (e.data.type === 'status') {
           // Prevent race conditions: ignore stale status reports from a previous media item
           if (e.data.itemId && liveItemRef.current?.id && e.data.itemId !== liveItemRef.current.id) {
               return;
           }
           setPlaybackStatus(prev => ({ 
              ...prev,
              ...(e.data.time !== undefined && { time: e.data.time }),
              ...(e.data.duration !== undefined && { duration: e.data.duration }),
              ...(e.data.paused !== undefined && { paused: e.data.paused }),
              ts: e.data.ts || Date.now()
           }));
           if (e.data.paused !== undefined) setPresentationPaused(e.data.paused);
           if (e.data.slideshowInterval !== undefined) setSlideshowInterval(e.data.slideshowInterval);
        }

        if (e.data.type === 'sticky-audio-ended') {
           setStickyAudioItem(null);
        }
     };
     return () => bc.close();
   }, [livePayload]);

  // Network Viewer WebSocket Initialization
  useEffect(() => {
    if (!isNetworkView) return;

    const host = window.location.hostname;
    const ws = new WebSocket(`ws://${host}:5179`);
    
    ws.onopen = () => {
       ws.send(JSON.stringify({ type: 'request_state' }));
    };

    let pendingMediaHeader = null;
    ws.onmessage = async (event) => {
       if (event.data instanceof Blob) {
           if (pendingMediaHeader) {
               const url = URL.createObjectURL(event.data);
               setNetworkPayload(prev => {
                   if (!prev) return prev;
                   const copy = { ...prev };
                   if (copy.activeMediaUrl === pendingMediaHeader.id) copy.activeMediaUrl = url;
                   if (copy.logoUrl === pendingMediaHeader.id) copy.logoUrl = url;
                   return copy;
               });
               pendingMediaHeader = null;
           }
           return;
       }
       try {
           const data = JSON.parse(event.data);
           if (data.type === 'media_header') {
               pendingMediaHeader = data;
               return;
           }
           if (data.type === 'state' && data.payload) {
               setNetworkPayload(data.payload);
           }
       } catch (err) {
           console.error('Network Viewer WS Error', err);
       }
    };

    return () => ws.close();
  }, [isNetworkView]);

  const isInitialLoad = useRef(true);

  // Auto-Save Service Flow
  useEffect(() => {
      if (!isLoaded) return;
      
      // Skip the very first run after loading finished to prevent overwriting with initial state
      if (isInitialLoad.current) {
         isInitialLoad.current = false;
         return;
      }

      const timer = setTimeout(async () => {
         const { set } = await import('idb-keyval');
         await set('presenter_service_items', serviceItems);
      }, 500);

      return () => clearTimeout(timer);
  }, [serviceItems, isLoaded]);

  useEffect(() => {
      if (!isLoaded || isInitialLoad.current) return;
      import('idb-keyval').then(({ set }) => {
         set('presenter_church_name', churchName);
         set('presenter_display_font', displayFont);
      });
  }, [churchName, displayFont, isLoaded]);

  // Slideshow Autoplay Engine
  useEffect(() => {
     if (presentationPaused || (liveItem?.type !== 'slide_deck' && liveItem?.type !== 'image') || !liveItem?.images?.length) return;
     
     const intervalTime = slideshowInterval * 1000;
     const timer = setInterval(() => {
         setLiveSlideIndex(prev => {
             const nextIndex = prev + 1;
             return nextIndex >= liveItem.images.length ? 0 : nextIndex;
         });
     }, intervalTime);
     
     return () => clearInterval(timer);
  }, [presentationPaused, liveItem, slideshowInterval]);

  // Monitor Projector Window Closure
  useEffect(() => {
     if (!isLive) return;
     const interval = setInterval(() => {
        if (projectorWindowRef.current && projectorWindowRef.current.closed) {
           setIsLive(false);
           setPresentationPaused(true);
           const bc = new BroadcastChannel('presenter-projector-hub');
           bc.postMessage({ type: 'control', command: 'pause' });
           bc.close();
        }
     }, 1000);
     return () => clearInterval(interval);
  }, [isLive]);

  const handleSetSlideIndex = (index) => {
    const nextIndex = typeof index === 'function' ? index(activeSlideIndex) : index;
    setActiveSlideIndex(nextIndex);
    
    // Synchronize Live Output ONLY if the preview matches the live selection
    if (selectedItem?.id === liveItem?.id) {
       setLiveSlideIndex(nextIndex);
    }
  };

  // Core Keyboard Navigator
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (!selectedItem) return;
      
      const isMediaArray = selectedItem.images || selectedItem.isPpt;
      const slidesArray = selectedItem.slides;
      const maxIndex = slidesArray ? slidesArray.length - 1 : (isMediaArray ? selectedItem.images?.length - 1 || 0 : 0);

      switch(e.key) {
        case 'ArrowRight':
        case ' ':
        case 'Enter':
          e.preventDefault();
          handleSetSlideIndex(prev => Math.min(prev + 1, maxIndex));
          // Auto-disable clear text on slide changes
          
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleSetSlideIndex(prev => Math.max(prev - 1, 0));
          
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (slidesArray) {
            const currentGroup = slidesArray[activeSlideIndex]?.type;
            let targetGroupIdx = 0;
            for(let i = activeSlideIndex - 1; i >= 0; i--) {
               if (slidesArray[i].type !== currentGroup) {
                 targetGroupIdx = slidesArray.findIndex(s => s.type === slidesArray[i].type);
                 break;
               }
            }
            handleSetSlideIndex(targetGroupIdx);
            
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (slidesArray) {
            const currentGroup = slidesArray[activeSlideIndex]?.type;
            const idx = slidesArray.findIndex((s, i) => i > activeSlideIndex && s.type !== currentGroup);
            if (idx !== -1) handleSetSlideIndex(idx);
            else handleSetSlideIndex(maxIndex);
            
          }
          break;
      }

      if (/^[1-9]$/.test(e.key)) {
         e.preventDefault();
         const num = parseInt(e.key) - 1;
         handleSetSlideIndex(Math.min(num, maxIndex));
         
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem, activeSlideIndex]);

  // Control Actions
    const handleSelectItem = async (item, forceLive = false) => {
      if (item.type === 'new_song') {
         setSelectedItem(item);
         setActiveTab('new_song');
         return;
      }
      if (item.type === 'new_liturgy') {
         setSelectedItem(item);
         setActiveTab('new_liturgy');
         return;
      }

      
      let itemToView = { ...item };
      

       if ((item.type === 'song' || item.type === 'liturgy' || item.type === 'bible') && item.rawText) {
          let parsedSlides;
          if (item.type === 'song') parsedSlides = parseSongMarkdown(item.rawText, linesPerSlide).slides;
          else if (item.type === 'liturgy') parsedSlides = parseLiturgyMarkdown(item.rawText, linesPerSlide).slides;
          else if (item.type === 'bible') parsedSlides = parseBibleText(item.rawText, item.reference || item.title, 1);
          
          itemToView = { ...item, slides: parsedSlides };
       }
      // Decoupled Seleciton: Only update Live Output if selecting from the Service tab
      if (activeTab === 'Service' || forceLive) {
         setRemoteCommand(null);
         const bcClear = new BroadcastChannel('presenter-projector-hub');
         bcClear.postMessage({ type: 'playback', command: 'clear', ts: Date.now() });
         bcClear.close();
         setLiveItem(itemToView);
         
         if (itemToView.type === 'song') {
             addSongPlay(itemToView);
         }
         
       setLiveSlideIndex(0);
       
       if (isLive) {
          setPlayedItems(prev => new Set(prev).add(itemToView.id));
       }
       
       const willAutoPlay = itemToView.autoPlay === true && isLive;
       setPresentationPaused(!willAutoPlay); 
       setPlaybackStatus({ time: 0, duration: 0, paused: !willAutoPlay, ts: Date.now() });
       
       if (willAutoPlay) {
           setTimeout(() => {
               const bc = new BroadcastChannel('presenter-projector-hub');
               bc.postMessage({ type: 'playback', command: 'play', source: 'system', isYoutube: itemToView.isYouTube, isVimeo: itemToView.isVimeo, ts: Date.now() });
               bc.close();
           }, 200); // Buffer element mounting sequence inside the Projector DOM
       }
    }
    
    setSelectedItem(itemToView);
    setActiveSlideIndex(0);
    setSelectedIndices(new Set()); // Clear selection on new item
     // Reset overlays when changing items
  }

  const handleToggleStickyAudio = (item) => {
    if (stickyAudioItem?.id === item.id) {
       setStickyAudioItem(null);
    } else {
       setStickyAudioItem(item);
       setPresentationPaused(false);
    }
  };



  const handleAddToService = () => {
    if (!selectedItem || selectedItem.type === 'new_song') {
      alert("Please select a valid item to add to the service.");
      return;
    }

    let itemToAdd = { ...selectedItem };

    // If there's a specific selection in the preview, only add those slides
    if (selectedIndices.size > 0 && (selectedItem.slides || selectedItem.images)) {
      if (selectedItem.slides) {
          const selectedSlides = Array.from(selectedIndices).sort((a,b) => a-b).map(idx => selectedItem.slides[idx]);
      
      let selectionLabel = " (Selected)";
      if (selectedItem.type === 'bible') {
        const verseNumbers = selectedSlides
          .map(s => s.type.replace('Verse ', ''))
          .filter(v => !isNaN(v) && v.trim() !== '')
          .map(Number);
        
        if (verseNumbers.length > 0) {
          selectionLabel = ":" + formatVerseRanges(verseNumbers);
        }
      }

        itemToAdd = {
          ...selectedItem,
          title: (selectedItem.title || selectedItem.reference) + selectionLabel,
          slides: selectedSlides
        };
      } else if (selectedItem.images) {
          const selectedImages = Array.from(selectedIndices).sort((a,b) => a-b).map(idx => selectedItem.images[idx]);
          itemToAdd = {
            ...selectedItem,
            title: selectedItem.title + " (Selected)",
            images: selectedImages,
            selectedIndices: Array.from(selectedIndices)
          };
      }
      delete itemToAdd.rawText;
      setSelectedIndices(new Set()); // Reset after adding
    }
    setServiceItems([...serviceItems, { ...itemToAdd, id: Date.now().toString() }]);
    setShowAddedFeedback(true);
    setTimeout(() => setShowAddedFeedback(false), 2000);
  };

  const handleDeleteItem = (id) => {
    if (selectedItem && (selectedItem.id === id || selectedItem.filename === id)) {
      setSelectedItem(null);
      setActiveSlideIndex(0);
    }
    // Also cleanup service items if they match this item's filename/id
    setServiceItems(prev => prev.filter(item => item.id !== id && item.filename !== id));
  };

  const handleSaveService = async () => {
    try {
      const options = {
        suggestedName: `presenter-service-${new Date().toISOString().split('T')[0]}.json`,
        types: [{
          description: 'Presenter Service File',
          accept: { 'application/json': ['.json'] },
        }],
      };
      const handle = await window.showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(serviceItems, null, 2));
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Save failed', err);
    }
  };

  const handleLoadService = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Presenter Service File',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const file = await handle.getFile();
      const content = await file.text();
      const loadedItems = JSON.parse(content);
      if (Array.isArray(loadedItems)) {
        const resolved = await reResolveMedia(loadedItems, libraryHandle);
        setServiceItems(resolved);
      } else {
        alert("Invalid service file format.");
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Load failed', err);
    }
  };

  const handleClearService = () => {
    setShowClearConfirm(true);
  };

  const handleRemoveServiceItem = (idx) => {
    const item = serviceItems[idx];
    const next = [...serviceItems];
    next.splice(idx, 1);
    setServiceItems(next);
    
    // Clear playback if we removed the live item
    if (liveItem?.id === item?.id) setLiveItem(null);
    if (selectedItem?.id === item?.id) setSelectedItem(null);
  };

  const handleUpdateServiceItem = (idx, updatedItem) => {
    const next = [...serviceItems];
    next[idx] = updatedItem;
    setServiceItems(next);
  };

  useEffect(() => {
     const bc = new BroadcastChannel('presenter-remote-commands');
     bc.onmessage = (e) => {
         const data = e.data;
         if (data.command === 'select_item') {
             const item = serviceItems.find(i => i.id === data.itemId);
             if (item) {
                 setActiveTab('Service');
                 handleSelectItem(item, true);
             }
         } else if (data.command === 'next_slide') {
             const currentLive = liveItemRef.current;
             const maxIndex = currentLive?.slides ? currentLive.slides.length - 1 : (currentLive?.images ? currentLive.images.length - 1 : 0);
             
             setLiveSlideIndex(prev => {
                const nextIdx = Math.min(prev + 1, maxIndex);
                if (selectedItemRef.current?.id === currentLive?.id) {
                   setActiveSlideIndex(nextIdx);
                }
                return nextIdx;
             });
         } else if (data.command === 'prev_slide') {
             setLiveSlideIndex(prev => {
                const nextIdx = Math.max(0, prev - 1);
                if (selectedItemRef.current?.id === liveItemRef.current?.id) {
                   setActiveSlideIndex(nextIdx);
                }
                return nextIdx;
             });
         } else if (data.command === 'set_slide_index') {
             const currentLive = liveItemRef.current;
             const maxIndex = currentLive?.slides ? currentLive.slides.length - 1 : (currentLive?.images ? currentLive.images.length - 1 : 0);
             
             setLiveSlideIndex(() => {
                const targetIdx = Math.max(0, Math.min(data.index, maxIndex));
                if (selectedItemRef.current?.id === currentLive?.id) {
                   setActiveSlideIndex(targetIdx);
                }
                return targetIdx;
             });
         } else if (data.command === 'black_screen') {
             setIsBlackScreen(prev => !prev);
         } else if (data.command === 'show_logo') {
             setIsShowLogo(prev => !prev);
         } else if (data.command === 'clear_text') {
             
         } else if (data.command === 'toggle_live') {
             setIsLive(prev => {
                 if (!prev) {
                     // Open projector as a native Tauri window
                     let winOptions = {
                       url: '/presenter/?projector=true',
                       title: 'Presenter - Projector',
                       width: 1280,
                       height: 720,
                       decorations: false,
                       alwaysOnTop: false,
                       resizable: true,
                     };
                     
                     if (selectedMonitor) {
                        try {
                           const m = JSON.parse(selectedMonitor);
                           if (m && m.position) {
                               winOptions.x = m.position.x;
                               winOptions.y = m.position.y;
                               winOptions.fullscreen = true;
                           }
                        } catch(e) {}
                     }
                     
                     const projWin = new WebviewWindow('projector', winOptions);
                     projectorWindowRef.current = projWin;
                     return true;
                 } else {
                     if (projectorWindowRef.current) projectorWindowRef.current.close();
                     return false;
                 }
             });
         } else if (data.command === 'play') {
             const hub = new BroadcastChannel('presenter-projector-hub');
             hub.postMessage({ type: 'playback', command: 'play', source: 'remote', ts: Date.now() });
             hub.close();
         } else if (data.command === 'pause') {
             const hub = new BroadcastChannel('presenter-projector-hub');
             hub.postMessage({ type: 'playback', command: 'pause', source: 'remote', ts: Date.now() });
             hub.close();
         }
     };
     return () => bc.close();
  }, [serviceItems]);

  const toggleLive = () => {
     if (!isLive) {
        // Break out projection window via standard OS popups
        // Open projector as a native Tauri window
                     let winOptions = {
                       url: '/presenter/?projector=true',
                       title: 'Presenter - Projector',
                       width: 1280,
                       height: 720,
                       decorations: false,
                       alwaysOnTop: false,
                       fullscreen: false,
                       maximized: true,
                       resizable: true,
                     };
                     
                     if (selectedMonitor) {
                        try {
                           const m = JSON.parse(selectedMonitor);
                           if (m && m.position) {
                               winOptions.x = m.position.x;
                               winOptions.y = m.position.y;
                           }
                        } catch(e) {}
                     }
                     
                     const projWin = new WebviewWindow('projector', winOptions);
                     projectorWindowRef.current = projWin;
        setIsLive(true);
        if (liveItem) {
           setPlayedItems(prev => new Set(prev).add(liveItem.id));
        }
     } else {
        setShowOfflineConfirm(true);
     }
  };

  const executeGoOffline = () => {
     if (projectorWindowRef.current) projectorWindowRef.current.close();
     setIsLive(false);
     setPresentationPaused(true);
     const bc = new BroadcastChannel('presenter-projector-hub');
     bc.postMessage({ type: 'control', command: 'pause' });
     bc.close();
     setShowOfflineConfirm(false);
  };

  // ROUTING LAYER: PROJECTOR
  if (isProjectorView) {
    return (
       <div className="w-screen h-screen bg-[#F7F7F7] overflow-hidden relative">
          <OutputScreen payload={livePayload} isMaster={true} isProjector={true} remoteCommand={remoteCommand} />
       </div>
    );
  }

  // ROUTING LAYER: NETWORK
  if (isNetworkView) {
    return (
       <div className="w-screen h-screen bg-[#F7F7F7] overflow-hidden relative">
          <OutputScreen payload={networkPayload} isLiveBroadcast={true} />
       </div>
    );
  }

  if (remoteControlRoom) {
     return <RemoteControl roomId={remoteControlRoom} />;
  }

  if (!libraryHandle) {
    return <FileSystemSetup onReady={async (handle) => {
        setLibraryHandle(handle);
        if (serviceItems && serviceItems.length > 0) {
            const resolved = await reResolveMedia(serviceItems, handle);
            setServiceItems(resolved);
        }
    }} />
  }

  return (
    <DragDropZone libraryHandle={libraryHandle} onFileAdded={() => setFileSystemTrigger(prev => prev + 1)}>
      <div className="h-screen bg-[#F7F7F7] text-[#1C355E] flex flex-col overflow-hidden font-sans selection:bg-[#3D7B8C]/30">
          
          {/* TOP NAVIGATION BAR */}
          <header className="h-16 border-b border-[#3D7B8C]/10/80 flex flex-col justify-between px-6 bg-white/60 backdrop-blur-xl z-20 pt-2 shadow-sm">
            <div className="flex justify-between items-end w-full h-full">
              <div className="flex items-center gap-3 pb-3 w-[356px] shrink-0">
                  <Logo showText={true} />
              </div>
              
              <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 justify-center px-4">
                {TABS.map(tab => (
                   <button 
                     key={tab}
                     onClick={() => {
                       setActiveTab(tab);
                       setSelectedItem(null);
                       setActiveSlideIndex(0);
                     }}
                     className={`px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all duration-200 border-b-2 flex items-center h-full ${
                       activeTab === tab 
                          ? 'text-[#1C355E] border-[#3D7B8C] bg-white/80 shadow-[inset_0_2px_10px_rgba(255,255,255,0.02)]' 
                          : 'text-neutral-400 border-transparent hover:text-neutral-700 hover:bg-white/40'
                     }`}
                   >
                     {tab}
                   </button>
                ))}
              </div>
              
              <div className="flex items-center justify-end gap-4 pb-3 w-[336px] shrink-0">

                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1.5 text-neutral-400 hover:text-[#1C355E] hover:bg-[#F7F7F7] rounded-lg transition-colors"
                  title="System Settings"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 flex overflow-hidden relative">
            
            <div className="w-[380px] border-r border-[#3D7B8C]/10/50 p-5 bg-white/30 flex flex-col gap-6 flex-shrink-0 z-10 shadow-lg relative">
              <Sidebar 
                 activeTab={activeTab} setActiveTab={setActiveTab}
                 libraryHandle={libraryHandle}
                 isLive={isLive}
                 liveItem={liveItem}
                 selectedItem={selectedItem}
                 selectedIndices={selectedIndices}
                 searchState={searchState}
                 folderFiles={folderFiles}
                 linesPerSlide={linesPerSlide}
                 serviceItems={serviceItems}
                 systemTrigger={systemTrigger}
                 onRefresh={refreshLibrary}
                 onServiceReorder={setServiceItems}
                 onSelectItem={handleSelectItem}
                 onDeleteItem={handleDeleteItem}
                 onAddToService={handleAddToService}
                 onNewSong={() => handleSelectItem({ type: 'new_song' })}
                 onRemoveServiceItem={handleRemoveServiceItem}
                 onUpdateServiceItem={handleUpdateServiceItem}
                 onSaveService={handleSaveService}
                 onLoadService={handleLoadService}
                 onClearService={handleClearService}
                 onChangeLibrary={handleChangeLibraryPath}
                 playbackStatus={playbackStatus}
                 roomId={roomId}
                 liveItemId={liveItem?.id}
                 playedItems={playedItems}
                 onResetPlayed={() => setPlayedItems(new Set())}
                 onResetItemPlayed={(id) => setPlayedItems(prev => {
                   const next = new Set(prev);
                   next.delete(id);
                   return next;
                 })}
                 churchName={churchName}
                 setChurchName={setChurchName}
                  stickyAudioId={stickyAudioItem?.id}
                  onToggleSticky={handleToggleStickyAudio}
              />
            </div>
            
            <div className="flex-1 p-8 bg-white/95 overflow-y-auto relative custom-scrollbar flex flex-col z-0">
              {(activeTab === 'new_liturgy' || activeTab === 'edit_liturgy') ? (
                 <LiturgyEditor
                   libraryHandle={libraryHandle}
                   initialFile={selectedItem?.type === 'liturgy' && selectedItem?.fileHandle
                     ? { name: selectedItem.filename, handle: selectedItem.fileHandle }
                     : null
                   }
                   onSaved={(saved) => {
                     // Re-load the saved file into selectedItem
                     const load = async () => {
                       const f = await saved.handle.getFile();
                       const text = await f.text();
                       const parsed = parseLiturgyMarkdown(text);
                       const updated = {
                         type: 'liturgy',
                         id: saved.name,
                         filename: saved.name,
                         title: parsed.metadata.title || saved.name.replace('.md', ''),
                         slides: parsed.slides,
                         rawText: text,
                         fileHandle: saved.handle,
                       };
                       setSelectedItem(updated);
                       setActiveTab('Liturgy');
                     };
                     load();
                   }}
                   onDeleted={() => {
                     setSelectedItem(null);
                     setActiveTab('Liturgy');
                   }}
                   onRefresh={refreshLibrary}
                 />
              ) : activeTab === 'new_song' ? (
                 <SongEditor 
                   libraryHandle={libraryHandle} 
                   initialData={editingSong}
                   onSaved={() => {
                     setSelectedItem(null);
                     setEditingSong(null);
                     setActiveTab('Songs');
                   }} 
                 />
               ) : selectedItem?.type === 'slide_deck' || selectedItem?.type === 'image' ? (
                  <ImageArrayViewer 
                    images={selectedItem.images} 
                    currentIndex={activeSlideIndex} 
                    onSelectIndex={handleSetSlideIndex}
                    selectedIndices={selectedIndices}
                    onToggleSelection={(i) => {
                       const next = new Set(selectedIndices);
                       if (next.has(i)) next.delete(i);
                       else next.add(i);
                       setSelectedIndices(next);
                    }}
                    item={selectedItem}
                    isServiceItem={serviceItems.some(si => si.id === selectedItem?.id)}
                    onAddSelectedToService={handleAddToService}
                    onRemoveSelectedFromService={() => {
                        handleDeleteItem(selectedItem.id);
                    }}
                  />
               ) : selectedItem?.type === 'video' ? (
                  <div className="w-full h-full flex flex-col bg-[#F7F7F7] rounded-2xl border border-[#3D7B8C]/10 p-8 shadow-inner overflow-hidden relative">
                     {/* Header matches PreviewEditor */}
                     <div className="flex flex-col mb-6 border-b border-[#3D7B8C]/10/50 pb-4 gap-4">
                        <div className="flex items-center gap-3">
                           {activeTab !== 'Service' && (
                              <button 
                                 onClick={handleAddToService}
                                 className={`flex items-center justify-center h-10 gap-2 px-6 py-2 ${showAddedFeedback ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-[#3D7B8C] hover:bg-[#3D7B8C] shadow-blue-900/20'} text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg active:scale-95`}
                              >
                                 {showAddedFeedback ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
                                 {showAddedFeedback ? 'ADDED!' : 'Add to Service'}
                              </button>
                           )}
                           {selectedItem.isExternal && (
                             <a 
                               href={selectedItem.url} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               className="flex items-center gap-1.5 h-10 px-4 py-2 bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-700 hover:white rounded-xl border border-[#3D7B8C]/20/50 transition-all font-bold text-xs uppercase tracking-widest shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
                             >
                               <ExternalLink size={14} className="text-[#3D7B8C]" /> Open Source
                             </a>
                           )}
                        </div>
                        <div className="flex flex-col">
                           <h2 className="text-3xl font-extrabold text-[#1C355E] tracking-tight">{selectedItem.title}</h2>
                        </div>
                     </div>
                     
                     <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center">
                        {(selectedItem.isYouTube || selectedItem.isVimeo) ? (
                          <iframe 
                            src={selectedItem.url} 
                            className="w-full h-full rounded-lg" 
                            frameBorder="0" 
                            allow="autoplay; fullscreen; picture-in-picture; encrypted-media" 
                            allowFullScreen
                          />
                        ) : (
                          <video src={selectedItem.url} controls className="w-full h-full object-contain rounded-lg" />
                        )}
                     </div>
                  </div>
               ) : selectedItem?.type === 'audio' ? (
                   <div className="w-full h-full flex flex-col bg-[#F7F7F7] rounded-2xl border border-[#3D7B8C]/10 p-8 shadow-inner overflow-hidden relative">
                       {/* Header matches PreviewEditor */}
                       <div className="flex flex-col mb-6 border-b border-[#3D7B8C]/10/50 pb-4 gap-4">
                          <div className="flex items-center gap-3">
                             {activeTab !== 'Service' && (
                                <button 
                                   onClick={handleAddToService}
                                   className={`flex items-center justify-center h-10 gap-2 px-6 py-2 ${showAddedFeedback ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-[#3D7B8C] hover:bg-[#3D7B8C] shadow-blue-900/20'} text-white rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-lg active:scale-95`}
                                >
                                   {showAddedFeedback ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
                                   {showAddedFeedback ? 'ADDED TO SERVICE' : 'Add Audio to Service'}
                                </button>
                             )}
                          </div>
                          <div className="flex flex-col">
                             <h2 className="text-3xl font-extrabold text-[#1C355E] tracking-tight">{selectedItem.title}</h2>
                          </div>
                       </div>
                       
                       <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center">
                           <div className="flex flex-col items-center gap-8 max-w-2xl w-full">
                               <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center border border-purple-500/30">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                               </div>
                               
                               <CentralAudioPlayer 
                                   item={selectedItem}
                                   isLiveItem={liveItem?.id === selectedItem?.id}
                                   playbackStatus={playbackStatus}
                                   setPresentationPaused={setPresentationPaused}
                               />
                           </div>
                       </div>
                   </div>
               ) : selectedItem?.type === 'folder_explorer' ? (
                   <FolderExplorer 
                       folderName={selectedItem.title} 
                       handle={selectedItem.handle} 
                       onSelectItem={(f) => {
                           if (selectedItem._internalFileClick) {
                               selectedItem._internalFileClick({ ...f, isDirectory: f.isDirectory });
                           }
                       }} 
                       onBack={() => {
                          setSelectedItem(null);
                       }}
                   />
               ) : selectedItem?.isPpt || selectedItem?.isDocument ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-[#F7F7F7] rounded-2xl border-2 border-[#3D7B8C]/10 shadow-inner">
                    <h3 className="text-3xl font-extrabold mb-4 text-[#1C355E] tracking-widest">{selectedItem.title}</h3>
                    <p className="text-neutral-400 text-sm max-w-md font-medium leading-relaxed">Presentations and Document files cannot be natively controlled or paginated inside a web browser frame.<br/><br/>Please export your slides or pages as images (.jpg or .png) and drop them into the Images folder for native viewing, or use an external application alongside Presenter.</p>
                 </div>
              ) : (selectedItem?.slides || selectedItem?.isBibleBook) ? (
                  <PreviewEditor 
                    item={selectedItem} 
                    onUpdateItem={(newItem) => setSelectedItem(newItem)}
                    activeIndex={activeSlideIndex} 
                    linesPerSlide={selectedItem.type === 'bible' ? 1 : linesPerSlide}
                    selectedIndices={selectedIndices}
                    isServiceItem={serviceItems.some(si => si.id === selectedItem?.id)}
                    onToggleSelection={(idx) => {
                       const next = new Set(selectedIndices);
                       if (next.has(idx)) next.delete(idx);
                       else next.add(idx);
                       setSelectedIndices(next);
                    }}
                    onSelectIndex={handleSetSlideIndex} 
                    onEdit={(item) => {
                       if (item.type === 'song') {
                           setEditingSong(item);
                           setActiveTab('new_song');
                       } else if (item.type === 'liturgy') {
                           setActiveTab('edit_liturgy');
                       }
                    }}
                    onAddSelectedToService={handleAddToService}
                    onRemoveSelectedFromService={() => {
                      if (selectedIndices.size === 0) return;
                      const remainingSlides = selectedItem.slides.filter((_, idx) => !selectedIndices.has(idx));
                      
                      if (remainingSlides.length === 0) {
                        handleDeleteItem(selectedItem.id);
                      } else {
                        const updatedItem = { ...selectedItem, slides: remainingSlides };
                        setServiceItems(serviceItems.map(si => si.id === selectedItem.id ? updatedItem : si));
                        setSelectedItem(updatedItem);
                      }
                      setSelectedIndices(new Set());
                    }}
                    onChangeLinesPerSlide={(n) => {
                      setLinesPerSlide(n);
                        if (selectedItem?.rawText) {
                          let parsedSlides;
                          if (selectedItem.type === 'song') parsedSlides = parseSongMarkdown(selectedItem.rawText, n).slides;
                          else if (selectedItem.type === 'liturgy') parsedSlides = parseLiturgyMarkdown(selectedItem.rawText, n).slides;
                          else if (selectedItem.type === 'bible') parsedSlides = parseBibleText(selectedItem.rawText, selectedItem.reference || selectedItem.title, n);
                          
                          if (parsedSlides) {
                            setSelectedItem(prev => ({ ...prev, slides: parsedSlides }));
                            setActiveSlideIndex(0);
                            
                            // Update it in service list too if it's there
                            setServiceItems(prev => prev.map(si => 
                              si.id === selectedItem.id 
                                ? { ...si, slides: parsedSlides }
                                : si
                            ));
                          }
                        }
                    }}
                 />
              ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-30 pointer-events-none">
                    <h3 className="text-2xl font-black mb-3 tracking-widest text-neutral-400">NO MEDIA SELECTED</h3>
                    <p className="text-neutral-400 font-bold text-sm leading-loose">Use the tabs above to select content folders.<br/>Select an item to preview it, then click "Add to Service".</p>
                 </div>
              )}
            </div>
            
            <div className="w-[360px] border-l border-[#3D7B8C]/10/50 p-6 bg-white/50 shadow-2xl z-20 flex-shrink-0 overflow-y-auto custom-scrollbar">
               <LiveControl 
                 isLive={isLive} toggleLive={toggleLive}
                 isBlackScreen={isBlackScreen} setIsBlackScreen={setIsBlackScreen}
                 isShowLogo={isShowLogo} setIsShowLogo={setIsShowLogo}
                 
                 onPickLogo={setLogoUrl}
                 livePayload={livePayload}
                 remoteCommand={remoteCommand}
                 playbackStatus={playbackStatus}
                 presentationPaused={presentationPaused}
                 setPresentationPaused={setPresentationPaused}
                 isSyncingMedia={isSyncingMedia}
                 roomId={roomId}
                 musicFiles={musicFiles}
                 projectorConnected={projectorConnected}
              />
            </div>
          </main>
          
          {isSettingsOpen && (
            <SettingsView
             selectedMonitor={selectedMonitor}
             setSelectedMonitor={setSelectedMonitor}
              roomId={roomId}
              churchName={churchName}
              setChurchName={setChurchName}
              displayFont={displayFont}
              setDisplayFont={setDisplayFont}
              onChangeLibrary={() => {
                  handleChangeLibraryPath(); setIsSettingsOpen(false);
              }}
              onClose={() => setIsSettingsOpen(false)}
            />
          )}

         <ConfirmModal 
             isOpen={showClearConfirm}
             title="Clear Service Flow?"
             message="This will permanently remove all items from your current service. This action cannot be undone."
             onConfirm={() => {
                 setServiceItems([]);
                 setLiveItem(null);
                 setSelectedItem(null);
                 setShowClearConfirm(false);
              }}
             onCancel={() => setShowClearConfirm(false)}
             confirmText="Clear Everything"
          />
          <ConfirmModal 
             isOpen={showOfflineConfirm}
             title="End Live Broadcast?"
             message="This will close the main projector window and disconnect all network viewers immediately."
             onConfirm={executeGoOffline}
             onCancel={() => setShowOfflineConfirm(false)}
             confirmText="End Broadcast"
          />
      </div>
    </DragDropZone>
  )
}

export default App
