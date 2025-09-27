import Konva from "konva";
import type { ConnectorElement } from "../../types/connector";

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export interface ConnectorRendererDeps {
  getNodeById: (id: string) => Konva.Node | null;
}

export class ConnectorRenderer {
  private readonly layers: RendererLayers;
  private readonly deps: ConnectorRendererDeps;
  private readonly groupById = new Map<string, Konva.Group>();
  private readonly shapeById = new Map<string, Konva.Shape>();

  constructor(layers: RendererLayers, deps: ConnectorRendererDeps) {
    this.layers = layers;
    this.deps = deps;
  }

  private resolveEndpoint(
    ep: ConnectorElement["from"],
  ): { x: number; y: number } | null {
    if (ep.kind === "point") return { x: ep.x, y: ep.y };
    const node = this.deps.getNodeById(ep.elementId);
    if (!node) return null;

    // CRITICAL FIX: Use getClientRect with stage coordinates for consistency across modules
    // This ensures consistent coordinate system with PortHoverModule and AnchorSnapping
    const stage = node.getStage();
    const rect = node.getClientRect({
      skipStroke: true,
      skipShadow: true,
      relativeTo: stage || undefined // Use stage coordinates consistently
    });
    const elementX = rect.x;
    const elementY = rect.y;
    const elementWidth = rect.width;
    const elementHeight = rect.height;

    const cx = elementX + elementWidth / 2;
    const cy = elementY + elementHeight / 2;
    let x = cx;
    let y = cy;

    // CRITICAL FIX: Handle circular elements with trigonometric calculations
    const elementType = node.getAttr('elementType') || node.name() || '';
    const isCircular = elementType.includes('circle') || elementType.includes('ellipse') ||
                      node.getAttr('shapeType') === 'circle' || node.getAttr('shapeType') === 'ellipse';

    if (isCircular) {
      // For circles/ellipses, calculate anchor points on the perimeter using trigonometry
      const radiusX = elementWidth / 2;  // For ellipses, this is the horizontal radius
      const radiusY = elementHeight / 2; // For ellipses, this is the vertical radius

      switch (ep.anchor) {
        case "left":
          x = cx + radiusX * Math.cos(Math.PI); // π radians = leftmost point
          y = cy + radiusY * Math.sin(Math.PI);
          break;
        case "right":
          x = cx + radiusX * Math.cos(0); // 0 radians = rightmost point
          y = cy + radiusY * Math.sin(0);
          break;
        case "top":
          x = cx + radiusX * Math.cos(3 * Math.PI / 2); // 3π/2 radians = topmost point
          y = cy + radiusY * Math.sin(3 * Math.PI / 2);
          break;
        case "bottom":
          x = cx + radiusX * Math.cos(Math.PI / 2); // π/2 radians = bottommost point
          y = cy + radiusY * Math.sin(Math.PI / 2);
          break;
        case "center":
        default:
          x = cx;
          y = cy;
          break;
      }
    } else {
      // For rectangular elements, use existing edge-based logic
      switch (ep.anchor) {
        case "left":
          x = elementX;
          y = cy;
          break;
        case "right":
          x = elementX + elementWidth;
          y = cy;
          break;
        case "top":
          x = cx;
          y = elementY;
          break;
        case "bottom":
          x = cx;
          y = elementY + elementHeight;
          break;
        case "center":
        default:
          x = cx;
          y = cy;
          break;
      }
    }

    if (ep.offset) {
      x += ep.offset.dx;
      y += ep.offset.dy;
    }
    return { x, y };
  }

