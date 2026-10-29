import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MonitorPlay, MonitorX, Plus, Minus, Play, Pause, RotateCcw, 
  Volume2, VolumeX, Repeat, Repeat1, SkipBack, SkipForward, ArrowRight,
  Megaphone, Timer, Bell, X, Check, Clock
} from 'lucide-react';
import OutputScreen, { AnnouncementOverlay, CountdownOverlay } from './OutputScreen';
import { getFontFamilyCss } from '../utils/fonts';

export default function LiveControl({ 
    isLive, toggleLive, 
    isBlackScreen, setIsBlackScreen, 
    livePayload,
    remoteCommand = null,
    playbackStatus = { time: 0, duration: 0, paused: true, volume: 1 },
    presentationPaused = true,
    setPresentationPaused = () => {},
    isSyncingMedia = false,
    musicFiles = [],
    projectorConnected = false,
    announcement = null,
    setAnnouncement = () => {},
    countdown = null,
    setCountdown = () => {},
    overlaySettings = null,
    onUpdateOverlaySettings = null
}) {
  const [playVolume, setPlayVolume] = useState(1);
  const [scrubTime, setScrubTime] = useState(0);
  
  // Screen Overlay Modal State
  const [activeOverlayModal, setActiveOverlayModal] = useState(null); // 'announcement' | 'countdown' | null
  const [announcementInput, setAnnouncementInput] = useState(announcement?.text || '');
  const [autoDismissSecs, setAutoDismissSecs] = useState(announcement?.autoDismissSeconds || 0);

  const [countdownMins, setCountdownMins] = useState(overlaySettings?.countdown?.defaultMinutes || 5);
  const [countdownTitle, setCountdownTitle] = useState(
    overlaySettings?.countdown?.defaultTitle !== undefined ? overlaySettings.countdown.defaultTitle : 'Service starts in'
  );
  const [countdownEndMessage, setCountdownEndMessage] = useState(
    overlaySettings?.countdown?.endMessage || 'Welcome! Service starting shortly'
  );
  const [countdownRemaining, setCountdownRemaining] = useState(0);

  // Sync announcement input if opening modal and alert is active
  useEffect(() => {
    if (activeOverlayModal === 'announcement' && announcement?.text) {
      setAnnouncementInput(announcement.text);
    }
  }, [activeOverlayModal, announcement?.text]);

  // Sync default countdown settings when overlaySettings changes or when opening the Timer modal
  useEffect(() => {
    if (countdown?.active) {
      if (activeOverlayModal === 'countdown') {
        setCountdownTitle(
          countdown.title !== undefined
            ? countdown.title
            : (overlaySettings?.countdown?.defaultTitle !== undefined ? overlaySettings.countdown.defaultTitle : 'Service starts in')
        );
        setCountdownEndMessage(
          countdown.endMessage || overlaySettings?.countdown?.endMessage || 'Welcome! Service starting shortly'
        );
      }
      return;
    }

    if (overlaySettings?.countdown?.defaultMinutes !== undefined) {
      setCountdownMins(overlaySettings.countdown.defaultMinutes || 5);
    }
    if (overlaySettings?.countdown?.defaultTitle !== undefined) {
      setCountdownTitle(overlaySettings.countdown.defaultTitle);
    }
    if (overlaySettings?.countdown?.endMessage !== undefined) {
      setCountdownEndMessage(overlaySettings.countdown.endMessage || 'Welcome! Service starting shortly');
    }
  }, [
    overlaySettings?.countdown?.defaultMinutes,
    overlaySettings?.countdown?.defaultTitle,
    overlaySettings?.countdown?.endMessage,
    countdown?.active,
    countdown?.title,
    countdown?.endMessage,
    activeOverlayModal
  ]);

  // Handle ESC key to close overlay modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeOverlayModal) {
        setActiveOverlayModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOverlayModal]);

  // Sync remaining countdown time locally for display in the drawer
  useEffect(() => {
    if (!countdown?.active) {
      setCountdownRemaining(0);
      return;
    }
    const update = () => {
      if (!countdown.running) {
        setCountdownRemaining(countdown.remainingSeconds || 0);
        return;
      }
      if (!countdown.targetTimeMs) {
        setCountdownRemaining(0);
        return;
      }
      const rem = Math.max(0, Math.ceil((countdown.targetTimeMs - Date.now()) / 1000));
      setCountdownRemaining(rem);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [countdown]);

  const handleShowAnnouncement = () => {
    if (!announcementInput.trim()) return;
    setAnnouncement({
      active: true,
      text: announcementInput.trim(),
      autoDismissSeconds: autoDismissSecs,
      timestamp: Date.now()
    });
  };

  const handleDismissAnnouncement = () => {
    setAnnouncement(prev => ({
      ...prev,
      active: false
    }));
  };

  const handleStartCountdown = () => {
    const totalSecs = Math.max(10, Math.round((countdownMins || 5) * 60));
    const target = Date.now() + totalSecs * 1000;
    const cleanTitle = countdownTitle.trim();
    const cleanEnd = countdownEndMessage.trim() || 'Welcome! Service starting shortly';

    if (onUpdateOverlaySettings) {
      onUpdateOverlaySettings(cur => ({
        ...cur,
        countdown: {
          ...(cur?.countdown || {}),
          defaultTitle: cleanTitle,
          endMessage: cleanEnd
        }
      }));
    }

    setCountdown({
      active: true,
      running: true,
      targetTimeMs: target,
      initialSeconds: totalSecs,
      remainingSeconds: totalSecs,
      title: cleanTitle,
      endMessage: cleanEnd
    });
  };

  const handleCountdownTitleChange = (val) => {
    setCountdownTitle(val);
    if (onUpdateOverlaySettings) {
      onUpdateOverlaySettings(cur => ({
        ...cur,
        countdown: {
          ...(cur?.countdown || {}),
          defaultTitle: val
        }
      }));
    }
    if (countdown?.active) {
      setCountdown(prev => ({ ...prev, title: val }));
    }
  };

  const handleCountdownEndMessageChange = (val) => {
    setCountdownEndMessage(val);
    if (onUpdateOverlaySettings) {
      onUpdateOverlaySettings(cur => ({
        ...cur,
        countdown: {
          ...(cur?.countdown || {}),
          endMessage: val
        }
      }));
    }
    if (countdown?.active) {
      setCountdown(prev => ({
        ...prev,
        endMessage: val.trim() || 'Welcome! Service starting shortly'
      }));
    }
  };

  const handlePauseCountdown = () => {
    if (!countdown) return;
    const rem = Math.max(0, Math.ceil(((countdown.targetTimeMs || Date.now()) - Date.now()) / 1000));
    setCountdown(prev => ({
      ...prev,
      running: false,
      remainingSeconds: rem
    }));
  };

  const handleResumeCountdown = () => {
    if (!countdown) return;
    const rem = countdown.remainingSeconds || 60;
    const target = Date.now() + rem * 1000;
    setCountdown(prev => ({
      ...prev,
      running: true,
      targetTimeMs: target
    }));
  };

  const handleStopCountdown = () => {
    setCountdown(prev => ({
      ...prev,
      active: false,
      running: false,
      remainingSeconds: 0
    }));
  };

  const formatSecs = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  
  const [bgmFile, setBgmFile] = useState('');
  const [bgmUrl, setBgmUrl] = useState(null);
  const [bgmPaused, setBgmPaused] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.5);
  const [bgmMode, setBgmMode] = useState('playlist'); // 'playlist' | 'single-no-repeat' | 'single-repeat'
  const [bgmCurrentTime, setBgmCurrentTime] = useState(0);
  const [bgmDuration, setBgmDuration] = useState(0);
  const bgmAudioRef = useRef(null);
  const bgmDraggingRef = useRef(false);
  const bgmPreMuteVolumeRef = useRef(0.5);

  const [localRemoteCommand, setLocalRemoteCommand] = useState(null);

  const handleBgmSkip = (direction) => {
     if (!bgmFile || !flatAudioFiles.length) return;
     const currentIndex = flatAudioFiles.findIndex(f => f.displayPath === bgmFile);
     if (currentIndex === -1) return;
     
     let nextIndex = currentIndex + direction;
     if (nextIndex < 0) nextIndex = flatAudioFiles.length - 1;
     if (nextIndex >= flatAudioFiles.length) nextIndex = 0;
     
     setBgmFile(flatAudioFiles[nextIndex].displayPath);
  };

  const [flatAudioFiles, setFlatAudioFiles] = useState([]);
  const currentLoadedBgmFileRef = useRef('');
  const bgmUrlRef = useRef(null);

  useEffect(() => {
    let isCancelled = false;
    const scan = async () => {
       const flat = [];
       const traverse = async (handles, path = '') => {
           for (const f of handles) {
               if (!f || !f.name) continue;
               
               // If it's a file, check extension
               if (!f.isDirectory) {
                   const isAudio = /\.(mp3|wav|m4a|aac|ogg|flac|m4p)$/i.test(f.name);
                   if (isAudio) {
                      flat.push({ ...f, displayPath: path ? `${path}/${f.name}` : f.name });
                   }
               } else if (f.isDirectory && f.handle && f.handle.entries) {
                   // If it's a directory, recurse
                   try {
                       const children = [];
                       for await (const [name, handle] of f.handle.entries()) {
                           children.push({ name, handle, isDirectory: handle.kind === 'directory' });
                       }
                       await traverse(children, path ? `${path}/${f.name}` : f.name);
                   } catch (e) {
                       console.warn("BGM Scan failed for folder:", f.name, e);
                   }
               }
           }
       };
       
       if (musicFiles && musicFiles.length > 0) {
          await traverse(musicFiles);
          if (!isCancelled) {
              const sorted = flat.sort((a,b) => a.displayPath.localeCompare(b.displayPath, undefined, {numeric: true}));
              setFlatAudioFiles(prev => {
                  if (prev.length === sorted.length && prev.every((f, i) => f.displayPath === sorted[i].displayPath)) {
                      return prev;
                  }
                  return sorted;
              });
          }
       }
    };
    scan();
    return () => { isCancelled = true; };
  }, [musicFiles]);

  useEffect(() => {
    if (!bgmFile) {
       if (bgmUrlRef.current) {
          try { URL.revokeObjectURL(bgmUrlRef.current); } catch {}
          bgmUrlRef.current = null;
       }
       currentLoadedBgmFileRef.current = '';
       setBgmUrl(null);
       return;
    }

    // Preserve existing loaded audio if the selected file has not changed
    if (currentLoadedBgmFileRef.current === bgmFile && bgmUrlRef.current) {
       return;
    }

    const match = flatAudioFiles?.find(f => f.displayPath === bgmFile);
    if (!match) return;
    
    let isCancelled = false;
    match.handle.getFile().then(file => {
       if (!isCancelled) {
          if (bgmUrlRef.current) {
             try { URL.revokeObjectURL(bgmUrlRef.current); } catch {}
          }
          const url = URL.createObjectURL(file);
          bgmUrlRef.current = url;
          currentLoadedBgmFileRef.current = bgmFile;
          setBgmUrl(url);
       }
    }).catch(e => {
       console.warn("BGM load error:", e);
    });

    return () => { isCancelled = true; };
  }, [bgmFile, flatAudioFiles]);

  useEffect(() => {
    if (bgmAudioRef.current) {
        if (bgmPaused) bgmAudioRef.current.pause();
        else {
           bgmAudioRef.current.muted = false;
           bgmAudioRef.current.volume = bgmVolume;
           bgmAudioRef.current.play().catch(() => {});
        }
    }
  }, [bgmPaused, bgmVolume, bgmUrl]);


  // localStatus is updated IMMEDIATELY when the preview's OutputScreen reports an event.
  // This gives instant playhead movement and icon state without waiting for the
  // BroadcastChannel → App.jsx → prop roundtrip.
  const [localStatus, setLocalStatus] = useState({ time: 0, duration: 0, paused: true });

  const isDragging = useRef(false);
  const isDraggingVol = useRef(false);
  const lastBroadcastRef = useRef(0);
  const previewRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(0.2);
  const lastStatusUpdateRef = useRef(0);
  const scrubTimeRef = useRef(0);

  // Merge: prefer the App-level playbackStatus (which can include projector popup feedback)
  // but also update immedialety from localStatus for snappy UI.
  const displayTime = isDragging.current
    ? scrubTime
    : (playbackStatus?.time || localStatus.time || livePayload?.currentTime || 0);
  const displayDuration = playbackStatus?.duration || localStatus.duration || livePayload?.duration || 0;
  // Use localStatus.paused for instant icon response; playbackStatus confirms from projector.
  const displayPaused = playbackStatus?.paused !== undefined
    ? playbackStatus.paused
    : (localStatus.paused !== undefined ? localStatus.paused : presentationPaused);
  const displayVolume = isDraggingVol.current ? playVolume : (playbackStatus?.volume ?? playVolume);

  // 16:9 preview scaler
  useEffect(() => {
     if (!previewRef.current) return;
     const ro = new ResizeObserver((entries) => {
        for (let entry of entries) {
           setPreviewScale(entry.contentRect.width / 1600);
        }
     });
     ro.observe(previewRef.current);
     return () => ro.disconnect();
  }, []);

  // broadcastPlayback sends a command to the projector popup via BroadcastChannel
  const broadcastPlayback = (cmdType, val) => {
     if (cmdType === 'seek') {
        const now = Date.now();
        if (now - lastBroadcastRef.current < 50) return;
        lastBroadcastRef.current = now;
     }
     const channel = new BroadcastChannel('presenter-projector-hub');
     channel.postMessage({
        type: 'playback',
        command: cmdType,
        value: val,
        source: 'dashboard-ui',
        isYoutube: livePayload?.isYouTube,
        isVimeo: livePayload?.isVimeo
     });
     channel.close();
  };

  // notifyAppOfStatus tells App.jsx to update its playbackStatus state (and re-send to network)
  const notifyAppOfStatus = useCallback((fresh) => {
     const channel = new BroadcastChannel('presenter-projector-hub');
     channel.postMessage({
        type: 'status',
        time: fresh.time,
        paused: fresh.paused,
        duration: fresh.duration,
        ts: Date.now(),
        slideshowInterval: fresh.slideshowInterval,
        itemId: livePayload?.itemId
     });
     channel.close();
  }, [livePayload?.itemId]);

  // handleStatusUpdate is called by the preview's OutputScreen (isMaster=true) on every
  // time/play/pause event. We update localStatus immediately for snappy controls.
  const handleStatusUpdate = useCallback((status) => {
     if (!status) return;
     setLocalStatus(prev => {
        const next = {
           time:     status.time     !== undefined ? status.time     : prev.time,
           duration: status.duration !== undefined ? status.duration : prev.duration,
           paused:   status.paused   !== undefined ? status.paused   : prev.paused,
        };
        
        // Only notify App (which triggers global re-renders and network broadcasts) if 
        // paused state changes, duration changes, or time jumps significantly (> 1.5s).
        // Continuous time updates are handled by client-side interpolation.
        if (next.paused !== prev.paused || next.duration !== prev.duration || Math.abs(next.time - prev.time) > 1.5) {
            notifyAppOfStatus({ time: next.time, paused: next.paused, duration: next.duration });
        }
        
        return next;
     });
  }, [notifyAppOfStatus]);

    const isLiveRef = useRef(isLive);
    useEffect(() => {
       isLiveRef.current = isLive;
       if (!isLive) {
           setLocalStatus(prev => {
               const next = { ...prev, paused: true };
               notifyAppOfStatus({ time: next.time, paused: true, duration: next.duration });
               return next;
           });
           setPresentationPaused(true);
           broadcastPlayback('pause');
           setLocalRemoteCommand({ type: 'playback', command: 'pause', ts: Date.now() });
           setBgmPaused(true);
       } else {
           if (livePayload?.itemAutoPlay) {
               setLocalStatus(prev => {
                   const next = { ...prev, paused: false };
                   notifyAppOfStatus({ time: next.time, paused: false, duration: next.duration });
                   return next;
               });
               setPresentationPaused(false);
               broadcastPlayback('play');
           }
       }
    }, [isLive]);

    // Reset localStatus when item changes
    useEffect(() => {
       setLocalStatus({ time: 0, duration: 0, paused: isLiveRef.current ? !livePayload?.itemAutoPlay : true });
       setLocalRemoteCommand(null);
    }, [livePayload?.activeMediaUrl]);

    // Force sync when App.jsx pauses the presentation (e.g. window closed)
    useEffect(() => {
       if (presentationPaused) {
           setLocalStatus(prev => ({ ...prev, paused: true }));
       }
    }, [presentationPaused]);

  const formatTime = (sec) => {
     if (!sec || isNaN(sec) || sec <= 0) return "0:00";
     const m = Math.floor(sec / 60);
     const s = Math.floor(sec % 60);
     return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const preMuteVolumeRef = useRef(1);

  return (
    <div className="flex flex-col items-center h-full space-y-4 pt-1">

      {/* 1. Live Preview Box */}
      <div className="w-full">
        <div className="text-[10px] font-bold text-[#526075] uppercase tracking-widest mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
             <span className={`w-2 h-2 rounded-full transition-colors ${isLive ? 'bg-emerald-600 animate-pulse' : 'bg-[#B91C1C]'}`}></span>
             Live Output Preview
          </div>
        </div>

        <div
           ref={previewRef}
           className={`aspect-video w-full bg-black rounded-xl border-2 transition-colors duration-300 overflow-hidden relative ${isLive ? 'border-emerald-600/50' : 'border-[#E4E1DA]'}`}
        >
           <div style={{
             width: '1600px', height: '900px',
             transform: `scale(${previewScale})`,
             transformOrigin: 'top left',
             position: 'absolute', top: 0, left: 0
           }}>
              {/* isMaster determines if this preview is the local status authority.
                  If projector is connected, the projector is the master authority and this becomes a follower. */}
              <OutputScreen
                payload={livePayload}
                isMaster={!projectorConnected || !isLive}
                muteAudio={livePayload?.mediaType !== 'audio'}
                isProjector={false}
                onStatusUpdate={handleStatusUpdate}
                remoteCommand={localRemoteCommand || remoteCommand}
                isLiveBroadcast={true}
              />
           </div>
        </div>

        {/* 2. Playback Controls */}
        {(livePayload?.mediaType === 'video' || livePayload?.mediaType === 'audio' || livePayload?.mediaType === 'slide_deck' || livePayload?.mediaType === 'image') && (
           <div className="mt-3 bg-white border border-[#E4E1DA] rounded-xl p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                 <button
                   
                   onClick={() => {
                      const nextPaused = !displayPaused;
                      // Update localStatus immediately for instant icon switch
                      setLocalStatus(prev => ({ ...prev, paused: nextPaused }));
                      
                      const cmd = { type: 'playback', command: nextPaused ? 'pause' : 'play', ts: Date.now() };
                      setLocalRemoteCommand(cmd);

                      notifyAppOfStatus({ time: displayTime, paused: nextPaused, duration: displayDuration });
                      broadcastPlayback(nextPaused ? 'pause' : 'play');
                      setPresentationPaused(nextPaused);
                   }}
                   
                   className="w-12 h-12 bg-[#3D7B8C] hover:bg-[#2F6473] text-white rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                 >
                    {displayPaused
                      ? <Play size={20} fill="currentColor" className="ml-1" />
                      : <Pause size={20} fill="currentColor" />}
                 </button>

                 {(livePayload?.mediaType === 'video' || livePayload?.mediaType === 'audio') ? (
                     <>
                         <div className="flex-1 flex flex-col gap-1">
                            {/* Seek / playhead slider */}
                            <input
                              type="range"
                              min="0"
                              max={displayDuration || 100}
                              step="0.1"
                              value={Math.min(displayTime, displayDuration || 100)}
                              onMouseDown={() => { isDragging.current = true; setScrubTime(displayTime); }}
                              onMouseUp={() => {
                                 isDragging.current = false;
                                 const channel = new BroadcastChannel('presenter-projector-hub');
                                 channel.postMessage({
                                    type: 'playback', command: 'seek', value: scrubTimeRef.current,
                                    source: 'dashboard-ui', isYoutube: livePayload?.isYouTube, isVimeo: livePayload?.isVimeo
                                 });
                                 channel.close();
                                 setLocalRemoteCommand({ type: 'playback', command: 'seek', value: scrubTimeRef.current, ts: Date.now() });
                                 
                                 if (!displayPaused) {
                                     setTimeout(() => {
                                         broadcastPlayback('play');
                                         setLocalRemoteCommand({ type: 'playback', command: 'play', ts: Date.now() });
                                     }, 50);
                                 }
                                 setLocalStatus(prev => ({ ...prev, time: scrubTimeRef.current }));
                                 notifyAppOfStatus({ time: scrubTimeRef.current, paused: displayPaused, duration: displayDuration });
                              }}
                              onChange={(e) => {
                                 const time = parseFloat(e.target.value);
                                 scrubTimeRef.current = time;
                                 setScrubTime(time);
                                 broadcastPlayback('seek', time);
                                 const now = Date.now();
                                 if (now - lastStatusUpdateRef.current > 200) {
                                    lastStatusUpdateRef.current = now;
                                    notifyAppOfStatus({ time, paused: displayPaused, duration: displayDuration });
                                 }
                              }}
                              
                              className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none accent-[#3D7B8C] cursor-pointer"
                            />
                            {/* Time display */}
                            <div className="flex justify-between text-[10px] font-bold font-mono tracking-tighter">
                               <span className={displayTime > 0 ? "text-[#3D7B8C]" : "text-[#526075]"}>
                                  {formatTime(displayTime)}
                               </span>
                               <div className="flex items-center gap-2">
                                  {isSyncingMedia && <span className="text-[#3D7B8C] animate-pulse uppercase tracking-tighter">Syncing...</span>}
                                  <span className="text-[#1C355E] font-bold">
                                     -{formatTime(Math.max(0, displayDuration - displayTime))}
                                  </span>
                               </div>
                            </div>
                         </div>

                         {/* Restart button */}
                         <button
                            
                            onClick={() => {
                               setScrubTime(0);
                               setLocalStatus(prev => ({ ...prev, time: 0, paused: false }));
                               setPresentationPaused(false);
                               broadcastPlayback('seek', 0);
                               setTimeout(() => broadcastPlayback('play'), 100);
                               notifyAppOfStatus({ time: 0, paused: false, duration: displayDuration });
                            }}
                            className="w-9 h-9 bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA] rounded-full flex items-center justify-center transition-colors cursor-pointer"
                         >
                            <RotateCcw size={16} />
                         </button>
                     </>
                 ) : (
                     <div className="flex-1 flex items-center justify-between px-2">
                        <span className="text-xs font-bold text-[#526075] uppercase tracking-widest">Auto Timer</span>
                        <select
                           value={livePayload?.slideshowInterval || 5}
                           onChange={(e) => {
                               notifyAppOfStatus({ slideshowInterval: parseInt(e.target.value) });
                           }}
                           className="bg-[#FAF6F0] border border-[#E4E1DA] hover:bg-[#F0EBE1] text-[#1C355E] text-xs font-bold py-1.5 px-3 rounded-lg outline-none focus:border-[#3D7B8C] transition-colors cursor-pointer"
                        >
                           <option value="3">3 Seconds</option>
                           <option value="5">5 Seconds</option>
                           <option value="10">10 Seconds</option>
                           <option value="15">15 Seconds</option>
                           <option value="20">20 Seconds</option>
                           <option value="30">30 Seconds</option>
                           <option value="60">1 Minute</option>
                        </select>
                     </div>
                 )}
              </div>

              {/* Volume control */}
              {(livePayload.mediaType === 'video' || livePayload.mediaType === 'audio') && (
                  <div className="flex items-center gap-2.5 border-t border-[#E4E1DA] pt-2.5">
                     <button className="cursor-pointer" onClick={() => {
                        const targetVol = displayVolume > 0 ? 0 : (preMuteVolumeRef.current || 1);
                        if (displayVolume > 0) preMuteVolumeRef.current = displayVolume;
                        broadcastPlayback('volume', targetVol);
                        setPlayVolume(targetVol);
                     }}>
                        {displayVolume > 0.5
                          ? <Volume2 size={14} className="text-[#526075]" />
                          : displayVolume > 0
                            ? <Volume2 size={14} className="text-[#526075] opacity-70" />
                            : <VolumeX size={14} className="text-[#B91C1C]" />}
                     </button>
                     <input
                       type="range" min="0" max="1" step="0.1"
                       value={displayVolume}
                       onMouseDown={() => isDraggingVol.current = true}
                       onMouseUp={() => isDraggingVol.current = false}
                       onChange={(e) => {
                          const vol = parseFloat(e.target.value);
                          broadcastPlayback('volume', vol);
                          setPlayVolume(vol);
                       }}
                       className="flex-1 h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                     />
                  </div>
              )}
           </div>
        )}
      </div>

      {/* 3. Background Music Control */}
      <div className="w-full bg-white border border-[#E4E1DA] rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-[#526075] uppercase tracking-widest flex items-center gap-1.5"><Volume2 size={12} className="text-[#3D7B8C]"/> Background Music</span>
          </div>
          
          <select 
             value={bgmFile} 
             onChange={(e) => {
                 setBgmFile(e.target.value);
                 setBgmCurrentTime(0);
                 if (e.target.value) setBgmPaused(true);
             }}
             className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-lg text-xs py-2 px-2.5 text-[#1C355E] outline-none focus:border-[#3D7B8C] transition-colors mb-2 cursor-pointer"
          >
             <option value="">No background music</option>
             {flatAudioFiles?.map(f => (
                <option key={f.displayPath} value={f.displayPath}>{f.displayPath}</option>
             ))}
          </select>

          {bgmFile && (
             <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-2">
                    <button
                      disabled={!bgmFile}
                      onClick={() => handleBgmSkip(-1)}
                      className="p-1.5 text-[#526075] hover:text-[#1C355E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                       <SkipBack size={14} fill="currentColor" />
                    </button>
                    <button
                      disabled={!bgmFile}
                      onClick={() => setBgmPaused(!bgmPaused)}
                      className="w-10 h-10 bg-[#3D7B8C] hover:bg-[#2F6473] text-white rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                       {bgmPaused || !bgmFile
                         ? <Play size={16} fill="currentColor" className="ml-0.5" />
                         : <Pause size={16} fill="currentColor" />}
                    </button>
                    <button
                      disabled={!bgmFile}
                      onClick={() => handleBgmSkip(1)}
                      className="p-1.5 text-[#526075] hover:text-[#1C355E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                       <SkipForward size={14} fill="currentColor" />
                    </button>

                    <button
                       disabled={!bgmFile}
                       onClick={() => {
                          if (bgmMode === 'playlist') setBgmMode('single-no-repeat');
                          else if (bgmMode === 'single-no-repeat') setBgmMode('single-repeat');
                          else setBgmMode('playlist');
                       }}
                       className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ml-2 cursor-pointer ${bgmMode !== 'single-no-repeat' ? 'bg-[#3D7B8C] text-white' : 'bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#526075] border border-[#E4E1DA]'} disabled:opacity-50 disabled:cursor-not-allowed`}
                       title={bgmMode === 'playlist' ? "Playlist Mode (Folder)" : bgmMode === 'single-repeat' ? "Repeat Single Track" : "Play Once"}
                    >
                       {bgmMode === 'playlist' ? <Repeat size={14} /> : bgmMode === 'single-repeat' ? <Repeat1 size={14} /> : <ArrowRight size={14} />}
                    </button>

                    <div className="flex-1 flex items-center gap-2 ml-2 border-l border-[#E4E1DA] pl-3 min-w-0">
                        <button 
                            disabled={!bgmFile}
                            className="disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            onClick={() => {
                            if (bgmVolume > 0) {
                                bgmPreMuteVolumeRef.current = bgmVolume;
                                setBgmVolume(0);
                            } else {
                                setBgmVolume(bgmPreMuteVolumeRef.current || 0.5);
                            }
                        }}>
                           {bgmVolume > 0 ? <Volume2 size={14} className="text-[#526075] hover:text-[#1C355E] transition-colors" /> : <VolumeX size={14} className="text-[#B91C1C]" />}
                        </button>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={bgmVolume}
                            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                            className="w-full min-w-0 h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                        />
                    </div>
                 </div>

                 {/* Scrubber */}
                 <div className="flex flex-col gap-1 w-full">
                    <input
                      disabled={!bgmFile}
                      type="range"
                      min="0"
                      max={bgmDuration || 100}
                      step="0.1"
                      value={Math.min(bgmCurrentTime, bgmDuration || 100)}
                      onMouseDown={() => { bgmDraggingRef.current = true; }}
                      onMouseUp={() => {
                         bgmDraggingRef.current = false;
                         if (bgmAudioRef.current) {
                            bgmAudioRef.current.currentTime = bgmCurrentTime;
                         }
                      }}
                      onChange={(e) => {
                         setBgmCurrentTime(parseFloat(e.target.value));
                      }}
                      className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[10px] font-bold font-mono tracking-tighter uppercase">
                       <span className={bgmCurrentTime > 0 ? "text-[#3D7B8C]" : "text-[#526075]"}>
                          {formatTime(bgmCurrentTime)}
                       </span>
                       <span className="text-[#526075]">
                          -{formatTime(Math.max(0, bgmDuration - bgmCurrentTime))}
                       </span>
                    </div>
                 </div>
              </div>
          )}
      </div>
      {bgmUrl && (
          <audio 
             ref={bgmAudioRef} 
             src={bgmUrl} 
             loop={bgmMode === 'single-repeat'} 
             onTimeUpdate={(e) => {
                 if (!bgmDraggingRef.current) setBgmCurrentTime(e.target.currentTime);
             }}
             onLoadedMetadata={(e) => {
                 setBgmDuration(e.target.duration);
             }}
             onEnded={() => {
                 if (bgmMode === 'playlist') {
                     handleBgmSkip(1);
                 } else if (bgmMode === 'single-no-repeat') {
                     setBgmPaused(true);
                 }
             }}
             className="hidden" 
          />
      )}

      {/* GO LIVE button */}
      <button
        onClick={toggleLive}
        className={`w-full py-4 text-lg font-extrabold rounded-xl transition-colors flex items-center justify-center gap-3 shadow-sm cursor-pointer ${
          isLive ? 'bg-[#B91C1C] hover:bg-[#991B1B] text-white' : 'bg-[#7A502A] hover:bg-[#654121] text-white'
        }`}
      >
        <MonitorPlay size={20} />
        {isLive ? 'END LIVE' : 'GO LIVE'}
      </button>

      {/* Black Screen Panic / Blanking Button */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setIsBlackScreen(!isBlackScreen)}
          className={`w-full p-3.5 border rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-sm ${
            isBlackScreen
              ? 'bg-[#111827] border-[#111827] text-white ring-2 ring-[#B91C1C]/50'
              : 'bg-white hover:bg-[#F0EBE1] border-[#E4E1DA] text-[#1C355E]'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${isBlackScreen ? 'bg-red-500 animate-pulse' : 'bg-[#526075]/50'}`} />
          <span>{isBlackScreen ? 'Black Screen Active' : 'Black Screen'}</span>
        </button>
      </div>

      {/* 4. Screen Overlays (Ad Hoc Announcement & Pre-Service Countdown) */}
      <div className="w-full bg-white border border-[#E4E1DA] rounded-xl p-3 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-[#526075] uppercase tracking-widest flex items-center gap-1.5">
            <Bell size={12} className="text-[#3D7B8C]" /> Screen Overlays
          </span>
          {(announcement?.active || countdown?.active) && (
            <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#92400E] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Live
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Announcement Button */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveOverlayModal('announcement')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border cursor-pointer ${
                announcement?.active
                  ? 'bg-[#7A502A] text-white border-[#7A502A]'
                  : 'bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] border-[#E4E1DA]'
              }`}
            >
              <Megaphone size={14} />
              <span>{announcement?.active ? 'Alert Live' : 'Alert'}</span>
              {announcement?.active && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
            </button>
            {announcement?.active && (
              <button
                type="button"
                onClick={handleDismissAnnouncement}
                title="Dismiss Alert from screen"
                className="p-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg transition-colors shadow-sm flex-shrink-0 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Countdown Button */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveOverlayModal('countdown')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border cursor-pointer ${
                countdown?.active
                  ? countdown.running
                    ? 'bg-[#3D7B8C] text-white border-[#3D7B8C]'
                    : 'bg-[#7A502A] text-white border-[#7A502A]'
                  : 'bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] border-[#E4E1DA]'
              }`}
            >
              <Timer size={14} />
              <span className="font-mono">
                {countdown?.active ? formatSecs(countdownRemaining) : 'Timer'}
              </span>
              {countdown?.active && countdown.running && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              )}
            </button>
            {countdown?.active && (
              <button
                type="button"
                onClick={handleStopCountdown}
                title="Stop & hide countdown"
                className="p-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white rounded-lg transition-colors shadow-sm flex-shrink-0 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. Spacious Announcement Modal */}
      {activeOverlayModal === 'announcement' && (
        <div 
          className="fixed inset-0 bg-[#1C355E]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveOverlayModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl border border-[#E4E1DA] max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FAF6F0] border-b border-[#E4E1DA] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4E5] text-[#7A502A] border border-[#E4E1DA] flex items-center justify-center">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1C355E]">Live Screen Announcement</h3>
                  <p className="text-xs text-[#526075]">Display an emergency or ad-hoc notice over the live screen</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {announcement?.active && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#92400E] bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    Live on Screen
                  </span>
                )}
                <button 
                  type="button"
                  onClick={() => setActiveOverlayModal(null)}
                  className="p-1.5 rounded-lg text-[#526075] hover:text-[#1C355E] hover:bg-[#F0EBE1] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Quick Template Chips */}
              <div>
                <label className="block text-[11px] font-bold text-[#526075] uppercase tracking-wider mb-2">
                  Quick Templates
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Car reg [ABC-123] is blocking the driveway",
                    "Parents of toddler in Crèche please attend",
                    "Children may now leave for Sunday School",
                    "Tea & Coffee served immediately after the service"
                  ].map(template => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setAnnouncementInput(template)}
                      className="text-xs bg-[#FAF6F0] hover:bg-[#EDF4F6] hover:text-[#2F6473] text-[#1C355E] px-2.5 py-1.5 rounded-lg border border-[#E4E1DA] transition-colors text-left cursor-pointer"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-[11px] font-bold text-[#526075] uppercase tracking-wider mb-2">
                  Announcement Message
                </label>
                <textarea
                  rows={2}
                  value={announcementInput}
                  onChange={e => setAnnouncementInput(e.target.value)}
                  placeholder="e.g. Car reg AB12 CDE is blocking the car park exit..."
                  className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl p-3.5 text-sm text-[#1C355E] placeholder:text-[#526075]/65 focus:outline-none focus:border-[#3D7B8C] resize-none font-medium leading-relaxed"
                  autoFocus
                />
              </div>

              {/* Auto-Dismiss Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-[#526075] uppercase tracking-wider">
                    Auto-Dismiss Timer
                  </label>
                  <span className="text-xs text-[#526075]">
                    {autoDismissSecs === 0 ? "Stays on screen until manually dismissed" : `Disappears automatically after ${autoDismissSecs}s`}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: 0, label: 'Manual' },
                    { val: 30, label: '30 Seconds' },
                    { val: 60, label: '60 Seconds' },
                    { val: 120, label: '2 Minutes' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setAutoDismissSecs(opt.val)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                        autoDismissSecs === opt.val
                          ? 'bg-[#1C355E] text-white border-[#1C355E]'
                          : 'bg-white hover:bg-[#FAF6F0] text-[#1C355E] border-[#E4E1DA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exact 1:1 Live Preview Box matching Settings */}
              <div>
                <label className="block text-[11px] font-bold text-[#526075] uppercase tracking-wider mb-1.5">
                  Live Screen Appearance (1:1 Preview)
                </label>
                <div
                  className="aspect-video w-full rounded-xl border border-[#E4E1DA] relative overflow-hidden"
                  style={{ backgroundColor: livePayload?.backgrounds?.song?.bgColor || '#0B132B' }}
                >
                  <div className="absolute inset-0" style={{ containerType: 'size' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1C355E]/35 via-neutral-950/80 to-[#0F291E]/35 pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-[10%]">
                      <div
                        className="text-white/30 font-bold text-center leading-relaxed"
                        style={{ fontSize: '6.5cqh', fontFamily: getFontFamilyCss(livePayload?.displayFont) }}
                      >
                        {livePayload?.activeSlide?.length
                          ? livePayload.activeSlide.slice(0, 2).map((ln, idx) => <div key={idx}>{ln}</div>)
                          : <div>{livePayload?.churchName || 'Live Output Screen'}</div>}
                      </div>
                    </div>

                    <AnnouncementOverlay
                      announcement={{
                        active: true,
                        text: announcementInput.trim() || 'Type an announcement message above to preview...'
                      }}
                      settings={{
                        ...(overlaySettings?.announcement || {}),
                        fontFamily: getFontFamilyCss(livePayload?.displayFont)
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#FAF6F0] border-t border-[#E4E1DA] flex items-center justify-between gap-3 flex-shrink-0">
              <div>
                {announcement?.active && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDismissAnnouncement();
                      setActiveOverlayModal(null);
                    }}
                    className="px-4 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <X size={16} /> Dismiss from Screen
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveOverlayModal(null)}
                  className="px-4 py-2.5 bg-white hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleShowAnnouncement();
                    setActiveOverlayModal(null);
                  }}
                  disabled={!announcementInput.trim()}
                  className="px-5 py-2.5 bg-[#7A502A] hover:bg-[#654121] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  <Megaphone size={16} />
                  {announcement?.active ? 'Update Screen' : 'Show on Screen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Spacious Countdown Modal */}
      {activeOverlayModal === 'countdown' && (
        <div 
          className="fixed inset-0 bg-[#1C355E]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setActiveOverlayModal(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl border border-[#E4E1DA] max-w-xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FAF6F0] border-b border-[#E4E1DA] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EDF4F6] text-[#3D7B8C] border border-[#3D7B8C]/25 flex items-center justify-center">
                  <Timer size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#1C355E]">Pre-Service Countdown Timer</h3>
                  <p className="text-xs text-[#526075]">Synchronized countdown using your configured timer styling & backdrop</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {countdown?.active && (
                  <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                    countdown.running 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                      : 'bg-amber-50 text-[#92400E] border-amber-300'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${countdown.running ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                    {countdown.running ? 'Running' : 'Paused'}
                  </span>
                )}
                <button 
                  type="button"
                  onClick={() => setActiveOverlayModal(null)}
                  className="p-1.5 rounded-lg text-[#526075] hover:text-[#1C355E] hover:bg-[#F0EBE1] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {/* 1:1 Live Countdown Screen Preview reflecting all Settings */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#526075] uppercase tracking-wider">
                    Live Screen Preview
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[#3D7B8C]">
                    {countdown?.active ? formatSecs(countdownRemaining) : formatSecs(Math.round((countdownMins || 5) * 60))}
                  </span>
                </div>
                <div className="aspect-video w-full rounded-xl bg-neutral-900 border border-[#E4E1DA] relative overflow-hidden">
                  <div className="absolute inset-0" style={{ containerType: 'size' }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-neutral-950 to-neutral-900 flex flex-col items-center justify-center pointer-events-none opacity-45">
                      <div className="text-white/40 font-black tracking-tight text-center px-[6%]" style={{ fontSize: '5.5cqh' }}>
                        {livePayload?.churchName || 'Standby Screen'}
                      </div>
                    </div>

                    <CountdownOverlay
                      countdown={
                        countdown?.active
                          ? countdown
                          : {
                              active: true,
                              running: false,
                              remainingSeconds: Math.round((countdownMins || 5) * 60),
                              title: countdownTitle.trim(),
                              endMessage: countdownEndMessage.trim() || 'Welcome! Service starting shortly'
                            }
                      }
                      settings={{
                        ...(overlaySettings?.countdown || {}),
                        fontFamily: getFontFamilyCss(livePayload?.displayFont)
                      }}
                      countdownBg={livePayload?.backgrounds?.countdown}
                    />
                  </div>
                </div>

                {/* Live Playback Controls when timer is active */}
                {countdown?.active && (
                  <div className="flex items-center justify-between gap-2 mt-3 p-3 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA]">
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-[#3D7B8C]" />
                      <span className="text-sm font-black font-mono text-[#1C355E]">
                        {formatSecs(countdownRemaining)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {countdown.running ? (
                        <button
                          type="button"
                          onClick={handlePauseCountdown}
                          className="px-3.5 py-2 bg-[#7A502A] hover:bg-[#654121] text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Pause size={14} /> Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResumeCountdown}
                          className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Play size={14} /> Resume
                        </button>
                      )}

                      {/* Adjust +1 min */}
                      <button
                        type="button"
                        onClick={() => {
                          if (countdown.running && countdown.targetTimeMs) {
                            setCountdown(prev => ({ ...prev, targetTimeMs: prev.targetTimeMs + 60000 }));
                          } else {
                            setCountdown(prev => ({ ...prev, remainingSeconds: (prev.remainingSeconds || 0) + 60 }));
                          }
                        }}
                        className="px-3 py-2 bg-white hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        title="Add 1 minute"
                      >
                        <Plus size={12} /> 1m
                      </button>

                      {/* Adjust -1 min */}
                      <button
                        type="button"
                        onClick={() => {
                          if (countdown.running && countdown.targetTimeMs) {
                            setCountdown(prev => ({ ...prev, targetTimeMs: Math.max(Date.now() + 5000, prev.targetTimeMs - 60000) }));
                          } else {
                            setCountdown(prev => ({ ...prev, remainingSeconds: Math.max(5, (prev.remainingSeconds || 0) - 60) }));
                          }
                        }}
                        className="px-3 py-2 bg-white hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        title="Subtract 1 minute"
                      >
                        <Minus size={12} /> 1m
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Duration Preset Chips */}
              <div>
                <label className="block text-[11px] font-bold text-[#526075] uppercase tracking-wider mb-2">
                  Select Duration
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 5, 10, 15].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setCountdownMins(m);
                        if (countdown?.active) {
                          const totalSecs = m * 60;
                          setCountdown(prev => ({
                            ...prev,
                            targetTimeMs: Date.now() + totalSecs * 1000,
                            initialSeconds: totalSecs,
                            remainingSeconds: totalSecs,
                            running: true
                          }));
                        }
                      }}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-colors border cursor-pointer ${
                        countdownMins === m
                          ? 'bg-[#1C355E] text-white border-[#1C355E]'
                          : 'bg-white hover:bg-[#FAF6F0] text-[#1C355E] border-[#E4E1DA]'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Countdown Header Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#526075] uppercase tracking-wider mb-1.5">
                  Countdown Header
                </label>
                <input
                  type="text"
                  value={countdownTitle}
                  onChange={e => handleCountdownTitleChange(e.target.value)}
                  placeholder="e.g. Service starts in (leave blank to hide header)"
                  className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-3.5 py-2.5 text-sm text-[#1C355E] placeholder:text-[#526075]/65 focus:outline-none focus:border-[#3D7B8C] font-medium"
                />
              </div>

              {/* End of Countdown Message Input */}
              <div>
                <label className="block text-[11px] font-bold text-[#526075] uppercase tracking-wider mb-1.5">
                  End of Countdown Message (at 00:00)
                </label>
                <input
                  type="text"
                  value={countdownEndMessage}
                  onChange={e => handleCountdownEndMessageChange(e.target.value)}
                  placeholder="e.g. Welcome! Service starting shortly"
                  className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-3.5 py-2.5 text-sm text-[#1C355E] placeholder:text-[#526075]/65 focus:outline-none focus:border-[#3D7B8C] font-medium"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#FAF6F0] border-t border-[#E4E1DA] flex items-center justify-between gap-3 flex-shrink-0">
              <div>
                {countdown?.active && (
                  <button
                    type="button"
                    onClick={() => {
                      handleStopCountdown();
                      setActiveOverlayModal(null);
                    }}
                    className="px-4 py-2.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <X size={16} /> Stop & Hide Timer
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveOverlayModal(null)}
                  className="px-4 py-2.5 bg-white hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                {!countdown?.active && (
                  <button
                    type="button"
                    onClick={() => {
                      handleStartCountdown();
                      setActiveOverlayModal(null);
                    }}
                    className="px-5 py-2.5 bg-[#7A502A] hover:bg-[#654121] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Play size={16} /> Start {countdownMins}m Countdown
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
