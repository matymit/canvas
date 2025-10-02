// ShapeTextSynchronizer.ts
// Extracted from SelectionModule.ts lines 1813-1852
// Handles shape text synchronization during transforms

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import { debug, error, warn } from "../../../../../../utils/debug";
import type { CanvasElement } from "../../../../../../../types";

const LOG_CATEGORY = "selection/shape-text";

export interface ShapeTextSynchronizer {
  syncTextDuringTransform(nodes: Konva.Node[]): void;
}

type ShapeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type TextAlignment = "left" | "center" | "right";
type VerticalAlignment = "top" | "middle" | "bottom";

type ElementDataWithText = Record<string, unknown> & {
  text?: string;
  textLineHeight?: number;
  textAlign?: TextAlignment;
  verticalAlign?: VerticalAlignment;
};

interface TextBearingElement extends CanvasElement {
  text?: string;
  content?: string;
  label?: string;
  textX?: number;
  textY?: number;
  textWidth?: number;
  textHeight?: number;
  textAlign?: TextAlignment;
  verticalAlign?: VerticalAlignment;
  data?: ElementDataWithText;
}

type ShapeTextPatch = Partial<TextBearingElement>;

export class ShapeTextSynchronizerImpl implements ShapeTextSynchronizer {
  constructor() {
    this.syncTextDuringTransform = this.syncTextDuringTransform.bind(this);
  }

  // Extracted from SelectionModule.ts lines 1813-1852
  syncTextDuringTransform(nodes: Konva.Node[]): void {
    if (!nodes || nodes.length === 0) {
      return;
    }

    debug("ShapeTextSynchronizer: syncing shape text during transform", {
      category: LOG_CATEGORY,
      data: { nodeCount: nodes.length },
    });

    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;

    if (!elements) {
      warn("ShapeTextSynchronizer: no elements available for text sync", {
        category: LOG_CATEGORY,
      });
      return;
    }

    nodes.forEach((node, index) => {
      try {
        const elementIdAttr = node.getAttr("elementId");
        const elementId =
          typeof elementIdAttr === "string" && elementIdAttr.length > 0
            ? elementIdAttr
            : node.id();
        const element = elements.get(elementId);
        
        if (!element) {
          return;
        }

        // Only sync text for elements that have text content
        if (!this.hasTextContent(element)) {
          return;
        }

        const textElement = element;

        debug("ShapeTextSynchronizer: syncing text for element", {
          category: LOG_CATEGORY,
          data: { index, elementId, elementType: textElement.type },
        });

        // Get current node properties for text positioning
        const position = node.position();
        const size = node.size();
        const scale = node.scale();
        const rotation = node.rotation();

        // Calculate effective dimensions
        const transform: ShapeTransform = {
          x: position.x,
          y: position.y,
          width: size.width * Math.abs(scale.x),
          height: size.height * Math.abs(scale.y),
          rotation,
        };

        // Update text positioning based on shape type
        switch (textElement.type) {
          case "circle":
            this.syncCircleText(elementId, textElement, transform);
            break;

          case "rectangle":
          case "ellipse":
            this.syncRectangleText(elementId, textElement, transform);
            break;

          case "text":
            this.syncTextElement(elementId, textElement, transform);
            break;

          default:
            // Generic text sync for other element types
            this.syncGenericText(elementId, textElement, transform);
            break;
        }

      } catch (caughtError) {
        error("ShapeTextSynchronizer: error syncing text for node", {
          category: LOG_CATEGORY,
          data: { nodeIndex: index, error: caughtError },
        });
      }
    });

    debug("ShapeTextSynchronizer: synchronization completed", {
      category: LOG_CATEGORY,
      data: { processedNodes: nodes.length },
    });
  }

  private hasTextContent(element: CanvasElement): element is TextBearingElement {
    const candidate = element as TextBearingElement;
    return Boolean(candidate.text || candidate.content || candidate.label);
  }

  private syncCircleText(
    elementId: string,
    _element: TextBearingElement,
    transform: ShapeTransform
  ): void {
    // For circles, center the text and maintain circular constraints
    const radius = Math.min(transform.width, transform.height) / 2;
    const centerX = transform.x + radius;
    const centerY = transform.y + radius;

    const textPatch: ShapeTextPatch = {
      textX: centerX,
      textY: centerY,
      textWidth: radius * 1.6, // 80% of diameter for padding
      textHeight: radius * 1.6,
      textAlign: "center",
      verticalAlign: "middle",
    };

    this.updateElementText(elementId, textPatch);
  }

  private syncRectangleText(
    elementId: string,
    element: TextBearingElement,
    transform: ShapeTransform
  ): void {
    // For rectangles, use the full bounds with padding
    const padding = 8;
    const textAlign: TextAlignment = element?.textAlign ?? "left";
    const verticalAlign: VerticalAlignment = element?.verticalAlign ?? "top";

    const textPatch: ShapeTextPatch = {
      textX: transform.x + padding,
      textY: transform.y + padding,
      textWidth: Math.max(0, transform.width - 2 * padding),
      textHeight: Math.max(0, transform.height - 2 * padding),
      textAlign,
      verticalAlign,
    };

    this.updateElementText(elementId, textPatch);
  }

  private syncTextElement(
    elementId: string,
    _element: TextBearingElement,
    transform: ShapeTransform
  ): void {
    // For text elements, update position and dimensions directly
    const textPatch: ShapeTextPatch = {
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      rotation: transform.rotation,
    };

    this.updateElementText(elementId, textPatch);
  }

  private syncGenericText(
    elementId: string,
    _element: TextBearingElement,
    transform: ShapeTransform
  ): void {
    // Generic text sync with center alignment
    const centerAlign: TextAlignment = "center";
    const middleAlign: VerticalAlignment = "middle";

    const textPatch: ShapeTextPatch = {
      textX: transform.x,
      textY: transform.y,
      textWidth: transform.width,
      textHeight: transform.height,
      textAlign: centerAlign,
      verticalAlign: middleAlign,
    };

    this.updateElementText(elementId, textPatch);
  }

  private updateElementText(elementId: string, textPatch: ShapeTextPatch): void {
    const store = useUnifiedCanvasStore.getState();
    
    if (store.updateElement) {
      store.updateElement(elementId, textPatch, { pushHistory: false });
    }
  }
}

// Export singleton instance
export const shapeTextSynchronizer = new ShapeTextSynchronizerImpl();