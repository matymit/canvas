// features/canvas/stores/modules/coreModule.ts
import type { StoreSlice } from "./types";
import type { ElementId, CanvasElement } from "../../../../../types/index";

// ============================================================================
// ELEMENT MODULE TYPES AND IMPLEMENTATION
// ============================================================================

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
    opts?: { index?: number; select?: boolean; pushHistory?: boolean },
  ) => void;

  addElements: (
    elements: CanvasElement[],
    opts?: { index?: number; selectIds?: ElementId[]; pushHistory?: boolean },
  ) => void;

  updateElement: (
    id: ElementId,
    patch: Partial<CanvasElement> | ((el: CanvasElement) => CanvasElement),
    opts?: { pushHistory?: boolean },
  ) => void;

  updateElements: (
    patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>,
    opts?: { pushHistory?: boolean },
  ) => void;

  moveElement: (id: ElementId, toIndex: number) => void;
  bringToFront: (id: ElementId) => void;
  sendToBack: (id: ElementId) => void;

  removeElement: (
    id: ElementId,
    opts?: { pushHistory?: boolean; deselect?: boolean },
  ) => void;
  removeElements: (
    ids: ElementId[],
    opts?: { pushHistory?: boolean; deselect?: boolean },
  ) => void;

  duplicateElement: (
    id: ElementId,
    opts?: { offset?: { x: number; y: number } },
  ) => ElementId | undefined;

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
    replaceAll: (elements: CanvasElement[], order?: ElementId[]) => void;
  };
}

// ============================================================================
// SELECTION MODULE TYPES AND IMPLEMENTATION
// ============================================================================

function firstElementIdOrNull(state: ElementModuleSlice): ElementId | undefined {
  const order: ElementId[] = Array.isArray(state.elementOrder)
    ? state.elementOrder
    : [];
  return order.length > 0 ? order[0] : undefined;
}

export interface SelectionModuleSlice {
  selectedElementIds: Set<ElementId>;
  lastSelectedId?: ElementId;
  isTransforming: boolean;
  selectionVersion: number; // bump to refresh transformer

  // Queries
  isSelected: (id: ElementId) => boolean;
  selectionCount: () => number;
  getSelectedIds: () => ElementId[];

  // Mutators
  setSelection: (ids: Iterable<ElementId>) => void;
  clearSelection: () => void;
  addToSelection: (id: ElementId) => void;
  removeFromSelection: (id: ElementId) => void;
  toggleSelection: (id: ElementId) => void;
  replaceSelectionWithSingle: (id: ElementId) => void;

  // Transformer lifecycle
  beginTransform: () => void;
  endTransform: () => void;

  // Utilities
  pruneSelection: () => void; // remove ids that no longer exist
  bumpSelectionVersion: () => void;

  // Required unified interface object
  selection: {
    selectOne: (id: ElementId, additive?: boolean) => void;
    set: (ids: ElementId[]) => void;
    toggle: (id: ElementId) => void;
    clear: () => void;
    selectAll: () => void;
    deleteSelected: () => void;
    moveSelectedBy: (dx: number, dy: number) => void;
    getSelected: () => CanvasElement[]; // CanvasElement[]
    beginTransform: () => void;
    endTransform: () => void;
  };
}

// ============================================================================
// VIEWPORT MODULE TYPES AND IMPLEMENTATION
// ============================================================================

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  minScale: number;
  maxScale: number;
}

export interface ViewportModuleSlice {
  viewport: ViewportState & {
    setPan: (x: number, y: number) => void;
    setScale: (scale: number) => void;
    zoomAt: (clientX: number, clientY: number, deltaScale: number) => void;
    zoomIn: (centerX?: number, centerY?: number, step?: number) => void;
    zoomOut: (centerX?: number, centerY?: number, step?: number) => void;
    reset: () => void;
    fitToContent: (padding?: number) => void;
    worldToStage: (x: number, y: number) => { x: number; y: number };
    stageToWorld: (x: number, y: number) => { x: number; y: number };
  };
}

