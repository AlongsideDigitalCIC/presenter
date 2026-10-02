import { useState, useEffect } from 'react';

/**
 * Hook to generically list the files of any particular folder
 * whenever the user clicks that folder tab (e.g. Videos, Images, Documents).
 */
export function useFolderContents(libraryHandle, folderName, trigger) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const excludedTabs = ['Service', 'Songs', 'new_song', 'new_liturgy', 'Settings'];
    if (!libraryHandle || !folderName || excludedTabs.includes(folderName)) {
       setFiles([]);
       return;
    }
    
    let isCancelled = false;

    const fetchFiles = async () => {
      try {
        const dirHandle = await libraryHandle.getDirectoryHandle(folderName, { create: true });
        const fileList = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
             fileList.push({ name: entry.name, handle: entry, isDirectory: false });
          } else if (entry.kind === 'directory') {
             // Folders inside Images are treated as grouped Slide Decks!
             fileList.push({ name: entry.name, handle: entry, isDirectory: true });
          }
        }
        if (!isCancelled) {
           // Sort folders first, then alphabetically
           fileList.sort((a,b) => {
              if (a.isDirectory && !b.isDirectory) return -1;
              if (!a.isDirectory && b.isDirectory) return 1;
              return a.name.localeCompare(b.name, undefined, { numeric: true });
           });
           setFiles(fileList);
        }
      } catch(err) {
        console.warn(`Could not read generic folder: ${folderName}`);
      }
    };
    fetchFiles();

    return () => { isCancelled = true; };
  }, [libraryHandle, folderName, trigger]);

  return files;
}
