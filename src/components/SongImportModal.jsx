import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Upload,
  FolderOpen,
  Check,
  CheckCircle2,
  AlertTriangle,
  Search,
  Music,
  Sparkles,
  HardDrive,
  Loader2,
  RefreshCw,
  FileArchive,
  ExternalLink
} from 'lucide-react';
import { isTauri, openExternalUrl } from '../utils/env';
import {
  parseImportFiles,
  writeImportedSongsToLibrary,
  SUPPORTED_SONG_IMPORT_ACCEPT
} from '../utils/importers';

const IMPORT_DOCS_URL = 'https://help.alongsidedigital.co.uk/presenter/importing-songs/';

function base64ToUint8Array(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Recursively collects File objects from DataTransferItemList (supports dropped folders!).
 */
async function collectDroppedFiles(dataTransfer) {
  const collected = [];

  const traverseEntry = async (entry, prefix = '') => {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise((resolve) => {
        entry.file(
          f => resolve(f),
          () => resolve(null)
        );
      });
      if (file) {
        const relPath = prefix ? `${prefix}/${file.name}` : file.name;
        collected.push({
          name: file.name,
          path: relPath,
          arrayBuffer: () => file.arrayBuffer()
        });
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
      let batch = await new Promise(res => reader.readEntries(res, () => res([])));
      while (batch && batch.length > 0) {
        for (const child of batch) {
          await traverseEntry(child, nextPrefix);
        }
        batch = await new Promise(res => reader.readEntries(res, () => res([])));
      }
    }
  };

  const items = Array.from(dataTransfer?.items || []);
  const entries = items
    .filter(it => it.kind === 'file' && typeof it.webkitGetAsEntry === 'function')
    .map(it => it.webkitGetAsEntry())
    .filter(Boolean);

  if (entries.length > 0) {
    for (const entry of entries) {
      await traverseEntry(entry, '');
    }
    if (collected.length > 0) return collected;
  }

  return Array.from(dataTransfer?.files || []);
}

export default function SongImportModal({
  isOpen,
  onClose,
  libraryHandle,
  existingSongs = [],
  initialFiles = null,
  onImported
}) {
  const [rawInputs, setRawInputs] = useState([]);
  const [parsedSongs, setParsedSongs] = useState([]);
  const [selectedUids, setSelectedUids] = useState(new Set());
  const [previewUid, setPreviewUid] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [sourceCounts, setSourceCounts] = useState({});

  const [stripChords, setStripChords] = useState(true);
  const [duplicateMode, setDuplicateMode] = useState('skip'); // 'skip' | 'overwrite' | 'rename'
  const [searchFilter, setSearchFilter] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const [detectedApps, setDetectedApps] = useState([]);
  const [loadingDetectedId, setLoadingDetectedId] = useState(null);

  const [status, setStatus] = useState('idle'); // 'idle' | 'parsing' | 'ready' | 'writing' | 'done'
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0, label: '' });
  const [importSummary, setImportSummary] = useState(null);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const existingTitleSet = useMemo(() => {
    const s = new Set();
    for (const item of existingSongs || []) {
      if (item?.title) s.add(item.title);
      if (item?.id) s.add(String(item.id).replace(/\.md$/i, ''));
    }
    return s;
  }, [existingSongs]);

  // Reset modal state on open and check Tauri local installations
  useEffect(() => {
    if (!isOpen) return;

    setRawInputs([]);
    setParsedSongs([]);
    setSelectedUids(new Set());
    setPreviewUid(null);
    setWarnings([]);
    setSourceCounts({});
    setSearchFilter('');
    setStatus('idle');
    setImportSummary(null);
    setLoadingDetectedId(null);

    if (isTauri()) {
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke('detect_installed_church_apps'))
        .then(apps => {
          if (Array.isArray(apps)) setDetectedApps(apps);
        })
        .catch(() => setDetectedApps([]));
    }
  }, [isOpen]);

  const runParse = useCallback(
    async (inputsToParse, chordsFlag) => {
      if (!inputsToParse || inputsToParse.length === 0) return;
      setStatus('parsing');
      setProgressInfo({ current: 0, total: inputsToParse.length, label: 'Analyzing files...' });

      try {
        const result = await parseImportFiles(inputsToParse, {
          stripChords: chordsFlag,
          existingTitles: existingTitleSet,
          onProgress: info => {
            setProgressInfo({
              current: info.current || 0,
              total: info.total || 1,
              label: info.label || 'Parsing songs...'
            });
          }
        });

        setParsedSongs(result.songs);
        setWarnings(result.warnings || []);
        setSourceCounts(result.sourceCounts || {});

        const allIds = new Set(result.songs.map(s => s.uid));
        setSelectedUids(allIds);
        setPreviewUid(result.songs[0]?.uid || null);
        setStatus(result.songs.length > 0 ? 'ready' : 'idle');

        if (result.songs.length === 0 && (!result.warnings || result.warnings.length === 0)) {
          setWarnings([
            'No supported worship songs with lyrics were found in the selected files. See the Import Guide for supported formats and export steps.'
          ]);
        }
      } catch (err) {
        setWarnings([`Import error: ${err.message}`]);
        setStatus(parsedSongs.length > 0 ? 'ready' : 'idle');
      }
    },
    [existingTitleSet, parsedSongs.length]
  );

  // If opened via Smart Ingest drop with pre-supplied files, parse them immediately
  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      setRawInputs(initialFiles);
      runParse(initialFiles, stripChords);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFiles]);

  const appendAndParseInputs = async newFiles => {
    if (!newFiles || newFiles.length === 0) return;
    const combined = [...rawInputs, ...newFiles];
    setRawInputs(combined);
    await runParse(combined, stripChords);
  };

  const handleToggleStripChords = async checked => {
    setStripChords(checked);
    if (rawInputs.length > 0) {
      await runParse(rawInputs, checked);
    }
  };

  const handleScanDetectedApp = async appMeta => {
    if (!isTauri() || loadingDetectedId) return;
    setLoadingDetectedId(appMeta.id);
    setStatus('parsing');
    setProgressInfo({ current: 0, total: appMeta.itemCount || 1, label: `Reading ${appMeta.name} library...` });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const rawFiles = await invoke('read_detected_church_app_files', { sourceId: appMeta.id });
      const converted = (rawFiles || []).map(f => ({
        name: f.name,
        path: f.path,
        bytes: base64ToUint8Array(f.base64)
      }));
      await appendAndParseInputs(converted);
    } catch (err) {
      setWarnings(prev => [...prev, `Could not read ${appMeta.name}: ${err}`]);
      setStatus(parsedSongs.length > 0 ? 'ready' : 'idle');
    } finally {
      setLoadingDetectedId(null);
    }
  };

  const handleFileInputChange = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length > 0) {
      await appendAndParseInputs(files);
    }
  };

  const handleModalDrop = async e => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const dropped = await collectDroppedFiles(e.dataTransfer);
    if (dropped.length > 0) {
      await appendAndParseInputs(dropped);
    }
  };

  const filteredSongs = useMemo(() => {
    if (!searchFilter.trim()) return parsedSongs;
    const q = searchFilter.toLowerCase();
    return parsedSongs.filter(
      s =>
        s.title.toLowerCase().includes(q) ||
        (s.artist && s.artist.toLowerCase().includes(q)) ||
        (s.sourceFormat && s.sourceFormat.toLowerCase().includes(q))
    );
  }, [parsedSongs, searchFilter]);

  const previewSong = useMemo(() => {
    if (!parsedSongs.length) return null;
    return parsedSongs.find(s => s.uid === previewUid) || filteredSongs[0] || parsedSongs[0];
  }, [parsedSongs, previewUid, filteredSongs]);

  const duplicateCountInSelection = useMemo(() => {
    let count = 0;
    for (const s of parsedSongs) {
      if (selectedUids.has(s.uid) && s.isDuplicate) count++;
    }
    return count;
  }, [parsedSongs, selectedUids]);

  const toggleSongUid = uid => {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const allFilteredSelected =
      filteredSongs.length > 0 && filteredSongs.every(s => selectedUids.has(s.uid));
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredSongs.forEach(s => next.delete(s.uid));
      } else {
        filteredSongs.forEach(s => next.add(s.uid));
      }
      return next;
    });
  };

  const handleExecuteImport = async () => {
    const toWrite = parsedSongs.filter(s => selectedUids.has(s.uid));
    if (toWrite.length === 0) return;

    setStatus('writing');
    setProgressInfo({ current: 0, total: toWrite.length, label: 'Saving songs to library...' });

    try {
      const summary = await writeImportedSongsToLibrary(toWrite, libraryHandle, {
        duplicateMode,
        onProgress: p => {
          setProgressInfo({
            current: p.completed,
            total: p.total,
            label: `Saving "${p.currentTitle}"...`
          });
        }
      });

      setImportSummary(summary);
      setStatus('done');
      if (onImported) {
        onImported(summary);
      }
    } catch (err) {
      setWarnings(prev => [...prev, err.message]);
      setStatus('ready');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-[#1C355E]/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-150"
      onDragEnter={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) setIsDragOver(false);
      }}
      onDrop={handleModalDrop}
    >
      {/* Hidden File & Directory Pickers */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={SUPPORTED_SONG_IMPORT_ACCEPT}
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="bg-[#FAF6F0] border border-[#E4E1DA] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#E4E1DA] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EDF4F6] border border-[#3D7B8C]/25 flex items-center justify-center text-[#3D7B8C]">
              <Sparkles size={20} />
            </div>
            <h2 className="text-lg font-extrabold text-[#1C355E] tracking-tight">
              Universal Song Library Importer
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={status === 'writing'}
            className="p-2 rounded-xl text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0] transition-colors cursor-pointer disabled:opacity-40"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-5 min-h-0">
          {/* Warnings Banner */}
          {warnings.length > 0 && status !== 'done' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-amber-900 space-y-1">
                {warnings.slice(0, 4).map((w, idx) => (
                  <div key={idx} className="leading-relaxed font-medium">
                    {w}
                  </div>
                ))}
                {warnings.length > 4 && (
                  <div className="text-[11px] text-amber-700 font-bold">
                    + {warnings.length - 4} additional notices
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setWarnings([])}
                className="text-amber-700 hover:text-amber-950 p-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* LOADING / WRITING PROGRESS STATE */}
          {(status === 'parsing' || status === 'writing') && (
            <div className="flex-1 min-h-[300px] bg-white border border-[#E4E1DA] rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#EDF4F6] border border-[#3D7B8C]/30 flex items-center justify-center text-[#3D7B8C]">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1C355E]">
                  {status === 'parsing' ? 'Reading & Converting Song Library...' : 'Importing Songs into Presenter...'}
                </h3>
                <p className="text-xs text-[#526075] mt-1 font-medium">{progressInfo.label}</p>
              </div>
              {progressInfo.total > 0 && (
                <div className="w-full max-w-md flex flex-col gap-1.5 mt-1">
                  <div className="w-full h-2.5 bg-[#F0EBE1] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3D7B8C] transition-all duration-150 rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round((progressInfo.current / Math.max(1, progressInfo.total)) * 100))}%`
                      }}
                    />
                  </div>
                  <div className="text-[11px] font-bold text-[#526075] font-mono">
                    {progressInfo.current} / {progressInfo.total}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DONE STATE */}
          {status === 'done' && importSummary && (
            <div className="flex-1 min-h-[320px] bg-white border border-[#E4E1DA] rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <CheckCircle2 size={34} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#1C355E]">Song Library Import Complete!</h3>
                <p className="text-xs text-[#526075] mt-1.5 max-w-md mx-auto leading-relaxed">
                  Your imported songs are now indexed for instant full-text lyric search and ready to add to your service flow.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-5 py-3 text-center">
                  <div className="text-xl font-black text-emerald-700">{importSummary.importedCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#526075]">New Songs Added</div>
                </div>
                {importSummary.overwrittenCount > 0 && (
                  <div className="bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-5 py-3 text-center">
                    <div className="text-xl font-black text-[#3D7B8C]">{importSummary.overwrittenCount}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#526075]">Updated</div>
                  </div>
                )}
                {importSummary.skippedCount > 0 && (
                  <div className="bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl px-5 py-3 text-center">
                    <div className="text-xl font-black text-[#526075]">{importSummary.skippedCount}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#526075]">Duplicates Skipped</div>
                  </div>
                )}
              </div>

              {importSummary.errors?.length > 0 && (
                <div className="w-full max-w-lg bg-rose-50 border border-rose-200 rounded-xl p-3 text-left text-xs text-rose-800 space-y-1">
                  {importSummary.errors.slice(0, 3).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRawInputs([]);
                    setParsedSongs([]);
                    setStatus('idle');
                    setImportSummary(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] text-xs font-bold text-[#1C355E] transition cursor-pointer"
                >
                  Import More Songs
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#7A502A] hover:bg-[#654121] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* IDLE / SOURCE PICKER STATE */}
          {status === 'idle' && (
            <>
              {/* Auto-detected Local Church Installations (Tauri Desktop) */}
              {detectedApps.length > 0 && (
                <div className="bg-white border border-[#E4E1DA] rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-black text-[#3D7B8C] uppercase tracking-widest flex items-center gap-2">
                      <HardDrive size={15} /> Detected on This Computer
                    </div>
                    <span className="text-[10px] font-bold text-[#526075] bg-[#FAF6F0] px-2.5 py-0.5 rounded-full border border-[#E4E1DA]">
                      1-Click Direct Migration
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedApps.map(app => (
                      <div
                        key={app.id}
                        className="bg-[#FAF6F0] border border-[#E4E1DA] hover:border-[#3D7B8C] rounded-xl p-3.5 flex items-center justify-between gap-3 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-extrabold text-[#1C355E] truncate">{app.name}</div>
                          <div className="text-[11px] font-semibold text-[#3D7B8C] mt-0.5">{app.description}</div>
                          <div className="text-[10px] text-[#526075] truncate mt-0.5 font-mono" title={app.displayPath}>
                            {app.displayPath}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleScanDetectedApp(app)}
                          disabled={!!loadingDetectedId}
                          className="px-3.5 py-2 rounded-lg bg-[#1C355E] hover:bg-[#28497E] text-white text-[11px] font-bold uppercase tracking-wider flex-shrink-0 transition cursor-pointer disabled:opacity-50"
                        >
                          Scan
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`bg-white border-2 border-dashed rounded-2xl p-8 md:p-10 flex flex-col items-center justify-center text-center gap-4 transition cursor-pointer ${
                  isDragOver
                    ? 'border-[#3D7B8C] bg-[#EDF4F6]/60'
                    : 'border-[#E4E1DA] hover:border-[#3D7B8C]/60 hover:bg-white/90'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EDF4F6] border border-[#3D7B8C]/25 flex items-center justify-center text-[#3D7B8C]">
                  <Upload size={26} />
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-[#1C355E]">
                    Drag &amp; drop song files, databases, ZIP packs, or entire folders here
                  </h3>
                  <p className="text-xs text-[#526075] mt-1 max-w-xl mx-auto leading-relaxed">
                    Supports <strong className="text-[#1C355E]">.pro</strong>, <strong className="text-[#1C355E]">.pro6</strong>,{' '}
                    <strong className="text-[#1C355E]">.show</strong>, <strong className="text-[#1C355E]">.qsp</strong>,{' '}
                    <strong className="text-[#1C355E]">songs.sqlite</strong>, <strong className="text-[#1C355E]">Songs.db + SongWords.db</strong>,{' '}
                    <strong className="text-[#1C355E]">OpenLyrics .xml</strong>, <strong className="text-[#1C355E]">OpenSong</strong>,{' '}
                    <strong className="text-[#1C355E]">ChordPro</strong>, <strong className="text-[#1C355E]">.usr</strong>,{' '}
                    <strong className="text-[#1C355E]">.vpc</strong>, <strong className="text-[#1C355E]">.sng</strong>,{' '}
                    <strong className="text-[#1C355E]">.csv</strong>, <strong className="text-[#1C355E]">.txt</strong> &amp;{' '}
                    <strong className="text-[#1C355E]">.zip</strong>
                  </p>
                </div>

                <div
                  className="flex flex-wrap items-center justify-center gap-3 mt-1"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 rounded-xl bg-[#7A502A] hover:bg-[#654121] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <FileArchive size={15} /> Select Files / Databases / ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-5 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] text-[#1C355E] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition cursor-pointer"
                  >
                    <FolderOpen size={15} className="text-[#3D7B8C]" /> Select Entire Folder
                  </button>
                </div>

                <a
                  href={IMPORT_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    openExternalUrl(IMPORT_DOCS_URL);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3D7B8C] hover:text-[#1C355E] hover:underline transition-colors mt-1 cursor-pointer"
                >
                  View supported software &amp; step-by-step import guide <ExternalLink size={13} />
                </a>
              </div>
            </>
          )}

          {/* READY / PREVIEW & SELECTION STATE */}
          {status === 'ready' && parsedSongs.length > 0 && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              {/* Top Controls Bar */}
              <div className="bg-white border border-[#E4E1DA] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                {/* Format Breakdown Badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {Object.entries(sourceCounts).map(([fmt, cnt]) => (
                    <span
                      key={fmt}
                      className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#EDF4F6] text-[#3D7B8C] border border-[#3D7B8C]/25"
                    >
                      {fmt}: {cnt}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#F0EBE1] text-[#1C355E] border border-[#E4E1DA] transition cursor-pointer"
                  >
                    + Add Files
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRawInputs([]);
                      setParsedSongs([]);
                      setWarnings([]);
                      setStatus('idle');
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg text-[#526075] hover:text-[#1C355E] hover:bg-[#FAF6F0] flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw size={11} /> Reset
                  </button>
                </div>

                {/* Strip Chords & Duplicate Mode */}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#1C355E] bg-[#FAF6F0] px-3 py-1.5 rounded-lg border border-[#E4E1DA] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={stripChords}
                      onChange={e => handleToggleStripChords(e.target.checked)}
                      className="w-4 h-4 accent-[#3D7B8C] rounded cursor-pointer"
                    />
                    Strip Musical Chords
                  </label>

                  <div className="flex items-center gap-1.5 bg-[#FAF6F0] p-1 rounded-lg border border-[#E4E1DA]">
                    <span className="text-[10px] font-bold text-[#526075] uppercase tracking-wider px-1.5">
                      Duplicates:
                    </span>
                    {[
                      { id: 'skip', label: 'Skip' },
                      { id: 'overwrite', label: 'Overwrite' },
                      { id: 'rename', label: 'Keep Both' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDuplicateMode(opt.id)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                          duplicateMode === opt.id
                            ? 'bg-[#1C355E] text-white'
                            : 'text-[#526075] hover:text-[#1C355E]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Split Pane: Song Checklist (Left) + Live Section Preview (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[360px]">
                {/* Left Column: Song List */}
                <div className="lg:col-span-5 bg-white border border-[#E4E1DA] rounded-2xl flex flex-col overflow-hidden max-h-[420px]">
                  <div className="p-3 border-b border-[#E4E1DA] flex flex-col gap-2 bg-[#FAF6F0]/60">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#526075]" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        placeholder={`Filter ${parsedSongs.length} parsed songs...`}
                        className="w-full bg-white border border-[#E4E1DA] rounded-lg pl-8 pr-3 py-1.5 text-xs font-medium text-[#1C355E] placeholder:text-[#526075]/70 outline-none focus:border-[#3D7B8C]"
                      />
                    </div>
                    <div className="flex items-center justify-between px-1 text-[11px]">
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="font-bold text-[#3D7B8C] hover:underline cursor-pointer"
                      >
                        {filteredSongs.length > 0 && filteredSongs.every(s => selectedUids.has(s.uid))
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                      <span className="font-semibold text-[#526075]">
                        {selectedUids.size} of {parsedSongs.length} selected
                        {duplicateCountInSelection > 0 && ` • ${duplicateCountInSelection} existing`}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#E4E1DA]/70">
                    {filteredSongs.map(song => {
                      const isChecked = selectedUids.has(song.uid);
                      const isPreviewed = previewSong?.uid === song.uid;
                      return (
                        <div
                          key={song.uid}
                          onClick={() => setPreviewUid(song.uid)}
                          className={`px-3.5 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                            isPreviewed ? 'bg-[#EDF4F6]' : 'hover:bg-[#FAF6F0]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleSongUid(song.uid);
                            }}
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition ${
                              isChecked
                                ? 'bg-[#3D7B8C] border-[#3D7B8C] text-white'
                                : 'bg-white border-[#526075]/40'
                            }`}
                          >
                            {isChecked && <Check size={11} strokeWidth={3} />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#1C355E] truncate">{song.title}</div>
                            <div className="text-[10px] text-[#526075] truncate">
                              {song.artist || song.sourceFormat} • {song.sections.length} section
                              {song.sections.length === 1 ? '' : 's'}
                            </div>
                          </div>

                          {song.isDuplicate && (
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                              Exists
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Live Song Preview */}
                <div className="lg:col-span-7 bg-white border border-[#E4E1DA] rounded-2xl flex flex-col overflow-hidden max-h-[420px]">
                  {previewSong ? (
                    <>
                      <div className="p-4 border-b border-[#E4E1DA] bg-[#FAF6F0]/60 flex flex-col gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-base font-extrabold text-[#1C355E] leading-snug">
                            {previewSong.title}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white border border-[#E4E1DA] text-[#3D7B8C] flex-shrink-0">
                            {previewSong.sourceFormat}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#526075] font-medium">
                          {previewSong.artist && <span>Artist: <strong className="text-[#1C355E]">{previewSong.artist}</strong></span>}
                          {previewSong.ccli && <span>CCLI: <strong className="text-[#1C355E]">#{previewSong.ccli}</strong></span>}
                          {previewSong.copyright && <span className="truncate max-w-xs">{previewSong.copyright}</span>}
                        </div>

                        {Array.isArray(previewSong.arrangement) && previewSong.arrangement.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#3D7B8C] mr-1">
                              Flow:
                            </span>
                            {previewSong.arrangement.map((sec, idx) => (
                              <span
                                key={`${sec}-${idx}`}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white border border-[#E4E1DA] text-[#1C355E]"
                              >
                                {sec}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                        {previewSong.sections.map((sec, sIdx) => (
                          <div
                            key={`${sec.name}-${sIdx}`}
                            className="bg-[#FAF6F0] border border-[#E4E1DA] rounded-xl p-3"
                          >
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#3D7B8C] mb-1.5 flex items-center gap-1.5">
                              <Music size={11} /> {sec.name}
                            </div>
                            <div className="text-xs text-[#1C355E] font-medium leading-relaxed whitespace-pre-line">
                              {sec.lines.join('\n')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-[#526075] italic">
                      Select a song on the left to preview its converted sections.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {status !== 'done' && (
          <div className="bg-white border-t border-[#E4E1DA] px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
            <div className="text-xs text-[#526075] font-medium">
              {!libraryHandle ? (
                <span className="text-rose-700 font-bold">
                  Please connect a Media Library folder before importing songs.
                </span>
              ) : status === 'ready' ? (
                <span>
                  Ready to save <strong className="text-[#1C355E]">{selectedUids.size}</strong> song
                  {selectedUids.size === 1 ? '' : 's'} into <code className="font-mono text-[#3D7B8C]">Songs/</code>
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'writing'}
                className="px-4 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F0EBE1] border border-[#E4E1DA] text-xs font-bold text-[#1C355E] transition cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>

              {status === 'ready' && (
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={selectedUids.size === 0 || !libraryHandle}
                  className="px-6 py-2.5 rounded-xl bg-[#7A502A] hover:bg-[#654121] disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer flex items-center gap-2"
                >
                  <Upload size={14} />
                  Import {selectedUids.size} Song{selectedUids.size === 1 ? '' : 's'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
