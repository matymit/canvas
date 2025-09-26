import type Konva from 'konva';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Performance optimization utility for viewport culling
 * Only renders elements visible in the current viewport
 */
export class ViewportCulling {
  private viewportBounds: ViewportBounds = { x: 0, y: 0, width: 0, height: 0 };
  private padding = 100; // Extra padding around viewport for smoother scrolling

  /**
   * Update viewport bounds based on stage position and size
   */
  updateViewport(stage: Konva.Stage): void {
    const scale = stage.scaleX(); // Assuming uniform scaling
    const stagePos = stage.position();
    const stageSize = stage.size();

    // Calculate visible viewport in world coordinates
    this.viewportBounds = {
      x: -stagePos.x / scale - this.padding,
      y: -stagePos.y / scale - this.padding,
      width: (stageSize.width / scale) + (this.padding * 2),
      height: (stageSize.height / scale) + (this.padding * 2),
    };
  }

  /**
   * Check if an element is within the viewport
   */
  isInViewport(bounds: BoundingBox): boolean {
    // Simple AABB collision check (doesn't account for rotation)
    if (bounds.rotation && bounds.rotation !== 0) {
      // For rotated elements, use a larger bounding box
      return this.isRotatedInViewport(bounds);
    }

    return !(
      bounds.x + bounds.width < this.viewportBounds.x ||
      bounds.x > this.viewportBounds.x + this.viewportBounds.width ||
      bounds.y + bounds.height < this.viewportBounds.y ||
      bounds.y > this.viewportBounds.y + this.viewportBounds.height
    );
  }

  /**
   * Check if a rotated element is within the viewport
   * Uses a conservative approach with enlarged bounding box
   */
  private isRotatedInViewport(bounds: BoundingBox): boolean {
    // Calculate diagonal for conservative bounds
    const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Use diagonal as both width and height for conservative check
    return !(
      centerX + diagonal / 2 < this.viewportBounds.x ||
      centerX - diagonal / 2 > this.viewportBounds.x + this.viewportBounds.width ||
      centerY + diagonal / 2 < this.viewportBounds.y ||
      centerY - diagonal / 2 > this.viewportBounds.y + this.viewportBounds.height
    );
  }

  /**
   * Filter elements to only those visible in viewport
   */
  filterVisible<T extends BoundingBox>(elements: T[]): T[] {
    return elements.filter(element => this.isInViewport(element));
  }

  /**
   * Get current viewport bounds
   */
  getViewportBounds(): ViewportBounds {
    return { ...this.viewportBounds };
  }

  /**
   * Set padding around viewport
   */
  setPadding(padding: number): void {
    this.padding = padding;
  }

  /**
   * Batch check multiple elements and return visible indices
   */
  getVisibleIndices(elements: BoundingBox[]): number[] {
    const indices: number[] = [];
    for (let i = 0; i < elements.length; i++) {
      if (this.isInViewport(elements[i])) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * Check if viewport has changed significantly
   */
  hasViewportChanged(newBounds: ViewportBounds, threshold = 10): boolean {
    return (
      Math.abs(newBounds.x - this.viewportBounds.x) > threshold ||
      Math.abs(newBounds.y - this.viewportBounds.y) > threshold ||
      Math.abs(newBounds.width - this.viewportBounds.width) > threshold ||
      Math.abs(newBounds.height - this.viewportBounds.height) > threshold
    );
  }
}

// Singleton instance for global viewport culling
let instance: ViewportCulling | null = null;

export function getViewportCulling(): ViewportCulling {
  if (!instance) {
    instance = new ViewportCulling();
  }
  return instance;
}

/**
 * Apply viewport culling to Konva nodes
 */
export function cullNodes(stage: Konva.Stage, nodes: Konva.Node[]): Konva.Node[] {
  const culling = getViewportCulling();
  culling.updateViewport(stage);

  return nodes.filter(node => {
    const box = node.getClientRect();
    return culling.isInViewport({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: node.rotation(),
    });
  });
}

/**
 * Optimized node visibility management
 * Hides nodes outside viewport to improve performance
 */
export function manageNodeVisibility(stage: Konva.Stage, layer: Konva.Layer): void {
  const culling = getViewportCulling();
  culling.updateViewport(stage);

  const children = layer.getChildren();
  let visibilityChanged = false;

  children.forEach(node => {
    const box = node.getClientRect();
    const isVisible = culling.isInViewport({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: node.rotation(),
    });

    if (node.visible() !== isVisible) {
      node.visible(isVisible);
      visibilityChanged = true;
    }
  });

  if (visibilityChanged) {
    layer.batchDraw();
  }
}