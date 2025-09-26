// features/canvas/utils/KonvaNodePool.ts
import type Konva from 'konva';
import { memoryUtils } from './performance/MemoryManager';

export type PoolKey = string;

export interface PoolFactory<T extends Konva.Node> {
  // Create a fresh node for this pool key.
  create: () => T;
  // Reset a node before putting it back into the pool (detach, clear state, etc.).
  // If not provided, a safe default reset will be used.
  reset?: (node: T) => void;
  // Dispose a node permanently (default destroys the node).
  dispose?: (node: T) => void;
  // Validate that a node is still safe to reuse (optional)
  validate?: (node: T) => boolean;
}

export interface PoolStats {
  totalKeys: number;
  totalNodes: number;
  totalAcquired: number;
  totalReused: number;
  totalCreated: number;
  totalDisposed: number;
  perKey: Array<{ key: PoolKey; size: number; max?: number; hitRate: number }>;
  memoryEstimateMB: number;
}

export interface PoolConfig {
  defaultMaxPerKey: number;
  enableMetrics: boolean;
  enableValidation: boolean;
  maxIdleTime: number; // Time before idle nodes are disposed (ms)
  gcInterval: number; // Garbage collection check interval (ms)
  memoryPressureThreshold: number; // When to start aggressive cleanup (0.8 = 80%)
}

interface NodeMetadata {
  lastUsed: number;
  timesReused: number;
  memoryTrackingId?: string;
}

export class KonvaNodePool {
  private readonly pools = new Map<PoolKey, Konva.Node[]>();
  private readonly factories = new Map<PoolKey, PoolFactory<Konva.Node>>();
  private readonly maxPerKey = new Map<PoolKey, number>();
  private readonly nodeToKey = new WeakMap<Konva.Node, PoolKey>();
  private readonly nodeMetadata = new WeakMap<Konva.Node, NodeMetadata>();
  private readonly stats = new Map<PoolKey, {
    acquired: number;
    reused: number;
    created: number;
    disposed: number;
  }>();
  
  private readonly config: PoolConfig;
  private gcTimer: number | null = null;
  private isDisposed = false;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = {
      defaultMaxPerKey: 64,
      enableMetrics: true,
      enableValidation: true,
      maxIdleTime: 2 * 60 * 1000, // 2 minutes
      gcInterval: 30 * 1000, // 30 seconds
      memoryPressureThreshold: 0.8,
      ...config,
    };

