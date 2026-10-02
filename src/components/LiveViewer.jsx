import { useState, useEffect, useRef } from 'react';
import OutputScreen from './OutputScreen';

const LiveViewer = () => {
  const [networkPayload, setNetworkPayload] = useState(null);
  const [remoteCommand, setRemoteCommand] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);
  const mediaMapCache = useRef({});
  const pendingMediaRef = useRef(null);
  const [webrtcStream, setWebrtcStream] = useState(null);
  const viewerIdRef = useRef(Math.random().toString(36).substr(2, 9));
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout;
    
    const connect = () => {
        const ws = new WebSocket(`ws://${window.location.hostname}:5179`);
        wsRef.current = ws;
        
        ws.onopen = () => {
           console.log("Connected to local WebSocket server");
           ws.send(JSON.stringify({ type: 'request_state' }));
        };
        
        ws.onmessage = async (event) => {
           if (event.data instanceof Blob) {
               if (pendingMediaRef.current) {
                   const { id, mime } = pendingMediaRef.current;
                   const blob = event.data;
                   const finalBlob = new Blob([blob], { type: mime });
                   const localUrl = URL.createObjectURL(finalBlob);
                   mediaMapCache.current[id] = localUrl;
                   
                   setNetworkPayload(prev => {
                      if (!prev) return prev;
                      const copy = { ...prev };
                      let changed = false;
                      if (copy.logoUrl === id) { copy.logoUrl = localUrl; changed = true; }
                      if (copy.activeMediaUrl === id) { copy.activeMediaUrl = localUrl; changed = true; }
                      return changed ? copy : prev;
                   });
                   pendingMediaRef.current = null;
               }
               return;
           }

           try {
               const data = JSON.parse(event.data);
               if (data?.type === 'state') {
                 const payload = data.payload;
                 if (payload.logoUrl?.startsWith('blob:') && mediaMapCache.current[payload.logoUrl]) {
                    payload.logoUrl = mediaMapCache.current[payload.logoUrl];
                 }
                 if (payload.activeMediaUrl?.startsWith('blob:') && mediaMapCache.current[payload.activeMediaUrl]) {
                    payload.activeMediaUrl = mediaMapCache.current[payload.activeMediaUrl];
                 }
                 if (payload.mediaType === 'image' || payload.mediaType === 'slide_deck') {
                    if (payload.activeSlide && Array.isArray(payload.activeSlide)) {
                       payload.activeSlide = payload.activeSlide.map(item => {
                          if (item.url?.startsWith('blob:') && mediaMapCache.current[item.url]) {
                             return { ...item, url: mediaMapCache.current[item.url] };
                          }
                          return item;
                       });
                    }
                 }
                 
                 setNetworkPayload(payload);
              } else if (data?.type === 'playback') {
                 setRemoteCommand({ ...data, ts: Date.now() });
              } else if (data?.type === 'sync-start') {
                 setIsSyncing(true);
              } else if (data?.type === 'sync-end') {
                 setIsSyncing(false);
              } else if (data?.type === 'media_header') {
                 pendingMediaRef.current = { id: data.id, mime: data.mime };
              }
           } catch (e) { console.error(e); }
        };
        
        ws.onclose = () => {
           console.log("WebSocket connection closed");
           clearTimeout(reconnectTimeout);
           reconnectTimeout = setTimeout(connect, 1000);
        };
    };

    connect();
    
    return () => {
       clearTimeout(reconnectTimeout);
       if (wsRef.current) {
           wsRef.current.onclose = null;
           wsRef.current.close();
       }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const { clientWidth, clientHeight } = containerRef.current;
      const targetW = 1600;
      const targetH = 900;
      
      const scaleX = clientWidth / targetW;
      const scaleY = clientHeight / targetH;
      const s = Math.max(scaleX, scaleY);
      setScale(s);
    };

    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    handleResize();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-[100dvw] h-[100dvh] bg-black overflow-hidden flex items-center justify-center relative font-sans select-none">
       <div className="relative w-full aspect-video max-h-full max-w-full bg-black flex-shrink-0">
         <OutputScreen 
            payload={networkPayload || { isLive: false }} 
            isLiveBroadcast={true} 
            remoteCommand={remoteCommand}
         />
       </div>
       
       <div className="fixed bottom-4 right-6 text-[10px] font-black text-white/50 uppercase tracking-widest pointer-events-none z-50 flex items-center gap-4">
          {isSyncing && (
             <div className="flex items-center gap-2 text-blue-400 bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-500/20 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Receiving Media...
             </div>
          )}
          Presenter Live View
       </div>
    </div>
  );
};

export default LiveViewer;
