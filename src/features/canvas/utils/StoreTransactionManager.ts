// features/canvas/utils/StoreTransactionManager.ts

// A small interface the unified store (or an adapter) should implement for history.
export interface HistoryAPI {
  // Push a single undo/redo entry
  push(entry: { id?: string; label: string; undo: () => void; redo: () => void }): void;

  // Optional explicit batches; implement as no-ops if not supported
  beginBatch?: (label: string) => void;
  commitBatch?: (label?: string) => void;
  cancelBatch?: (label?: string) => void;
}

// Generic store facade expected by this manager.
export interface StoreFacade {
  history?: HistoryAPI;
}

// An operation that knows how to undo/redo itself.
export interface TxOperation {
  redo: () => void;
  undo: () => void;
}

// A transaction that records multiple operations and commits them atomically to history.
export class StoreTransaction {
  private readonly ops: TxOperation[] = [];
  private active = true;

  constructor(private readonly store: StoreFacade, private readonly label: string) {
    // If the store supports explicit batch lifecycle, open it now.
    this.store.history?.beginBatch?.(this.label);
  }

  add(op: TxOperation) {
    if (!this.active) return;
    this.ops.push(op);
  }

  // Convenience helper when mutations are simple functions and inverse functions are known.
  addStep(redo: () => void, undo: () => void) {
    this.add({ redo, undo });
  }

  commit() {
    if (!this.active) return;
    this.active = false;

    const redo = () => {
      for (const op of this.ops) op.redo();
    };
    const undo = () => {
      // Undo in reverse order
      for (let i = this.ops.length - 1; i >= 0; i--) this.ops[i].undo();
    };

    // Push as a single entry to history.
    this.store.history?.push({ label: this.label, undo, redo });

    // Close batch if supported.
    this.store.history?.commitBatch?.(this.label);
  }

  cancel() {
    if (!this.active) return;
    this.active = false;

    // Discard ops and close batch if supported.
    this.store.history?.cancelBatch?.(this.label);
  }
}

// Utility: run a function inside a transaction; commit on success, cancel on error.
export function runInTransaction<T>(
  store: StoreFacade,
  label: string,
  fn: (tx: StoreTransaction) => T
): T {
  const tx = new StoreTransaction(store, label);
  try {
    const result = fn(tx);
    tx.commit();
    return result;
  } catch (err) {
    tx.cancel();
    throw err;
  }
}