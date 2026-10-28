import { get, set, del } from 'idb-keyval';
import { TauriDirectoryHandle } from './TauriFileSystem';
import { isTauri } from './env';

export async function getStoredDirectoryHandle() {
  try {
    if (isTauri()) {
      let path = localStorage.getItem('presenter-library-path');
      if (!path) {
        path = await get('presenter_library_path_idb');
      }
      if (!path) return null;
      return new TauriDirectoryHandle(path.replace(/\\/g, '/'), 'Presenter');
    } else {
      // Browser environment: restore native FileSystemDirectoryHandle from IndexedDB
      const browserHandle = await get('presenter_browser_directory_handle');
      if (browserHandle) {
        try {
          const mode = { mode: 'readwrite' };
          if (
            (await browserHandle.queryPermission?.(mode)) === 'granted' ||
            (await browserHandle.requestPermission?.(mode)) === 'granted'
          ) {
            return browserHandle;
          }
        } catch (permErr) {
          console.warn('Browser directory handle permission query failed:', permErr);
        }
      }
      return null;
    }
  } catch (err) {
    console.error('Failed to get stored handle', err);
    return null;
  }
}

export async function setStoredDirectoryHandle(pathOrHandle) {
  try {
    if (typeof pathOrHandle === 'string') {
      localStorage.setItem('presenter-library-path', pathOrHandle);
      await set('presenter_library_path_idb', pathOrHandle);
    } else if (pathOrHandle) {
      // Native FileSystemDirectoryHandle (Browser)
      await set('presenter_browser_directory_handle', pathOrHandle);
    }
  } catch (err) {
    console.error('Failed to store handle', err);
  }
}

export async function clearStoredDirectoryHandle() {
  try {
    localStorage.removeItem('presenter-library-path');
    await del('presenter_library_path_idb');
    await del('presenter_browser_directory_handle');
  } catch (err) {
    console.error('Failed to clear stored handle', err);
  }
}
