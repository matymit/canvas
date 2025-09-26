// features/canvas/hooks/useCanvasHistory.ts
import { useCallback, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import type {
  HistoryOp} from './useCanvasHistoryHelpers';
import {
  applyOps,
} from './useCanvasHistoryHelpers';

export type HistoryEntry = {
  id: string;
  label?: string;
  ops: HistoryOp[];
  ts: number;
};

export type UseCanvasHistoryOptions = {
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  maxSteps?: number;           // cap history length
  mergeWindowMs?: number;      // coalesce pushes with same label within this window
};

export type UseCanvasHistory = {
  pushOps: (ops: HistoryOp[] | HistoryOp, label?: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  size: number;
  index: number;
};

const idGen = (() => {
  let n = 0;
  return () => `h-${Date.now().toString(36)}-${(++n).toString(36)}`;
})();

export function useCanvasHistory(options: UseCanvasHistoryOptions): UseCanvasHistory {
  const { stageRef, maxSteps = 200, mergeWindowMs = 250 } = options;

  const historyRef = useRef<HistoryEntry[]>([]);
  const indexRef = useRef<number>(-1);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Removed tick state as size/index are now computed directly without triggering re-renders

  const updateFlags = useCallback(() => {
    const size = historyRef.current.length;
    const idx = indexRef.current;
    setCanUndo(idx >= 0);
    setCanRedo(idx < size - 1);
    // No longer need to update tick
  }, []);

  const stageOrThrow = useCallback((): Konva.Stage => {
    const s = stageRef.current;
    if (!s) throw new Error('Stage is not available');
    return s;
  }, [stageRef]);

  const pushOps = useCallback(
    (opsIn: HistoryOp[] | HistoryOp, label?: string) => {
      const ops = Array.isArray(opsIn) ? opsIn : [opsIn];
      if (ops.length === 0) return;

      const now = Date.now();
      const entries = historyRef.current;
      const at = indexRef.current;

      // Drop redo tail if not at the end
      const next = entries.slice(0, at + 1);

      // Try to merge with previous entry if label matches and within window
      const prev = next[next.length - 1];
      if (
        prev &&
        label &&
        prev.label === label &&
        now - prev.ts <= mergeWindowMs
      ) {
        prev.ops.push(...ops);
        prev.ts = now;
        historyRef.current = next;
        indexRef.current = next.length - 1;
      } else {
        const entry: HistoryEntry = {
          id: idGen(),
          label,
          ops,
          ts: now,
        };
        next.push(entry);

        // Enforce maxSteps
        let trimmed = next;
        if (next.length > maxSteps) {
          const overflow = next.length - maxSteps;
          trimmed = next.slice(overflow);
          // Adjust index accordingly
        }
        historyRef.current = trimmed;
        indexRef.current = historyRef.current.length - 1;
      }

      updateFlags();
    },
    [mergeWindowMs, maxSteps, updateFlags]
  );

  const undo = useCallback(() => {
    const idx = indexRef.current;
    if (idx < 0) return;
    const entry = historyRef.current[idx];
    const stage = stageOrThrow();
    applyOps(stage, entry.ops, 'undo');
    indexRef.current = idx - 1;
    // After applying several layer batchDraw calls, a stage draw is safe
    stage.draw();
    updateFlags();
  }, [stageOrThrow, updateFlags]);

  const redo = useCallback(() => {
    const entries = historyRef.current;
    const idx = indexRef.current;
    if (idx >= entries.length - 1) return;
    const entry = entries[idx + 1];
    const stage = stageOrThrow();
    applyOps(stage, entry.ops, 'redo');
    indexRef.current = idx + 1;
    stage.draw();
    updateFlags();
  }, [stageOrThrow, updateFlags]);

  const clear = useCallback(() => {
    historyRef.current = [];
    indexRef.current = -1;
    updateFlags();
  }, [updateFlags]);

  // expose size/index through memo keyed by tick
  const size = useMemo(() => historyRef.current.length, []);
  const index = useMemo(() => indexRef.current, []);

  return {
    pushOps,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    size,
    index,
  };
}