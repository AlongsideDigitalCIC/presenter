import { useState, useCallback, useEffect } from 'react';
import { UploadCloud } from 'lucide-react';

export default function DragDropZone({ libraryHandle, onFileAdded, children }) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

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
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-[#1C355E]/95 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
           <UploadCloud size={80} className="text-[#1C355E] mb-6 animate-bounce" />
           <h2 className="text-4xl md:text-5xl font-extrabold text-[#1C355E] tracking-widest drop-shadow-2xl">SMART INGEST</h2>
           <p className="text-[#3D7B8C] mt-4 text-sm md:text-lg font-medium opacity-90 tracking-wide">
             Drop files or entire Presentation Folders securely into Presenter limitlessly.
           </p>
        </div>
      )}
    </>
  );
}