function getElementBounds(
  el: CanvasElement,
): { x: number; y: number; width: number; height: number } | null {
  if (typeof el?.x === "number" && typeof el?.y === "number") {
    if (typeof el?.width === "number" && typeof el?.height === "number") {
      return { x: el.x, y: el.y, width: el.width, height: el.height };
    }
    if (Array.isArray(el?.points) && el.points.length >= 2) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < el.points.length; i += 2) {
        xs.push(el.points[i]);
        ys.push(el.points[i + 1]);
      }
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
  return null;
}

// ============================================================================
// COMBINED CORE MODULE SLICE
// ============================================================================

export interface CoreModuleSlice
  extends ElementModuleSlice,
    SelectionModuleSlice,
    ViewportModuleSlice {}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function __deepClone<T>(v: T): T {
  if (v === null || v === undefined) return v;

  try {
    // For basic primitives, return as-is
    if (typeof v !== "object") return v;

    // Try JSON serialization first (simplest approach)
    return JSON.parse(JSON.stringify(v));
  } catch {
    try {
      // Fallback: shallow clone for objects/arrays
      if (Array.isArray(v)) return v.slice() as unknown as T;
      if (v && typeof v === "object") {
        const copy = {} as T;
        for (const key in v) {
          if (Object.prototype.hasOwnProperty.call(v, key)) {
            (copy as Record<string, unknown>)[key] = (v as Record<string, unknown>)[key];
          }
        }
        return copy;
      }
      return v;
    } catch {
      // Last resort: return original value
      return v;
    }
  }
}

function __sanitize<T>(v: T): T {
  try {
    if (v && typeof v === "object" && v !== null) {
      // Handle both arrays and objects properly
      const copy = Array.isArray(v) ? v.slice() : { ...v };
      for (const k of Object.keys(copy)) {
        if (k.startsWith("_")) delete (copy as Record<string, unknown>)[k];
      }
      return copy as T;
    }
  } catch (error) {
    // Ignore sanitization errors
  }
  return v;
}

// ============================================================================
// CORE MODULE CREATOR
// ============================================================================

