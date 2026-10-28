import { 
  Share2, Copy, Check, Building2, Music, X, Settings, Monitor, Database, Lock, 
  Palette, Image as ImageIcon, Video as VideoIcon, Sliders, RefreshCw, Trash2, 
  Upload, Sparkles, Sun, Eye, Play, ArrowRightLeft, BookOpen, ScrollText,
  ShieldCheck, FileText, Download, CheckCircle2, Info,
  Megaphone, Timer, Bell, Clock
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { getSongHistory, exportHistoryCSV } from '../services/historyService';
import { isTauri } from '../utils/env';
import { AnnouncementOverlay, CountdownOverlay, SlideTransitionContainer, AutoFitLyrics, AutoFitLiturgy } from './OutputScreen';
import { getFontFamilyCss } from '../utils/fonts';
import { serializeMonitorChoice, matchSavedMonitorToOptionValue, resolveTargetMonitor, getMonitorDisplayName } from '../utils/monitorUtils';

const CCLI_DISPLAY_MODES = [
  {
    id: 'first_slide',
    name: 'First Slide Only',
    badge: 'Recommended',
    desc: 'Displays legal copyright & license info only on the first slide when the song starts, keeping remaining worship slides clean and distraction-free.'
  },
  {
    id: 'last_slide',
    name: 'Last Slide Only',
    badge: 'Clean Worship',
    desc: 'Displays legal attribution at the conclusion of the song on the final slide.'
  },
  {
    id: 'both',
    name: 'First & Last Slides',
    badge: 'Dual Attribution',
    desc: 'Displays legal credits on both the opening entrance slide and the concluding slide.'
  },
  {
    id: 'all',
    name: 'All Slides',
    badge: 'Continuous',
    desc: 'Displays an unobtrusive, subtle legal footer on every song slide throughout worship.'
  },
  {
    id: 'off',
    name: 'Off / Hidden',
    badge: 'Disabled',
    desc: 'Hides legal line from screen (only recommended if copyright info is printed in church bulletins).'
  }
];

const BG_CATEGORIES = [
  {
    id: 'song',
    name: 'Songs',
    badge: 'Hymns & Worship',
    desc: 'Background shown when projecting worship songs, hymns, and praise lyrics.',
    icon: Music
  },
  {
    id: 'bible',
    name: 'Bible',
    badge: 'Scripture Readings',
    desc: 'Background shown when projecting Bible verses, passages, and sermon scripture.',
    icon: BookOpen
  },
  {
    id: 'liturgy',
    name: 'Liturgy',
    badge: 'Prayers & Creeds',
    desc: 'Background shown during responsive prayers, creeds, and confession of faith.',
    icon: ScrollText
  }
];

const DEMO_SLIDES_BY_CATEGORY = {
  song: [
    ["Amazing grace how sweet the sound", "That saved a wretch like me"],
    ["I once was lost, but now am found", "Was blind, but now I see"]
  ],
  bible: [
    ["[16] For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life."],
    ["[105] Your word is a lamp to my feet and a light to my path."]
  ],
  liturgy: [
    ["The Lord be with you."],
    ["And also with you."]
  ]
};

const NATURAL_CHURCH_PALETTE = [
  { name: 'True Black', hex: '#000000', note: 'Maximum contrast classic' },
  { name: 'Slate Charcoal', hex: '#2D3748', note: 'Cool architectural graphite' },
  { name: 'Sanctuary Navy', hex: '#1C355E', note: 'Signature deep navy blue' },
  { name: 'Coastal Teal', hex: '#1D5666', note: 'Deep sea-glass teal' },
  { name: 'Cathedral Indigo', hex: '#312E81', note: 'Rich royal indigo' },
  { name: 'Spruce Forest', hex: '#164E3B', note: 'Organic evergreen pine' },
  { name: 'Royal Plum', hex: '#581C68', note: 'Liturgical Advent & Lent' },
  { name: 'Cathedral Burgundy', hex: '#6F1D2C', note: 'Communion deep wine' },
  { name: 'Warm Walnut', hex: '#573622', note: 'Acoustic roasted timber' },
  { name: 'Candlelight Ochre', hex: '#6B4816', note: 'Warm antique bronze' },
];

const TRANSITION_OPTIONS = [
  {
    id: 'crossfade',
    name: 'Crossfade / Dissolve',
    badge: 'Worship Standard',
    desc: 'Smoothly melts outgoing lyrics into incoming lyrics without any distracting flash.',
    icon: Sparkles
  },
  {
    id: 'fade_through',
    name: 'Fade Through (Dip)',
    badge: 'Reverent & Clean',
    desc: 'Softly dips outgoing text out before fading in the new verse.',
    icon: Sun
  },
  {
    id: 'slide_left',
    name: 'Slide Left (Push)',
    badge: 'Modern Flow',
    desc: 'Gently slides text in from right to left like turning a page in a hymnal.',
    icon: ArrowRightLeft
  },
  {
    id: 'float_up',
    name: 'Gentle Rise (Float Up)',
    badge: 'Contemporary',
    desc: 'Subtly rises and fades into position for an uplifting, contemporary feel.',
    icon: Eye
  }
];

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

export default function SettingsView({ 
  roomId, 
  churchName, 
  setChurchName, 
  displayFont, 
  setDisplayFont, 
  onChangeLibrary, 
  onClose, 
  selectedMonitor, 
  setSelectedMonitor, 
  remotePassword: propRemotePassword, 
  onSavePassword,
  displaySettings = {},
  onUpdateDisplaySettings,
  onSaveBackgroundImage,
  onClearBackgroundImage,
  onSaveBackgroundVideo,
  onClearBackgroundVideo,
  onApplyBackgroundToAll,
  libraryHandle,
  ccliSettings = {},
  onUpdateCcliSettings,
  overlaySettings = {},
  onUpdateOverlaySettings
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('display');
  const [bgCategory, setBgCategory] = useState('song'); // 'song' | 'bible' | 'liturgy'

  // Announcement & Countdown Overlay Settings State
  const [announcementSettings, setAnnouncementSettings] = useState(() => {
    const raw = {
      position: 'bottom',
      bgColor: '#1C355E',
      textColor: '#FFFFFF',
      bgOpacity: 0.95,
      textSize: 1.0,
      fontSize: 'medium',
      bannerStyle: 'full-width',
      ...(overlaySettings?.announcement || {})
    };
    if (raw.position === 'floating') raw.position = 'center';
    return raw;
  });

  const [countdownSettings, setCountdownSettings] = useState(() => ({
    position: 'center',
    style: 'boxed',
    bgColor: '#1C355E',
    textColor: '#FFFFFF',
    bgOpacity: 0.85,
    defaultMinutes: 5,
    defaultTitle: 'Service starts in',
    endMessage: 'Welcome! Service starting shortly',
    headerTextSize: 1.4,
    digitsSize: 1.0,
    textSize: 1.25,
    ...(overlaySettings?.countdown || {})
  }));

  useEffect(() => {
    if (overlaySettings?.announcement) {
      setAnnouncementSettings(prev => {
        const merged = { ...prev, ...overlaySettings.announcement };
        if (merged.position === 'floating') merged.position = 'center';
        return merged;
      });
    }
    if (overlaySettings?.countdown) {
      setCountdownSettings(prev => ({ ...prev, ...overlaySettings.countdown }));
    }
  }, [overlaySettings]);

  const updateAnnouncementSetting = (field, val) => {
    const next = { ...announcementSettings, [field]: val };
    if (field === 'textSize') {
      next.fontSize = val <= 0.85 ? 'small' : val >= 1.25 ? 'large' : 'medium';
    }
    setAnnouncementSettings(next);
    if (onUpdateOverlaySettings) {
      onUpdateOverlaySettings(cur => ({
        ...cur,
        announcement: next
      }));
    }
  };

  const updateCountdownSetting = (field, val) => {
    const next = { ...countdownSettings, [field]: val };
    setCountdownSettings(next);
    if (onUpdateOverlaySettings) {
      onUpdateOverlaySettings(cur => ({
        ...cur,
        countdown: next
      }));
    }
  };

  const [ccliLicenseNumber, setCcliLicenseNumber] = useState(ccliSettings?.licenseNumber || '');
  const [ccliDisplayMode, setCcliDisplayMode] = useState(ccliSettings?.displayMode || 'first_slide');
  const [ccliPosition, setCcliPosition] = useState(ccliSettings?.position || 'bottom-left');
  const [ccliPreviewSlide, setCcliPreviewSlide] = useState(() =>
    ccliSettings?.displayMode === 'last_slide' ? 'last' : 'first'
  );

  useEffect(() => {
    if (ccliSettings) {
      if (ccliSettings.licenseNumber !== undefined) setCcliLicenseNumber(ccliSettings.licenseNumber);
      if (ccliSettings.displayMode) setCcliDisplayMode(ccliSettings.displayMode);
      if (ccliSettings.position) setCcliPosition(ccliSettings.position);
    }
  }, [ccliSettings]);

  const handleUpdateCcli = (field, value) => {
    if (field === 'licenseNumber') setCcliLicenseNumber(value);
    if (field === 'displayMode') {
      setCcliDisplayMode(value);
      if (value === 'first_slide' || value === 'both') setCcliPreviewSlide('first');
      else if (value === 'last_slide') setCcliPreviewSlide('last');
      else if (value === 'all') setCcliPreviewSlide('middle');
    }
    if (field === 'position') setCcliPosition(value);

    if (onUpdateCcliSettings) {
      onUpdateCcliSettings(prev => ({
        ...prev,
        [field]: value
      }));
    } else {
      import('idb-keyval').then(async ({ get, set }) => {
        const cur = (await get('presenter_ccli_settings')) || {};
        await set('presenter_ccli_settings', { ...cur, [field]: value });
      }).catch(() => {});
    }
  };

  const [ccliFromDate, setCcliFromDate] = useState(() => {
     const d = new Date();
     d.setDate(d.getDate() - 30);
     return d.toISOString().split('T')[0];
  });
  const [ccliToDate, setCcliToDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [monitors, setMonitors] = useState([]);
  const [mainMonitor, setMainMonitor] = useState(null);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [urlPref, setUrlPref] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [localHostname, setLocalHostname] = useState('');
  const [remotePassword, setRemotePassword] = useState(propRemotePassword || '');
  const [copied, setCopied] = useState(false);
  const [copiedRemote, setCopiedRemote] = useState(false);

  // Category-specific background resolution
  const currentBackgrounds = displaySettings?.backgrounds || {
    song: {
      bgType: displaySettings?.bgType || 'color',
      bgColor: displaySettings?.bgColor || '#000000',
      bgImageUrl: displaySettings?.bgImageUrl || null,
      bgVideoUrl: displaySettings?.bgVideoUrl || null,
      bgDim: displaySettings?.bgDim !== undefined ? displaySettings.bgDim : 0.3,
      bgVideoLoop: displaySettings?.bgVideoLoop ?? true,
    },
    bible: {
      bgType: 'color',
      bgColor: '#161d2f',
      bgImageUrl: null,
      bgVideoUrl: null,
      bgDim: 0.3,
      bgVideoLoop: true,
    },
    liturgy: {
      bgType: 'color',
      bgColor: '#111827',
      bgImageUrl: null,
      bgVideoUrl: null,
      bgDim: 0.3,
      bgVideoLoop: true,
    },
    countdown: {
      bgType: 'none',
      bgColor: '#0B132B',
      bgImageUrl: null,
      bgVideoUrl: null,
      bgDim: 0.3,
      bgVideoLoop: true,
    }
  };

  const countdownCatBg = currentBackgrounds.countdown || {
    bgType: 'none',
    bgColor: '#0B132B',
    bgImageUrl: null,
    bgVideoUrl: null,
    bgDim: 0.3,
    bgVideoLoop: true,
  };
  const countdownScreenBgType = countdownCatBg.bgType || 'none';
  const countdownScreenBgColor = countdownCatBg.bgColor || '#0B132B';
  const countdownScreenBgImageUrl = countdownCatBg.bgImageUrl || null;
  const countdownScreenBgVideoUrl = countdownCatBg.bgVideoUrl || null;
  const countdownScreenBgDim = countdownCatBg.bgDim !== undefined ? countdownCatBg.bgDim : 0.3;
  const countdownScreenBgLoop = countdownCatBg.bgVideoLoop ?? true;

  const activeCatBg = currentBackgrounds[bgCategory] || currentBackgrounds.song;
  const bgType = activeCatBg.bgType || 'color';
  const bgColor = activeCatBg.bgColor || '#000000';
  const bgImageUrl = activeCatBg.bgImageUrl || null;
  const bgVideoUrl = activeCatBg.bgVideoUrl || null;
  const bgDim = activeCatBg.bgDim !== undefined ? activeCatBg.bgDim : 0.3;
  const bgVideoLoop = activeCatBg.bgVideoLoop ?? true;

  // Transition settings
  const transitionEnabled = displaySettings?.transitionEnabled ?? true;
  const transitionType = displaySettings?.transitionType || 'crossfade';
  const transitionDuration = displaySettings?.transitionDuration || 400;

  const [customHexInput, setCustomHexInput] = useState(bgColor);
  const [countdownCustomHexInput, setCountdownCustomHexInput] = useState(countdownScreenBgColor);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const countdownImageInputRef = useRef(null);
  const countdownVideoInputRef = useRef(null);

  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryVideos, setLibraryVideos] = useState([]);

  // Demo verse for live simulation in settings
  const [demoVerseIndex, setDemoVerseIndex] = useState(0);

  const triggerDemoTransition = () => {
    setDemoVerseIndex(prev => (prev === 0 ? 1 : 0));
  };

  useEffect(() => {
    if (bgColor) {
      setCustomHexInput(bgColor);
    }
  }, [bgColor, bgCategory]);

  useEffect(() => {
    if (countdownScreenBgColor) {
      setCountdownCustomHexInput(countdownScreenBgColor);
    }
  }, [countdownScreenBgColor]);

  useEffect(() => {
    if (propRemotePassword !== undefined) {
      setRemotePassword(propRemotePassword);
    }
  }, [propRemotePassword]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const ip = await invoke('get_local_ip');
        setLocalIp(ip);
        const hn = await invoke('get_hostname');
        setLocalHostname(hn);
      } catch { /* ignore */ }

      try {
        const { get } = await import('idb-keyval');
        const storedUrl = await get('presenter_custom_base_url');
        if (storedUrl) setCustomBaseUrl(storedUrl);

        const storedPref = await get('presenter_url_pref');
        if (storedPref) setUrlPref(storedPref);

        if (propRemotePassword === undefined) {
          const storedPassword = await get('presenter_remote_password');
          if (storedPassword) setRemotePassword(storedPassword);
        }
      } catch { /* ignore */ }

      try {
        if (isTauri()) {
          const { availableMonitors, currentMonitor } = await import('@tauri-apps/api/window');
          const [result, curMon] = await Promise.all([
            availableMonitors().catch(() => []),
            currentMonitor().catch(() => null)
          ]);
          setMonitors(result || []);
          setMainMonitor(curMon);
        }
      } catch(e) {
        console.error("Failed to fetch monitors", e);
      }
    };
    fetchData();
  }, [propRemotePassword]);

  // Load sample library media if library handle is present
  useEffect(() => {
    if (!libraryHandle) return;
    let isCancelled = false;
    const loadMedia = async () => {
      try {
        const imgDir = await libraryHandle.getDirectoryHandle('Images', { create: false });
        const imgs = [];
        for await (const entry of imgDir.values()) {
          if (entry.kind === 'file' && entry.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            imgs.push(entry);
          }
        }
        if (!isCancelled) setLibraryImages(imgs.slice(0, 10));
      } catch { /* ignore */ }

      try {
        const vidDir = await libraryHandle.getDirectoryHandle('Videos', { create: false });
        const vids = [];
        for await (const entry of vidDir.values()) {
          if (entry.kind === 'file' && entry.name.match(/\.(mp4|webm|mov)$/i)) {
            vids.push(entry);
          }
        }
        if (!isCancelled) setLibraryVideos(vids.slice(0, 6));
      } catch { /* ignore */ }
    };
    loadMedia();
    return () => { isCancelled = true; };
  }, [libraryHandle]);

  // Compute URLs
  let defaultBase = 'http://localhost:5178/';
  if (urlPref === 'ip' && localIp) defaultBase = `http://${localIp}:5178/`;
  else if (urlPref === 'hostname' && localHostname) defaultBase = `http://${localHostname}:5178/`;
  else if (localHostname) defaultBase = `http://${localHostname}:5178/`;
  else if (localIp) defaultBase = `http://${localIp}:5178/`;
  const base = customBaseUrl || defaultBase;
  const baseWithSlash = base.endsWith('/') ? base : base + '/';
  const liveUrl = baseWithSlash + '?network=true' + (roomId ? '&room=' + roomId : '');
  const remoteUrl = baseWithSlash + '?remoteControl=' + (roomId || 'default');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(liveUrl);
  const remoteQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(remoteUrl);

  const handleMonitorChange = async (e) => {
     const val = e.target.value;
     setSelectedMonitor(val);
     try {
         const { set } = await import('idb-keyval');
         await set('presenter_selected_monitor', val);
     } catch { /* ignore */ }
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
      } catch { /* ignore */ }
  };

  const handleSavePassword = async (val) => {
      setRemotePassword(val);
      if (onSavePassword) {
          onSavePassword(val);
      } else {
          try {
              const { set } = await import('idb-keyval');
              await set('presenter_remote_password', val);
          } catch { /* ignore */ }
      }
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
    } catch { /* ignore */ }
  };

  const handleSelectColor = (hex) => {
    setCustomHexInput(hex);
    if (onUpdateDisplaySettings) {
      onUpdateDisplaySettings(prevCat => ({
        ...prevCat,
        bgType: 'color',
        bgColor: hex
      }), bgCategory);
    }
  };

  const handleCustomHexChange = (e) => {
    const val = e.target.value;
    setCustomHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      if (onUpdateDisplaySettings) {
        onUpdateDisplaySettings(prevCat => ({
          ...prevCat,
          bgType: 'color',
          bgColor: val
        }), bgCategory);
      }
    }
  };

  const handleSelectCountdownScreenColor = (hex) => {
    setCountdownCustomHexInput(hex);
    if (onUpdateDisplaySettings) {
      onUpdateDisplaySettings(prevCat => ({
        ...prevCat,
        bgType: 'color',
        bgColor: hex
      }), 'countdown');
    }
  };

  const handleCountdownCustomHexChange = (e) => {
    const val = e.target.value;
    setCountdownCustomHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      if (onUpdateDisplaySettings) {
        onUpdateDisplaySettings(prevCat => ({
          ...prevCat,
          bgType: 'color',
          bgColor: val
        }), 'countdown');
      }
    }
  };

  const handleApplyToAll = () => {
    if (onApplyBackgroundToAll) {
      onApplyBackgroundToAll(bgCategory);
    } else if (onUpdateDisplaySettings) {
      onUpdateDisplaySettings(prev => ({
        ...prev,
        backgrounds: {
          song: { ...activeCatBg },
          bible: { ...activeCatBg },
          liturgy: { ...activeCatBg },
          countdown: currentBackgrounds.countdown
        },
        bgType: activeCatBg.bgType,
        bgColor: activeCatBg.bgColor,
        bgImageUrl: activeCatBg.bgImageUrl,
        bgVideoUrl: activeCatBg.bgVideoUrl,
        bgDim: activeCatBg.bgDim,
        bgVideoLoop: activeCatBg.bgVideoLoop
      }));
    }
  };

  const resolvedPreviewFont = getFontFamilyCss(displayFont);
  const activeTextScale = displaySettings?.textScale ?? 1;

  const renderDemoSlideContent = (category, verseIdx) => {
    const slides = DEMO_SLIDES_BY_CATEGORY[category] || DEMO_SLIDES_BY_CATEGORY.song;
    const lines = slides[verseIdx % slides.length];
    if (category === 'liturgy') {
      return (
        <AutoFitLiturgy
          lines={lines}
          liturgyType={verseIdx % 2 === 1 ? 'response' : 'speaker'}
          alignment="center"
          isLiveBroadcast={true}
          fontFamily={resolvedPreviewFont}
          fontName={displayFont || 'Inter'}
          textScale={activeTextScale}
          linesPerSlide={2}
        />
      );
    }
    return (
      <AutoFitLyrics
        lines={lines}
        subText={category === 'bible' ? (verseIdx % 2 === 0 ? 'John 3:16' : 'Psalm 119:105') : null}
        isLiveBroadcast={true}
        mediaType={category}
        fontFamily={resolvedPreviewFont}
        fontName={displayFont || 'Inter'}
        textScale={activeTextScale}
        linesPerSlide={category === 'song' ? 2 : 1}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF6F0] flex flex-col animate-in fade-in duration-200">
      
      {/* Hidden File Inputs for Background Media */}
      <input 
        type="file" 
        ref={imageInputRef} 
        accept="image/png,image/jpeg,image/webp,image/gif" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onSaveBackgroundImage) {
            onSaveBackgroundImage(file, bgCategory);
          }
          e.target.value = '';
        }} 
      />
      <input 
        type="file" 
        ref={videoInputRef} 
        accept="video/mp4,video/webm,video/quicktime" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onSaveBackgroundVideo) {
            onSaveBackgroundVideo(file, bgCategory);
          }
          e.target.value = '';
        }} 
      />
      <input 
        type="file" 
        ref={countdownImageInputRef} 
        accept="image/png,image/jpeg,image/webp,image/gif" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onSaveBackgroundImage) {
            onSaveBackgroundImage(file, 'countdown');
          }
          e.target.value = '';
        }} 
      />
      <input 
        type="file" 
        ref={countdownVideoInputRef} 
        accept="video/mp4,video/webm,video/quicktime" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onSaveBackgroundVideo) {
            onSaveBackgroundVideo(file, 'countdown');
          }
          e.target.value = '';
        }} 
      />

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#E4E1DA] bg-white flex-shrink-0">
        <h2 className="text-lg font-black uppercase tracking-widest text-[#1C355E] flex items-center gap-3">
          <Settings size={22} className="text-[#3D7B8C]" /> System Settings
        </h2>
        <button 
          onClick={onClose}
          className="p-2.5 bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] rounded-xl text-[#526075] hover:text-[#1C355E] transition-colors"
          title="Close Settings"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="px-8 pt-3 bg-white border-b border-[#E4E1DA] flex gap-2 flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveSettingsTab('display')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeSettingsTab === 'display'
              ? 'border-[#7A502A] text-[#1C355E] bg-[#FAF6F0]'
              : 'border-transparent text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]/60'
          }`}
        >
          <Monitor size={17} className={activeSettingsTab === 'display' ? 'text-[#7A502A]' : ''} />
          Display & Transitions
        </button>
        <button
          onClick={() => setActiveSettingsTab('overlays')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeSettingsTab === 'overlays'
              ? 'border-[#7A502A] text-[#1C355E] bg-[#FAF6F0]'
              : 'border-transparent text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]/60'
          }`}
        >
          <Bell size={17} className={activeSettingsTab === 'overlays' ? 'text-[#7A502A]' : ''} />
          Announcements & Timer
        </button>
        <button
          onClick={() => setActiveSettingsTab('network')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeSettingsTab === 'network'
              ? 'border-[#7A502A] text-[#1C355E] bg-[#FAF6F0]'
              : 'border-transparent text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]/60'
          }`}
        >
          <Share2 size={17} className={activeSettingsTab === 'network' ? 'text-[#7A502A]' : ''} />
          Network & Remotes
        </button>
        <button
          onClick={() => setActiveSettingsTab('ccli')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeSettingsTab === 'ccli'
              ? 'border-[#7A502A] text-[#1C355E] bg-[#FAF6F0]'
              : 'border-transparent text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]/60'
          }`}
        >
          <Music size={17} className={activeSettingsTab === 'ccli' ? 'text-[#7A502A]' : ''} />
          Song History & CCLI
        </button>
        <button
          onClick={() => setActiveSettingsTab('general')}
          className={`flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeSettingsTab === 'general'
              ? 'border-[#7A502A] text-[#1C355E] bg-[#FAF6F0]'
              : 'border-transparent text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]/60'
          }`}
        >
          <Building2 size={17} className={activeSettingsTab === 'general' ? 'text-[#7A502A]' : ''} />
          General Profile
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          
          {/* TAB 1: DISPLAY, TRANSITIONS & BACKGROUND */}
          {activeSettingsTab === 'display' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-200">
              
              {/* Row 1: Output Display & Typography (Moved from general settings to display!) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. Projector Output Selector */}
                <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                  <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                    <Monitor size={17} /> Projector Monitor Output
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                      Output Target Display
                    </label>
                    <select 
                      value={matchSavedMonitorToOptionValue(selectedMonitor, monitors)} 
                      onChange={handleMonitorChange}
                      className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition-all font-medium"
                    >
                      {monitors.length <= 1 ? (
                        <option value="">
                          {monitors[0] 
                            ? getMonitorDisplayName(monitors[0], 0, monitors, mainMonitor) 
                            : 'Internal Display / Monitor 1'}
                        </option>
                      ) : (
                        <>
                          <option value="">
                            {(() => {
                              const autoTarget = resolveTargetMonitor('', monitors, mainMonitor).monitor;
                              return autoTarget 
                                ? `Auto — ${getMonitorDisplayName(autoTarget, monitors.indexOf(autoTarget), monitors, mainMonitor)}`
                                : 'Auto — External Projector / Monitor 2';
                            })()}
                          </option>
                          {monitors.map((m, i) => {
                            const serialized = serializeMonitorChoice(m);
                            return (
                              <option key={i} value={serialized}>
                                {getMonitorDisplayName(m, i, monitors, mainMonitor)}
                              </option>
                            );
                          })}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* 2. Global Presentation Font & Text Scale */}
                <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                  <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                    <Sliders size={17} /> Presentation Typography & Sizing
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                      Global Display Font
                    </label>
                    <select 
                      value={displayFont || "Inter"}
                      onChange={(e) => {
                          setDisplayFont(e.target.value);
                          import('idb-keyval').then(({ set }) => set('presenter_display_font', e.target.value));
                      }}
                      style={{ fontFamily: displayFont }}
                      className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition-all font-medium"
                    >
                      {FONT_OPTIONS.map(font => (
                        <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 pt-2 border-t border-[#E4E1DA]">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Output Text Scale
                      </label>
                      <span className="text-[10px] font-bold text-[#3D7B8C]">
                        {Math.round(activeTextScale * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 0.9, label: 'Compact (90%)' },
                        { value: 1, label: 'Standard (100%)' },
                        { value: 1.12, label: 'Large (112%)' },
                        { value: 1.25, label: 'Max (125%)' }
                      ].map(opt => {
                        const isSelected = Math.abs(activeTextScale - opt.value) < 0.02;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, textScale: opt.value }))}
                            className={`py-2 px-2 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                              isSelected
                                ? 'bg-[#1C355E] text-white border-[#1C355E]'
                                : 'bg-[#FAF6F0] text-[#526075] hover:text-[#1C355E] hover:bg-[#F0EBE1] border-[#E4E1DA]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

              {/* Row 2: Slide Transitions Card */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                
                {/* Header & Main Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
                  <div>
                    <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                      <RefreshCw size={17} /> Slide Transitions
                    </div>
                    <p className="text-xs text-[#526075] mt-1">
                      Choose how lyrics, scripture passages, and liturgy animate when advancing between slides.
                    </p>
                  </div>

                  {/* Enable Transitions Toggle */}
                  <label className="flex items-center gap-3 bg-[#FAF6F0] px-4 py-2.5 rounded-xl border border-[#E4E1DA] cursor-pointer hover:bg-[#F0EBE1] transition self-start sm:self-auto">
                    <input 
                      type="checkbox"
                      checked={transitionEnabled}
                      onChange={(e) => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, transitionEnabled: e.target.checked }))}
                      className="w-5 h-5 accent-[#3D7B8C] cursor-pointer rounded"
                    />
                    <span className="text-xs font-black text-[#1C355E] uppercase tracking-wider select-none">
                      {transitionEnabled ? 'Transitions Enabled' : 'Transitions Off (Cut)'}
                    </span>
                  </label>
                </div>

                {transitionEnabled ? (
                  <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                    
                    {/* The 4 Standard Church Transitions */}
                    <div>
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block mb-3">
                        Select Transition Style
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {TRANSITION_OPTIONS.map((t) => {
                          const isSelected = transitionType === t.id;
                          const IconComponent = t.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                if (onUpdateDisplaySettings) {
                                  onUpdateDisplaySettings(p => ({ ...p, transitionType: t.id }));
                                }
                                setDemoVerseIndex(prev => (prev === 0 ? 1 : 0));
                              }}
                              className={`flex flex-col text-left p-4 rounded-xl border transition-all relative ${
                                isSelected 
                                  ? 'border-[#3D7B8C] bg-[#EDF4F6] ring-1 ring-[#3D7B8C]/40' 
                                  : 'border-[#E4E1DA] bg-[#FAF6F0] hover:border-[#3D7B8C]/40 hover:bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#3D7B8C] border border-[#E4E1DA]'}`}>
                                  <IconComponent size={16} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-[#E4E1DA] text-[#3D7B8C]">
                                  {t.badge}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-[#1C355E] mb-1">{t.name}</div>
                              <p className="text-[11px] text-[#526075] leading-relaxed">{t.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transition Speed Slider */}
                    <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block">
                            Transition Speed: {transitionDuration}ms
                          </label>
                          <p className="text-[11px] text-[#526075] mt-0.5">
                            Controls the duration of the crossfade or slide animation.
                          </p>
                        </div>
                        
                        {/* Quick Presets */}
                        <div className="flex gap-1.5 self-start sm:self-auto">
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, transitionDuration: 200 }))}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition ${transitionDuration === 200 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            Fast (200ms)
                          </button>
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, transitionDuration: 400 }))}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition ${transitionDuration === 400 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            Smooth (400ms)
                          </button>
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, transitionDuration: 700 }))}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition ${transitionDuration === 700 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            Gentle (700ms)
                          </button>
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, transitionDuration: 1000 }))}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition ${transitionDuration === 1000 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            Slow (1000ms)
                          </button>
                        </div>
                      </div>

                      <input 
                        type="range" 
                        min="150" 
                        max="1200" 
                        step="50"
                        value={transitionDuration}
                        onChange={(e) => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, transitionDuration: parseInt(e.target.value) }))}
                        className="w-full accent-[#3D7B8C] cursor-pointer mt-1"
                      />
                    </div>

                    {/* Interactive Live Transition Preview */}
                    <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest flex items-center gap-1.5">
                            <Eye size={13} className="text-[#3D7B8C]" /> Live Transition Preview
                          </span>
                          <div className="flex bg-white p-0.5 rounded-lg border border-[#E4E1DA]">
                            {BG_CATEGORIES.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setBgCategory(cat.id)}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                                  bgCategory === cat.id
                                    ? 'bg-[#1C355E] text-white'
                                    : 'text-[#526075] hover:text-[#1C355E]'
                                }`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={triggerDemoTransition}
                          className="px-3.5 py-1.5 bg-[#7A502A] hover:bg-[#654121] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play size={12} fill="currentColor" /> Preview Next Slide
                        </button>
                      </div>

                      <div
                        className="relative w-full max-w-2xl mx-auto aspect-video rounded-xl overflow-hidden border border-[#E4E1DA] transition-colors duration-500"
                        style={{
                          backgroundColor: bgColor,
                          containerType: 'size'
                        }}
                      >
                        {bgType === 'image' && bgImageUrl && (
                          <div className="absolute inset-0 pointer-events-none">
                            <img src={bgImageUrl} alt="" className="w-full h-full object-cover" />
                            {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
                          </div>
                        )}
                        {bgType === 'video' && bgVideoUrl && (
                          <div className="absolute inset-0 pointer-events-none">
                            <video src={bgVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                            {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
                          </div>
                        )}
                        <SlideTransitionContainer
                          contentKey={`demo_top_${bgCategory}_${demoVerseIndex}`}
                          transitionEnabled={transitionEnabled}
                          transitionType={transitionType}
                          duration={transitionDuration}
                        >
                          {renderDemoSlideContent(bgCategory, demoVerseIndex)}
                        </SlideTransitionContainer>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-4 bg-[#FAF6F0] rounded-xl border border-dashed border-[#E4E1DA] text-center">
                    <p className="text-xs text-[#526075] font-medium">
                      Transitions are currently switched off. Slides will snap instantly with a direct cut.
                    </p>
                  </div>
                )}

              </div>

              {/* Row 3: Background Configuration Card */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                
                {/* Header with Category Tabs */}
                <div className="flex flex-col gap-4 pb-4 border-b border-[#E4E1DA]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                        <Palette size={17} /> Independent Backgrounds
                      </div>
                      <p className="text-xs text-[#526075] mt-1">
                        Customise background colours, image stills, and motion loops separately for Songs, Bible passages, and Liturgy.
                      </p>
                    </div>

                    <button
                      onClick={handleApplyToAll}
                      className="px-3.5 py-2 bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] rounded-xl text-xs font-bold text-[#1C355E] flex items-center gap-2 transition self-start md:self-auto group"
                      title="Apply current category's background styling to Songs, Bible, and Liturgy"
                    >
                      <Copy size={13} className="text-[#3D7B8C] group-hover:scale-110 transition-transform" />
                      <span>Apply this to All Types</span>
                    </button>
                  </div>

                  {/* Primary Category Selector Tabs (Songs / Bible / Liturgy) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    {BG_CATEGORIES.map(cat => {
                      const isCatSelected = bgCategory === cat.id;
                      const CatIcon = cat.icon;
                      const catSetting = currentBackgrounds[cat.id] || {};
                      const isCatImage = catSetting.bgType === 'image';
                      const isCatVideo = catSetting.bgType === 'video';
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setBgCategory(cat.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all relative ${
                            isCatSelected
                              ? 'border-[#3D7B8C] bg-[#EDF4F6] ring-1 ring-[#3D7B8C]/40'
                              : 'border-[#E4E1DA] bg-[#FAF6F0] hover:border-[#3D7B8C]/40 hover:bg-white'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isCatSelected ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#3D7B8C] border border-[#E4E1DA]'
                          }`}>
                            <CatIcon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-bold text-[#1C355E] truncate">{cat.name}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border border-[#E4E1DA] text-[#3D7B8C]">
                                {isCatVideo ? 'Video' : isCatImage ? 'Image' : 'Colour'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#526075] truncate mt-0.5">{cat.badge}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-header showing active category title + Mode Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E4E1DA]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#1C355E] uppercase tracking-wide">
                        Editing {bgCategory === 'song' ? 'Songs & Hymns' : bgCategory === 'bible' ? 'Bible & Scripture' : 'Liturgy & Prayers'} Background:
                      </span>
                    </div>

                    {/* Segmented Mode Selector for active category */}
                    <div className="flex bg-[#FAF6F0] p-1 rounded-xl border border-[#E4E1DA] self-start sm:self-auto">
                      <button
                        onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(prev => ({ ...prev, bgType: 'color' }), bgCategory)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                          bgType === 'color' 
                            ? 'bg-[#3D7B8C] text-white' 
                            : 'text-[#526075] hover:text-[#1C355E]'
                        }`}
                      >
                        <Palette size={13} /> Colour
                      </button>
                      <button
                        onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(prev => ({ ...prev, bgType: 'image' }), bgCategory)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                          bgType === 'image' 
                            ? 'bg-[#3D7B8C] text-white' 
                            : 'text-[#526075] hover:text-[#1C355E]'
                        }`}
                      >
                        <ImageIcon size={13} /> Image
                      </button>
                      <button
                        onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(prev => ({ ...prev, bgType: 'video' }), bgCategory)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                          bgType === 'video' 
                            ? 'bg-[#3D7B8C] text-white' 
                            : 'text-[#526075] hover:text-[#1C355E]'
                        }`}
                      >
                        <VideoIcon size={13} /> Video
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sub-Panel: COLOUR MODE */}
                {bgType === 'color' && (
                  <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                    
                    {/* Natural Church Palette */}
                    <div>
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block mb-3">
                        Natural Church Palette (Reverent & High Contrast)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {NATURAL_CHURCH_PALETTE.map((swatch) => {
                          const isSelected = bgColor.toLowerCase() === swatch.hex.toLowerCase();
                          return (
                            <button
                              key={swatch.hex}
                              onClick={() => handleSelectColor(swatch.hex)}
                              className={`group flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                                isSelected 
                                  ? 'border-[#3D7B8C] bg-[#EDF4F6] ring-1 ring-[#3D7B8C]/40' 
                                  : 'border-[#E4E1DA] bg-[#FAF6F0] hover:border-[#3D7B8C]/40 hover:bg-white'
                              }`}
                            >
                              <div 
                                className="w-9 h-9 rounded-lg border border-black/20 shadow-inner flex-shrink-0 flex items-center justify-center"
                                style={{ backgroundColor: swatch.hex }}
                              >
                                {isSelected && <Check size={14} className="text-white" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-[#1C355E] truncate">{swatch.name}</div>
                                <div className="text-[10px] font-mono text-[#526075] uppercase">{swatch.hex}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Hex Option */}
                    <div className="pt-4 border-t border-[#E4E1DA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block">
                          Custom Hex Colour ({bgCategory === 'song' ? 'Songs' : bgCategory === 'bible' ? 'Bible' : 'Liturgy'})
                        </label>
                        <p className="text-[11px] text-[#526075] mt-0.5">
                          Choose any custom shade or paste a hex code.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex items-center">
                          <input 
                            type="color" 
                            value={bgColor}
                            onChange={(e) => handleSelectColor(e.target.value)}
                            className="w-10 h-10 rounded-xl cursor-pointer border border-[#E4E1DA] p-0.5 bg-white"
                            title="Open Colour Wheel"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={customHexInput}
                            onChange={handleCustomHexChange}
                            placeholder="#000000"
                            maxLength={7}
                            className="w-28 bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1C355E] uppercase focus:outline-none focus:border-[#3D7B8C]"
                          />
                        </div>
                        <button
                          onClick={() => handleSelectColor('#000000')}
                          className="px-3 py-2 text-[11px] font-bold text-[#526075] hover:text-[#1C355E] rounded-lg transition hover:bg-[#F0EBE1]"
                        >
                          Reset to Black
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {/* Sub-Panel: IMAGE MODE */}
                {bgType === 'image' && (
                  <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                    
                    {/* Active Image or Upload Box */}
                    {bgImageUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA]">
                        <div className="relative w-40 h-24 rounded-lg overflow-hidden border border-[#E4E1DA] bg-black flex-shrink-0">
                          <img src={bgImageUrl} alt="Background" className="w-full h-full object-cover" />
                          {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <div className="text-xs font-bold text-[#1C355E]">
                            Active Background Image for {bgCategory === 'song' ? 'Songs' : bgCategory === 'bible' ? 'Bible' : 'Liturgy'}
                          </div>
                          <p className="text-[11px] text-[#526075] mt-1">
                            This image is active when presenting {bgCategory === 'song' ? 'lyrics' : bgCategory === 'bible' ? 'scripture verses' : 'liturgy'}.
                          </p>
                          <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                            <button
                              onClick={() => imageInputRef.current?.click()}
                              className="px-4 py-2 bg-white hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Upload size={13} /> Replace Image
                            </button>
                            <button
                              onClick={() => onClearBackgroundImage && onClearBackgroundImage(bgCategory)}
                              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="border-2 border-dashed border-[#E4E1DA] hover:border-[#3D7B8C] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-[#FAF6F0] hover:bg-[#EDF4F6]/60 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white border border-[#E4E1DA] flex items-center justify-center text-[#3D7B8C] mb-3 group-hover:scale-105 transition-transform">
                          <Upload size={22} />
                        </div>
                        <div className="text-sm font-bold text-[#1C355E]">
                          Click to Choose {bgCategory === 'song' ? 'Song' : bgCategory === 'bible' ? 'Bible' : 'Liturgy'} Background Image
                        </div>
                        <p className="text-xs text-[#526075] mt-1">
                          Supports high-resolution PNG, JPG, or WebP church backgrounds
                        </p>
                      </div>
                    )}

                    {/* Quick Pick from Presenter Images Folder */}
                    {libraryImages.length > 0 && (
                      <div className="pt-2">
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block mb-2">
                          Or Choose from your Images Library:
                        </label>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                          {libraryImages.map((entry) => (
                            <button
                              key={entry.name}
                              onClick={async () => {
                                try {
                                  const file = await entry.getFile();
                                  if (onSaveBackgroundImage) onSaveBackgroundImage(file, bgCategory);
                                } catch { /* ignore */ }
                              }}
                              className="px-3 py-2 bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] rounded-lg text-xs font-medium text-[#1C355E] flex items-center gap-1.5 truncate max-w-[180px] flex-shrink-0 transition"
                            >
                              <ImageIcon size={12} className="text-[#3D7B8C] flex-shrink-0" />
                              <span className="truncate">{entry.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Text Readability Dimmer Slider */}
                    <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block">
                            Text Readability Dimming: {Math.round(bgDim * 100)}%
                          </label>
                          <p className="text-[11px] text-[#526075] mt-0.5">
                            Darkens the background image so lyrics and scripture remain crisp and legible.
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: 0.2 }), bgCategory)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md ${Math.round(bgDim * 100) === 20 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            20%
                          </button>
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: 0.4 }), bgCategory)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md ${Math.round(bgDim * 100) === 40 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            40%
                          </button>
                          <button 
                            onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: 0.6 }), bgCategory)}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md ${Math.round(bgDim * 100) === 60 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                          >
                            60%
                          </button>
                        </div>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="0.8" 
                        step="0.05"
                        value={bgDim}
                        onChange={(e) => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: parseFloat(e.target.value) }), bgCategory)}
                        className="w-full accent-[#3D7B8C] cursor-pointer"
                      />
                    </div>

                  </div>
                )}

                {/* Sub-Panel: VIDEO MODE */}
                {bgType === 'video' && (
                  <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                    
                    {/* Active Video or Upload Box */}
                    {bgVideoUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA]">
                        <div className="relative w-40 h-24 rounded-lg overflow-hidden border border-[#E4E1DA] bg-black flex-shrink-0">
                          <video src={bgVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                          {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <div className="text-xs font-bold text-[#1C355E]">
                            Active Background Video Loop for {bgCategory === 'song' ? 'Songs' : bgCategory === 'bible' ? 'Bible' : 'Liturgy'}
                          </div>
                          <p className="text-[11px] text-[#526075] mt-1">
                            This video will loop continuously in the background (muted).
                          </p>
                          <div className="flex items-center gap-2 mt-3 justify-center sm:justify-start">
                            <button
                              onClick={() => videoInputRef.current?.click()}
                              className="px-4 py-2 bg-white hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Upload size={13} /> Replace Video
                            </button>
                            <button
                              onClick={() => onClearBackgroundVideo && onClearBackgroundVideo(bgCategory)}
                              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => videoInputRef.current?.click()}
                        className="border-2 border-dashed border-[#E4E1DA] hover:border-[#3D7B8C] rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer bg-[#FAF6F0] hover:bg-[#EDF4F6]/60 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-white border border-[#E4E1DA] flex items-center justify-center text-[#3D7B8C] mb-3 group-hover:scale-105 transition-transform">
                          <VideoIcon size={22} />
                        </div>
                        <div className="text-sm font-bold text-[#1C355E]">
                          Click to Choose {bgCategory === 'song' ? 'Song' : bgCategory === 'bible' ? 'Bible' : 'Liturgy'} Background Video Loop
                        </div>
                        <p className="text-xs text-[#526075] mt-1">
                          Supports MP4 or WebM motion worship background loops (audio is muted automatically)
                        </p>
                      </div>
                    )}

                    {/* Quick Pick from Presenter Videos Folder */}
                    {libraryVideos.length > 0 && (
                      <div className="pt-2">
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block mb-2">
                          Or Choose from your Videos Library:
                        </label>
                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                          {libraryVideos.map((entry) => (
                            <button
                              key={entry.name}
                              onClick={async () => {
                                try {
                                  const file = await entry.getFile();
                                  if (onSaveBackgroundVideo) onSaveBackgroundVideo(file, bgCategory);
                                } catch { /* ignore */ }
                              }}
                              className="px-3 py-2 bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] rounded-lg text-xs font-medium text-[#1C355E] flex items-center gap-1.5 truncate max-w-[180px] flex-shrink-0 transition"
                            >
                              <VideoIcon size={12} className="text-[#3D7B8C] flex-shrink-0" />
                              <span className="truncate">{entry.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Loop Toggle & Dimmer */}
                    <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-[#1C355E]">Continuous Video Loop</label>
                          <p className="text-[11px] text-[#526075]">Restarts seamlessly once playback completes.</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={bgVideoLoop}
                          onChange={(e) => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgVideoLoop: e.target.checked }), bgCategory)}
                          className="w-4 h-4 accent-[#3D7B8C] cursor-pointer"
                        />
                      </div>

                      <div className="pt-3 border-t border-[#E4E1DA] flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest block">
                            Text Readability Dimming: {Math.round(bgDim * 100)}%
                          </label>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: 0.2 }), bgCategory)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md ${Math.round(bgDim * 100) === 20 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                            >
                              20%
                            </button>
                            <button 
                              onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: 0.4 }), bgCategory)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md ${Math.round(bgDim * 100) === 40 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                            >
                              40%
                            </button>
                            <button 
                              onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: 0.6 }), bgCategory)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-md ${Math.round(bgDim * 100) === 60 ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#526075] hover:text-[#1C355E] border border-[#E4E1DA]'}`}
                            >
                              60%
                            </button>
                          </div>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="0.8" 
                          step="0.05"
                          value={bgDim}
                          onChange={(e) => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: parseFloat(e.target.value) }), bgCategory)}
                          className="w-full accent-[#3D7B8C] cursor-pointer"
                        />
                      </div>
                    </div>

                  </div>
                )}

                {/* Live Output Slide & Transition Simulation Box */}
                <div className="pt-4 border-t border-[#E4E1DA] flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest flex items-center gap-1.5">
                        <Eye size={13} className="text-[#3D7B8C]" /> Live Output Simulation
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EDF4F6] text-[#3D7B8C] border border-[#3D7B8C]/20">
                        Previewing: {bgCategory === 'song' ? 'Songs / Lyrics' : bgCategory === 'bible' ? 'Bible / Scripture' : 'Liturgy & Prayers'}
                      </span>
                    </div>

                    <button
                      onClick={triggerDemoTransition}
                      className="px-3.5 py-1.5 bg-[#3D7B8C] hover:bg-[#2F6473] active:scale-95 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Play size={12} fill="currentColor" /> Test Slide Transition
                    </button>
                  </div>
                  
                  <div 
                    className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#E4E1DA] transition-colors duration-500"
                    style={{ 
                      backgroundColor: bgColor,
                      containerType: 'size'
                    }}
                  >
                    {/* Background Layer Simulation */}
                    {bgType === 'image' && bgImageUrl && (
                      <div className="absolute inset-0 pointer-events-none">
                        <img src={bgImageUrl} alt="Preview BG" className="w-full h-full object-cover" />
                        {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
                      </div>
                    )}
                    {bgType === 'video' && bgVideoUrl && (
                      <div className="absolute inset-0 pointer-events-none">
                        <video src={bgVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        {bgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: bgDim }} />}
                      </div>
                    )}

                    <SlideTransitionContainer
                      contentKey={`demo_bg_${bgCategory}_${demoVerseIndex}`}
                      transitionEnabled={transitionEnabled}
                      transitionType={transitionType}
                      duration={transitionDuration}
                    >
                      {renderDemoSlideContent(bgCategory, demoVerseIndex)}
                    </SlideTransitionContainer>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#526075] mt-0.5">
                    <span>Active Transition: <strong className="text-[#1C355E] capitalize">{transitionEnabled ? transitionType.replace('_', ' ') : 'None (Cut)'}</strong> ({transitionDuration}ms)</span>
                    <span>Click &quot;Test Slide Transition&quot; to preview animation speed</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: GENERAL PROFILE (No duplicate font or monitor settings!) */}
          {activeSettingsTab === 'general' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-200">
              
              {/* Organisation Profile Card */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
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
                       className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-lg px-4 py-3 text-sm text-[#1C355E] placeholder-[#526075]/60 focus:outline-none focus:border-[#3D7B8C] focus:ring-1 focus:ring-[#3D7B8C]/40 transition-all font-medium"
                    />
                    <p className="text-[10px] text-[#526075] mt-1 leading-relaxed">
                       Your organisation name, used for displaying on your output screens to confirm signal before go live.
                    </p>
                </div>
              </div>

              {/* Storage Settings Card */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2">
                   <Database size={16} /> Storage Settings
                </div>
                
                <div className="flex flex-col gap-2 h-full justify-between">
                    <div>
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Media Library Location</label>
                      <p className="text-[10px] text-[#526075] mt-1 leading-relaxed">
                         Click this to select a new base folder for your Presenter library. This will reload the application.
                      </p>
                    </div>
                    <button 
                       onClick={onChangeLibrary}
                       className="w-full bg-[#FAF6F0] hover:bg-[#F0EBE1] active:bg-[#E4E1DA] border border-[#E4E1DA] text-[#1C355E] font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 mt-4"
                    >
                       Change Media Library Folder
                    </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: NETWORK & REMOTES */}
          {activeSettingsTab === 'network' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-200">
              
              {/* Server Configuration */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
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
                           className="flex-1 bg-[#FAF6F0] border border-[#E4E1DA] rounded-lg px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition-all font-medium"
                        />
                    </div>

                    <div className="flex flex-col gap-1 mt-2 mb-2 p-3 bg-[#FAF6F0] border border-[#E4E1DA] rounded-lg">
                        <div className="text-[10px] text-[#526075] font-bold uppercase tracking-widest mb-1">Detected Network Addresses</div>
                        {localHostname && (
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-mono text-[#1C355E] flex-1">http://{localHostname}:5178/</span>
                               <button onClick={() => { setUrlPref('hostname'); setCustomBaseUrl(''); import('idb-keyval').then(({set, del}) => { set('presenter_url_pref', 'hostname'); del('presenter_custom_base_url'); }); }} className="px-2 py-1 text-[9px] bg-[#EDF4F6] text-[#3D7B8C] border border-[#3D7B8C]/20 font-bold uppercase rounded-md hover:bg-[#3D7B8C]/15">Use Hostname</button>
                            </div>
                        )}
                        {localIp && (
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-xs font-mono text-[#526075] flex-1">http://{localIp}:5178/</span>
                               <button onClick={() => { setUrlPref('ip'); setCustomBaseUrl(''); import('idb-keyval').then(({set, del}) => { set('presenter_url_pref', 'ip'); del('presenter_custom_base_url'); }); }} className="px-2 py-1 text-[9px] bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] font-bold uppercase rounded-md hover:bg-[#E4E1DA]">Use IP</button>
                            </div>
                        )}
                    </div>

                    <p className="text-[10px] text-[#526075] leading-relaxed mt-1">
                       If you have a local DNS or static IP, enter it here. This ensures the QR codes stay the same every week.
                    </p>
                </div>
              </div>

              {/* Mobile Remote Control */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2 w-full">
                   <Share2 size={16} /> Mobile Remote Control
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="bg-[#FAF6F0] p-2 rounded-xl border border-[#E4E1DA] flex-shrink-0">
                    <img src={remoteQrUrl} alt="Remote Control QR Code" className="w-24 h-24" />
                  </div>
                  <div className="flex flex-col gap-2 w-full min-w-0">
                      <div className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Remote Control URL</div>
                      <div className="flex items-center gap-2 bg-[#FAF6F0] px-3 py-2 rounded-lg border border-[#E4E1DA] group cursor-pointer hover:border-[#3D7B8C] transition-colors w-full overflow-hidden" onClick={() => handleCopy(remoteUrl, setCopiedRemote)}>
                          <code className="text-[11px] text-[#3D7B8C] font-bold truncate flex-1 text-left">{remoteUrl}</code>
                          {copiedRemote ? <Check size={12} className="text-emerald-700 flex-shrink-0" /> : <Copy size={12} className="text-[#526075] group-hover:text-[#3D7B8C] transition-colors flex-shrink-0" />}
                      </div>
                      {copiedRemote && <div className="text-[9px] text-emerald-700 font-bold">Copied to clipboard!</div>}
                      
                      <div className="flex flex-col gap-1 mt-2">
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest flex items-center gap-1"><Lock size={10} /> Remote PIN</label>
                          <input 
                             type="text" 
                             value={remotePassword} 
                             onChange={(e) => handleSavePassword(e.target.value)}
                             placeholder="Leave empty for no PIN"
                             className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-lg px-3 py-2 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition-all font-medium font-mono tracking-widest"
                          />
                          <p className="text-[10px] text-[#526075] leading-relaxed">
                             Set a PIN to prevent unauthorised devices from controlling your presentation.
                          </p>
                      </div>
                  </div>
                </div>
              </div>

              {/* Network Display Broadcast */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 flex flex-col gap-4 shadow-sm lg:col-span-2">
                <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2 mb-2">
                   <Monitor size={16} /> Network Display Broadcast
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="bg-[#FAF6F0] p-2 rounded-xl border border-[#E4E1DA] flex-shrink-0">
                    <img src={qrUrl} alt="QR Code" className="w-24 h-24" />
                  </div>
                  <div className="flex flex-col gap-2 w-full min-w-0">
                      <div className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">Live Broadcast URL</div>
                      <div className="flex items-center gap-2 bg-[#FAF6F0] px-3 py-2 rounded-lg border border-[#E4E1DA] group cursor-pointer hover:border-[#3D7B8C] transition-colors w-full overflow-hidden" onClick={() => handleCopy(liveUrl, setCopied)}>
                          <code className="text-[11px] text-[#3D7B8C] font-bold truncate flex-1 text-left">{liveUrl}</code>
                          {copied ? <Check size={12} className="text-emerald-700 flex-shrink-0" /> : <Copy size={12} className="text-[#526075] group-hover:text-[#3D7B8C] transition-colors flex-shrink-0" />}
                      </div>
                      {copied && <div className="text-[9px] text-emerald-700 font-bold">Copied to clipboard!</div>}
                      <p className="text-[10px] text-[#526075] leading-relaxed mt-1">
                         Open this URL on a secondary screen, overflow TV, or tablet to view the live output in real-time.
                      </p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB: ANNOUNCEMENTS & COUNTDOWN OVERLAYS */}
          {activeSettingsTab === 'overlays' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-200">
              
              {/* Card 1: Ad Hoc Announcements Styling */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
                  <div>
                    <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                      <Megaphone size={18} /> Instant Screen Announcements
                    </div>
                    <p className="text-xs text-[#526075] mt-1">
                      Customise the placement, banner shape, colours, and text size for urgent messages displayed across your live output.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#526075] uppercase tracking-wider bg-[#FAF6F0] px-3 py-1.5 rounded-lg border border-[#E4E1DA] self-start sm:self-auto">
                    Screen Overlay
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: Configuration Controls */}
                  <div className="flex flex-col gap-6">
                    {/* Position Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Screen Placement
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'bottom', label: 'Lower-Third', sub: 'Bottom of Screen' },
                          { id: 'top', label: 'Top Banner', sub: 'Top of Screen' },
                          { id: 'center', label: 'Center Screen', sub: 'Middle Overlay' }
                        ].map(pos => {
                          const normalizedPos = announcementSettings.position === 'floating' ? 'center' : (announcementSettings.position || 'bottom');
                          const isSel = normalizedPos === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => updateAnnouncementSetting('position', pos.id)}
                              className={`p-3 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                                isSel
                                  ? 'bg-[#1C355E] text-white border-[#1C355E]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              <span className={`text-xs font-bold ${isSel ? 'text-white' : 'text-[#1C355E]'}`}>{pos.label}</span>
                              <span className={`text-[10px] ${isSel ? 'text-white/75' : 'text-[#526075]'}`}>{pos.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Banner Style Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Banner Style
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'full-width', label: 'Edge-to-Edge Banner', sub: 'Flush across screen width' },
                          { id: 'rounded-pill', label: 'Rounded Floating Pill', sub: 'Inset stadium capsule' }
                        ].map(st => {
                          const isSel = (announcementSettings.bannerStyle || 'full-width') === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => updateAnnouncementSetting('bannerStyle', st.id)}
                              className={`p-3 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                                isSel
                                  ? 'bg-[#3D7B8C] text-white border-[#3D7B8C]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              <span className={`text-xs font-bold ${isSel ? 'text-white' : 'text-[#1C355E]'}`}>{st.label}</span>
                              <span className={`text-[10px] ${isSel ? 'text-white/80' : 'text-[#526075]'}`}>{st.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Background Color Palette */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Banner Background Colour
                      </label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {[
                          { name: 'Navy', hex: '#1C355E' },
                          { name: 'Charcoal', hex: '#111827' },
                          { name: 'Warm Slate', hex: '#334155' },
                          { name: 'Burgundy', hex: '#4A0E17' },
                          { name: 'Forest', hex: '#0F291E' },
                          { name: 'Amber', hex: '#78350F' }
                        ].map(col => (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => updateAnnouncementSetting('bgColor', col.hex)}
                            className={`w-9 h-9 rounded-xl border-2 transition transform active:scale-95 relative ${
                              announcementSettings.bgColor === col.hex ? 'border-[#3D7B8C] ring-2 ring-[#3D7B8C]/40 scale-105' : 'border-[#E4E1DA]'
                            }`}
                            style={{ backgroundColor: col.hex }}
                            title={col.name}
                          >
                            {announcementSettings.bgColor === col.hex && (
                              <Check size={14} className="text-white mx-auto" />
                            )}
                          </button>
                        ))}

                        <div className="flex items-center gap-2 bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-2.5 py-1.5 ml-1">
                          <input 
                            type="color" 
                            value={announcementSettings.bgColor || '#1C355E'} 
                            onChange={e => updateAnnouncementSetting('bgColor', e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                          />
                          <span className="text-[11px] font-mono font-bold text-[#1C355E] uppercase">{announcementSettings.bgColor}</span>
                        </div>
                      </div>
                    </div>

                    {/* Opacity Slider */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        <span>Background Opacity</span>
                        <span className="text-[#3D7B8C] font-mono">{Math.round((announcementSettings.bgOpacity ?? 0.95) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.4"
                        max="1"
                        step="0.05"
                        value={announcementSettings.bgOpacity ?? 0.95}
                        onChange={e => updateAnnouncementSetting('bgOpacity', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                      />
                    </div>

                    {/* Announcement Text Size Slider */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                          Announcement Text Size
                        </label>
                        <span className="text-[11px] font-bold text-[#3D7B8C] font-mono">
                          {Math.round(
                            (typeof announcementSettings.textSize === 'number' && !isNaN(announcementSettings.textSize)
                              ? announcementSettings.textSize
                              : (announcementSettings.fontSize === 'small' ? 0.8 : announcementSettings.fontSize === 'large' ? 1.35 : 1.0)
                            ) * 100
                          )}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.7"
                        max="2.0"
                        step="0.05"
                        value={
                          typeof announcementSettings.textSize === 'number' && !isNaN(announcementSettings.textSize)
                            ? announcementSettings.textSize
                            : (announcementSettings.fontSize === 'small' ? 0.8 : announcementSettings.fontSize === 'large' ? 1.35 : 1.0)
                        }
                        onChange={e => updateAnnouncementSetting('textSize', parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                      />
                      <div className="flex justify-between text-[10px] text-[#526075]">
                        <span>Compact (70%)</span>
                        <span>Standard (100%)</span>
                        <span>Prominent (200%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 1:1 Live Interactive Screen Preview */}
                  <div className="flex flex-col gap-2 lg:sticky lg:top-6 self-start">
                    <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                      Live Screen Output Preview
                    </label>
                    <div
                      className="aspect-video w-full rounded-2xl border border-[#E4E1DA] relative overflow-hidden"
                      style={{ backgroundColor: currentBackgrounds.song?.bgColor || '#0B132B' }}
                    >
                      <div className="absolute inset-0" style={{ containerType: 'size' }}>
                        {/* Simulated active worship slide underneath using active Song background */}
                        {currentBackgrounds.song?.bgType === 'image' && currentBackgrounds.song?.bgImageUrl ? (
                          <div className="absolute inset-0 pointer-events-none">
                            <img src={currentBackgrounds.song.bgImageUrl} alt="" className="w-full h-full object-cover" />
                            {(currentBackgrounds.song.bgDim ?? 0.3) > 0 && (
                              <div className="absolute inset-0 bg-black" style={{ opacity: currentBackgrounds.song.bgDim ?? 0.3 }} />
                            )}
                          </div>
                        ) : currentBackgrounds.song?.bgType === 'video' && currentBackgrounds.song?.bgVideoUrl ? (
                          <div className="absolute inset-0 pointer-events-none">
                            <video src={currentBackgrounds.song.bgVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                            {(currentBackgrounds.song.bgDim ?? 0.3) > 0 && (
                              <div className="absolute inset-0 bg-black" style={{ opacity: currentBackgrounds.song.bgDim ?? 0.3 }} />
                            )}
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-[#1C355E]/35 via-neutral-950/80 to-[#0F291E]/35 pointer-events-none" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-[10%]">
                          <div
                            className="text-white/35 font-bold text-center leading-relaxed"
                            style={{ fontSize: '6.5cqh', fontFamily: getFontFamilyCss(displayFont) }}
                          >
                            Bless the Lord O my soul<br />
                            Worship His holy name
                          </div>
                        </div>

                        {/* Real OutputScreen AnnouncementOverlay component */}
                        <AnnouncementOverlay
                          announcement={{
                            active: true,
                            text: 'Crèche is open in Room 2 for children under 4.'
                          }}
                          settings={{
                            ...announcementSettings,
                            fontFamily: getFontFamilyCss(displayFont)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Countdown Timer Styling */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
                  <div>
                    <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                      <Timer size={18} /> Pre-Service Countdown Timer
                    </div>
                    <p className="text-xs text-[#526075] mt-1">
                      Configure screen placement, backdrop shape, card colours, and full-screen backgrounds (colour, image, or video) for countdowns.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#526075] uppercase tracking-wider bg-[#FAF6F0] px-3 py-1.5 rounded-lg border border-[#E4E1DA] self-start sm:self-auto">
                    Timer & Backdrop
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: Timer Config */}
                  <div className="flex flex-col gap-6">
                    {/* Screen Position Selector (Center + 4 Corners matching screen geometry) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Screen Position
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Hero Center Stage */}
                        {(() => {
                          const isCenterSel = (countdownSettings.position || 'center') === 'center';
                          return (
                            <button
                              type="button"
                              onClick={() => updateCountdownSetting('position', 'center')}
                              className={`col-span-2 p-3 rounded-xl border text-left transition flex items-center justify-between ${
                                isCenterSel
                                  ? 'bg-[#1C355E] text-white border-[#1C355E]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              <div>
                                <div className={`text-xs font-bold ${isCenterSel ? 'text-white' : 'text-[#1C355E]'}`}>Center Stage</div>
                                <div className={`text-[10px] ${isCenterSel ? 'text-white/75' : 'text-[#526075]'}`}>Large hero countdown in the middle of the screen</div>
                              </div>
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${isCenterSel ? 'bg-[#3D7B8C] text-white' : 'bg-white text-[#3D7B8C] border border-[#E4E1DA]'}`}>
                                Hero
                              </span>
                            </button>
                          );
                        })()}

                        {/* 4 Corners */}
                        {[
                          { id: 'top-left', label: 'Top Left', sub: 'Upper-left corner' },
                          { id: 'top-right', label: 'Top Right', sub: 'Upper-right corner' },
                          { id: 'bottom-left', label: 'Bottom Left', sub: 'Lower-left corner' },
                          { id: 'bottom-right', label: 'Bottom Right', sub: 'Lower-right corner' }
                        ].map(pos => {
                          const isSel = (countdownSettings.position || 'center') === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => updateCountdownSetting('position', pos.id)}
                              className={`p-3 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                                isSel
                                  ? 'bg-[#1C355E] text-white border-[#1C355E]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              <span className={`text-xs font-bold ${isSel ? 'text-white' : 'text-[#1C355E]'}`}>{pos.label}</span>
                              <span className={`text-[10px] ${isSel ? 'text-white/75' : 'text-[#526075]'}`}>{pos.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Display Style Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Timer Card Style
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'boxed', label: 'Boxed Backdrop', sub: 'Card & divider' },
                          { id: 'clean', label: 'Solid Pill', sub: 'Rounded capsule' },
                          { id: 'minimal', label: 'Minimal (No Box)', sub: 'Floating text' }
                        ].map(st => {
                          const isSel = (countdownSettings.style || 'boxed') === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => updateCountdownSetting('style', st.id)}
                              className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-0.5 ${
                                isSel
                                  ? 'bg-[#3D7B8C] text-white border-[#3D7B8C]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              <span className={`text-xs font-bold ${isSel ? 'text-white' : 'text-[#1C355E]'}`}>{st.label}</span>
                              <span className={`text-[9px] ${isSel ? 'text-white/80' : 'text-[#526075]'}`}>{st.sub}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Timer Card / Pill Colour & Opacity (when Boxed or Solid Pill is selected) */}
                    {(countdownSettings.style || 'boxed') !== 'minimal' ? (
                      <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                            Timer Card / Pill Colour
                          </label>
                          <div className="flex flex-wrap gap-2 items-center">
                            {[
                              { name: 'Navy', hex: '#1C355E' },
                              { name: 'Charcoal', hex: '#111827' },
                              { name: 'Warm Slate', hex: '#334155' },
                              { name: 'Burgundy', hex: '#4A0E17' },
                              { name: 'Forest', hex: '#0F291E' },
                              { name: 'Amber', hex: '#78350F' }
                            ].map(col => (
                              <button
                                key={col.hex}
                                type="button"
                                onClick={() => updateCountdownSetting('bgColor', col.hex)}
                                className={`w-8 h-8 rounded-xl border-2 transition transform active:scale-95 relative ${
                                  (countdownSettings.bgColor || '#1C355E').toLowerCase() === col.hex.toLowerCase()
                                    ? 'border-[#3D7B8C] ring-2 ring-[#3D7B8C]/40 scale-105'
                                    : 'border-[#E4E1DA]'
                                }`}
                                style={{ backgroundColor: col.hex }}
                                title={col.name}
                              >
                                {(countdownSettings.bgColor || '#1C355E').toLowerCase() === col.hex.toLowerCase() && (
                                  <Check size={13} className="text-white mx-auto" />
                                )}
                              </button>
                            ))}

                            <div className="flex items-center gap-2 bg-white border border-[#E4E1DA] rounded-xl px-2.5 py-1 ml-1">
                              <input
                                type="color"
                                value={countdownSettings.bgColor || '#1C355E'}
                                onChange={e => updateCountdownSetting('bgColor', e.target.value)}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[11px] font-mono font-bold text-[#1C355E] uppercase">
                                {countdownSettings.bgColor || '#1C355E'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                            <span>Card Backdrop Opacity</span>
                            <span className="text-[#3D7B8C] font-mono">{Math.round((countdownSettings.bgOpacity ?? 0.85) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.3"
                            max="1"
                            step="0.05"
                            value={countdownSettings.bgOpacity ?? 0.85}
                            onChange={e => updateCountdownSetting('bgOpacity', parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="px-3.5 py-2.5 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] text-[11px] text-[#526075]">
                        <span className="font-bold text-[#1C355E]">Minimal (No Box):</span> Timer digits float cleanly with drop-shadow directly over the background.
                      </div>
                    )}

                    {/* Full-Screen Countdown Background (Overlay Only / Colour / Image / Video) */}
                    <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                          Full-Screen Countdown Background
                        </label>
                        <div className="grid grid-cols-4 gap-1.5 bg-white p-1 rounded-xl border border-[#E4E1DA]">
                          {[
                            { id: 'none', label: 'Overlay', icon: Eye },
                            { id: 'color', label: 'Colour', icon: Palette },
                            { id: 'image', label: 'Image', icon: ImageIcon },
                            { id: 'video', label: 'Video', icon: VideoIcon }
                          ].map(mode => {
                            const ModeIcon = mode.icon;
                            const isSel = countdownScreenBgType === mode.id;
                            return (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() => onUpdateDisplaySettings && onUpdateDisplaySettings(prev => ({ ...prev, bgType: mode.id }), 'countdown')}
                                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                  isSel
                                    ? 'bg-[#3D7B8C] text-white'
                                    : 'text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0]'
                                }`}
                              >
                                <ModeIcon size={13} />
                                <span>{mode.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mode: Overlay Only */}
                      {countdownScreenBgType === 'none' && (
                        <p className="text-[11px] text-[#526075] leading-relaxed">
                          Transparent overlay — the timer floats over your standby screen or currently active slide without changing the screen background.
                        </p>
                      )}

                      {/* Mode: Solid Colour */}
                      {countdownScreenBgType === 'color' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-5 gap-2">
                            {NATURAL_CHURCH_PALETTE.map(swatch => {
                              const isSel = countdownScreenBgColor.toLowerCase() === swatch.hex.toLowerCase();
                              return (
                                <button
                                  key={swatch.hex}
                                  type="button"
                                  onClick={() => handleSelectCountdownScreenColor(swatch.hex)}
                                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                                    isSel
                                      ? 'border-[#3D7B8C] bg-white ring-1 ring-[#3D7B8C]/40'
                                      : 'border-[#E4E1DA] bg-white hover:border-[#3D7B8C]/40'
                                  }`}
                                  title={swatch.name}
                                >
                                  <div
                                    className="w-7 h-7 rounded-lg border border-black/15 flex items-center justify-center"
                                    style={{ backgroundColor: swatch.hex }}
                                  >
                                    {isSel && <Check size={13} className="text-white" />}
                                  </div>
                                  <span className="text-[9px] font-bold text-[#1C355E] truncate w-full text-center">{swatch.name.split(' ')[0]}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E4E1DA]">
                            <span className="text-[10px] font-black text-[#1C355E] uppercase tracking-wider">Custom Hex</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={countdownScreenBgColor}
                                onChange={e => handleSelectCountdownScreenColor(e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer border border-[#E4E1DA] p-0.5 bg-white"
                              />
                              <input
                                type="text"
                                value={countdownCustomHexInput}
                                onChange={handleCountdownCustomHexChange}
                                placeholder="#0B132B"
                                maxLength={7}
                                className="w-24 bg-white border border-[#E4E1DA] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-[#1C355E] uppercase focus:outline-none focus:border-[#3D7B8C]"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Mode: Image */}
                      {countdownScreenBgType === 'image' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                          {countdownScreenBgImageUrl ? (
                            <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-[#E4E1DA]">
                              <div className="relative w-24 h-14 rounded-lg overflow-hidden border border-[#E4E1DA] bg-black flex-shrink-0">
                                <img src={countdownScreenBgImageUrl} alt="Countdown Background" className="w-full h-full object-cover" />
                                {countdownScreenBgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: countdownScreenBgDim }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-[#1C355E]">Active Countdown Image</div>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => countdownImageInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                  >
                                    <Upload size={12} /> Replace
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onClearBackgroundImage && onClearBackgroundImage('countdown')}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                  >
                                    <Trash2 size={12} /> Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => countdownImageInputRef.current?.click()}
                              className="border-2 border-dashed border-[#E4E1DA] hover:border-[#3D7B8C] rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-white hover:bg-[#EDF4F6]/60 transition"
                            >
                              <Upload size={18} className="text-[#3D7B8C] mb-1.5" />
                              <div className="text-xs font-bold text-[#1C355E]">Choose Countdown Background Image</div>
                              <p className="text-[10px] text-[#526075] mt-0.5">PNG, JPG, WebP, or GIF</p>
                            </div>
                          )}

                          {libraryImages.length > 0 && (
                            <div>
                              <span className="text-[10px] font-black text-[#1C355E] uppercase tracking-wider block mb-1.5">
                                Quick Pick from Images Library:
                              </span>
                              <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                {libraryImages.map(entry => (
                                  <button
                                    key={entry.name}
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const file = await entry.getFile();
                                        if (onSaveBackgroundImage) onSaveBackgroundImage(file, 'countdown');
                                      } catch { /* ignore */ }
                                    }}
                                    className="px-2.5 py-1.5 bg-white hover:bg-[#F0EBE1] border border-[#E4E1DA] rounded-lg text-[11px] font-medium text-[#1C355E] flex items-center gap-1.5 truncate max-w-[160px] flex-shrink-0 transition"
                                  >
                                    <ImageIcon size={11} className="text-[#3D7B8C] flex-shrink-0" />
                                    <span className="truncate">{entry.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex justify-between items-center text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                              <span>Background Dimming</span>
                              <span className="text-[#3D7B8C] font-mono">{Math.round(countdownScreenBgDim * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="0.8"
                              step="0.05"
                              value={countdownScreenBgDim}
                              onChange={e => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: parseFloat(e.target.value) }), 'countdown')}
                              className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Mode: Video */}
                      {countdownScreenBgType === 'video' && (
                        <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                          {countdownScreenBgVideoUrl ? (
                            <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-[#E4E1DA]">
                              <div className="relative w-24 h-14 rounded-lg overflow-hidden border border-[#E4E1DA] bg-black flex-shrink-0">
                                <video src={countdownScreenBgVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                {countdownScreenBgDim > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: countdownScreenBgDim }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-[#1C355E]">Active Countdown Video Loop</div>
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => countdownVideoInputRef.current?.click()}
                                    className="px-3 py-1.5 bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                  >
                                    <Upload size={12} /> Replace
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onClearBackgroundVideo && onClearBackgroundVideo('countdown')}
                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                  >
                                    <Trash2 size={12} /> Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => countdownVideoInputRef.current?.click()}
                              className="border-2 border-dashed border-[#E4E1DA] hover:border-[#3D7B8C] rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer bg-white hover:bg-[#EDF4F6]/60 transition"
                            >
                              <VideoIcon size={18} className="text-[#3D7B8C] mb-1.5" />
                              <div className="text-xs font-bold text-[#1C355E]">Choose Countdown Video Loop</div>
                              <p className="text-[10px] text-[#526075] mt-0.5">MP4 or WebM motion background (auto-muted)</p>
                            </div>
                          )}

                          {libraryVideos.length > 0 && (
                            <div>
                              <span className="text-[10px] font-black text-[#1C355E] uppercase tracking-wider block mb-1.5">
                                Quick Pick from Videos Library:
                              </span>
                              <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                {libraryVideos.map(entry => (
                                  <button
                                    key={entry.name}
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const file = await entry.getFile();
                                        if (onSaveBackgroundVideo) onSaveBackgroundVideo(file, 'countdown');
                                      } catch { /* ignore */ }
                                    }}
                                    className="px-2.5 py-1.5 bg-white hover:bg-[#F0EBE1] border border-[#E4E1DA] rounded-lg text-[11px] font-medium text-[#1C355E] flex items-center gap-1.5 truncate max-w-[160px] flex-shrink-0 transition"
                                  >
                                    <VideoIcon size={11} className="text-[#3D7B8C] flex-shrink-0" />
                                    <span className="truncate">{entry.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] font-bold text-[#1C355E]">Continuous Video Loop</span>
                            <input
                              type="checkbox"
                              checked={countdownScreenBgLoop}
                              onChange={e => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgVideoLoop: e.target.checked }), 'countdown')}
                              className="w-4 h-4 accent-[#3D7B8C] cursor-pointer"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                              <span>Background Dimming</span>
                              <span className="text-[#3D7B8C] font-mono">{Math.round(countdownScreenBgDim * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="0.8"
                              step="0.05"
                              value={countdownScreenBgDim}
                              onChange={e => onUpdateDisplaySettings && onUpdateDisplaySettings(p => ({ ...p, bgDim: parseFloat(e.target.value) }), 'countdown')}
                              className="w-full h-1.5 bg-[#F0EBE1] rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sizing Controls: Header Text & Timer Digits */}
                    <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#E4E1DA] flex flex-col gap-4">
                      {/* 1. Header Message Font Size */}
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                            Header Message Text Size
                          </label>
                          <span className="text-[11px] font-bold text-[#3D7B8C] font-mono">
                            {Math.round((countdownSettings.headerTextSize ?? 1.4) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.8"
                          max="2.4"
                          step="0.05"
                          value={countdownSettings.headerTextSize ?? 1.4}
                          onChange={e => updateCountdownSetting('headerTextSize', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-white rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                        />
                        <div className="flex justify-between text-[10px] text-[#526075]">
                          <span>Compact (80%)</span>
                          <span>Prominent (140%)</span>
                          <span>Extra Large (240%)</span>
                        </div>
                        <p className="text-[10px] text-[#526075] mt-0.5">
                          Controls the size of the message text above the clock, with automatic line wrapping.
                        </p>
                      </div>

                      {/* 2. Timer Clock Digits Size */}
                      <div className="flex flex-col gap-2 pt-3 border-t border-[#E4E1DA]">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                            Timer Clock Digits Size
                          </label>
                          <span className="text-[11px] font-bold text-[#3D7B8C] font-mono">
                            {Math.round((countdownSettings.digitsSize ?? 1.0) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.7"
                          max="1.6"
                          step="0.05"
                          value={countdownSettings.digitsSize ?? 1.0}
                          onChange={e => updateCountdownSetting('digitsSize', parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-white rounded-lg appearance-none cursor-pointer accent-[#3D7B8C]"
                        />
                        <div className="flex justify-between text-[10px] text-[#526075]">
                          <span>Smaller (70%)</span>
                          <span>Standard (100%)</span>
                          <span>Huge (160%)</span>
                        </div>
                        <p className="text-[10px] text-[#526075] mt-0.5">
                          Controls the size of the countdown clock numbers relative to the message above.
                        </p>
                      </div>
                    </div>

                    {/* Default Duration Selector */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Default Quick Duration
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 3, 5, 10].map(mins => {
                          const isSel = (countdownSettings.defaultMinutes || 5) === mins;
                          return (
                            <button
                              key={mins}
                              type="button"
                              onClick={() => updateCountdownSetting('defaultMinutes', mins)}
                              className={`py-2 rounded-xl border text-center text-xs font-bold transition ${
                                isSel
                                  ? 'bg-[#1C355E] text-white border-[#1C355E]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              {mins} Minutes
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-[#526075] mt-1">
                        Header text and 00:00 completion message are configured directly inside the <strong className="text-[#1C355E]">Timer</strong> launcher in Live Control.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Sticky 1:1 Live Countdown Preview */}
                  <div className="flex flex-col gap-2 lg:sticky lg:top-6 self-start">
                    <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                      Live Screen Output Preview
                    </label>
                    <div className="aspect-video w-full rounded-2xl bg-neutral-900 border border-[#E4E1DA] relative overflow-hidden">
                      <div className="absolute inset-0" style={{ containerType: 'size' }}>
                        {/* Underlying standby screen visible when Countdown Background is 'Overlay Only' */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-neutral-950 to-neutral-900 flex flex-col items-center justify-center pointer-events-none opacity-45">
                          <div className="text-white/40 font-black tracking-tight text-center px-[6%]" style={{ fontSize: '5.5cqh' }}>
                            {churchName || 'Grace Community Church'}
                          </div>
                          <div className="text-neutral-500 uppercase tracking-widest font-bold mt-1" style={{ fontSize: '2.2cqh' }}>
                            Underlying Screen Layer
                          </div>
                        </div>

                        {/* Real OutputScreen CountdownOverlay component */}
                        <CountdownOverlay
                          countdown={{
                            active: true,
                            running: false,
                            remainingSeconds: Math.max(0, (countdownSettings.defaultMinutes || 5) * 60 - 1),
                            title: countdownSettings.defaultTitle !== undefined ? countdownSettings.defaultTitle : 'Service starts in',
                            endMessage: countdownSettings.endMessage || 'Welcome! Service starting shortly'
                          }}
                          settings={{
                            ...countdownSettings,
                            fontFamily: getFontFamilyCss(displayFont)
                          }}
                          countdownBg={countdownCatBg}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: SONG HISTORY & CCLI */}
          {activeSettingsTab === 'ccli' && (
            <div className="flex flex-col gap-8 animate-in fade-in duration-200">
              
              {/* Card 1: Church CCLI License & Screen Attribution */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
                  <div>
                    <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck size={18} /> CCLI License & Projected Attribution
                    </div>
                    <p className="text-xs text-[#526075] mt-1">
                      Configure your church&apos;s CCLI copyright license and customise legal lyrics projection on screen.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#526075] uppercase tracking-wider bg-[#FAF6F0] px-3 py-1.5 rounded-lg border border-[#E4E1DA] self-start sm:self-auto">
                    CCLI Church Copyright License
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: License Number & Mode Selection */}
                  <div className="flex flex-col gap-6">
                    {/* Church CCLI License # */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest flex items-center justify-between">
                        <span>Church CCLI License Number *</span>
                        <span className="text-[#526075] font-normal lowercase">(required on projected lyrics)</span>
                      </label>
                      <input 
                        type="text" 
                        value={ccliLicenseNumber} 
                        onChange={(e) => handleUpdateCcli('licenseNumber', e.target.value)}
                        placeholder="e.g. 1234567" 
                        className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition font-mono font-bold tracking-wider"
                      />
                      <p className="text-[10px] text-[#526075] leading-relaxed">
                        Under CCLI Church Copyright License terms, this license number must be visible when projecting copyrighted worship lyrics.
                      </p>
                    </div>

                    {/* Display Mode Selection */}
                    <div className="flex flex-col gap-3">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Lyric Attribution Display Mode
                      </label>
                      <div className="flex flex-col gap-2.5">
                        {CCLI_DISPLAY_MODES.map((mode) => {
                          const isSelected = ccliDisplayMode === mode.id;
                          return (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => handleUpdateCcli('displayMode', mode.id)}
                              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                                isSelected
                                  ? 'bg-[#1C355E] text-white border-[#1C355E]'
                                  : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                              }`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'border-white bg-[#3D7B8C]' : 'border-[#526075]/50'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-[#1C355E]'}`}>
                                    {mode.name}
                                  </span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                                    isSelected 
                                      ? 'bg-white/15 text-white border border-white/25' 
                                      : mode.id === 'first_slide'
                                      ? 'bg-[#EDF4F6] text-[#3D7B8C] border border-[#3D7B8C]/20'
                                      : 'bg-white border border-[#E4E1DA] text-[#526075]'
                                  }`}>
                                    {mode.badge}
                                  </span>
                                </div>
                                <p className={`text-[11px] mt-1 leading-relaxed ${isSelected ? 'text-white/80' : 'text-[#526075]'}`}>
                                  {mode.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Position Selector */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-[#E4E1DA]">
                      <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                        Screen Footer Alignment
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'bottom-left', label: 'Bottom Left (Standard)' },
                          { id: 'bottom-center', label: 'Bottom Center' },
                          { id: 'bottom-right', label: 'Bottom Right' }
                        ].map((pos) => (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() => handleUpdateCcli('position', pos.id)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition text-center border ${
                              ccliPosition === pos.id
                                ? 'bg-[#3D7B8C] text-white border-[#3D7B8C]'
                                : 'bg-[#FAF6F0] border-[#E4E1DA] text-[#1C355E] hover:bg-[#F0EBE1]'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Screen Simulation & Legal Summary */}
                  <div className="flex flex-col gap-6 lg:sticky lg:top-6 self-start">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <label className="text-[10px] font-black text-[#1C355E] uppercase tracking-widest">
                          Live Screen Simulation Preview
                        </label>
                        {/* Interactive Slide Selector so Display Mode changes are immediately testable */}
                        <div className="flex items-center gap-1 bg-[#FAF6F0] p-1 rounded-lg border border-[#E4E1DA]">
                          {[
                            { id: 'first', label: 'Slide 1 (First)' },
                            { id: 'middle', label: 'Slide 2 (Middle)' },
                            { id: 'last', label: 'Slide 5 (Last)' }
                          ].map(sl => (
                            <button
                              key={sl.id}
                              type="button"
                              onClick={() => setCcliPreviewSlide(sl.id)}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                                ccliPreviewSlide === sl.id
                                  ? 'bg-[#3D7B8C] text-white'
                                  : 'text-[#526075] hover:text-[#1C355E]'
                              }`}
                            >
                              {sl.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(() => {
                        const shouldShowOnPreviewSlide =
                          ccliDisplayMode === 'all' ||
                          (ccliDisplayMode === 'first_slide' && ccliPreviewSlide === 'first') ||
                          (ccliDisplayMode === 'last_slide' && ccliPreviewSlide === 'last') ||
                          (ccliDisplayMode === 'both' && (ccliPreviewSlide === 'first' || ccliPreviewSlide === 'last'));

                        const sampleLyrics =
                          ccliPreviewSlide === 'first'
                            ? ['Bless the Lord O my soul', 'O my soul, worship His holy name']
                            : ccliPreviewSlide === 'middle'
                            ? ['The sun comes up, it’s a new day dawning', 'It’s time to sing Your song again']
                            : ['Worship His holy name', 'Sing like never before, O my soul'];

                        const songBg = currentBackgrounds.song || { bgType: 'color', bgColor: '#000000', bgDim: 0.3 };

                        return (
                          <div
                            className="rounded-2xl border border-[#E4E1DA] p-5 relative overflow-hidden flex flex-col justify-between aspect-video"
                            style={{ backgroundColor: songBg.bgColor || '#000000' }}
                          >
                            {songBg.bgType === 'image' && songBg.bgImageUrl && (
                              <div className="absolute inset-0 pointer-events-none">
                                <img src={songBg.bgImageUrl} alt="" className="w-full h-full object-cover" />
                                {(songBg.bgDim ?? 0.3) > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: songBg.bgDim ?? 0.3 }} />}
                              </div>
                            )}
                            {songBg.bgType === 'video' && songBg.bgVideoUrl && (
                              <div className="absolute inset-0 pointer-events-none">
                                <video src={songBg.bgVideoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                {(songBg.bgDim ?? 0.3) > 0 && <div className="absolute inset-0 bg-black" style={{ opacity: songBg.bgDim ?? 0.3 }} />}
                              </div>
                            )}
                            {/* Status watermark */}
                            <div className="relative z-10 flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300 drop-shadow">
                              <span>
                                {ccliPreviewSlide === 'first' ? 'Slide 1 of 5' : ccliPreviewSlide === 'middle' ? 'Slide 2 of 5' : 'Slide 5 of 5'}
                              </span>
                              <span className={shouldShowOnPreviewSlide ? 'text-emerald-400' : 'text-neutral-300'}>
                                {ccliDisplayMode === 'off'
                                  ? 'CCLI Off'
                                  : shouldShowOnPreviewSlide
                                  ? `CCLI Shown • ${ccliPosition === 'bottom-center' ? 'Bottom Center' : ccliPosition === 'bottom-right' ? 'Bottom Right' : 'Bottom Left'}`
                                  : `Clean Worship Slide (${CCLI_DISPLAY_MODES.find(m => m.id === ccliDisplayMode)?.name})`}
                              </span>
                            </div>

                            {/* Lyrics Center */}
                            <div
                              className="relative z-10 text-center font-black text-white text-base md:text-xl leading-relaxed drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] my-auto px-4"
                              style={{ fontFamily: getFontFamilyCss(displayFont) }}
                            >
                              {sampleLyrics[0]}<br />
                              {sampleLyrics[1]}
                            </div>

                            {/* Legal attribution line — aligned Bottom Left, Bottom Center, or Bottom Right */}
                            <div
                              className={`relative z-10 w-full flex min-h-[34px] items-end transition-all duration-300 ${
                                ccliPosition === 'bottom-center'
                                  ? 'justify-center text-center'
                                  : ccliPosition === 'bottom-right'
                                  ? 'justify-end text-right'
                                  : 'justify-start text-left'
                              }`}
                            >
                              {shouldShowOnPreviewSlide ? (
                                <div className="max-w-[58%] text-[10px] font-sans font-medium text-white/75 tracking-wide drop-shadow-md leading-snug bg-black/35 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/15 transition-all duration-300">
                                  <div className="font-semibold text-white/90 truncate">
                                    10,000 Reasons (Bless The Lord) • J. Myrin, M. Redman
                                  </div>
                                  <div className="text-[9px] text-white/70 truncate">
                                    © 2011 Thankyou Music | CCLI #6016351 | License #{ccliLicenseNumber || '1234567'}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full text-[10px] text-white/55 italic text-center font-mono py-1 drop-shadow">
                                  (Copyright footer hidden on this slide)
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Legal Compliance Explanatory Box */}
                    <div className="bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl p-4 flex items-start gap-3">
                      <Info size={18} className="text-[#3D7B8C] flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-[#526075] leading-relaxed">
                        <span className="font-bold text-[#1C355E] block mb-0.5">CCLI Church Copyright Guidelines</span>
                        CCLI terms require: Song Title, Author/Writer, Copyright Notice, Song CCLI Number, and your Church License Number. 
                        CCLI officially confirms that displaying this information on the <span className="font-bold text-[#1C355E]">First Slide Only</span> or <span className="font-bold text-[#1C355E]">Last Slide Only</span> satisfies all licensing requirements while keeping your worship slides clean.
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Card 2: Song History & Annual CCLI Reporting */}
              <div className="bg-white border border-[#E4E1DA] rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-sm">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E1DA]">
                  <div>
                    <div className="text-xs font-bold text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                      <Music size={18} /> Song History & Annual CCLI Reporting
                    </div>
                    <p className="text-xs text-[#526075] mt-1">
                      Presenter automatically logs every song presented live in your services. You can download this information into a .csv file for easy reporting.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#526075] uppercase tracking-wider bg-[#FAF6F0] px-3 py-1.5 rounded-lg border border-[#E4E1DA] self-start sm:self-auto">
                    Automated Log
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-[#526075] uppercase font-black tracking-widest">Reporting Date From</span>
                    <input 
                      type="date" 
                      value={ccliFromDate} 
                      onChange={e => setCcliFromDate(e.target.value)} 
                      className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition font-medium" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-[#526075] uppercase font-black tracking-widest">Reporting Date To</span>
                    <input 
                      type="date" 
                      value={ccliToDate} 
                      onChange={e => setCcliToDate(e.target.value)} 
                      className="w-full bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-4 py-3 text-sm text-[#1C355E] focus:outline-none focus:border-[#3D7B8C] transition font-medium" 
                    />
                  </div>
                  <div>
                    <button 
                      onClick={handleExportCCLI}
                      className="w-full bg-[#7A502A] hover:bg-[#654121] active:bg-[#52341A] text-white font-bold py-3.5 px-6 rounded-xl transition text-sm flex items-center justify-center gap-2.5 shadow-sm"
                    >
                      <Download size={16} /> Export Song History to CSV
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#526075] leading-relaxed">
                  The downloaded CSV file contains Date Played, Artist, Song Title, CCLI Song Number, and Copyright details.
                </p>

              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
