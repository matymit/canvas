// features/canvas/stores/modules/historyModule.ts
import type { StoreSlice } from './types';
import type { ElementId, CanvasElement } from '../../../../../types/index';

// Core store operation types for element state history
export type StoreHistoryOp =
  | {
      type: 'add';
      elements: CanvasElement[];         // redo: add, undo: remove
      indices?: number[];                // insertion indices in elementOrder
    }
  | {
      type: 'remove';
      elements: CanvasElement[];         // redo: remove, undo: add back
      indices?: number[];                // original indices to restore
    }
  | {
      type: 'update';
      before: CanvasElement[];
      after: CanvasElement[];
    }
  | {
      type: 'reorder';
      before: ElementId[];
      after: ElementId[];
    };

// History entry with metadata for merge heuristics
export interface HistoryEntry {
  id: string;
  label?: string;
  mergeKey?: string;  // semantic key for coalescing (e.g., 'move:ids', 'transform:ids')
  ts: number;
  ops: StoreHistoryOp[];
  // Memory optimization: track size for intelligent pruning
  estimatedSize?: number;
}

export interface HistoryBatch {
  active: boolean;
  label?: string;
  mergeKey?: string;
  startedAt: number | null;
  ops: StoreHistoryOp[];
}

export interface HistoryModuleSlice {
  entries: HistoryEntry[];
  index: number;             // -1 = empty, otherwise points to last applied
  mergeWindowMs: number;     // heuristics window
  batching: HistoryBatch;
  
  // Memory management settings
  maxEntries: number;        // Maximum number of history entries
  maxMemoryMB: number;       // Maximum estimated memory usage in MB
  pruneThreshold: number;    // When to start aggressive pruning (0.8 = 80% of max)

  // Grouping and pushing
  beginBatch(label?: string, mergeKey?: string): void;
  endBatch(commit?: boolean): void;
  push(ops: StoreHistoryOp | StoreHistoryOp[], label?: string, mergeKey?: string): void;

  // High-level operation with automatic batching
  withUndo(description: string, mutator: () => void): void;

  // Compatibility shims for existing calls in modules
  record(input: any): void;  // normalize and delegate to push()
  add(input: any): void;     // alias

  // Navigation
  undo(): void;
  redo(): void;
  clear(): void;

  // Memory management
  pruneHistory(): number;    // Remove old entries, returns count pruned
  getMemoryUsage(): { entriesCount: number; estimatedMB: number };

  // Introspection
  canUndo(): boolean;
  canRedo(): boolean;

  // Tuning
  setMergeWindow(ms: number): void;
  setMemoryLimits(maxEntries: number, maxMemoryMB: number): void;
}

// utils
const now = () => Date.now();
const idGen = (() => {
  let n = 0;
  return () => `h-${now().toString(36)}-${(n++).toString(36)}`;
})();

// Estimate memory usage of a history entry
function estimateEntrySize(entry: HistoryEntry): number {
  let size = 0;
  
  // Base overhead for entry metadata
  size += 200; // id, label, mergeKey, ts, array overhead
  
  for (const op of entry.ops) {
    switch (op.type) {
      case 'add':
      case 'remove':
        // Estimate size of each element
        for (const element of op.elements) {
          size += estimateElementSize(element);
        }
        // Indices array overhead
        size += (op.indices?.length || 0) * 8;
        break;
        
      case 'update':
        // Before and after elements
        for (const element of op.before) {
          size += estimateElementSize(element);
        }
        for (const element of op.after) {
          size += estimateElementSize(element);
        }
        break;
        
      case 'reorder':
        // ElementId arrays
        size += op.before.length * 50; // Estimate 50 bytes per ElementId
        size += op.after.length * 50;
        break;
    }
  }
  
  return size;
}

