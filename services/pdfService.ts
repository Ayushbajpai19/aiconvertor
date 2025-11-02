import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

// Explicitly set the worker source to prevent loading errors.
// This URL must match the version being used in the import map.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs`;

async function getDocument(file: File, password?: string) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    password: password,
  });
  return loadingTask.promise;
}

export async function isPdfEncrypted(file: File): Promise<boolean> {
  try {
    // Attempt to get the document without a password.
    // If it throws a PasswordException, we know it's encrypted.
    await getDocument(file);
    return false; // No exception, so not encrypted.
  } catch (err: any) {
    if (err.name === 'PasswordException') {
      return true;
    }
    // Re-throw other errors (e.g., invalid PDF)
    throw err;
  }
}

export async function getPdfPageImagesAsBase64(file: File, password?: string): Promise<string[]> {
  const pdf = await getDocument(file, password);
  const images: string[] = [];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not create canvas context for PDF rendering.');
  }

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Use a higher scale for better resolution and OCR accuracy
    const viewport = page.getViewport({ scale: 2.0 }); 
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    // Get the image data from the canvas
    images.push(canvas.toDataURL('image/png'));
  }

  return images;
}