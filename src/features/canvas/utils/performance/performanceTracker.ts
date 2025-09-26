// features/canvas/utils/performance/performanceTracker.ts
//
// Opinionated wrapper for timing labeled tasks and aggregating basic stats (count, total, avg, max).
// Complements PerformanceLogger by exposing an in-app API to instrument hotspots.

import type { PerformanceLogger } from './performanceLogger';

export interface Stat {
  name: string;
  count: number;
  total: number;
  max: number;
  avg: number;
}

export class PerformanceTracker {
  private readonly stats = new Map<string, { count: number; total: number; max: number }>();
  private readonly logger?: PerformanceLogger;

  constructor(logger?: PerformanceLogger) {
    this.logger = logger;
  }

  start(_label: string): number {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  end(label: string, startTs: number, meta?: Record<string, unknown>) {
    const endTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const d = endTs - startTs;
    const s = this.stats.get(label) ?? { count: 0, total: 0, max: 0 };
    s.count += 1;
    s.total += d;
    s.max = Math.max(s.max, d);
    this.stats.set(label, s);
    this.logger?.measure(label, startTs, endTs, meta);
    return d;
  }

  time<T>(label: string, fn: () => T, meta?: Record<string, unknown>): T {
    const s = this.start(label);
    try {
      return fn();
    } finally {
      this.end(label, s, meta);
    }
  }

  async timeAsync<T>(label: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T> {
    const s = this.start(label);
    try {
      const res = await fn();
      this.end(label, s, meta);
      return res;
    } catch (e) {
      this.end(label, s, { ...(meta ?? {}), error: true });
      throw e;
    }
  }

  snapshot(): Stat[] {
    return Array.from(this.stats.entries()).map(([name, s]) => ({
      name,
      count: s.count,
      total: s.total,
      max: s.max,
      avg: s.total / Math.max(1, s.count),
    }));
  }

  reset() {
    this.stats.clear();
  }
}