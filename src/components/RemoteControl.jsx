import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, MonitorOff, LayoutTemplate, XCircle, Monitor, Radio, FileText, Music, Image as ImgIcon, Video, BookOpen, Presentation, ChevronRight, ChevronLeft, Headphones, Power } from 'lucide-react';

export default function RemoteControl({ roomId }) {
  const [status, setStatus] = useState('connecting');
  const [payload, setPayload] = useState(null);
  const [serviceItems, setServiceItems] = useState([]);
  const [error, setError] = useState(null);
  const connRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    setStatus('connecting');

    const host = window.location.hostname;
    const ws = new WebSocket(`ws://${host}:5179`);
    connRef.current = ws;
    
    ws.onopen = () => {
       setStatus('connected');
       ws.send(JSON.stringify({ type: 'request_state' }));
    };
    
    ws.onmessage = (event) => {
       if (event.data instanceof Blob) return;
       try {
           const data = JSON.parse(event.data);
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
      connRef.current.send(JSON.stringify({ type: 'remote_command', command: cmd, ...args }));
    }
  };

  // --- Connecting Screen ---
  if (status === 'connecting') {
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
           <div className="text-[10px] text-white/30 font-mono bg-white/5 px-2 py-1 rounded-md">
              {roomId}
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
                             className={`aspect-video rounded-xl flex items-center justify-center transition-all active:scale-95 border ${
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
