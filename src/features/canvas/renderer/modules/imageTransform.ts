// Transform-end normalization helper for image elements
import type ImageElement from '../../types/image';

/**
 * Apply transform scale normalization to image element
 * Converts Konva node scale back to absolute pixel dimensions
 */
export function applyImageResize(
  el: ImageElement,
  nodeScaleX: number,
  nodeScaleY: number
): ImageElement {
  const w = Math.max(1, Math.round(el.width * nodeScaleX));
  const h = Math.max(1, Math.round(el.height * nodeScaleY));
  
  return { 
    ...el, 
    width: w, 
    height: h 
  };
}

/**
 * Apply aspect ratio constraint during resize if keepAspectRatio is enabled
 */
export function applyImageResizeWithAspect(
  el: ImageElement,
  nodeScaleX: number,
  nodeScaleY: number
): ImageElement {
  if (!el.keepAspectRatio) {
    return applyImageResize(el, nodeScaleX, nodeScaleY);
  }
  
  // Calculate aspect ratio from natural dimensions
  const naturalAspect = el.naturalWidth / el.naturalHeight;
  
  // Use the scale that would result in the smaller dimension
  // to maintain aspect ratio within the transform bounds
  const targetW = el.width * nodeScaleX;
  const targetH = el.height * nodeScaleY;
  
  let finalW: number;
  let finalH: number;
  
  if (targetW / targetH > naturalAspect) {
    // Width is constraining dimension
    finalH = Math.max(1, Math.round(targetH));
    finalW = Math.max(1, Math.round(finalH * naturalAspect));
  } else {
    // Height is constraining dimension  
    finalW = Math.max(1, Math.round(targetW));
    finalH = Math.max(1, Math.round(finalW / naturalAspect));
  }
  
  return {
    ...el,
    width: finalW,
    height: finalH
  };
}