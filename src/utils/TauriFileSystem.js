import { readDir, readFile, writeFile, mkdir, remove, exists, writeTextFile } from '@tauri-apps/plugin-fs';

import { join as tauriJoin } from '@tauri-apps/api/path';
async function join(...args) {
    const p = await tauriJoin(...args);
    return p.replace(/\\/g, '/');
}


export class TauriFileHandle {
  constructor(path, name) {
    this.path = path;
    this.name = name;
    this.kind = 'file';
  }

  async getFile() {
    const bytes = await readFile(this.path);
    // Simple mime type fallback based on extension if needed, but octet-stream is fine for blobs
    let type = 'application/octet-stream';
    if (this.name.toLowerCase().endsWith('.pdf')) type = 'application/pdf';
    else if (this.name.match(/\.(jpg|jpeg)$/i)) type = 'image/jpeg';
    else if (this.name.match(/\.png$/i)) type = 'image/png';
    else if (this.name.match(/\.webp$/i)) type = 'image/webp';
    else if (this.name.match(/\.json$/i)) type = 'application/json';
    
    return new File([bytes], this.name, { type });
  }

  async createWritable() {
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
          // Fallback
          uint8 = new Uint8Array(await new Response(this.content).arrayBuffer());
        }
        await writeFile(targetPath, uint8);
      }
    };
  }
}

export class TauriDirectoryHandle {
  constructor(path, name) {
    this.path = path;
    this.name = name;
    this.kind = 'directory';
  }

  async getDirectoryHandle(name, options = { create: false }) {
    const nextPath = await join(this.path, name);
    if (options.create) {
      const dirExists = await exists(nextPath);
      if (!dirExists) {
         await mkdir(nextPath, { recursive: true });
      }
    }
    return new TauriDirectoryHandle(nextPath, name);
  }

  async getFileHandle(name, options = { create: false }) {
    const nextPath = await join(this.path, name);
    if (options.create) {
      const fileExists = await exists(nextPath);
      if (!fileExists) {
         await writeFile(nextPath, new Uint8Array([]));
      }
    }
    return new TauriFileHandle(nextPath, name);
  }

  async removeEntry(name) {
    const targetPath = await join(this.path, name);
    try {
        await remove(targetPath, { recursive: true });
    } catch(err) {
        console.warn('Failed to remove entry', err);
    }
  }

  async *values() {
    try {
        const entries = await readDir(this.path);
        try {
            await writeTextFile('C:\\Users\\jonat\\OneDrive\\Documents\\debug_taurifs.txt', 'Reading dir: ' + this.path + '\n' + JSON.stringify(entries, null, 2), { append: true });
        } catch(e) {}

        for (const entry of entries) {
        const entryPath = await join(this.path, entry.name);
        if (entry.isDirectory) {
            yield new TauriDirectoryHandle(entryPath, entry.name);
        } else {
            yield new TauriFileHandle(entryPath, entry.name);
        }
        }
    } catch(err) {
        console.warn('Failed to read dir', this.path, err); alert("readDir fail: " + this.path + " - " + String(err));
    }
  }
  
  async *entries() {
    try {
        const entries = await readDir(this.path);
        for (const entry of entries) {
        const entryPath = await join(this.path, entry.name);
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
