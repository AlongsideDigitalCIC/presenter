import { PPTXViewer } from 'pptxviewjs';
import { jsPDF } from 'jspdf';

/**
 * Converts a PPTX presentation file into an array of slide images.
 * @param {File|Blob} file The .pptx file object
 * @param {Array<number>} [selectedIndices] Optional indices (0-indexed) to convert
 * @param {Function} [onProgress] Optional callback (currentSlide, totalSlides)
 * @returns {Promise<{images: Array<{url: string, name: string, originalIndex: number}>, width: number, height: number, slideCount: number}>}
 */
export async function convertPptxToImages(file, selectedIndices = null, onProgress = null) {
  const canvas = document.createElement('canvas');
  // Initial fallback 16:9 widescreen
  canvas.width = 1920;
  canvas.height = 1080;

  const viewer = new PPTXViewer({
    canvas,
    autoRenderFirstSlide: false,
    slideSizeMode: 'fit',
    backgroundColor: '#ffffff'
  });

  await viewer.loadFile(file);

  let targetWidth = 1920;
  let targetHeight = 1080;

  try {
    const dims = viewer.processor?.getSlideDimensions?.();
    if (dims && dims.cx && dims.cy) {
      const aspectRatio = dims.cx / dims.cy;
      targetHeight = 1080;
      targetWidth = Math.round(1080 * aspectRatio);
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  } catch {
    // Keep 1920x1080 fallback
  }

  const slideCount = viewer.getSlideCount();
  const images = [];

  for (let i = 0; i < slideCount; i++) {
    if (selectedIndices && !selectedIndices.includes(i)) {
      continue;
    }

    if (onProgress) {
      onProgress(i + 1, slideCount);
    }

    await viewer.renderSlide(i, canvas, { scale: 1.5 });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    images.push({
      url: dataUrl,
      name: `Slide ${i + 1}`,
      originalIndex: i
    });
  }

  try {
    viewer.destroy();
  } catch {
    // Ignore cleanup error
  }

  return { images, width: targetWidth, height: targetHeight, slideCount };
}

/**
 * Creates a downloadable/storable multi-page PDF Blob from slide images.
 * @param {Array<{url: string}>} images 
 * @param {number} width 
 * @param {number} height 
 * @returns {Blob|null}
 */
export function createPdfFromSlideImages(images, width = 1920, height = 1080) {
  if (!images || images.length === 0) return null;

  const orientation = width >= height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [width, height],
    compress: true
  });

  images.forEach((img, idx) => {
    if (idx > 0) {
      pdf.addPage([width, height], orientation);
    }
    pdf.addImage(img.url, 'JPEG', 0, 0, width, height);
  });

  return pdf.output('blob');
}

/**
 * Extracts all slides from a PPTX file into a Slide Deck directory inside Images/<DeckName>/
 * with individual JPEG slide images, a compiled PDF, and the original PPTX file.
 * @param {File} file The dropped PPTX file
 * @param {FileSystemDirectoryHandle} libraryHandle 
 * @param {Function} [onProgress] Progress reporter (message, current, total)
 * @returns {Promise<{deckName: string, slideCount: number, images: Array<{url: string, name: string}>}>}
 */
export async function extractPptxToLibrary(file, libraryHandle, onProgress = null) {
  if (!libraryHandle) throw new Error("Library handle not available");

  const rawDeckName = file.name.replace(/\.pptx$/i, '').trim() || 'Presentation';
  const deckName = rawDeckName.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\.+/g, '_').trim() || 'Presentation';
  if (onProgress) onProgress(`Analyzing presentation: ${file.name}...`, 0, 0);

  const { images, width, height, slideCount } = await convertPptxToImages(
    file, 
    null, 
    (current, total) => {
      if (onProgress) onProgress(`Rendering slide ${current} of ${total}...`, current, total);
    }
  );

  if (images.length === 0) {
    throw new Error("No slides could be extracted from this presentation.");
  }

  if (onProgress) onProgress(`Saving slides and generating PDF for "${deckName}"...`, slideCount, slideCount);

  // 1. Get or create 'Images' directory
  const imagesFolder = await libraryHandle.getDirectoryHandle('Images', { create: true });

  // 2. Create the presentation Slide Deck folder inside Images
  const deckFolder = await imagesFolder.getDirectoryHandle(deckName, { create: true });

  // 3. Save each slide as high-resolution JPEG
  for (let i = 0; i < images.length; i++) {
    const slideNumber = String(i + 1).padStart(2, '0');
    const slideFileName = `slide_${slideNumber}.jpg`;
    const slideFileHandle = await deckFolder.getFileHandle(slideFileName, { create: true });
    
    // Convert data URL to Blob
    const res = await fetch(images[i].url);
    const blob = await res.blob();
    
    const writable = await slideFileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  // 4. Generate and save compiled PDF into the deck folder
  try {
    const pdfBlob = createPdfFromSlideImages(images, width, height);
    if (pdfBlob) {
      const pdfHandle = await deckFolder.getFileHandle(`${deckName}.pdf`, { create: true });
      const pdfW = await pdfHandle.createWritable();
      await pdfW.write(pdfBlob);
      await pdfW.close();
    }
  } catch (pdfErr) {
    console.warn("Could not generate PDF companion file", pdfErr);
  }

  // 5. Save the original PPTX file inside the folder as well for backup
  try {
    const origHandle = await deckFolder.getFileHandle(file.name, { create: true });
    const origW = await origHandle.createWritable();
    await origW.write(file);
    await origW.close();
  } catch (origErr) {
    console.warn("Could not save original PPTX file backup", origErr);
  }

  return { deckName, slideCount, images };
}
