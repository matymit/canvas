// features/canvas/utils/DirectKonvaDrawing.ts
import Konva from 'konva';

export interface RafScheduler {
  schedule: (op: () => void) => void;
  cancel?: () => void;
}

class LocalRafScheduler implements RafScheduler {
  private rafId: number | null = null;
  private readonly ops = new Set<() => void>();
  schedule(op: () => void) {
    this.ops.add(op);
    if (this.rafId == null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        const q = Array.from(this.ops);
        this.ops.clear();
        for (const fn of q) fn();
      });
    }
  }
  cancel() {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.ops.clear();
  }
}

export type DirectDrawTool = 'pen' | 'marker' | 'highlighter' | 'eraser';
export type CompositeMode = GlobalCompositeOperation;

export interface DirectDrawStyle {
  color: string;
  width: number;
  opacity?: number;
  tension?: number;
  composite?: CompositeMode;
  shadowForStrokeEnabled?: boolean;
  perfectDrawEnabled?: boolean;
}

export interface BeginStrokeOptions extends Partial<DirectDrawStyle> {
  tool: DirectDrawTool;
  pressureEnabled?: boolean; // modulate width by pointer pressure
  minDist?: number; // point spacing decimation in px
}

export interface StrokeResult {
  node: Konva.Line;
  points: number[];
}

function defaultsForTool(tool: DirectDrawTool): Required<Pick<DirectDrawStyle,
  'opacity' | 'composite' | 'tension' | 'shadowForStrokeEnabled' | 'perfectDrawEnabled'
>> {
  switch (tool) {
    case 'marker':
      return {
        opacity: 0.8,
        composite: 'source-over',
        tension: 0,
        shadowForStrokeEnabled: false,
        perfectDrawEnabled: false,
      };
    case 'highlighter':
      return {
        opacity: 0.3,
        composite: 'multiply',
        tension: 0,
        shadowForStrokeEnabled: false,
        perfectDrawEnabled: false,
      };
    case 'eraser':
      return {
        opacity: 1,
        composite: 'destination-out',
        tension: 0,
        shadowForStrokeEnabled: false,
        perfectDrawEnabled: false,
      };
    case 'pen':
    default:
      return {
        opacity: 1,
        composite: 'source-over',
        tension: 0,
        shadowForStrokeEnabled: false,
        perfectDrawEnabled: false,
      };
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export interface CommitOptions {
  // If provided, move the finished node into this layer and enable hit graph
  toLayer?: Konva.Layer;
  // If true (default), set hitStrokeWidth('auto') so shape is interactive post-commit
  enableHit?: boolean;
  // Special z-policy: if 'highlighter', caller can place into a "highlights" layer before overlay
  placeHighlighter?: ((node: Konva.Node) => void) | null;
}

export class DirectKonvaDrawer {
  private readonly layer: Konva.Layer; // preview-side layer recommended
  private readonly scheduler: RafScheduler;

  private currentLine: Konva.Line | null = null;
  private points: number[] = [];
  private lastPoint: { x: number; y: number } | null = null;
  private isActive = false;
  private opts: BeginStrokeOptions | null = null;

  constructor(layer: Konva.Layer, scheduler?: RafScheduler) {
    this.layer = layer;
    this.scheduler = scheduler ?? new LocalRafScheduler();
  }

  get isDrawing() {
    return this.isActive;
  }

  get line(): Konva.Line | null {
    return this.currentLine;
  }

  begin(point: { x: number; y: number }, options: BeginStrokeOptions): Konva.Line {
    if (this.isActive) {
      this.cancel();
    }
    this.isActive = true;
    this.opts = options;
    this.points = [point.x, point.y];
    this.lastPoint = { ...point };

    const d = defaultsForTool(options.tool);
    const opacity = options.opacity ?? d.opacity;
    const composite = options.composite ?? d.composite;
    const tension = options.tension ?? d.tension;
    const shadowForStrokeEnabled = options.shadowForStrokeEnabled ?? d.shadowForStrokeEnabled;
    const perfectDrawEnabled = options.perfectDrawEnabled ?? d.perfectDrawEnabled;

    const line = new Konva.Line({
      points: this.points,
      stroke: options.color || '#000000',
      strokeWidth: options.width || 2,
      lineCap: 'round',
      lineJoin: 'round',
      opacity,
      tension,
      globalCompositeOperation: composite,
      listening: false,
      perfectDrawEnabled,
      shadowForStrokeEnabled,
    });
    // Disable hit graph for live drawing on preview
    line.hitStrokeWidth(0);

    this.currentLine = line;
    this.layer.add(line);
    this.scheduler.schedule(() => this.layer.batchDraw());
    return line;
  }

  extend(point: { x: number; y: number }, pressure?: number) {
    if (!this.isActive || !this.currentLine) return;
    const minDist = this.opts?.minDist ?? 0.5;
    if (this.lastPoint && dist(this.lastPoint, point) < minDist) return;

    // Pressure modulation for width
    if (this.opts?.pressureEnabled && typeof pressure === 'number' && this.opts?.width) {
      const base = this.opts.width;
      const w = Math.max(0.5, base * (pressure > 0 ? pressure : 1));
      this.currentLine.strokeWidth(w);
    }

    this.points.push(point.x, point.y);
    this.lastPoint = { ...point };
    this.currentLine.points(this.points);
    this.scheduler.schedule(() => this.layer.batchDraw());
  }

  end(commit?: CommitOptions): StrokeResult | null {
    if (!this.isActive || !this.currentLine) return null;

    const node = this.currentLine;
    const pts = this.points.slice();

    // Re-enable hit graph if requested/committing to main
    if (commit?.enableHit !== false) {
      node.hitStrokeWidth('auto');
    }

    // Commit placement
    if (commit?.placeHighlighter && (this.opts?.tool === 'highlighter')) {
      commit.placeHighlighter(node);
    } else if (commit?.toLayer) {
      node.moveTo(commit.toLayer);
      commit.toLayer.batchDraw();
    }

    // Final draw of preview layer as well
    this.scheduler.schedule(() => this.layer.batchDraw());

    // Reset session state, keep node for caller
    this.isActive = false;
    this.currentLine = null;
    this.points = [];
    this.lastPoint = null;
    this.opts = null;

    return { node, points: pts };
  }

  cancel() {
    if (!this.isActive) return;
    if (this.currentLine) {
      this.currentLine.remove();
      this.currentLine.destroy();
      this.scheduler.schedule(() => this.layer.batchDraw());
    }
    this.isActive = false;
    this.currentLine = null;
    this.points = [];
    this.lastPoint = null;
    this.opts = null;
  }
}