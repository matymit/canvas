// features/canvas/stores/modules/elementModule.ts
import type { StoreSlice } from './types';
import type { ElementId, CanvasElement } from '../../../../../types/index';

export interface ElementModuleSlice {
  elements: Map<ElementId, CanvasElement>;
  elementOrder: ElementId[]; // rendering order

  // Queries
  hasElement: (id: ElementId) => boolean;
  getElement: (id: ElementId) => CanvasElement | undefined;
  getElements: (ids: Iterable<ElementId>) => CanvasElement[];
  getAllElementsInOrder: () => CanvasElement[];

  // Mutators
  addElement: (
    element: CanvasElement,
    opts?: { index?: number; select?: boolean; pushHistory?: boolean }
  ) => void;

  addElements: (
    elements: CanvasElement[],
    opts?: { index?: number; selectIds?: ElementId[]; pushHistory?: boolean }
  ) => void;

  updateElement: (
    id: ElementId,
    patch: Partial<CanvasElement> | ((el: CanvasElement) => CanvasElement),
    opts?: { pushHistory?: boolean }
  ) => void;

  updateElements: (
    patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>,
    opts?: { pushHistory?: boolean }
  ) => void;

  moveElement: (id: ElementId, toIndex: number) => void;
  bringToFront: (id: ElementId) => void;
  sendToBack: (id: ElementId) => void;

  removeElement: (id: ElementId, opts?: { pushHistory?: boolean; deselect?: boolean }) => void;
  removeElements: (ids: ElementId[], opts?: { pushHistory?: boolean; deselect?: boolean }) => void;

  duplicateElement: (id: ElementId, opts?: { offset?: { x: number; y: number } }) => ElementId | undefined;

  // Utilities
  replaceAll: (elements: CanvasElement[], order?: ElementId[]) => void;

  // Required unified interface object
  element: {
    upsert: (el: CanvasElement) => ElementId;
    update: (id: ElementId, patch: Partial<CanvasElement>) => void;
    delete: (id: ElementId) => void;
    duplicate: (id: ElementId) => ElementId | null;
    bringToFront: (id: ElementId) => void;
    sendToBack: (id: ElementId) => void;
    getById: (id: ElementId) => CanvasElement | undefined;
    getAll: () => CanvasElement[];
  };
}

function __deepClone<T>(v: T): T {
  try {
    return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  } catch {
    return JSON.parse(JSON.stringify(v));
  }
}

