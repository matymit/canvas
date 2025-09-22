// Shape renderer module for rendering basic shapes (rectangle, circle, triangle)
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";
import { computeShapeInnerBox, type BaseShape } from "../../utils/text/computeShapeInnerBox";
import { getTextConfig } from "../../constants/TextConstants";


// Extended shape data interface
interface ShapeDataWithExtras {
  text?: string;
  padding?: number;
  radius?: number;
  textLineHeight?: number;
}

type Id = string;

// Safety limits to prevent extreme dimensions
const MAX_DIMENSION = 5000;
const MIN_DIMENSION = 1;

interface ShapeTextAttachment {
  text: Konva.Text;
  primaryNode: Konva.Group | Konva.Text;
  container?: Konva.Group;
}

interface ShapeElement {
  id: Id;
  type: "rectangle" | "circle" | "triangle" | "ellipse";
  x: number;
  y: number;
  width?: number;
  height?: number;
  style?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
  data?: {
    text?: string;
    padding?: number;
    radius?: number; // Circle radius stored in data
  };
  textColor?: string;
  rotation?: number;
}

export class ShapeRenderer implements RendererModule {
  private shapeNodes = new Map<Id, Konva.Shape>();
  private textNodes = new Map<Id, ShapeTextAttachment>(); // Track text nodes for shapes
  private layer?: Konva.Layer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    // Mounting ShapeRenderer
    this.layer = ctx.layers.main;

    // Subscribe to store changes - watch shape elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract shape elements
      (state) => {
        const shapes = new Map<Id, ShapeElement>();
        for (const [id, element] of state.elements.entries()) {
          if (
            element.type === "rectangle" ||
            element.type === "circle" ||
            element.type === "triangle" ||
            element.type === "ellipse"
          ) {
            shapes.set(id, element as ShapeElement);
          }
        }
        return shapes;
      },
      // Callback: reconcile changes
      (shapes) => this.reconcile(shapes),
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialShapes = new Map<Id, ShapeElement>();
    for (const [id, element] of initialState.elements.entries()) {
      if (
        element.type === "rectangle" ||
        element.type === "circle" ||
        element.type === "triangle" ||
        element.type === "ellipse"
      ) {
        initialShapes.set(id, element as ShapeElement);
      }
    }
    this.reconcile(initialShapes);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    // Unmounting ShapeRenderer
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    for (const node of this.shapeNodes.values()) {
      node.destroy();
    }
    this.shapeNodes.clear();

    // Clean up text nodes
    for (const attachment of this.textNodes.values()) {
      attachment.primaryNode.destroy();
    }
    this.textNodes.clear();