export const createCoreModule: StoreSlice<CoreModuleSlice> = (set, get) => {
  // Viewport constants and utilities
  const VIEWPORT_DEFAULTS = {
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.1,
    maxScale: 4,
  };

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function toWorld(x: number, y: number) {
    const state = get();
    const vp = (state as CoreModuleSlice).viewport;
    return { x: (x - vp.x) / vp.scale, y: (y - vp.y) / vp.scale };
  }

  function toStage(x: number, y: number) {
    const state = get();
    const vp = (state as CoreModuleSlice).viewport;
    return { x: x * vp.scale + vp.x, y: y * vp.scale + vp.y };
  }

  return {
    // ========================================================================
    // ELEMENT MODULE IMPLEMENTATION
    // ========================================================================
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
      return get()
        .elementOrder.map((id) => map.get(id))
        .filter(Boolean) as CanvasElement[];
    },

    addElement: (element, opts) => {
      set((state) => {
        const index = Math.max(
          0,
          Math.min(
            typeof opts?.index === "number"
              ? opts.index
              : state.elementOrder.length,
            state.elementOrder.length,
          ),
        );

        // write map immutably
        state.elements = new Map<ElementId, CanvasElement>(state.elements);
        state.elements.set(element.id as ElementId, __sanitize(element));

        // maintain order
        state.elementOrder = state.elementOrder.slice();
        state.elementOrder.splice(index, 0, element.id as ElementId);

        // optional selection
        const sel =
          (state as any).selectedElementIds ??
          (state as any).selection?.selectedElementIds;
        if (opts?.select && sel) {
          const next = new Set<ElementId>(sel);
          next.add(element.id as ElementId);
          if ("selectedElementIds" in state)
            (state as any).selectedElementIds = next;
          if (
            (state as any).selection &&
            "selectedElementIds" in (state as any).selection
          ) {
            (state as any).selection.selectedElementIds = next;
          }
          if ("selectionVersion" in state)
            (state as any).selectionVersion =
              ((state as any).selectionVersion ?? 0) + 1;
          if (
            (state as any).selection &&
            "selectionVersion" in (state as any).selection
          ) {
            (state as any).selection.selectionVersion =
              ((state as any).selection.selectionVersion ?? 0) + 1;
          }
        }
      });
      if (opts?.pushHistory) {
        const root = get() as any;
        root.record?.({ op: "add", elements: [element] });
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
            typeof opts?.index === "number"
              ? Math.min(state.elementOrder.length, opts.index + i)
              : state.elementOrder.length;
          state.elements.set(el.id as ElementId, __sanitize(el));
          state.elementOrder.splice(at, 0, el.id as ElementId);
        }

        // optional selection
        const sel =
          (state as any).selectedElementIds ??
          (state as any).selection?.selectedElementIds;
        if (sel && selectIds.size > 0) {
          const next = new Set<ElementId>(sel);
          selectIds.forEach((id) => next.add(id));
          if ("selectedElementIds" in state)
            (state as any).selectedElementIds = next;
          if (
            (state as any).selection &&
            "selectedElementIds" in (state as any).selection
          ) {
            (state as any).selection.selectedElementIds = next;
          }
          if ("selectionVersion" in state)
            (state as any).selectionVersion =
              ((state as any).selectionVersion ?? 0) + 1;
          if (
            (state as any).selection &&
            "selectionVersion" in (state as any).selection
          ) {
            (state as any).selection.selectionVersion =
              ((state as any).selection.selectionVersion ?? 0) + 1;
          }
        }
      });
      if (opts?.pushHistory) {
        const root = get() as any;
        root.record?.({ op: "add", elements });
      }
    },

    updateElement: (id, patch, opts) => {
      // Capture plain "before" outside of immer draft
      const beforeOriginal = __deepClone(
        (get() as any).getElement?.(id) ??
          (get() as any).element?.getById?.(id),
      );

      set((state) => {
        const prev =
          state.elements?.get(id) ??
          (state as any).element?.elements?.get?.(id);
        if (!prev) return;
        const next = __sanitize(
          typeof patch === "function"
            ? (patch as (el: CanvasElement) => CanvasElement)(prev)
            : { ...prev, ...patch },
        );


        // map immutable write
        const map: Map<ElementId, CanvasElement> =
          state.elements ??
          (state as any).element?.elements ??
          new Map<ElementId, CanvasElement>();
        const newMap = new Map<ElementId, CanvasElement>(map);
        newMap.set(id, next);
        if ("elements" in state) state.elements = newMap;
        else if ((state as any).element && "elements" in (state as any).element)
          (state as any).element.elements = newMap;

      });

      if (opts?.pushHistory && beforeOriginal) {
        const afterOriginal = __deepClone(
          (get() as any).getElement?.(id) ??
            (get() as any).element?.getById?.(id),
        );
        if (afterOriginal) {
          const root = get() as any;
          root.record?.({
            op: "update",
            before: [beforeOriginal],
            after: [afterOriginal],
          });
        }
      }
    },

    updateElements: (
      patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>,
      opts?: { pushHistory?: boolean },
    ) => {
      const ids = patches.map((p) => p.id);
      const beforeOriginals: CanvasElement[] = ids
        .map(
          (id) =>
            (get() as any).getElement?.(id) ??
            (get() as any).element?.getById?.(id),
        )
        .filter(Boolean)
        .map(__deepClone);

      set((state) => {
        const map: Map<ElementId, CanvasElement> =
          state.elements ??
          (state as any).element?.elements ??
          new Map<ElementId, CanvasElement>();
        const newMap = new Map<ElementId, CanvasElement>(map);

        for (const { id, patch } of patches) {
          const prev = newMap.get(id);
          if (!prev) continue;
          const next = { ...prev, ...patch };
          newMap.set(id, next);
        }

        if ("elements" in state) state.elements = newMap;
        else if ((state as any).element && "elements" in (state as any).element)
          (state as any).element.elements = newMap;
      });
      if (opts?.pushHistory && beforeOriginals.length > 0) {
        const afterOriginals: CanvasElement[] = ids
          .map(
            (id) =>
              (get() as any).getElement?.(id) ??
              (get() as any).element?.getById?.(id),
          )
          .filter(Boolean)
          .map(__deepClone);
        const root = get() as any;
        root.record?.({
          op: "update",
          before: beforeOriginals,
          after: afterOriginals,
        });
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
      // Get the element to remove BEFORE the state mutation
      const elementToRemove = get().elements.get(id);
      if (!elementToRemove) return;

      // Clone the element outside of the state mutation
      const removed = __deepClone(elementToRemove);

      set((state) => {
        const map: Map<ElementId, CanvasElement> =
          state.elements ??
          (state as any).element?.elements ??
          new Map<ElementId, CanvasElement>();

        const newMap = new Map<ElementId, CanvasElement>(map);
        newMap.delete(id);

        if ("elements" in state) state.elements = newMap;
        else if ((state as any).element && "elements" in (state as any).element)
          (state as any).element.elements = newMap;

        const order: ElementId[] = state.elementOrder.slice();
        const idx = order.indexOf(id);
        if (idx >= 0) {
          order.splice(idx, 1);
          state.elementOrder = order;
        }

        if (opts?.deselect) {
          const sel =
            (state as any).selectedElementIds ??
            (state as any).selection?.selectedElementIds;
          if (sel) {
            const next = new Set<ElementId>(sel);
            next.delete(id);
            if ("selectedElementIds" in state)
              (state as any).selectedElementIds = next;
            if (
              (state as any).selection &&
              "selectedElementIds" in (state as any).selection
            ) {
              (state as any).selection.selectedElementIds = next;
            }
            if ("selectionVersion" in state)
              (state as any).selectionVersion =
                ((state as any).selectionVersion ?? 0) + 1;
            if (
              (state as any).selection &&
              "selectionVersion" in (state as any).selection
            ) {
              (state as any).selection.selectionVersion =
                ((state as any).selection.selectionVersion ?? 0) + 1;
            }
          }
        }
      });

      if (opts?.pushHistory && removed) {
        const root = get() as any;
        root.record?.({ op: "remove", elements: [removed] });
      }
    },

    removeElements: (ids, opts) => {
      // Get elements to remove BEFORE the state mutation
      const elementsToRemove: CanvasElement[] = [];
      const currentElements = get().elements;
      for (const id of ids) {
        const el = currentElements.get(id);
        if (el) {
          elementsToRemove.push(__deepClone(el));
        }
      }

      set((state) => {
        const map: Map<ElementId, CanvasElement> =
          state.elements ??
          (state as any).element?.elements ??
          new Map<ElementId, CanvasElement>();
        const newMap = new Map<ElementId, CanvasElement>(map);

        // Remove elements from the map
        for (const id of ids) {
          newMap.delete(id);
        }

        if ("elements" in state) state.elements = newMap;
        else if ((state as any).element && "elements" in (state as any).element)
          (state as any).element.elements = newMap;

        if (elementsToRemove.length > 0) {
          const toRemove = new Set(ids);
          state.elementOrder = state.elementOrder.filter(
            (eid: ElementId) => !toRemove.has(eid),
          );
        }

        if (opts?.deselect) {
          const sel =
            (state as any).selectedElementIds ??
            (state as any).selection?.selectedElementIds;
          if (sel) {
            const next = new Set<ElementId>(sel);
            ids.forEach((id) => next.delete(id));
            if ("selectedElementIds" in state)
              (state as any).selectedElementIds = next;
            if (
              (state as any).selection &&
              "selectedElementIds" in (state as any).selection
            ) {
              (state as any).selection.selectedElementIds = next;
            }
            if ("selectionVersion" in state)
              (state as any).selectionVersion =
                ((state as any).selectionVersion ?? 0) + 1;
            if (
              (state as any).selection &&
              "selectionVersion" in (state as any).selection
            ) {
              (state as any).selection.selectionVersion =
                ((state as any).selection.selectionVersion ?? 0) + 1;
            }
          }
        }
      });

      if (opts?.pushHistory && elementsToRemove.length > 0) {
        const root = get() as any;
        root.record?.({ op: "remove", elements: elementsToRemove });
      }
    },

    duplicateElement: (id, opts) => {
      const el = get().elements.get(id);
      if (!el) return undefined;
      const clone = { ...el } as CanvasElement;
      const newId = (crypto?.randomUUID?.() ??
        `${id}-copy`) as unknown as ElementId;
      clone.id = newId;

      // apply simple position offset if present
      const dx = opts?.offset?.x ?? 12;
      const dy = opts?.offset?.y ?? 12;
      if ("x" in clone && typeof clone.x === "number") clone.x += dx;
      if ("y" in clone && typeof clone.y === "number") clone.y += dy;
      if (
        "points" in clone &&
        Array.isArray(clone.points) &&
        clone.points.length >= 2
      ) {
        const pts = clone.points as number[];
        const shifted: number[] = [];
        for (let i = 0; i < pts.length; i += 2) {
          shifted.push(pts[i] + dx, pts[i + 1] + dy);
        }
        clone.points = shifted;
      }

      // add to store and select
      const add =
        (get() as any).addElement ?? (get() as any).element?.addElement;
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
        const sel =
          (state as any).selectedElementIds ??
          (state as any).selection?.selectedElementIds;
        if (sel) {
          const next = new Set<ElementId>();
          sel.forEach((id: ElementId) => {
            if (map.has(id)) next.add(id);
          });
          if ("selectedElementIds" in state)
            (state as any).selectedElementIds = next;
          if (
            (state as any).selection &&
            "selectedElementIds" in (state as any).selection
          ) {
            (state as any).selection.selectedElementIds = next;
          }
          if ("selectionVersion" in state)
            (state as any).selectionVersion =
              ((state as any).selectionVersion ?? 0) + 1;
          if (
            (state as any).selection &&
            "selectionVersion" in (state as any).selection
          ) {
            (state as any).selection.selectionVersion =
              ((state as any).selection.selectionVersion ?? 0) + 1;
          }
        }
      }),

    // Required unified interface object with history tracking
    element: {
      upsert: (el: CanvasElement) => {
        const currentState = get();
        // Use pushHistory flag for history tracking
        currentState.addElement(el, { pushHistory: true });
        return el.id as ElementId;
      },
      update: (id: ElementId, patch: Partial<CanvasElement>) => {
        // Use pushHistory flag for history tracking
        get().updateElement(id, patch, { pushHistory: true });
      },
      delete: (id: ElementId) => {
        // Use pushHistory flag for history tracking
        get().removeElement(id, { pushHistory: true, deselect: true });
      },
      duplicate: (id: ElementId): ElementId | null => {
        // duplicateElement already includes pushHistory internally
        return get().duplicateElement(id) ?? null;
      },
      bringToFront: (id: ElementId) => {
        // Record before state for history
        const beforeOrder = get().elementOrder.slice();
        get().bringToFront(id);
        const afterOrder = get().elementOrder.slice();

        // Only record if order actually changed
        if (JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder)) {
          const root = get() as any;
          root.record?.({
            op: "reorder",
            before: beforeOrder,
            after: afterOrder,
          });
        }
      },
      sendToBack: (id: ElementId) => {
        // Record before state for history
        const beforeOrder = get().elementOrder.slice();
        get().sendToBack(id);
        const afterOrder = get().elementOrder.slice();

        // Only record if order actually changed
        if (JSON.stringify(beforeOrder) !== JSON.stringify(afterOrder)) {
          const root = get() as any;
          root.record?.({
            op: "reorder",
            before: beforeOrder,
            after: afterOrder,
          });
        }
      },
      getById: (id: ElementId) => {
        return get().getElement(id);
      },
      getAll: () => {
        return get().getAllElementsInOrder();
      },
      replaceAll: (elements: CanvasElement[], order?: ElementId[]) => {
        get().replaceAll(elements, order);
      },
    },

    // ========================================================================
    // SELECTION MODULE IMPLEMENTATION
    // ========================================================================
    selectedElementIds: new Set<ElementId>(),
    lastSelectedId: undefined,
    isTransforming: false,
    selectionVersion: 0,

    isSelected: (id) => get().selectedElementIds.has(id),

    selectionCount: () => get().selectedElementIds.size,

    getSelectedIds: () => Array.from(get().selectedElementIds),

    setSelection: (ids) =>
      set((state) => {
        state.selectedElementIds = new Set(ids);
        const arr = Array.from(state.selectedElementIds);
        (state as any).lastSelectedId = arr[arr.length - 1];
        (state as any).selectionVersion++;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedElementIds = new Set<ElementId>();
        // Keep lastSelectedId to allow overlay reattach after reload if elements exist
        const fallback = firstElementIdOrNull(state);
        (state as any).lastSelectedId =
          fallback ?? (state as any).lastSelectedId;
        (state as any).selectionVersion++;
      }),

    addToSelection: (id) =>
      set((state) => {
        const next = new Set<ElementId>(state.selectedElementIds);
        next.add(id);
        state.selectedElementIds = next;
        (state as any).lastSelectedId = id;
        (state as any).selectionVersion++;
      }),

    removeFromSelection: (id) =>
      set((state) => {
        if (!state.selectedElementIds.has(id)) return;
        const next = new Set<ElementId>(state.selectedElementIds);
        next.delete(id);
        state.selectedElementIds = next;
        if ((state as any).lastSelectedId === id) {
          const arr = Array.from(next);
          (state as any).lastSelectedId = arr[arr.length - 1];
        }
        (state as any).selectionVersion++;
      }),

    toggleSelection: (id) =>
      set((state) => {
        const next = new Set<ElementId>(state.selectedElementIds);
        if (next.has(id)) {
          next.delete(id);
          if ((state as any).lastSelectedId === id) {
            const arr = Array.from(next);
            (state as any).lastSelectedId = arr[arr.length - 1];
          }
        } else {
          next.add(id);
          (state as any).lastSelectedId = id;
        }
        state.selectedElementIds = next;
        (state as any).selectionVersion++;
      }),

    replaceSelectionWithSingle: (id) =>
      set((state) => {
        state.selectedElementIds = new Set<ElementId>([id]);
        (state as any).lastSelectedId = id;
        (state as any).selectionVersion++;
      }),

    beginTransform: () =>
      set((state) => {
        (state as any).isTransforming = true;
      }),

    endTransform: () =>
      set((state) => {
        (state as any).isTransforming = false;
        (state as any).selectionVersion++; // ensure transformer handles refresh
      }),

    pruneSelection: () =>
      set((state) => {
        const ids: Set<ElementId> = state.selectedElementIds;
        const elements: Map<ElementId, unknown> | undefined =
          (state as any).elements ?? (state as any).element?.elements;
        if (!elements) return;
        let changed = false;
        const next = new Set<ElementId>();
        ids.forEach((id) => {
          if (elements.has(id)) next.add(id);
          else changed = true;
        });
        if (changed) {
          state.selectedElementIds = next;
          (state as any).selectionVersion++;
        }
      }),

    bumpSelectionVersion: () =>
      set((state) => {
        (state as any).selectionVersion++;
      }),

    // Required unified interface object
    selection: {
      selectOne: (id: ElementId, additive?: boolean) => {
        const currentState = get();
        if (additive) {
          currentState.addToSelection(id);
        } else {
          currentState.replaceSelectionWithSingle(id);
        }
        // Ensure at least one selected id exists for overlay
        const ids = Array.from(get().selectedElementIds);
        if (ids.length === 0) {
          const first = firstElementIdOrNull(get());
          if (first) get().setSelection([first]);
        }
      },
      set: (ids: ElementId[]) => {
        get().setSelection(ids);
      },
      toggle: (id: ElementId) => {
        get().toggleSelection(id);
      },
      clear: () => {
        get().clearSelection();
      },
      selectAll: () => {
        // Get all element IDs from the store
        const state = get();
        const allIds = (state as any).elementOrder ?? [];
        state.setSelection(allIds);
      },
      deleteSelected: () => {
        const state = get();
        const selectedIds = Array.from(state.selectedElementIds);
        // Remove each selected element
        selectedIds.forEach((id) => {
          const removeElement =
            (state as any).removeElement ?? (state as any).element?.delete;
          removeElement?.(id);
        });
        // Clear selection
        state.clearSelection();
      },
      moveSelectedBy: (dx: number, dy: number) => {
        const state = get();
        const selectedIds = Array.from(state.selectedElementIds);
        // Update each selected element position
        selectedIds.forEach((id) => {
          const updateElement =
            (state as any).updateElement ?? (state as any).element?.update;
          updateElement?.(id, (el: CanvasElement) => ({
            ...el,
            x: el.x + dx,
            y: el.y + dy,
          }));
        });
      },
      getSelected: () => {
        const state = get();
        const selectedIds = Array.from(state.selectedElementIds);
        const getElements =
          (state as any).getElements ?? (state as any).element?.getAll;
        if (getElements && (state as any).getElements) {
          return (state as any).getElements(selectedIds);
        }
        // Fallback: get from elements map
        const elements =
          (state as any).elements ?? (state as any).element?.elements;
        if (elements) {
          return selectedIds.map((id) => elements.get(id)).filter(Boolean);
        }
        return [];
      },
      beginTransform: () => {
        get().beginTransform();
      },
      endTransform: () => {
        get().endTransform();
      },
    },

    // ========================================================================
    // VIEWPORT MODULE IMPLEMENTATION
    // ========================================================================
    viewport: {
      ...VIEWPORT_DEFAULTS,

      setPan: (x, y) => {
        set((draft) => {
          (draft as any).viewport.x = x;
          (draft as any).viewport.y = y;
        });
      },

      setScale: (scale) => {
        set((draft) => {
          const vp = (draft as any).viewport;
          vp.scale = clamp(scale, vp.minScale, vp.maxScale);
        });
      },

      zoomAt: (clientX, clientY, deltaScale) => {
        const { viewport } = get() as any;
        const targetScale = clamp(
          viewport.scale * deltaScale,
          viewport.minScale,
          viewport.maxScale,
        );
        const before = toWorld(clientX, clientY);
        set((draft) => {
          (draft as any).viewport.scale = targetScale;
        });
        const after = toStage(before.x, before.y);
        set((draft) => {
          (draft as any).viewport.x += clientX - after.x;
          (draft as any).viewport.y += clientY - after.y;
        });
      },

      zoomIn: (cx, cy, step = 1.2) => {
        const centerX = cx ?? 0;
        const centerY = cy ?? 0;
        (get() as any).viewport.zoomAt(centerX, centerY, step);
      },

      zoomOut: (cx, cy, step = 1 / 1.2) => {
        const centerX = cx ?? 0;
        const centerY = cy ?? 0;
        (get() as any).viewport.zoomAt(centerX, centerY, step);
      },

      reset: () => {
        set((draft) => {
          const vp = (draft as any).viewport;
          vp.x = VIEWPORT_DEFAULTS.x;
          vp.y = VIEWPORT_DEFAULTS.y;
          vp.scale = VIEWPORT_DEFAULTS.scale;
          vp.minScale = VIEWPORT_DEFAULTS.minScale;
          vp.maxScale = VIEWPORT_DEFAULTS.maxScale;
        });
      },

      fitToContent: (padding = 64) => {
        const entries = Array.from((get() as any).elements.entries());
        if (entries.length === 0) {
          (get() as any).viewport.reset();
          return;
        }
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        entries.forEach((entry) => {
          const [, el] = entry as [ElementId, CanvasElement];
          const b = getElementBounds(el);
          if (!b) return;
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        });

        if (
          !isFinite(minX) ||
          !isFinite(minY) ||
          !isFinite(maxX) ||
          !isFinite(maxY)
        ) {
          return;
        }

        const contentW = maxX - minX + padding * 2;
        const contentH = maxY - minY + padding * 2;
        // Assume stage size is managed by component; we fit relative to a nominal view box.
        // Consumers may call reset + fitToContent with actual container size.
        const targetW = 1200; // Fallback if container size is unknown here
        const targetH = 800;
        const scaleX = targetW / Math.max(contentW, 1);
        const scaleY = targetH / Math.max(contentH, 1);
        const nextScale = clamp(
          Math.min(scaleX, scaleY),
          (get() as any).viewport.minScale,
          (get() as any).viewport.maxScale,
        );
        const stageCenterX = targetW / 2;
        const stageCenterY = targetH / 2;
        const worldCenterX = (minX + maxX) / 2;
        const worldCenterY = (minY + maxY) / 2;

        set((draft) => {
          const vp = (draft as any).viewport;
          vp.scale = nextScale;
          const stagePt = {
            x: worldCenterX * vp.scale,
            y: worldCenterY * vp.scale,
          };
          vp.x = stageCenterX - stagePt.x;
          vp.y = stageCenterY - stagePt.y;
        });
      },

      worldToStage: toStage,

      stageToWorld: toWorld,
    },
  };
};

export default createCoreModule;
