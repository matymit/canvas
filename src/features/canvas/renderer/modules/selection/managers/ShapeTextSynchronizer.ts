// ShapeTextSynchronizer.ts
// Extracted from SelectionModule.ts lines 1813-1852
// Handles shape text synchronization during transforms

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";

export interface ShapeTextSynchronizer {
  syncTextDuringTransform(nodes: Konva.Node[]): void;
}

export class ShapeTextSynchronizerImpl implements ShapeTextSynchronizer {
  constructor() {
    this.syncTextDuringTransform = this.syncTextDuringTransform.bind(this);
  }

  // Extracted from SelectionModule.ts lines 1813-1852
  syncTextDuringTransform(nodes: Konva.Node[]): void {
    if (!nodes || nodes.length === 0) {
      return;
    }

    console.log("[ShapeTextSynchronizer] Syncing shape text during transform", {
      nodeCount: nodes.length
    });

    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;

    if (!elements) {
      console.warn("[ShapeTextSynchronizer] No elements available for text sync");
      return;
    }

    nodes.forEach((node, index) => {
      try {
        const elementId = node.getAttr("elementId") || node.id();
        const element = elements.get(elementId);
        
        if (!element) {
          return;
        }

        // Only sync text for elements that have text content
        if (!this.hasTextContent(element)) {
          return;
        }

        console.log(`[ShapeTextSynchronizer] Syncing text for element ${index}: ${elementId}`);

        // Get current node properties for text positioning
        const position = node.position();
        const size = node.size();
        const scale = node.scale();
        const rotation = node.rotation();

        // Calculate effective dimensions
        const effectiveWidth = size.width * Math.abs(scale.x);
        const effectiveHeight = size.height * Math.abs(scale.y);

        // Update text positioning based on shape type
        switch (element.type) {
          case "circle":
            this.syncCircleText(elementId, element, {
              x: position.x,
              y: position.y,
              width: effectiveWidth,
              height: effectiveHeight,
              rotation
            });
            break;

          case "rectangle":
          case "ellipse":
            this.syncRectangleText(elementId, element, {
              x: position.x,
              y: position.y,
              width: effectiveWidth,
              height: effectiveHeight,
              rotation
            });
            break;

          case "text":
            this.syncTextElement(elementId, element, {
              x: position.x,
              y: position.y,
              width: effectiveWidth,
              height: effectiveHeight,
              rotation
            });
            break;

          default:
            // Generic text sync for other element types
            this.syncGenericText(elementId, element, {
              x: position.x,
              y: position.y,
              width: effectiveWidth,
              height: effectiveHeight,
              rotation
            });
            break;
        }

      } catch (error) {
        console.error(`[ShapeTextSynchronizer] Error syncing text for node ${index}:`, error);
      }
    });

    console.log("[ShapeTextSynchronizer] Shape text synchronization completed");
  }

  private hasTextContent(element: any): boolean {
    return !!(element.text || element.content || element.label);
  }

  private syncCircleText(
    elementId: string,
    _element: any,
    transform: { x: number; y: number; width: number; height: number; rotation: number }
  ): void {
    // For circles, center the text and maintain circular constraints
    const radius = Math.min(transform.width, transform.height) / 2;
    const centerX = transform.x + radius;
    const centerY = transform.y + radius;

    const textPatch = {
      textX: centerX,
      textY: centerY,
      textWidth: radius * 1.6, // 80% of diameter for padding
      textHeight: radius * 1.6,
      textAlign: 'center',
      verticalAlign: 'middle'
    };

    this.updateElementText(elementId, textPatch);
  }

  private syncRectangleText(
    elementId: string,
    _element: any,
    transform: { x: number; y: number; width: number; height: number; rotation: number }
  ): void {
    // For rectangles, use the full bounds with padding
    const padding = 8;
    const textPatch = {
      textX: transform.x + padding,
      textY: transform.y + padding,
      textWidth: Math.max(0, transform.width - 2 * padding),
      textHeight: Math.max(0, transform.height - 2 * padding),
      textAlign: _element?.textAlign || 'left',
      verticalAlign: _element?.verticalAlign || 'top'
    };

    this.updateElementText(elementId, textPatch);
  }

  private syncTextElement(
    elementId: string,
    _element: any,
    transform: { x: number; y: number; width: number; height: number; rotation: number }
  ): void {
    // For text elements, update position and dimensions directly
    const textPatch = {
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      rotation: transform.rotation
    };

    this.updateElementText(elementId, textPatch);
  }

  private syncGenericText(
    elementId: string,
    _element: any,
    transform: { x: number; y: number; width: number; height: number; rotation: number }
  ): void {
    // Generic text sync with center alignment
    const textPatch = {
      textX: transform.x,
      textY: transform.y,
      textWidth: transform.width,
      textHeight: transform.height,
      textAlign: 'center',
      verticalAlign: 'middle'
    };

    this.updateElementText(elementId, textPatch);
  }

  private updateElementText(elementId: string, textPatch: any): void {
    const store = useUnifiedCanvasStore.getState();
    
    if (store.updateElement) {
      store.updateElement(elementId, textPatch, { pushHistory: false });
    }
  }
}

// Export singleton instance
export const shapeTextSynchronizer = new ShapeTextSynchronizerImpl();