import { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import OutputScreen from './OutputScreen';

const resolvePayloadMediaUrls = (rawPayload, cache) => {
  if (!rawPayload || typeof rawPayload !== 'object') return rawPayload;
  const payload = { ...rawPayload };

  const isLocalHost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const mapUrl = (u) => {
    if (typeof u !== 'string' || !u.startsWith('blob:')) return u;
    if (cache[u]) return cache[u];
    return isLocalHost ? u : null;
  };

  if (payload.logoUrl) payload.logoUrl = mapUrl(payload.logoUrl);
  if (payload.activeMediaUrl) payload.activeMediaUrl = mapUrl(payload.activeMediaUrl);
  if (payload.bgImageUrl) payload.bgImageUrl = mapUrl(payload.bgImageUrl);
  if (payload.bgVideoUrl) payload.bgVideoUrl = mapUrl(payload.bgVideoUrl);

  if (payload.backgrounds && typeof payload.backgrounds === 'object') {
    const nextBgs = { ...payload.backgrounds };
    ['song', 'bible', 'liturgy', 'countdown'].forEach((cat) => {
      if (nextBgs[cat]) {
        nextBgs[cat] = {
          ...nextBgs[cat],
          bgImageUrl: mapUrl(nextBgs[cat].bgImageUrl),
          bgVideoUrl: mapUrl(nextBgs[cat].bgVideoUrl)
        };
      }
    });
    payload.backgrounds = nextBgs;
  }

  if ((payload.mediaType === 'image' || payload.mediaType === 'slide_deck') && Array.isArray(payload.activeSlide)) {
    payload.activeSlide = payload.activeSlide.map((item) => {
      if (item?.url?.startsWith('blob:')) {
        const mapped = mapUrl(item.url);
        return mapped ? { ...item, url: mapped } : item;
      }
      return item;
    });
  }

  return payload;
};

const LiveViewer = () => {
  const [networkPayload, setNetworkPayload] = useState(null);
  const [remoteCommand, setRemoteCommand] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [showHud, setShowHud] = useState(true);
  const hudTimerRef = useRef(null);
  const mediaMapCache = useRef({});
  const rawPayloadRef = useRef(null);
  const pendingMediaRef = useRef(null);
  const wsRef = useRef(null);

  const revealHud = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowHud(false), 2800);
  }, []);

  useEffect(() => {
    hudTimerRef.current = setTimeout(() => setShowHud(false), 2800);
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let reconnectTimeout;
    
    const connect = () => {
        const ws = new WebSocket(`ws://${window.location.hostname}:5179`);
        ws.binaryType = 'arraybuffer';
        wsRef.current = ws;
        
        ws.onopen = () => {
           ws.send(JSON.stringify({ type: 'request_state', role: 'live_viewer' }));
        };
        
        ws.onmessage = async (event) => {
           const isBinary = event.data instanceof ArrayBuffer || event.data instanceof Blob;
           if (isBinary) {
               if (pendingMediaRef.current) {
                   const { id, mime } = pendingMediaRef.current;
                   let detectedMime = mime;
                   if (!detectedMime || detectedMime === 'application/octet-stream') {
                       detectedMime = 'video/mp4';
                   }
                   const finalBlob = new Blob([event.data], { type: detectedMime });
                   const localUrl = URL.createObjectURL(finalBlob);
                   mediaMapCache.current[id] = localUrl;
                   
                   if (rawPayloadRef.current) {
                      setNetworkPayload(resolvePayloadMediaUrls(rawPayloadRef.current, mediaMapCache.current));
                   }
                   pendingMediaRef.current = null;
               }
               return;
           }

           try {
               const data = JSON.parse(event.data);
               if (data?.type === 'state') {
                 rawPayloadRef.current = data.payload;
                 const resolved = resolvePayloadMediaUrls(data.payload, mediaMapCache.current);
                 setNetworkPayload(resolved);
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

  return (
    <div
      onMouseMove={revealHud}
      onTouchStart={revealHud}
      onDoubleClick={toggleFullscreen}
      className={`w-[100dvw] h-[100dvh] bg-black overflow-hidden flex items-center justify-center relative font-sans select-none ${
        !showHud && isFullscreen ? 'cursor-none' : 'cursor-default'
      }`}
    >
      {/* True 16:9 broadcast stage: fills 100% on 1920x1080 (including Windows 125% / 150% DPI scaling) without aspect distortion */}
      <div
        className="relative bg-black flex-shrink-0 overflow-hidden"
        style={{
          width: 'min(100dvw, calc(100dvh * 16 / 9))',
          height: 'min(100dvh, calc(100dvw * 9 / 16))'
        }}
      >
        <OutputScreen
          payload={networkPayload || { isLive: false }}
          isLiveBroadcast={true}
          remoteCommand={remoteCommand}
        />
      </div>

      <div
        className={`fixed bottom-4 right-5 z-50 flex items-center gap-3 transition-opacity duration-300 ${
          showHud || isSyncing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {isSyncing && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-sky-300 bg-sky-950/60 px-3 py-1.5 rounded-full border border-sky-400/25 backdrop-blur-md pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Receiving Media...
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 hover:text-white text-[10px] font-bold uppercase tracking-widest backdrop-blur-md transition cursor-pointer"
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>
      </div>
    </div>
  );
};

export default LiveViewer;
