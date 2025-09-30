/**
 * Cache to track which images have already been saved to IndexedDB
 * to prevent redundant saves on every state change
 */

const savedImagesCache = new Set<string>();

export function markImageAsSaved(key: string): void {
  savedImagesCache.add(key);
}

export function isImageSaved(key: string): boolean {
  return savedImagesCache.has(key);
}

export function clearSavedImagesCache(): void {
  savedImagesCache.clear();
}
