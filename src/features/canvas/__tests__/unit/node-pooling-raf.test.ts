import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Konva node interface for testing
interface MockKonvaNode {
  id: string;
  type: 'Line' | 'Rect' | 'Circle' | 'Text' | 'Image';
  visible: boolean;
  destroyed: boolean;
  parent?: MockKonvaNode | null;
  children?: MockKonvaNode[];
  destroy(): void;
  removeFromParent(): void;
  reset(): void;
  cache(): void;
  clearCache(): void;
}

class MockKonvaFactory {
  private static idCounter = 0;

  static createNode(type: MockKonvaNode['type']): MockKonvaNode {
    const id = `${type}_${++this.idCounter}`;
    const node: MockKonvaNode = {
      id,
      type,
      visible: true,
      destroyed: false,
      parent: null,
      children: [],
      destroy() {
        this.destroyed = true;
        this.visible = false;
        this.removeFromParent();
      },
      removeFromParent() {
        if (this.parent && this.parent.children) {
          const index = this.parent.children.indexOf(this);
          if (index !== -1) {
            this.parent.children.splice(index, 1);
          }
        }
        this.parent = null;
      },
      reset() {
        this.visible = true;
        this.destroyed = false;
        this.parent = null;
        this.removeFromParent();
        this.clearCache();
      },
      cache() {
        // Mock cache operation
      },
      clearCache() {
        // Mock clear cache operation
      }
    };
    return node;
  }

  static resetCounter() {
    this.idCounter = 0;
  }
}

// Mock KonvaNodePool implementation
class MockKonvaNodePool {
  private pools = new Map<MockKonvaNode['type'], MockKonvaNode[]>();
  private maxPoolSize: number;
  private createdCount = 0;
  private acquiredCount = 0;
  private releasedCount = 0;
  private destroyedCount = 0;

  constructor(maxPoolSize = 50) {
    this.maxPoolSize = maxPoolSize;
  }

  // Acquire node from pool or create new one
  acquire(type: MockKonvaNode['type']): MockKonvaNode {
    this.acquiredCount++;
    
    const pool = this.pools.get(type) || [];
    const pooledNode = pool.pop();
    
    if (pooledNode) {
      pooledNode.reset();
      return pooledNode;
    }

    // Create new node if pool is empty
    this.createdCount++;
    return MockKonvaFactory.createNode(type);
  }

  // Release node back to pool
  release(node: MockKonvaNode): void {
    if (node.destroyed) return;
    
    this.releasedCount++;
    node.reset();

    const pool = this.pools.get(node.type) || [];
    
    // Don't exceed max pool size
    if (pool.length >= this.maxPoolSize) {
      node.destroy();
      this.destroyedCount++;
      return;
    }

    pool.push(node);
    this.pools.set(node.type, pool);
  }

  // Bulk release multiple nodes
  releaseAll(nodes: MockKonvaNode[]): void {
    nodes.forEach(node => this.release(node));
  }

  // Get pool statistics
  getStats() {
    const poolSizes: Record<string, number> = {};
    this.pools.forEach((pool, type) => {
      poolSizes[type] = pool.length;
    });

    return {
      totalCreated: this.createdCount,
      totalAcquired: this.acquiredCount,
      totalReleased: this.releasedCount,
      totalDestroyed: this.destroyedCount,
      poolSizes,
      totalPooledNodes: Array.from(this.pools.values()).reduce((sum, pool) => sum + pool.length, 0)
    };
  }

  // Clear all pools (for cleanup)
  clearPools(): void {
    this.pools.forEach(pool => {
      pool.forEach(node => {
        node.destroy();
        this.destroyedCount++;
      });
    });
    this.pools.clear();
  }

  // Pre-warm pools with nodes
  warmUp(type: MockKonvaNode['type'], count: number): void {
    const pool = this.pools.get(type) || [];
    
    for (let i = 0; i < count && pool.length < this.maxPoolSize; i++) {
      const node = MockKonvaFactory.createNode(type);
      this.createdCount++;
      pool.push(node);
    }
    
    this.pools.set(type, pool);
  }
}

