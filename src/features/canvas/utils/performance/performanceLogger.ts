// features/canvas/utils/performance/performanceLogger.ts
//
// Lightweight structured performance logger with marks, measures, and a ring buffer,
// using the High Resolution Time API and (optionally) Performance API marks if available.
// Includes a per-scope timer helper for simple timing of code paths.

export type PerfEvent =
  | { type: 'measure'; name: string; duration: number; start: number; end: number; meta?: Record<string, unknown> }
  | { type: 'mark'; name: string; ts: number; meta?: Record<string, unknown> }
  | { type: 'fps'; fps: number; frameMsAvg: number; ts: number; window: number }
  | { type: 'longtask'; duration: number; ts: number }
  | { type: 'custom'; name: string; ts: number; meta?: Record<string, unknown> };

export interface PerformanceLoggerOptions {
  bufferSize?: number;
  console?: boolean;
}

export class PerformanceLogger {
  private buffer: PerfEvent[] = [];
  private readonly size: number;
  private readonly enableConsole: boolean;

  constructor(opts: PerformanceLoggerOptions = {}) {
    this.size = Math.max(32, opts.bufferSize ?? 512);
    this.enableConsole = !!opts.console;
  }

  private push(ev: PerfEvent) {
    if (this.buffer.length >= this.size) this.buffer.shift();
    this.buffer.push(ev);
    if (this.enableConsole) {
      // Small, structured console trace to help during development.
      // Debug: [perf:${ev.type}] ${JSON.stringify(ev)}
    }
  }

  now(): number {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  mark(name: string, meta?: Record<string, unknown>) {
    const ts = this.now();
    if (typeof performance !== 'undefined' && performance.mark) {
      try { performance.mark(name); } catch { /* Performance mark failed - ignore */ }
    }
    this.push({ type: 'mark', name, ts, meta });
    return ts;
  }

  measure(name: string, start: number, end?: number, meta?: Record<string, unknown>) {
    const t1 = end ?? this.now();
    const duration = t1 - start;
    if (typeof performance !== 'undefined' && performance.measure) {
      try { performance.measure(name, { start, end: t1 }); } catch { /* Performance measure failed - ignore */ }
    }
    this.push({ type: 'measure', name, duration, start, end: t1, meta });
    return duration;
  }

  timed<T>(name: string, fn: () => T, meta?: Record<string, unknown>): T {
    const s = this.now();
    try {
      return fn();
    } finally {
      this.measure(name, s, undefined, meta);
    }
  }

  timedAsync<T>(name: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T> {
    const s = this.now();
    return fn()
      .then((res) => {
        this.measure(name, s, undefined, meta);
        return res;
      })
      .catch((err) => {
        this.measure(name, s, undefined, { ...(meta ?? {}), error: true });
        throw err;
      });
  }

  logFPS(fps: number, frameMsAvg: number, window: number) {
    const ts = this.now();
    this.push({ type: 'fps', fps, frameMsAvg, ts, window });
  }

  logLongTask(duration: number) {
    this.push({ type: 'longtask', duration, ts: this.now() });
  }

  log(name: string, meta?: Record<string, unknown>) {
    this.push({ type: 'custom', name, ts: this.now(), meta });
  }

  getEvents(): PerfEvent[] {
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
  }
}