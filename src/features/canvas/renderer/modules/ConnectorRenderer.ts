// Connector renderer module for main layer line/arrow rendering with endpoint resolution
import Konva from 'konva';
import type ConnectorElement from '../../types/elements/connector';

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export interface ConnectorRendererDeps {
  // Resolve a Konva node by element id (on main layer)
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

  /**
   * Resolve endpoint to current stage coordinates
   */
  private resolveEndpoint(el: ConnectorElement['from' | 'to']): { x: number; y: number } | null {
    if (el.kind === 'point') {
      if (typeof el.x === 'number' && typeof el.y === 'number') {
        return { x: el.x, y: el.y };
      }
      return null;
    }
    
    // Element-anchored endpoint
    const node = el.elementId ? this.deps.getNodeById(el.elementId) : null;
    if (!node) return null;
    
    const rect = node.getClientRect({ skipStroke: true, skipShadow: true });
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    
    let x = cx;
    let y = cy;
    
    switch (el.anchor) {
      case 'left': 
        x = rect.x; 
        y = cy; 
        break;
      case 'right': 
        x = rect.x + rect.width; 
        y = cy; 
        break;
      case 'top': 
        x = cx; 
        y = rect.y; 
        break;
      case 'bottom': 
        x = cx; 
        y = rect.y + rect.height; 
        break;
      case 'center':
      default: 
        x = cx; 
        y = cy; 
        break;
    }
    
    // Apply optional offset
    if (el.offset) {
      x += el.offset.dx;
      y += el.offset.dy;
    }
    
    return { x, y };
  }

  /**
   * Render or update a connector element on the main layer
   */
  async render(conn: ConnectorElement): Promise<void> {
    let g = this.groupById.get(conn.id);
    if (!g || !g.getLayer()) {
      g = new Konva.Group({
        id: conn.id,
        name: 'connector',
        listening: true,
      });
      this.layers.main.add(g);
      this.groupById.set(conn.id, g);
    }

    let shape = this.shapeById.get(conn.id);
    const rounded = conn.style.rounded ?? true;
    
    const optsBase = {
      stroke: conn.style.stroke,
      strokeWidth: conn.style.strokeWidth,
      dash: conn.style.dash,
      lineCap: rounded ? 'round' : 'butt',
      lineJoin: rounded ? 'round' : 'miter',
      opacity: conn.style.opacity ?? 1,
      listening: true,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    } as const;

    // Resolve endpoint coordinates
    const p1 = this.resolveEndpoint(conn.from);
    const p2 = this.resolveEndpoint(conn.to);
    
    if (!p1 || !p2) {
      // Hide if unresolved (e.g., element missing)
      if (shape) shape.hide();
      this.layers.main.batchDraw();
      return;
    }

    const points = [p1.x, p1.y, p2.x, p2.y];

    if (conn.variant === 'arrow') {
      // Arrow at the "to" end
      if (!shape || !(shape instanceof Konva.Arrow)) {
        if (shape) shape.destroy();
        shape = new Konva.Arrow({
          ...optsBase,
          pointerLength: conn.style.arrowSize ?? 10,
          pointerWidth: (conn.style.arrowSize ?? 10) * 0.7,
          points,
        });
        g.add(shape);
        this.shapeById.set(conn.id, shape);
      } else {
        const arrow = shape as Konva.Arrow;
        arrow.points(points);
        arrow.pointerLength(conn.style.arrowSize ?? 10);
        arrow.pointerWidth((conn.style.arrowSize ?? 10) * 0.7);
        arrow.stroke(conn.style.stroke);
        arrow.strokeWidth(conn.style.strokeWidth);
        arrow.dash(conn.style.dash);
        arrow.opacity(conn.style.opacity ?? 1);
        arrow.lineCap(rounded ? 'round' : 'butt');
        arrow.lineJoin(rounded ? 'round' : 'miter');
      }
    } else {
      // Simple line
      if (!shape || !(shape instanceof Konva.Line)) {
        if (shape) shape.destroy();
        shape = new Konva.Line({
          ...optsBase,
          points,
        });
        g.add(shape);
        this.shapeById.set(conn.id, shape);
      } else {
        const line = shape as Konva.Line;
        line.points(points);
        line.stroke(conn.style.stroke);
        line.strokeWidth(conn.style.strokeWidth);
        line.dash(conn.style.dash);
        line.opacity(conn.style.opacity ?? 1);
        line.lineCap(rounded ? 'round' : 'butt');
        line.lineJoin(rounded ? 'round' : 'miter');
      }
    }

    shape.show();
    this.layers.main.batchDraw();
  }

  /**
   * Remove a connector element from the renderer
   */
  remove(id: string): void {
    const g = this.groupById.get(id);
    if (g) g.destroy();
    this.groupById.delete(id);
    this.shapeById.delete(id);
    this.layers.main.batchDraw();
  }

  /**
   * Clean up all rendered connectors
   */
  clear(): void {
    for (const [id] of this.groupById) {
      this.remove(id);
    }
  }
}

export default ConnectorRenderer;