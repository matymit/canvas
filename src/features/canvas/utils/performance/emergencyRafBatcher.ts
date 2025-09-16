// features/canvas/utils/performance/emergencyRafBatcher.ts
//
// Extends RafBatcher with "emergency flush" fallbacks for background tabs or throttled RAF,
// ensuring progress when rAF is paused or delayed by visibility throttling.
// Uses setTimeout race to flush if no RAF arrived within a max latency budget.

import Konva from 'konva';
import { RafBatcher } from './RafBatcher';

export interface EmergencyRafBatcherOptions {
  maxLatencyMs?: number; // maximum wait for RAF before fallback (default 32ms ~ 2 frames @60Hz)
  preferImmediateDrawInRAF?: boolean;
}

export class EmergencyRafBatcher extends RafBatcher {
  private maxLatency: number;
  private timerId: number | null = null;
  private pending = false;

  constructor(opts: EmergencyRafBatcherOptions = {}) {
    super({ preferImmediateDrawInRAF: opts.preferImmediateDrawInRAF });
    this.maxLatency = Math.max(8, opts.maxLatencyMs ?? 32);
  }

  override enqueueWrite(fn: () => void) {
    super.enqueueWrite(fn);
    this.armTimer();
  }

  override enqueueRead(fn: () => void) {
    super.enqueueRead(fn);
    this.armTimer();
  }

  override requestLayerDraw(layer: Konva.Layer) {
    super.requestLayerDraw(layer);
    this.armTimer();
  }

  override flushNow() {
    this.disarmTimer();
    super.flushNow();
  }

  override dispose() {
    this.disarmTimer();
    super.dispose();
  }

  private armTimer() {
    if (this.pending) return;
    this.pending = true;

    const delay = (typeof document !== 'undefined' && document.hidden) ? 100 : this.maxLatency; // more relaxed in bg tabs.
    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.pending = false;
      // If RAF didn't arrive in time, flush via fallback to keep UI responsive.
      super.flushNow();
    }, delay) as unknown as number;
  }

  private disarmTimer() {
    if (this.timerId != null) {
      clearTimeout(this.timerId as unknown as number);
      this.timerId = null;
    }
    this.pending = false;
  }
}