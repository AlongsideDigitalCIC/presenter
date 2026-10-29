import { isTauri } from './utils/env.js';
import { useState, useEffect, useRef, useCallback } from 'react'
import { ExternalLink, Check, Settings, Plus } from 'lucide-react'
import FileSystemSetup from './components/FileSystemSetup'
import { clearStoredDirectoryHandle } from './utils/fileSystem';
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
import { reResolveMedia, formatVerseRanges, getYoutubeEmbedUrl } from './utils/media'
import OutputScreen from './components/OutputScreen'
import CentralAudioPlayer from './components/CentralAudioPlayer'
import RemoteControl from './components/RemoteControl'
import { addSongPlay } from './services/historyService'
import { resolveTargetMonitor } from './utils/monitorUtils'
import { sendTelemetryPing } from './services/telemetry'

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
        <div className="w-full h-full flex flex-col items-center bg-[#FAF6F0] rounded-2xl border border-[#E4E1DA] p-8 overflow-hidden relative">
             <div className="absolute top-4 left-4 z-10 text-[10px] font-bold uppercase tracking-widest text-[#526075] flex items-center gap-2">
                 <button onClick={onBack} className="hover:bg-[#F0EBE1] p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[#3D7B8C]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    BACK
                 </button>
                 <span className="text-[#E4E1DA] mx-1">|</span>
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3D7B8C]"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                {folderName}
             </div>
               <div className="w-full h-full pt-12 flex flex-col">
                   <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                       {isLoading && <div className="text-[#526075] italic p-4 text-center text-sm animate-pulse">Scanning folder...</div>}
                       
                       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                           {!isLoading && files.map(f => (
                               <div 
                                   key={f.name}
                                   onClick={() => onSelectItem(f)}
                                   className="group aspect-square p-4 bg-white border border-[#E4E1DA] rounded-2xl hover:bg-[#FAF6F0] hover:border-[#3D7B8C] cursor-pointer flex flex-col items-center justify-center gap-3 transition-colors text-sm text-[#1C355E] shadow-sm"
                               >
                                   {f.isDirectory 
                                       ? <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#3D7B8C] transition-colors flex-shrink-0"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-1.2-1.8A2 2 0 0 0 7.55 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                                       : <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#526075] group-hover:text-[#1C355E] transition-colors flex-shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                   }
                                   <span className="truncate w-full text-center text-[11px] font-medium leading-tight px-1">{f.name}</span>
                               </div>
                           ))}
                       </div>
                       
                       {!isLoading && files.length === 0 && <div className="text-[#526075] italic p-4 text-center text-sm col-span-full">Empty Folder</div>}
                   </div>
               </div>
        </div>
    );
}

const initialLibraryPath = localStorage.getItem('presenter-library-path');
const initialHandle = (isTauri() && initialLibraryPath) ? new TauriDirectoryHandle(initialLibraryPath.replace(/\\/g, '/'), 'Presenter') : null;

