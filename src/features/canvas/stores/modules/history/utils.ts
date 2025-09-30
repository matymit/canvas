// features/canvas/stores/modules/history/utils.ts
// Utility functions for history module
// Extracted from historyModule.ts lines 20-350

import type { WritableDraft } from 'immer';
import type { ElementId, CanvasElement } from '../../../../../../types/index';
import type { ElementModuleSlice } from '../coreModule';
import type {
  ElementDataWithPoints,
  ElementDataWithDataUrl,
  ElementDataWithCells,
  ElementDataWithText,
  StoreHistoryOp,
  HistoryEntry,
  HistoryModuleSlice
} from './types';

// Time and ID generation utils
export const now = () => Date.now();
export const idGen = (() => {
  let n = 0;
  return () => `h-${now().toString(36)}-${(n++).toString(36)}`;
})();

// Estimate memory usage of a history entry
export function estimateEntrySize(entry: HistoryEntry): number {
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
export function estimateElementSize(element: CanvasElement): number {
  let size = 500; // Base overhead for element structure
  
  // Add size estimates based on element type
  switch (element.type) {
    case 'drawing': {
      // Drawing elements can be large due to stroke points
      const points = (element.data as ElementDataWithPoints)?.points || [];
      size += points.length * 16; // x,y coordinates
      break;
    }
      
    case 'image': {
      // Images store data URLs which can be very large
      const dataUrl = (element.data as ElementDataWithDataUrl)?.dataUrl || '';
      size += dataUrl.length * 2; // Rough estimate for string storage
      break;
    }
      
    case 'table': {
      // Tables store cell data
      const cells = (element.data as ElementDataWithCells)?.cells || [];
      size += cells.length * 100; // Estimate per cell
      break;
    }
      
    case 'mindmap-node': {
      // Text content
      const text = (element.data as ElementDataWithText)?.text || '';
      size += text.length * 2;
      break;
    }
      
    default:
      // Basic elements (shapes, text, etc.)
      size += 200;
  }
  
  return size;
}

// Type guards and helper types
type ElementStateSlice = Pick<ElementModuleSlice, 'elements' | 'elementOrder' | 'element'>;
export type HistoryRootDraft = WritableDraft<
  HistoryModuleSlice &
    ElementStateSlice & {
      history?: unknown;
    }
>;
export type HistoryDraft = WritableDraft<HistoryModuleSlice>;
export type ElementDraft = WritableDraft<ElementStateSlice>;

export function pickHistoryState(state: HistoryRootDraft): HistoryDraft {
  const maybeHistory = (state as WritableDraft<{ history?: unknown }>).history;
  if (
    maybeHistory &&
    typeof maybeHistory === 'object' &&
    Array.isArray((maybeHistory as HistoryModuleSlice).entries) &&
    (maybeHistory as HistoryModuleSlice).batching
  ) {
    return maybeHistory as HistoryDraft;
  }
  return state as HistoryDraft;
}

export function coalesceInto(prev: HistoryEntry, nextOps: StoreHistoryOp[]) {
  prev.ops.push(...nextOps);
  prev.ts = now();
  // Recalculate size after merging
  prev.estimatedSize = estimateEntrySize(prev);
}

export function shouldMerge(prev: HistoryEntry, label?: string, mergeKey?: string, mergeWindowMs?: number) {
  if (!prev) return false;
  const within = now() - prev.ts <= (mergeWindowMs ?? 250);
  const sameLabel = !label || prev.label === label;
  const sameKey = !mergeKey || prev.mergeKey === mergeKey;
  return within && sameLabel && sameKey;
}

export function ensureArray<T>(v: T | T[] | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function toElementIdArray(input: unknown): ElementId[] {
  return ensureArray(input)
    .map((value) => {
      if (typeof value === 'string') {
        return value as ElementId;
      }
      if (value && typeof value === 'object' && 'id' in value) {
        return (value as CanvasElement).id as ElementId;
      }
      return undefined;
    })
    .filter((id): id is ElementId => Boolean(id));
}

interface LooseRecordObject {
  type?: StoreHistoryOp['type'];
  op?: StoreHistoryOp['type'];
  label?: string;
  mergeKey?: string;
  element?: CanvasElement;
  elements?: CanvasElement | CanvasElement[];
  payload?: {
    element?: CanvasElement;
    elements?: CanvasElement[];
    before?: CanvasElement[];
    after?: CanvasElement[];
  };
  before?: CanvasElement[];
  after?: CanvasElement[];
  orderBefore?: ElementId[];
  orderAfter?: ElementId[];
}

export type RecordInput =
  | StoreHistoryOp
  | StoreHistoryOp[]
  | CanvasElement
  | CanvasElement[]
  | LooseRecordObject;

export function isCanvasElement(value: unknown): value is CanvasElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value
  );
}

export function isStoreHistoryOp(value: unknown): value is StoreHistoryOp {
  if (!value || typeof value !== 'object') return false;
  const opType = (value as { type?: string }).type;
  switch (opType) {
    case 'add':
    case 'remove':
      return Array.isArray((value as { elements?: unknown }).elements);
    case 'update':
      return (
        Array.isArray((value as { before?: unknown }).before) &&
        Array.isArray((value as { after?: unknown }).after)
      );
    case 'reorder':
      return (
        Array.isArray((value as { before?: unknown }).before) &&
        Array.isArray((value as { after?: unknown }).after)
      );
    default:
      return false;
  }
}