// Mock RAF callback type
type RafCallback = () => void;

// Mock RafBatcher implementation  
class MockRafBatcher {
  private pendingCallbacks = new Set<RafCallback>();
  private highPriorityCallbacks = new Set<RafCallback>();
  private isScheduled = false;
  private executeCount = 0;
  private rafId: number | null = null;

  // Schedule callback for next frame
  schedule(callback: RafCallback, highPriority = false): void {
    if (highPriority) {
      // Move from pending to high priority if already scheduled
      if (this.pendingCallbacks.has(callback)) {
        this.pendingCallbacks.delete(callback);
      }
      this.highPriorityCallbacks.add(callback);
    } else {
      // Deduplicate normal callbacks; if already high-priority, keep it there
      if (!this.highPriorityCallbacks.has(callback)) {
        this.pendingCallbacks.add(callback);
      }
    }

    if (!this.isScheduled) {
      this.isScheduled = true;
      this.rafId = requestAnimationFrame(() => this.executeBatch());
    }
  }

  // Cancel a scheduled callback
  cancel(callback: RafCallback): void {
    this.pendingCallbacks.delete(callback);
    this.highPriorityCallbacks.delete(callback);
  }

  // Execute all pending callbacks
  private executeBatch(): void {
    this.isScheduled = false;
    this.rafId = null;
    this.executeCount++;

    // Execute high priority callbacks first
    const highPriorityCallbacks = Array.from(this.highPriorityCallbacks);
    this.highPriorityCallbacks.clear();
    
    const normalCallbacks = Array.from(this.pendingCallbacks);
    this.pendingCallbacks.clear();

    // Execute in priority order
    [...highPriorityCallbacks, ...normalCallbacks].forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('RAF callback error:', error);
      }
    });
  }

  // Force immediate execution (for testing)
  flush(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.executeBatch();
  }

  // Get batcher statistics
  getStats() {
    return {
      pendingCount: this.pendingCallbacks.size,
      highPriorityCount: this.highPriorityCallbacks.size,
      totalExecutions: this.executeCount,
      isScheduled: this.isScheduled
    };
  }

  // Clear all pending callbacks
  clear(): void {
    this.pendingCallbacks.clear();
    this.highPriorityCallbacks.clear();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isScheduled = false;
  }

  // Check if callback is already scheduled
  isCallbackScheduled(callback: RafCallback): boolean {
    return this.pendingCallbacks.has(callback) || this.highPriorityCallbacks.has(callback);
  }
}

