// features/canvas/stores/modules/coreModule.ts
import type { WritableDraft } from "immer";
import type { StoreSlice } from "./types";
import type { HistoryModuleSlice } from "./historyModule";
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

function firstElementIdOrNull(
  state: ElementModuleSlice,
): ElementId | undefined {
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
            (copy as Record<string, unknown>)[key] = (
              v as Record<string, unknown>
            )[key];
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

type CoreDraft = WritableDraft<
  CoreModuleSlice &
  SelectionModuleSlice &
  HistoryModuleSlice
>;

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
    const { viewport: vp } = get();
    return { x: (x - vp.x) / vp.scale, y: (y - vp.y) / vp.scale };
  }

  function toStage(x: number, y: number) {
    const { viewport: vp } = get();
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
        const draft = state as CoreDraft;
        const index = Math.max(
          0,
          Math.min(
            typeof opts?.index === "number"
              ? opts.index
              : draft.elementOrder.length,
            draft.elementOrder.length,
          ),
        );

        // write map immutably
        draft.elements = new Map<ElementId, CanvasElement>(draft.elements);
        draft.elements.set(element.id as ElementId, __sanitize(element));

        // maintain order
        draft.elementOrder = draft.elementOrder.slice();
        draft.elementOrder.splice(index, 0, element.id as ElementId);
      });
      if (opts?.pushHistory) {
        const root = get() as HistoryModuleSlice;
        root.record?.({ type: "add", elements: [element] });
      }
      if (opts?.select) {
        get().selection.selectOne(element.id as ElementId, true);
      }
    },

    addElements: (elements, opts) => {
      set((state) => {
        const draft = state as CoreDraft;
        draft.elements = new Map<ElementId, CanvasElement>(draft.elements);
        draft.elementOrder = draft.elementOrder.slice();

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const at =
            typeof opts?.index === "number"
              ? Math.min(draft.elementOrder.length, opts.index + i)
              : draft.elementOrder.length;
          draft.elements.set(el.id as ElementId, __sanitize(el));
          draft.elementOrder.splice(at, 0, el.id as ElementId);
        }
      });
      if (opts?.pushHistory) {
        const root = get() as HistoryModuleSlice;
        root.record?.({ type: "add", elements });
      }
      if (opts?.selectIds && opts.selectIds.length > 0) {
        const combined = new Set(get().selectedElementIds);
        opts.selectIds.forEach((id) => combined.add(id));
        get().setSelection(Array.from(combined));
      }
    },

    updateElement: (id, patch, opts) => {
      const beforeOriginal = __deepClone(get().getElement(id));

      set((state) => {
        const draft = state as CoreDraft;
        const prev = draft.elements.get(id);
        if (!prev) return;

        const next = __sanitize(
          typeof patch === "function"
            ? (patch as (el: CanvasElement) => CanvasElement)(prev)
            : { ...prev, ...patch },
        );

        const newMap = new Map<ElementId, CanvasElement>(draft.elements);
        newMap.set(id, next);
        draft.elements = newMap;
      });

      if (opts?.pushHistory && beforeOriginal) {
        const afterOriginal = __deepClone(get().getElement(id));
        if (afterOriginal) {
          const root = get() as HistoryModuleSlice;
          root.record?.({
            type: "update",
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
        .map((id) => get().getElement(id))
        .filter(Boolean)
        .map(__deepClone);

      set((state) => {
        const draft = state as CoreDraft;
        const newMap = new Map<ElementId, CanvasElement>(draft.elements);

        for (const { id, patch } of patches) {
          const prev = newMap.get(id);
          if (!prev) continue;
          const next = __sanitize({ ...prev, ...patch });
          newMap.set(id, next);
        }

        draft.elements = newMap;
      });
      if (opts?.pushHistory && beforeOriginals.length > 0) {
        const afterOriginals: CanvasElement[] = ids
          .map((id) => get().getElement(id))
          .filter(Boolean)
          .map(__deepClone);
        const root = get() as HistoryModuleSlice;
        root.record?.({
          type: "update",
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
      const elementToRemove = get().elements.get(id);
      if (!elementToRemove) return;

      const removed = __deepClone(elementToRemove);

      set((state) => {
        const draft = state as CoreDraft;
        const newMap = new Map<ElementId, CanvasElement>(draft.elements);
        newMap.delete(id);
        draft.elements = newMap;

        draft.elementOrder = draft.elementOrder.filter((eid) => eid !== id);

        if (opts?.deselect && draft.selectedElementIds.delete(id)) {
          draft.selectionVersion += 1;
        }
      });

      if (opts?.pushHistory) {
        const root = get() as HistoryModuleSlice;
        root.record?.({ type: "remove", elements: [removed] });
      }
    },

    removeElements: (ids, opts) => {
      const elementsToRemove: CanvasElement[] = [];
      const currentElements = get().elements;
      for (const id of ids) {
        const el = currentElements.get(id);
        if (el) {
          elementsToRemove.push(__deepClone(el));
        }
      }

      set((state) => {
        const draft = state as CoreDraft;
        const newMap = new Map<ElementId, CanvasElement>(draft.elements);

        for (const id of ids) {
          newMap.delete(id);
        }

        draft.elements = newMap;

        if (elementsToRemove.length > 0) {
          const toRemove = new Set(ids);
          draft.elementOrder = draft.elementOrder.filter(
            (eid: ElementId) => !toRemove.has(eid),
          );
        }

        if (opts?.deselect) {
          let changed = false;
          for (const id of ids) {
            if (draft.selectedElementIds.delete(id)) {
              changed = true;
            }
          }
          if (changed) draft.selectionVersion += 1;
        }
      });

      if (opts?.pushHistory && elementsToRemove.length > 0) {
        const root = get() as HistoryModuleSlice;
        root.record?.({ type: "remove", elements: elementsToRemove });
      }
    },

    duplicateElement: (id, opts) => {
      const el = get().elements.get(id);
      if (!el) return undefined;
      const baseClone = { ...el } as CanvasElement;
      const newId = (crypto?.randomUUID?.() ??
        `${id}-copy`) as unknown as ElementId;
      const clonedElement = { ...baseClone, id: newId } as CanvasElement;

      // apply simple position offset if present
      const dx = opts?.offset?.x ?? 12;
      const dy = opts?.offset?.y ?? 12;
      if ("x" in clonedElement && typeof clonedElement.x === "number") {
        clonedElement.x += dx;
      }
      if ("y" in clonedElement && typeof clonedElement.y === "number") {
        clonedElement.y += dy;
      }
      if (
        "points" in clonedElement &&
        Array.isArray(clonedElement.points) &&
        clonedElement.points.length >= 2
      ) {
        const pts = clonedElement.points as number[];
        const shifted: number[] = [];
        for (let i = 0; i < pts.length; i += 2) {
          shifted.push(pts[i] + dx, pts[i + 1] + dy);
        }
        clonedElement.points = shifted;
      }

      // add to store and select
      get().addElement(clonedElement, { select: true, pushHistory: true });

      return newId;
    },

    replaceAll: (elements, order) =>
      set((state) => {
        const draft = state as CoreDraft;
        const map = new Map<ElementId, CanvasElement>();
        for (const el of elements) map.set(el.id as ElementId, el);
        draft.elements = map;
        draft.elementOrder = order ?? elements.map((e) => e.id as ElementId);

        const nextSelection = new Set<ElementId>();
        draft.selectedElementIds.forEach((id) => {
          if (map.has(id)) nextSelection.add(id);
        });

        if (
          nextSelection.size !== draft.selectedElementIds.size ||
          (draft.lastSelectedId && !map.has(draft.lastSelectedId))
        ) {
          draft.selectedElementIds = nextSelection;
          draft.lastSelectedId = Array.from(nextSelection).pop();
          draft.selectionVersion += 1;
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
          const history = get() as HistoryModuleSlice;
          history.record?.({
            type: "reorder",
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
          const history = get() as HistoryModuleSlice;
          history.record?.({
            type: "reorder",
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
        const draft = state as CoreDraft;
        draft.selectedElementIds = new Set(ids);
        const arr = Array.from(draft.selectedElementIds);
        draft.lastSelectedId = arr[arr.length - 1];
        draft.selectionVersion += 1;
      }),

    clearSelection: () =>
      set((state) => {
        const draft = state as CoreDraft;
        draft.selectedElementIds = new Set<ElementId>();
        // Keep lastSelectedId to allow overlay reattach after reload if elements exist
        const fallback = firstElementIdOrNull(draft);
        draft.lastSelectedId = fallback ?? draft.lastSelectedId;
        draft.selectionVersion += 1;
      }),

    addToSelection: (id) =>
      set((state) => {
        const draft = state as CoreDraft;
        const next = new Set<ElementId>(draft.selectedElementIds);
        next.add(id);
        draft.selectedElementIds = next;
        draft.lastSelectedId = id;
        draft.selectionVersion += 1;
      }),

    removeFromSelection: (id) =>
      set((state) => {
        const draft = state as CoreDraft;
        if (!draft.selectedElementIds.has(id)) return;
        const next = new Set<ElementId>(draft.selectedElementIds);
        next.delete(id);
        draft.selectedElementIds = next;
        if (draft.lastSelectedId === id) {
          const arr = Array.from(next);
          draft.lastSelectedId = arr[arr.length - 1];
        }
        draft.selectionVersion += 1;
      }),

    toggleSelection: (id) =>
      set((state) => {
        const draft = state as CoreDraft;
        const next = new Set<ElementId>(draft.selectedElementIds);
        if (next.has(id)) {
          next.delete(id);
          if (draft.lastSelectedId === id) {
            const arr = Array.from(next);
            draft.lastSelectedId = arr[arr.length - 1];
          }
        } else {
          next.add(id);
          draft.lastSelectedId = id;
        }
        draft.selectedElementIds = next;
        draft.selectionVersion += 1;
      }),

    replaceSelectionWithSingle: (id) =>
      set((state) => {
        const draft = state as CoreDraft;
        draft.selectedElementIds = new Set<ElementId>([id]);
        draft.lastSelectedId = id;
        draft.selectionVersion += 1;
      }),

    beginTransform: () =>
      set((state) => {
        const draft = state as CoreDraft;
        draft.isTransforming = true;
      }),

    endTransform: () =>
      set((state) => {
        const draft = state as CoreDraft;
        draft.isTransforming = false;
        draft.selectionVersion += 1; // ensure transformer handles refresh
      }),

    pruneSelection: () =>
      set((state) => {
        const draft = state as CoreDraft;
        const ids: Set<ElementId> = draft.selectedElementIds;
        const elements = draft.elements;
        if (!elements) return;
        let changed = false;
        const next = new Set<ElementId>();
        ids.forEach((id) => {
          if (elements.has(id)) next.add(id);
          else changed = true;
        });
        if (changed) {
          draft.selectedElementIds = next;
          draft.selectionVersion += 1;
        }
      }),

    bumpSelectionVersion: () =>
      set((state) => {
        const draft = state as CoreDraft;
        draft.selectionVersion += 1;
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
        state.setSelection(state.elementOrder.slice());
      },
      deleteSelected: () => {
        const state = get();
        const selectedIds = Array.from(state.selectedElementIds);
        if (selectedIds.length === 0) return;

        const performDelete = () => {
          if (typeof state.removeElements === "function") {
            state.removeElements(selectedIds, {
              pushHistory: true,
              deselect: true,
            });
            return;
          }

          selectedIds.forEach((id) => {
            state.removeElement(id, {
              pushHistory: true,
              deselect: true,
            });
          });
        };

        if (typeof state.withUndo === "function") {
          state.withUndo("Delete elements", performDelete);
        } else {
          performDelete();
        }
      },
      moveSelectedBy: (dx: number, dy: number) => {
        const state = get();
        const selectedIds = Array.from(state.selectedElementIds);
        selectedIds.forEach((id) => {
          state.updateElement(id, (el) => ({
            ...el,
            x: (el.x ?? 0) + dx,
            y: (el.y ?? 0) + dy,
          }));
        });
      },
      getSelected: () => {
        const state = get();
        const selectedIds = Array.from(state.selectedElementIds);
        return state.getElements(selectedIds);
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
        set((state) => {
          const draft = state as CoreDraft;
          draft.viewport.x = x;
          draft.viewport.y = y;
        });
      },

      setScale: (scale) => {
        set((state) => {
          const draft = state as CoreDraft;
          const vp = draft.viewport;
          vp.scale = clamp(scale, vp.minScale, vp.maxScale);
        });
      },

      zoomAt: (clientX, clientY, deltaScale) => {
        const { viewport } = get();
        const targetScale = clamp(
          viewport.scale * deltaScale,
          viewport.minScale,
          viewport.maxScale,
        );
        const before = toWorld(clientX, clientY);
        set((state) => {
          const draft = state as CoreDraft;
          draft.viewport.scale = targetScale;
        });
        const after = toStage(before.x, before.y);
        set((state) => {
          const draft = state as CoreDraft;
          draft.viewport.x += clientX - after.x;
          draft.viewport.y += clientY - after.y;
        });
      },

      zoomIn: (cx, cy, step = 1.2) => {
        const centerX = cx ?? 0;
        const centerY = cy ?? 0;
        get().viewport.zoomAt(centerX, centerY, step);
      },

      zoomOut: (cx, cy, step = 1 / 1.2) => {
        const centerX = cx ?? 0;
        const centerY = cy ?? 0;
        get().viewport.zoomAt(centerX, centerY, step);
      },

      reset: () => {
        set((state) => {
          const draft = state as CoreDraft;
          const vp = draft.viewport;
          vp.x = VIEWPORT_DEFAULTS.x;
          vp.y = VIEWPORT_DEFAULTS.y;
          vp.scale = VIEWPORT_DEFAULTS.scale;
          vp.minScale = VIEWPORT_DEFAULTS.minScale;
          vp.maxScale = VIEWPORT_DEFAULTS.maxScale;
        });
      },

      fitToContent: (padding = 64) => {
        const entries = Array.from(get().elements.entries());
        if (entries.length === 0) {
          get().viewport.reset();
          return;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        entries.forEach(([, el]) => {
          const bounds = getElementBounds(el);
          if (!bounds) return;
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.width);
          maxY = Math.max(maxY, bounds.y + bounds.height);
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
        const targetW = 1200;
        const targetH = 800;
        const scaleX = targetW / Math.max(contentW, 1);
        const scaleY = targetH / Math.max(contentH, 1);
        const { viewport } = get();
        const nextScale = clamp(
          Math.min(scaleX, scaleY),
          viewport.minScale,
          viewport.maxScale,
        );

        const stageCenterX = targetW / 2;
        const stageCenterY = targetH / 2;
        const worldCenterX = (minX + maxX) / 2;
        const worldCenterY = (minY + maxY) / 2;

        set((state) => {
          const draft = state as CoreDraft;
          const vp = draft.viewport;
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
