// features/canvas/utils/performance/MemoryManager.ts
//
// Comprehensive memory management system for the canvas application.
// Handles cleanup of Konva nodes, event listeners, timers, and other resources
// to prevent memory leaks and optimize performance.

import type Konva from 'konva';

// Resource tracking interface
interface ManagedResource {
  id: string;
  type: 'konva-node' | 'event-listener' | 'timer' | 'animation' | 'observer' | 'custom';
  resource: unknown;
  cleanup: () => void;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

// Memory usage tracking
interface MemoryMetrics {
  managedResources: number;
  konvaNodes: number;
  eventListeners: number;
  timers: number;
  animations: number;
  totalHeapUsed?: number;
  totalHeapSize?: number;
  lastGC?: number;
}

// Configuration options
interface MemoryManagerConfig {
  maxResourceAge: number; // Maximum age in ms before forcing cleanup
  gcInterval: number; // Garbage collection check interval
  enableMetrics: boolean; // Whether to track detailed metrics
  enableAutoCleanup: boolean; // Whether to automatically cleanup old resources
  resourceLimits: {
    konvaNodes: number;
    eventListeners: number;
    timers: number;
  };
}

export class MemoryManager {
  private readonly resources = new Map<string, ManagedResource>();
  private nextId = 0;
  private gcTimer: number | null = null;
  private readonly config: MemoryManagerConfig;
  private readonly metrics: MemoryMetrics = {
    managedResources: 0,
    konvaNodes: 0,
    eventListeners: 0,
    timers: 0,
    animations: 0,
  };

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    this.config = {
      maxResourceAge: 5 * 60 * 1000, // 5 minutes
      gcInterval: 30 * 1000, // 30 seconds
      enableMetrics: true,
      enableAutoCleanup: true,
      resourceLimits: {
        konvaNodes: 1000,
        eventListeners: 500,
        timers: 100,
      },
      ...config,
    };

    if (this.config.enableAutoCleanup) {
      this.startGarbageCollection();
    }
  }

  // Register a Konva node for cleanup tracking
  trackKonvaNode(node: Konva.Node, metadata?: Record<string, unknown>): string {
    const id = this.generateId();
    const resource: ManagedResource = {
      id,
      type: 'konva-node',
      resource: node,
      cleanup: () => {
        try {
          // Remove from parent first
          node.remove();
          
          // Clear all event listeners
          node.off();
          
          // Stop any animations/tweens
          node.stopDrag?.();
          
          // Destroy the node
          node.destroy();
        } catch (error) {
          // Warning: Error cleaning up Konva node
        }
      },
      createdAt: Date.now(),
      metadata,
    };
    
    this.resources.set(id, resource);
    this.updateMetrics();
    this.checkResourceLimits();
    
    return id;
  }

  // Register an event listener for cleanup tracking
  trackEventListener(
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    metadata?: Record<string, unknown>
  ): string {
    const id = this.generateId();
    
    // Add the listener
    target.addEventListener(event, listener, options);
    
    const resource: ManagedResource = {
      id,
      type: 'event-listener',
      resource: { target, event, listener, options },
      cleanup: () => {
        try {
          target.removeEventListener(event, listener, options);
        } catch (error) {
          // Warning: Error cleaning up event listener
        }
      },
      createdAt: Date.now(),
      metadata,
    };
    
    this.resources.set(id, resource);
    this.updateMetrics();
    this.checkResourceLimits();
    
    return id;
  }

  // Register a timer for cleanup tracking
  trackTimer(timerId: number, type: 'timeout' | 'interval' = 'timeout', metadata?: Record<string, unknown>): string {
    const id = this.generateId();
    const resource: ManagedResource = {
      id,
      type: 'timer',
      resource: { timerId, type },
      cleanup: () => {
        try {
          if (type === 'timeout') {
            clearTimeout(timerId);
          } else {
            clearInterval(timerId);
          }
        } catch (error) {
          // Warning: Error cleaning up timer
        }
      },
      createdAt: Date.now(),
      metadata,
    };
    
    this.resources.set(id, resource);
    this.updateMetrics();
    
    return id;
  }

