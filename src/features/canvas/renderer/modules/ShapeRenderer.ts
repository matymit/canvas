// Shape renderer module for rendering basic shapes (rectangle, circle, triangle)
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { StoreActions } from "../../stores/facade";
import {
  computeShapeInnerBox,
  type BaseShape,
} from "../../utils/text/computeShapeInnerBox";
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
    textAlign?: "left" | "center" | "right";
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
  private store?: typeof import("../../stores/unifiedCanvasStore").useUnifiedCanvasStore;

  mount(ctx: ModuleRendererCtx): () => void {
    // Mounting ShapeRenderer
    this.layer = ctx.layers.main;
    this.store = ctx.store;

    // CRITICAL FIX: Make ShapeRenderer globally accessible for transform synchronization
    (window as any).shapeRenderer = this;

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

    // Clean up global reference
    const globalWindow = window as any;
    if (globalWindow.shapeRenderer === this) {
      globalWindow.shapeRenderer = undefined;
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
            StoreActions.selectSingle(shape.id);
          });

          // Add tap handler for mobile
          node.on("tap", (e) => {
            // Shape tapped for selection
            e.cancelBubble = true;

            // Use the same selection logic as click
            StoreActions.selectSingle(shape.id);
          });

          // Add double-click handler for text editing
          node.on("dblclick", (e) => {
            console.log(
              "[ShapeRenderer] Double-click detected on shape:",
              shape.id,
              shape.type,
            );
            e.cancelBubble = true; // Prevent event bubbling

            // Open text editor for this shape
            const stage = this.layer?.getStage();
            console.log("[ShapeRenderer] Stage available:", !!stage);

            if (stage) {
              console.log(
                "[ShapeRenderer] Opening text editor for shape:",
                shape.id,
              );
              import("../../utils/editors/openShapeTextEditor")
                .then(({ openShapeTextEditor }) => {
                  console.log(
                    "[ShapeRenderer] Module loaded, calling openShapeTextEditor",
                  );
                  openShapeTextEditor(stage, shape.id);
                })
                .catch((error) => {
                  console.error(
                    "[ShapeRenderer] Error loading openShapeTextEditor:",
                    error,
                  );
                });
            } else {
              console.warn(
                "[ShapeRenderer] No stage available for text editor",
              );
            }
          });

          // Also add dbltap for mobile support
          node.on("dbltap", (e) => {
            console.log(
              "[ShapeRenderer] Double-tap detected on shape:",
              shape.id,
              shape.type,
            );
            e.cancelBubble = true;

            const stage = this.layer?.getStage();
            if (stage) {
              import("../../utils/editors/openShapeTextEditor")
                .then(({ openShapeTextEditor }) => {
                  openShapeTextEditor(stage, shape.id);
                })
                .catch((error) => {
                  console.error(
                    "[ShapeRenderer] Error loading openShapeTextEditor:",
                    error,
                  );
                });
            }
          });

          // Add dragend handler for position commit
          // Live update during drag so connectors follow immediately
          this.attachLiveDragUpdate(node, shape.id);

          node.on("dragend", (e) => {
            const shapeNode = e.target as Konva.Shape;
            const nx = shapeNode.x();
            const ny = shapeNode.y();
            // Shape dragged to new position

            try {
              StoreActions.updateElement(shape.id, { x: nx, y: ny });
            } catch (error) {
              console.warn(
                "[ShapeRenderer] Failed to update element position during drag:",
                error,
              );
            }
          });
          this.shapeNodes.set(id, node);
          this.layer.add(node);
        }
      } else {
        // Update existing shape node
        this.updateShapeNode(node, shape);
        // Ensure live updates are attached for existing nodes as well
        this.attachLiveDragUpdate(node, shape.id);
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

  private attachLiveDragUpdate(node: Konva.Shape, id: string) {
    let ticking = false;
    node.off("dragmove.live-update");
    node.on("dragmove.live-update", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        try {
          const s = this.store?.getState?.();
          s?.updateElement?.(
            id,
            { x: Math.round(node.x()), y: Math.round(node.y()) },
            { pushHistory: false },
          );
        } catch (error) {
          console.warn(
            "[ShapeRenderer] Failed to update element position during transform end:",
            error,
          );
        }
      });
    });
  }

  private createShapeNode(shape: ShapeElement): Konva.Shape | undefined {
    // Apply safety limits to dimensions
    const safeWidth = Math.max(
      MIN_DIMENSION,
      Math.min(MAX_DIMENSION, shape.width || 100),
    );
    const safeHeight = Math.max(
      MIN_DIMENSION,
      Math.min(MAX_DIMENSION, shape.height || 100),
    );

    // Check if pan tool is active - if so, disable dragging on elements
    const storeState = this.store?.getState();
    const isPanToolActive = storeState?.selectedTool === "pan";

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
      draggable: !isPanToolActive, // disable dragging when pan tool is active
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

        // CRITICAL FIX: Set elementType attribute for circle detection in AnchorSnapping
        ellipseNode.setAttr("elementType", "circle");
        ellipseNode.setAttr("shapeType", "circle");

        ellipseNode.on("dragmove.text-follow", () =>
          this.syncTextFollower(shape.id, ellipseNode),
        );

        return ellipseNode;
      }

      case "ellipse": {
        const ellipseNode = new Konva.Ellipse({
          ...commonAttrs,
          radiusX: safeWidth / 2,
          radiusY: safeHeight / 2,
        });

        // CRITICAL FIX: Set elementType attribute for ellipse detection in AnchorSnapping
        ellipseNode.setAttr("elementType", "ellipse");
        ellipseNode.setAttr("shapeType", "ellipse");

        ellipseNode.on("dragmove.text-follow", () =>
          this.syncTextFollower(shape.id, ellipseNode),
        );

        return ellipseNode;
      }

      case "triangle": {
        // Create isosceles triangle using Shape with sceneFunc for proper geometry
        // This prevents deformation during resize and provides accurate bounds
        const triangleShape = new Konva.Shape({
          ...commonAttrs,
          width: safeWidth,
          height: safeHeight,
          sceneFunc: function (context, shape) {
            // Get current dimensions from the shape attributes
            const w = shape.width();
            const h = shape.height();

            // Draw isosceles triangle with proper geometry
            context.beginPath();
            context.moveTo(w / 2, 0); // top center
            context.lineTo(0, h); // bottom left
            context.lineTo(w, h); // bottom right
            context.closePath();

            // Fill and stroke the shape
            context.fillStrokeShape(shape);
          },
        });

        triangleShape.on("dragmove.text-follow", () =>
          this.syncTextFollower(shape.id, triangleShape),
        );

        return triangleShape;
      }

      default:
        // Warning: Unknown shape type
        return undefined;
    }
  }

  private updateShapeNode(node: Konva.Shape, shape: ShapeElement) {
    // Apply safety limits to dimensions
    const safeWidth = Math.max(
      MIN_DIMENSION,
      Math.min(MAX_DIMENSION, shape.width || 100),
    );
    const safeHeight = Math.max(
      MIN_DIMENSION,
      Math.min(MAX_DIMENSION, shape.height || 100),
    );

    // Check if pan tool is active - if so, disable dragging on elements
    const storeState = this.store?.getState();
    const isPanToolActive = storeState?.selectedTool === "pan";

    const commonAttrs = {
      x: shape.x,
      y: shape.y,
      fill: shape.style?.fill || "#E5E7EB",
      stroke: shape.style?.stroke || "#6B7280",
      strokeWidth: shape.style?.strokeWidth || 2,
      opacity: shape.style?.opacity || 1,
      rotation: shape.rotation || 0,
      draggable: !isPanToolActive, // update draggable when tool changes
    };

    if (shape.type === "rectangle" && node instanceof Konva.Rect) {
      node.setAttrs({
        ...commonAttrs,
        width: safeWidth,
        height: safeHeight,
      });

      node.off("dragmove.text-follow");
      node.on("dragmove.text-follow", () =>
        this.syncTextFollower(shape.id, node),
      );
    } else if (
      (shape.type === "circle" || shape.type === "ellipse") &&
      node instanceof Konva.Ellipse
    ) {
      const radiusX = safeWidth / 2;
      const radiusY = safeHeight / 2;

      // Updating ellipse-based shape node

      node.setAttrs({
        ...commonAttrs,
        radiusX,
        radiusY,
      });

      node.off("dragmove.text-follow");
      node.on("dragmove.text-follow", () =>
        this.syncTextFollower(shape.id, node),
      );
    } else if (shape.type === "triangle" && node instanceof Konva.Shape) {
      // Update triangle dimensions - sceneFunc will automatically recalculate geometry
      node.setAttrs({
        ...commonAttrs,
        width: safeWidth,
        height: safeHeight,
      });

      node.off("dragmove.text-follow");
      node.on("dragmove.text-follow", () =>
        this.syncTextFollower(shape.id, node),
      );

      // The sceneFunc will automatically redraw with new dimensions
      // No need to manually recalculate points - this prevents deformation
    }
  }

  // selection via StoreActions.selectSingle now

  private handleShapeText(shape: ShapeElement, id: Id) {
    const hasText = shape.data?.text && shape.data.text.trim().length > 0;
    // CRITICAL FIX: Always create text nodes for text-editable shapes, even with empty text
    const isTextEditableShape =
      shape.type === "rectangle" ||
      shape.type === "circle" ||
      shape.type === "triangle";

    if (isTextEditableShape) {
      // Text-editable shape - always create/update text attachment for openShapeTextEditor compatibility
      let attachment = this.textNodes.get(id);

      if (!attachment) {
        // Create new text node for this shape (even if text is empty)
        attachment = this.createShapeTextAttachment(shape, !hasText); // Pass isEmpty flag
        if (attachment) {
          this.textNodes.set(id, attachment);
          this.layer?.add(attachment.primaryNode);
          // Created text node for text-editable shape
        }
      } else {
        // Update existing text node
        this.updateShapeTextAttachment(attachment, shape, !hasText); // Pass isEmpty flag
      }
    } else {
      // Non-text-editable shape - remove text node if it exists
      const existingTextNode = this.textNodes.get(id);
      if (existingTextNode) {
        // Removing text node for non-text-editable shape
        existingTextNode.primaryNode.destroy();
        this.textNodes.delete(id);
      }
    }
  }

  private createShapeTextAttachment(
    shape: ShapeElement,
    isEmpty?: boolean,
  ): ShapeTextAttachment | undefined {
    if (!this.layer) return undefined;

    try {
      // Apply consistent text styling based on shape type
      const textConfig = getTextConfig(
        shape.type === "circle" ? "CIRCLE" : "SHAPE",
      );
      const fontSize = shape.style?.fontSize ?? textConfig.fontSize;
      const fontFamily = shape.style?.fontFamily || textConfig.fontFamily;
      const textColor = shape.textColor || "#111827";
      const padding = shape.data?.padding ?? (shape.type === "circle" ? 0 : 8);
      const lineHeight =
        (shape.data as ShapeDataWithExtras)?.textLineHeight ?? 1.25;

      const innerBox = computeShapeInnerBox(shape as BaseShape, padding);
      const textContent = shape.data?.text || ""; // Allow empty text
      const textNode = new Konva.Text({
        id: `${shape.id}-text`,
        name: `shape-text-${shape.id}`,
        x: innerBox.x,
        y: innerBox.y,
        width: innerBox.width,
        height: innerBox.height,
        text: textContent,
        fontSize,
        fontFamily,
        fill: textColor,
        align: "center",
        verticalAlign: "middle",
        lineHeight,
        wrap: "word",
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        // CRITICAL FIX: Hide text node when text is empty to avoid visual artifacts
        visible: !isEmpty,
      });

      textNode.setAttr("elementId", shape.id);
      textNode.setAttr("nodeType", "shape-text");

      const primaryNode: Konva.Group | Konva.Text = textNode;

      const relativeDX = primaryNode.x() - shape.x;
      const relativeDY = primaryNode.y() - shape.y;
      primaryNode.setAttr("relativeDX", relativeDX);
      primaryNode.setAttr("relativeDY", relativeDY);
      primaryNode.setAttr("elementId", shape.id);
      primaryNode.setAttr("nodeType", "shape-text-root");

      // Shape text node created

      return { text: textNode, primaryNode };
    } catch (error) {
      // Error: Error creating text node for shape
      return undefined;
    }
  }

  private updateShapeTextAttachment(
    attachment: ShapeTextAttachment,
    shape: ShapeElement,
    isEmpty?: boolean,
  ) {
    // Allow updating even when text is empty for text-editable shapes

    try {
      // Apply consistent text styling based on shape type
      const textConfig = getTextConfig(
        shape.type === "circle" ? "CIRCLE" : "SHAPE",
      );
      const fontSize = shape.style?.fontSize ?? textConfig.fontSize;
      const fontFamily = shape.style?.fontFamily || textConfig.fontFamily;
      const textColor = shape.textColor || "#111827";
      const padding = shape.data?.padding ?? (shape.type === "circle" ? 0 : 8);
      const lineHeight =
        (shape.data as ShapeDataWithExtras)?.textLineHeight ?? 1.25;

      const innerBox = computeShapeInnerBox(shape as BaseShape, padding);
      const { text: textNode, primaryNode } = attachment;
      const textContent = shape.data?.text || ""; // Allow empty text

      textNode.setAttrs({
        x: innerBox.x,
        y: innerBox.y,
        width: innerBox.width,
        height: innerBox.height,
        text: textContent,
        fontSize,
        fontFamily,
        fill: textColor,
        align: "center",
        verticalAlign: "middle",
        lineHeight,
        // CRITICAL FIX: Hide text node when text is empty to avoid visual artifacts
        visible: !isEmpty,
      });

      const relativeDX = primaryNode.x() - shape.x;
      const relativeDY = primaryNode.y() - shape.y;
      primaryNode.setAttr("relativeDX", relativeDX);
      primaryNode.setAttr("relativeDY", relativeDY);

      // Shape text node updated
    } catch (error) {
      // Error: Error updating text node for shape
    }
  }

  private syncTextFollower(id: Id, node: Konva.Shape) {
    const attachment = this.textNodes.get(id);
    if (!attachment) return;

    const dx = attachment.primaryNode.getAttr("relativeDX");
    const dy = attachment.primaryNode.getAttr("relativeDY");

    if (typeof dx !== "number" || typeof dy !== "number") return;

    attachment.primaryNode.position({ x: node.x() + dx, y: node.y() + dy });
    attachment.primaryNode.getLayer()?.batchDraw();
  }

  /**
   * CRITICAL FIX: Synchronize text positioning during transform operations
   * This method is called during real-time transforms to keep text properly positioned
   */
  public syncTextDuringTransform(elementId: Id) {
    const attachment = this.textNodes.get(elementId);
    if (!attachment || !this.store) return;

    // Get the current element data from store
    const store = this.store.getState();
    const element = store.elements.get(elementId) as ShapeElement | undefined;
    if (!element) return;

    // Find the corresponding Konva shape node
    const shapeNode = this.shapeNodes.get(elementId);
    if (!shapeNode) return;

    try {
      // CRITICAL FIX: Calculate visual dimensions directly from node properties during transform
      // Don't use getClientRect during transform as it can be inaccurate
      const nodePos = shapeNode.position();
      const nodeSize = shapeNode.size();
      const nodeScale = shapeNode.scale();
      const nodeRotation = shapeNode.rotation();

      // Calculate actual visual dimensions accounting for scale
      const scaleX = Math.abs(nodeScale?.x ?? 1);
      const scaleY = Math.abs(nodeScale?.y ?? 1);
      const visualWidth = nodeSize.width * scaleX;
      const visualHeight = nodeSize.height * scaleY;

      // Create a temporary shape element with current visual dimensions
      const visualElement: ShapeElement = {
        ...element,
        x: nodePos.x,
        y: nodePos.y,
        width: visualWidth,
        height: visualHeight,
        rotation: nodeRotation,
      };

      // Apply consistent text styling and positioning
      const padding =
        element.data?.padding ?? (element.type === "circle" ? 0 : 8);
      const innerBox = computeShapeInnerBox(
        visualElement as BaseShape,
        padding,
      );

      // CRITICAL FIX: For circles/ellipses, ensure text stays perfectly centered
      if (element.type === "circle" || element.type === "ellipse") {
        // Calculate center-based positioning for circles to prevent text jumping
        const centerX = nodePos.x;
        const centerY = nodePos.y;
        const textWidth = Math.min(visualWidth * 0.8, innerBox.width); // Leave 20% padding
        const textHeight = Math.min(visualHeight * 0.8, innerBox.height); // Leave 20% padding

        attachment.text.setAttrs({
          x: centerX - textWidth / 2,
          y: centerY - textHeight / 2,
          width: textWidth,
          height: textHeight,
        });
      } else {
        // For rectangles and triangles, use the computed inner box
        attachment.text.setAttrs({
          x: innerBox.x,
          y: innerBox.y,
          width: innerBox.width,
          height: innerBox.height,
        });
      }

      // Update relative positioning for consistent drag behavior
      const relativeDX = attachment.text.x() - visualElement.x;
      const relativeDY = attachment.text.y() - visualElement.y;
      attachment.primaryNode.setAttr("relativeDX", relativeDX);
      attachment.primaryNode.setAttr("relativeDY", relativeDY);

      // Immediately redraw the text layer for smooth visual feedback
      attachment.text.getLayer()?.batchDraw();
    } catch (error) {
      console.warn(
        "[ShapeRenderer] Failed to sync text during transform:",
        error,
      );
    }
  }

  /**
   * CRITICAL FIX: Synchronize all text nodes during global transform operations
   * This method can be called to update all shape text positions simultaneously
   */
  public syncAllTextDuringTransform() {
    for (const elementId of this.textNodes.keys()) {
      this.syncTextDuringTransform(elementId);
    }
  }
}