    if (this.layer) {
      this.layer.batchDraw();
    }
  }

  private reconcile(shapes: Map<Id, ShapeElement>) {
    // Only log when there are actual shapes to reconcile (reduce console spam)
    if (shapes.size > 0) {
      // Reconciling shape elements
    }

    if (!this.layer) return;

    const seen = new Set<Id>();

    // Add/update shape elements
    for (const [id, shape] of shapes) {
      seen.add(id);
      let node = this.shapeNodes.get(id);

      if (!node) {
        // Create new shape node
        node = this.createShapeNode(shape);
        if (node) {
          // Add click handler for selection
          node.on("click", (e) => {
            // Shape clicked for selection
            e.cancelBubble = true; // Prevent event bubbling

            // Select this shape element via the SelectionModule (preferred) or store
            this.selectElementViaStore(shape.id);
          });

          // Add tap handler for mobile
          node.on("tap", (e) => {
            // Shape tapped for selection
            e.cancelBubble = true;

            // Use the same selection logic as click
            this.selectElementViaStore(shape.id);
          });

          // Add double-click handler for text editing
          node.on("dblclick", (e) => {
            // Shape double-clicked for text editing
            e.cancelBubble = true; // Prevent event bubbling

            // Open text editor for this shape
            const stage = this.layer?.getStage();
            if (stage) {
              import('../../utils/editors/openShapeTextEditor').then(({ openShapeTextEditor }) => {
                openShapeTextEditor(stage, shape.id);
              });
            }
          });

          // Add dragend handler for position commit
          node.on("dragend", (e) => {
            const shapeNode = e.target as Konva.Shape;
            const nx = shapeNode.x();
            const ny = shapeNode.y();
            // Shape dragged to new position

            try {
              const store = useUnifiedCanvasStore.getState();
              if (store.element?.update) {
                store.element.update(shape.id, { x: nx, y: ny });
              } else if (store.updateElement) {
                store.updateElement(shape.id, { x: nx, y: ny }, { pushHistory: true });
              } else {
                // Error: No valid element update method found in store
              }
            } catch (error) {
              // Error: Error updating element position
            }
          });
          this.shapeNodes.set(id, node);
          this.layer.add(node);
        }
      } else {
        // Update existing shape node
        this.updateShapeNode(node, shape);
      }

      // Handle text rendering for shapes with text
      this.handleShapeText(shape, id);
    }

    // Remove deleted shape elements
    for (const [id, node] of this.shapeNodes) {
      if (!seen.has(id)) {
        // Removing shape
        node.destroy();
        this.shapeNodes.delete(id);
      }
    }

    // Remove deleted text nodes
    for (const [id, attachment] of this.textNodes) {
      if (!seen.has(id)) {
        // Removing shape text
        attachment.primaryNode.destroy();
        this.textNodes.delete(id);
      }
    }

    this.layer.batchDraw();
  }

  private createShapeNode(shape: ShapeElement): Konva.Shape | undefined {
    // Apply safety limits to dimensions
    const safeWidth = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, shape.width || 100));
    const safeHeight = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, shape.height || 100));

    const commonAttrs = {
      id: shape.id,
      x: shape.x,
      y: shape.y,
      fill: shape.style?.fill || "#E5E7EB",
      stroke: shape.style?.stroke || "#6B7280",
      strokeWidth: shape.style?.strokeWidth || 2,
      opacity: shape.style?.opacity || 1,
      rotation: shape.rotation || 0,
      listening: true,
      draggable: true, // enable dragging
    };

    switch (shape.type) {
      case "rectangle":
        return new Konva.Rect({
          ...commonAttrs,
          width: safeWidth,
          height: safeHeight,
        });

      case "circle": {
        const radiusX = safeWidth / 2;
        const radiusY = safeHeight / 2;

        // Creating circle node (ellipse-based)

        const ellipseNode = new Konva.Ellipse({
          ...commonAttrs,
          radiusX,
          radiusY,
        });

        ellipseNode.on('dragmove.text-follow', () => this.syncTextFollower(shape.id, ellipseNode));

        return ellipseNode;
      }

      case "ellipse": {
        const ellipseNode = new Konva.Ellipse({
          ...commonAttrs,
          radiusX: safeWidth / 2,
          radiusY: safeHeight / 2,
        });

        ellipseNode.on('dragmove.text-follow', () => this.syncTextFollower(shape.id, ellipseNode));

        return ellipseNode;
      }

      case "triangle": {
        // Create isosceles triangle using Shape with sceneFunc for proper geometry
        // This prevents deformation during resize and provides accurate bounds
        const triangleShape = new Konva.Shape({
          ...commonAttrs,
          width: safeWidth,
          height: safeHeight,
          sceneFunc: function(context, shape) {
            // Get current dimensions from the shape attributes
            const w = shape.width();
            const h = shape.height();

            // Draw isosceles triangle with proper geometry
            context.beginPath();
            context.moveTo(w / 2, 0);        // top center
            context.lineTo(0, h);            // bottom left
            context.lineTo(w, h);            // bottom right
            context.closePath();

            // Fill and stroke the shape
            context.fillStrokeShape(shape);
          }
        });

        triangleShape.on('dragmove.text-follow', () => this.syncTextFollower(shape.id, triangleShape));

        return triangleShape;
      }

      default:
        // Warning: Unknown shape type
        return undefined;
    }
  }

  private updateShapeNode(node: Konva.Shape, shape: ShapeElement) {
    // Apply safety limits to dimensions
    const safeWidth = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, shape.width || 100));
    const safeHeight = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, shape.height || 100));

    const commonAttrs = {
      x: shape.x,
      y: shape.y,
      fill: shape.style?.fill || "#E5E7EB",
      stroke: shape.style?.stroke || "#6B7280",
      strokeWidth: shape.style?.strokeWidth || 2,
      opacity: shape.style?.opacity || 1,
      rotation: shape.rotation || 0,
    };

    if (shape.type === "rectangle" && node instanceof Konva.Rect) {
      node.setAttrs({
        ...commonAttrs,
        width: safeWidth,
        height: safeHeight,
      });

      node.off('dragmove.text-follow');
      node.on('dragmove.text-follow', () => this.syncTextFollower(shape.id, node));
    } else if ((shape.type === "circle" || shape.type === "ellipse") && node instanceof Konva.Ellipse) {
      const radiusX = safeWidth / 2;
      const radiusY = safeHeight / 2;

      // Updating ellipse-based shape node

      node.setAttrs({
        ...commonAttrs,
        radiusX,
        radiusY,
      });

      node.off('dragmove.text-follow');
      node.on('dragmove.text-follow', () => this.syncTextFollower(shape.id, node));
    } else if (shape.type === "triangle" && node instanceof Konva.Shape) {
      // Update triangle dimensions - sceneFunc will automatically recalculate geometry
      node.setAttrs({
        ...commonAttrs,
        width: safeWidth,
        height: safeHeight,
      });

      node.off('dragmove.text-follow');
      node.on('dragmove.text-follow', () => this.syncTextFollower(shape.id, node));

      // The sceneFunc will automatically redraw with new dimensions
      // No need to manually recalculate points - this prevents deformation
    }
  }

  private selectElementViaStore(elementId: string) {
    try {
      // Attempting to select element

      // Direct store access with multiple fallbacks
      const store = useUnifiedCanvasStore.getState();
      // Checking available store methods

      if (store.replaceSelectionWithSingle) {
        // Using replaceSelectionWithSingle
        store.replaceSelectionWithSingle(elementId);
      } else if (store.setSelection) {
        // Using setSelection
        store.setSelection([elementId]);
      } else if (store.selection?.set) {
        // Using selection.set
        store.selection.set([elementId]);
      } else {
        // Error: No valid selection method found in store
        // Available store keys: check object keys
      }
    } catch (error) {
      // Error: Error during shape selection
    }
  }

  private handleShapeText(shape: ShapeElement, id: Id) {
    const hasText = shape.data?.text && shape.data.text.trim().length > 0;

    if (hasText) {
      // Shape has text - create or update text attachment
      let attachment = this.textNodes.get(id);

      if (!attachment) {
        // Create new text node for this shape
        attachment = this.createShapeTextAttachment(shape);
        if (attachment) {
          this.textNodes.set(id, attachment);
          this.layer?.add(attachment.primaryNode);
          // Created text node for shape
        }
      } else {
        // Update existing text node
        this.updateShapeTextAttachment(attachment, shape);
      }
    } else {
      // Shape has no text - remove text node if it exists
      const existingTextNode = this.textNodes.get(id);
      if (existingTextNode) {
        // Removing text node for shape (no text)
        existingTextNode.primaryNode.destroy();
        this.textNodes.delete(id);
      }
    }
  }

  private createShapeTextAttachment(shape: ShapeElement): ShapeTextAttachment | undefined {
    if (!shape.data?.text || !this.layer) return undefined;

    try {
      // Apply consistent text styling based on shape type
      const textConfig = getTextConfig(shape.type === 'circle' ? 'CIRCLE' : 'SHAPE');
      const fontSize = shape.style?.fontSize ?? textConfig.fontSize;
      const fontFamily = shape.style?.fontFamily || textConfig.fontFamily;
      const textColor = shape.textColor || '#111827';
      const padding = shape.data?.padding ?? (shape.type === 'circle' ? 0 : 8);
      const lineHeight = (shape.data as ShapeDataWithExtras)?.textLineHeight ?? 1.25;

      const innerBox = computeShapeInnerBox(shape as BaseShape, padding);
      const textNode = new Konva.Text({
        id: `${shape.id}-text`,
        name: `shape-text-${shape.id}`,
        x: innerBox.x,
        y: innerBox.y,
        width: innerBox.width,
        height: innerBox.height,
        text: shape.data.text,
        fontSize,
        fontFamily,
        fill: textColor,
        align: 'center',
        verticalAlign: 'middle',
        lineHeight,
        wrap: 'word',
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
      });

      textNode.setAttr('elementId', shape.id);
      textNode.setAttr('nodeType', 'shape-text');

      const primaryNode: Konva.Group | Konva.Text = textNode;

      const relativeDX = primaryNode.x() - shape.x;
      const relativeDY = primaryNode.y() - shape.y;
      primaryNode.setAttr('relativeDX', relativeDX);
      primaryNode.setAttr('relativeDY', relativeDY);
      primaryNode.setAttr('elementId', shape.id);
      primaryNode.setAttr('nodeType', 'shape-text-root');

      // Shape text node created

      return { text: textNode, primaryNode };
    } catch (error) {
      // Error: Error creating text node for shape
      return undefined;
    }
  }

  private updateShapeTextAttachment(attachment: ShapeTextAttachment, shape: ShapeElement) {
    if (!shape.data?.text) return;

    try {
      // Apply consistent text styling based on shape type
      const textConfig = getTextConfig(shape.type === 'circle' ? 'CIRCLE' : 'SHAPE');
      const fontSize = shape.style?.fontSize ?? textConfig.fontSize;
      const fontFamily = shape.style?.fontFamily || textConfig.fontFamily;
      const textColor = shape.textColor || '#111827';
      const padding = shape.data?.padding ?? (shape.type === 'circle' ? 0 : 8);
      const lineHeight = (shape.data as ShapeDataWithExtras)?.textLineHeight ?? 1.25;

      const innerBox = computeShapeInnerBox(shape as BaseShape, padding);
      const { text: textNode, primaryNode } = attachment;

      textNode.setAttrs({
        x: innerBox.x,
        y: innerBox.y,
        width: innerBox.width,
        height: innerBox.height,
        text: shape.data.text,
        fontSize,
        fontFamily,
        fill: textColor,
        align: 'center',
        verticalAlign: 'middle',
        lineHeight,
      });

      const relativeDX = primaryNode.x() - shape.x;
      const relativeDY = primaryNode.y() - shape.y;
      primaryNode.setAttr('relativeDX', relativeDX);
      primaryNode.setAttr('relativeDY', relativeDY);

      // Shape text node updated
    } catch (error) {
      // Error: Error updating text node for shape
    }
  }

  private syncTextFollower(id: Id, node: Konva.Shape) {
    const attachment = this.textNodes.get(id);
    if (!attachment) return;

    const dx = attachment.primaryNode.getAttr('relativeDX');
    const dy = attachment.primaryNode.getAttr('relativeDY');

    if (typeof dx !== 'number' || typeof dy !== 'number') return;

    attachment.primaryNode.position({ x: node.x() + dx, y: node.y() + dy });
    attachment.primaryNode.getLayer()?.batchDraw();
  }
}
