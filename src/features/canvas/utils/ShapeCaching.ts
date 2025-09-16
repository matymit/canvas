// features/canvas/utils/ShapeCaching.ts
import Konva from 'konva';

export interface CacheConfig {
  pixelRatio?: number;
  hitCanvasPixelRatio?: number;
  offset?: number;
  drawBorder?: boolean;
  imageSmoothingEnabled?: boolean;
}

/**
 * Apply Konva cache() to a node with safe defaults.
 * - For basic shapes, Konva auto-detects cache rect; for custom shapes pass an explicit bbox via config. 
 * - Use pixelRatio > 1 for higher quality cache at the cost of memory.
 */
export function cacheShape(node: Konva.Shape | Konva.Group, cfg?: CacheConfig): Konva.Node {
  // For basic shapes, simple cache() is enough; config is optional.
  // For custom Konva.Shape, callers should pass bbox in cfg per docs.
  // https://konvajs.org/docs/performance/Shape_Caching.html
  if (!node) return node;
  return cfg ? (node.cache(cfg) || node) : (node.cache() || node);
}

/**
 * Clear cached canvases created by cache().
 * Useful when geometry or styles change in ways that invalidate the cache.
 */
export function clearShapeCache(node: Konva.Shape | Konva.Group): Konva.Node {
  return node.clearCache();
}

/**
 * Heuristic: cache lines or paths with many points for faster redraws.
 * Returns true if caching was applied.
 */
export function maybeCacheByComplexity(node: Konva.Node, thresholdPoints = 128, cfg?: CacheConfig): boolean {
  // Works best for Konva.Line or path-like shapes where redraw cost grows with point count.
  const anyNode = node as any;
  if (typeof anyNode.points === 'function') {
    const pts: number[] = anyNode.points();
    if (Array.isArray(pts) && pts.length >= thresholdPoints) {
      cacheShape(node as Konva.Shape, cfg);
      return true;
    }
  }
  return false;
}

/**
 * Apply recommended performance switches on shapes frequently updated:
 * - perfectDrawEnabled(false) and shadowForStrokeEnabled(false) can reduce overhead.
 */
export function tuneShapeForPerformance(node: Konva.Shape, opts?: {
  perfectDrawEnabled?: boolean;
  shadowForStrokeEnabled?: boolean;
}) {
  const { perfectDrawEnabled = false, shadowForStrokeEnabled = false } = opts ?? {};
  // Inherited from Konva.Shape API.
  node.perfectDrawEnabled(perfectDrawEnabled);
  node.shadowForStrokeEnabled(shadowForStrokeEnabled);
}

/**
 * Cache a whole layer when its contents are static (e.g., background grid).
 * NOTE: Re-cache after content changes; avoid overusing on dynamic layers.
 */
export function cacheLayerStatic(layer: Konva.Layer, cfg?: CacheConfig): Konva.Node {
  if (!layer) return layer;
  return cfg ? (layer.cache(cfg) || layer) : (layer.cache() || layer);
}

/**
 * Safely re-cache a node after mutation:
 * - clearCache() then cache() with optional config.
 */
export function recacheNode(node: Konva.Shape | Konva.Group, cfg?: CacheConfig) {
  node.clearCache();
  cacheShape(node, cfg);
}

/**
 * Utility to cache both scene and hit graphs at a higher pixel ratio for crisp interactions.
 * Use sparingly as it increases memory usage.
 */
export function cacheWithHiDPI(node: Konva.Shape | Konva.Group, pixelRatio = 2, hitPixelRatio = 2) {
  node.cache({ pixelRatio, hitCanvasPixelRatio: hitPixelRatio });
}