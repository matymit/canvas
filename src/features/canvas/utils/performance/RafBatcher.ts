// features/canvas/utils/performance/RafBatcher.ts
//
// Per-frame batching for high-frequency inputs (pointermove, drag, wheel) and canvas updates,
// coalescing to a single RAF and single draw per Layer per frame, with separate queues for
// "writes" (mutations) and "reads" (post-draw/low-priority).
// When flushing inside RAF, draw() is used to reduce one extra-frame latency vs batchDraw()
// in tight interactions, while still exposing batchDraw() for deferred draws.

import Konva from 'konva';

type VoidFn = () => void;

function requestIdle(fn: VoidFn, timeout = 100) {
  const ric = (globalThis as any).requestIdleCallback as undefined | ((cb: any, opts?: any) => number);
  if (ric) return ric(fn, { timeout });
  return setTimeout(fn, 0) as unknown as number;
}

function cancelIdle(id: number) {
  const cic = (globalThis as any).cancelIdleCallback as undefined | ((id: number) => void);
  if (cic) return cic(id);
  clearTimeout(id as unknown as number);
}

export interface RafBatcherOptions {
  preferImmediateDrawInRAF?: boolean; // default true
}

export class RafBatcher {
  private writes = new Set<VoidFn>();
  private reads = new Set<VoidFn>();
  private layers = new Set<Konva.Layer>();
  private scheduled = false;
  private rafId: number | null = null;
  private idleId: number | null = null;
  private preferImmediateDraw: boolean;

  constructor(opts: RafBatcherOptions = {}) {
    this.preferImmediateDraw = opts.preferImmediateDrawInRAF ?? true;
  }

  enqueueWrite(fn: VoidFn) {
    this.writes.add(fn);
    this.schedule();
  }

  enqueueRead(fn: VoidFn) {
    this.reads.add(fn);
    this.schedule();
  }

  requestLayerDraw(layer: Konva.Layer) {
    this.layers.add(layer);
    this.schedule();
  }

  flushNow() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.scheduled = false;
    this.runRAF(this.now());
  }

  dispose() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    if (this.idleId != null) cancelIdle(this.idleId);
    this.rafId = null;
    this.idleId = null;
    this.scheduled = false;
    this.writes.clear();
    this.reads.clear();
    this.layers.clear();
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    this.rafId = requestAnimationFrame((ts) => this.runRAF(ts));
  }

  private runRAF(_ts: number) {
    this.rafId = null;
    this.scheduled = false;

    // 1) Mutations (Konva node property updates, layout transforms, etc.).
    const writes = Array.from(this.writes);
    this.writes.clear();
    for (const fn of writes) {
      try { fn(); } catch (e) { /* swallow */ }
    }

    // 2) Draw once per Layer for this frame. Prefer draw() inside RAF to reduce latency.
    const layers = Array.from(this.layers);
    this.layers.clear();
    for (const layer of layers) {
      try {
        if (this.preferImmediateDraw) {
          layer.draw();
        } else {
          layer.batchDraw();
        }
      } catch (e) { /* swallow */ }
    }

    // 3) Low-priority reads after we requested paint; prefer idle so we don't fight layout/paint.
    const reads = Array.from(this.reads);
    this.reads.clear();
    if (reads.length) {
      this.idleId = requestIdle(() => {
        this.idleId = null;
        for (const fn of reads) {
          try { fn(); } catch (e) { /* swallow */ }
        }
      });
    }
  }

  private now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
}