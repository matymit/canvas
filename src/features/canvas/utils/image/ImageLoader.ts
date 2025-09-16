// Image loading utilities for file handling and HTML image creation

/**
 * Convert a File object to a data URL string
 */
export async function fileToDataURL(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/**
 * Load an HTMLImageElement from a source URL
 */
export async function loadHTMLImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Complete file-to-image pipeline: converts File to data URL and loads HTMLImageElement
 */
export async function loadImageFromFile(file: File): Promise<{
  img: HTMLImageElement;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}> {
  const dataUrl = await fileToDataURL(file);
  const img = await loadHTMLImage(dataUrl);
  return {
    img,
    dataUrl,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  };
}