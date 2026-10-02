import { useEffect, useState, useRef } from 'react';
import OutputScreen from './OutputScreen';

export default function ProjectorWindow() {
  const [payload, setPayload] = useState(null);
  const [remoteCommand, setRemoteCommand] = useState(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  const channelRef = useRef(null);

  useEffect(() => {
    // Override page title for easier OS task management
    document.title = "Presenter Projector Output";

    // Initialize high-speed background syncing (Unified Hub)
    const channel = new BroadcastChannel('presenter-projector-hub');
    channelRef.current = channel;
    
    // Announce presence so App.jsx knows to yield Master status
    const interval = setInterval(() => {
        channelRef.current?.postMessage({ type: 'heartbeat' });
    }, 1000);
    
    channel.onmessage = (e) => {
       if (!e.data) return;
       
       // Handle Playback Commands
       if (e.data.type === 'playback') {
          // Add a timestamp to remoteCommand to ensure it triggers useEffect in OutputScreen even if same command is sent
          setRemoteCommand({ ...e.data, ts: Date.now() });
       } 
       // Handle Orphan Scopes
       else if (e.data.type === 'clear') { setPayload(null); } else if (e.data.type === 'master-reboot') {
          window.location.reload();
       }
       // Handle Content Payload updates
       else if (typeof e.data === 'object' && e.data.isLive !== undefined) {
          setPayload(e.data);
       } 
    };

    // PING Main Controller Window to get initialized payload if we just opened
    channel.postMessage('ping');

    return () => {
        clearInterval(interval);
        channel.close();
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
      const newScale = Math.max(scaleX, scaleY);
      
      setScale(newScale);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-screen h-screen bg-black overflow-hidden relative">
      <OutputScreen 
          payload={payload} 
          isMaster={payload?.isLive ? true : false} 
          isProjector={true}
          isLiveBroadcast={true} 
          remoteCommand={remoteCommand}
          onStatusUpdate={(status) => channelRef.current?.postMessage({ type: 'status', ...status })}
        />
    </div>
  );
}
