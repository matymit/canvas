// features/canvas/utils/performance/RafBatcher.ts
//
// Per-frame batching for high-frequency inputs (pointermove, drag, wheel) and canvas updates,
// coalescing to a single RAF and single draw per Layer per frame, with separate queues for
// "writes" (mutations) and "reads" (post-draw/low-priority).
// When flushing inside RAF, draw() is used to reduce one extra-frame latency vs batchDraw()
// in tight interactions, while still exposing batchDraw() for deferred draws.
// Enhanced with memory leak prevention and resource tracking.

import Konva from 'konva';
import { memoryUtils } from './MemoryManager';

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
  maxQueueSize?: number; // Maximum number of queued operations before warning
  enableMetrics?: boolean; // Whether to track performance metrics
  memoryCleanupInterval?: number; // Interval for memory cleanup checks (ms)
}

export interface RafBatcherMetrics {
  totalFrames: number;
  totalWrites: number;
  totalReads: number;
  totalLayerDraws: number;
  averageWritesPerFrame: number;
  averageReadsPerFrame: number;
  averageLayersPerFrame: number;
  queueOverflows: number;
  lastFrameTime: number;
}

export class RafBatcher {
  private writes = new Set<VoidFn>();
  private reads = new Set<VoidFn>();
  private layers = new Set<Konva.Layer>();
  private layerRefs = new WeakSet<Konva.Layer>(); // Track layer references for cleanup
  private scheduled = false;
  private rafId: number | null = null;
  private idleId: number | null = null;
  private memoryCleanupTimer: number | null = null;
  
  private config: Required<RafBatcherOptions>;
  private metrics: RafBatcherMetrics;
  private isDisposed = false;
  
  // Track memory resources
  private rafTrackingId: string | null = null;
  private idleTrackingId: string | null = null;
  private cleanupTrackingId: string | null = null;

  constructor(opts: RafBatcherOptions = {}) {
    this.config = {
      preferImmediateDrawInRAF: opts.preferImmediateDrawInRAF ?? true,
      maxQueueSize: opts.maxQueueSize ?? 1000,
      enableMetrics: opts.enableMetrics ?? false,
      memoryCleanupInterval: opts.memoryCleanupInterval ?? 60000, // 1 minute
    };
    
    this.metrics = {
      totalFrames: 0,
      totalWrites: 0,
      totalReads: 0,
      totalLayerDraws: 0,
      averageWritesPerFrame: 0,
      averageReadsPerFrame: 0,
      averageLayersPerFrame: 0,
      queueOverflows: 0,
      lastFrameTime: 0,
    };
    
    this.startMemoryCleanup();
  }

  enqueueWrite(fn: VoidFn): boolean {
    if (this.isDisposed) {
      console.warn('RafBatcher: Cannot enqueue write after disposal');
      return false;
    }
    
    // Check queue size limits
    if (this.writes.size >= this.config.maxQueueSize) {
      console.warn(`RafBatcher: Write queue overflow (${this.writes.size}/${this.config.maxQueueSize})`);
      if (this.config.enableMetrics) {
        this.metrics.queueOverflows++;
      }
      return false;
    }
    
    this.writes.add(fn);
    this.schedule();
    return true;
  }

  enqueueRead(fn: VoidFn): boolean {
    if (this.isDisposed) {
      console.warn('RafBatcher: Cannot enqueue read after disposal');
      return false;
    }
    
    // Check queue size limits
    if (this.reads.size >= this.config.maxQueueSize) {
      console.warn(`RafBatcher: Read queue overflow (${this.reads.size}/${this.config.maxQueueSize})`);
      if (this.config.enableMetrics) {
        this.metrics.queueOverflows++;
      }
      return false;
    }
    
    this.reads.add(fn);
    this.schedule();
    return true;
  }

  requestLayerDraw(layer: Konva.Layer): boolean {
    if (this.isDisposed) {
      console.warn('RafBatcher: Cannot request layer draw after disposal');
      return false;
    }
    
    // Validate layer is still valid (check if it's still attached to a stage)
    if (!layer.getStage() || !layer.getParent()) {
      console.warn('RafBatcher: Attempted to draw destroyed layer');
      return false;
    }
    
    this.layers.add(layer);
    this.layerRefs.add(layer); // Track for cleanup
    this.schedule();
    return true;
  }