describe('Node Pooling and RAF Batching Unit Tests', () => {
  let nodePool: MockKonvaNodePool;
  let rafBatcher: MockRafBatcher;

  beforeEach(() => {
    MockKonvaFactory.resetCounter();
    nodePool = new MockKonvaNodePool(10); // Small pool for testing
    rafBatcher = new MockRafBatcher();
  });

  afterEach(() => {
    nodePool.clearPools();
    rafBatcher.clear();
  });

  describe('KonvaNodePool - Basic Operations', () => {
    it('should create new nodes when pool is empty', () => {
      const line1 = nodePool.acquire('Line');
      const line2 = nodePool.acquire('Line');
      const rect = nodePool.acquire('Rect');

      expect(line1.type).toBe('Line');
      expect(line2.type).toBe('Line');
      expect(rect.type).toBe('Rect');
      expect(line1.id).not.toBe(line2.id);

      const stats = nodePool.getStats();
      expect(stats.totalCreated).toBe(3);
      expect(stats.totalAcquired).toBe(3);
    });

    it('should reuse nodes from pool after release', () => {
      const line = nodePool.acquire('Line');
      const originalId = line.id;
      
      nodePool.release(line);
      
      const reusedLine = nodePool.acquire('Line');
      
      expect(reusedLine.id).toBe(originalId);
      expect(reusedLine.visible).toBe(true);
      expect(reusedLine.destroyed).toBe(false);

      const stats = nodePool.getStats();
      expect(stats.totalCreated).toBe(1); // Only created once
      expect(stats.totalAcquired).toBe(2); // Acquired twice
      expect(stats.totalReleased).toBe(1);
    });

    it('should maintain separate pools for different node types', () => {
      const line = nodePool.acquire('Line');
      const rect = nodePool.acquire('Rect');
      const circle = nodePool.acquire('Circle');

      nodePool.release(line);
      nodePool.release(rect);
      nodePool.release(circle);

      const stats = nodePool.getStats();
      expect(stats.poolSizes.Line).toBe(1);
      expect(stats.poolSizes.Rect).toBe(1);
      expect(stats.poolSizes.Circle).toBe(1);
      expect(stats.totalPooledNodes).toBe(3);
    });

    it('should reset nodes properly when releasing', () => {
      const line = nodePool.acquire('Line');
      
      // Modify node state
      line.visible = false;
      line.parent = {} as MockKonvaNode;

      nodePool.release(line);

      const reusedLine = nodePool.acquire('Line');
      expect(reusedLine.visible).toBe(true);
      expect(reusedLine.parent).toBe(null);
    });

    it('should not release destroyed nodes', () => {
      const line = nodePool.acquire('Line');
      line.destroy();
      
      nodePool.release(line);
      
      const stats = nodePool.getStats();
      expect(stats.totalReleased).toBe(0); // Should not count destroyed node
      expect(stats.totalPooledNodes).toBe(0);
    });
  });

  describe('KonvaNodePool - Capacity Management', () => {
    it('should enforce maximum pool size', () => {
      const nodes: MockKonvaNode[] = [];
      
      // Fill pool beyond capacity
      for (let i = 0; i < 15; i++) {
        nodes.push(nodePool.acquire('Line'));
      }
      
      // Release all nodes
      nodePool.releaseAll(nodes);
      
      const stats = nodePool.getStats();
      expect(stats.poolSizes.Line).toBe(10); // Max pool size
      expect(stats.totalDestroyed).toBe(5); // Excess nodes destroyed
    });

    it('should handle bulk release operations', () => {
      const lines = [
        nodePool.acquire('Line'),
        nodePool.acquire('Line'),
        nodePool.acquire('Line')
      ];
      
      nodePool.releaseAll(lines);
      
      const stats = nodePool.getStats();
      expect(stats.totalReleased).toBe(3);
      expect(stats.poolSizes.Line).toBe(3);
    });

    it('should support pool warm-up', () => {
      nodePool.warmUp('Rect', 5);
      
      let stats = nodePool.getStats();
      expect(stats.totalCreated).toBe(5);
      expect(stats.poolSizes.Rect).toBe(5);
      
      // Acquiring should use warm-up nodes
      void nodePool.acquire('Rect');
      stats = nodePool.getStats();
      expect(stats.poolSizes.Rect).toBe(4); // One removed from pool
    });

    it('should not warm-up beyond max capacity', () => {
      nodePool.warmUp('Circle', 20); // Beyond maxPoolSize of 10
      
      const stats = nodePool.getStats();
      expect(stats.poolSizes.Circle).toBe(10); // Capped at max
      expect(stats.totalCreated).toBe(10);
    });
  });

  describe('RafBatcher - Basic Scheduling', () => {
    it('should schedule callbacks for next frame', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      rafBatcher.schedule(callback1);
      rafBatcher.schedule(callback2);
      
      const stats = rafBatcher.getStats();
      expect(stats.pendingCount).toBe(2);
      expect(stats.isScheduled).toBe(true);
      
      // Callbacks not executed yet
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should execute callbacks on flush', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      rafBatcher.schedule(callback1);
      rafBatcher.schedule(callback2);
      rafBatcher.flush();
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      
      const stats = rafBatcher.getStats();
      expect(stats.pendingCount).toBe(0);
      expect(stats.totalExecutions).toBe(1);
    });

    it('should handle high priority callbacks first', () => {
      const executionOrder: string[] = [];
      
      const normalCallback = () => executionOrder.push('normal');
      const highPriorityCallback = () => executionOrder.push('high');
      
      rafBatcher.schedule(normalCallback, false);
      rafBatcher.schedule(highPriorityCallback, true);
      rafBatcher.flush();
      
      expect(executionOrder).toEqual(['high', 'normal']);
    });

    it('should allow canceling scheduled callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      rafBatcher.schedule(callback1);
      rafBatcher.schedule(callback2);
      rafBatcher.cancel(callback1);
      rafBatcher.flush();
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('RafBatcher - Deduplication', () => {
    it('should deduplicate identical callbacks', () => {
      const callback = vi.fn();
      
      rafBatcher.schedule(callback);
      rafBatcher.schedule(callback); // Same callback again
      rafBatcher.schedule(callback); // And again
      
      const stats = rafBatcher.getStats();
      expect(stats.pendingCount).toBe(1); // Deduplicated
      
      rafBatcher.flush();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should check if callback is already scheduled', () => {
      const callback = vi.fn();
      
      expect(rafBatcher.isCallbackScheduled(callback)).toBe(false);
      
      rafBatcher.schedule(callback);
      expect(rafBatcher.isCallbackScheduled(callback)).toBe(true);
      
      rafBatcher.flush();
      expect(rafBatcher.isCallbackScheduled(callback)).toBe(false);
    });

    it('should handle mixed priority deduplication', () => {
      const callback = vi.fn();
      
      rafBatcher.schedule(callback, false); // Normal priority
      rafBatcher.schedule(callback, true);  // High priority - should override
      
      const stats = rafBatcher.getStats();
      expect(stats.pendingCount).toBe(0); // Moved to high priority
      expect(stats.highPriorityCount).toBe(1);
    });
  });

  describe('RafBatcher - Error Handling', () => {
    it('should handle callback errors gracefully', () => {
      const errorCallback = () => { throw new Error('Test error'); };
      const normalCallback = vi.fn();
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      rafBatcher.schedule(errorCallback);
      rafBatcher.schedule(normalCallback);
      rafBatcher.flush();
      
      expect(consoleSpy).toHaveBeenCalledWith('RAF callback error:', expect.any(Error));
      expect(normalCallback).toHaveBeenCalled(); // Should still execute
      
      consoleSpy.mockRestore();
    });

    it('should clear all state when clearing', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      rafBatcher.schedule(callback1, false);
      rafBatcher.schedule(callback2, true);
      rafBatcher.clear();
      
      const stats = rafBatcher.getStats();
      expect(stats.pendingCount).toBe(0);
      expect(stats.highPriorityCount).toBe(0);
      expect(stats.isScheduled).toBe(false);
    });
  });

  describe('Integration - Node Pool with RAF Batching', () => {
    it('should batch node creation/destruction operations', () => {
      const nodes: MockKonvaNode[] = [];
      let createBatchExecuted = false;
      let destroyBatchExecuted = false;
      
      // Schedule batched node creation
      const createBatch = () => {
        for (let i = 0; i < 5; i++) {
          nodes.push(nodePool.acquire('Line'));
        }
        createBatchExecuted = true;
      };
      
      // Schedule batched node destruction
      const destroyBatch = () => {
        nodePool.releaseAll(nodes);
        nodes.length = 0;
        destroyBatchExecuted = true;
      };
      
      rafBatcher.schedule(createBatch);
      rafBatcher.schedule(destroyBatch);
      rafBatcher.flush();
      
      expect(createBatchExecuted).toBe(true);
      expect(destroyBatchExecuted).toBe(true);
      
      const poolStats = nodePool.getStats();
      expect(poolStats.totalCreated).toBe(5);
      expect(poolStats.totalReleased).toBe(5);
      expect(poolStats.poolSizes.Line).toBe(5);
    });

    it('should handle complex drawing operations efficiently', () => {
      // Simulate complex drawing scenario
      let drawOperationsCompleted = 0;
      
      const createStrokeOperation = (strokeId: string) => () => {
        // Acquire nodes for stroke
        const strokeNodes = [
          nodePool.acquire('Line'),
          nodePool.acquire('Circle'), // Start cap
          nodePool.acquire('Circle'), // End cap
        ];
        
        // Simulate some processing...
        strokeNodes.forEach(node => {
          node.visible = true;
        });
        
        // Schedule cleanup for later
        rafBatcher.schedule(() => {
          nodePool.releaseAll(strokeNodes);
          drawOperationsCompleted++;
        }, false);
      };
      
      // Create multiple stroke operations
      for (let i = 0; i < 3; i++) {
        rafBatcher.schedule(createStrokeOperation(`stroke_${i}`), true);
      }
      
      // Execute first batch (stroke creation)
      rafBatcher.flush();
      
      // Execute second batch (cleanup)
      rafBatcher.flush();
      
      expect(drawOperationsCompleted).toBe(3);
      
      const poolStats = nodePool.getStats();
      expect(poolStats.totalCreated).toBe(9); // 3 strokes × 3 nodes each
      expect(poolStats.totalReleased).toBe(9);
      expect(poolStats.totalPooledNodes).toBe(9); // All back in pool
    });

    it('should maintain performance under load', () => {
      const operationCount = 100;
      const operations: (() => void)[] = [];
      
      // Create many operations
      for (let i = 0; i < operationCount; i++) {
        operations.push(() => {
          const node = nodePool.acquire(i % 2 === 0 ? 'Line' : 'Rect');
          nodePool.release(node);
        });
      }
      
      // Schedule all operations
      const startTime = performance.now();
      operations.forEach(op => rafBatcher.schedule(op));
      rafBatcher.flush();
      const endTime = performance.now();
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100); // 100ms max
      
      const rafStats = rafBatcher.getStats();
      const poolStats = nodePool.getStats();
      
      expect(rafStats.totalExecutions).toBe(1);
      expect(poolStats.totalAcquired).toBe(operationCount);
      expect(poolStats.totalReleased).toBe(operationCount);
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should prevent memory leaks in node pool', () => {
      // Create and release many nodes
      for (let cycle = 0; cycle < 5; cycle++) {
        const nodes: MockKonvaNode[] = [];
        
        // Create nodes
        for (let i = 0; i < 20; i++) {
          nodes.push(nodePool.acquire('Line'));
        }
        
        // Release nodes
        nodePool.releaseAll(nodes);
      }
      
      const stats = nodePool.getStats();
      
      // Pool should maintain size limits
      expect(stats.poolSizes.Line).toBe(10); // Max pool size
      expect(stats.totalDestroyed).toBeGreaterThan(0); // Excess destroyed
      
      // Total created should be reasonable
      expect(stats.totalCreated).toBeLessThanOrEqual(100);
    });

    it('should clean up RAF callbacks properly', () => {
      const callbacks = Array.from({ length: 50 }, () => vi.fn());
      
      // Schedule many callbacks
      callbacks.forEach(callback => {
        rafBatcher.schedule(callback);
      });
      
      // Clear before execution
      rafBatcher.clear();
      
      const stats = rafBatcher.getStats();
      expect(stats.pendingCount).toBe(0);
      expect(stats.highPriorityCount).toBe(0);
      
      // None should have been executed
      callbacks.forEach(callback => {
        expect(callback).not.toHaveBeenCalled();
      });
    });

    it('should handle pool cleanup on teardown', () => {
      // Fill pools
      nodePool.warmUp('Line', 10);
      nodePool.warmUp('Rect', 10);
      nodePool.warmUp('Circle', 10);
      
      let initialStats = nodePool.getStats();
      expect(initialStats.totalPooledNodes).toBe(30);
      
      // Clear all pools
      nodePool.clearPools();
      
      const finalStats = nodePool.getStats();
      expect(finalStats.totalPooledNodes).toBe(0);
      expect(finalStats.totalDestroyed).toBe(30);
    });
  });
});