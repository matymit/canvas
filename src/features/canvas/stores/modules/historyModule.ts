// features/canvas/stores/modules/historyModule.ts
import type { StoreSlice } from './types';
import type { StoreHistoryOp, HistoryEntry, HistoryBatch, HistoryModuleSlice } from './history/types';
import {
  now,
  idGen,
  estimateEntrySize,
  pickHistoryState,
  coalesceInto,
  shouldMerge,
  normalizeLooseRecord,
  extractLabel,
  extractMergeKey,
  applyOpToStore,
  type HistoryRootDraft,
  type ElementDraft,
  type RecordInput
} from './history/utils';

// Re-export types for backward compatibility
export type { StoreHistoryOp, HistoryEntry, HistoryBatch, HistoryModuleSlice };

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
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      if (h.batching.active) return;
      h.batching.active = true;
      h.batching.label = label;
      h.batching.mergeKey = mergeKey;
      h.batching.startedAt = now();
      h.batching.ops = [];
    }),

  endBatch: (commit = true) =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
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
        
      }
    }),

  push: (opsIn: StoreHistoryOp | StoreHistoryOp[], label?: string, mergeKey?: string) =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
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
        
      }
    }),

  // Memory management methods
  pruneHistory: () => {
    let prunedCount = 0;
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      const memoryLimitBytes = h.maxMemoryMB * 1024 * 1024;
      const pruneResult = pruneHistoryEntries(h.entries, h.index, h.maxEntries, memoryLimitBytes);
      h.entries = pruneResult.entries;
      h.index = pruneResult.newIndex;
      prunedCount = pruneResult.pruned;
    });
    return prunedCount;
  },

  getMemoryUsage: () => {
    const h = pickHistoryState(get() as unknown as HistoryRootDraft);
    const totalBytes = h.entries.reduce((sum: number, entry: HistoryEntry) => sum + (entry.estimatedSize || 0), 0);
    return {
      entriesCount: h.entries.length,
      estimatedMB: totalBytes / (1024 * 1024)
    };
  },

  setMemoryLimits: (maxEntries: number, maxMemoryMB: number) =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      h.maxEntries = Math.max(10, maxEntries); // Minimum 10 entries
      h.maxMemoryMB = Math.max(5, maxMemoryMB); // Minimum 5MB
    }),

  // compatibility helpers
  record: (input: RecordInput) =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      const ops = normalizeLooseRecord(input);
      if (ops.length === 0) return;
      if (h.batching.active) {
        h.batching.ops.push(...ops);
        return;
      }
      const end = h.index + 1;
      const base = end < h.entries.length ? h.entries.slice(0, end) : h.entries;
      const prev = base[base.length - 1];
      const label = extractLabel(input);
      const mergeKey = extractMergeKey(input);
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

  add: (input: RecordInput) =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
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
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      if (h.index < 0) return;
      const entry: HistoryEntry = h.entries[h.index];
      // apply in reverse for correctness
      for (let i = entry.ops.length - 1; i >= 0; i--) {
        applyOpToStore(root as ElementDraft, entry.ops[i], 'undo');
      }
      h.index -= 1;
    }),

  redo: () =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      if (h.index >= h.entries.length - 1) return;
      const entry: HistoryEntry = h.entries[h.index + 1];
      // apply forward in recorded order
      for (let i = 0; i < entry.ops.length; i++) {
        applyOpToStore(root as ElementDraft, entry.ops[i], 'redo');
      }
      h.index += 1;
    }),

  clear: () =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      h.entries = [];
      h.index = -1;
      h.batching.active = false;
      h.batching.label = undefined;
      h.batching.mergeKey = undefined;
      h.batching.startedAt = null;
      h.batching.ops = [];
    }),

  canUndo: () => {
    const h = pickHistoryState(get() as unknown as HistoryRootDraft);
    return h.index >= 0;
  },

  canRedo: () => {
    const h = pickHistoryState(get() as unknown as HistoryRootDraft);
    return h.index < h.entries.length - 1;
  },

  setMergeWindow: (ms) =>
    set((state) => {
      const root = state as HistoryRootDraft;
      const h = pickHistoryState(root);
      h.mergeWindowMs = Math.max(0, Math.round(ms || 0));
    }),
});

export default createHistoryModule;
