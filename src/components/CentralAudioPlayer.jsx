import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Repeat } from 'lucide-react';

export default function CentralAudioPlayer({ 
    item
}) {
    const [localTime, setLocalTime] = useState(0);
    const [localDuration, setLocalDuration] = useState(0);
    const [localPaused, setLocalPaused] = useState(true);
    const [localVolume, setLocalVolume] = useState(1);
    const [isLooping, setIsLooping] = useState(false);
    
    const audioRef = useRef(null);
    const isDragging = useRef(false);
    const isDraggingVol = useRef(false);
    const preMuteVolumeRef = useRef(1);

    const prevUrlRef = useRef(item?.url);
    if (prevUrlRef.current !== item?.url) {
        prevUrlRef.current = item?.url;
        setLocalTime(0);
        setLocalDuration(0);
        setLocalPaused(true);
        setLocalVolume(1);
    }

    const formatTime = (sec) => {
        if (!sec || isNaN(sec) || sec <= 0) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
        const nextPaused = !localPaused;
        setLocalPaused(nextPaused);
        if (nextPaused) {
            audioRef.current?.pause();
        } else {
            if (audioRef.current) {
                audioRef.current.volume = localVolume;
                audioRef.current.play().catch(e => console.error("Preview play failed:", e));
            }
        }
    };

    const handleSeek = (val) => {
        setLocalTime(val);
        if (audioRef.current) audioRef.current.currentTime = val;
    };

    const handleVolume = (val) => {
        setLocalVolume(val);
        if (audioRef.current) audioRef.current.volume = val;
    };

    const toggleMute = () => {
        if (localVolume > 0) {
            preMuteVolumeRef.current = localVolume;
            handleVolume(0);
        } else {
            handleVolume(preMuteVolumeRef.current || 1);
        }
    };

    const toggleLoop = () => {
        const nextLoop = !isLooping;
        setIsLooping(nextLoop);
        if (audioRef.current) audioRef.current.loop = nextLoop;
    };

    return (
        <div className="w-full bg-white border border-[#E4E1DA] rounded-2xl p-6 shadow-sm flex flex-col gap-4 max-w-2xl mx-auto mt-4 relative overflow-hidden">
            <audio 
                ref={audioRef} 
                src={item.url} 
                onTimeUpdate={(e) => { if (!isDragging.current) setLocalTime(e.target.currentTime); }}
                onLoadedMetadata={(e) => setLocalDuration(e.target.duration)}
                onEnded={() => setLocalPaused(true)}
                onPlay={() => setLocalPaused(false)}
                onPause={() => setLocalPaused(true)}
                className="hidden" 
            />
            
            <div className="text-[10px] text-[#526075] font-bold uppercase tracking-widest text-center mb-1">
                Local Preview Mode
            </div>

            <div className="flex items-center gap-5 w-full">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handlePlayPause}
                        className="w-12 h-12 bg-[#3D7B8C] hover:bg-[#2F6473] text-white rounded-full flex items-center justify-center transition-colors shadow-sm flex-shrink-0 cursor-pointer"
                    >
                        {localPaused ? <Play size={20} fill="currentColor" className="ml-1" /> : <Pause size={20} fill="currentColor" />}
                    </button>
                    <button 
                        onClick={toggleLoop}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer ${isLooping ? 'bg-[#3D7B8C] text-white' : 'bg-[#FAF6F0] text-[#526075] hover:bg-[#F0EBE1] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                        title={isLooping ? "Repeat On" : "Repeat Off"}
                    >
                        <Repeat size={16} />
                    </button>
                </div>
                
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <input 
                        type="range" min="0" max={localDuration || 100} step="0.1" 
                        value={Math.min(localTime, localDuration || 100)}
                        onMouseDown={() => isDragging.current = true}
                        onMouseUp={(e) => {
                            isDragging.current = false;
                            handleSeek(parseFloat(e.target.value));
                        }}
                        onChange={(e) => {
                            setLocalTime(parseFloat(e.target.value));
                        }}
                        className="w-full h-2 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                    />
                    <div className="flex justify-between text-xs font-bold font-mono tracking-tighter">
                        <span className={localTime > 0 ? "text-[#3D7B8C]" : "text-[#526075]"}>{formatTime(localTime)}</span>
                        <span className="text-[#526075]">-{formatTime(Math.max(0, localDuration - localTime))}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 min-w-[140px] w-1/4 border-l border-[#E4E1DA] pl-5 flex-shrink-0">
                    <button onClick={toggleMute} className="text-[#526075] hover:text-[#1C355E] transition-colors flex-shrink-0 cursor-pointer">
                        {localVolume > 0.5 ? <Volume2 size={18} /> : localVolume > 0 ? <Volume2 size={18} className="opacity-70" /> : <VolumeX size={18} className="text-[#B91C1C]" />}
                    </button>
                    <input 
                        type="range" min="0" max="1" step="0.05"
                        value={localVolume}
                        onMouseDown={() => isDraggingVol.current = true}
                        onMouseUp={() => isDraggingVol.current = false}
                        onChange={(e) => handleVolume(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                    />
                </div>
            </div>
        </div>
    );
}