export function toElementArray(value: unknown): CanvasElement[] {
  if (Array.isArray(value)) {
    return value.filter(isCanvasElement);
  }
  if (isCanvasElement(value)) {
    return [value];
  }
  return [];
}

export function normalizeLooseRecord(input: RecordInput): StoreHistoryOp[] {
  if (Array.isArray(input)) {
    return input.flatMap(normalizeLooseRecord);
  }

  if (isStoreHistoryOp(input)) {
    return [input];
  }

  if (isCanvasElement(input)) {
    return [{ type: 'add', elements: [input] }];
  }

  if (!input || typeof input !== 'object') {
    return [];
  }

  const record = input as LooseRecordObject;
  const opType = record.type ?? record.op;

  if (opType === 'add' || opType === 'remove') {
    const elements = toElementArray(
      record.elements ?? record.payload?.elements ?? record.payload?.element ?? record.element
    );
    if (!elements.length) return [];
    return [{ type: opType, elements }];
  }

  if (opType === 'update') {
    const before = ensureArray(record.before ?? record.payload?.before).filter(isCanvasElement);
    const after = ensureArray(record.after ?? record.payload?.after).filter(isCanvasElement);
    if (before.length && after.length) {
      return [{ type: 'update', before, after }];
    }
    return [];
  }

  if (opType === 'reorder') {
    const beforeOrder = toElementIdArray(record.orderBefore ?? record.before);
    const afterOrder = toElementIdArray(record.orderAfter ?? record.after);
    if (beforeOrder.length && afterOrder.length) {
      return [{ type: 'reorder', before: beforeOrder, after: afterOrder }];
    }
    return [];
  }

  // Fallback: treat unknown shapes with elements as add/remove
  const elements = toElementArray(record.elements ?? record.payload?.elements);
  if (elements.length) {
    return [{ type: 'add', elements }];
  }

  return [];
}

export function extractLabel(input: RecordInput): string | undefined {
  if (Array.isArray(input)) {
    for (const item of input) {
      const label = extractLabel(item);
      if (label) return label;
    }
    return undefined;
  }

  if (input && typeof input === 'object' && 'label' in input) {
    const { label } = input as { label?: unknown };
    if (typeof label === 'string') {
      return label;
    }
  }

  return undefined;
}

export function extractMergeKey(input: RecordInput): string | undefined {
  if (Array.isArray(input)) {
    for (const item of input) {
      const mergeKey = extractMergeKey(item);
      if (mergeKey) return mergeKey;
    }
    return undefined;
  }

  if (input && typeof input === 'object' && 'mergeKey' in input) {
    const { mergeKey } = input as { mergeKey?: unknown };
    if (typeof mergeKey === 'string') {
      return mergeKey;
    }
  }

  return undefined;
}

export function applyOpToStore(state: ElementDraft, op: StoreHistoryOp, dir: 'undo' | 'redo') {
  const baseMap: Map<ElementId, CanvasElement> =
    (state as WritableDraft<{ elements?: Map<ElementId, CanvasElement> }>).elements ??
    ((state.element as { elements?: Map<ElementId, CanvasElement> } | undefined)?.elements ??
      new Map<ElementId, CanvasElement>());
  const map = new Map<ElementId, CanvasElement>(baseMap);
  const order: ElementId[] = Array.isArray(state.elementOrder) ? state.elementOrder.slice() : [];

  const insertAt = <T>(arr: T[], index: number, value: T) => {
    const i = Math.max(0, Math.min(index, arr.length));
    arr.splice(i, 0, value);
  };

  switch (op.type) {
    case 'add': {
      if (dir === 'redo') {
        // add elements; honor indices if provided
        op.elements.forEach((el, i) => {
          map.set(el.id as ElementId, el);
          const idx = op.indices?.[i];
          if (typeof idx === 'number') insertAt(order, idx, el.id as ElementId);
          else order.push(el.id as ElementId);
        });
      } else {
        // undo add = remove
        op.elements.forEach((el) => {
          map.delete(el.id as ElementId);
          const i = order.indexOf(el.id as ElementId);
          if (i >= 0) order.splice(i, 1);
        });
      }
      break;
    }

    case 'remove': {
      if (dir === 'redo') {
        // remove elements
        op.elements.forEach((el) => {
          map.delete(el.id as ElementId);
          const i = order.indexOf(el.id as ElementId);
          if (i >= 0) order.splice(i, 1);
        });
      } else {
        // undo remove = add back
        op.elements.forEach((el, i) => {
          map.set(el.id as ElementId, el);
          const idx = op.indices?.[i];
          if (typeof idx === 'number') insertAt(order, idx, el.id as ElementId);
          else order.push(el.id as ElementId);
        });
      }
      break;
    }

    case 'update': {
      const src = dir === 'redo' ? op.after : op.before;
      src.forEach((el) => {
        map.set(el.id as ElementId, el);
      });
      break;
    }

    case 'reorder': {
      const newOrder = dir === 'redo' ? op.after : op.before;
      order.length = 0;
      order.push(...newOrder);
      break;
    }
  }

  // Write back to state
  if ((state as WritableDraft<{ elements?: Map<ElementId, CanvasElement> }>).elements) {
    (state as WritableDraft<{ elements?: Map<ElementId, CanvasElement> }>).elements = map;
  } else if (state.element && 'elements' in state.element) {
    (state.element as { elements?: Map<ElementId, CanvasElement> }).elements = map;
  }
  state.elementOrder = order;
}
