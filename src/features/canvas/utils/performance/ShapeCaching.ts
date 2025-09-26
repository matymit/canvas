import Konva from 'konva';

export interface CacheConfig {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  offset?: number;
  drawBorder?: boolean;
  pixelRatio?: number;
  imageSmoothingEnabled?: boolean;
  hitCanvasPixelRatio?: number;
}

/**
 * Extended Konva node interface with performance optimization methods
 */
interface OptimizableNode extends Konva.Node {
  perfectDrawEnabled?: (enabled: boolean) => void;
  shadowForStrokeEnabled?: (enabled: boolean) => void;
  [key: string]: unknown;
}

/**
 * Performance optimization for shape caching with HiDPI support
 */
export class ShapeCaching {
  private static readonly DEFAULT_PIXEL_RATIO = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  private static readonly CACHE_SIZE_THRESHOLD = 2000; // Max dimension for cached shapes
  private static readonly cachedNodes = new WeakSet<Konva.Node>();

  /**
   * Apply optimized caching to a node with HiDPI support
   */
  static cacheNode(node: Konva.Node, config?: CacheConfig): void {
    // Skip if already cached
    if (this.cachedNodes.has(node)) {
      return;
    }

    // Don't cache if node is too large
    const rect = node.getClientRect();
    if (rect.width > this.CACHE_SIZE_THRESHOLD || rect.height > this.CACHE_SIZE_THRESHOLD) {
      // Node too large to cache
      return;
    }

    // Apply HiDPI-aware caching
    const cacheConfig: CacheConfig = {
      pixelRatio: this.DEFAULT_PIXEL_RATIO,
      imageSmoothingEnabled: true,
      ...config,
    };

    try {
      node.cache(cacheConfig);
      this.cachedNodes.add(node);

      // Apply performance optimizations
      if ('perfectDrawEnabled' in node) {
        (node as OptimizableNode).perfectDrawEnabled?.(false);
      }
      if ('shadowForStrokeEnabled' in node) {
        (node as OptimizableNode).shadowForStrokeEnabled?.(false);
      }
    } catch (error) {
      // Error: [ShapeCaching] Failed to cache node: ${error}
    }
  }

  /**
   * Clear cache for a node
   */
  static clearCache(node: Konva.Node): void {
    if (this.cachedNodes.has(node)) {
      node.clearCache();
      this.cachedNodes.delete(node);
    }
  }

  /**
   * Update cache for a node (clear and re-cache)
   */
  static updateCache(node: Konva.Node, config?: CacheConfig): void {
    this.clearCache(node);
    this.cacheNode(node, config);
  }

  /**
   * Cache complex shapes like sticky notes, tables, etc.
   */
  static cacheComplexShape(group: Konva.Group, config?: CacheConfig): void {
    // Calculate bounds for the group
    const children = group.getChildren();
    if (children.length === 0) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    children.forEach(child => {
      const rect = child.getClientRect();
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    // Only cache if within threshold
    if (width <= this.CACHE_SIZE_THRESHOLD && height <= this.CACHE_SIZE_THRESHOLD) {
      this.cacheNode(group, {
        x: minX,
        y: minY,
        width: width,
        height: height,
        ...config,
      });
    }
  }

  /**
   * Apply selective caching based on node type and complexity
   */
  static applySmartCaching(node: Konva.Node): void {
    // Don't cache simple shapes
    if (node instanceof Konva.Line || node instanceof Konva.Rect) {
      // Apply performance optimizations without caching
      if ('perfectDrawEnabled' in node) {
        (node as unknown as OptimizableNode).perfectDrawEnabled?.(false);
      }
      if ('shadowForStrokeEnabled' in node) {
        (node as unknown as OptimizableNode).shadowForStrokeEnabled?.(false);
      }
      return;
    }

    // Cache complex shapes
    if (node instanceof Konva.Group) {
      const childCount = node.getChildren().length;
      // Only cache groups with multiple children
      if (childCount > 3) {
        this.cacheComplexShape(node);
      }
    } else if (node instanceof Konva.Path || node instanceof Konva.TextPath) {
      // Always cache paths as they're expensive to render
      this.cacheNode(node);
    } else if (node instanceof Konva.Text) {
      // Cache text if it has effects
      const hasEffects = node.shadowEnabled() || node.stroke() || node.strokeWidth() > 0;
      if (hasEffects) {
        this.cacheNode(node);
      }
    }
  }

  /**
   * Batch cache multiple nodes
   */
  static batchCache(nodes: Konva.Node[], config?: CacheConfig): void {
    nodes.forEach(node => {
      this.cacheNode(node, config);
    });
  }

  /**
   * Clear all caches in a layer
   */
  static clearLayerCaches(layer: Konva.Layer): void {
    const children = layer.getChildren();
    children.forEach(child => {
      if (child.isCached()) {
        child.clearCache();
        this.cachedNodes.delete(child);
      }
    });
  }

  /**
   * Optimize node for performance without caching
   */
  static optimizeNode(node: Konva.Node): void {
    // Disable expensive features for better performance
    const optimizations = {
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      hitStrokeWidth: 0,
      listening: node.getLayer()?.listening() ?? true,
    };

    Object.entries(optimizations).forEach(([key, value]) => {
      if (key in node) {
        const method = (node as unknown as OptimizableNode)[key];
        if (typeof method === 'function') {
          method.call(node, value);
        }
      }
    });
  }

  /**
   * Check if caching would benefit performance for a node
   */
  static shouldCache(node: Konva.Node): boolean {
    // Don't cache if already cached
    if (node.isCached()) return false;

    // Don't cache nodes that are frequently updated
    if (node.name() === 'preview' || node.name() === 'cursor') return false;

    // Check complexity
    if (node instanceof Konva.Group) {
      return node.getChildren().length > 3;
    }

    // Cache complex shapes
    return (
      node instanceof Konva.Path ||
      node instanceof Konva.TextPath ||
      (node instanceof Konva.Text && (node.shadowEnabled() || !!node.stroke()))
    );
  }
}

/**
 * Auto-cache manager for automatic caching decisions
 */
export class AutoCacheManager {
  private readonly updateCounts = new WeakMap<Konva.Node, number>();
  private readonly updateThreshold = 10; // Updates before disabling cache

  /**
   * Track node update and manage caching
   */
  trackUpdate(node: Konva.Node): void {
    const count = (this.updateCounts.get(node) || 0) + 1;
    this.updateCounts.set(node, count);

    // Disable caching if node updates too frequently
    if (count > this.updateThreshold && node.isCached()) {
      ShapeCaching.clearCache(node);
      // Disabled cache for frequently updated node
    }
  }

  /**
   * Reset update count for a node
   */
  resetCount(node: Konva.Node): void {
    this.updateCounts.delete(node);
  }

  /**
   * Auto-manage caching for a layer
   */
  manageLater(layer: Konva.Layer): void {
    const children = layer.getChildren();
    children.forEach(child => {
      if (ShapeCaching.shouldCache(child) && !child.isCached()) {
        ShapeCaching.applySmartCaching(child);
      }
    });
  }
}

// Export singleton instance
export const autoCacheManager = new AutoCacheManager();