function App() {
  const [libraryHandle, setLibraryHandle] = useState(initialHandle)
  
  const handleChangeLibraryPath = async () => {
      try {
         await clearStoredDirectoryHandle();
         setLibraryHandle(null);
      } catch (err) {
         console.error('Failed to clear library handle', err);
      }
  };

  useEffect(() => {
    if (isTauri() && libraryHandle?.path) {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('allow_library_folder', { path: libraryHandle.path }).catch(() => {});
      }).catch(() => {});
    }
  }, [libraryHandle]);

  const projectorWindowRef = useRef(null);
  const wsRef = useRef(null);
  const pinRateLimitRef = useRef(new Map()); // clientId -> { attempts: number, lockedUntil: number }
  const livePayloadRef = useRef(null);
  const serviceItemsRef = useRef([]);
  const projectorTimeoutRef = useRef(null);
  
  // Routing State
  const params = new URLSearchParams(window.location.search);
  const isProjectorView = !!params.get('projector');
  const isNetworkView = !!params.get('network');
  const [projectorConnected, setProjectorConnected] = useState(false);
  const remoteControlRoom = (() => {
      if (params.has('remoteControl')) {
          return params.get('remoteControl') || 'default';
      }
      if (!isTauri() && !params.get('network') && !params.get('projector')) {
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          if (!isLocalhost || window.location.pathname.includes('app')) {
              return 'default';
          }
      }
      return null;
  })();
  const roomId = null;
  const [networkPayload, setNetworkPayload] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  
  // App Global Data State
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('Service');
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [serviceItems, setServiceItems] = useState([]); 
  useEffect(() => { 
    serviceItemsRef.current = serviceItems; 
    if (isLoaded) {
      import('idb-keyval').then(({ set }) => {
        set('presenter_service_state', serviceItems).catch(err => {
          console.warn("Failed to auto-save service state", err);
        });
      }).catch(() => {});
    }
  }, [serviceItems, isLoaded]);
  const [playedItems, setPlayedItems] = useState(new Set());
  const [stickyAudioItem, setStickyAudioItem] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [linesPerSlide, setLinesPerSlide] = useState(2);
  const [liturgyLinesPerSlide, setLiturgyLinesPerSlide] = useState(2);
  const [bibleVersesPerSlide, setBibleVersesPerSlide] = useState(1);
  const [presentationPaused, setPresentationPaused] = useState(true);
  const [slideshowInterval, setSlideshowInterval] = useState(5);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);

  // Global Projection State
  const [isLive, setIsLive] = useState(false);
  const [isBlackScreen, setIsBlackScreen] = useState(false);
  const [isShowLogo, setIsShowLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [livePayload, setLivePayload] = useState(null);
  const [playbackStatus, setPlaybackStatus] = useState({ time: 0, duration: 0, paused: undefined });
  const [churchName, setChurchName] = useState("Alongside Digital - Presenter");
  const [displayFont, setDisplayFont] = useState("Inter");

  // Screen Overlays State (Ad Hoc Announcements & Countdown Timer)
  const [announcement, setAnnouncement] = useState({
    active: false,
    text: '',
    autoDismissSeconds: 0,
    timestamp: null
  });

  const [countdown, setCountdown] = useState({
    active: false,
    running: false,
    targetTimeMs: null,
    initialSeconds: 300,
    remainingSeconds: 300,
    title: 'Service starts in',
    endMessage: 'Welcome! Service starting shortly'
  });

  const [overlaySettings, setOverlaySettings] = useState({
    announcement: {
      position: 'bottom', // 'bottom' | 'top' | 'floating'
      bgColor: '#1C355E',
      textColor: '#FFFFFF',
      bgOpacity: 0.95,
      textSize: 1.0,
      fontSize: 'medium', // 'small' | 'medium' | 'large'
      bannerStyle: 'full-width' // 'full-width' | 'rounded-pill'
    },
    countdown: {
      position: 'center', // 'center' | 'bottom-right' | 'bottom-left' | 'top-right'
      style: 'boxed', // 'boxed' | 'clean' | 'minimal'
      bgColor: '#1C355E',
      textColor: '#FFFFFF',
      bgOpacity: 0.85,
      defaultMinutes: 5,
      defaultTitle: 'Service starts in',
      endMessage: 'Welcome! Service starting shortly',
      headerTextSize: 1.4,
      digitsSize: 1.0,
      textSize: 1.25
    }
  });

  // Auto-dismiss handler for announcements
  useEffect(() => {
    if (!announcement?.active || !announcement?.autoDismissSeconds || announcement.autoDismissSeconds <= 0) return;
    const timer = setTimeout(() => {
      setAnnouncement(prev => ({ ...prev, active: false }));
    }, announcement.autoDismissSeconds * 1000);
    return () => clearTimeout(timer);
  }, [announcement?.active, announcement?.timestamp, announcement?.autoDismissSeconds]);

  const handleUpdateOverlaySettings = (updater) => {
    setOverlaySettings(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      import('idb-keyval').then(({ set }) => {
        set('presenter_overlay_settings', next).catch(() => {});
      }).catch(() => {});
      return next;
    });
  };
  const [displaySettings, setDisplaySettings] = useState({
    transitionEnabled: true,
    transitionType: 'crossfade', // 'crossfade' | 'fade_through' | 'slide_left' | 'float_up'
    transitionDuration: 400,
    textScale: 1,
    backgrounds: {
      song: {
        bgType: 'color', // 'color' | 'image' | 'video'
        bgColor: '#000000',
        bgImageUrl: null,
        bgVideoUrl: null,
        bgDim: 0.3,
        bgVideoLoop: true,
      },
      bible: {
        bgType: 'color',
        bgColor: '#161d2f',
        bgImageUrl: null,
        bgVideoUrl: null,
        bgDim: 0.3,
        bgVideoLoop: true,
      },
      liturgy: {
        bgType: 'color',
        bgColor: '#111827',
        bgImageUrl: null,
        bgVideoUrl: null,
        bgDim: 0.3,
        bgVideoLoop: true,
      },
      countdown: {
        bgType: 'none', // 'none' | 'color' | 'image' | 'video'
        bgColor: '#0B132B',
        bgImageUrl: null,
        bgVideoUrl: null,
        bgDim: 0.3,
        bgVideoLoop: true,
      }
    },
    // Top-level fallbacks
    bgType: 'color',
    bgColor: '#000000',
    bgImageUrl: null,
    bgVideoUrl: null,
    bgDim: 0.3,
    bgVideoLoop: true
  });
  const [ccliSettings, setCcliSettings] = useState({
    licenseNumber: '',
    displayMode: 'first_slide', // 'first_slide' | 'last_slide' | 'both' | 'all' | 'off'
    position: 'bottom-left' // 'bottom-left' | 'bottom-center' | 'bottom-right'
  });
  const [remotePassword, setRemotePassword] = useState('');
  const remotePasswordRef = useRef('');
  const authenticatedClientsRef = useRef(new Set());
  const backgroundBlobsRef = useRef({
    songVidBlob: null,
    songImgBlob: null,
    bibleVidBlob: null,
    bibleImgBlob: null,
    liturgyVidBlob: null,
    liturgyImgBlob: null,
    countdownVidBlob: null,
    countdownImgBlob: null
  });

  const handleUpdateCcliSettings = (updater) => {
    setCcliSettings(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      import('idb-keyval').then(({ set }) => {
        set('presenter_ccli_settings', next);
      }).catch(() => {});
      return next;
    });
  };

  useEffect(() => {
    remotePasswordRef.current = remotePassword;
  }, [remotePassword]);

  // System Hooks
  const [systemTrigger, refreshLibrary] = useFileSystemWatcher(libraryHandle);
  const searchState = useSearchIndexer(libraryHandle, systemTrigger);
  const folderFiles = useFolderContents(libraryHandle, activeTab, systemTrigger);
  const musicFiles = useFolderContents(libraryHandle, 'Music', systemTrigger);

  // Handshake and Init
  useEffect(() => {
    // Fire anonymous usage ping silently in background (offline-tolerant)
    sendTelemetryPing();

    const init = async () => {
      try {
        // 1. Directory Handle (Synchronous LocalStorage was handled above)
        let handle = libraryHandle;

        // 2. IDB State Restoration
        try {
            const { get } = await import('idb-keyval');
            
            if (!handle) {
                if (isTauri()) {
                    const idbPath = await get('presenter_library_path_idb');
                    if (idbPath) {
                        localStorage.setItem('presenter-library-path', idbPath);
                        handle = new TauriDirectoryHandle(idbPath.replace(/\\/g, '/'), 'Presenter');
                        setLibraryHandle(handle);
                    }
                } else {
                    const browserHandle = await get('presenter_browser_directory_handle');
                    if (browserHandle) {
                        try {
                            const mode = { mode: 'readwrite' };
                            if ((await browserHandle.queryPermission?.(mode)) === 'granted') {
                                handle = browserHandle;
                                setLibraryHandle(handle);
                            }
                        } catch { /* ignore */ }
                    }
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

            const savedPassword = await get('presenter_remote_password');
            if (savedPassword) {
                setRemotePassword(savedPassword);
                remotePasswordRef.current = savedPassword;
            }

            const savedFont = await get('presenter_display_font');
            if (savedFont) setDisplayFont(savedFont);

            const savedChurch = await get('presenter_church_name');
            if (savedChurch) setChurchName(savedChurch);

            const savedDisplay = await get('presenter_display_settings');
            const songImgBlob = (await get('presenter_bg_image_blob_song')) || (await get('presenter_bg_image_blob'));
            const songVidBlob = (await get('presenter_bg_video_blob_song')) || (await get('presenter_bg_video_blob'));
            const bibleImgBlob = await get('presenter_bg_image_blob_bible');
            const bibleVidBlob = await get('presenter_bg_video_blob_bible');
            const liturgyImgBlob = await get('presenter_bg_image_blob_liturgy');
            const liturgyVidBlob = await get('presenter_bg_video_blob_liturgy');
            const countdownImgBlob = await get('presenter_bg_image_blob_countdown');
            const countdownVidBlob = await get('presenter_bg_video_blob_countdown');

            backgroundBlobsRef.current = {
              songVidBlob,
              songImgBlob,
              bibleVidBlob,
              bibleImgBlob,
              liturgyVidBlob,
              liturgyImgBlob,
              countdownVidBlob,
              countdownImgBlob
            };

            const makeUrl = (blob) => {
              if (!blob) return null;
              try { return URL.createObjectURL(blob); } catch { return null; }
            };

            const songImgUrl = makeUrl(songImgBlob);
            const songVidUrl = makeUrl(songVidBlob);
            const bibleImgUrl = makeUrl(bibleImgBlob);
            const bibleVidUrl = makeUrl(bibleVidBlob);
            const liturgyImgUrl = makeUrl(liturgyImgBlob);
            const liturgyVidUrl = makeUrl(liturgyVidBlob);
            const countdownImgUrl = makeUrl(countdownImgBlob);
            const countdownVidUrl = makeUrl(countdownVidBlob);

            const defaultSong = {
              bgType: savedDisplay?.backgrounds?.song?.bgType || savedDisplay?.bgType || 'color',
              bgColor: savedDisplay?.backgrounds?.song?.bgColor || savedDisplay?.bgColor || '#000000',
              bgImageUrl: songImgUrl,
              bgVideoUrl: songVidUrl,
              bgDim: savedDisplay?.backgrounds?.song?.bgDim ?? savedDisplay?.bgDim ?? 0.3,
              bgVideoLoop: savedDisplay?.backgrounds?.song?.bgVideoLoop ?? savedDisplay?.bgVideoLoop ?? true,
            };

            const defaultBible = {
              bgType: savedDisplay?.backgrounds?.bible?.bgType || 'color',
              bgColor: savedDisplay?.backgrounds?.bible?.bgColor || '#161d2f',
              bgImageUrl: bibleImgUrl,
              bgVideoUrl: bibleVidUrl,
              bgDim: savedDisplay?.backgrounds?.bible?.bgDim ?? 0.3,
              bgVideoLoop: savedDisplay?.backgrounds?.bible?.bgVideoLoop ?? true,
            };

            const defaultLiturgy = {
              bgType: savedDisplay?.backgrounds?.liturgy?.bgType || 'color',
              bgColor: savedDisplay?.backgrounds?.liturgy?.bgColor || '#111827',
              bgImageUrl: liturgyImgUrl,
              bgVideoUrl: liturgyVidUrl,
              bgDim: savedDisplay?.backgrounds?.liturgy?.bgDim ?? 0.3,
              bgVideoLoop: savedDisplay?.backgrounds?.liturgy?.bgVideoLoop ?? true,
            };

            const defaultCountdown = {
              bgType: savedDisplay?.backgrounds?.countdown?.bgType || 'none',
              bgColor: savedDisplay?.backgrounds?.countdown?.bgColor || '#0B132B',
              bgImageUrl: countdownImgUrl,
              bgVideoUrl: countdownVidUrl,
              bgDim: savedDisplay?.backgrounds?.countdown?.bgDim ?? 0.3,
              bgVideoLoop: savedDisplay?.backgrounds?.countdown?.bgVideoLoop ?? true,
            };

            setDisplaySettings(prev => ({
              ...prev,
              transitionEnabled: savedDisplay?.transitionEnabled ?? prev.transitionEnabled,
              transitionType: savedDisplay?.transitionType || prev.transitionType,
              transitionDuration: savedDisplay?.transitionDuration || prev.transitionDuration,
              textScale: savedDisplay?.textScale ?? prev.textScale ?? 1,
              backgrounds: {
                song: defaultSong,
                bible: defaultBible,
                liturgy: defaultLiturgy,
                countdown: defaultCountdown
              },
              bgType: defaultSong.bgType,
              bgColor: defaultSong.bgColor,
              bgImageUrl: defaultSong.bgImageUrl,
              bgVideoUrl: defaultSong.bgVideoUrl,
              bgDim: defaultSong.bgDim,
              bgVideoLoop: defaultSong.bgVideoLoop
            }));

            const savedCcli = await get('presenter_ccli_settings');
            if (savedCcli) {
              setCcliSettings(prev => ({ ...prev, ...savedCcli }));
            }

            const savedOverlays = await get('presenter_overlay_settings');
            if (savedOverlays) {
              setOverlaySettings(prev => ({
                announcement: { ...prev.announcement, ...(savedOverlays.announcement || {}) },
                countdown: { ...prev.countdown, ...(savedOverlays.countdown || {}) }
              }));
            }

            const savedLines = await get('presenter_lines_settings');
            if (savedLines) {
              if (savedLines.song) setLinesPerSlide(savedLines.song);
              if (savedLines.liturgy) setLiturgyLinesPerSlide(savedLines.liturgy);
              if (savedLines.bible) setBibleVersesPerSlide(savedLines.bible);
            }
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

  const handleUpdateDisplaySettings = (updater, category = null) => {
    setDisplaySettings(prev => {
      let updated;
      if (category) {
        const currentCatBg = prev.backgrounds?.[category] || {
          bgType: 'color',
          bgColor: '#000000',
          bgImageUrl: null,
          bgVideoUrl: null,
          bgDim: 0.3,
          bgVideoLoop: true
        };
        const updatedCat = typeof updater === 'function' ? updater(currentCatBg) : { ...currentCatBg, ...updater };
        const newBackgrounds = {
          ...(prev.backgrounds || {}),
          [category]: updatedCat
        };
        updated = {
          ...prev,
          backgrounds: newBackgrounds
        };
        if (category === 'song') {
          updated.bgType = updatedCat.bgType;
          updated.bgColor = updatedCat.bgColor;
          updated.bgDim = updatedCat.bgDim;
          updated.bgVideoLoop = updatedCat.bgVideoLoop;
          updated.bgImageUrl = updatedCat.bgImageUrl;
          updated.bgVideoUrl = updatedCat.bgVideoUrl;
        }
      } else {
        updated = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      }

      // Persist serializable state to IDB
      import('idb-keyval').then(({ set }) => {
        set('presenter_display_settings', {
          bgType: updated.bgType,
          bgColor: updated.bgColor,
          bgDim: updated.bgDim,
          bgVideoLoop: updated.bgVideoLoop,
          transitionEnabled: updated.transitionEnabled,
          transitionType: updated.transitionType,
          transitionDuration: updated.transitionDuration,
          textScale: updated.textScale ?? 1,
          backgrounds: {
            song: {
              bgType: updated.backgrounds?.song?.bgType || 'color',
              bgColor: updated.backgrounds?.song?.bgColor || '#000000',
              bgDim: updated.backgrounds?.song?.bgDim ?? 0.3,
              bgVideoLoop: updated.backgrounds?.song?.bgVideoLoop ?? true,
            },
            bible: {
              bgType: updated.backgrounds?.bible?.bgType || 'color',
              bgColor: updated.backgrounds?.bible?.bgColor || '#161d2f',
              bgDim: updated.backgrounds?.bible?.bgDim ?? 0.3,
              bgVideoLoop: updated.backgrounds?.bible?.bgVideoLoop ?? true,
            },
            liturgy: {
              bgType: updated.backgrounds?.liturgy?.bgType || 'color',
              bgColor: updated.backgrounds?.liturgy?.bgColor || '#111827',
              bgDim: updated.backgrounds?.liturgy?.bgDim ?? 0.3,
              bgVideoLoop: updated.backgrounds?.liturgy?.bgVideoLoop ?? true,
            },
            countdown: {
              bgType: updated.backgrounds?.countdown?.bgType || 'none',
              bgColor: updated.backgrounds?.countdown?.bgColor || '#0B132B',
              bgDim: updated.backgrounds?.countdown?.bgDim ?? 0.3,
              bgVideoLoop: updated.backgrounds?.countdown?.bgVideoLoop ?? true,
            }
          }
        });
      });
      return updated;
    });
  };

  const notifyBgUpdate = (category = null, mediaType = null, blob = null) => {
    try {
      const bc = new BroadcastChannel('presenter-projector-hub');
      if (category && mediaType) {
        bc.postMessage({ type: 'bg-blob-update', category, mediaType, blob, blobs: backgroundBlobsRef.current });
      } else {
        bc.postMessage({ type: 'bg-update', blobs: backgroundBlobsRef.current });
      }
      bc.close();
    } catch { /* ignore */ }
  };

  const handleSaveBackgroundImage = async (file, category = 'song') => {
    if (category === 'song') backgroundBlobsRef.current.songImgBlob = file;
    if (category === 'bible') backgroundBlobsRef.current.bibleImgBlob = file;
    if (category === 'liturgy') backgroundBlobsRef.current.liturgyImgBlob = file;
    if (category === 'countdown') backgroundBlobsRef.current.countdownImgBlob = file;

    const prevUrl = displaySettings.backgrounds?.[category]?.bgImageUrl;
    if (prevUrl && prevUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(prevUrl); } catch { /* ignore */ }
    }
    const url = URL.createObjectURL(file);
    const { set } = await import('idb-keyval');
    await set(`presenter_bg_image_blob_${category}`, file);
    if (category === 'song') {
      await set('presenter_bg_image_blob', file);
    }
    handleUpdateDisplaySettings(prevCat => ({
      ...prevCat,
      bgType: 'image',
      bgImageUrl: url
    }), category);
    notifyBgUpdate(category, 'image', file);
  };

  const handleClearBackgroundImage = async (category = 'song') => {
    if (category === 'song') backgroundBlobsRef.current.songImgBlob = null;
    if (category === 'bible') backgroundBlobsRef.current.bibleImgBlob = null;
    if (category === 'liturgy') backgroundBlobsRef.current.liturgyImgBlob = null;
    if (category === 'countdown') backgroundBlobsRef.current.countdownImgBlob = null;

    const prevUrl = displaySettings.backgrounds?.[category]?.bgImageUrl;
    if (prevUrl && prevUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(prevUrl); } catch { /* ignore */ }
    }
    const { del } = await import('idb-keyval');
    await del(`presenter_bg_image_blob_${category}`);
    if (category === 'song') {
      await del('presenter_bg_image_blob');
    }
    handleUpdateDisplaySettings(prevCat => ({
      ...prevCat,
      bgImageUrl: null,
      bgType: prevCat.bgType === 'image' ? (category === 'countdown' ? 'none' : 'color') : prevCat.bgType
    }), category);
    notifyBgUpdate(category, 'image', null);
  };

  const handleSaveBackgroundVideo = async (file, category = 'song') => {
    if (category === 'song') backgroundBlobsRef.current.songVidBlob = file;
    if (category === 'bible') backgroundBlobsRef.current.bibleVidBlob = file;
    if (category === 'liturgy') backgroundBlobsRef.current.liturgyVidBlob = file;
    if (category === 'countdown') backgroundBlobsRef.current.countdownVidBlob = file;

    const prevUrl = displaySettings.backgrounds?.[category]?.bgVideoUrl;
    if (prevUrl && prevUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(prevUrl); } catch { /* ignore */ }
    }
    const url = URL.createObjectURL(file);
    const { set } = await import('idb-keyval');
    await set(`presenter_bg_video_blob_${category}`, file);
    if (category === 'song') {
      await set('presenter_bg_video_blob', file);
    }
    handleUpdateDisplaySettings(prevCat => ({
      ...prevCat,
      bgType: 'video',
      bgVideoUrl: url
    }), category);
    notifyBgUpdate(category, 'video', file);
  };

  const handleClearBackgroundVideo = async (category = 'song') => {
    if (category === 'song') backgroundBlobsRef.current.songVidBlob = null;
    if (category === 'bible') backgroundBlobsRef.current.bibleVidBlob = null;
    if (category === 'liturgy') backgroundBlobsRef.current.liturgyVidBlob = null;
    if (category === 'countdown') backgroundBlobsRef.current.countdownVidBlob = null;

    const prevUrl = displaySettings.backgrounds?.[category]?.bgVideoUrl;
    if (prevUrl && prevUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(prevUrl); } catch { /* ignore */ }
    }
    const { del } = await import('idb-keyval');
    await del(`presenter_bg_video_blob_${category}`);
    if (category === 'song') {
      await del('presenter_bg_video_blob');
    }
    handleUpdateDisplaySettings(prevCat => ({
      ...prevCat,
      bgVideoUrl: null,
      bgType: prevCat.bgType === 'video' ? (category === 'countdown' ? 'none' : 'color') : prevCat.bgType
    }), category);
    notifyBgUpdate(category, 'video', null);
  };

  const handleApplyBackgroundToAll = async (sourceCategory) => {
    const sourceBg = displaySettings.backgrounds?.[sourceCategory] || {
      bgType: displaySettings.bgType || 'color',
      bgColor: displaySettings.bgColor || '#000000',
      bgImageUrl: displaySettings.bgImageUrl,
      bgVideoUrl: displaySettings.bgVideoUrl,
      bgDim: displaySettings.bgDim,
      bgVideoLoop: displaySettings.bgVideoLoop
    };

    const { get, set } = await import('idb-keyval');
    const sourceImgBlob = (await get(`presenter_bg_image_blob_${sourceCategory}`)) || (sourceCategory === 'song' ? await get('presenter_bg_image_blob') : null);
    const sourceVidBlob = (await get(`presenter_bg_video_blob_${sourceCategory}`)) || (sourceCategory === 'song' ? await get('presenter_bg_video_blob') : null);

    const categories = ['song', 'bible', 'liturgy'];
    for (const cat of categories) {
      if (sourceImgBlob) await set(`presenter_bg_image_blob_${cat}`, sourceImgBlob);
      if (sourceVidBlob) await set(`presenter_bg_video_blob_${cat}`, sourceVidBlob);
    }
    if (sourceImgBlob) await set('presenter_bg_image_blob', sourceImgBlob);
    if (sourceVidBlob) await set('presenter_bg_video_blob', sourceVidBlob);

    backgroundBlobsRef.current = {
      ...backgroundBlobsRef.current,
      songVidBlob: sourceVidBlob,
      bibleVidBlob: sourceVidBlob,
      liturgyVidBlob: sourceVidBlob,
      songImgBlob: sourceImgBlob,
      bibleImgBlob: sourceImgBlob,
      liturgyImgBlob: sourceImgBlob
    };

    handleUpdateDisplaySettings(prev => ({
      ...prev,
      backgrounds: {
        ...(prev.backgrounds || {}),
        song: { ...sourceBg },
        bible: { ...sourceBg },
        liturgy: { ...sourceBg }
      },
      bgType: sourceBg.bgType,
      bgColor: sourceBg.bgColor,
      bgImageUrl: sourceBg.bgImageUrl,
      bgVideoUrl: sourceBg.bgVideoUrl,
      bgDim: sourceBg.bgDim,
      bgVideoLoop: sourceBg.bgVideoLoop
    }));
    notifyBgUpdate();
  };

  // Self-Healing Protocol: Orphaned Blob Resolution
  // Shouts a signal heavily tying the lifecycle of popups to this exact dashboard instance. 
  // If we refresh, popups must reboot to maintain Chrome Blob access scopes.
  useEffect(() => {
     if (isProjectorView || isNetworkView || remoteControlRoom) return;
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
    if (isProjectorView || isNetworkView || remoteControlRoom) return;
    
    let reconnectTimeout;
    const connect = () => {
        let ws = new WebSocket(`ws://127.0.0.1:5179`);
        wsRef.current = ws;

        ws.onopen = async () => {
          if (isTauri()) {
            try {
              const { invoke } = await import('@tauri-apps/api/core');
              const token = await invoke('get_master_token');
              if (token && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'master_register', token }));
              }
            } catch (err) {
              console.error("Failed to register master token:", err);
            }
          }
        };
        
        ws.onmessage = async (event) => {
           if (event.data instanceof Blob) return; // Master doesn't need to process blobs sent by itself
           
           try {
               const data = JSON.parse(event.data);
               const currentPin = (remotePasswordRef.current || '').trim();
               const isPinSet = currentPin.length > 0;

               if (data.type === 'request_state') {
                   const clientId = data.clientId;
                   const isLiveViewer = data.role === 'live_viewer';
                   const isAuthed = isLiveViewer || !isPinSet || (clientId && authenticatedClientsRef.current.has(clientId));

                   if (isPinSet && !isAuthed) {
                       ws.send(JSON.stringify({
                           type: 'auth_status',
                           targetClientId: clientId,
                           pinRequired: true,
                           authenticated: false
                       }));
                       return;
                   }

                   if (clientId) {
                       ws.send(JSON.stringify({
                           type: 'auth_status',
                           targetClientId: clientId,
                           pinRequired: isPinSet,
                           authenticated: true
                       }));
                   }

                   const minItems = (serviceItemsRef.current || []).map(i => ({ id: i.id, type: i.type, title: i.title, filename: i.filename }));
                   const minPayload = livePayloadRef.current ? { ...livePayloadRef.current } : { isLive: false };
                   delete minPayload.liveItem;
                   ws.send(JSON.stringify({ type: 'state', payload: minPayload, serviceItems: minItems }));
                   setTriggerMediaSync(prev => prev + 1);
               } else if (data.type === 'auth_verify') {
                   const clientId = data.clientId;
                   const submittedPin = (data.pin || '').trim();

                   const clientLimit = clientId ? (pinRateLimitRef.current.get(clientId) || { attempts: 0, lockedUntil: 0 }) : null;
                   if (clientLimit && clientLimit.lockedUntil > Date.now()) {
                       const remainingMins = Math.ceil((clientLimit.lockedUntil - Date.now()) / 60000);
                       ws.send(JSON.stringify({
                           type: 'auth_status',
                           targetClientId: clientId,
                           pinRequired: true,
                           authenticated: false,
                           error: `Too many failed attempts. Try again in ${remainingMins} minute${remainingMins > 1 ? 's' : ''}.`
                       }));
                       return;
                   }

                   if (!isPinSet || submittedPin === currentPin) {
                       if (clientId) {
                           authenticatedClientsRef.current.add(clientId);
                           pinRateLimitRef.current.delete(clientId);
                       }
                       ws.send(JSON.stringify({
                           type: 'auth_status',
                           targetClientId: clientId,
                           pinRequired: isPinSet,
                           authenticated: true,
                           success: true
                       }));

                       const minItems = (serviceItemsRef.current || []).map(i => ({ id: i.id, type: i.type, title: i.title, filename: i.filename }));
                       const minPayload = livePayloadRef.current ? { ...livePayloadRef.current } : { isLive: false };
                       delete minPayload.liveItem;
                       ws.send(JSON.stringify({ type: 'state', payload: minPayload, serviceItems: minItems }));
                       if (livePayloadRef.current) {
                           setTriggerMediaSync(prev => prev + 1);
                       }
                   } else {
                       if (clientId) {
                           const attempts = (clientLimit?.attempts || 0) + 1;
                           const lockedUntil = attempts >= 5 ? Date.now() + 5 * 60 * 1000 : 0;
                           pinRateLimitRef.current.set(clientId, { attempts, lockedUntil });
                       }
                       ws.send(JSON.stringify({
                           type: 'auth_status',
                           targetClientId: clientId,
                           pinRequired: true,
                           authenticated: false,
                           error: clientLimit && clientLimit.attempts >= 4 ? 'Too many failed attempts. Locked out for 5 minutes.' : 'Incorrect PIN'
                       }));
                   }
               } else if (data.type === 'remote_command') {
                   if (isPinSet) {
                       const isAuthed = data.clientId && authenticatedClientsRef.current.has(data.clientId);
                       if (!isAuthed) {
                           console.warn("Unauthorized remote command blocked:", data.command);
                           if (data.clientId) {
                               ws.send(JSON.stringify({
                                   type: 'auth_status',
                                   targetClientId: data.clientId,
                                   pinRequired: true,
                                   authenticated: false,
                                   error: 'PIN authentication required'
                               }));
                           }
                           return;
                       }
                   }

                   const bc = new BroadcastChannel('presenter-remote-commands');
                   bc.postMessage({ type: 'remote_command', ...data });
                   bc.close();
               }
           } catch {
               // ignore invalid message
           }
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

    // Persist chosen line/verse counts across sessions
    useEffect(() => {
      if (!isLoaded) return;
      import('idb-keyval').then(({ set }) => {
        set('presenter_lines_settings', {
          song: linesPerSlide,
          liturgy: liturgyLinesPerSlide,
          bible: bibleVersesPerSlide
        }).catch(() => {});
      }).catch(() => {});
    }, [isLoaded, linesPerSlide, liturgyLinesPerSlide, bibleVersesPerSlide]);

    // Live Re-sharding: Automatically re-shard songs, liturgy, and bibles when slide chunking settings change
    useEffect(() => {
      if (!isLoaded) return;
      
      const reShard = (item) => {
         if ((item?.type === 'song' || item?.type === 'liturgy' || item?.type === 'bible') && item.rawText) {
            if (item.type === 'song') {
                const lps = item.linesPerSlide || linesPerSlide;
                const parsedSlides = parseSongMarkdown(item.rawText, lps, item.arrangement).slides;
                return { ...item, linesPerSlide: lps, slides: parsedSlides };
            } else if (item.type === 'liturgy') {
                const lps = item.linesPerSlide || liturgyLinesPerSlide;
                const parsedSlides = parseLiturgyMarkdown(item.rawText, lps).slides;
                return { ...item, linesPerSlide: lps, slides: parsedSlides };
            } else if (item.type === 'bible') {
                const vps = item.versesPerSlide || bibleVersesPerSlide || 1;
                const parsedSlides = parseBibleText(item.rawText, item.reference || item.title, vps);
                return { ...item, versesPerSlide: vps, slides: parsedSlides };
            }
         }
         return item;
      };

      if (selectedItem) setSelectedItem(prev => reShard(prev));
      if (liveItem) setLiveItem(prev => reShard(prev));
    }, [linesPerSlide, liturgyLinesPerSlide, bibleVersesPerSlide]);


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
  const uploadedUrlsRef = useRef(new Set());
  const lastTriggerSyncRef = useRef(0);
  useEffect(() => {
    let isCancelled = false;
    const syncMedia = async () => {
      if (triggerMediaSync !== lastTriggerSyncRef.current) {
        lastTriggerSyncRef.current = triggerMediaSync;
        uploadedUrlsRef.current.clear();
      }

      const urlsToSync = [];
      const enqueueBlob = (u) => {
        if (typeof u === 'string' && u.startsWith('blob:') && !urlsToSync.includes(u)) {
          urlsToSync.push(u);
        }
      };

      if (isShowLogo && logoUrl?.startsWith('blob:')) enqueueBlob(logoUrl);
      if (liveItem?.url?.startsWith('blob:') && liveItem.type !== 'audio') {
        enqueueBlob(liveItem.url);
      } else if (liveItem?.type === 'image' || liveItem?.type === 'slide_deck') {
        const img = liveItem.images?.[liveSlideIndex];
        if (img?.url?.startsWith('blob:')) enqueueBlob(img.url);
      }

      // Sync active category background media (song / bible / liturgy) for Network Live Viewers
      if (liveItem?.type === 'song' || liveItem?.type === 'bible' || liveItem?.type === 'liturgy') {
        const catBg = displaySettings.backgrounds?.[liveItem.type] || {
          bgImageUrl: displaySettings.bgImageUrl,
          bgVideoUrl: displaySettings.bgVideoUrl
        };
        if (catBg?.bgImageUrl) enqueueBlob(catBg.bgImageUrl);
        if (catBg?.bgVideoUrl) enqueueBlob(catBg.bgVideoUrl);
      }

      // Sync all configured category backgrounds in displaySettings
      if (displaySettings.backgrounds && typeof displaySettings.backgrounds === 'object') {
        ['song', 'bible', 'liturgy', 'countdown'].forEach(c => {
          const b = displaySettings.backgrounds[c];
          if (b?.bgImageUrl) enqueueBlob(b.bgImageUrl);
          if (b?.bgVideoUrl) enqueueBlob(b.bgVideoUrl);
        });
      }

      // Sync global fallback backgrounds
      if (displaySettings.bgImageUrl) enqueueBlob(displaySettings.bgImageUrl);
      if (displaySettings.bgVideoUrl) enqueueBlob(displaySettings.bgVideoUrl);

      // Sync active countdown background media when countdown is active
      if (countdown?.active) {
        const cdBg = displaySettings.backgrounds?.countdown;
        if (cdBg?.bgType === 'image' && cdBg.bgImageUrl) enqueueBlob(cdBg.bgImageUrl);
        if (cdBg?.bgType === 'video' && cdBg.bgVideoUrl) enqueueBlob(cdBg.bgVideoUrl);
      }

      const pendingUrls = urlsToSync.filter(u => !uploadedUrlsRef.current.has(u));
      if (pendingUrls.length === 0) return;

      for (const targetUrl of pendingUrls) {
        if (isCancelled) break;
        uploadedUrlsRef.current.add(targetUrl);
        setIsSyncingMedia(true);
        if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'sync-start', id: targetUrl }));

        try {
          const res = await fetch(targetUrl);
          const blob = await res.blob();
          const buffer = await blob.arrayBuffer();

          // Yield execution to the main thread briefly so the Projector's <video> element 
          // can smoothly mount and start playing locally before we block the thread to send.
          await new Promise(r => setTimeout(r, 150));

          if (wsRef.current?.readyState === 1) {
            let mimeType = blob.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
              const isVid = (displaySettings.backgrounds && Object.values(displaySettings.backgrounds).some(b => b?.bgVideoUrl === targetUrl)) ||
                            displaySettings.bgVideoUrl === targetUrl;
              mimeType = isVid ? 'video/mp4' : 'image/jpeg';
            }
            wsRef.current.send(JSON.stringify({ type: 'media_header', id: targetUrl, mime: mimeType }));
            wsRef.current.send(buffer);
          }
          setSyncedMediaUrl(targetUrl);
        } catch (e) {
          uploadedUrlsRef.current.delete(targetUrl);
          console.error("Sync Media Failed:", e);
        }

        if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'sync-end', id: targetUrl }));
        setIsSyncingMedia(false);
      }
    };
    syncMedia();
    return () => { isCancelled = true; };
  }, [liveItem, liveSlideIndex, logoUrl, isShowLogo, displaySettings, countdown?.active, triggerMediaSync]);

  // Projection Engine Compiler
  useEffect(() => {
    if (isProjectorView || isNetworkView || remoteControlRoom) return;

    // Resolve active background based on live item type (song, bible, liturgy)
    const activeItemType = liveItem?.type;
    const isTextCategory = activeItemType === 'song' || activeItemType === 'bible' || activeItemType === 'liturgy';
    const catBg = isTextCategory
      ? (displaySettings.backgrounds?.[activeItemType] || {
          bgType: displaySettings.bgType || 'color',
          bgColor: displaySettings.bgColor || '#000000',
          bgImageUrl: displaySettings.bgImageUrl,
          bgVideoUrl: displaySettings.bgVideoUrl,
          bgDim: displaySettings.bgDim,
          bgVideoLoop: displaySettings.bgVideoLoop
        })
      : {
          bgType: 'color',
          bgColor: '#000000',
          bgImageUrl: null,
          bgVideoUrl: null,
          bgDim: 0,
          bgVideoLoop: true
        };

    const effectiveLiveLinesPerSlide =
      liveItem?.type === 'liturgy'
        ? (liveItem.linesPerSlide || liturgyLinesPerSlide)
        : liveItem?.type === 'bible'
        ? (liveItem.versesPerSlide || bibleVersesPerSlide)
        : (liveItem?.linesPerSlide || linesPerSlide);

    const payload = {
       isLive,
       isBlackScreen,
       isShowLogo,
       logoUrl,
       linesPerSlide: effectiveLiveLinesPerSlide,
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
       textScale: displaySettings.textScale ?? 1,
       bgType: catBg.bgType || 'color',
       bgColor: catBg.bgColor || '#000000',
       bgImageUrl: catBg.bgImageUrl,
       bgVideoUrl: catBg.bgVideoUrl,
       bgDim: catBg.bgDim !== undefined ? catBg.bgDim : 0.3,
       bgVideoLoop: catBg.bgVideoLoop ?? true,
       backgrounds: displaySettings.backgrounds,
       transitionEnabled: displaySettings.transitionEnabled ?? true,
       transitionType: displaySettings.transitionType || 'crossfade',
       transitionDuration: displaySettings.transitionDuration || 400,
       ccliSettings: ccliSettings,
       announcement: announcement,
       countdown: countdown,
       overlaySettings: overlaySettings,
       stickyAudioUrl: stickyAudioItem?.url || null,
       slideIndex: liveSlideIndex,
       itemSlides: liveItem?.slides || null,
       itemImagesCount: liveItem?.images?.length || 0,
       itemThumbnails: liveItem?.images?.map(img => img.thumbnail).filter(Boolean) || null
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
             } else if (liveItem.type === 'song') {
                 payload.songMetadata = {
                   title: liveItem.title || '',
                   artist: liveItem.artist || '',
                   ccli: liveItem.ccli || '',
                   copyright: liveItem.copyright || '',
                   isFirstSlide: liveSlideIndex === 0,
                   isLastSlide: liveSlideIndex === (slides.length - 1)
                 };
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
      // Blobs retained to avoid standby state dropping
      
      networkPayload.isNetworkViewer = true; // Mark specifically for phone viewers
      livePayloadRef.current = networkPayload;

      const minItems = serviceItemsRef.current.map(i => ({ id: i.id, type: i.type, title: i.title, filename: i.filename }));
      if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'state', payload: networkPayload, serviceItems: minItems }));
    };

    broadcast();
  }, [isLive, isBlackScreen, isShowLogo, logoUrl, liveItem, liveSlideIndex, linesPerSlide, liturgyLinesPerSlide, bibleVersesPerSlide, playbackStatus, slideshowInterval, syncedMediaUrl, churchName, displayFont, stickyAudioItem, displaySettings, ccliSettings, announcement, countdown, overlaySettings]);

  const livePayloadStateRef = useRef(null);
  useEffect(() => {
    livePayloadStateRef.current = livePayload;
  }, [livePayload]);

  useEffect(() => {
    const bc = new BroadcastChannel('presenter-projector-hub');
     bc.onmessage = (e) => {
        if (!e.data) return;
        const currentPayload = livePayloadStateRef.current;
        
        if (e.data === 'ping') {
           setProjectorConnected(true);
           if (projectorTimeoutRef.current) clearTimeout(projectorTimeoutRef.current);
           projectorTimeoutRef.current = setTimeout(() => setProjectorConnected(false), 2500);
           if (currentPayload) {
              bc.postMessage({
                type: 'sync-projector',
                payload: currentPayload,
                blobs: backgroundBlobsRef.current
              });
           }
        }

        if (e.data?.type === 'request-sync' && currentPayload) {
           bc.postMessage({
             type: 'sync-projector',
             payload: currentPayload,
             blobs: backgroundBlobsRef.current
           });
        }

        if (e.data?.type === 'heartbeat') {
           setProjectorConnected(true);
           if (projectorTimeoutRef.current) clearTimeout(projectorTimeoutRef.current);
           projectorTimeoutRef.current = setTimeout(() => setProjectorConnected(false), 2500);
           if (e.data?.needsSync && currentPayload) {
              bc.postMessage({
                type: 'sync-projector',
                payload: currentPayload,
                blobs: backgroundBlobsRef.current
              });
           }
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
   }, []);

  const networkMediaCacheRef = useRef({});
  const rawNetworkPayloadRef = useRef(null);

  // Network Viewer WebSocket Initialization
  useEffect(() => {
    if (!isNetworkView) return;

    const host = window.location.hostname;
    const ws = new WebSocket(`ws://${host}:5179`);
    
    ws.onopen = () => {
       ws.send(JSON.stringify({ type: 'request_state', role: 'live_viewer' }));
    };

    const resolveAppNetworkPayload = (raw, cache) => {
      if (!raw || typeof raw !== 'object') return raw;
      const copy = { ...raw };
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const map = (u) => {
        if (typeof u !== 'string' || !u.startsWith('blob:')) return u;
        if (cache && cache[u]) return cache[u];
        return isLocalHost ? u : null;
      };
      if (copy.activeMediaUrl) copy.activeMediaUrl = map(copy.activeMediaUrl);
      if (copy.logoUrl) copy.logoUrl = map(copy.logoUrl);
      if (copy.bgImageUrl) copy.bgImageUrl = map(copy.bgImageUrl);
      if (copy.bgVideoUrl) copy.bgVideoUrl = map(copy.bgVideoUrl);
      if (copy.backgrounds && typeof copy.backgrounds === 'object') {
        const bgs = { ...copy.backgrounds };
        ['song', 'bible', 'liturgy', 'countdown'].forEach(cat => {
          if (bgs[cat]) {
            bgs[cat] = {
              ...bgs[cat],
              bgImageUrl: map(bgs[cat].bgImageUrl),
              bgVideoUrl: map(bgs[cat].bgVideoUrl)
            };
          }
        });
        copy.backgrounds = bgs;
      }
      return copy;
    };

    let pendingMediaHeader = null;
    ws.binaryType = 'arraybuffer';
    ws.onmessage = async (event) => {
       const isBinary = event.data instanceof ArrayBuffer || event.data instanceof Blob;
       if (isBinary) {
           if (pendingMediaHeader) {
               let mimeType = pendingMediaHeader.mime;
               if (!mimeType || mimeType === 'application/octet-stream') {
                   mimeType = 'video/mp4';
               }
               const finalBlob = new Blob([event.data], { type: mimeType });
               const url = URL.createObjectURL(finalBlob);
               networkMediaCacheRef.current[pendingMediaHeader.id] = url;
               if (rawNetworkPayloadRef.current) {
                  setNetworkPayload(resolveAppNetworkPayload(rawNetworkPayloadRef.current, networkMediaCacheRef.current));
               }
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
               rawNetworkPayloadRef.current = data.payload;
               setNetworkPayload(resolveAppNetworkPayload(data.payload, networkMediaCacheRef.current));
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
           setLiveItem(null);
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
  }, [selectedItem, liveItem, activeSlideIndex]);

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
          if (item.type === 'song') {
            const lps = item.linesPerSlide || linesPerSlide;
            const parsed = parseSongMarkdown(item.rawText, lps, item.arrangement);
            parsedSlides = parsed.slides;
            itemToView = {
              ...item,
              ...parsed,
              title: item.title || parsed.metadata.title,
              artist: item.artist || parsed.metadata.artist,
              ccli: item.ccli || parsed.metadata.ccli,
              copyright: item.copyright || parsed.metadata.copyright,
              linesPerSlide: lps,
              slides: parsedSlides,
              arrangement: item.arrangement || parsed.arrangement
            };
          } else if (item.type === 'liturgy') {
            const lps = item.linesPerSlide || liturgyLinesPerSlide;
            parsedSlides = parseLiturgyMarkdown(item.rawText, lps).slides;
            itemToView = { ...item, linesPerSlide: lps, slides: parsedSlides };
          } else if (item.type === 'bible') {
            const vps = item.versesPerSlide || bibleVersesPerSlide || 1;
            parsedSlides = parseBibleText(item.rawText, item.reference || item.title, vps);
            itemToView = { ...item, versesPerSlide: vps, slides: parsedSlides };
          }
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

  const handleUpdateItem = (newItem) => {
    if (!newItem) return;
    setSelectedItem(newItem);
    setServiceItems(prev => prev.map(si => si.id === newItem.id ? { ...si, ...newItem } : si));
    if (liveItemRef.current?.id === newItem.id || liveItem?.id === newItem.id) {
      setLiveItem(prev => ({ ...prev, ...newItem }));
    }
  };

  const handleSaveMasterSongText = async (filename, newRawText) => {
    if (!libraryHandle || !filename) return false;
    try {
      const songsFolder = await libraryHandle.getDirectoryHandle('Songs', { create: true });
      const fileHandle = await songsFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(newRawText);
      await writable.close();
      if (typeof refreshLibrary === 'function') refreshLibrary();
      return true;
    } catch (err) {
      console.error('Failed to update master song file on disk:', err);
      return false;
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
      
      let baseTitle = selectedItem.title || selectedItem.reference || 'Untitled';
      let selectionLabel = " (Selected)";
      if (selectedItem.type === 'bible') {
        const verseNumbers = [];
        selectedSlides.forEach(s => {
          const contentTokens = [...(s?.content || []).join(' ').matchAll(/\[(\d+)/g)].map(m => Number(m[1]));
          if (contentTokens.length > 0) {
            contentTokens.forEach(n => { if (!isNaN(n)) verseNumbers.push(n); });
          } else {
            const typeMatch = String(s?.type || '').match(/:(\d+)/);
            if (typeMatch && !isNaN(Number(typeMatch[1]))) {
              verseNumbers.push(Number(typeMatch[1]));
            }
          }
        });

        if (verseNumbers.length > 0) {
          baseTitle = baseTitle.replace(/:.*$/, '').trim();
          selectionLabel = ":" + formatVerseRanges(verseNumbers);
        }
      }

        const subsetRawText = selectedItem.type === 'bible'
          ? selectedSlides.flatMap(s => s?.content || []).join('\n')
          : undefined;

        itemToAdd = {
          ...selectedItem,
          rawText: subsetRawText,
          title: baseTitle + selectionLabel,
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

  const selectedMonitorRef = useRef(selectedMonitor);
  useEffect(() => {
    selectedMonitorRef.current = selectedMonitor;
  }, [selectedMonitor]);

  const closeProjectorWindow = useCallback(async () => {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('close_projector_window');
        projectorWindowRef.current = null;
        return;
      } catch {
        // Fallback to JS WebviewWindow API if Rust binary hasn't been rebuilt yet
      }
      try {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const existing = (await WebviewWindow.getByLabel('projector')) || projectorWindowRef.current;
        if (existing) {
          try { await existing.setFullscreen(false); } catch {}
          try { await existing.destroy(); } catch { await existing.close?.().catch(() => {}); }
        }
      } catch {
        projectorWindowRef.current?.close?.();
      }
      projectorWindowRef.current = null;
      return;
    }

    if (projectorWindowRef.current) {
      try { projectorWindowRef.current.close(); } catch {}
      projectorWindowRef.current = null;
    }
  }, []);

  const openProjectorWindow = useCallback(async () => {
    const savedMonitorChoice = selectedMonitorRef.current;

    if (isTauri()) {
      try {
        const [
          { invoke },
          { WebviewWindow },
          { availableMonitors, currentMonitor, getCurrentWindow },
          { PhysicalPosition, PhysicalSize }
        ] = await Promise.all([
          import('@tauri-apps/api/core'),
          import('@tauri-apps/api/webviewWindow'),
          import('@tauri-apps/api/window'),
          import('@tauri-apps/api/dpi')
        ]);

        const [liveMonitors, mainMon] = await Promise.all([
          availableMonitors().catch(() => []),
          currentMonitor().catch(() => null)
        ]);

        const { mode, monitor: targetMon, isSameAsMain } = resolveTargetMonitor(
          savedMonitorChoice,
          liveMonitors,
          mainMon
        );
        const isWindowed = mode === 'windowed';

        // 1. Prefer native Rust multi-monitor builder when available
        try {
          await invoke('open_projector_window', {
            monitorName: targetMon?.name ?? null,
            monitorX: targetMon?.position?.x ?? null,
            monitorY: targetMon?.position?.y ?? null,
            windowed: isWindowed
          });
          const handle = await WebviewWindow.getByLabel('projector');
          if (handle) {
            projectorWindowRef.current = handle;
            if (!isWindowed) {
              await handle.setDecorations(false).catch(() => {});
              await handle.setFullscreen(true).catch(() => {});
            }
          }
          return;
        } catch {
          // Seamless JS fallback when running against an earlier compiled Rust binary
        }

        // 2. Clean up any existing projector window
        const existing = await WebviewWindow.getByLabel('projector');
        if (existing) {
          try { await existing.setFullscreen(false); } catch {}
          try { await existing.destroy(); } catch { await existing.close().catch(() => {}); }
          await new Promise((r) => setTimeout(r, 40));
        }

        const projWin = new WebviewWindow('projector', {
          url: '/?projector=true',
          title: 'Presenter - Projector',
          width: targetMon?.size?.width || 1280,
          height: targetMon?.size?.height || 720,
          x: targetMon?.position?.x,
          y: targetMon?.position?.y,
          decorations: isWindowed,
          fullscreen: !isWindowed,
          alwaysOnTop: false,
          resizable: true,
          visible: isWindowed ? true : false
        });

        projectorWindowRef.current = projWin;

        if (!isWindowed) {
          try {
            await projWin.setDecorations(false).catch(() => {});
            if (targetMon?.position && targetMon?.size) {
              await projWin
                .setPosition(new PhysicalPosition(targetMon.position.x, targetMon.position.y))
                .catch(() => {});
              await projWin
                .setSize(new PhysicalSize(targetMon.size.width, targetMon.size.height))
                .catch(() => {});
            }
            await projWin.setDecorations(false).catch(() => {});
            await projWin.setFullscreen(true).catch(() => {});
            await projWin.show().catch(() => {});

            if (!isSameAsMain) {
              await getCurrentWindow().setFocus().catch(() => {});
            } else {
              await projWin.setFocus().catch(() => {});
            }
          } catch (err) {
            console.warn('Projector direct placement error:', err);
          }
        } else {
          await projWin.show().catch(() => {});
          await projWin.setFocus().catch(() => {});
        }
      } catch (err) {
        console.error('Failed to open projector window:', err);
      }
      return;
    }

    // Browser / PWA fallback
    let parsedMon = null;
    if (savedMonitorChoice && savedMonitorChoice !== 'windowed') {
      try { parsedMon = JSON.parse(savedMonitorChoice); } catch { parsedMon = null; }
    }
    const scale = parsedMon?.scaleFactor || window.devicePixelRatio || 1;
    const width = parsedMon?.size?.width ? Math.round(parsedMon.size.width / scale) : window.screen.availWidth || 1280;
    const height = parsedMon?.size?.height ? Math.round(parsedMon.size.height / scale) : window.screen.availHeight || 720;
    const left = parsedMon?.position?.x !== undefined ? Math.round(parsedMon.position.x / scale) : window.screen.availLeft || 0;
    const top = parsedMon?.position?.y !== undefined ? Math.round(parsedMon.position.y / scale) : window.screen.availTop || 0;

    const win = window.open(
      '/?projector=true',
      'presenter_projector',
      `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
    );
    projectorWindowRef.current = win;
    if (win) {
      try {
        win.focus();
        win.addEventListener('load', () => {
          try {
            win.document?.documentElement?.requestFullscreen?.().catch(() => {});
          } catch {}
        });
      } catch {}
    }
  }, []);

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
         } else if (data.command === 'toggle_live') {
             setIsLive(prev => {
                 if (!prev) {
                     openProjectorWindow();
                     return true;
                 } else {
                     closeProjectorWindow();
                     setLiveItem(null);
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
         } else if (data.command === 'dismiss_announcement') {
             setAnnouncement(prev => ({ ...prev, active: false }));
         } else if (data.command === 'stop_countdown') {
             setCountdown(prev => ({ ...prev, active: false, running: false, remainingSeconds: 0 }));
         }
     };
     return () => bc.close();
  }, [serviceItems, openProjectorWindow, closeProjectorWindow]);

  const toggleLive = async () => {
     if (!isLive) {
        await openProjectorWindow();
        setIsLive(true);
        if (liveItem) {
           setPlayedItems(prev => new Set(prev).add(liveItem.id));
        }
     } else {
        setShowOfflineConfirm(true);
     }
  };

  const executeGoOffline = () => {
     closeProjectorWindow();
     setIsLive(false);
     setLiveItem(null);
     setPresentationPaused(true);
     const bc = new BroadcastChannel('presenter-projector-hub');
     bc.postMessage({ type: 'control', command: 'pause' });
     bc.close();
     setShowOfflineConfirm(false);
  };

  // ROUTING LAYER: PROJECTOR
  if (isProjectorView) {
    return (
       <div className="w-screen h-screen bg-black overflow-hidden relative">
          <OutputScreen payload={livePayload} isMaster={true} isProjector={true} remoteCommand={remoteCommand} />
       </div>
    );
  }

  // ROUTING LAYER: NETWORK
  if (isNetworkView) {
    return (
       <div className="w-screen h-screen bg-black overflow-hidden relative">
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
    <DragDropZone libraryHandle={libraryHandle} onFileAdded={refreshLibrary}>
      <div className="h-screen bg-[#FAF6F0] text-[#1C355E] flex flex-col overflow-hidden font-sans selection:bg-[#3D7B8C]/20">
          
          {/* TOP NAVIGATION BAR */}
          <header className="h-16 border-b border-[#E4E1DA] flex flex-col justify-between px-4 xl:px-6 bg-white z-20 pt-2">
            <div className="flex justify-between items-end w-full h-full gap-2">
              <div className="flex items-center gap-3 pb-2 h-full w-auto xl:w-[270px] 2xl:w-[340px] shrink-0">
                  <Logo showText={true} />
              </div>
              
              <div className="flex gap-1 xl:gap-1.5 overflow-x-auto no-scrollbar flex-1 justify-center px-2">
                {TABS.map(tab => (
                   <button 
                     key={tab}
                     onClick={() => {
                       setActiveTab(tab);
                       setSelectedItem(null);
                       setActiveSlideIndex(0);
                     }}
                     className={`px-3.5 xl:px-5 py-3 text-xs font-bold uppercase tracking-wider rounded-t-xl transition-colors duration-150 border-b-2 flex items-center h-full cursor-pointer whitespace-nowrap ${
                       activeTab === tab 
                          ? 'text-[#1C355E] border-[#7A502A] bg-[#FAF6F0]' 
                          : 'text-[#526075] border-transparent hover:text-[#1C355E] hover:bg-[#FAF6F0]/60'
                     }`}
                   >
                     {tab}
                   </button>
                ))}
              </div>
              
              <div className="flex items-center justify-end gap-4 pb-3 w-auto xl:w-[270px] 2xl:w-[330px] shrink-0">

                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0] rounded-lg transition-colors cursor-pointer"
                  title="System Settings"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 flex overflow-hidden relative">
            
            <div className="w-[310px] xl:w-[340px] 2xl:w-[380px] border-r border-[#E4E1DA] p-4 2xl:p-5 bg-[#FAF6F0] flex flex-col gap-6 flex-shrink-0 z-10 relative">
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
                 liturgyLinesPerSlide={liturgyLinesPerSlide}
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
            
            <div className="flex-1 p-5 xl:p-6 2xl:p-8 bg-white overflow-y-auto relative custom-scrollbar flex flex-col z-0">
              {(activeTab === 'new_liturgy' || activeTab === 'edit_liturgy') ? (
                 <LiturgyEditor
                   libraryHandle={libraryHandle}
                   displaySettings={displaySettings}
                   displayFont={displayFont}
                   linesPerSlide={selectedItem?.type === 'liturgy' ? (selectedItem.linesPerSlide || liturgyLinesPerSlide) : liturgyLinesPerSlide}
                   onChangeLinesPerSlide={(n) => {
                     setLiturgyLinesPerSlide(n);
                     if (selectedItem?.type === 'liturgy') {
                       setSelectedItem(prev => prev ? { ...prev, linesPerSlide: n } : prev);
                     }
                   }}
                   initialFile={selectedItem?.type === 'liturgy' && selectedItem?.fileHandle
                     ? { name: selectedItem.filename, handle: selectedItem.fileHandle }
                     : null
                   }
                   onSaved={(saved) => {
                     // Re-load the saved file into selectedItem
                     const load = async () => {
                       const f = await saved.handle.getFile();
                       const text = await f.text();
                       const lps = selectedItem?.type === 'liturgy' ? (selectedItem.linesPerSlide || liturgyLinesPerSlide) : liturgyLinesPerSlide;
                       const parsed = parseLiturgyMarkdown(text, lps);
                       const updated = {
                         type: 'liturgy',
                         id: saved.name,
                         filename: saved.name,
                         title: parsed.metadata.title || saved.name.replace('.md', ''),
                         linesPerSlide: lps,
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
                      if (selectedIndices.size === 0) return;
                      const currentImages = selectedItem.images || [];
                      const remainingImages = currentImages.filter((_, idx) => !selectedIndices.has(idx));

                      if (remainingImages.length === 0) {
                        handleDeleteItem(selectedItem.id);
                      } else {
                        const updatedItem = {
                          ...selectedItem,
                          images: remainingImages,
                          slides: selectedItem.slides ? selectedItem.slides.filter((_, idx) => !selectedIndices.has(idx)) : undefined
                        };
                        setServiceItems(serviceItems.map(si => si.id === selectedItem.id ? updatedItem : si));
                        setSelectedItem(updatedItem);
                        if (liveItem?.id === selectedItem.id) {
                          setLiveItem(updatedItem);
                        }
                        setSelectedIndices(new Set());
                        setActiveSlideIndex(0);
                      }
                    }}
                  />
               ) : selectedItem?.type === 'video' ? (
                  <div className="w-full h-full flex flex-col bg-[#FAF6F0] rounded-2xl border border-[#E4E1DA] p-8 overflow-hidden relative">
                     {/* Header matches PreviewEditor */}
                     <div className="flex flex-col mb-6 border-b border-[#E4E1DA] pb-4 gap-4">
                        <div className="flex items-center gap-3">
                           {activeTab !== 'Service' && (
                              <button 
                                 onClick={handleAddToService}
                                 className={`flex items-center justify-center h-10 gap-2 px-6 py-2 ${showAddedFeedback ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-[#7A502A] hover:bg-[#654121]'} text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer`}
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
                               className="flex items-center gap-1.5 h-10 px-4 py-2 bg-white hover:bg-[#F0EBE1] text-[#1C355E] rounded-xl border border-[#E4E1DA] transition-colors font-bold text-xs uppercase tracking-widest shadow-sm"
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
                   <div className="w-full h-full flex flex-col bg-[#FAF6F0] rounded-2xl border border-[#E4E1DA] p-8 overflow-hidden relative">
                       {/* Header matches PreviewEditor */}
                       <div className="flex flex-col mb-6 border-b border-[#E4E1DA] pb-4 gap-4">
                          <div className="flex items-center gap-3">
                             {activeTab !== 'Service' && (
                                <button 
                                   onClick={handleAddToService}
                                   className={`flex items-center justify-center h-10 gap-2 px-6 py-2 ${showAddedFeedback ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-[#7A502A] hover:bg-[#654121]'} text-white rounded-xl transition-colors font-bold text-xs uppercase tracking-widest shadow-sm cursor-pointer`}
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
                               <div className="w-24 h-24 bg-[#EDF4F6] rounded-full flex items-center justify-center border border-[#3D7B8C]/30">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#3D7B8C]"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
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
                 <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-[#FAF6F0] rounded-2xl border border-[#E4E1DA]">
                    <h3 className="text-3xl font-extrabold mb-4 text-[#1C355E] tracking-tight">{selectedItem.title}</h3>
                    <p className="text-[#526075] text-sm max-w-md font-medium leading-relaxed">Presentations and Document files cannot be natively controlled or paginated inside a web browser frame.<br/><br/>Please export your slides or pages as images (.jpg or .png) and drop them into the Images folder for native viewing, or use an external application alongside Presenter.</p>
                 </div>
              ) : (selectedItem?.slides || selectedItem?.isBibleBook) ? (
                  <PreviewEditor 
                    item={selectedItem} 
                    onUpdateItem={handleUpdateItem}
                    onSaveMasterSongText={handleSaveMasterSongText}
                    isLive={isLive}
                    liveItem={liveItem}
                    liveSlideIndex={liveSlideIndex}
                    activeIndex={activeSlideIndex} 
                    linesPerSlide={
                      selectedItem.type === 'bible'
                        ? (selectedItem.versesPerSlide || bibleVersesPerSlide)
                        : selectedItem.type === 'liturgy'
                        ? (selectedItem.linesPerSlide || liturgyLinesPerSlide)
                        : (selectedItem.linesPerSlide || linesPerSlide)
                    }
                    selectedIndices={selectedIndices}
                    isServiceItem={serviceItems.some(si => si.id === selectedItem?.id)}
                    displaySettings={displaySettings}
                    displayFont={displayFont}
                    ccliSettings={ccliSettings}
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
                        const restItem = { ...selectedItem };
                        delete restItem.rawText;
                        const updatedItem = { ...restItem, slides: remainingSlides };
                        setServiceItems(serviceItems.map(si => si.id === selectedItem.id ? updatedItem : si));
                        setSelectedItem(updatedItem);
                        if (liveItem?.id === selectedItem.id) {
                          setLiveItem(updatedItem);
                        }
                      }
                      setSelectedIndices(new Set());
                    }}
                    onChangeLinesPerSlide={(n) => {
                      if (selectedItem?.type === 'bible') {
                        setBibleVersesPerSlide(n);
                      } else if (selectedItem?.type === 'liturgy') {
                        setLiturgyLinesPerSlide(n);
                      } else {
                        setLinesPerSlide(n);
                      }
                      if (selectedItem?.rawText) {
                        let parsedSlides;
                        if (selectedItem.type === 'song') parsedSlides = parseSongMarkdown(selectedItem.rawText, n, selectedItem.arrangement).slides;
                        else if (selectedItem.type === 'liturgy') parsedSlides = parseLiturgyMarkdown(selectedItem.rawText, n).slides;
                        else if (selectedItem.type === 'bible') parsedSlides = parseBibleText(selectedItem.rawText, selectedItem.reference || selectedItem.title, n);
                        
                        if (parsedSlides) {
                          const extraProps = selectedItem.type === 'bible' ? { versesPerSlide: n } : { linesPerSlide: n };
                          setSelectedItem(prev => ({ ...prev, ...extraProps, slides: parsedSlides }));
                          setActiveSlideIndex(0);
                          if (liveItem?.id === selectedItem.id) {
                            setLiveItem(prev => ({ ...prev, ...extraProps, slides: parsedSlides }));
                            setLiveSlideIndex(0);
                          }
                          
                          // Update it in service list too if it's there
                          setServiceItems(prev => prev.map(si => 
                            si.id === selectedItem.id 
                              ? { ...si, ...extraProps, slides: parsedSlides }
                              : si
                          ));
                        }
                      }
                    }}
                 />
              ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto pointer-events-none">
                    <h3 className="text-xl font-extrabold mb-3 tracking-widest text-[#1C355E]/60">NO MEDIA SELECTED</h3>
                    <p className="text-[#526075] font-medium text-sm leading-relaxed">Use the tabs above to select content folders.<br/>Select an item to preview it, then click "Add to Service".</p>
                 </div>
              )}
            </div>
            
            <div className="w-[310px] xl:w-[330px] 2xl:w-[360px] border-l border-[#E4E1DA] p-4 xl:p-5 2xl:p-6 bg-[#FAF6F0] z-20 flex-shrink-0 overflow-y-auto custom-scrollbar">
               <LiveControl 
                 isLive={isLive} toggleLive={toggleLive}
                 isBlackScreen={isBlackScreen} setIsBlackScreen={setIsBlackScreen}
                 announcement={announcement}
                 setAnnouncement={setAnnouncement}
                 countdown={countdown}
                 setCountdown={setCountdown}
                 overlaySettings={overlaySettings}
                 onUpdateOverlaySettings={handleUpdateOverlaySettings}
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
             setSelectedMonitor={(val) => {
               selectedMonitorRef.current = val;
               setSelectedMonitor(val);
               if (isLive) {
                 openProjectorWindow();
               }
             }}
              roomId={roomId}
              churchName={churchName}
              setChurchName={setChurchName}
              displayFont={displayFont}
              setDisplayFont={setDisplayFont}
              remotePassword={remotePassword}
              ccliSettings={ccliSettings}
              onUpdateCcliSettings={handleUpdateCcliSettings}
              overlaySettings={overlaySettings}
              onUpdateOverlaySettings={handleUpdateOverlaySettings}
              displaySettings={displaySettings}
              onUpdateDisplaySettings={handleUpdateDisplaySettings}
              onSaveBackgroundImage={handleSaveBackgroundImage}
              onClearBackgroundImage={handleClearBackgroundImage}
              onSaveBackgroundVideo={handleSaveBackgroundVideo}
              onClearBackgroundVideo={handleClearBackgroundVideo}
              onApplyBackgroundToAll={handleApplyBackgroundToAll}
              libraryHandle={libraryHandle}
              onSavePassword={async (val) => {
                  setRemotePassword(val);
                  remotePasswordRef.current = val;
                  authenticatedClientsRef.current.clear();
                  try {
                      const { set } = await import('idb-keyval');
                      await set('presenter_remote_password', val);
                  } catch {
                      // ignore
                  }
                  if (wsRef.current?.readyState === 1) {
                      const hasPin = !!(val && val.trim().length > 0);
                      wsRef.current.send(JSON.stringify({
                          type: 'auth_status',
                          pinRequired: hasPin,
                          authenticated: !hasPin
                      }));
                  }
              }}
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