  async render(conn: ConnectorElement): Promise<void> {
    let g = this.groupById.get(conn.id);
    if (!g || !g.getStage()) {
      g = new Konva.Group({ id: conn.id, name: "connector", listening: true });
      // Explicitly mark type so any generic selection code can detect and skip transformer
      g.setAttr('nodeType', 'connector');
      g.setAttr('elementType', 'connector');

      // CRITICAL FIX: Add click handlers for connector re-selection
      g.setAttr("elementId", conn.id);

      // Use pointerdown for more reliable hit on thin lines
      const onSelect = (e: Konva.KonvaEventObject<Event>) => {
        e.cancelBubble = true;
        const selectionModule = typeof window !== "undefined" ? window.selectionModule : undefined;
        if (selectionModule) {
          const nativeEvent = e.evt;
          const isPointerLike = (evt: Event): evt is PointerEvent | MouseEvent =>
            typeof (evt as PointerEvent).ctrlKey === "boolean" &&
            typeof (evt as PointerEvent).metaKey === "boolean" &&
            typeof (evt as PointerEvent).shiftKey === "boolean";
          const isAdditive = isPointerLike(nativeEvent)
            ? nativeEvent.ctrlKey || nativeEvent.metaKey || nativeEvent.shiftKey
            : false;
          // Always delegate to selection module; it will choose connector mode
          selectionModule.selectElement?.(conn.id, { additive: isAdditive });
        } else {
          // Ignore error
        }
      };
      g.on("pointerdown", onSelect);
      g.on("tap", onSelect);

      this.layers.main.add(g);
      this.groupById.set(conn.id, g);
    }

    const p1 = this.resolveEndpoint(conn.from);
    const p2 = this.resolveEndpoint(conn.to);
    let shape = this.shapeById.get(conn.id);
    const rounded = conn.style.rounded ?? true;

    if (!p1 || !p2) {
      if (shape) shape.hide();
      this.layers.main.batchDraw();
      return;
    }

    const points = [p1.x, p1.y, p2.x, p2.y];

    if (conn.variant === "arrow") {
      if (!shape || !(shape instanceof Konva.Arrow) || !shape.getStage()) {
        if (shape) shape.destroy();
        shape = new Konva.Arrow({
          points,
          stroke: conn.style.stroke,
          strokeWidth: conn.style.strokeWidth,
          dash: conn.style.dash,
          lineCap: rounded ? "round" : "butt",
          lineJoin: rounded ? "round" : "miter",
          opacity: conn.style.opacity ?? 1,
          pointerLength: conn.style.arrowSize ?? 10,
          pointerWidth: (conn.style.arrowSize ?? 10) * 0.7,
          listening: true,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
          name: "connector-shape",
        });
        g.add(shape);
        // Mark shape with metadata as well (defensive)
        shape.setAttr('nodeType', 'connector');
        shape.setAttr('elementType', 'connector');
        shape.hitStrokeWidth(Math.max(conn.style.strokeWidth, 24));
        this.shapeById.set(conn.id, shape);
      } else {
        shape.points(points);
        shape.stroke(conn.style.stroke);
        shape.strokeWidth(conn.style.strokeWidth);
        shape.dash(conn.style.dash);
        shape.opacity(conn.style.opacity ?? 1);
        (shape as Konva.Arrow).pointerLength(conn.style.arrowSize ?? 10);
        (shape as Konva.Arrow).pointerWidth((conn.style.arrowSize ?? 10) * 0.7);
        shape.lineCap(rounded ? "round" : "butt");
        shape.lineJoin(rounded ? "round" : "miter");
        shape.hitStrokeWidth(Math.max(conn.style.strokeWidth, 24));
      }
    } else {
      // line
      if (!shape || !(shape instanceof Konva.Line) || !shape.getStage()) {
        if (shape) shape.destroy();
        shape = new Konva.Line({
          points,
          stroke: conn.style.stroke,
          strokeWidth: conn.style.strokeWidth,
          dash: conn.style.dash,
          lineCap: rounded ? "round" : "butt",
          lineJoin: rounded ? "round" : "miter",
          opacity: conn.style.opacity ?? 1,
          listening: true,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
          name: "connector-shape",
        });
        g.add(shape);
        shape.setAttr('nodeType', 'connector');
        shape.setAttr('elementType', 'connector');
        shape.hitStrokeWidth(Math.max(conn.style.strokeWidth, 24));
        this.shapeById.set(conn.id, shape);
      } else {
        shape.points(points);
        shape.stroke(conn.style.stroke);
        shape.strokeWidth(conn.style.strokeWidth);
        shape.dash(conn.style.dash);
        shape.opacity(conn.style.opacity ?? 1);
        shape.lineCap(rounded ? "round" : "butt");
        shape.lineJoin(rounded ? "round" : "miter");
        shape.hitStrokeWidth(Math.max(conn.style.strokeWidth, 24));
      }
    }

    shape.show();
    this.layers.main.batchDraw();
  }

  destroy(connId: string): void {
    const g = this.groupById.get(connId);
    const shape = this.shapeById.get(connId);
    if (g) {
      g.destroy();
      this.groupById.delete(connId);
    }
    if (shape) {
      this.shapeById.delete(connId);
    }
    this.layers.main.batchDraw();
  }

  rerouteConnector(_connId: string, conn: ConnectorElement): void {
    this.render(conn);
  }

  cleanup(): void {
    this.groupById.clear();
    this.shapeById.clear();
  }
}
