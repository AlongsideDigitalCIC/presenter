import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, MonitorOff, LayoutTemplate, XCircle, Monitor, Radio, FileText, Music, Image as ImgIcon, Video, BookOpen, Presentation, ChevronRight, ChevronLeft, Headphones, Power, Lock, Unlock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function RemoteControl({ roomId }) {
  const [status, setStatus] = useState('connecting');
  const [payload, setPayload] = useState(null);
  const [serviceItems, setServiceItems] = useState([]);
  const [error, setError] = useState(null);
  const connRef = useRef(null);

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Persistent Client Session ID across reloads
  const clientIdRef = useRef((() => {
    try {
      let id = sessionStorage.getItem('presenter_remote_client_id');
      if (!id) {
        id = 'rc_' + Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem('presenter_remote_client_id', id);
      }
      return id;
    } catch (e) {
      return 'rc_' + Math.random().toString(36).substring(2, 10);
    }
  })());

  // Clean URL: Strip any &pin= from URL so PIN is never visible or preserved in the browser address bar
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('pin')) {
        url.searchParams.delete('pin');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!roomId) return;
    setStatus('connecting');

    const host = window.location.hostname;
    const ws = new WebSocket(`ws://${host}:5179`);
    connRef.current = ws;
    
    ws.onopen = () => {
       setStatus('connected');
       // Announce remote control and request state
       ws.send(JSON.stringify({ 
         type: 'request_state', 
         clientId: clientIdRef.current,
         role: 'remote_control' 
       }));

       // Check if this session already saved a valid PIN
       try {
         const savedPin = sessionStorage.getItem('presenter_remote_pin');
         if (savedPin) {
           ws.send(JSON.stringify({
             type: 'auth_verify',
             clientId: clientIdRef.current,
             pin: savedPin
           }));
         }
       } catch (e) {}
    };
    
    ws.onmessage = (event) => {
       if (event.data instanceof Blob) return;
       try {
           const data = JSON.parse(event.data);

           if (data.type === 'auth_status') {
               if (data.targetClientId && data.targetClientId !== clientIdRef.current) return;

               setIsVerifying(false);
               if (data.authenticated) {
                   setIsAuthenticated(true);
                   setPinRequired(false);
                   setAuthError(null);
               } else if (data.pinRequired) {
                   setIsAuthenticated(false);
                   setPinRequired(true);
                   if (data.error) {
                       setAuthError(data.error);
                       try { sessionStorage.removeItem('presenter_remote_pin'); } catch(e) {}
                   }
               }
           }

           if (data.type === 'state' || data.type === 'sync') {
               if (data.payload) setPayload(data.payload);
               if (data.serviceItems) setServiceItems(data.serviceItems);
           }
       } catch (e) {}
    };
    
    ws.onclose = () => {
       setStatus('disconnected');
    };
    
    ws.onerror = () => {
       setError("Cannot connect to the Presenter server. Make sure the main app is running on this network.");
       setStatus('error');
    };

    return () => {
      if (connRef.current) connRef.current.close();
    };
  }, [roomId]);

  const sendCommand = (cmd, args = {}) => {
    if (connRef.current && connRef.current.readyState === 1) {
      connRef.current.send(JSON.stringify({ 
        type: 'remote_command', 
        clientId: clientIdRef.current,
        command: cmd, 
        ...args 
      }));
    }
  };

  const handleVerifyPin = (e) => {
    if (e) e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) {
      setAuthError("Please enter a PIN");
      return;
    }
    setIsVerifying(true);
    setAuthError(null);
    if (connRef.current && connRef.current.readyState === 1) {
      try {
        sessionStorage.setItem('presenter_remote_pin', pin);
      } catch (err) {}
      connRef.current.send(JSON.stringify({
        type: 'auth_verify',
        clientId: clientIdRef.current,
        pin: pin
      }));
    } else {
      setIsVerifying(false);
      setAuthError("Not connected to Presenter server");
    }
  };

  const handleLock = () => {
    try {
      sessionStorage.removeItem('presenter_remote_pin');
    } catch (e) {}
    setIsAuthenticated(false);
    setPinRequired(true);
    setPinInput('');
    setAuthError(null);
  };

  // --- Connecting Screen ---
  if (status === 'connecting' || (!isAuthenticated && !pinRequired && status === 'connected' && !error)) {
     return (
       <div className="min-h-screen bg-[#1C355E] text-white flex flex-col items-center justify-center p-6">
         <div className="w-10 h-10 rounded-full border-t-2 border-[#3D7B8C] animate-spin mb-6"></div>
         <p className="font-bold text-lg tracking-widest uppercase">Connecting...</p>
         <p className="text-white/40 text-xs mt-2 font-medium">Looking for Presenter on your network</p>
       </div>
     );
  }
  
  // --- Error / Disconnected Screen ---
  if (status === 'error' || status === 'disconnected') {
     return (
       <div className="min-h-screen bg-[#1C355E] text-white flex flex-col items-center justify-center p-6 text-center">
          <XCircle className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-xl font-bold mb-2">Connection Lost</h2>
          <p className="text-white/50 mb-6 text-sm max-w-xs">{error || "The connection to the Presenter was lost."}</p>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[#3D7B8C] hover:bg-[#3D7B8C]/80 rounded-xl font-bold transition text-white text-sm tracking-wider uppercase">Reconnect</button>
       </div>
     );
  }

  // --- PIN Lock Screen ---
  if (pinRequired && !isAuthenticated) {
     return (
       <div className="min-h-screen bg-[#0f1f38] text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="w-full max-w-sm bg-[#1C355E] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
             <div className="w-16 h-16 rounded-2xl bg-[#3D7B8C]/20 border border-[#3D7B8C]/40 flex items-center justify-center mb-5 text-[#3D7B8C] shadow-lg shadow-[#3D7B8C]/10">
                <Lock size={30} />
             </div>
             <h2 className="text-2xl font-black tracking-tight text-white mb-2">Remote PIN Required</h2>
             <p className="text-white/50 text-xs mb-6 max-w-xs leading-relaxed">
                This presentation is protected. Enter the PIN configured in Presenter to unlock remote control.
             </p>

             <form onSubmit={handleVerifyPin} className="w-full flex flex-col gap-4">
                <div className="relative w-full">
                   <input
                      type={showPin ? "text" : "password"}
                      value={pinInput}
                      onChange={(e) => { setPinInput(e.target.value); setAuthError(null); }}
                      placeholder="Enter PIN"
                      autoFocus
                      className="w-full bg-white/5 border border-white/15 focus:border-[#3D7B8C] focus:bg-white/10 rounded-2xl py-4 px-5 text-center text-xl font-mono tracking-[0.25em] text-white placeholder:text-white/20 placeholder:tracking-normal outline-none transition-all"
                   />
                   <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition p-1"
                      title={showPin ? "Hide PIN" : "Show PIN"}
                   >
                      {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                   </button>
                </div>

                {authError && (
                   <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 py-2.5 px-3 rounded-xl">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span>{authError}</span>
                   </div>
                )}

                <button
                   type="submit"
                   disabled={isVerifying || !pinInput.trim()}
                   className="w-full py-4 bg-[#3D7B8C] hover:bg-[#3D7B8C]/80 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-[#3D7B8C]/30 text-white mt-1"
                >
                   {isVerifying ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                   ) : (
                      <>
                         <span>Unlock Remote</span>
                         <ArrowRight size={16} />
                      </>
                   )}
                </button>
             </form>

             <div className="mt-8 pt-4 border-t border-white/5 w-full flex items-center justify-between text-[11px] text-white/30">
                <span>Room: <strong className="text-white/50 font-mono">{roomId}</strong></span>
                <span className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> Connected
                </span>
             </div>
          </div>
       </div>
     );
  }

  const isMedia = payload?.mediaType === 'audio' || payload?.mediaType === 'video';
  const hasSlides = payload?.mediaType === 'song' || payload?.mediaType === 'liturgy' || payload?.mediaType === 'bible' || payload?.mediaType === 'slide_deck' || payload?.mediaType === 'image';

  return (
    <div className="min-h-screen bg-[#0f1f38] text-white flex flex-col font-sans overflow-hidden" style={{ WebkitTapHighlightColor: 'transparent' }}>
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 bg-[#1C355E] border-b border-white/10 flex-shrink-0 safe-area-top">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="font-bold tracking-widest text-xs uppercase text-white/90">Remote Control</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="text-[10px] text-white/30 font-mono bg-white/5 px-2 py-1 rounded-md">
                 {roomId}
              </div>
              <button 
                 onClick={handleLock}
                 title="Lock Remote Control"
                 className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-white/50 hover:text-white transition"
              >
                 <Lock size={14} />
              </button>
           </div>
        </header>

        {/* Now Playing */}
        <div className="bg-[#1C355E] p-4 border-b border-white/10 flex-shrink-0">
           <div className="text-[9px] text-[#3D7B8C] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Monitor size={10} /> Now Playing</div>
           <div className="font-bold text-base leading-tight truncate text-white/90">
              {payload?.activeMediaUrl ? payload.activeMediaUrl.split('/').pop() : (payload?.itemId ? serviceItems.find(i => i.id === payload.itemId)?.title || "Unknown Item" : "Nothing playing")}
           </div>
        </div>

        {/* Main Controls */}
        <div className="p-5 flex flex-col gap-4 flex-shrink-0 bg-neutral-900/50 rounded-b-3xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10 relative">

           {/* Go Live / End Live */}
           <button 
             onClick={() => sendCommand('toggle_live')} 
             className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-lg ${payload?.isLive 
               ? 'bg-red-500/90 text-white shadow-red-900/30' 
               : 'bg-green-500/90 text-white shadow-green-900/30'
             }`}
           >
              <Power size={18} /> {payload?.isLive ? 'End Live Broadcast' : 'Go Live'}
           </button>

           {/* Slide Nav */}
           {hasSlides && (
              <div className="flex items-center gap-2">
                 <button onClick={() => sendCommand('prev_slide')} className="flex-1 py-5 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-2xl flex items-center justify-center transition border border-white/10 shadow-inner">
                    <ChevronLeft size={24} className="text-white/80" />
                 </button>
                 <button onClick={() => sendCommand('next_slide')} className="flex-[2.5] py-5 bg-[#3D7B8C] hover:bg-[#3D7B8C]/80 active:bg-[#3D7B8C]/60 rounded-2xl flex items-center justify-center transition shadow-[0_0_15px_rgba(61,123,140,0.4)] font-black tracking-widest uppercase text-sm gap-2 text-white">
                    Next Slide <ChevronRight size={18} />
                 </button>
              </div>
           

           )}

           {/* Media Play/Pause */}
           
              <div className="flex items-center gap-2">
                 <button onClick={() => sendCommand('play')} className="flex-1 py-5 bg-[#3D7B8C] hover:bg-[#3D7B8C]/80 active:bg-[#3D7B8C]/60 rounded-2xl flex items-center justify-center transition shadow-[0_0_15px_rgba(61,123,140,0.4)] text-white">
                    <Play size={24} className="text-white" />
                 </button>
                 <button onClick={() => sendCommand('pause')} className="flex-1 py-5 bg-white/10 hover:bg-white/15 active:bg-white/5 rounded-2xl flex items-center justify-center transition border border-white/10 shadow-inner">
                    <Pause size={24} className="text-white/80" />
                 </button>
              </div>
           

           {/* Quick Actions Row */}
           <div className="flex items-center gap-2">
              <button 
                onClick={() => sendCommand('black_screen')} 
                className={`flex-1 py-4 px-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex flex-col items-center justify-center gap-1 transition border active:scale-[0.95] ${payload?.isBlackScreen ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/5 text-white/50 border-white/10'}`}
              >
                 <MonitorOff size={18} /> Black
              </button>
              <button 
                onClick={() => sendCommand('show_logo')} 
                className={`flex-1 py-4 px-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex flex-col items-center justify-center gap-1 transition border active:scale-[0.95] ${payload?.isShowLogo ? 'bg-[#3D7B8C]/30 text-[#3D7B8C] border-[#3D7B8C]/40' : 'bg-white/5 text-white/50 border-white/10'}`}
              >
                 <LayoutTemplate size={18} /> Logo
              </button>
           </div>
        </div>

        {/* Slide Tiles */}
        {hasSlides && (payload?.itemSlides || payload?.itemImagesCount > 0) && (
           <div className="p-4 border-t border-white/5 flex-shrink-0">
              <h3 className="text-[9px] text-white/30 font-bold uppercase tracking-widest mb-3 pl-1">Slides</h3>
              <div className="grid grid-cols-2 gap-2 max-h-[35vh] overflow-y-auto pr-1 pb-1">
                 {payload.itemSlides ? (
                    payload.itemSlides.map((slide, idx) => {
                       const isActive = payload.slideIndex === idx;
                       return (
                          <button
                             key={idx}
                             onClick={() => sendCommand('set_slide_index', { index: idx })}
                             className={`aspect-video rounded-2xl flex flex-col relative overflow-hidden transition-all active:scale-95 text-left p-3 border ${
                                isActive 
                                  ? 'bg-[#3D7B8C] border-[#3D7B8C] shadow-lg text-white' 
                                  : 'bg-white/5 border-white/10 text-white/60'
                             }`}
                          >
                             <div className="flex-1 w-full overflow-hidden flex items-center justify-center">
                                <div className={`font-bold text-[9px] leading-tight w-full whitespace-pre-wrap text-center ${isActive ? 'text-white' : 'text-white/50'}`}>
                                   {(slide.content || []).slice(0, 3).map((line, li) => <div key={li}>{line}</div>)}
                                   {(slide.content || []).length > 3 && <div className="text-white/30 mt-1">...</div>}
                                </div>
                             </div>
                             <div className="flex justify-between items-end mt-1">
                                <span className={`text-[7px] font-bold uppercase tracking-widest ${isActive ? 'text-white/60' : 'text-white/30'}`}>
                                   {slide.type || 'SLIDE'}
                                </span>
                                <span className={`text-[8px] font-bold ${isActive ? 'text-white' : 'text-white/40'}`}>
                                   {idx + 1}
                                </span>
                             </div>
                          </button>
                       );
                    })
                 ) : (
                    Array.from({ length: payload.itemImagesCount }).map((_, idx) => {
                       const isActive = payload.slideIndex === idx;
                       return (
                          <button
                             key={idx}
                             onClick={() => sendCommand('set_slide_index', { index: idx })}
                             className={`aspect-video rounded-xl flex items-center justify-center transition-all active:scale-95 border relative overflow-hidden ${
                                isActive 
                                  ? 'bg-[#3D7B8C] border-[#3D7B8C] shadow-lg text-white' 
                                  : 'bg-white/5 border-white/10 text-white/40'
                             }`}
                          >
                             <div className="flex flex-col items-center gap-1">
                                {payload.itemThumbnails?.[idx] ? (
                                   <img src={payload.itemThumbnails[idx]} alt={`Slide ${idx + 1}`} className={`absolute inset-0 w-full h-full object-cover transition-opacity ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                                ) : (
                                   <ImgIcon size={20} className={`z-10 ${isActive ? 'opacity-100' : 'opacity-50'}`} />
                                )}
                                <span className={`text-[9px] font-bold tracking-widest uppercase z-10 ${payload.itemThumbnails?.[idx] ? 'absolute bottom-1 right-1 bg-black/60 px-1 rounded' : ''}`}>Slide {idx + 1}</span>
                             </div>
                          </button>
                       );
                    })
                 )}
              </div>
           </div>
        )}

        {/* Service Flow List */}
       <div className="flex-1 overflow-y-auto p-5 pb-32 safe-area-bottom">
          <h3 className="text-[9px] text-white/30 font-bold uppercase tracking-widest mb-3 pl-1">Service Flow</h3>
          <div className="flex flex-col gap-2">
             {serviceItems.map((item, idx) => {
                const isLive = payload?.itemId === item.id;
                
                let Icon = FileText;
                if (item.type === 'song') Icon = Music;
                if (item.type === 'bible') Icon = BookOpen;
                if (item.type === 'image' || item.type === 'slide_deck') Icon = ImgIcon;
                if (item.type === 'video') Icon = Video;
                if (item.type === 'audio') Icon = Headphones;

                return (
                   <button 
                      key={item.id + idx}
                      onClick={() => sendCommand('select_item', { itemId: item.id })}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition active:scale-[0.97] border ${
                         isLive 
                           ? 'bg-[#3D7B8C] border-[#3D7B8C] shadow-lg shadow-[#3D7B8C]/30' 
                           : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                   >
                      <div className={`p-2 rounded-lg ${isLive ? 'bg-white/20' : 'bg-white/5'}`}>
                         <Icon size={18} className={isLive ? 'text-white' : 'text-white/40'} />
                      </div>
                      <div className="flex-1 overflow-hidden">
                         <div className={`font-bold truncate text-sm ${isLive ? 'text-white' : 'text-white/80'}`}>
                            {item.title || item.filename}
                         </div>
                         <div className={`text-[9px] uppercase tracking-widest font-bold truncate mt-0.5 ${isLive ? 'text-white/60' : 'text-white/30'}`}>
                            {item.type.replace('_', ' ')}
                         </div>
                      </div>
                      {isLive && (
                         <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      )}
                   </button>
                );
             })}
             {serviceItems.length === 0 && (
                <div className="text-white/20 text-center text-xs py-8 italic">No service items yet. Add items from the main app.</div>
             )}
          </div>
       </div>
    </div>
  );
}
