import * as pdfjsLib from 'pdfjs-dist';

// Use local worker to avoid CDN version mismatch and CORS issues
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Converts a PDF file into an array of image data URLs.
 * @param {File} file The PDF file object
 * @param {Array<number>} [selectedIndices] Optional array of indices (0-indexed) to convert. If omitted, converts all.
 * @returns {Promise<Array<{url: string}>>} Array of image objects compatible with Presenter slide_deck
 */
export async function convertPdfToImages(file, selectedIndices = null) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const images = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
        // If specific indices are requested and this page isn't one of them, skip it. (i is 1-indexed, indices are 0-indexed)
        if (selectedIndices && !selectedIndices.includes(i - 1)) {
            continue;
        }

        const page = await pdf.getPage(i);
        // Scale 2.0 provides a good balance between quality and memory usage for 1080p outputs
        const viewport = page.getViewport({ scale: 2.0 }); 
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Convert to data URL (JPEG for smaller memory footprint than PNG)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        images.push({ url: dataUrl, name: `Page ${i}` });
    }
    
    return images;
}
