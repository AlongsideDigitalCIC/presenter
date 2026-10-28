import { useState, useCallback, useEffect } from 'react';
import { UploadCloud, Presentation, Loader2 } from 'lucide-react';

export default function DragDropZone({ libraryHandle, onFileAdded, children }) {
  const [isDragging, setIsDragging] = useState(false);
  const [_dragCounter, setDragCounter] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');

  const handleDragEnter = useCallback((e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) setIsDragging(false);
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
  }, []);

  const copyDir = async (srcEntry, destHandle) => {
      const reader = srcEntry.createReader();
      const readAll = async () => {
          let allEntries = [];
          let entries = await new Promise(res => reader.readEntries(res));
          while (entries.length > 0) {
              allEntries.push(...entries);
              entries = await new Promise(res => reader.readEntries(res));
          }
          return allEntries;
      };
      
      const entries = await readAll();
      for (const sub of entries) {
          if (sub.isFile) {
              await new Promise((resolve) => {
                  sub.file(async file => {
                      const fHandle = await destHandle.getFileHandle(sub.name, { create: true });
                      const w = await fHandle.createWritable();
                      await w.write(file);
                      await w.close();
                      resolve();
                  });
              });
          } else if (sub.isDirectory) {
              const newSubDir = await destHandle.getDirectoryHandle(sub.name, { create: true });
              await copyDir(sub, newSubDir);
          }
      }
  };

  const handleDrop = useCallback(async (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setDragCounter(0);
    setIsDragging(false);

    if (!libraryHandle) return;
    
    const items = [...e.dataTransfer.items];
    
    for (const item of items) {
      if (item.kind === 'file') {
         const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
         
         if (entry && entry.isDirectory) {
             // Treat a dropped folder as a Slide Deck and drop it directly into Images
             try {
                 const imagesFolder = await libraryHandle.getDirectoryHandle('Images', { create: true });
                 const newDirHandle = await imagesFolder.getDirectoryHandle(entry.name, { create: true });
                 await copyDir(entry, newDirHandle);
                 console.log(`Ingested Slide Deck folder: ${entry.name}`);
             } catch(err) {
                 console.error(`Failed to ingest slide deck ${entry.name}`, err);
             }
         } else {
             const file = item.getAsFile();
             if (!file) continue;
             
             const ext = file.name.split('.').pop().toLowerCase();

             // Special Handler for PowerPoint Presentations (.pptx)
             if (ext === 'pptx') {
               try {
                 setIsExtracting(true);
                 setExtractStatus(`Extracting slides from ${file.name}...`);
                 const { extractPptxToLibrary } = await import('../utils/pptxConverter');
                 await extractPptxToLibrary(file, libraryHandle, (statusMsg) => {
                   setExtractStatus(statusMsg);
                 });
                 console.log(`Smart Ingest: Extracted PowerPoint deck from ${file.name}`);
                 if (onFileAdded) onFileAdded();
               } catch (err) {
                 console.error(`Failed to extract PPTX ${file.name}`, err);
                 // Fallback: save raw file into Images
                 try {
                   const dirHandle = await libraryHandle.getDirectoryHandle('Images', { create: true });
                   const newFileHandle = await dirHandle.getFileHandle(file.name, { create: true });
                   const writable = await newFileHandle.createWritable();
                   await writable.write(file);
                   await writable.close();
                   if (onFileAdded) onFileAdded();
                 } catch {
                   /* ignore fallback write error */
                 }
               } finally {
                 setIsExtracting(false);
                 setExtractStatus('');
               }
               continue;
             }

             let targetFolder = 'Documents';
             if (['md', 'txt'].includes(ext)) targetFolder = 'Songs';
             else if (['mp4', 'mov', 'webm'].includes(ext)) targetFolder = 'Videos';
             else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext)) targetFolder = 'Images';
             else if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) targetFolder = 'Music';

             try {
               const dirHandle = await libraryHandle.getDirectoryHandle(targetFolder, { create: true });
               const newFileHandle = await dirHandle.getFileHandle(file.name, { create: true });
               const writable = await newFileHandle.createWritable();
               await writable.write(file);
               await writable.close();
               console.log(`Smart Ingest: Copied ${file.name} to /${targetFolder}`);
               if (onFileAdded) onFileAdded();
             } catch (err) {
               console.error(`Failed to ingest ${file.name}`, err);
             }
         }
      }
    }
    
    // Also trigger onFileAdded for folders
    if (onFileAdded) onFileAdded();
  }, [libraryHandle, onFileAdded]);

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return (
    <>
      {children}

      {/* Extracting PowerPoint Overlay */}
      {isExtracting && (
        <div className="fixed inset-0 z-[120] bg-[#1C355E]/95 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
           <div className="relative mb-6">
              <Presentation size={64} className="text-white" />
              <div className="absolute -bottom-2 -right-2 bg-[#3D7B8C] rounded-full p-1.5 shadow-lg animate-spin">
                 <Loader2 size={18} className="text-white" />
              </div>
           </div>
           <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-wider">Extracting PowerPoint...</h2>
           <p className="text-white/80 mt-3 text-sm md:text-base font-semibold px-6 text-center max-w-lg">
             {extractStatus || 'Extracting slides into high-resolution images & PDF without PowerPoint...'}
           </p>
        </div>
      )}

      {/* Dragging Overlay */}
      {isDragging && !isExtracting && (
        <div className="fixed inset-0 z-[100] bg-[#1C355E]/95 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
           <UploadCloud size={80} className="text-white mb-6 animate-bounce" />
           <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-widest">SMART INGEST</h2>
           <p className="text-white/85 mt-4 text-sm md:text-lg font-medium tracking-wide text-center px-6 max-w-xl">
             Drop PowerPoint presentations, slides, videos, audio, or entire folders into Presenter.
           </p>
        </div>
      )}
    </>
  );
}
