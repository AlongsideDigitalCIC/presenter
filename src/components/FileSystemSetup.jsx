import { useState } from 'react';
import { setStoredDirectoryHandle } from '../utils/fileSystem';
import { TauriDirectoryHandle } from '../utils/TauriFileSystem';
import { Folder, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { documentDir, join } from '@tauri-apps/api/path';
import { mkdir, exists } from '@tauri-apps/plugin-fs';
import Logo from './Logo';

const REQUIRED_FOLDERS = [
  'Songs', 
  'Images', 
  'Videos', 
  'Music', 
  'Bible'
];

export default function FileSystemSetup({ onReady }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInitLibrary = async () => {
    try {
      setLoading(true);
      setError('');
      
      const defaultPath = await documentDir();
      
      const selectedPath = await open({
        directory: true,
        multiple: false,
        defaultPath,
        title: 'Select Folder for Presenter Library'
      });
      
      if (!selectedPath) return; // User cancelled
      
      // If the user already selected a folder named "Presenter", don't nest it again
      let presenterPath = selectedPath;
      if (!selectedPath.toLowerCase().endsWith('presenter')) {
          presenterPath = await join(selectedPath, 'Presenter');
      }
      
      presenterPath = presenterPath.replace(/\\\\/g, '/');
      const isExist = await exists(presenterPath);
      if (!isExist) {
          await mkdir(presenterPath, { recursive: true });
      }
      
      // Store path string in IndexedDB
      await setStoredDirectoryHandle(presenterPath);
      
      // Initialize subfolders
      const handle = new TauriDirectoryHandle(presenterPath, 'Presenter');
      for (const folderName of REQUIRED_FOLDERS) {
        await handle.getDirectoryHandle(folderName, { create: true });
      }
      
      onReady(handle);
    } catch (err) {
       console.error(err); setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] text-[#1C355E] flex flex-col items-center justify-center p-6 sm:p-8 selection:bg-[#3D7B8C]/30 relative">
      <div className="absolute top-6 left-6 z-50">
          <Logo showText={true} className="h-10 w-auto object-contain" textClassName="text-2xl font-black tracking-widest text-[#1C355E] drop-shadow-sm" />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#3D7B8C]/10 rounded-full blur-[120px]"></div>
      </div>
      
      <div className="max-w-3xl w-full flex flex-col items-center relative z-10">
        
        
        <div className="w-full bg-white/60 backdrop-blur-xl p-6 sm:p-10 rounded-3xl border border-[#3D7B8C]/10/80 shadow-2xl space-y-10">
            <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold tracking-tight">Welcome to Presenter</h2>
                <p className="text-neutral-400 text-lg">Initialise your presentation environment.</p>
            </div>

            <div className="flex justify-center">
                <div className="bg-white/50 p-6 rounded-2xl border border-[#1C355E]/30 flex flex-col justify-between shadow-[inset_0_0_30px_rgba(28,53,94,0.05)] relative overflow-hidden w-full max-w-md">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#3D7B8C]/10 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <span className="px-3 py-1 bg-[#3D7B8C]/20 text-[10px] font-bold uppercase tracking-widest rounded-full text-[#3D7B8C] border border-[#3D7B8C]/20">Setup</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-[#1C355E]">Initialise Library</h3>
                        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">Please select the folder where you want the "Presenter" folder to be created. This is where your songs, liturgy, and media will be stored.</p>
                    </div>
                    <button 
                        onClick={handleInitLibrary}
                        disabled={loading}
                        className="relative z-10 w-full py-3.5 px-4 bg-[#3D7B8C] hover:bg-[#3D7B8C] text-white rounded-xl transition font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg border border-[#3D7B8C]/50"
                    >
                        <Folder size={20} />
                        {loading ? 'Initialising...' : 'Select Folder'}
                    </button>
                </div>
            </div>

            

            {error && (
                <div className="text-rose-400 p-4 bg-[#C4956A]/20 border border-rose-900/50 rounded-xl text-sm flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="whitespace-pre-wrap">{error}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
