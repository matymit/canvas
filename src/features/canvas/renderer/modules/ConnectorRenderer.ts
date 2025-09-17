import Konva from "konva";
import type { ConnectorElement } from "../../types/elements/connector";

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
  private layers: RendererLayers;
  private deps: ConnectorRendererDeps;
  private groupById = new Map<string, Konva.Group>();
  private shapeById = new Map<string, Konva.Shape>();

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
    const rect = node.getClientRect({ skipStroke: true, skipShadow: true });
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    let x = cx;
    let y = cy;
    switch (ep.anchor) {
      case "left":
        x = rect.x;
        y = cy;
        break;
      case "right":
        x = rect.x + rect.width;
        y = cy;
        break;
      case "top":
        x = cx;
        y = rect.y;
        break;
      case "bottom":
        x = cx;
        y = rect.y + rect.height;
        break;
      case "center":
      default:
        x = cx;
        y = cy;
        break;
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
        this.shapeById.set(conn.id, shape);
      } else {
        shape.points(points);
        shape.stroke(conn.style.stroke);
        shape.strokeWidth(conn.style.strokeWidth);
        shape.dash(conn.style.dash);
        shape.opacity(conn.style.opacity ?? 1);
        shape.lineCap(rounded ? "round" : "butt");
        shape.lineJoin(rounded ? "round" : "miter");
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