  // Register an animation frame request
  trackAnimationFrame(frameId: number, metadata?: Record<string, unknown>): string {
    const id = this.generateId();
    const resource: ManagedResource = {
      id,
      type: 'animation',
      resource: frameId,
      cleanup: () => {
        try {
          cancelAnimationFrame(frameId);
        } catch (error) {
          // Warning: Error cleaning up animation frame
        }
      },
      createdAt: Date.now(),
      metadata,
    };
    
    this.resources.set(id, resource);
    this.updateMetrics();
    
    return id;
  }

  // Register a custom resource with cleanup function
  trackCustomResource(
    resource: unknown,
    cleanup: () => void,
    metadata?: Record<string, unknown>
  ): string {
    const id = this.generateId();
    const managedResource: ManagedResource = {
      id,
      type: 'custom',
      resource,
      cleanup,
      createdAt: Date.now(),
      metadata,
    };
    
    this.resources.set(id, managedResource);
    this.updateMetrics();
    
    return id;
  }

  // Clean up a specific resource
  cleanup(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;
    
    try {
      resource.cleanup();
      this.resources.delete(resourceId);
      this.updateMetrics();
      return true;
    } catch (error) {
      // Warning: Error during resource cleanup
      // Still remove from tracking even if cleanup failed
      this.resources.delete(resourceId);
      this.updateMetrics();
      return false;
    }
  }

  // Clean up all resources of a specific type
  cleanupByType(type: ManagedResource['type']): number {
    let cleaned = 0;
    const toCleanup = Array.from(this.resources.values()).filter(r => r.type === type);
    
    for (const resource of toCleanup) {
      if (this.cleanup(resource.id)) {
        cleaned++;
      }
    }
    
    return cleaned;
  }

  // Clean up resources older than specified age
  cleanupOlderThan(maxAge: number): number {
    const now = Date.now();
    let cleaned = 0;
    const toCleanup = Array.from(this.resources.values())
      .filter(r => now - r.createdAt > maxAge);
    
    for (const resource of toCleanup) {
      if (this.cleanup(resource.id)) {
        cleaned++;
      }
    }
    
    return cleaned;
  }

  // Clean up all tracked resources
  cleanupAll(): number {
    let cleaned = 0;
    const resourceIds = Array.from(this.resources.keys());
    
    for (const id of resourceIds) {
      if (this.cleanup(id)) {
        cleaned++;
      }
    }
    
    return cleaned;
  }

  // Force garbage collection (if available)
  forceGC(): void {
    if (typeof (globalThis as unknown as { gc?: () => void }).gc === 'function') {
      try {
        (globalThis as unknown as { gc: () => void }).gc();
        this.metrics.lastGC = Date.now();
      } catch (error) {
        // Warning: Failed to force garbage collection
      }
    }
  }

  // Get current memory metrics
  getMetrics(): MemoryMetrics {
    if (this.config.enableMetrics) {
      // Update heap metrics if available
      const perf = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      if (perf) {
        this.metrics.totalHeapUsed = perf.usedJSHeapSize;
        this.metrics.totalHeapSize = perf.totalJSHeapSize;
      }
    }
    
    return { ...this.metrics };
  }

  // Get resources by type
  getResourcesByType(type: ManagedResource['type']): ManagedResource[] {
    return Array.from(this.resources.values()).filter(r => r.type === type);
  }

  // Get resource details
  getResource(resourceId: string): ManagedResource | undefined {
    return this.resources.get(resourceId);
  }

