/**
 * Image Storage Utilities
 * Handles automatic compression and IndexedDB persistence for large images
 */

import imageCompression from 'browser-image-compression';
import { get, set, del } from 'idb-keyval';
import { markImageAsSaved, isImageSaved } from './imageSaveCache';
import { debug, error } from './debug';

const LOG_CATEGORY = 'storage/image';

// Configuration for image compression
const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5, // Maximum 500KB per image
  maxWidthOrHeight: 1920, // Max dimension
  useWebWorker: true,
  fileType: 'image/jpeg', // Convert all to JPEG for better compression
  initialQuality: 0.8, // Start with 80% quality
};

/**
 * Compress a File object to a smaller size
 */
export async function compressImageFile(file: File): Promise<File> {
  try {
    const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);
    debug('ImageStorage: file compressed', {
      category: LOG_CATEGORY,
      data: {
        originalKB: (file.size / 1024).toFixed(2),
        compressedKB: (compressedFile.size / 1024).toFixed(2),
      },
    });
    return compressedFile;
  } catch (caughtError) {
    error('ImageStorage: compression failed, using original file', {
      category: LOG_CATEGORY,
      data: { error: caughtError },
    });
    return file;
  }
}

/**
 * Compress a base64 data URL by converting to canvas and re-encoding
 */
export async function compressBase64(
  base64: string,
  maxWidth: number = 1920,
  quality: number = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed JPEG
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      
      const originalSize = (base64.length * 0.75) / 1024; // Approximate KB
      const compressedSize = (compressedBase64.length * 0.75) / 1024;
      
      debug('ImageStorage: base64 compressed', {
        category: LOG_CATEGORY,
        data: {
          originalKB: originalSize.toFixed(2),
          compressedKB: compressedSize.toFixed(2),
        },
      });
      
      resolve(compressedBase64);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };
    
    img.src = base64;
  });
}

/**
 * Save compressed image to IndexedDB and return a reference key
 */
export async function saveImageToIndexedDB(base64: string, key?: string): Promise<string> {
  try {
    // Generate or use provided key
    const idbKey = key || `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if already saved
    if (isImageSaved(idbKey)) {
      debug('ImageStorage: already saved, skipping write', {
        category: LOG_CATEGORY,
        data: { idbKey },
      });
      return idbKey;
    }
    
    // Compress the image first
    const compressed = await compressBase64(base64);
    
    // Store in IndexedDB
    await set(idbKey, compressed);
    
    // Mark as saved to prevent duplicates
    markImageAsSaved(idbKey);
    
    debug('ImageStorage: saved to IndexedDB', {
      category: LOG_CATEGORY,
      data: { idbKey },
    });
    return idbKey;
  } catch (caughtError) {
    error('ImageStorage: failed to save to IndexedDB', {
      category: LOG_CATEGORY,
      data: { error: caughtError, key },
    });
    throw caughtError;
  }
}

/**
 * Load image from IndexedDB by key
 */
export async function loadImageFromIndexedDB(key: string): Promise<string | null> {
  try {
    const base64 = await get<string>(key);
    if (base64) {
      debug('ImageStorage: loaded from IndexedDB', {
        category: LOG_CATEGORY,
        data: { idbKey: key },
      });
    }
    return base64 || null;
  } catch (caughtError) {
    error('ImageStorage: failed to load from IndexedDB', {
      category: LOG_CATEGORY,
      data: { idbKey: key, error: caughtError },
    });
    return null;
  }
}

/**
 * Delete image from IndexedDB
 */
export async function deleteImageFromIndexedDB(key: string): Promise<void> {
  try {
    await del(key);
    debug('ImageStorage: deleted from IndexedDB', {
      category: LOG_CATEGORY,
      data: { idbKey: key },
    });
  } catch (caughtError) {
    error('ImageStorage: failed to delete from IndexedDB', {
      category: LOG_CATEGORY,
      data: { idbKey: key, error: caughtError },
    });
  }
}

/**
 * Process an image file for canvas use:
 * 1. Compress it
 * 2. Convert to base64
 * 3. Store in IndexedDB
 * 4. Return both the key and base64 for immediate use
 */
export async function processImageForCanvas(file: File): Promise<{
  idbKey: string;
  base64: string;
  originalSize: number;
  compressedSize: number;
}> {
  // Compress the file
  const compressedFile = await compressImageFile(file);
  
  // Convert to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(compressedFile);
  });
  
  // Compress the base64 further if needed
  const finalBase64 = await compressBase64(base64);
  
  // Save to IndexedDB
  const idbKey = await saveImageToIndexedDB(finalBase64);
  
  return {
    idbKey,
    base64: finalBase64,
    originalSize: file.size,
    compressedSize: Math.round((finalBase64.length * 0.75)),
  };
}
