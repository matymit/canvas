// Shape renderer module for rendering basic shapes (rectangle, circle, triangle)
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";

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
  radius?: number;
  style?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  };
  rotation?: number;
}

export class ShapeRenderer implements RendererModule {
  private shapeNodes = new Map<Id, Konva.Shape>();
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
    }

    // Remove deleted shape elements
    for (const [id, node] of this.shapeNodes) {
      if (!seen.has(id)) {
        console.log("[ShapeRenderer] Removing shape:", id);
        node.destroy();
        this.shapeNodes.delete(id);
      }
    }

    this.layer.batchDraw();
  }

  private createShapeNode(shape: ShapeElement): Konva.Shape | undefined {
    // Apply safety limits to dimensions
    const safeWidth = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, shape.width || 100));
    const safeHeight = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, shape.height || 100));
    const safeRadius = Math.max(MIN_DIMENSION / 2, Math.min(MAX_DIMENSION / 2, shape.radius || safeWidth / 2));

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

      case "circle":
        return new Konva.Circle({
          ...commonAttrs,
          radius: safeRadius,
        });

      case "ellipse":
        return new Konva.Ellipse({
          ...commonAttrs,
          radiusX: safeWidth / 2,
          radiusY: safeHeight / 2,
        });

      case "triangle": {
        // Create isosceles triangle using Line with proper transformer compatibility
        const points = [
          safeWidth / 2, 0,           // top center
          0, safeHeight,              // bottom left
          safeWidth, safeHeight       // bottom right
        ];
        const line = new Konva.Line({
          ...commonAttrs,
          points,
          closed: true,
          // Add proper width/height for transformer compatibility
          width: safeWidth,
          height: safeHeight,
        });

        // Override getBBox to provide proper bounds for transformer
        (line as any).getBBox = function() {
          return {
            x: 0,
            y: 0,
            width: safeWidth,
            height: safeHeight
          };
        };

        return line;
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
    const safeRadius = Math.max(MIN_DIMENSION / 2, Math.min(MAX_DIMENSION / 2, shape.radius || safeWidth / 2));

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
      node.setAttrs({
        ...commonAttrs,
        radius: safeRadius,
      });
    } else if (shape.type === "ellipse" && node instanceof Konva.Ellipse) {
      node.setAttrs({
        ...commonAttrs,
        radiusX: safeWidth / 2,
        radiusY: safeHeight / 2,
      });
    } else if (shape.type === "triangle" && node instanceof Konva.Line) {
      const points = [
        safeWidth / 2, 0,           // top center
        0, safeHeight,              // bottom left
        safeWidth, safeHeight       // bottom right
      ];
      node.setAttrs({
        ...commonAttrs,
        points,
        width: safeWidth,
        height: safeHeight,
      });

      // Update getBBox for transformer compatibility
      (node as any).getBBox = function() {
        return {
          x: 0,
          y: 0,
          width: safeWidth,
          height: safeHeight
        };
      };
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
}