// Estimate memory usage of a canvas element
function estimateElementSize(element: CanvasElement): number {
  let size = 500; // Base overhead for element structure
  
  // Add size estimates based on element type
  switch (element.type) {
    case 'drawing': {
      // Drawing elements can be large due to stroke points
      const points = (element.data as any)?.points || [];
      size += points.length * 16; // x,y coordinates
      break;
    }
      
    case 'image': {
      // Images store data URLs which can be very large
      const dataUrl = (element.data as any)?.dataUrl || '';
      size += dataUrl.length * 2; // Rough estimate for string storage
      break;
    }
      
    case 'table': {
      // Tables store cell data
      const cells = (element.data as any)?.cells || [];
      size += cells.length * 100; // Estimate per cell
      break;
    }
      
    case 'mindmap-node': {
      // Text content
      const text = (element.data as any)?.text || '';
      size += text.length * 2;
      break;
    }
      
    default:
      // Basic elements (shapes, text, etc.)
      size += 200;
  }
  
  return size;
}

function pickHistoryState(state: any) {
  // If a fully-featured nested history object exists (with entries & batching), prefer it.
  const h = state.history;
  if (h && Array.isArray(h.entries) && h.batching) return h;
  // Otherwise, the history state lives at the root (our default slice layout)
  return state;
}

function coalesceInto(prev: HistoryEntry, nextOps: StoreHistoryOp[]) {
  prev.ops.push(...nextOps);
  prev.ts = now();
  // Recalculate size after merging
  prev.estimatedSize = estimateEntrySize(prev);
}

function shouldMerge(prev: HistoryEntry, label?: string, mergeKey?: string, mergeWindowMs?: number) {
  if (!prev) return false;
  const within = now() - prev.ts <= (mergeWindowMs ?? 250);
  const sameLabel = !label || prev.label === label;
  const sameKey = !mergeKey || prev.mergeKey === mergeKey;
  return within && sameLabel && sameKey;
}

function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function normalizeLooseRecord(input: any): StoreHistoryOp[] {
  // Accept shapes like { op: 'add', elements }, { type: 'update', before, after }, or { payload: { ... } }
  const type = input?.type ?? input?.op;
  if (type === 'add') {
    const els = ensureArray<CanvasElement>(input?.elements ?? input?.payload?.element ?? input?.payload?.elements);
    return els.length ? [{ type: 'add', elements: els }] : [];
  }
  if (type === 'remove') {
    const els = ensureArray<CanvasElement>(input?.elements ?? input?.payload?.element ?? input?.payload?.elements);
    return els.length ? [{ type: 'remove', elements: els }] : [];
  }
  if (type === 'update') {
    const before = ensureArray<CanvasElement>(input?.before ?? input?.payload?.before);
    const after = ensureArray<CanvasElement>(input?.after ?? input?.payload?.after);
    if (before.length && after.length) return [{ type: 'update', before, after }];
    return [];
  }
  if (type === 'reorder') {
    const before = ensureArray<ElementId>(input?.orderBefore ?? input?.before);
    const after = ensureArray<ElementId>(input?.orderAfter ?? input?.after);
    if (before.length && after.length) return [{ type: 'reorder', before, after }];
    return [];
  }
  // Unknown shape: ignore
  return [];
}

function applyOpToStore(state: any, op: StoreHistoryOp, dir: 'undo' | 'redo') {
  const baseMap: Map<ElementId, CanvasElement> =
    state.elements ?? state.element?.elements ?? new Map<ElementId, CanvasElement>();
  const map = new Map<ElementId, CanvasElement>(baseMap);
  const order: ElementId[] = Array.isArray(state.elementOrder) ? state.elementOrder.slice() : [];

  const insertAt = (arr: any[], index: number, value: any) => {
    const i = Math.max(0, Math.min(index, arr.length));
    arr.splice(i, 0, value);
  };

  switch (op.type) {
    case 'add': {
      if (dir === 'redo') {
        // add elements; honor indices if provided
        op.elements.forEach((el, i) => {
          map.set(el.id as unknown as ElementId, el);
          const idx = op.indices?.[i];
          if (typeof idx === 'number') insertAt(order, idx, el.id as unknown as ElementId);
          else order.push(el.id as unknown as ElementId);
        });
      } else {
        // undo add = remove
        op.elements.forEach((el) => {
          map.delete(el.id as unknown as ElementId);
          const idx = order.indexOf(el.id as unknown as ElementId);
          if (idx >= 0) order.splice(idx, 1);
        });
      }
      state.elements = map;
      state.elementOrder = order;
      return;
    }
    case 'remove': {
      if (dir === 'redo') {
        // remove elements
        op.elements.forEach((el) => {
          map.delete(el.id as unknown as ElementId);
          const idx = order.indexOf(el.id as unknown as ElementId);
          if (idx >= 0) order.splice(idx, 1);
        });
      } else {
        // undo remove = re-add; honor indices if provided
        op.elements.forEach((el, i) => {
          map.set(el.id as unknown as ElementId, el);
          const idx = op.indices?.[i];
          if (typeof idx === 'number') insertAt(order, idx, el.id as unknown as ElementId);
          else order.push(el.id as unknown as ElementId);
        });
      }
      state.elements = map;
      state.elementOrder = order;
      return;
    }
    case 'update': {
      if (dir === 'redo') {
        op.after.forEach((el) => {
          map.set(el.id as unknown as ElementId, el);
        });
      } else {
        op.before.forEach((el) => {
          map.set(el.id as unknown as ElementId, el);
        });
      }
      state.elements = map;
      return;
    }
    case 'reorder': {
      state.elementOrder = dir === 'redo' ? op.after.slice() : op.before.slice();
      return;
    }
  }
}

