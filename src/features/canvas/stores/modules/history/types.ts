// features/canvas/stores/modules/history/types.ts
// Type definitions for history module
// Extracted from historyModule.ts lines 1-120

import type { ElementId, CanvasElement } from '../../../../../../types/index';

// Type for element data properties that may contain large data
export interface ElementDataWithPoints {
  points?: number[];
}

export interface ElementDataWithDataUrl {
  dataUrl?: string;
}

export interface ElementDataWithCells {
  cells?: Array<{ text: string }>;
}

export interface ElementDataWithText {
  text?: string;
}

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
  record(input: StoreHistoryOp | StoreHistoryOp[] | CanvasElement | CanvasElement[]): void;  // normalize and delegate to push()
  add(input: StoreHistoryOp | StoreHistoryOp[] | CanvasElement | CanvasElement[]): void;     // alias

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
