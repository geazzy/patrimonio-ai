import * as pdfjsLib from 'pdfjs-dist';

// Polyfill/Normalization: In some ESM environments (like esm.sh), the module exports 
// might be wrapped in a 'default' property.
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Configure the worker. Using the same version as the main library.
// We use cdnjs here because loading the worker from esm.sh can sometimes cause 
// CORS or MIME type issues in the browser's Worker context.
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/**
 * Extracts text from a PDF file, attempting to preserve line structure
 * which is crucial for the parser logic.
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Use the normalized 'pdfjs' object to call getDocument
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const items = textContent.items as any[];
      
      if (items.length === 0) continue;

      // Sort items by Y (descending - top to bottom) then X (ascending - left to right)
      // This reconstructs the visual reading order.
      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        // Use a threshold to handle slight misalignments on the same line
        if (Math.abs(yDiff) > 5) { 
          return yDiff; 
        }
        return a.transform[4] - b.transform[4];
      });

      let pageText = '';
      let lastY = items[0].transform[5];

      for (const item of items) {
        const currentY = item.transform[5];
        
        // If Y has changed significantly (more than threshold), it's a new line
        if (Math.abs(currentY - lastY) > 8) {
             pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
             // Add a space between words on the same line if needed
             pageText += ' '; 
        }
        
        pageText += item.str;
        lastY = currentY;
      }
      
      fullText += pageText + '\n\n';
    }

    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Falha ao processar o arquivo PDF.');
  }
};