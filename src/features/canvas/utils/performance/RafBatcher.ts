import type Konva from 'konva';

export interface RafBatcherFlushStats {
  readCount: number;
  writeCount: number;
  drawCount: number;
}

export interface RafBatcherOptions {
  preferImmediateDrawInRAF?: boolean;
  onFlush?: (stats: RafBatcherFlushStats) => void;
}

export class RafBatcher {
  protected reads: Array<() => void> = [];
  protected writes: Array<() => void> = [];
  protected layersToDraw = new Set<Konva.Layer>();
  protected rafId: number | null = null;
  protected preferImmediateDraw: boolean;
  protected onFlush?: (stats: RafBatcherFlushStats) => void;

  constructor(opts: RafBatcherOptions = {}) {
    this.preferImmediateDraw = opts.preferImmediateDrawInRAF ?? false;
    this.onFlush = opts.onFlush;
  }

  // The `schedule` method from my simple version is like a 'write' operation.
  // I'll keep it and make it an alias for enqueueWrite for compatibility with my recent refactors.
  schedule(fn: () => void): boolean {
    return this.enqueueWrite(fn);
  }

  enqueueWrite(fn: () => void): boolean {
    this.writes.push(fn);
    this.requestFlush();
    return true;
  }

  enqueueRead(fn: () => void): boolean {
    this.reads.push(fn);
    this.requestFlush();
    return true;
  }

  requestLayerDraw(layer: Konva.Layer): boolean {
    this.layersToDraw.add(layer);
    this.requestFlush();
    return true;
  }

  protected requestFlush() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flushNow());
    }
  }

  flushNow() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Execute reads first
    const reads = this.reads;
    this.reads = [];
    const readCount = reads.length;
    for (const task of reads) {
      try { task(); } catch (e) { /* ignore */ }
    }

    // Execute writes next
    const writes = this.writes;
    this.writes = [];
    const writeCount = writes.length;
    for (const task of writes) {
      try { task(); } catch (e) { /* ignore */ }
    }

    // Execute draws last
    const layers = this.layersToDraw;
    this.layersToDraw = new Set();
    const drawCount = layers.size;
    for (const layer of layers) {
      try {
        if (this.preferImmediateDraw) {
          layer.draw();
        } else {
          layer.batchDraw();
        }
      } catch (e) { /* ignore */ }
    }

    if (this.onFlush) {
      try {
        this.onFlush({ readCount, writeCount, drawCount });
      } catch (e) {
        // ignore instrumentation errors
      }
    }
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.reads = [];
    this.writes = [];
    this.layersToDraw.clear();
    this.onFlush = undefined;
  }

  setOnFlush(handler: ((stats: RafBatcherFlushStats) => void) | undefined) {
    this.onFlush = handler;
  }
}
