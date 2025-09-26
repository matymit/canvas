// features/canvas/utils/performance/performanceMonitor.ts
//
// FPS + Jank monitor using requestAnimationFrame and the Long Tasks API (if available).
// Emits rolling FPS calculated over a window and logs LongTask entries via PerformanceObserver.
// Falls back gracefully if the Long Tasks API is not supported.

import type { PerformanceLogger } from './performanceLogger';

export interface PerformanceMonitorOptions {
  fpsWindowMs?: number;   // Window over which to average FPS (default 1000ms)
  emitEveryMs?: number;   // Emit cadence for consumer callback (default 500ms)
  logger?: PerformanceLogger;
}

export interface PerfSnapshot {
  fps: number;
  frameMsAvg: number;
  frames: number;
  windowMs: number;
  totalLongTaskMs: number;
  longTaskCount: number;
  ts: number;
}

export type PerfListener = (snap: PerfSnapshot) => void;

export class PerformanceMonitor {
  private running = false;
  private rafId: number | null = null;
  private lastTick = 0;
  private samples: number[] = [];
  private lastEmit = 0;
  private readonly fpsWindowMs: number;
  private readonly emitEveryMs: number;
  private listener?: PerfListener;
  private longTaskMs = 0;
  private longTaskCount = 0;
  private po?: PerformanceObserver;
  private readonly logger?: PerformanceLogger;

  constructor(opts: PerformanceMonitorOptions = {}) {
    this.fpsWindowMs = Math.max(250, opts.fpsWindowMs ?? 1000);
    this.emitEveryMs = Math.max(100, opts.emitEveryMs ?? 500);
    this.logger = opts.logger;
    this.setupLongTaskObserver();
  }

  private setupLongTaskObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.po = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // entry.duration is the "long task" duration on main thread.
            this.longTaskMs += entry.duration;
            this.longTaskCount += 1;
            this.logger?.logLongTask(entry.duration);
          }
        });
        // "longtask" is the Long Tasks API entryType in supporting browsers.
        this.po.observe({ entryTypes: ['longtask'] as string[] });
      } catch {
        // ignore if unsupported
      }
    }
  }

  onSnapshot(fn: PerfListener) {
    this.listener = fn;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTick = this.now();
    this.lastEmit = this.lastTick;
    const loop = (ts: number) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);
      const now = ts || this.now();
      const dt = now - this.lastTick;
      this.lastTick = now;
      if (dt > 0 && dt < 1000) {
        this.samples.push(dt);
      }
      // Keep samples inside window.
      let acc = 0;
      for (let i = this.samples.length - 1; i >= 0; i--) {
        acc += this.samples[i];
        if (acc > this.fpsWindowMs) {
          this.samples = this.samples.slice(i);
          break;
        }
      }
      if (now - this.lastEmit >= this.emitEveryMs) {
        const frames = this.samples.length || 1;
        const sum = this.samples.reduce((a, b) => a + b, 0) || 16.67;
        const frameMsAvg = sum / frames;
        const fps = 1000 / frameMsAvg;
        const snap: PerfSnapshot = {
          fps,
          frameMsAvg,
          frames,
          windowMs: Math.min(sum, this.fpsWindowMs),
          totalLongTaskMs: this.longTaskMs,
          longTaskCount: this.longTaskCount,
          ts: now,
        };
        this.listener?.(snap);
        this.logger?.logFPS(snap.fps, snap.frameMsAvg, snap.windowMs);
        this.lastEmit = now;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.po) {
      try { this.po.disconnect(); } catch { /* Debug: Performance observer disconnect failed */ }
    }
  }

  private now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
}