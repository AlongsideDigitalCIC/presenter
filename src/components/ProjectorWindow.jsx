import { useEffect, useState, useRef, useCallback } from 'react';
import { isTauri } from '../utils/env';
import { resolveTargetMonitor, isSameMonitor } from '../utils/monitorUtils';
import OutputScreen from './OutputScreen';

export default function ProjectorWindow() {
  const [payload, setPayload] = useState(null);
  const [fallbackPayload, setFallbackPayload] = useState(null);
  const [remoteCommand, setRemoteCommand] = useState(null);

  useEffect(() => {
    // Self-assert fullscreen on the assigned display in Tauri desktop mode, and allow Escape to exit fullscreen
    let cleanupKey = null;
    if (isTauri()) {
      (async () => {
        try {
          const [{ get }, { getCurrentWindow, availableMonitors, currentMonitor }, { PhysicalPosition, PhysicalSize }] =
            await Promise.all([
              import('idb-keyval'),
              import('@tauri-apps/api/window'),
              import('@tauri-apps/api/dpi')
            ]);
          const win = getCurrentWindow();
          const savedMon = await get('presenter_selected_monitor');

          // Guarantee borderless fullscreen immediately
          await win.setDecorations(false).catch(() => {});
          await win.setFullscreen(true).catch(() => {});

          // Re-verify placement if multiple monitors are connected
          const [monitors, curMon] = await Promise.all([
            availableMonitors().catch(() => []),
            currentMonitor().catch(() => null)
          ]);
          const { monitor: targetMon } = resolveTargetMonitor(savedMon, monitors, null);
          if (targetMon && curMon && !isSameMonitor(targetMon, curMon) && targetMon.position && targetMon.size) {
            await win.setPosition(new PhysicalPosition(targetMon.position.x, targetMon.position.y)).catch(() => {});
            await win.setSize(new PhysicalSize(targetMon.size.width, targetMon.size.height)).catch(() => {});
            await win.setDecorations(false).catch(() => {});
            await win.setFullscreen(true).catch(() => {});
          }
        } catch {
          // ignore if capability unavailable
        }
      })();

      const handleKeyDown = async (e) => {
        if (e.key === 'Escape') {
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            if (await win.isFullscreen()) {
              await win.setFullscreen(false);
              await win.setDecorations(true);
            }
          } catch {}
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      cleanupKey = () => window.removeEventListener('keydown', handleKeyDown);
    } else {
      // Browser / PWA: Automatically trigger fullscreen immediately on load
      const requestAutoFs = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      };
      requestAutoFs();
      requestAnimationFrame(requestAutoFs);
      window.addEventListener('focus', requestAutoFs, { once: true });
    }

    return () => {
      if (cleanupKey) cleanupKey();
    };
  }, []);

  const toggleProjectorFullscreen = useCallback(async () => {
    if (isTauri()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        const cur = await win.isFullscreen();
        if (!cur) {
          await win.setDecorations(false);
          await win.setFullscreen(true);
        } else {
          await win.setFullscreen(false);
          await win.setDecorations(true);
        }
        return;
      } catch {
        // fallback to DOM fullscreen API
      }
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const payloadRef = useRef(null);
  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  const channelRef = useRef(null);
  const localUrlsRef = useRef({
    song: { bgVideoUrl: null, bgImageUrl: null },
    bible: { bgVideoUrl: null, bgImageUrl: null },
    liturgy: { bgVideoUrl: null, bgImageUrl: null },
    countdown: { bgVideoUrl: null, bgImageUrl: null }
  });

  const revokeUrl = (url) => {
    if (url && typeof url === 'string' && url.startsWith('blob:')) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  };

  const createSafeUrl = (blob) => {
    if (!blob) return null;
    try {
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("ProjectorWindow failed to create local object URL:", e);
      return null;
    }
  };

  const setCategoryMediaUrl = (category, mediaType, newUrl) => {
    if (!localUrlsRef.current[category]) return;
    const key = mediaType === 'video' ? 'bgVideoUrl' : 'bgImageUrl';
    const oldUrl = localUrlsRef.current[category][key];
    if (oldUrl && oldUrl !== newUrl) {
      revokeUrl(oldUrl);
    }
    localUrlsRef.current[category][key] = newUrl;
  };

  const applyBlobs = useCallback((blobs) => {
    if (!blobs || typeof blobs !== 'object') return false;
    let changed = false;

    if ('songVidBlob' in blobs) {
      const url = createSafeUrl(blobs.songVidBlob);
      setCategoryMediaUrl('song', 'video', url);
      changed = true;
    }
    if ('songImgBlob' in blobs) {
      const url = createSafeUrl(blobs.songImgBlob);
      setCategoryMediaUrl('song', 'image', url);
      changed = true;
    }
    if ('bibleVidBlob' in blobs) {
      const url = createSafeUrl(blobs.bibleVidBlob);
      setCategoryMediaUrl('bible', 'video', url);
      changed = true;
    }
    if ('bibleImgBlob' in blobs) {
      const url = createSafeUrl(blobs.bibleImgBlob);
      setCategoryMediaUrl('bible', 'image', url);
      changed = true;
    }
    if ('liturgyVidBlob' in blobs) {
      const url = createSafeUrl(blobs.liturgyVidBlob);
      setCategoryMediaUrl('liturgy', 'video', url);
      changed = true;
    }
    if ('liturgyImgBlob' in blobs) {
      const url = createSafeUrl(blobs.liturgyImgBlob);
      setCategoryMediaUrl('liturgy', 'image', url);
      changed = true;
    }
    if ('countdownVidBlob' in blobs) {
      const url = createSafeUrl(blobs.countdownVidBlob);
      setCategoryMediaUrl('countdown', 'video', url);
      changed = true;
    }
    if ('countdownImgBlob' in blobs) {
      const url = createSafeUrl(blobs.countdownImgBlob);
      setCategoryMediaUrl('countdown', 'image', url);
      changed = true;
    }

    return changed;
  }, []);

  const patchPayloadWithLocalMedia = useCallback((incoming) => {
    if (!incoming || typeof incoming !== 'object') return incoming;
    const local = localUrlsRef.current;
    const activeType = incoming.mediaType;
    const isTextCategory = activeType === 'song' || activeType === 'bible' || activeType === 'liturgy';

    const patched = { ...incoming };

    // Patch category backgrounds with locally created valid object URLs.
    // Falls back to the URL supplied by the main window when no local blob is available.
    patched.backgrounds = {
      song: {
        ...(incoming.backgrounds?.song || {}),
        bgVideoUrl: local.song?.bgVideoUrl || incoming.backgrounds?.song?.bgVideoUrl || null,
        bgImageUrl: local.song?.bgImageUrl || incoming.backgrounds?.song?.bgImageUrl || null,
      },
      bible: {
        ...(incoming.backgrounds?.bible || {}),
        bgVideoUrl: local.bible?.bgVideoUrl || incoming.backgrounds?.bible?.bgVideoUrl || null,
        bgImageUrl: local.bible?.bgImageUrl || incoming.backgrounds?.bible?.bgImageUrl || null,
      },
      liturgy: {
        ...(incoming.backgrounds?.liturgy || {}),
        bgVideoUrl: local.liturgy?.bgVideoUrl || incoming.backgrounds?.liturgy?.bgVideoUrl || null,
        bgImageUrl: local.liturgy?.bgImageUrl || incoming.backgrounds?.liturgy?.bgImageUrl || null,
      },
      countdown: {
        ...(incoming.backgrounds?.countdown || {}),
        bgVideoUrl: local.countdown?.bgVideoUrl || incoming.backgrounds?.countdown?.bgVideoUrl || null,
        bgImageUrl: local.countdown?.bgImageUrl || incoming.backgrounds?.countdown?.bgImageUrl || null,
      }
    };

    if (isTextCategory) {
      const currentCatBg = patched.backgrounds[activeType];
      if (currentCatBg) {
        patched.bgType = currentCatBg.bgType || 'color';
        patched.bgColor = currentCatBg.bgColor || '#000000';
        patched.bgVideoUrl = currentCatBg.bgType === 'video' ? currentCatBg.bgVideoUrl : null;
        patched.bgImageUrl = currentCatBg.bgType === 'image' ? currentCatBg.bgImageUrl : null;
      }
    } else {
      patched.bgType = 'color';
      patched.bgColor = '#000000';
      patched.bgVideoUrl = null;
      patched.bgImageUrl = null;
    }

    return patched;
  }, []);

  const loadLocalBackgrounds = useCallback(async () => {
    try {
      const { get } = await import('idb-keyval');
      const songImgBlob = (await get('presenter_bg_image_blob_song')) || (await get('presenter_bg_image_blob'));
      const songVidBlob = (await get('presenter_bg_video_blob_song')) || (await get('presenter_bg_video_blob'));
      const bibleImgBlob = await get('presenter_bg_image_blob_bible');
      const bibleVidBlob = await get('presenter_bg_video_blob_bible');
      const liturgyImgBlob = await get('presenter_bg_image_blob_liturgy');
      const liturgyVidBlob = await get('presenter_bg_video_blob_liturgy');
      const countdownImgBlob = await get('presenter_bg_image_blob_countdown');
      const countdownVidBlob = await get('presenter_bg_video_blob_countdown');

      applyBlobs({
        songVidBlob,
        songImgBlob,
        bibleVidBlob,
        bibleImgBlob,
        liturgyVidBlob,
        liturgyImgBlob,
        countdownVidBlob,
        countdownImgBlob
      });

      return localUrlsRef.current;
    } catch (e) {
      console.warn("ProjectorWindow failed to load local backgrounds:", e);
      return localUrlsRef.current;
    }
  }, [applyBlobs]);

  useEffect(() => {
    const init = async () => {
      await loadLocalBackgrounds();
      setPayload(prev => prev ? patchPayloadWithLocalMedia(prev) : prev);
      try {
        const { get } = await import('idb-keyval');
        const church = await get('presenter_church_name');
        const font = await get('presenter_display_font');
        const display = await get('presenter_display_settings');
        const overlays = await get('presenter_overlay_settings');
        const ccli = await get('presenter_ccli_settings');
        const local = localUrlsRef.current;

        const backgrounds = {
          song: {
            bgType: display?.backgrounds?.song?.bgType || display?.bgType || 'color',
            bgColor: display?.backgrounds?.song?.bgColor || display?.bgColor || '#000000',
            bgDim: display?.backgrounds?.song?.bgDim ?? display?.bgDim ?? 0.3,
            bgVideoLoop: display?.backgrounds?.song?.bgVideoLoop ?? display?.bgVideoLoop ?? true,
            bgImageUrl: local.song.bgImageUrl,
            bgVideoUrl: local.song.bgVideoUrl
          },
          bible: {
            bgType: display?.backgrounds?.bible?.bgType || 'color',
            bgColor: display?.backgrounds?.bible?.bgColor || '#161d2f',
            bgDim: display?.backgrounds?.bible?.bgDim ?? 0.3,
            bgVideoLoop: display?.backgrounds?.bible?.bgVideoLoop ?? true,
            bgImageUrl: local.bible.bgImageUrl,
            bgVideoUrl: local.bible.bgVideoUrl
          },
          liturgy: {
            bgType: display?.backgrounds?.liturgy?.bgType || 'color',
            bgColor: display?.backgrounds?.liturgy?.bgColor || '#111827',
            bgDim: display?.backgrounds?.liturgy?.bgDim ?? 0.3,
            bgVideoLoop: display?.backgrounds?.liturgy?.bgVideoLoop ?? true,
            bgImageUrl: local.liturgy.bgImageUrl,
            bgVideoUrl: local.liturgy.bgVideoUrl
          },
          countdown: {
            bgType: display?.backgrounds?.countdown?.bgType || 'none',
            bgColor: display?.backgrounds?.countdown?.bgColor || '#0B132B',
            bgDim: display?.backgrounds?.countdown?.bgDim ?? 0.3,
            bgVideoLoop: display?.backgrounds?.countdown?.bgVideoLoop ?? true,
            bgImageUrl: local.countdown.bgImageUrl,
            bgVideoUrl: local.countdown.bgVideoUrl
          }
        };

        setFallbackPayload({
          isLive: false,
          mediaType: null,
          churchName: church || 'Presenter',
          displayFont: font || 'Inter',
          textScale: display?.textScale ?? 1,
          backgrounds,
          bgType: 'color',
          bgColor: '#000000',
          bgDim: 0,
          bgVideoLoop: true,
          bgImageUrl: null,
          bgVideoUrl: null,
          transitionEnabled: display?.transitionEnabled ?? true,
          transitionType: display?.transitionType || 'crossfade',
          transitionDuration: display?.transitionDuration || 400,
          overlaySettings: overlays || undefined,
          ccliSettings: ccli || undefined
        });

        // Patch payload with local URLs if already received before IDB load completed
        setPayload(prev => prev ? patchPayloadWithLocalMedia(prev) : prev);
      } catch {
        /* ignore fallback load errors */
      }
    };

    init();
  }, [loadLocalBackgrounds, patchPayloadWithLocalMedia]);

  useEffect(() => {
    // Override page title for easier OS task management
    document.title = "Presenter Projector Output";

    // Initialize high-speed background syncing (Unified Hub)
    const channel = new BroadcastChannel('presenter-projector-hub');
    channelRef.current = channel;
    
    // Announce presence so App.jsx knows to yield Master status (and request sync if still waiting for initial payload)
    const interval = setInterval(() => {
        channelRef.current?.postMessage({ type: 'heartbeat', needsSync: !payloadRef.current });
    }, 1000);
    
    channel.onmessage = (e) => {
       if (!e.data) return;
       const data = e.data;
       
       // Handle sync-projector with payload and blobs
       if (data.type === 'sync-projector') {
          if (data.blobs) {
             applyBlobs(data.blobs);
          }
          if (data.payload) {
             setPayload(patchPayloadWithLocalMedia(data.payload));
          }
       }
       // Handle single blob update
       else if (data.type === 'bg-blob-update') {
          if (data.category && data.mediaType) {
             const url = createSafeUrl(data.blob);
             setCategoryMediaUrl(data.category, data.mediaType, url);
             setPayload(prev => prev ? patchPayloadWithLocalMedia(prev) : prev);
             setFallbackPayload(prev => prev ? patchPayloadWithLocalMedia(prev) : prev);
          }
       }
       // Handle Background media update
       else if (data.type === 'bg-update') {
          if (data.blobs) {
             applyBlobs(data.blobs);
             setPayload(prev => prev ? patchPayloadWithLocalMedia(prev) : prev);
          } else {
             loadLocalBackgrounds().then(() => {
                setPayload(prev => prev ? patchPayloadWithLocalMedia(prev) : prev);
             });
          }
       }
       // Handle Playback Commands
       else if (data.type === 'playback') {
          setRemoteCommand({ ...data, ts: Date.now() });
       } 
       // Handle Orphan Scopes
       else if (data.type === 'clear') { 
          setPayload(null); 
       } else if (data.type === 'master-reboot') {
          window.location.reload();
       }
       // Handle Raw Content Payload updates (backward compatibility)
       else if (typeof data === 'object' && data.isLive !== undefined) {
          setPayload(patchPayloadWithLocalMedia(data));
       } 
    };

    // PING Main Controller Window to get initialized payload immediately
    channel.postMessage('ping');

    return () => {
        clearInterval(interval);
        channel.close();
        const old = localUrlsRef.current;
        ['song', 'bible', 'liturgy', 'countdown'].forEach(cat => {
          revokeUrl(old[cat]?.bgVideoUrl);
          revokeUrl(old[cat]?.bgImageUrl);
        });
    };
  }, [applyBlobs, loadLocalBackgrounds, patchPayloadWithLocalMedia]);

  return (
    <div
      onDoubleClick={toggleProjectorFullscreen}
      className="w-[100dvw] h-[100dvh] bg-black overflow-hidden relative select-none cursor-none"
    >
      <OutputScreen 
        payload={payload || fallbackPayload} 
        isMaster={payload?.isLive ? true : false} 
        isProjector={true} 
        isLiveBroadcast={true} 
        remoteCommand={remoteCommand}
        onStatusUpdate={(status) => channelRef.current?.postMessage({ type: 'status', ...status })}
      />
    </div>
  );
}