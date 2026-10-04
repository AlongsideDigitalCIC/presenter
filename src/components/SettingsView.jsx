import { Share2, Copy, Check, Building2, Music, X, Settings, Monitor, Database, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { availableMonitors } from '@tauri-apps/api/window';
import { getSongHistory, exportHistoryCSV } from '../services/historyService';

export default function SettingsView({ roomId, churchName, setChurchName, displayFont, setDisplayFont, onChangeLibrary, onClose, selectedMonitor, setSelectedMonitor }) {
  const [ccliFromDate, setCcliFromDate] = useState(() => {
     const d = new Date();
     d.setDate(d.getDate() - 30);
     return d.toISOString().split('T')[0];
  });
  const [ccliToDate, setCcliToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [monitors, setMonitors] = useState([]);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
    const [urlPref, setUrlPref] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [localHostname, setLocalHostname] = useState('');
  const [remotePassword, setRemotePassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const ip = await invoke('get_local_ip');
        setLocalIp(ip);
        const hn = await invoke('get_hostname');
        setLocalHostname(hn);
      } catch (e) {}

      try {
        const { get } = await import('idb-keyval');
        const storedUrl = await get('presenter_custom_base_url');
          if (storedUrl) {
            setCustomBaseUrl(storedUrl);
          }
          const storedPref = await get('presenter_url_pref');
          if (storedPref) {
             setUrlPref(storedPref);
          }
        const storedPassword = await get('presenter_remote_password');
        if (storedPassword) setRemotePassword(storedPassword);
      } catch(e) {}

      try {
          const result = await availableMonitors();
          setMonitors(result || []);
      } catch(e) {
          console.error("Failed to fetch monitors", e);
      }
    };
    fetchData();
  }, []);

  // Compute URLs
  let defaultBase = 'http://localhost:5178/';
    if (urlPref === 'ip' && localIp) defaultBase = `http://${localIp}:5178/`;
    else if (urlPref === 'hostname' && localHostname) defaultBase = `http://${localHostname}:5178/`;
    else if (localHostname) defaultBase = `http://${localHostname}:5178/`;
    else if (localIp) defaultBase = `http://${localIp}:5178/`;
  const base = customBaseUrl || defaultBase;
  const baseWithSlash = base.endsWith('/') ? base : base + '/';
  const liveUrl = baseWithSlash + '?network=true' + (roomId ? '&room=' + roomId : '');
  const remoteUrl = baseWithSlash + '?remoteControl=' + (roomId || 'default') + (remotePassword ? '&pin=' + remotePassword : '');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(liveUrl);
  const remoteQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(remoteUrl);

  const handleMonitorChange = async (e) => {
     const val = e.target.value;
     setSelectedMonitor(val);
     try {
         const { set } = await import('idb-keyval');
         await set('presenter_selected_monitor', val);
     } catch(err) {}
  };

  const handleExportCCLI = async () => {
     const from = new Date(ccliFromDate);
     const to = new Date(ccliToDate);
     const records = await getSongHistory(from, to);
     if (records.length === 0) {
         alert("No songs played in this date range.");
         return;
     }
     exportHistoryCSV(records);
  };

  const handleSaveBaseUrl = async () => {
      try {
          const { set } = await import('idb-keyval');
          await set('presenter_custom_base_url', customBaseUrl);
      } catch(e) {}
  };

  const handleSavePassword = async (val) => {
      setRemotePassword(val);
      try {
          const { set } = await import('idb-keyval');
          await set('presenter_remote_password', val);
      } catch(e) {}
  };

  const handleCopy = (text, setter) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleNameBlur = async () => {
    try {
      const { set } = await import('idb-keyval');
      await set('presenter_church_name', churchName);
      await set('presenter_display_font', displayFont);
    } catch(e) {}
  };
  
  const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter (Modern)' },
    { value: 'Roboto', label: 'Roboto (Clean)' },
    { value: 'Open Sans', label: 'Open Sans (Friendly)' },
    { value: 'Montserrat', label: 'Montserrat (Geometric)' },
    { value: 'Lato', label: 'Lato (Warm)' },
    { value: 'Merriweather', label: 'Merriweather (Classic Screen)' },
    { value: 'Lora', label: 'Lora (Elegant Serif)' },
    { value: 'Playfair Display', label: 'Playfair Display (Premium)' },
    { value: 'Crimson Pro', label: 'Crimson Pro (Book Style)' },
    { value: 'EB Garamond', label: 'EB Garamond (Traditional)' }
  ];


  return (
    <div className="fixed inset-0 z-50 bg-[#F7F7F7] flex flex-col animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-[#3D7B8C]/10 bg-white/50 flex-shrink-0">
        <h2 className="text-lg font-extrabold uppercase tracking-widest text-[#1C355E] flex items-center gap-3">
          <Settings size={20} className="text-[#3D7B8C]" /> System Settings
        </h2>
        <button 
          onClick={onClose}
          className="p-3 bg-[#F7F7F7] hover:bg-neutral-200 rounded-xl text-neutral-700 hover:text-[#1C355E] transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          
          {/* Row 1: Org & Server */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-[#3D7B8C]/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2">
                 <Building2 size={16} /> Organisation Profile
              </div>
              
              <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Church / Organisation Name</label>
                  <input 
                     type="text" 
                     value={churchName || ""} 
                     onChange={(e) => setChurchName(e.target.value)}
                     onBlur={handleNameBlur}
                     placeholder="e.g. Grace Fellowship"
                     className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-4 py-3 text-sm text-[#1C355E] placeholder-neutral-400 focus:outline-none focus:border-[#3D7B8C]/50 focus:ring-1 focus:ring-[#3D7B8C]/50 transition-all font-medium"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                     This name will be displayed gracefully on the network waiting screens and the main projector output when no media is playing.
                  </p>
              </div>
              
              <div className="flex flex-col gap-2 mt-2">
                  <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Global Display Font</label>
                  <select 
                     value={displayFont || "Inter"}
                     onChange={(e) => {
                         setDisplayFont(e.target.value);
                         import('idb-keyval').then(({ set }) => set('presenter_display_font', e.target.value));
                     }}
                     style={{ fontFamily: displayFont }}
                     className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C]/50 focus:ring-1 focus:ring-[#3D7B8C]/50 transition-all font-medium"
                  >
                     {FONT_OPTIONS.map(font => (
                        <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                           {font.label}
                        </option>
                     ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                     This font will be used globally for all lyrics, liturgy, and bible verses across all connected screens.
                  </p>
              </div>
            </div>

            <div className="bg-white border border-[#3D7B8C]/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2 w-full">
                 <Share2 size={16} /> Server Configuration
              </div>
              <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Base Network URL (Optional DNS)</label>
                  <div className="flex items-center gap-2">
                      <input 
                         type="text" 
                         value={customBaseUrl}
                         onChange={(e) => setCustomBaseUrl(e.target.value)}
                         onBlur={handleSaveBaseUrl}
                         placeholder={defaultBase}
                         className="flex-1 bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C]/50 transition-all font-medium"
                      />
                  </div>

                  <div className="flex flex-col gap-1 mt-2 mb-2 p-3 bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg">
                      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Detected Network Addresses</div>
                      {localHostname && (
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-mono text-[#1C355E] flex-1">http://{localHostname}:5178/</span>
                             <button onClick={() => { setUrlPref('hostname'); setCustomBaseUrl(''); import('idb-keyval').then(({set, del}) => { set('presenter_url_pref', 'hostname'); del('presenter_custom_base_url'); }); }} className="px-2 py-1 text-[9px] bg-[#3D7B8C]/10 text-[#3D7B8C] font-bold uppercase rounded-md hover:bg-[#3D7B8C]/20">Use Hostname</button>
                          </div>
                      )}
                      {localIp && (
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-xs font-mono text-neutral-500 flex-1">http://{localIp}:5178/</span>
                             <button onClick={() => { setUrlPref('ip'); setCustomBaseUrl(''); import('idb-keyval').then(({set, del}) => { set('presenter_url_pref', 'ip'); del('presenter_custom_base_url'); }); }} className="px-2 py-1 text-[9px] bg-neutral-200 text-neutral-600 font-bold uppercase rounded-md hover:bg-neutral-300">Use IP</button>
                          </div>
                      )}
                  </div>

                  <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                     If you have a local DNS or static IP, enter it here. This ensures the QR codes stay the same every week.
                  </p>
              </div>
              <div className="flex flex-col gap-2 mt-2 border-t border-[#3D7B8C]/10 pt-4">
                  <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Projector Monitor</label>
                  <select 
                     value={selectedMonitor || ""} 
                     onChange={handleMonitorChange}
                     className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C]/50 transition-all font-medium appearance-none"
                  >
                     <option value="">Default (Windowed / Primary)</option>
                     {monitors.map((m, i) => (
                        <option key={i} value={JSON.stringify(m)}>
                           {m.name || `Monitor ${i+1}`} ({m.size?.width}x{m.size?.height})
                        </option>
                     ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                     Select which monitor the projector output should automatically appear on.
                  </p>
              </div>
            </div>
          </div>

          {/* Row 2: Remotes side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-[#3D7B8C]/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2">
                 <Monitor size={16} /> Network Display Broadcast
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-[#F7F7F7] p-2 rounded-xl border border-[#3D7B8C]/10 flex-shrink-0">
                  <img src={qrUrl} alt="QR Code" className="w-24 h-24" />
                </div>
                <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Live Broadcast URL</div>
                    <div className="flex items-center gap-2 bg-[#F7F7F7] px-3 py-2 rounded-lg border border-[#3D7B8C]/10 group cursor-pointer hover:border-[#3D7B8C]/50 transition-colors w-full overflow-hidden" onClick={() => handleCopy(liveUrl, setCopied)}>
                        <code className="text-[11px] text-[#3D7B8C] font-bold truncate flex-1 text-left">{liveUrl}</code>
                        {copied ? <Check size={12} className="text-green-500 flex-shrink-0" /> : <Copy size={12} className="text-neutral-400 group-hover:text-[#3D7B8C] transition-colors flex-shrink-0" />}
                    </div>
                    {copied && <div className="text-[9px] text-green-500 font-bold animate-pulse">Copied to clipboard!</div>}
                    <p className="text-[10px] text-neutral-400 leading-relaxed mt-1">
                       Open this URL on a secondary screen or projector to display the live output.
                    </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#3D7B8C]/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2 w-full">
                 <Share2 size={16} /> Mobile Remote Control
              </div>
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-[#F7F7F7] p-2 rounded-xl border border-[#3D7B8C]/10 flex-shrink-0">
                  <img src={remoteQrUrl} alt="Remote Control QR Code" className="w-24 h-24" />
                </div>
                <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Remote Control URL</div>
                    <div className="flex items-center gap-2 bg-[#F7F7F7] px-3 py-2 rounded-lg border border-[#3D7B8C]/10 group cursor-pointer hover:border-[#3D7B8C]/50 transition-colors w-full overflow-hidden" onClick={() => handleCopy(remoteUrl, setCopiedRemote)}>
                        <code className="text-[11px] text-[#3D7B8C] font-bold truncate flex-1 text-left">{remoteUrl}</code>
                        {copiedRemote ? <Check size={12} className="text-green-500 flex-shrink-0" /> : <Copy size={12} className="text-neutral-400 group-hover:text-[#3D7B8C] transition-colors flex-shrink-0" />}
                    </div>
                    {copiedRemote && <div className="text-[9px] text-green-500 font-bold animate-pulse">Copied to clipboard!</div>}
                    
                    <div className="flex flex-col gap-1 mt-2">
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest flex items-center gap-1"><Lock size={10} /> Remote PIN</label>
                        <input 
                           type="text"
                           value={remotePassword}
                           onChange={(e) => handleSavePassword(e.target.value)}
                           placeholder="Leave empty for no PIN"
                           className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-3 py-2 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C]/50 transition-all font-medium font-mono tracking-widest"
                        />
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                           Set a PIN to prevent unauthorised devices from controlling your presentation.
                        </p>
                    </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Storage & CCLI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-[#3D7B8C]/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2">
                 <Database size={16} /> Storage Settings
              </div>
              
              <div className="flex flex-col gap-2 h-full justify-between">
                  <div>
                    <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Media Library Location</label>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                       Click this to select a new base folder for your Presenter library. This will reload the application.
                    </p>
                  </div>
                  <button 
                     onClick={onChangeLibrary}
                     className="w-full bg-[#F7F7F7] hover:bg-neutral-200 active:bg-neutral-300 border border-[#3D7B8C]/20 text-[#1C355E] font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm mt-4"
                  >
                     Change Media Library Folder
                  </button>
              </div>
            </div>

            <div className="bg-white border border-[#3D7B8C]/10 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2">
                 <Music size={16} /> Song History (CCLI Reporting)
              </div>
              <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Date Range</label>
                  <div className="flex gap-4 items-center">
                     <div className="flex-1 flex flex-col gap-1">
                         <span className="text-[9px] text-neutral-400 uppercase font-bold">From</span>
                         <input type="date" value={ccliFromDate} onChange={e => setCcliFromDate(e.target.value)} className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-3 py-2 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C]/50 transition-all font-medium" />
                     </div>
                     <div className="flex-1 flex flex-col gap-1">
                         <span className="text-[9px] text-neutral-400 uppercase font-bold">To</span>
                         <input type="date" value={ccliToDate} onChange={e => setCcliToDate(e.target.value)} className="w-full bg-[#F7F7F7] border border-[#3D7B8C]/10 rounded-lg px-3 py-2 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C]/50 transition-all font-medium" />
                     </div>
                  </div>
                  <button 
                     onClick={handleExportCCLI}
                     className="mt-4 w-full bg-[#3D7B8C] hover:bg-[#3D7B8C]/90 active:bg-[#1C355E] text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm"
                  >
                     Export to CSV
                  </button>
                </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
}
