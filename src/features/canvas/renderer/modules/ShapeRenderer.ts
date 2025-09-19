// Shape renderer module for rendering basic shapes (rectangle, circle, triangle)
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";
import { computeShapeInnerBox, computeCircleTextBox, measureTextHeight, type BaseShape } from "../../utils/text/computeShapeInnerBox";

type Id = string;

// Safety limits to prevent extreme dimensions
const MAX_DIMENSION = 5000;
const MIN_DIMENSION = 1;

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
  private textNodes = new Map<Id, Konva.Text>(); // Track text nodes for shapes
  private layer?: Konva.Layer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log("[ShapeRenderer] Mounting...");
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
    console.log("[ShapeRenderer] Unmounting...");
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    for (const node of this.shapeNodes.values()) {
      node.destroy();
    }
    this.shapeNodes.clear();

    // Clean up text nodes
    for (const textNode of this.textNodes.values()) {
      textNode.destroy();
    }
    this.textNodes.clear();

    if (this.layer) {
      this.layer.batchDraw();
    }
  }

  private reconcile(shapes: Map<Id, ShapeElement>) {
    // Only log when there are actual shapes to reconcile (reduce console spam)
    if (shapes.size > 0) {
      console.log("[ShapeRenderer] Reconciling", shapes.size, "shape elements");
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
            console.log('[ShapeRenderer] Shape clicked for selection:', shape.id);
            e.cancelBubble = true; // Prevent event bubbling

            // Select this shape element via the SelectionModule (preferred) or store
            this.selectElementViaStore(shape.id);
          });

          // Add tap handler for mobile
          node.on("tap", (e) => {
            console.log('[ShapeRenderer] Shape tapped for selection:', shape.id);
            e.cancelBubble = true;

            // Use the same selection logic as click
            this.selectElementViaStore(shape.id);
          });

          // Add double-click handler for text editing
          node.on("dblclick", (e) => {
            console.log('[ShapeRenderer] Shape double-clicked for text editing:', shape.id);
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
            console.log('[ShapeRenderer] Shape dragged to new position:', shape.id, nx, ny);

            try {
              const store = useUnifiedCanvasStore.getState();
              if (store.element?.update) {
                store.element.update(shape.id, { x: nx, y: ny });
              } else if (store.updateElement) {
                store.updateElement(shape.id, { x: nx, y: ny }, { pushHistory: true });
              } else {
                console.error('[ShapeRenderer] No valid element update method found in store');
              }
            } catch (error) {
              console.error('[ShapeRenderer] Error updating element position:', error);
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
        console.log("[ShapeRenderer] Removing shape:", id);
        node.destroy();
        this.shapeNodes.delete(id);
      }
    }

    // Remove deleted text nodes
    for (const [id, textNode] of this.textNodes) {
      if (!seen.has(id)) {
        console.log("[ShapeRenderer] Removing shape text:", id);
        textNode.destroy();
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
        // FIXED: Use radius from data property if available, otherwise calculate from dimensions
        let radius: number;
        if (shape.data?.radius !== undefined) {
          radius = Math.max(MIN_DIMENSION / 2, Math.min(MAX_DIMENSION / 2, shape.data.radius));
        } else {
          // Fallback to width/height calculation
          radius = Math.min(safeWidth, safeHeight) / 2;
        }

        console.log('[DEBUG] Creating circle node:', {
          elementId: shape.id,
          position: { x: shape.x, y: shape.y },
          radius: radius,
          dimensions: { width: shape.width, height: shape.height, dataRadius: shape.data?.radius },
          calculatedRadius: radius
        });

        return new Konva.Circle({
          ...commonAttrs,
          radius: radius, // Use proper radius for Konva.Circle
          // Note: Konva.Circle uses x,y as center point, which matches our element positioning
        });
      }

      case "ellipse":
        return new Konva.Ellipse({
          ...commonAttrs,
          radiusX: safeWidth / 2,
          radiusY: safeHeight / 2,
        });

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

        return triangleShape;
      }

      default:
        console.warn("[ShapeRenderer] Unknown shape type:", shape.type);
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
    } else if (shape.type === "circle" && node instanceof Konva.Circle) {
      // FIXED: Handle circle updates with proper radius calculation from data
      let radius: number;
      if (shape.data?.radius !== undefined) {
        radius = Math.max(MIN_DIMENSION / 2, Math.min(MAX_DIMENSION / 2, shape.data.radius));
      } else {
        // Fallback to width/height calculation
        radius = Math.min(safeWidth, safeHeight) / 2;
      }

      console.log('[DEBUG] Updating circle node:', {
        elementId: shape.id,
        position: { x: shape.x, y: shape.y },
        radius: radius,
        dimensions: { width: shape.width, height: shape.height, dataRadius: shape.data?.radius },
        calculatedRadius: radius
      });

      node.setAttrs({
        ...commonAttrs,
        radius: radius, // Use proper radius for Konva.Circle updates
      });
    } else if (shape.type === "ellipse" && node instanceof Konva.Ellipse) {
      node.setAttrs({
        ...commonAttrs,
        radiusX: safeWidth / 2,
        radiusY: safeHeight / 2,
      });
    } else if (shape.type === "triangle" && node instanceof Konva.Shape) {
      // Update triangle dimensions - sceneFunc will automatically recalculate geometry
      node.setAttrs({
        ...commonAttrs,
        width: safeWidth,
        height: safeHeight,
      });

      // The sceneFunc will automatically redraw with new dimensions
      // No need to manually recalculate points - this prevents deformation
    }
  }

  private selectElementViaStore(elementId: string) {
    try {
      console.log('[ShapeRenderer] Attempting to select element:', elementId);

      // Direct store access with multiple fallbacks
      const store = useUnifiedCanvasStore.getState();
      console.log('[ShapeRenderer] Available store methods:', {
        hasReplaceSelectionWithSingle: !!store.replaceSelectionWithSingle,
        hasSetSelection: !!store.setSelection,
        hasSelectionModule: !!store.selection,
        hasSelectionSet: !!store.selection?.set
      });

      if (store.replaceSelectionWithSingle) {
        console.log('[ShapeRenderer] Using replaceSelectionWithSingle:', elementId);
        store.replaceSelectionWithSingle(elementId);
      } else if (store.setSelection) {
        console.log('[ShapeRenderer] Using setSelection:', elementId);
        store.setSelection([elementId]);
      } else if (store.selection?.set) {
        console.log('[ShapeRenderer] Using selection.set:', elementId);
        store.selection.set([elementId]);
      } else {
        console.error('[ShapeRenderer] No valid selection method found in store');
        console.log('[ShapeRenderer] Available store keys:', Object.keys(store));
      }
    } catch (error) {
      console.error('[ShapeRenderer] Error during shape selection:', error);
    }
  }

  private handleShapeText(shape: ShapeElement, id: Id) {
    const hasText = shape.data?.text && shape.data.text.trim().length > 0;

    if (hasText) {
      // Shape has text - create or update text node
      let textNode = this.textNodes.get(id);

      if (!textNode) {
        // Create new text node for this shape
        textNode = this.createShapeTextNode(shape);
        if (textNode) {
          this.textNodes.set(id, textNode);
          this.layer?.add(textNode);
          console.log('[ShapeRenderer] Created text node for shape:', id, shape.data?.text);
        }
      } else {
        // Update existing text node
        this.updateShapeTextNode(textNode, shape);
      }
    } else {
      // Shape has no text - remove text node if it exists
      const existingTextNode = this.textNodes.get(id);
      if (existingTextNode) {
        console.log('[ShapeRenderer] Removing text node for shape (no text):', id);
        existingTextNode.destroy();
        this.textNodes.delete(id);
      }
    }
  }

  private createShapeTextNode(shape: ShapeElement): Konva.Text | undefined {
    if (!shape.data?.text || !this.layer) return undefined;

    try {
      // Get text styling from shape
      const fontSize = shape.style?.fontSize || 18;
      const fontFamily = shape.style?.fontFamily || 'Inter, system-ui, sans-serif';
      const textColor = shape.textColor || '#111827';

      // EXACT SPECIFICATION: Use precise geometry calculation
      let boxX: number, boxY: number, boxSize: number, measuredTextHeight: number;

      if (shape.type === 'circle') {
        // Get radius from data or fallback calculation
        let radius: number;
        if (shape.data?.radius !== undefined) {
          radius = shape.data.radius;
        } else if (shape.width && shape.height) {
          radius = Math.min(shape.width, shape.height) / 2;
        } else {
          radius = 50;
        }

        // Use EXACT computeCircleTextBox function as specified
        const textBox = computeCircleTextBox({ x: shape.x, y: shape.y, radius });
        boxX = textBox.x;
        boxY = textBox.y;
        boxSize = textBox.size;

        // Measure text height using the exact function
        measuredTextHeight = measureTextHeight(shape.data.text, {
          fontSize,
          fontFamily,
          width: boxSize,
          lineHeight: 1.2
        });

        console.log('[DEBUG] Circle text EXACT SPECIFICATION (renderer):', {
          elementId: shape.id,
          elementPosition: { x: shape.x, y: shape.y },
          calculatedRadius: radius,
          exactTextBox: textBox,
          measuredTextHeight,
          finalCoords: { boxX, boxY, boxSize }
        });
      } else {
        // For non-circles, use existing calculation
        const innerBox = computeShapeInnerBox(shape as BaseShape, shape.data.padding || 8);
        boxX = innerBox.x;
        boxY = innerBox.y;
        boxSize = Math.min(innerBox.width, innerBox.height);

        measuredTextHeight = measureTextHeight(shape.data.text, {
          fontSize,
          fontFamily,
          width: boxSize,
          lineHeight: 1.2
        });
      }

      // EXACT SPECIFICATION: Create Konva.Text using the exact positioning formula
      const textNode = new Konva.Text({
        id: `${shape.id}-text`,
        name: `shape-text-${shape.id}`,
        x: boxX,
        y: boxY + (boxSize - measuredTextHeight) / 2, // EXACT formula as specified
        width: boxSize,
        height: boxSize,
        text: shape.data.text,
        fontSize,
        fontFamily,
        fill: textColor,
        align: 'center', // EXACT specification
        lineHeight: 1.2,
        wrap: 'word',
        listening: false, // Text should not interfere with shape interactions
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
      });

      // Set element ID for debugging/selection
      textNode.setAttr('elementId', shape.id);
      textNode.setAttr('nodeType', 'shape-text');

      console.log('[DEBUG] EXACT SPECIFICATION Konva.Text created:', {
        elementId: shape.id,
        textNodePosition: { x: textNode.x(), y: textNode.y() },
        textNodeSize: { width: textNode.width(), height: textNode.height() },
        boxCoords: { boxX, boxY, boxSize },
        measuredTextHeight,
        verticalOffset: (boxSize - measuredTextHeight) / 2,
        text: shape.data.text
      });

      return textNode;
    } catch (error) {
      console.error('[ShapeRenderer] Error creating text node for shape:', shape.id, error);
      return undefined;
    }
  }

  private updateShapeTextNode(textNode: Konva.Text, shape: ShapeElement) {
    if (!shape.data?.text) return;

    try {
      // Get updated text styling
      const fontSize = shape.style?.fontSize || 18;
      const fontFamily = shape.style?.fontFamily || 'Inter, system-ui, sans-serif';
      const textColor = shape.textColor || '#111827';

      // EXACT SPECIFICATION: Recalculate using precise geometry
      let boxX: number, boxY: number, boxSize: number, measuredTextHeight: number;

      if (shape.type === 'circle') {
        // Get radius from data or fallback calculation
        let radius: number;
        if (shape.data?.radius !== undefined) {
          radius = shape.data.radius;
        } else if (shape.width && shape.height) {
          radius = Math.min(shape.width, shape.height) / 2;
        } else {
          radius = 50;
        }

        // Use EXACT computeCircleTextBox function as specified
        const textBox = computeCircleTextBox({ x: shape.x, y: shape.y, radius });
        boxX = textBox.x;
        boxY = textBox.y;
        boxSize = textBox.size;

        // Measure text height using the exact function
        measuredTextHeight = measureTextHeight(shape.data.text, {
          fontSize,
          fontFamily,
          width: boxSize,
          lineHeight: 1.2
        });

        console.log('[DEBUG] Circle text EXACT SPECIFICATION update (renderer):', {
          elementId: shape.id,
          elementPosition: { x: shape.x, y: shape.y },
          calculatedRadius: radius,
          exactTextBox: textBox,
          measuredTextHeight,
          finalCoords: { boxX, boxY, boxSize }
        });
      } else {
        // For non-circles, use existing calculation
        const innerBox = computeShapeInnerBox(shape as BaseShape, shape.data.padding || 8);
        boxX = innerBox.x;
        boxY = innerBox.y;
        boxSize = Math.min(innerBox.width, innerBox.height);

        measuredTextHeight = measureTextHeight(shape.data.text, {
          fontSize,
          fontFamily,
          width: boxSize,
          lineHeight: 1.2
        });
      }

      // EXACT SPECIFICATION: Update using the exact positioning formula
      textNode.setAttrs({
        x: boxX,
        y: boxY + (boxSize - measuredTextHeight) / 2, // EXACT formula as specified
        width: boxSize,
        height: boxSize,
        text: shape.data.text,
        fontSize,
        fontFamily,
        fill: textColor,
        align: 'center', // EXACT specification
        lineHeight: 1.2,
      });

      console.log('[DEBUG] EXACT SPECIFICATION Konva.Text updated:', {
        elementId: shape.id,
        textNodePosition: { x: textNode.x(), y: textNode.y() },
        textNodeSize: { width: textNode.width(), height: textNode.height() },
        boxCoords: { boxX, boxY, boxSize },
        measuredTextHeight,
        verticalOffset: (boxSize - measuredTextHeight) / 2,
        text: shape.data.text,
        stagePosition: this.layer?.getStage()?.position(),
        stageScale: this.layer?.getStage()?.scaleX()
      });
    } catch (error) {
      console.error('[ShapeRenderer] Error updating text node for shape:', shape.id, error);
    }
  }
}