    this.startGarbageCollection();
  }

  register<T extends Konva.Node>(key: PoolKey, factory: PoolFactory<T>, maxPerKey?: number): void {
    if (this.isDisposed) return;

    this.factories.set(key, factory as unknown as PoolFactory<Konva.Node>);
    if (typeof maxPerKey === 'number') this.maxPerKey.set(key, maxPerKey);
    if (!this.pools.has(key)) this.pools.set(key, []);
    if (!this.stats.has(key)) {
      this.stats.set(key, { acquired: 0, reused: 0, created: 0, disposed: 0 });
    }
  }

  unregister(key: PoolKey, dispose = true): void {
    if (this.isDisposed) return;
    
    const pool = this.pools.get(key);
    if (dispose && pool) {
      const factory = this.factories.get(key);
      for (const node of pool) {
        this.safeDispose(node, factory);
      }
    }
    this.pools.delete(key);
    this.factories.delete(key);
    this.maxPerKey.delete(key);
    this.stats.delete(key);
  }

  acquire<T extends Konva.Node>(key: PoolKey): T {
    if (this.isDisposed) {
      throw new Error('KonvaNodePool has been disposed');
    }
    
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`KonvaNodePool: no factory registered for key "${key}"`);
    
    const pool = this.pools.get(key);
    const stats = this.stats.get(key);
    if (!pool || !stats) throw new Error(`KonvaNodePool: pool not found for key "${key}"`);
    let node: T;
    
    // Try to reuse an existing node
    if (pool.length > 0) {
      let reuseableNode: T | null = null;
      let reuseIndex = -1;
      
      // Find the most recently used valid node
      for (let i = pool.length - 1; i >= 0; i--) {
        const candidateNode = pool[i] as T;
        
        // Validate node if validation is enabled
        if (this.config.enableValidation && factory.validate) {
          if (!factory.validate(candidateNode)) {
            // Invalid node, remove and dispose
            pool.splice(i, 1);
            this.safeDispose(candidateNode, factory);
            stats.disposed++;
            continue;
          }
        }
        
        reuseableNode = candidateNode;
        reuseIndex = i;
        break;
      }
      
      if (reuseableNode) {
        node = reuseableNode;
        pool.splice(reuseIndex, 1);
        stats.reused++;
        
        // Update metadata
        const metadata = this.nodeMetadata.get(node);
        if (metadata) {
          metadata.lastUsed = Date.now();
          metadata.timesReused++;
        }
      } else {
        // No valid nodes available, create new one
        node = factory.create() as T;
        stats.created++;
        
        // Track in memory manager
        const memoryTrackingId = memoryUtils.trackNode(node, {
          poolKey: key,
          createdAt: Date.now(),
        });
        
        this.nodeMetadata.set(node, {
          lastUsed: Date.now(),
          timesReused: 0,
          memoryTrackingId,
        });
      }
    } else {
      // Pool is empty, create new node
      node = factory.create() as T;
      stats.created++;
      
      // Track in memory manager
      const memoryTrackingId = memoryUtils.trackNode(node, {
        poolKey: key,
        createdAt: Date.now(),
      });
      
      this.nodeMetadata.set(node, {
        lastUsed: Date.now(),
        timesReused: 0,
        memoryTrackingId,
      });
    }
    
    this.nodeToKey.set(node, key);
    stats.acquired++;
    
    return node;
  }

  release<T extends Konva.Node>(node: T): void {
    if (this.isDisposed) {
      // Pool is disposed, just destroy the node
      this.cleanupNode(node);
      return;
    }
    
    const key = this.nodeToKey.get(node);
    if (!key) {
      // Unknown node — destroy to avoid cross-pool contamination.
      this.cleanupNode(node);
      return;
    }
    
    const factory = this.factories.get(key);
    const pool = this.pools.get(key);
    const stats = this.stats.get(key);
    
    if (!pool || !stats) {
      // Pool was removed; dispose.
      this.safeDispose(node, factory);
      return;
    }

    // Validate node before returning to pool
    if (this.config.enableValidation && factory?.validate && !factory.validate(node)) {
      this.safeDispose(node, factory);
      stats.disposed++;
      return;
    }

    this.safeReset(node, factory);

    const max = this.maxPerKey.get(key) ?? this.config.defaultMaxPerKey;
    if (pool.length >= max) {
      // Over capacity — dispose to keep memory bounded.
      this.safeDispose(node, factory);
      stats.disposed++;
    } else {
      // Return to pool
      pool.push(node);
      
      // Update metadata
      const metadata = this.nodeMetadata.get(node);
      if (metadata) {
        metadata.lastUsed = Date.now();
      }
    }
  }

  prewarm(key: PoolKey, count: number): void {
    if (this.isDisposed) return;
    
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`KonvaNodePool: no factory registered for key "${key}"`);
    
    const pool = this.pools.get(key);
    const stats = this.stats.get(key);
    if (!pool || !stats) throw new Error(`KonvaNodePool: pool not found for key "${key}"`);
    const max = this.maxPerKey.get(key) ?? this.config.defaultMaxPerKey;
    const target = Math.min(count, max);
    
    while (pool.length < target) {
      const node = factory.create();
      this.safeReset(node, factory);
      
      // Track in memory manager
      const memoryTrackingId = memoryUtils.trackNode(node, {
        poolKey: key,
        createdAt: Date.now(),
        prewarmed: true,
      });
      
      this.nodeMetadata.set(node, {
        lastUsed: Date.now(),
        timesReused: 0,
        memoryTrackingId,
      });
      
      pool.push(node);
      stats.created++;
    }
  }

  prune(key?: PoolKey): void {
    if (this.isDisposed) return;
    
    if (key) {
      this.pruneOne(key);
      return;
    }
    for (const k of this.pools.keys()) this.pruneOne(k);
  }

  // Prune idle nodes that haven't been used recently
  pruneIdle(maxIdleTime?: number): number {
    if (this.isDisposed) return 0;
    
    const idleThreshold = maxIdleTime ?? this.config.maxIdleTime;
    const now = Date.now();
    let totalPruned = 0;
    
    for (const [key, pool] of this.pools) {
      const factory = this.factories.get(key);
      const stats = this.stats.get(key);
      if (!stats) continue;
      let poolPruned = 0;
      
      // Filter out idle nodes
      for (let i = pool.length - 1; i >= 0; i--) {
        const node = pool[i];
        const metadata = this.nodeMetadata.get(node);
        
        if (metadata && (now - metadata.lastUsed) > idleThreshold) {
          pool.splice(i, 1);
          this.safeDispose(node, factory);
          stats.disposed++;
          poolPruned++;
        }
      }
      
      totalPruned += poolPruned;
      
      if (poolPruned > 0 && this.config.enableMetrics) {
        // Debug: KonvaNodePool: Pruned ${poolPruned} idle nodes from pool "${key}"
      }
    }
    
    return totalPruned;
  }

  clear(dispose = true): void {
    if (dispose) {
      for (const [key, pool] of this.pools) {
        const factory = this.factories.get(key);
        for (const node of pool) this.safeDispose(node, factory);
      }
    }
    
    this.pools.clear();
    this.maxPerKey.clear();
    this.factories.clear();
    this.stats.clear();
    // WeakMaps will clear naturally
  }

  setDefaultMaxPerKey(max: number): void {
    this.config.defaultMaxPerKey = Math.max(0, max | 0);
  }

  setMaxForKey(key: PoolKey, max: number): void {
    if (!this.pools.has(key)) throw new Error(`KonvaNodePool: unknown key "${key}"`);
    this.maxPerKey.set(key, Math.max(0, max | 0));
    this.pruneOne(key);
  }

  getStats(): PoolStats {
    let totalNodes = 0;
    let totalAcquired = 0;
    let totalReused = 0;
    let totalCreated = 0;
    let totalDisposed = 0;
    
    const perKey = Array.from(this.pools.entries()).map(([k, v]) => {
      totalNodes += v.length;
      const stats = this.stats.get(k);
      if (!stats) {
        return {
          key: k,
          size: v.length,
          max: this.maxPerKey.get(k),
          hitRate: 0
        };
      }
      totalAcquired += stats.acquired;
      totalReused += stats.reused;
      totalCreated += stats.created;
      totalDisposed += stats.disposed;

      const hitRate = stats.acquired > 0 ? stats.reused / stats.acquired : 0;
      
      return { 
        key: k, 
        size: v.length, 
        max: this.maxPerKey.get(k),
        hitRate: Math.round(hitRate * 100) / 100 // Round to 2 decimal places
      };
    });
    
    // Estimate memory usage
    let memoryEstimate = 0;
    for (const [, pool] of this.pools) {
      // Rough estimate: each Konva node ~2KB average
      memoryEstimate += pool.length * 2048;
    }
    
    return {
      totalKeys: this.pools.size,
      totalNodes,
      totalAcquired,
      totalReused,
      totalCreated,
      totalDisposed,
      perKey,
      memoryEstimateMB: memoryEstimate / (1024 * 1024),
    };
  }

  // Check if memory pressure requires aggressive cleanup
  handleMemoryPressure(): number {
    if (this.isDisposed) return 0;
    
    const memoryMetrics = memoryUtils.getMetrics();
    let cleaned = 0;
    
    // If we have memory pressure, be more aggressive with cleanup
    if (memoryMetrics.totalHeapUsed && memoryMetrics.totalHeapSize) {
      const usage = memoryMetrics.totalHeapUsed / memoryMetrics.totalHeapSize;
      
      if (usage > this.config.memoryPressureThreshold) {
        // Warning: Memory pressure detected (${Math.round(usage * 100)}%), cleaning up node pools
        
        // Prune idle nodes more aggressively
        cleaned += this.pruneIdle(this.config.maxIdleTime * 0.5);
        
        // Reduce pool sizes temporarily
        for (const [key, pool] of this.pools) {
          const currentMax = this.maxPerKey.get(key) ?? this.config.defaultMaxPerKey;
          const targetSize = Math.floor(currentMax * 0.5); // Reduce to 50%
          
          if (pool.length > targetSize) {
            const factory = this.factories.get(key);
            const stats = this.stats.get(key);
      if (!stats) continue;
            const toRemove = pool.length - targetSize;
            
            for (let i = 0; i < toRemove; i++) {
              const node = pool.pop();
              if (node) {
                this.safeDispose(node, factory);
                stats.disposed++;
                cleaned++;
              }
            }
          }
        }
      }
    }
    
    return cleaned;
  }

  // Dispose the entire pool and cleanup resources
  dispose(): void {
    if (this.isDisposed) return;
    
    this.isDisposed = true;
    
    // Stop garbage collection
    if (this.gcTimer !== null) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    
    // Clean up all resources
    this.clear(true);
  }

  private pruneOne(key: PoolKey): void {
    const pool = this.pools.get(key);
    if (!pool) return;

    const max = this.maxPerKey.get(key) ?? this.config.defaultMaxPerKey;
    if (pool.length <= max) return;

    const factory = this.factories.get(key);
    const stats = this.stats.get(key);
    if (!stats) return; // Safety check - stats should exist for registered pools

    while (pool.length > max) {
      const node = pool.pop();
      if (!node) break;
      this.safeDispose(node, factory);
      stats.disposed++;
    }
  }

  private safeReset<T extends Konva.Node>(node: T, factory?: PoolFactory<T>): void {
    if (factory?.reset) {
      try {
        factory.reset(node);
      } catch (error) {
        // Warning: Error in custom reset function: ${error}
        // Fall back to default reset
        this.defaultReset(node);
      }
      return;
    }
    
    this.defaultReset(node);
  }

  private defaultReset<T extends Konva.Node>(node: T): void {
    try {
      // Stop any ongoing operations
      node.stopDrag?.();
    } catch {
      // ignore
    }
    
    try {
      // Clear all event handlers
      node.off();
    } catch {
      // ignore
    }
    
    try {
      // Detach from parent but keep node alive for reuse
      node.remove();
    } catch {
      // ignore
    }
    
    try {
      // Reset common properties that might affect reuse
      node.visible(true);
      node.listening(true);
      node.draggable(false);
    } catch {
      // ignore
    }
    
    // If the node is a container (e.g., Group), clear children so the pooled wrapper is clean.
    const containerNode = node as unknown as { removeChildren?: () => void };
    try {
      containerNode.removeChildren?.();
    } catch {
      // ignore
    }
  }

  private safeDispose<T extends Konva.Node>(node: T, factory?: PoolFactory<T>): void {
    // Clean up memory tracking first
    const metadata = this.nodeMetadata.get(node);
    if (metadata?.memoryTrackingId) {
      memoryUtils.cleanup(metadata.memoryTrackingId);
    }
    
    try {
      if (factory?.dispose) {
        factory.dispose(node);
      } else {
        this.cleanupNode(node);
      }
    } catch (error) {
      // Warning: Error disposing node: ${error}
    }
  }

  private cleanupNode<T extends Konva.Node>(node: T): void {
    try {
      // Clean up event listeners
      node.off();
      
      // Remove from parent
      node.remove();
      
      // Destroy the node
      node.destroy();
    } catch (error) {
      // Warning: Error cleaning up node: ${error}
    }
  }

  private startGarbageCollection(): void {
    if (this.gcTimer !== null) return;
    
    this.gcTimer = setInterval(() => {
      if (this.isDisposed) return;
      
      try {
        // Prune idle nodes
        const prunedIdle = this.pruneIdle();
        
        // Handle memory pressure
        const cleanedUnderPressure = this.handleMemoryPressure();
        
        const totalCleaned = prunedIdle + cleanedUnderPressure;
        if (totalCleaned > 0 && this.config.enableMetrics) {
          // Debug: KonvaNodePool GC: cleaned ${totalCleaned} nodes (${prunedIdle} idle, ${cleanedUnderPressure} pressure)
        }
      } catch (error) {
        // Warning: Error in KonvaNodePool garbage collection: ${error}
      }
    }, this.config.gcInterval) as unknown as number;
  }
}

export default KonvaNodePool;