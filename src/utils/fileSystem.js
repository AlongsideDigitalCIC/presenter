import { get, set } from 'idb-keyval';
import { TauriDirectoryHandle } from './TauriFileSystem';

export async function getStoredDirectoryHandle() {
  try {
    const path = localStorage.getItem('presenter-library-path');
    if (!path) return null;
    return new TauriDirectoryHandle(path, 'Presenter');
  } catch (err) {
    console.error('Failed to get stored handle', err);
    return null;
  }
}

export async function setStoredDirectoryHandle(path) {
  try {
    localStorage.setItem('presenter-library-path', path);
    await set('presenter_library_path_idb', path);
  } catch (err) {
    console.error('Failed to store handle', err);
  }
}