export const createElementModule: StoreSlice<ElementModuleSlice> = (set, get) => ({
  elements: new Map<ElementId, CanvasElement>(),
  elementOrder: [],

  hasElement: (id) => get().elements.has(id),

  getElement: (id) => get().elements.get(id),

  getElements: (ids) => {
    const map = get().elements;
    const out: CanvasElement[] = [];
    const idArray = Array.isArray(ids) ? ids : Array.from(ids);
    for (const id of idArray) {
      const el = map.get(id);
      if (el) out.push(el);
    }
    return out;
  },

  getAllElementsInOrder: () => {
    const map = get().elements;
    return get().elementOrder.map((id) => map.get(id)).filter(Boolean) as CanvasElement[];
  },

  addElement: (element, opts) => {
    set((state) => {
      const index = Math.max(
        0,
        Math.min(
          typeof opts?.index === 'number' ? opts.index : state.elementOrder.length,
          state.elementOrder.length
        )
      );

      // write map immutably
      state.elements = new Map<ElementId, CanvasElement>(state.elements);
      state.elements.set(element.id as ElementId, element);

      // maintain order
      state.elementOrder = state.elementOrder.slice();
      state.elementOrder.splice(index, 0, element.id as ElementId);

      // optional selection
      const sel = (state as any).selectedElementIds ?? (state as any).selection?.selectedElementIds;
      if (opts?.select && sel) {
        const next = new Set<ElementId>(sel);
        next.add(element.id as ElementId);
        if ('selectedElementIds' in state) (state as any).selectedElementIds = next;
        if ((state as any).selection && 'selectedElementIds' in (state as any).selection) {
          (state as any).selection.selectedElementIds = next;
        }
        if ('selectionVersion' in state) (state as any).selectionVersion = ((state as any).selectionVersion ?? 0) + 1;
        if ((state as any).selection && 'selectionVersion' in (state as any).selection) {
          (state as any).selection.selectionVersion = ((state as any).selection.selectionVersion ?? 0) + 1;
        }
      }
    });
    if (opts?.pushHistory) {
      const root = get() as any;
      root.record?.({ op: 'add', elements: [element] });
    }
  },

  addElements: (elements, opts) => {
    set((state) => {
      state.elements = new Map<ElementId, CanvasElement>(state.elements);
      state.elementOrder = state.elementOrder.slice();

      const selectIds = new Set<ElementId>(opts?.selectIds ?? []);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const at =
          typeof opts?.index === 'number' ? Math.min(state.elementOrder.length, opts.index + i) : state.elementOrder.length;
        state.elements.set(el.id as ElementId, el);
        state.elementOrder.splice(at, 0, el.id as ElementId);
      }

      // optional selection
      const sel = (state as any).selectedElementIds ?? (state as any).selection?.selectedElementIds;
      if (sel && selectIds.size > 0) {
        const next = new Set<ElementId>(sel);
        selectIds.forEach((id) => next.add(id));
        if ('selectedElementIds' in state) (state as any).selectedElementIds = next;
        if ((state as any).selection && 'selectedElementIds' in (state as any).selection) {
          (state as any).selection.selectedElementIds = next;
        }
        if ('selectionVersion' in state) (state as any).selectionVersion = ((state as any).selectionVersion ?? 0) + 1;
        if ((state as any).selection && 'selectionVersion' in (state as any).selection) {
          (state as any).selection.selectionVersion = ((state as any).selection.selectionVersion ?? 0) + 1;
        }
      }
    });
    if (opts?.pushHistory) {
      const root = get() as any;
      root.record?.({ op: 'add', elements });
    }
  },

  updateElement: (id, patch, opts) => {
    // Capture plain "before" outside of immer draft
    const beforeOriginal = __deepClone((get() as any).getElement?.(id) ?? (get() as any).element?.getById?.(id));
    set((state) => {
      const prev = state.elements?.get(id) ?? (state as any).element?.elements?.get?.(id);
      if (!prev) return;
      const next = typeof patch === 'function' ? (patch as any)(prev) : { ...prev, ...patch };

      // map immutable write
      const map: Map<ElementId, CanvasElement> =
        state.elements ?? (state as any).element?.elements ?? new Map<ElementId, CanvasElement>();
      const newMap = new Map<ElementId, CanvasElement>(map);
      newMap.set(id, next);
      if ('elements' in state) state.elements = newMap;
      else if ((state as any).element && 'elements' in (state as any).element) (state as any).element.elements = newMap;
    });
    if (opts?.pushHistory && beforeOriginal) {
      const afterOriginal = __deepClone((get() as any).getElement?.(id) ?? (get() as any).element?.getById?.(id));
      if (afterOriginal) {
        const root = get() as any;
        root.record?.({ op: 'update', before: [beforeOriginal], after: [afterOriginal] });
      }
    }
  },

  updateElements: (patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>, opts?: { pushHistory?: boolean }) => {
    const ids = patches.map(p => p.id);
    const beforeOriginals: CanvasElement[] = ids
      .map((id) => (get() as any).getElement?.(id) ?? (get() as any).element?.getById?.(id))
      .filter(Boolean)
      .map(__deepClone);

    set((state) => {
      const map: Map<ElementId, CanvasElement> =
        state.elements ?? (state as any).element?.elements ?? new Map<ElementId, CanvasElement>();
      const newMap = new Map<ElementId, CanvasElement>(map);

      for (const { id, patch } of patches) {
        const prev = newMap.get(id);
        if (!prev) continue;
        const next = { ...prev, ...patch };
        newMap.set(id, next);
      }

      if ('elements' in state) state.elements = newMap;
      else if ((state as any).element && 'elements' in (state as any).element) (state as any).element.elements = newMap;
    });
    if (opts?.pushHistory && beforeOriginals.length > 0) {
      const afterOriginals: CanvasElement[] = ids
        .map((id) => (get() as any).getElement?.(id) ?? (get() as any).element?.getById?.(id))
        .filter(Boolean)
        .map(__deepClone);
      const root = get() as any;
      root.record?.({ op: 'update', before: beforeOriginals, after: afterOriginals });
    }
  },

  moveElement: (id, toIndex) =>
    set((state) => {
      const order: ElementId[] = state.elementOrder.slice();
      const from = order.indexOf(id);
      if (from === -1) return;
      order.splice(from, 1);
      const clamped = Math.max(0, Math.min(order.length, toIndex));
      order.splice(clamped, 0, id);
      state.elementOrder = order;
    }),

  bringToFront: (id) =>
    set((state) => {
      const order: ElementId[] = state.elementOrder.slice();
      const from = order.indexOf(id);
      if (from === -1) return;
      order.splice(from, 1);
      order.push(id);
      state.elementOrder = order;
    }),

  sendToBack: (id) =>
    set((state) => {
      const order: ElementId[] = state.elementOrder.slice();
      const from = order.indexOf(id);
      if (from === -1) return;
      order.splice(from, 1);
      order.unshift(id);
      state.elementOrder = order;
    }),

  removeElement: (id, opts) => {
    let removed: CanvasElement | null = null;
    set((state) => {
      const map: Map<ElementId, CanvasElement> =
        state.elements ?? (state as any).element?.elements ?? new Map<ElementId, CanvasElement>();
      const prev = map.get(id);
      if (!prev) return;

      const newMap = new Map<ElementId, CanvasElement>(map);
      newMap.delete(id);

      if ('elements' in state) state.elements = newMap;
      else if ((state as any).element && 'elements' in (state as any).element) (state as any).element.elements = newMap;

      const order: ElementId[] = state.elementOrder.slice();
      const idx = order.indexOf(id);
      if (idx >= 0) {
        order.splice(idx, 1);
        state.elementOrder = order;
      }

      if (opts?.deselect) {
        const sel = (state as any).selectedElementIds ?? (state as any).selection?.selectedElementIds;
        if (sel) {
          const next = new Set<ElementId>(sel);
          next.delete(id);
          if ('selectedElementIds' in state) (state as any).selectedElementIds = next;
          if ((state as any).selection && 'selectedElementIds' in (state as any).selection) {
            (state as any).selection.selectedElementIds = next;
          }
          if ('selectionVersion' in state) (state as any).selectionVersion = ((state as any).selectionVersion ?? 0) + 1;
          if ((state as any).selection && 'selectionVersion' in (state as any).selection) {
            (state as any).selection.selectionVersion = ((state as any).selection.selectionVersion ?? 0) + 1;
          }
        }
      }

      removed = prev;
    });
    if (opts?.pushHistory && removed) {
      const root = get() as any;
      root.record?.({ op: 'remove', elements: [__deepClone(removed)] });
    }
  },

  removeElements: (ids, opts) => {
    let removed: CanvasElement[] = [];
    set((state) => {
      const map: Map<ElementId, CanvasElement> =
        state.elements ?? (state as any).element?.elements ?? new Map<ElementId, CanvasElement>();
      const newMap = new Map<ElementId, CanvasElement>(map);
      removed = [];

      for (const id of ids) {
        const prev = newMap.get(id);
        if (prev) {
          newMap.delete(id);
          removed.push(prev);
        }
      }

      if ('elements' in state) state.elements = newMap;
      else if ((state as any).element && 'elements' in (state as any).element) (state as any).element.elements = newMap;

      if (removed.length > 0) {
        const toRemove = new Set(ids);
        state.elementOrder = state.elementOrder.filter((eid: ElementId) => !toRemove.has(eid));
      }

      if (opts?.deselect) {
        const sel = (state as any).selectedElementIds ?? (state as any).selection?.selectedElementIds;
        if (sel) {
          const next = new Set<ElementId>(sel);
          ids.forEach((id) => next.delete(id));
          if ('selectedElementIds' in state) (state as any).selectedElementIds = next;
          if ((state as any).selection && 'selectedElementIds' in (state as any).selection) {
            (state as any).selection.selectedElementIds = next;
          }
          if ('selectionVersion' in state) (state as any).selectionVersion = ((state as any).selectionVersion ?? 0) + 1;
          if ((state as any).selection && 'selectionVersion' in (state as any).selection) {
            (state as any).selection.selectionVersion = ((state as any).selection.selectionVersion ?? 0) + 1;
          }
        }
      }
    });
    if (opts?.pushHistory && removed.length > 0) {
      const root = get() as any;
      root.record?.({ op: 'remove', elements: removed.map(__deepClone) });
    }
  },

  duplicateElement: (id, opts) => {
    const el = get().elements.get(id);
    if (!el) return undefined;
    const clone = { ...el } as any;
    const newId = (crypto?.randomUUID?.() ?? `${id}-copy`) as unknown as ElementId;
    clone.id = newId;

    // apply simple position offset if present
    const dx = opts?.offset?.x ?? 12;
    const dy = opts?.offset?.y ?? 12;
    if ('x' in clone && typeof clone.x === 'number') clone.x += dx;
    if ('y' in clone && typeof clone.y === 'number') clone.y += dy;
    if ('points' in clone && Array.isArray(clone.points) && clone.points.length >= 2) {
      const pts = clone.points as number[];
      const shifted: number[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        shifted.push(pts[i] + dx, pts[i + 1] + dy);
      }
      clone.points = shifted;
    }

    // add to store and select
    const add = (get() as any).addElement ?? (get() as any).element?.addElement;
    add?.(clone as CanvasElement, { select: true, pushHistory: true });

    return newId;
  },

  replaceAll: (elements, order) =>
    set((state) => {
      const map = new Map<ElementId, CanvasElement>();
      for (const el of elements) map.set(el.id as ElementId, el);
      state.elements = map;
      state.elementOrder = order ?? elements.map((e) => e.id as ElementId);

      // prune selection of missing ids
      const sel = (state as any).selectedElementIds ?? (state as any).selection?.selectedElementIds;
      if (sel) {
        const next = new Set<ElementId>();
        sel.forEach((id: ElementId) => {
          if (map.has(id)) next.add(id);
        });
        if ('selectedElementIds' in state) (state as any).selectedElementIds = next;
        if ((state as any).selection && 'selectedElementIds' in (state as any).selection) {
          (state as any).selection.selectedElementIds = next;
        }
        if ('selectionVersion' in state) (state as any).selectionVersion = ((state as any).selectionVersion ?? 0) + 1;
        if ((state as any).selection && 'selectionVersion' in (state as any).selection) {
          (state as any).selection.selectionVersion = ((state as any).selection.selectionVersion ?? 0) + 1;
        }
      }
    }),

  // Required unified interface object
  element: {
    upsert: (el: CanvasElement) => {
      const currentState = get();
      currentState.addElement(el);
      return el.id as ElementId;
    },
    update: (id: ElementId, patch: Partial<CanvasElement>) => {
      get().updateElement(id, patch);
    },
    delete: (id: ElementId) => {
      get().removeElement(id);
    },
    duplicate: (id: ElementId): ElementId | null => {
      return get().duplicateElement(id) ?? null;
    },
    bringToFront: (id: ElementId) => {
      get().bringToFront(id);
    },
    sendToBack: (id: ElementId) => {
      get().sendToBack(id);
    },
    getById: (id: ElementId) => {
      return get().getElement(id);
    },
    getAll: () => {
      return get().getAllElementsInOrder();
    },
  },
});

export default createElementModule;