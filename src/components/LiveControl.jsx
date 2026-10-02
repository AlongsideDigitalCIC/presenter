import { useState, useEffect, useRef, useCallback } from 'react';
import { MonitorPlay, MonitorX, Image as ImageIcon, Plus, Play, Pause, RotateCcw, Volume2, VolumeX, Repeat, Repeat1, SkipBack, SkipForward, ArrowRight } from 'lucide-react';
import OutputScreen from './OutputScreen';

export default function LiveControl({ 
    isLive, toggleLive, 
    isBlackScreen, setIsBlackScreen, 
    isShowLogo, setIsShowLogo, 
    onPickLogo, livePayload,
    remoteCommand = null,
    playbackStatus = { time: 0, duration: 0, paused: true, volume: 1 },
    presentationPaused = true,
    setPresentationPaused = () => {},
    isSyncingMedia = false,
    roomId = null,
    musicFiles = [],
    projectorConnected = false
}) {
  const [playVolume, setPlayVolume] = useState(1);
  const [scrubTime, setScrubTime] = useState(0);
  
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
              setFlatAudioFiles(flat.sort((a,b) => a.displayPath.localeCompare(b.displayPath, undefined, {numeric: true})));
          }
       }
    };
    scan();
    return () => { isCancelled = true; };
  }, [musicFiles]);

  useEffect(() => {
    if (!bgmFile) {
       setBgmUrl(null);
       return;
    }
    const match = flatAudioFiles?.find(f => f.displayPath === bgmFile);
    if (!match) return;
    
    let isCancelled = false;
    match.handle.getFile().then(file => {
       if (!isCancelled) setBgmUrl(URL.createObjectURL(file));
    });
    return () => { isCancelled = true; }
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

  const handlePickLogo = async (e) => {
    e.stopPropagation();
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'] } }]
      });
      const file = await fileHandle.getFile();
      const { set } = await import('idb-keyval');
      await set('presenter_logo_blob', file);
      onPickLogo(URL.createObjectURL(file));
      setIsShowLogo(true);
    } catch(err) {}
  };

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
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
             <span className={`w-2 h-2 rounded-full transition-colors ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
             Live Output Preview
          </div>
        </div>

        <div
           ref={previewRef}
           className={`aspect-video w-full bg-[#F7F7F7] rounded-xl border-2 shadow-inner transition-colors duration-500 overflow-hidden relative ${isLive ? 'border-green-500/30' : 'border-[#3D7B8C]/10'}`}
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
           <div className="mt-3 bg-white/80 border border-[#3D7B8C]/10 rounded-xl p-3 space-y-2.5 shadow-xl">
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
                   
                   className="w-12 h-12 bg-[#3D7B8C] hover:bg-[#3D7B8C]/90 text-white rounded-full flex items-center justify-center transition active:scale-95 shadow-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
                              
                              className="w-full h-1 bg-[#F7F7F7] rounded-lg appearance-none accent-[#3D7B8C] cursor-pointer"
                            />
                            {/* Time display */}
                            <div className="flex justify-between text-[10px] font-black font-mono tracking-tighter">
                               <span className={displayTime > 0 ? "text-[#3D7B8C]" : "text-neutral-400"}>
                                  {formatTime(displayTime)}
                               </span>
                               <div className="flex items-center gap-2">
                                  {isSyncingMedia && <span className="text-[#3D7B8C] animate-pulse uppercase tracking-tighter">Syncing...</span>}
                                  <span className={displayDuration > 0 ? "text-[#1C355E] font-black" : "text-neutral-600"}>
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
                            className="w-9 h-9 bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-400 rounded-full flex items-center justify-center transition"
                         >
                            <RotateCcw size={16} />
                         </button>
                     </>
                 ) : (
                     <div className="flex-1 flex items-center justify-between px-2">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Auto Timer</span>
                        <select
                           value={livePayload?.slideshowInterval || 5}
                           onChange={(e) => {
                               notifyAppOfStatus({ slideshowInterval: parseInt(e.target.value) });
                           }}
                           className="bg-[#F7F7F7] border border-[#3D7B8C]/20 hover:bg-neutral-200 text-[#1C355E] text-xs font-bold py-1.5 px-3 rounded-lg outline-none focus:border-[#3D7B8C] transition cursor-pointer"
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
                  <div className="flex items-center gap-2.5 border-t border-[#3D7B8C]/10/50 pt-2.5">
                     <button onClick={() => {
                        const targetVol = displayVolume > 0 ? 0 : (preMuteVolumeRef.current || 1);
                        if (displayVolume > 0) preMuteVolumeRef.current = displayVolume;
                        broadcastPlayback('volume', targetVol);
                        setPlayVolume(targetVol);
                     }}>
                        {displayVolume > 0.5
                          ? <Volume2 size={14} className="text-neutral-400" />
                          : displayVolume > 0
                            ? <Volume2 size={14} className="text-neutral-400 opacity-60" />
                            : <VolumeX size={14} className="text-red-500" />}
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
                       className="flex-1 h-1 bg-[#F7F7F7] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                     />
                  </div>
              )}
           </div>
        )}
      </div>

      {/* 3. Background Music Control */}
      <div className="w-full bg-white/80 border border-[#3D7B8C]/10 rounded-xl p-3 shadow-xl">
          <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5"><Volume2 size={12}/> Background Music</span>
          </div>
          
          <select 
             value={bgmFile} 
             onChange={(e) => {
                 setBgmFile(e.target.value);
                 setBgmCurrentTime(0);
                 if (e.target.value) setBgmPaused(true);
             }}
             className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg text-xs py-2 px-2 text-[#1C355E] outline-none focus:border-[#3D7B8C] transition mb-2"
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
                      className="p-1.5 text-neutral-400 hover:text-[#1C355E] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       <SkipBack size={14} fill="currentColor" />
                    </button>
                    <button
                      disabled={!bgmFile}
                      onClick={() => setBgmPaused(!bgmPaused)}
                      className="w-10 h-10 bg-[#3D7B8C] hover:bg-[#3D7B8C]/90 text-white rounded-full flex items-center justify-center transition active:scale-95 shadow-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {bgmPaused || !bgmFile
                         ? <Play size={16} fill="currentColor" className="ml-0.5" />
                         : <Pause size={16} fill="currentColor" />}
                    </button>
                    <button
                      disabled={!bgmFile}
                      onClick={() => handleBgmSkip(1)}
                      className="p-1.5 text-neutral-400 hover:text-[#1C355E] transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                       className={`w-9 h-9 rounded-full flex items-center justify-center transition ml-2 ${bgmMode !== 'single-no-repeat' ? 'bg-[#3D7B8C] text-white shadow-md' : 'bg-[#F7F7F7] hover:bg-neutral-200 text-neutral-400'} disabled:opacity-50 disabled:cursor-not-allowed`}
                       title={bgmMode === 'playlist' ? "Playlist Mode (Folder)" : bgmMode === 'single-repeat' ? "Repeat Single Track" : "Play Once"}
                    >
                       {bgmMode === 'playlist' ? <Repeat size={14} /> : bgmMode === 'single-repeat' ? <Repeat1 size={14} /> : <ArrowRight size={14} />}
                    </button>

                    <div className="flex-1 flex items-center gap-2 ml-2 border-l border-[#3D7B8C]/10 pl-3 min-w-0">
                        <button 
                            disabled={!bgmFile}
                            className="disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                            if (bgmVolume > 0) {
                                bgmPreMuteVolumeRef.current = bgmVolume;
                                setBgmVolume(0);
                            } else {
                                setBgmVolume(bgmPreMuteVolumeRef.current || 0.5);
                            }
                        }}>
                           {bgmVolume > 0 ? <Volume2 size={14} className="text-neutral-400 hover:text-[#1C355E] transition" /> : <VolumeX size={14} className="text-red-500" />}
                        </button>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={bgmVolume}
                            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                            className="w-full min-w-0 h-1.5 bg-[#F7F7F7] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
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
                      className="w-full h-1 bg-[#F7F7F7] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex justify-between text-[9px] font-black font-mono tracking-tighter uppercase">
                       <span className={bgmCurrentTime > 0 ? "text-[#3D7B8C]" : "text-neutral-400"}>
                          {formatTime(bgmCurrentTime)}
                       </span>
                       <span className={bgmDuration > 0 ? "text-neutral-400" : "text-neutral-600"}>
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
        className={`w-full py-4 text-lg font-black rounded-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
          isLive ? 'bg-red-700 hover:bg-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-[#3D7B8C] hover:bg-[#3D7B8C]/90 text-white shadow-lg shadow-[#3D7B8C]/30'
        }`}
      >
        <MonitorPlay size={20} />
        {isLive ? 'END LIVE' : 'GO LIVE'}
      </button>

      <div className="w-full space-y-3">
        

        <button
          onClick={() => setIsBlackScreen(!isBlackScreen)}
          className={`w-full p-3.5 border-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
            isBlackScreen
              ? 'bg-black border-black text-white shadow-lg'
              : 'bg-[#F7F7F7] hover:bg-white border-[#3D7B8C]/10 text-neutral-400'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isBlackScreen ? 'bg-white' : 'bg-neutral-200'}`} />
          Black Screen
        </button>

        <div className="relative w-full flex">
          <button
            onClick={() => setIsShowLogo(!isShowLogo)}
            className={`flex-1 p-3.5 border-y-2 border-l-2 rounded-l-xl text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-3 ${
              isShowLogo ? 'bg-[#3D7B8C]/10 border-[#3D7B8C] text-[#3D7B8C]' : 'bg-white/50 border-[#3D7B8C]/10 text-neutral-400'
            }`}
          >
            <ImageIcon size={16} />
            Show Logo
          </button>

          <button
            onClick={handlePickLogo}
            className={`px-4 border-y-2 border-r-2 rounded-r-xl transition flex items-center justify-center ${
              isShowLogo ? 'bg-[#3D7B8C] border-[#3D7B8C] text-white' : 'bg-neutral-200 border-[#3D7B8C]/10 text-neutral-400'
            }`}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
