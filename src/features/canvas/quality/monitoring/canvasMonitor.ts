// features/canvas/quality/monitoring/canvasMonitor.ts
import type Konva from 'konva';

export interface LayerDrawMetric {
  id: string;
  name?: string;
  lastDrawMs: number;
}

export interface CanvasMetrics {
  fps: number;
  frameMs: number;
  layers: LayerDrawMetric[];
  nodes?: {
    layers: number;
    groups: number;
    shapes: number;
  };
  memory?: {
    jsHeapUsedMB: number;
    jsHeapTotalMB: number;
  };
  timestamp: number;
}

type Subscriber = (metrics: CanvasMetrics) => void;

export interface CanvasMonitorOptions {
  sampleIntervalMs?: number;      // push metrics every N ms
  smoothFactor?: number;          // EMA smoothing for FPS [0..1], higher = smoother
  instrumentLayerDraws?: boolean; // patch layer.draw to record durations
  countNodes?: boolean;           // count layers/groups/shapes periodically
  collectMemory?: boolean;        // use performance.memory when available (Chromium)
}

/**
 * Lightweight canvas performance monitor for Konva.
 * - FPS and frame time via rAF.
 * - Optional layer draw() duration by instance patching.
 * - Periodic metrics publish for overlay/HUD.
 */
export class CanvasMonitor {
  private stage: Konva.Stage | null = null;
  private layers: Konva.Layer[] = [];
  private readonly subs = new Set<Subscriber>();

  private rafId: number | null = null;
  private lastTs = 0;
  private fps = 60;
  private frameMs = 16.7;

  private readonly layerDur = new Map<string, number>(); // layerId -> last draw ms
  private readonly originalDraw = new Map<string, () => void>(); // layerId -> original draw

  private intervalId: number | null = null;
  private readonly opts: Required<CanvasMonitorOptions>;

  constructor(options?: CanvasMonitorOptions) {
    this.opts = {
      sampleIntervalMs: options?.sampleIntervalMs ?? 250,
      smoothFactor: options?.smoothFactor ?? 0.15,
      instrumentLayerDraws: options?.instrumentLayerDraws ?? true,
      countNodes: options?.countNodes ?? false,
      collectMemory: options?.collectMemory ?? false,
    };
  }

  attachStage(stage: Konva.Stage): void {
    this.stage = stage;
  }

  attachLayers(layers: Konva.Layer[]): void {
    this.detachLayerInstrumentation();
    this.layers = layers.slice();
    if (this.opts.instrumentLayerDraws) {
      this.instrumentLayers();
    }
  }

  subscribe(fn: Subscriber): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  start(): void {
    if (this.rafId != null) return;
    const loop = (ts: number) => {
      if (this.lastTs > 0) {
        const dt = ts - this.lastTs;
        // EMA smoothing for FPS
        const instFps = dt > 0 ? 1000 / dt : 0;
        this.fps = this.opts.smoothFactor * this.fps + (1 - this.opts.smoothFactor) * instFps;
        this.frameMs = dt;
      }
      this.lastTs = ts;
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);

    if (this.intervalId == null) {
      this.intervalId = window.setInterval(() => this.publish(), this.opts.sampleIntervalMs);
    }
  }

  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.detachLayerInstrumentation();
  }

  private instrumentLayers(): void {
    for (const layer of this.layers) {
      const id = layer._id?.toString?.() ?? layer.id() ?? `layer_${Math.random().toString(36).slice(2)}`;
      if (this.originalDraw.has(id)) continue;
      const original = layer.draw.bind(layer);
      // draw() is synchronous; safe to time around call
      const patched = () => {
        const t0 = performance.now();
        // call original draw
        original();
        const t1 = performance.now();
        this.layerDur.set(id, t1 - t0);
      };
      // Patch instance draw
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer as any).draw = patched;
      this.originalDraw.set(id, original);
      this.layerDur.set(id, 0);
    }
  }

  private detachLayerInstrumentation(): void {
    for (const layer of this.layers) {
      const id = layer._id?.toString?.() ?? layer.id();
      if (!id) continue;
      const original = this.originalDraw.get(id);
      if (original) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (layer as any).draw = original;
      }
    }
    this.originalDraw.clear();
    this.layerDur.clear();
  }

  private countNodes() {
    if (!this.stage) return undefined;
    // Light counting via tree walk; run only on interval to limit cost
    let layers = 0;
    let groups = 0;
    let shapes = 0;
    const stack = [this.stage as Konva.Node];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      const name = node.getClassName?.();
      if (name === 'Layer' || name === 'FastLayer') layers++;
      else if (name === 'Group') groups++;
      else if (name && name !== 'Stage') shapes++;
      if ((node as Konva.Container)?.getChildren) {
        const kids = (node as Konva.Container).getChildren();
        for (let i = 0; i < kids.length; i++) stack.push(kids[i]);
      }
    }
    return { layers, groups, shapes };
  }

  private collectMemory() {
    // Chromium-only; ignored elsewhere
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (performance as any).memory;
    if (!mem) return undefined;
    const toMB = (b: number) => Math.round((b / (1024 * 1024)) * 10) / 10;
    return {
      jsHeapUsedMB: toMB(mem.usedJSHeapSize),
      jsHeapTotalMB: toMB(mem.totalJSHeapSize),
    };
  }

  private publish(): void {
    const layers: LayerDrawMetric[] = this.layers.map((ly) => {
      const id = ly._id?.toString?.() ?? ly.id() ?? 'layer';
      return {
        id,
        name: ly.name(),
        lastDrawMs: this.layerDur.get(id) ?? 0,
      };
    });

    const metrics: CanvasMetrics = {
      fps: Math.round(this.fps * 10) / 10,
      frameMs: Math.round(this.frameMs * 10) / 10,
      layers,
      nodes: this.opts.countNodes ? this.countNodes() : undefined,
      memory: this.opts.collectMemory ? this.collectMemory() : undefined,
      timestamp: Date.now(),
    };

    this.subs.forEach((fn) => fn(metrics));
  }
}