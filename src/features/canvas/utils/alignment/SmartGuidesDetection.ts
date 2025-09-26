export interface AlignmentGuide {
  axis: 'x' | 'y';
  value: number;
  source?: string;
  type: 'edge' | 'center' | 'grid';
}

export interface ElementBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX?: number;
  centerY?: number;
  right?: number;
  bottom?: number;
}

export interface SmartGuidesConfig {
  snapThreshold?: number;
  gridSize?: number;
  snapToGrid?: boolean;
  snapToElements?: boolean;
  showCenterGuides?: boolean;
  showEdgeGuides?: boolean;
}

/**
 * Smart guides detection for element alignment
 */
export class SmartGuidesDetection {
  private config: Required<SmartGuidesConfig>;
  private readonly elements: Map<string, ElementBounds> = new Map();

  constructor(config?: SmartGuidesConfig) {
    this.config = {
      snapThreshold: 5,
      gridSize: 20,
      snapToGrid: true,
      snapToElements: true,
      showCenterGuides: true,
      showEdgeGuides: true,
      ...config,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SmartGuidesConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Register elements for alignment detection
   */
  registerElements(elements: ElementBounds[]): void {
    this.elements.clear();
    elements.forEach(el => {
      // Calculate additional bounds
      const bounds: ElementBounds = {
        ...el,
        centerX: el.x + el.width / 2,
        centerY: el.y + el.height / 2,
        right: el.x + el.width,
        bottom: el.y + el.height,
      };
      this.elements.set(el.id, bounds);
    });
  }

  /**
   * Detect alignment guides for a moving element
   */
  detectGuides(
    movingElement: ElementBounds,
    excludeIds: string[] = []
  ): { guides: AlignmentGuide[]; snappedPosition: { x: number; y: number } } {
    const guides: AlignmentGuide[] = [];
    let snappedX = movingElement.x;
    let snappedY = movingElement.y;

    // Calculate moving element bounds
    const moving = {
      ...movingElement,
      centerX: movingElement.x + movingElement.width / 2,
      centerY: movingElement.y + movingElement.height / 2,
      right: movingElement.x + movingElement.width,
      bottom: movingElement.y + movingElement.height,
    };

    // Grid snapping (highest priority)
    if (this.config.snapToGrid) {
      const gridSnap = this.detectGridSnapping(moving);
      if (gridSnap.x !== null) {
        snappedX = gridSnap.x;
        guides.push({
          axis: 'x',
          value: snappedX,
          type: 'grid',
          source: 'grid',
        });
      }
      if (gridSnap.y !== null) {
        snappedY = gridSnap.y;
        guides.push({
          axis: 'y',
          value: snappedY,
          type: 'grid',
          source: 'grid',
        });
      }
    }

    // Element snapping
    if (this.config.snapToElements) {
      const elementGuides = this.detectElementAlignment(moving, excludeIds);

      // Process X-axis guides
      elementGuides
        .filter(g => g.axis === 'x')
        .forEach(guide => {
          const delta = guide.value - this.getAlignmentPoint(moving, guide);
          if (Math.abs(delta) < this.config.snapThreshold) {
            snappedX = movingElement.x + delta;
            guides.push(guide);
          }
        });

      // Process Y-axis guides
      elementGuides
        .filter(g => g.axis === 'y')
        .forEach(guide => {
          const delta = guide.value - this.getAlignmentPoint(moving, guide);
          if (Math.abs(delta) < this.config.snapThreshold) {
            snappedY = movingElement.y + delta;
            guides.push(guide);
          }
        });
    }

    return {
      guides: this.deduplicateGuides(guides),
      snappedPosition: { x: snappedX, y: snappedY },
    };
  }

  /**
   * Detect grid snapping
   */
  private detectGridSnapping(element: Required<ElementBounds>): { x: number | null; y: number | null } {
    const gridSize = this.config.gridSize;
    const threshold = this.config.snapThreshold;

    // Check multiple points for grid alignment
    const points = [
      { x: element.x, y: element.y }, // Top-left
      { x: element.centerX, y: element.centerY }, // Center
      { x: element.right, y: element.bottom }, // Bottom-right
    ];

    let snappedX: number | null = null;
    let snappedY: number | null = null;

    for (const point of points) {
      // X-axis grid snapping
      const gridX = Math.round(point.x / gridSize) * gridSize;
      if (Math.abs(point.x - gridX) < threshold) {
        snappedX = element.x - (point.x - gridX);
        break;
      }
    }

    for (const point of points) {
      // Y-axis grid snapping
      const gridY = Math.round(point.y / gridSize) * gridSize;
      if (Math.abs(point.y - gridY) < threshold) {
        snappedY = element.y - (point.y - gridY);
        break;
      }
    }

    return { x: snappedX, y: snappedY };
  }

  /**
   * Detect alignment with other elements
   */
  private detectElementAlignment(
    moving: Required<ElementBounds>,
    excludeIds: string[]
  ): AlignmentGuide[] {
    const guides: AlignmentGuide[] = [];

    this.elements.forEach((target, id) => {
      if (excludeIds.includes(id)) return;

      // Edge alignment
      if (this.config.showEdgeGuides) {
        // Left edge
        if (Math.abs(moving.x - target.x) < this.config.snapThreshold) {
          guides.push({ axis: 'x', value: target.x, type: 'edge', source: 'left' });
        }
        if (target.right !== undefined && Math.abs(moving.x - target.right) < this.config.snapThreshold) {
          guides.push({ axis: 'x', value: target.right, type: 'edge', source: 'right' });
        }

        // Right edge
        if (Math.abs(moving.right - target.x) < this.config.snapThreshold) {
          guides.push({ axis: 'x', value: target.x, type: 'edge', source: 'left' });
        }
        if (target.right !== undefined && Math.abs(moving.right - target.right) < this.config.snapThreshold) {
          guides.push({ axis: 'x', value: target.right, type: 'edge', source: 'right' });
        }

        // Top edge
        if (Math.abs(moving.y - target.y) < this.config.snapThreshold) {
          guides.push({ axis: 'y', value: target.y, type: 'edge', source: 'top' });
        }
        if (target.bottom !== undefined && Math.abs(moving.y - target.bottom) < this.config.snapThreshold) {
          guides.push({ axis: 'y', value: target.bottom, type: 'edge', source: 'bottom' });
        }

        // Bottom edge
        if (Math.abs(moving.bottom - target.y) < this.config.snapThreshold) {
          guides.push({ axis: 'y', value: target.y, type: 'edge', source: 'top' });
        }
        if (target.bottom !== undefined && Math.abs(moving.bottom - target.bottom) < this.config.snapThreshold) {
          guides.push({ axis: 'y', value: target.bottom, type: 'edge', source: 'bottom' });
        }
      }

      // Center alignment
      if (this.config.showCenterGuides) {
        // Horizontal center
        if (target.centerX !== undefined && Math.abs(moving.centerX - target.centerX) < this.config.snapThreshold) {
          guides.push({ axis: 'x', value: target.centerX, type: 'center', source: 'centerX' });
        }

        // Vertical center
        if (target.centerY !== undefined && Math.abs(moving.centerY - target.centerY) < this.config.snapThreshold) {
          guides.push({ axis: 'y', value: target.centerY, type: 'center', source: 'centerY' });
        }
      }
    });

    return guides;
  }

  /**
   * Get the alignment point for a guide
   */
  private getAlignmentPoint(element: Required<ElementBounds>, guide: AlignmentGuide): number {
    if (guide.axis === 'x') {
      switch (guide.source) {
        case 'left': return element.x;
        case 'right': return element.right;
        case 'centerX': return element.centerX;
        default: return element.x;
      }
    } else {
      switch (guide.source) {
        case 'top': return element.y;
        case 'bottom': return element.bottom;
        case 'centerY': return element.centerY;
        default: return element.y;
      }
    }
  }

  /**
   * Remove duplicate guides
   */
  private deduplicateGuides(guides: AlignmentGuide[]): AlignmentGuide[] {
    const seen = new Set<string>();
    return guides.filter(guide => {
      const key = `${guide.axis}-${guide.value}-${guide.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Clear registered elements
   */
  clear(): void {
    this.elements.clear();
  }

  /**
   * Get guide lines for rendering
   */
  getGuideLines(guides: AlignmentGuide[], stageBounds: { width: number; height: number }): Array<{
    points: number[];
    axis: 'x' | 'y';
    type: 'edge' | 'center' | 'grid';
  }> {
    return guides.map(guide => {
      if (guide.axis === 'x') {
        return {
          points: [guide.value, 0, guide.value, stageBounds.height],
          axis: 'x',
          type: guide.type,
        };
      } else {
        return {
          points: [0, guide.value, stageBounds.width, guide.value],
          axis: 'y',
          type: guide.type,
        };
      }
    });
  }
}

// Singleton instance
let instance: SmartGuidesDetection | null = null;

export function getSmartGuidesDetection(config?: SmartGuidesConfig): SmartGuidesDetection {
  if (!instance) {
    instance = new SmartGuidesDetection(config);
  } else if (config) {
    instance.updateConfig(config);
  }
  return instance;
}