// EraserTool.ts
// Implements an eraser tool that removes elements when dragged over them

import Konva from 'konva';
import type { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import type { ElementId } from '../../../../types';

export interface EraserToolOptions {
  size?: number;
  cursor?: string;
  previewColor?: string;
  previewOpacity?: number;
  intersectionThreshold?: number;
}

interface Point {
  x: number;
  y: number;
}

export class EraserTool {
  private readonly stage: Konva.Stage;
  private readonly previewLayer: Konva.Layer;
  private readonly store: typeof useUnifiedCanvasStore;
  private readonly options: Required<EraserToolOptions>;
  
  // Tool state
  private isActive = false;
  private isErasing = false;
  private eraserPath: Point[] = [];
  private previewCircle?: Konva.Circle;
  private readonly elementsToErase = new Set<ElementId>();
  
  // Event cleanup functions
  private cleanupFunctions: (() => void)[] = [];

  constructor(
    stage: Konva.Stage,
    previewLayer: Konva.Layer,
    store: typeof useUnifiedCanvasStore,
    options: EraserToolOptions = {}
  ) {
    this.stage = stage;
    this.previewLayer = previewLayer;
    this.store = store;
    
    this.options = {
      size: options.size ?? 20,
      cursor: options.cursor ?? 'crosshair',
      previewColor: options.previewColor ?? '#FF4444',
      previewOpacity: options.previewOpacity ?? 0.3,
      intersectionThreshold: options.intersectionThreshold ?? 0.1
    };
  }

  /**
   * Activate the eraser tool
   */
  activate(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Set cursor
    this.stage.container().style.cursor = this.options.cursor;
    
    // Create preview circle
    this.createPreviewCircle();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Deactivate the eraser tool
   */
  deactivate(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Reset cursor
    this.stage.container().style.cursor = 'default';
    
    // Clean up preview
    this.destroyPreviewCircle();
    
    // Clean up event listeners
    this.cleanup();
    
    // Reset state
    this.resetState();
  }

  /**
   * Update eraser size
   */
  setSize(size: number): void {
    this.options.size = size;
    if (this.previewCircle) {
      this.previewCircle.radius(size / 2);
      this.previewLayer.batchDraw();
    }
  }

  /**
   * Get current eraser size
   */
  getSize(): number {
    return this.options.size;
  }

  /**
   * Check if tool is currently active
   */
  isToolActive(): boolean {
    return this.isActive;
  }

  private createPreviewCircle(): void {
    this.previewCircle = new Konva.Circle({
      radius: this.options.size / 2,
      fill: this.options.previewColor,
      opacity: this.options.previewOpacity,
      listening: false,
      visible: false,
      name: 'eraser-preview'
    });
    
    this.previewLayer.add(this.previewCircle);
  }

  private destroyPreviewCircle(): void {
    if (this.previewCircle) {
      this.previewCircle.destroy();
      this.previewCircle = undefined;
      this.previewLayer.batchDraw();
    }
  }

  private setupEventListeners(): void {
    // Mouse/touch move for preview
    const onPointerMove = (_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!this.isActive || !this.previewCircle) return;
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      this.previewCircle.position(pos);
      this.previewCircle.visible(true);
      
      // If erasing, check for intersections
      if (this.isErasing) {
        this.eraserPath.push(pos);
        this.checkIntersections();
        this.highlightIntersectedElements();
      }
      
      this.previewLayer.batchDraw();
    };

    // Mouse/touch down to start erasing
    const onPointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!this.isActive) return;
      
      // Prevent event propagation to avoid selection
      e.evt.preventDefault();
      e.evt.stopPropagation();
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;
      
      this.startErasing(pos);
    };

    // Mouse/touch up to finish erasing
    const onPointerUp = () => {
      if (!this.isActive || !this.isErasing) return;
      
      this.finishErasing();
    };

    // Mouse leave to hide preview
    const onMouseLeave = () => {
      if (this.previewCircle) {
        this.previewCircle.visible(false);
        this.previewLayer.batchDraw();
      }
      
      // If we were erasing and mouse leaves, finish erasing
      if (this.isErasing) {
        this.finishErasing();
      }
    };

    // Setup event listeners
    this.stage.on('mousemove.eraser touchmove.eraser', onPointerMove);
    this.stage.on('mousedown.eraser touchstart.eraser', onPointerDown);
    this.stage.on('mouseup.eraser touchend.eraser', onPointerUp);
    this.stage.on('mouseleave.eraser', onMouseLeave);
    
    // Also listen for global mouse up in case mouse goes outside stage
    const onGlobalPointerUp = () => {
      if (this.isErasing) {
        this.finishErasing();
      }
    };
    
    document.addEventListener('mouseup', onGlobalPointerUp);
    document.addEventListener('touchend', onGlobalPointerUp);
    
    // Store cleanup functions
    this.cleanupFunctions.push(
      () => {
        this.stage.off('mousemove.eraser touchmove.eraser');
        this.stage.off('mousedown.eraser touchstart.eraser');
        this.stage.off('mouseup.eraser touchend.eraser');
        this.stage.off('mouseleave.eraser');
        document.removeEventListener('mouseup', onGlobalPointerUp);
        document.removeEventListener('touchend', onGlobalPointerUp);
      }
    );
  }

  private startErasing(startPos: Point): void {
    this.isErasing = true;
    this.eraserPath = [startPos];
    this.elementsToErase.clear();
    
    // Change preview to indicate active erasing
    if (this.previewCircle) {
      this.previewCircle.opacity(this.options.previewOpacity * 1.5);
      this.previewLayer.batchDraw();
    }
    
    // Check initial intersection
    this.checkIntersections();
    this.highlightIntersectedElements();
  }

  private finishErasing(): void {
    if (!this.isErasing) return;
    
    // Execute the deletion with undo support
    if (this.elementsToErase.size > 0) {
      this.executeErasure();
    }
    
    // Reset state
    this.isErasing = false;
    this.eraserPath = [];
    this.elementsToErase.clear();
    
    // Reset preview appearance
    if (this.previewCircle) {
      this.previewCircle.opacity(this.options.previewOpacity);
      this.previewLayer.batchDraw();
    }
    
    // Clear any element highlighting
    this.clearElementHighlighting();
  }

  private checkIntersections(): void {
    if (this.eraserPath.length === 0) return;
    
    const state = this.store.getState();
    const elements = state.elements;
    
    if (!elements) return;
    
    // Get current eraser position
    const currentPos = this.eraserPath[this.eraserPath.length - 1];
    const eraserRadius = this.options.size / 2;
    
    // Check each element for intersection
    for (const [elementId] of elements) {
      if (this.elementsToErase.has(elementId)) continue;
      
      // Find the Konva node for this element
      const node = this.findElementNode(elementId);
      if (!node) continue;
      
      // Check if eraser intersects with element
      if (this.doesEraserIntersectElement(currentPos, eraserRadius, node)) {
        this.elementsToErase.add(elementId);
      }
    }
  }

  private doesEraserIntersectElement(
    eraserPos: Point,
    eraserRadius: number,
    node: Konva.Node
  ): boolean {
    try {
      // Get element bounding box
      const rect = node.getClientRect({ skipTransform: false });
      
      // Check if eraser circle intersects with element rectangle
      return this.circleIntersectsRect(
        eraserPos,
        eraserRadius,
        {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }
      );
    } catch (error) {
      return false;
    }
  }

  private circleIntersectsRect(
    circlePos: Point,
    radius: number,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    // Find the closest point on the rectangle to the circle center
    const closestX = Math.max(rect.x, Math.min(circlePos.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circlePos.y, rect.y + rect.height));
    
    // Calculate distance from circle center to closest point
    const distanceX = circlePos.x - closestX;
    const distanceY = circlePos.y - closestY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;
    
    // Check if distance is less than radius
    return distanceSquared <= radius * radius;
  }

  private findElementNode(elementId: ElementId): Konva.Node | null {
    // Search in main layer for element nodes
    const layers = this.stage.getLayers();
    
    for (const layer of layers) {
      if (layer.name() === 'overlay' || layer.name() === 'preview') continue;
      
      const candidates = layer.find((node: Konva.Node) => {
        const nodeElementId = node.getAttr('elementId') || node.id();
        return nodeElementId === elementId;
      });
      
      if (candidates.length > 0) {
        // Prefer groups over individual shapes
        const group = candidates.find(n => 
          n.className === 'Group' || 
          n.name().includes('group')
        );
        return group || candidates[0];
      }
    }
    
    return null;
  }

  private highlightIntersectedElements(): void {
    // Add visual feedback for elements about to be erased
    for (const elementId of this.elementsToErase) {
      const node = this.findElementNode(elementId);
      if (node) {
        // Add red tint to indicate pending erasure
        node.filters([Konva.Filters.RGB]);
        node.red(255);
        node.green(100);
        node.blue(100);
        node.cache();
      }
    }
    
    // Redraw affected layers
    this.stage.getLayers().forEach(layer => {
      if (layer.name() !== 'overlay' && layer.name() !== 'preview') {
        layer.batchDraw();
      }
    });
  }

  private clearElementHighlighting(): void {
    // Remove highlighting from all elements
    const layers = this.stage.getLayers();
    
    for (const layer of layers) {
      if (layer.name() === 'overlay' || layer.name() === 'preview') continue;
      
      layer.getChildren().forEach((node: Konva.Node) => {
        if (node.filters().length > 0) {
          node.filters([]);
          node.clearCache();
        }
      });
      
      layer.batchDraw();
    }
  }

  private executeErasure(): void {
    const state = this.store.getState();
    const elementsToDelete = Array.from(this.elementsToErase);
    
    if (elementsToDelete.length === 0) return;
    
    // Execute deletion with undo support
    const actionName = elementsToDelete.length === 1 
      ? 'Erase element'
      : `Erase ${elementsToDelete.length} elements`;
    
    if (state.withUndo) {
      state.withUndo(actionName, () => {
        for (const elementId of elementsToDelete) {
          try {
            state.element?.delete?.(elementId);
          } catch (error) {
            // Ignore error
          }
        }
      });
    } else {
      // Fallback if withUndo is not available
      for (const elementId of elementsToDelete) {
        try {
          state.element?.delete?.(elementId);
        } catch (error) {
          // Ignore error
        }
      }
    }
  }

  private resetState(): void {
    this.isErasing = false;
    this.eraserPath = [];
    this.elementsToErase.clear();
    this.clearElementHighlighting();
  }

  private cleanup(): void {
    this.cleanupFunctions.forEach(fn => fn());
    this.cleanupFunctions = [];
  }

  /**
   * Destroy the eraser tool and clean up all resources
   */
  destroy(): void {
    this.deactivate();
    this.cleanup();
  }
}