// Prune history entries intelligently
function pruneHistoryEntries(
  entries: HistoryEntry[],
  currentIndex: number,
  maxEntries: number,
  maxMemoryBytes: number
): { entries: HistoryEntry[]; newIndex: number; pruned: number } {
  if (entries.length <= maxEntries) {
    // Check memory usage
    const totalMemory = entries.reduce((sum, entry) => sum + (entry.estimatedSize || 0), 0);
    if (totalMemory <= maxMemoryBytes) {
      return { entries, newIndex: currentIndex, pruned: 0 };
    }
  }

  // Split entries into undo (past) and redo (future)
  const pastEntries = entries.slice(0, currentIndex + 1);
  const futureEntries = entries.slice(currentIndex + 1);
  
  // Prioritize keeping recent entries and current position context
  const keepRecentCount = Math.min(maxEntries * 0.7, pastEntries.length); // Keep 70% for past
  const keepFutureCount = Math.min(maxEntries * 0.3, futureEntries.length); // Keep 30% for future
  
  let prunedPast = pastEntries;
  let prunedFuture = futureEntries;
  let pruned = 0;
  
  // Prune oldest past entries first
  if (pastEntries.length > keepRecentCount) {
    const removeCount = pastEntries.length - keepRecentCount;
    prunedPast = pastEntries.slice(removeCount);
    pruned += removeCount;
  }
  
  // Prune future entries if needed
  if (futureEntries.length > keepFutureCount) {
    const removeCount = futureEntries.length - keepFutureCount;
    prunedFuture = futureEntries.slice(0, keepFutureCount);
    pruned += removeCount;
  }
  
  // If still over memory limit, prune more aggressively by size
  const newEntries = [...prunedPast, ...prunedFuture];
  let totalMemory = newEntries.reduce((sum, entry) => sum + (entry.estimatedSize || 0), 0);
  
  if (totalMemory > maxMemoryBytes && newEntries.length > 10) {
    // Find largest entries and remove them (except very recent ones)
    const sortedBySize = newEntries
      .map((entry, index) => ({ entry, index, size: entry.estimatedSize || 0 }))
      .sort((a, b) => b.size - a.size);
    
    // Don't remove the last 5 entries to preserve recent context
    const removableEntries = sortedBySize.filter(item => 
      item.index < newEntries.length - 5
    );
    
    for (const item of removableEntries) {
      if (totalMemory <= maxMemoryBytes) break;
      
      const entryIndex = newEntries.indexOf(item.entry);
      if (entryIndex >= 0) {
        newEntries.splice(entryIndex, 1);
        totalMemory -= item.size;
        pruned++;
      }
    }
  }
  
  // Recalculate index after pruning
  const newIndex = Math.max(-1, Math.min(newEntries.length - 1, prunedPast.length - 1));
  
  return { entries: newEntries, newIndex, pruned };
}