  flushNow(): void {
    if (this.isDisposed) return;
    
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      if (this.rafTrackingId) {
        memoryUtils.cleanup(this.rafTrackingId);
        this.rafTrackingId = null;
      }
    }
    
    this.rafId = null;
    this.scheduled = false;
    this.runRAF(this.now());
  }

  // Get performance metrics
  getMetrics(): RafBatcherMetrics {
    if (!this.config.enableMetrics) {
      console.warn('RafBatcher: Metrics not enabled');
      return { ...this.metrics };
    }
    
    // Calculate averages
    const totalFrames = this.metrics.totalFrames || 1; // Prevent division by zero
    this.metrics.averageWritesPerFrame = this.metrics.totalWrites / totalFrames;
    this.metrics.averageReadsPerFrame = this.metrics.totalReads / totalFrames;
    this.metrics.averageLayersPerFrame = this.metrics.totalLayerDraws / totalFrames;
    
    return { ...this.metrics };
  }

  // Get current queue sizes
  getQueueSizes(): { writes: number; reads: number; layers: number } {
    return {
      writes: this.writes.size,
      reads: this.reads.size,
      layers: this.layers.size,
    };
  }

  // Clear all queues (emergency cleanup)
  clearQueues(): void {
    const clearedWrites = this.writes.size;
    const clearedReads = this.reads.size;
    const clearedLayers = this.layers.size;
    
    this.writes.clear();
    this.reads.clear();
    this.layers.clear();
    
    if (clearedWrites + clearedReads + clearedLayers > 0) {
      console.debug(`RafBatcher: Cleared ${clearedWrites} writes, ${clearedReads} reads, ${clearedLayers} layers`);
    }
  }

  dispose(): void {
    if (this.isDisposed) return;
    
    this.isDisposed = true;
    
    // Cancel pending operations
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      if (this.rafTrackingId) {
        memoryUtils.cleanup(this.rafTrackingId);
      }
    }
    
    if (this.idleId != null) {
      cancelIdle(this.idleId);
      if (this.idleTrackingId) {
        memoryUtils.cleanup(this.idleTrackingId);
      }
    }
    
    if (this.memoryCleanupTimer != null) {
      clearInterval(this.memoryCleanupTimer);
      if (this.cleanupTrackingId) {
        memoryUtils.cleanup(this.cleanupTrackingId);
      }
    }
    
    // Clear all pending operations
    this.clearQueues();
    
    // Reset state
    this.rafId = null;
    this.idleId = null;
    this.memoryCleanupTimer = null;
    this.scheduled = false;
    this.rafTrackingId = null;
    this.idleTrackingId = null;
    this.cleanupTrackingId = null;
  }

  private schedule(): void {
    if (this.isDisposed || this.scheduled) return;
    
    this.scheduled = true;
    this.rafId = requestAnimationFrame((ts) => this.runRAF(ts));
    
    // Track the RAF request
    if (this.rafId !== null) {
      this.rafTrackingId = memoryUtils.trackAnimation(this.rafId, {
        source: 'RafBatcher',
        timestamp: Date.now(),
      });
    }
  }

  private runRAF(ts: number): void {
    if (this.isDisposed) return;
    
    // Clean up RAF tracking
    if (this.rafTrackingId) {
      memoryUtils.cleanup(this.rafTrackingId);
      this.rafTrackingId = null;
    }
    
    this.rafId = null;
    this.scheduled = false;
    
    const startTime = performance.now();
    
    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.totalFrames++;
      this.metrics.lastFrameTime = ts;
    }

    // 1) Mutations (Konva node property updates, layout transforms, etc.).
    const writes = Array.from(this.writes);
    this.writes.clear();
    
    if (this.config.enableMetrics) {
      this.metrics.totalWrites += writes.length;
    }
    
    for (const fn of writes) {
      try { 
        fn(); 
      } catch (e) { 
        console.error('Error in RAF write operation:', e);
      }
    }

    // 2) Draw once per Layer for this frame. Prefer draw() inside RAF to reduce latency.
    const layers = Array.from(this.layers);
    this.layers.clear();
    
    if (this.config.enableMetrics) {
      this.metrics.totalLayerDraws += layers.length;
    }
    
    for (const layer of layers) {
      try {
        // Validate layer is still valid before drawing (check if it's still attached to a stage)
        if (layer.getStage() && layer.getParent()) {
          if (this.config.preferImmediateDrawInRAF) {
            layer.draw();
          } else {
            layer.batchDraw();
          }
        } else {
          console.warn('RafBatcher: Skipping draw for destroyed layer');
        }
      } catch (e) { 
        console.error('Error drawing layer:', e);
      }
    }

    // 3) Low-priority reads after we requested paint; prefer idle so we don't fight layout/paint.
    const reads = Array.from(this.reads);
    this.reads.clear();
    
    if (this.config.enableMetrics) {
      this.metrics.totalReads += reads.length;
    }
    
    if (reads.length) {
      this.idleId = requestIdle(() => {
        if (this.isDisposed) return;
        
        // Clean up idle tracking
        if (this.idleTrackingId) {
          memoryUtils.cleanup(this.idleTrackingId);
          this.idleTrackingId = null;
        }
        
        this.idleId = null;
        
        for (const fn of reads) {
          try { 
            fn(); 
          } catch (e) { 
            console.error('Error in RAF read operation:', e);
          }
        }
      });
      
      // Track the idle request
      if (this.idleId !== null) {
        this.idleTrackingId = memoryUtils.trackTimer(this.idleId, 'timeout', {
          source: 'RafBatcher-idle',
          timestamp: Date.now(),
        });
      }
    }
    
    // Log performance warning if frame took too long
    const frameTime = performance.now() - startTime;
    if (frameTime > 16.67) { // More than one frame at 60fps
      console.warn(`RafBatcher: Slow frame detected (${frameTime.toFixed(2)}ms)`);
    }
  }

  private now(): number {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }
  
  private startMemoryCleanup(): void {
    if (this.memoryCleanupTimer !== null) return;
    
    this.memoryCleanupTimer = setInterval(() => {
      if (this.isDisposed) return;
      
      try {
        this.performMemoryCleanup();
      } catch (error) {
        console.warn('Error in RafBatcher memory cleanup:', error);
      }
    }, this.config.memoryCleanupInterval) as unknown as number;
    
    // Track the cleanup timer
    if (this.memoryCleanupTimer !== null) {
      this.cleanupTrackingId = memoryUtils.trackTimer(
        this.memoryCleanupTimer,
        'interval',
        {
          source: 'RafBatcher-cleanup',
          timestamp: Date.now(),
        }
      );
    }
  }
  
  private performMemoryCleanup(): void {
    // Clean up any stale layer references
    const staleLayers: Konva.Layer[] = [];
    
    for (const layer of this.layers) {
      if (!layer.getStage() || !layer.getParent()) {
        staleLayers.push(layer);
      }
    }
    
    // Remove stale layers
    for (const staleLayer of staleLayers) {
      this.layers.delete(staleLayer);
    }
    
    if (staleLayers.length > 0) {
      console.debug(`RafBatcher: Cleaned up ${staleLayers.length} stale layer references`);
    }
    
    // Check queue sizes and warn if they're growing unbounded
    const queueSizes = this.getQueueSizes();
    const totalQueueSize = queueSizes.writes + queueSizes.reads + queueSizes.layers;
    
    if (totalQueueSize > this.config.maxQueueSize * 0.8) {
      console.warn(
        `RafBatcher: Large queue detected (${totalQueueSize} total items). ` +
        `Consider calling flushNow() or check for runaway operations.`
      );
    }
    
    // Log metrics if enabled
    if (this.config.enableMetrics && this.metrics.totalFrames > 0) {
      const metrics = this.getMetrics();
      console.debug('RafBatcher metrics:', {
        frames: metrics.totalFrames,
        avgWrites: metrics.averageWritesPerFrame.toFixed(2),
        avgReads: metrics.averageReadsPerFrame.toFixed(2),
        avgLayers: metrics.averageLayersPerFrame.toFixed(2),
        overflows: metrics.queueOverflows,
      });
    }
  }
}