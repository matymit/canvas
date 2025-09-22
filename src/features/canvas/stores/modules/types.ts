// features/canvas/stores/modules/types.ts

import type { CanvasElement } from '../../../../../types/index';

/**
 * Type definition for Zustand store slice creators with Immer
 */
export type StoreSlice<T> = (
  set: (fn: (state: T) => void | T | Partial<T>) => void,
  get: () => T
) => T;

/**
 * Common options for store operations
 */
export interface StoreOptions {
  pushHistory?: boolean;
  skipNotify?: boolean;
}

/**
 * History operation types
 */
export interface HistoryOperation {
  op: 'add' | 'update' | 'remove' | 'move';
  before?: CanvasElement[];
  after?: CanvasElement[];
  elements?: CanvasElement[];
}