export const createHistoryModule: StoreSlice<HistoryModuleSlice> = (set, get) => ({
  entries: [],
  index: -1,
  mergeWindowMs: 250,
  batching: {
    active: false,
    label: undefined,
    mergeKey: undefined,
    startedAt: null,
    ops: [],
  },
  // Memory management defaults
  maxEntries: 100, // Reasonable default for most use cases
  maxMemoryMB: 50, // 50MB limit for history
  pruneThreshold: 0.8, // Start pruning at 80% of limits

  // High-level withUndo helper for user operations
  withUndo: (description: string, mutator: () => void) => {
    // Begin batch for this operation
    get().beginBatch(description);

    // Execute the mutation
    mutator();

    // End batch and commit
    get().endBatch(true);
  },

  beginBatch: (label, mergeKey) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      if (h.batching.active) return;
      h.batching.active = true;
      h.batching.label = label;
      h.batching.mergeKey = mergeKey;
      h.batching.startedAt = now();
      h.batching.ops = [];
    }),

  endBatch: (commit = true) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      if (!h.batching.active) return;
      const ops = h.batching.ops.slice();
      const label = h.batching.label;
      const mergeKey = h.batching.mergeKey;

      h.batching.active = false;
      h.batching.label = undefined;
      h.batching.mergeKey = undefined;
      h.batching.startedAt = null;
      h.batching.ops = [];

      if (!commit || ops.length === 0) return;

      // drop redo tail if not at end
      const end = h.index + 1;
      const base = end < h.entries.length ? h.entries.slice(0, end) : h.entries;

      const prev = base[base.length - 1];
      if (shouldMerge(prev, label, mergeKey, h.mergeWindowMs)) {
        coalesceInto(prev, ops);
        h.entries = base;
        h.index = base.length - 1;
      } else {
        const entry: HistoryEntry = {
          id: idGen(),
          label,
          mergeKey,
          ts: now(),
          ops,
          estimatedSize: 0, // Will be calculated below
        };
        entry.estimatedSize = estimateEntrySize(entry);
        
        base.push(entry);
        h.entries = base;
        h.index = base.length - 1;
      }
      
      // Check if pruning is needed
      const currentMemory = h.entries.reduce((sum: number, e: HistoryEntry) => sum + (e.estimatedSize || 0), 0);
      const memoryLimitBytes = h.maxMemoryMB * 1024 * 1024;
      const shouldPrune = h.entries.length > h.maxEntries * h.pruneThreshold || 
                          currentMemory > memoryLimitBytes * h.pruneThreshold;
      
      if (shouldPrune) {
        const pruneResult = pruneHistoryEntries(h.entries, h.index, h.maxEntries, memoryLimitBytes);
        h.entries = pruneResult.entries;
        h.index = pruneResult.newIndex;
        
        if (pruneResult.pruned > 0) {
          console.debug(`History pruned ${pruneResult.pruned} entries to manage memory`);
        }
      }
    }),

  push: (opsIn, label, mergeKey) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      const ops = Array.isArray(opsIn) ? opsIn : [opsIn];
      if (ops.length === 0) return;

      if (h.batching.active) {
        h.batching.ops.push(...ops);
        return;
      }

      // drop redo tail if not at end
      const end = h.index + 1;
      const base = end < h.entries.length ? h.entries.slice(0, end) : h.entries;

      const prev = base[base.length - 1];
      if (shouldMerge(prev, label, mergeKey, h.mergeWindowMs)) {
        coalesceInto(prev, ops);
        h.entries = base;
        h.index = base.length - 1;
      } else {
        const entry: HistoryEntry = {
          id: idGen(),
          label,
          mergeKey,
          ts: now(),
          ops: ops,
          estimatedSize: 0, // Will be calculated below
        };
        entry.estimatedSize = estimateEntrySize(entry);
        
        base.push(entry);
        h.entries = base;
        h.index = base.length - 1;
      }
      
      // Check if pruning is needed
      const currentMemory = h.entries.reduce((sum: number, e: HistoryEntry) => sum + (e.estimatedSize || 0), 0);
      const memoryLimitBytes = h.maxMemoryMB * 1024 * 1024;
      const shouldPrune = h.entries.length > h.maxEntries * h.pruneThreshold || 
                          currentMemory > memoryLimitBytes * h.pruneThreshold;
      
      if (shouldPrune) {
        const pruneResult = pruneHistoryEntries(h.entries, h.index, h.maxEntries, memoryLimitBytes);
        h.entries = pruneResult.entries;
        h.index = pruneResult.newIndex;
        
        if (pruneResult.pruned > 0) {
          console.debug(`History pruned ${pruneResult.pruned} entries to manage memory`);
        }
      }
    }),

  // Memory management methods
  pruneHistory: () => {
    let prunedCount = 0;
    set((state: any) => {
      const h = pickHistoryState(state);
      const memoryLimitBytes = h.maxMemoryMB * 1024 * 1024;
      const pruneResult = pruneHistoryEntries(h.entries, h.index, h.maxEntries, memoryLimitBytes);
      h.entries = pruneResult.entries;
      h.index = pruneResult.newIndex;
      prunedCount = pruneResult.pruned;
    });
    return prunedCount;
  },

  getMemoryUsage: () => {
    const h = pickHistoryState(get() as any);
    const totalBytes = h.entries.reduce((sum: number, entry: HistoryEntry) => sum + (entry.estimatedSize || 0), 0);
    return {
      entriesCount: h.entries.length,
      estimatedMB: totalBytes / (1024 * 1024)
    };
  },

  setMemoryLimits: (maxEntries: number, maxMemoryMB: number) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      h.maxEntries = Math.max(10, maxEntries); // Minimum 10 entries
      h.maxMemoryMB = Math.max(5, maxMemoryMB); // Minimum 5MB
    }),

  // compatibility helpers
  record: (input: any) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      const ops = normalizeLooseRecord(input);
      if (ops.length === 0) return;
      if (h.batching.active) {
        h.batching.ops.push(...ops);
        return;
      }
      const end = h.index + 1;
      const base = end < h.entries.length ? h.entries.slice(0, end) : h.entries;
      const prev = base[base.length - 1];
      const label = input?.label;
      const mergeKey = input?.mergeKey;
      if (shouldMerge(prev, label, mergeKey, h.mergeWindowMs)) {
        coalesceInto(prev, ops);
        h.entries = base;
        h.index = base.length - 1;
      } else {
        const entry: HistoryEntry = {
          id: idGen(),
          label,
          mergeKey,
          ts: now(),
          ops,
          estimatedSize: 0,
        };
        entry.estimatedSize = estimateEntrySize(entry);
        base.push(entry);
        h.entries = base;
        h.index = base.length - 1;
      }
    }),

  add: (input: any) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      const ops = normalizeLooseRecord(input);
      if (ops.length === 0) return;
      if (h.batching.active) {
        h.batching.ops.push(...ops);
        return;
      }
      const end = h.index + 1;
      const base = end < h.entries.length ? h.entries.slice(0, end) : h.entries;
      const entry: HistoryEntry = {
        id: idGen(),
        ts: now(),
        ops,
        estimatedSize: 0,
      };
      entry.estimatedSize = estimateEntrySize(entry);
      base.push(entry);
      h.entries = base;
      h.index = base.length - 1;
    }),

  undo: () =>
    set((state: any) => {
      const h = pickHistoryState(state);
      if (h.index < 0) return;
      const entry: HistoryEntry = h.entries[h.index];
      // apply in reverse for correctness
      for (let i = entry.ops.length - 1; i >= 0; i--) {
        applyOpToStore(state, entry.ops[i], 'undo');
      }
      h.index -= 1;
    }),

  redo: () =>
    set((state: any) => {
      const h = pickHistoryState(state);
      if (h.index >= h.entries.length - 1) return;
      const entry: HistoryEntry = h.entries[h.index + 1];
      // apply forward in recorded order
      for (let i = 0; i < entry.ops.length; i++) {
        applyOpToStore(state, entry.ops[i], 'redo');
      }
      h.index += 1;
    }),

  clear: () =>
    set((state: any) => {
      const h = pickHistoryState(state);
      h.entries = [];
      h.index = -1;
      h.batching.active = false;
      h.batching.label = undefined;
      h.batching.mergeKey = undefined;
      h.batching.startedAt = null;
      h.batching.ops = [];
    }),

  canUndo: () => {
    const h = pickHistoryState(get() as any);
    return h.index >= 0;
  },

  canRedo: () => {
    const h = pickHistoryState(get() as any);
    return h.index < h.entries.length - 1;
  },

  setMergeWindow: (ms) =>
    set((state: any) => {
      const h = pickHistoryState(state);
      h.mergeWindowMs = Math.max(0, Math.round(ms || 0));
    }),
});

export default createHistoryModule;