  // Check if we're approaching resource limits and trigger cleanup if needed
  private checkResourceLimits(): void {
    const { resourceLimits } = this.config;
    
    if (this.metrics.konvaNodes > resourceLimits.konvaNodes) {
      // Warning: Konva node limit exceeded
      this.cleanupOldestByType('konva-node', Math.floor(resourceLimits.konvaNodes * 0.2));
    }
    
    if (this.metrics.eventListeners > resourceLimits.eventListeners) {
      // Warning: Event listener limit exceeded
      this.cleanupOldestByType('event-listener', Math.floor(resourceLimits.eventListeners * 0.2));
    }
    
    if (this.metrics.timers > resourceLimits.timers) {
      // Warning: Timer limit exceeded
      this.cleanupOldestByType('timer', Math.floor(resourceLimits.timers * 0.2));
    }
  }

  // Clean up the oldest resources of a specific type
  private cleanupOldestByType(type: ManagedResource['type'], count: number): number {
    const resources = this.getResourcesByType(type)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, count);
    
    let cleaned = 0;
    for (const resource of resources) {
      if (this.cleanup(resource.id)) {
        cleaned++;
      }
    }
    
    return cleaned;
  }

  // Update internal metrics
  private updateMetrics(): void {
    if (!this.config.enableMetrics) return;
    
    this.metrics.managedResources = this.resources.size;
    this.metrics.konvaNodes = this.getResourcesByType('konva-node').length;
    this.metrics.eventListeners = this.getResourcesByType('event-listener').length;
    this.metrics.timers = this.getResourcesByType('timer').length;
    this.metrics.animations = this.getResourcesByType('animation').length;
  }

  // Generate unique resource ID
  private generateId(): string {
    return `mem-${Date.now()}-${++this.nextId}`;
  }

  // Start automatic garbage collection
  private startGarbageCollection(): void {
    if (this.gcTimer) return;
    
    this.gcTimer = setInterval(() => {
      // Clean up old resources
      const cleaned = this.cleanupOlderThan(this.config.maxResourceAge);
      
      if (cleaned > 0) {
        // Memory manager cleaned up old resources
      }
      
      // Force GC periodically if memory usage is high
      const metrics = this.getMetrics();
      if (metrics.totalHeapUsed && metrics.totalHeapSize) {
        const usage = metrics.totalHeapUsed / metrics.totalHeapSize;
        if (usage > 0.8) {
          this.forceGC();
        }
      }
    }, this.config.gcInterval) as unknown as number;
    
    // Track the GC timer itself
    this.trackTimer(this.gcTimer, 'interval', { purpose: 'memory-manager-gc' });
  }

  // Stop automatic garbage collection and cleanup
  dispose(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    // Clean up all tracked resources
    this.cleanupAll();
  }
}

// Singleton instance for global use
let globalMemoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new MemoryManager();
  }
  return globalMemoryManager;
}

export function disposeMemoryManager(): void {
  if (globalMemoryManager) {
    globalMemoryManager.dispose();
    globalMemoryManager = null;
  }
}

// Utility functions for common memory management tasks
export const memoryUtils = {
  // Track a Konva node with automatic cleanup
  trackNode: (node: Konva.Node, metadata?: Record<string, unknown>) => 
    getMemoryManager().trackKonvaNode(node, metadata),
  
  // Track an event listener with automatic cleanup
  trackListener: (
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    metadata?: Record<string, unknown>
  ) => getMemoryManager().trackEventListener(target, event, listener, options, metadata),
  
  // Track a timer with automatic cleanup
  trackTimer: (timerId: number, type: 'timeout' | 'interval' = 'timeout', metadata?: Record<string, unknown>) =>
    getMemoryManager().trackTimer(timerId, type, metadata),
  
  // Track an animation frame with automatic cleanup
  trackAnimation: (frameId: number, metadata?: Record<string, unknown>) =>
    getMemoryManager().trackAnimationFrame(frameId, metadata),
  
  // Clean up a specific resource
  cleanup: (resourceId: string) => getMemoryManager().cleanup(resourceId),
  
  // Get current memory metrics
  getMetrics: () => getMemoryManager().getMetrics(),
  
  // Force cleanup of old resources
  cleanupOld: (maxAge?: number) => 
    getMemoryManager().cleanupOlderThan(maxAge ?? 5 * 60 * 1000),
};

export default MemoryManager;