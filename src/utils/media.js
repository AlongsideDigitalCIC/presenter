import { isTauri } from './env.js';
import { convertFileSrc } from '@tauri-apps/api/core';
import { convertPdfToImages } from './pdfConverter';

export async function verifyPermission(fileHandle, readWrite = true) {
  return true; // Always return true for Tauri!
}

function generateThumbnail(url) {
  return new Promise((resolve) => {
    const img = new Image();
    if (url.startsWith('http')) {
      img.crossOrigin = "Anonymous";
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxW = 160; // Tiny thumbnail for remote control grid
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      } catch (e) {
        console.warn("Thumbnail generation failed:", e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function reResolveMedia(items, library) {
  if (!library || !items) return items;
  const newItems = [...items];
  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    if (!item.folder || !item.filename) continue;
    
    try {
      if (item.type === 'slide_deck') {
         if (item.filename?.toLowerCase().endsWith('.pdf') || item.extension === 'pdf') {
             let fileHandle = item.fileHandle || item.handle;
             if (!fileHandle || typeof fileHandle.getFile !== 'function') {
                 if (item.relativePath) {
                     let curr = library;
                     for (let k = 0; k < item.relativePath.length - 1; k++) {
                         curr = await curr.getDirectoryHandle(item.relativePath[k]);
                     }
                     fileHandle = await curr.getFileHandle(item.relativePath[item.relativePath.length - 1]);
                 } else {
                     const dirHandle = await library.getDirectoryHandle(item.folder);
                     fileHandle = await dirHandle.getFileHandle(item.filename);
                 }
             }
             const file = await fileHandle.getFile();
             const images = await convertPdfToImages(file, item.selectedIndices);
             for (let img of images) {
                 img.thumbnail = await generateThumbnail(img.url);
             }
             const url = (isTauri() && fileHandle.path) ? convertFileSrc(fileHandle.path) : URL.createObjectURL(file);
             newItems[i] = { ...item, fileHandle, images, url };
         } else {
             let subDir = item.handle || item.fileHandle;
             if (!subDir || typeof subDir.values !== 'function') {
                 if (item.relativePath) {
                     let curr = library;
                     for (let k = 0; k < item.relativePath.length; k++) {
                         curr = await curr.getDirectoryHandle(item.relativePath[k]);
                     }
                     subDir = curr;
                 } else {
                     const dirHandle = await library.getDirectoryHandle(item.folder);
                     subDir = await dirHandle.getDirectoryHandle(item.filename);
                 }
             }
             const imgArray = [];
             let idx = 0;
             for await (const entry of subDir.values()) {
                if (entry.kind === 'file' && entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                   imgArray.push({ name: entry.name, fileHandle: entry, originalIndex: idx++ });
                }
             }
             imgArray.sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
             
             const resolvedImages = [];
             for (let j = 0; j < imgArray.length; j++) {
                if (!item.selectedIndices || item.selectedIndices.includes(imgArray[j].originalIndex)) {
                   const fileH = imgArray[j].fileHandle;
                   const file = await fileH.getFile();
                   const tempUrl = URL.createObjectURL(file);
                   const thumbnail = await generateThumbnail(tempUrl);
                   if (isTauri() && fileH.path) URL.revokeObjectURL(tempUrl);
                   const url = (isTauri() && fileH.path) ? convertFileSrc(fileH.path) : tempUrl;
                   resolvedImages.push({ url, thumbnail });
                }
             }
             newItems[i] = { ...item, images: resolvedImages };
         }
      } else if (item.folder !== 'Bible' && !item.isExternal) {
         let fileHandle = item.fileHandle || item.handle;
         if (!fileHandle || typeof fileHandle.getFile !== 'function') {
             if (item.relativePath) {
                 let curr = library;
                 for (let k = 0; k < item.relativePath.length - 1; k++) {
                     curr = await curr.getDirectoryHandle(item.relativePath[k]);
                 }
                 fileHandle = await curr.getFileHandle(item.relativePath[item.relativePath.length - 1]);
             } else {
                 const dirHandle = await library.getDirectoryHandle(item.folder);
                 fileHandle = await dirHandle.getFileHandle(item.filename);
             }
         }
         const file = await fileHandle.getFile();
         const tempUrl = URL.createObjectURL(file);
         const thumbnail = item.type === 'image' ? await generateThumbnail(tempUrl) : null;
         if (isTauri() && fileHandle.path) URL.revokeObjectURL(tempUrl);
         const url = (isTauri() && fileHandle.path) ? convertFileSrc(fileHandle.path) : tempUrl;
         newItems[i] = { ...item, url, fileHandle, images: item.type === 'image' ? [{ url, thumbnail }] : undefined, thumbnail };
      }
    } catch (err) {
      console.warn(`Failed to re-resolve media: ${item.filename}`, err);
    }
  }
  return newItems;
}

export function getYoutubeEmbedUrl(url) {
  if (!url) return '';
  const videoId = url.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/embed\/))([^?&]+)/)?.[1];
  if (!videoId) return url;
  
  const origin = window.location.origin.replace(/\/$/, ""); // Clean origin
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    controls: '0',
    cc_load_policy: '3',
    vq: 'hd1080',
    origin: origin,
    widget_referrer: origin,
    autoplay: '0'
  });
  
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function formatVerseRanges(numbers) {
  if (numbers.length === 0) return "";
  numbers.sort((a, b) => a - b);
  const ranges = [];
  let start = numbers[0];
  let end = numbers[0];
  for (let i = 1; i <= numbers.length; i++) {
    if (i < numbers.length && numbers[i] === end + 1) {
      end = numbers[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      if (i < numbers.length) {
        start = numbers[i];
        end = numbers[i];
      }
    }
  }
  return ranges.join(', ');
}
