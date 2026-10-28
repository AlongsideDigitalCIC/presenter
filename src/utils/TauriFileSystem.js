import { readDir, readFile, writeFile, mkdir, remove, exists } from '@tauri-apps/plugin-fs';
import { isTauri } from './env';

function sanitizeChildName(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Invalid entry name');
  const cleaned = name.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = cleaned.split('/').filter(Boolean);
  if (segments.some(s => s === '..' || s === '.')) {
    throw new Error(`Path traversal attempt blocked: ${name}`);
  }
  return segments.join('/');
}

function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .map(p => String(p).replace(/\\/g, '/'))
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .filter(Boolean)
    .join('/');
}

export class TauriFileHandle {
  constructor(path, name) {
    this.path = path.replace(/\\/g, '/');
    this.name = name;
    this.kind = 'file';
  }

  async getFile() {
    if (!isTauri()) {
      throw new Error('Tauri file access is only available in the desktop application.');
    }
    const bytes = await readFile(this.path);
    let type = 'application/octet-stream';
    if (this.name.toLowerCase().endsWith('.pdf')) type = 'application/pdf';
    else if (this.name.match(/\.(jpg|jpeg)$/i)) type = 'image/jpeg';
    else if (this.name.match(/\.png$/i)) type = 'image/png';
    else if (this.name.match(/\.webp$/i)) type = 'image/webp';
    else if (this.name.match(/\.json$/i)) type = 'application/json';
    
    return new File([bytes], this.name, { type });
  }

  async createWritable() {
    if (!isTauri()) {
      throw new Error('Tauri file access is only available in the desktop application.');
    }
    const targetPath = this.path;
    return {
      content: null,
      async write(data) {
        this.content = data;
      },
      async close() {
        let uint8;
        if (typeof this.content === 'string') {
          uint8 = new TextEncoder().encode(this.content);
        } else if (this.content instanceof Blob || this.content instanceof File) {
          uint8 = new Uint8Array(await this.content.arrayBuffer());
        } else if (this.content instanceof Uint8Array) {
          uint8 = this.content;
        } else {
          uint8 = new Uint8Array(await new Response(this.content).arrayBuffer());
        }
        await writeFile(targetPath, uint8);
      }
    };
  }
}

export class TauriDirectoryHandle {
  constructor(path, name) {
    this.path = path.replace(/\\/g, '/');
    this.name = name;
    this.kind = 'directory';
  }

  async getDirectoryHandle(name, options = { create: false }) {
    if (!isTauri()) {
      throw new Error('Tauri directory access is only available in the desktop application.');
    }
    const safeName = sanitizeChildName(name);
    const nextPath = joinPath(this.path, safeName);
    if (options.create) {
      const dirExists = await exists(nextPath);
      if (!dirExists) {
        await mkdir(nextPath, { recursive: true });
      }
    }
    return new TauriDirectoryHandle(nextPath, safeName);
  }

  async getFileHandle(name, options = { create: false }) {
    if (!isTauri()) {
      throw new Error('Tauri directory access is only available in the desktop application.');
    }
    const safeName = sanitizeChildName(name);
    const nextPath = joinPath(this.path, safeName);
    if (options.create) {
      const fileExists = await exists(nextPath);
      if (!fileExists) {
        await writeFile(nextPath, new Uint8Array([]));
      }
    }
    return new TauriFileHandle(nextPath, safeName);
  }

  async removeEntry(name) {
    if (!isTauri()) return;
    const safeName = sanitizeChildName(name);
    const targetPath = joinPath(this.path, safeName);
    try {
      await remove(targetPath, { recursive: true });
    } catch(err) {
      console.warn('Failed to remove entry', err);
    }
  }

  async *values() {
    if (!isTauri()) return;
    try {
      const entries = await readDir(this.path);
      for (const entry of entries) {
        const entryPath = joinPath(this.path, entry.name);
        if (entry.isDirectory) {
          yield new TauriDirectoryHandle(entryPath, entry.name);
        } else {
          yield new TauriFileHandle(entryPath, entry.name);
        }
      }
    } catch(err) {
      console.warn('Failed to read dir', this.path, err);
    }
  }
  
  async *entries() {
    if (!isTauri()) return;
    try {
      const entries = await readDir(this.path);
      for (const entry of entries) {
        const entryPath = joinPath(this.path, entry.name);
        if (entry.isDirectory) {
          yield [entry.name, new TauriDirectoryHandle(entryPath, entry.name)];
        } else {
          yield [entry.name, new TauriFileHandle(entryPath, entry.name)];
        }
      }
    } catch(err) {
      console.warn('Failed to read dir entries', this.path, err);
    }
  }
}
