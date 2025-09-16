// features/canvas/utils/KonvaNodePool.ts
import type Konva from 'konva';

export type PoolKey = string;

export interface PoolFactory<T extends Konva.Node> {
  // Create a fresh node for this pool key.
  create: () => T;
  // Reset a node before putting it back into the pool (detach, clear state, etc.).
  // If not provided, a safe default reset will be used.
  reset?: (node: T) => void;
  // Dispose a node permanently (default destroys the node).
  dispose?: (node: T) => void;
}

export interface PoolStats {
  totalKeys: number;
  totalNodes: number;
  perKey: Array<{ key: PoolKey; size: number; max?: number }>;
}

export class KonvaNodePool {
  private readonly pools = new Map<PoolKey, Konva.Node[]>();
  private readonly factories = new Map<PoolKey, PoolFactory<any>>();
  private readonly maxPerKey = new Map<PoolKey, number>();
  private readonly nodeToKey = new WeakMap<Konva.Node, PoolKey>();
  private defaultMaxPerKey: number;

  constructor(defaultMaxPerKey = 64) {
    this.defaultMaxPerKey = defaultMaxPerKey;
  }

  register<T extends Konva.Node>(key: PoolKey, factory: PoolFactory<T>, maxPerKey?: number): void {
    this.factories.set(key, factory);
    if (typeof maxPerKey === 'number') this.maxPerKey.set(key, maxPerKey);
    if (!this.pools.has(key)) this.pools.set(key, []);
  }

  unregister(key: PoolKey, dispose = true): void {
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
  }

  acquire<T extends Konva.Node>(key: PoolKey): T {
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`KonvaNodePool: no factory registered for key "${key}"`);
    const pool = this.pools.get(key)!;
    // Reuse or create
    const node = (pool.pop() as T) ?? (factory.create() as T);
    this.nodeToKey.set(node, key);
    return node;
  }

  release<T extends Konva.Node>(node: T): void {
    const key = this.nodeToKey.get(node);
    if (!key) {
      // Unknown node — destroy to avoid cross-pool contamination.
      node.destroy();
      return;
    }
    const factory = this.factories.get(key);
    const pool = this.pools.get(key);
    if (!pool) {
      // Pool was removed; dispose.
      this.safeDispose(node, factory);
      return;
    }

    this.safeReset(node, factory);

    const max = this.maxPerKey.get(key) ?? this.defaultMaxPerKey;
    if (pool.length >= max) {
      // Over capacity — dispose oldest to keep memory bounded.
      this.safeDispose(node, factory);
    } else {
      pool.push(node);
    }
  }

  prewarm(key: PoolKey, count: number): void {
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`KonvaNodePool: no factory registered for key "${key}"`);
    const pool = this.pools.get(key)!;
    const max = this.maxPerKey.get(key) ?? this.defaultMaxPerKey;
    const target = Math.min(count, max);
    while (pool.length < target) {
      const node = factory.create();
      this.safeReset(node, factory);
      pool.push(node);
    }
  }

  prune(key?: PoolKey): void {
    if (key) {
      this.pruneOne(key);
      return;
    }
    for (const k of this.pools.keys()) this.pruneOne(k);
  }

  clear(dispose = true): void {
    for (const [key, pool] of this.pools) {
      if (dispose) {
        const factory = this.factories.get(key);
        for (const node of pool) this.safeDispose(node, factory);
      }
    }
    this.pools.clear();
    this.maxPerKey.clear();
    this.factories.clear();
    // WeakMap will clear naturally
  }

  setDefaultMaxPerKey(max: number): void {
    this.defaultMaxPerKey = Math.max(0, max | 0);
  }

  setMaxForKey(key: PoolKey, max: number): void {
    if (!this.pools.has(key)) throw new Error(`KonvaNodePool: unknown key "${key}"`);
    this.maxPerKey.set(key, Math.max(0, max | 0));
    this.pruneOne(key);
  }

  stats(): PoolStats {
    let total = 0;
    const perKey = Array.from(this.pools.entries()).map(([k, v]) => {
      total += v.length;
      return { key: k, size: v.length, max: this.maxPerKey.get(k) };
    });
    return { totalKeys: this.pools.size, totalNodes: total, perKey };
  }

  private pruneOne(key: PoolKey): void {
    const pool = this.pools.get(key);
    if (!pool) return;
    const max = this.maxPerKey.get(key) ?? this.defaultMaxPerKey;
    if (pool.length <= max) return;
    const factory = this.factories.get(key);
    while (pool.length > max) {
      const node = pool.pop()!;
      this.safeDispose(node, factory);
    }
  }

  private safeReset<T extends Konva.Node>(node: T, factory?: PoolFactory<T>): void {
    if (factory?.reset) {
      factory.reset(node);
      return;
    }
    // Conservative default reset: detach, stop interactions, clear listeners, and remove children for containers.
    try {
      node.stopDrag?.();
    } catch {
      // ignore
    }
    try {
      node.off(); // remove all event handlers
    } catch {
      // ignore
    }
    // Detach from parent but keep node alive for reuse
    try {
      node.remove();
    } catch {
      // ignore
    }
    // If the node is a container (e.g., Group), clear children so the pooled wrapper is clean.
    const anyNode = node as unknown as { removeChildren?: () => void };
    try {
      anyNode.removeChildren?.();
    } catch {
      // ignore
    }
  }

  private safeDispose<T extends Konva.Node>(node: T, factory?: PoolFactory<T>): void {
    try {
      if (factory?.dispose) factory.dispose(node);
      else node.destroy();
    } catch {
      // ignore
    }
  }
}

export default KonvaNodePool;