// Shape renderer module for rendering basic shapes (rectangle, circle, triangle)
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";

type Id = string;

interface ShapeElement {
  id: Id;
  type: "rectangle" | "circle" | "triangle";
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
            element.type === "triangle"
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
        element.type === "triangle"
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
          // Add dragend handler for position commit
          node.on("dragend", (e) => {
            const shapeNode = e.target as Konva.Shape;
            const nx = shapeNode.x();
            const ny = shapeNode.y();
            (window as any).__canvasStore?.element?.updateElement?.(
              shape.id,
              { x: nx, y: ny },
              { pushHistory: true },
            );
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
          width: shape.width || 100,
          height: shape.height || 100,
        });

      case "circle":
        return new Konva.Circle({
          ...commonAttrs,
          radius: shape.radius || shape.width ? shape.width! / 2 : 50,
        });

      case "triangle":
        const width = shape.width || 100;
        const height = shape.height || 100;
        return new Konva.RegularPolygon({
          ...commonAttrs,
          sides: 3,
          radius: Math.min(width, height) / 2,
        });

      default:
        console.warn("[ShapeRenderer] Unknown shape type:", shape.type);
        return undefined;
    }
  }

  private updateShapeNode(node: Konva.Shape, shape: ShapeElement) {
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
        width: shape.width || 100,
        height: shape.height || 100,
      });
    } else if (shape.type === "circle" && node instanceof Konva.Circle) {
      node.setAttrs({
        ...commonAttrs,
        radius: shape.radius || shape.width ? shape.width! / 2 : 50,
      });
    } else if (
      shape.type === "triangle" &&
      node instanceof Konva.RegularPolygon
    ) {
      const width = shape.width || 100;
      const height = shape.height || 100;
      node.setAttrs({
        ...commonAttrs,
        radius: Math.min(width, height) / 2,
      });
    }
  }
}
