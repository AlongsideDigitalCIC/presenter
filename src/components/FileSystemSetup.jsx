import { useState } from 'react';
import { setStoredDirectoryHandle } from '../utils/fileSystem';
import { TauriDirectoryHandle } from '../utils/TauriFileSystem';
import { isTauri } from '../utils/env';
import { Folder, AlertTriangle, Monitor, Globe } from 'lucide-react';
import Logo from './Logo';

const REQUIRED_FOLDERS = [
  'Songs', 
  'Images', 
  'Videos', 
  'Music', 
  'Bible',
  'Liturgy'
];

export default function FileSystemSetup({ onReady }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDesktop = isTauri();

  const handleInitLibrary = async () => {
    try {
      setLoading(true);
      setError('');
      
      const hasTauriIpc = typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function';

      if (hasTauriIpc) {
        // Desktop (Tauri) Native File Dialog
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { mkdir, exists } = await import('@tauri-apps/plugin-fs');

        let defaultPath = undefined;
        try {
          const { documentDir } = await import('@tauri-apps/api/path');
          defaultPath = await documentDir();
        } catch { /* ignore fallback */ }

        const selectedPath = await open({
          directory: true,
          multiple: false,
          defaultPath,
          title: 'Select Folder for Presenter Library'
        });

        if (!selectedPath) return; // User cancelled

        let presenterPath = selectedPath.replace(/\\/g, '/');
        if (!presenterPath.toLowerCase().endsWith('/presenter') && !presenterPath.toLowerCase().endsWith('presenter')) {
          presenterPath = `${presenterPath.replace(/\/+$/, '')}/Presenter`;
        }

        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('allow_library_folder', { path: presenterPath });
        } catch (scopeErr) {
          console.error('Failed to dynamically scope library folder:', scopeErr);
        }

        const isExist = await exists(presenterPath);
        if (!isExist) {
          await mkdir(presenterPath, { recursive: true });
        }

        // Store path string in localStorage & IndexedDB
        await setStoredDirectoryHandle(presenterPath);

        // Initialize subfolders
        const handle = new TauriDirectoryHandle(presenterPath, 'Presenter');
        for (const folderName of REQUIRED_FOLDERS) {
          await handle.getDirectoryHandle(folderName, { create: true });
        }

        await onReady(handle);
      } else if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        // Browser Mode (Chrome, Edge, Brave, etc.)
        let rootHandle;
        try {
          rootHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
          });
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') return; // User cancelled
          throw pickerErr;
        }

        if (!rootHandle) return;

        // If the user already selected a folder named "Presenter", use it directly;
        // otherwise create or open a "Presenter" subfolder inside it.
        let libraryHandle = rootHandle;
        if (rootHandle.name.toLowerCase() !== 'presenter') {
          libraryHandle = await rootHandle.getDirectoryHandle('Presenter', { create: true });
        }

        // Initialize required subfolders
        for (const folderName of REQUIRED_FOLDERS) {
          await libraryHandle.getDirectoryHandle(folderName, { create: true });
        }

        // Store native FileSystemDirectoryHandle in IndexedDB
        await setStoredDirectoryHandle(libraryHandle);
        await onReady(libraryHandle);
      } else {
        setError(
          "Your web browser does not support local folder selection. Please use Google Chrome, Microsoft Edge, Brave, or switch to the Presenter Desktop app on your computer."
        );
      }
    } catch (err) {
      console.error('FileSystemSetup initialization failed:', err);
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1C355E] flex flex-col items-center justify-center p-6 sm:p-8 selection:bg-[#3D7B8C]/20 relative">
      <div className="absolute top-6 left-6 z-50">
        <Logo showText={true} className="h-10 w-auto object-contain" textClassName="text-2xl font-extrabold tracking-tight leading-none" />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        <div className="bg-white border border-[#E4E1DA] p-8 sm:p-10 rounded-2xl shadow-sm space-y-8">
          <div className="text-center space-y-2.5">
            <h2 className="text-3xl font-extrabold tracking-tight text-[#1C355E]">
              Welcome to <span className="gradient-text">Presenter</span>
            </h2>
            <p className="text-[#526075] text-base">Initialise your presentation environment.</p>
          </div>

          <div className="flex justify-center">
            <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#E4E1DA] flex flex-col justify-between w-full max-w-md">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-[#EDF4F6] text-[10px] font-bold uppercase tracking-widest rounded-full text-[#2F6473] border border-[#3D7B8C]/25">Setup</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#526075] font-bold uppercase tracking-wider">
                    {isDesktop ? <Monitor size={12} className="text-[#3D7B8C]" /> : <Globe size={12} className="text-[#3D7B8C]" />}
                    {isDesktop ? 'Desktop App' : 'Web Browser'}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-[#1C355E]">Initialise Library</h3>
                <p className="text-sm text-[#526075] mb-8 leading-relaxed">
                  Please select the folder where you want your "Presenter" folder to be created. This is where your songs, liturgy, and media will be stored.
                </p>
              </div>
              <button 
                onClick={handleInitLibrary}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#7A502A] hover:bg-[#654121] active:bg-[#52341A] text-white rounded-xl transition-colors font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Folder size={20} />
                {loading ? 'Initialising...' : 'Select Folder'}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-[#991B1B] p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#B91C1C]" />
              <p className="whitespace-pre-wrap">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
