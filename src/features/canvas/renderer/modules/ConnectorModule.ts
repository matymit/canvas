// features/canvas/renderermodular/modules/ConnectorModule.ts
import Konva from "konva";

type Point = { x: number; y: number };

type ConnectorId = string;
type ElementId = string;

// Minimal shape of a connector in store; adapt to your actual type if available.
interface ConnectorElement {
  id: ConnectorId;
  type: "connector" | string;
  from?: { elementId?: ElementId; point?: Point };
  to?: { elementId?: ElementId; point?: Point };
  points?: Point[]; // optional polyline points, used for manual routing
  style?: {
    color?: string;
    width?: number;
    dash?: number[];
    arrowEnd?: boolean;
  };
}

// Minimal element bbox used for anchor computation; adapt to your actual element type.
interface ElementBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Renderer Layers per your four-layer pipeline.
interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

// Very small, duck-typed store adapter expected by this module.
// Plug this into your existing StoreAdapterUnified facade.
interface StoreApi {
  // Edges/connectors
  getEdges?: () => Map<ConnectorId, ConnectorElement>;
  // Elements, for resolving connector endpoints to element centers
  getElementBBox?: (id: ElementId) => ElementBBox | undefined;
  // Optional subscribe hooks; return unsubscribe
  onEdgesChange?: (cb: () => void) => () => void;
  onElementsChange?: (cb: () => void) => () => void;
}

interface ModuleContext {
  layers: RendererLayers;
  store?: StoreApi;
  stage?: Konva.Stage;
}

export default class ConnectorModule {
  readonly id = "connector-module";

  private layers!: RendererLayers;
  private store?: StoreApi;

  private readonly lineById = new Map<ConnectorId, Konva.Line>();
  private previewLine?: Konva.Line;

  private unsubEdges?: () => void;
  private unsubElements?: () => void;

  mount(ctx: ModuleContext) {
    this.layers = ctx.layers;
    this.store = ctx.store;

    // Subscribe to store events if available to re-render connectors efficiently.
    if (this.store?.onEdgesChange) {
      this.unsubEdges = this.store.onEdgesChange(() => this.render());
    }
    if (this.store?.onElementsChange) {
      this.unsubElements = this.store.onElementsChange(() => this.render());
    }

    this.render();
  }

  unmount() {
    // Cleanup Konva nodes
    for (const [, node] of this.lineById) {
      node.destroy();
    }
    this.lineById.clear();

    if (this.previewLine) {
      this.previewLine.destroy();
      this.previewLine = undefined;
    }

    // Cleanup subscriptions
    if (this.unsubEdges) this.unsubEdges();
    if (this.unsubElements) this.unsubElements();

    // Request one final draw to clear canvas if needed
    this.layers.main.batchDraw();
    this.layers.preview.batchDraw();
  }

  // Public API for tools to show a live preview while placing connectors.
  startPreview(start: Point, style?: ConnectorElement["style"]) {
    if (this.previewLine) {
      this.previewLine.destroy();
      this.previewLine = undefined;
    }

    this.previewLine = new Konva.Line({
      points: [start.x, start.y, start.x, start.y],
      stroke: style?.color ?? "#3b82f6",
      strokeWidth: style?.width ?? 2,
      dash: style?.dash,
      lineCap: "round",
      lineJoin: "round",
      listening: false,
      perfectDrawEnabled: false,
    });

    this.layers.preview.add(this.previewLine);
    this.layers.preview.batchDraw();
  }

  updatePreview(next: Point) {
    if (!this.previewLine) return;
    const pts = this.previewLine.points();
    // Keep the first point, update the end
    if (pts.length >= 2) {
      this.previewLine.points([pts[0], pts[1], next.x, next.y]);
    } else {
      this.previewLine.points([next.x, next.y]);
    }
    this.layers.preview.batchDraw();
  }

  endPreview() {
    if (!this.previewLine) return;
    this.previewLine.destroy();
    this.previewLine = undefined;
    this.layers.preview.batchDraw();
  }

  // Main render; rebuilds or updates line nodes to reflect the store.
  render() {
    const edges = this.store?.getEdges?.();
    if (!edges) return;

    // Mark all as unseen; remove leftover ones at end.
    const seen = new Set<ConnectorId>();

    for (const [id, edge] of edges.entries()) {
      seen.add(id);
      const points = this.resolveConnectorPoints(edge);
      const color = edge.style?.color ?? "#111827";
      const width = edge.style?.width ?? 2;
      const dash = edge.style?.dash;

      let node = this.lineById.get(id);
      if (!node) {
        node = new Konva.Line({
          points: pointsToArray(points),
          stroke: color,
          strokeWidth: width,
          dash,
          lineCap: "round",
          lineJoin: "round",
          listening: true, // CRITICAL FIX: Enable listening for drag interactions
          perfectDrawEnabled: false,
          id: id, // CRITICAL FIX: Set ID for proper identification
        });
        this.layers.main.add(node);
        this.lineById.set(id, node);

        // CRITICAL FIX: Add drag interaction handlers for connector lines
        this.setupConnectorInteraction(node, id);
      } else {
        // Update properties and points
        node.points(pointsToArray(points));
        node.stroke(color);
        node.strokeWidth(width);
        node.dash(dash ?? []);
      }
    }

    // Remove deleted connectors
    for (const [id, node] of this.lineById.entries()) {
      if (!seen.has(id)) {
        node.destroy();
        this.lineById.delete(id);
      }
    }

    this.layers.main.batchDraw();
  }

  // CRITICAL FIX: Setup drag interaction handlers for connector lines
  private setupConnectorInteraction(
    node: Konva.Line,
    _id: string,
  ) {
    // Add drag start handler
    node.on("dragstart", (e) => {
      e.cancelBubble = true;
      // Store initial position for undo/redo
    });

    // Add drag move handler
    node.on("dragmove", (e) => {
      e.cancelBubble = true;
      // Update connector position during drag
      // This would require updating the store with new positions
    });

    // Add drag end handler
    node.on("dragend", (e) => {
      e.cancelBubble = true;
      // Commit final position to store
      // This would require updating the store with final positions
    });

    // Add click handler for selection
    node.on("click tap", (e) => {
      e.cancelBubble = true;
      // Handle connector selection
      // This would require integrating with the selection system
    });
  }

  // Compute connector points using element centers if elementId is provided.
  private resolveConnectorPoints(edge: ConnectorElement): Point[] {
    // Prefer explicit polyline if provided
    if (edge.points && edge.points.length >= 2) {
      return edge.points;
    }

    const start = this.resolveEndpoint(edge.from);
    const end = this.resolveEndpoint(edge.to);

    // Fallback if any endpoint missing
    if (!start || !end) {
      const fallback =
        edge.points && edge.points.length >= 2
          ? edge.points
          : [
              { x: 0, y: 0 },
              { x: 0, y: 0 },
            ];
      return fallback;
    }

    // Simple straight segment; smart routing can be added here later
    return [start, end];
  }

  private resolveEndpoint(endpoint?: {
    elementId?: ElementId;
    point?: Point;
  }): Point | undefined {
    if (!endpoint) return undefined;
    if (endpoint.point) return endpoint.point;
    if (endpoint.elementId && this.store?.getElementBBox) {
      const bbox = this.store.getElementBBox(endpoint.elementId);
      if (!bbox) return undefined;
      return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
    }
    return undefined;
  }
}

function pointsToArray(pts: Point[]): number[] {
  const arr: number[] = [];
  for (const p of pts) {
    arr.push(p.x, p.y);
  }
  return arr;
}