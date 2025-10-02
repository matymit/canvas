// features/canvas/stores/modules/coreModule.ts
import type { WritableDraft } from "immer";
import type { StoreSlice } from "./types";
import type { HistoryModuleSlice } from "./historyModule";
import type { ElementId, CanvasElement } from "../../../../../types/index";
import * as ElementOps from "./operations/ElementOperations";
import * as SelectionOps from "./operations/SelectionOperations";
import * as ViewportOps from "./operations/ViewportOperations";
import { deepClone } from "./operations/utils";

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

// ============================================================================
// COMBINED CORE MODULE SLICE
// ============================================================================

type HistoryCompat = Pick<
  HistoryModuleSlice,
  | "record"
  | "add"
  | "push"
  | "withUndo"
  | "beginBatch"
  | "endBatch"
>;

export interface CoreModuleSlice
  extends ElementModuleSlice,
    SelectionModuleSlice,
    ViewportModuleSlice {
  history?: Partial<HistoryCompat>;
  record?: HistoryModuleSlice["record"];
  add?: HistoryModuleSlice["add"];
  push?: HistoryModuleSlice["push"];
  withUndo?: HistoryModuleSlice["withUndo"];
  beginBatch?: HistoryModuleSlice["beginBatch"];
  endBatch?: HistoryModuleSlice["endBatch"];
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
  const getHistoryApi = (): Partial<HistoryCompat> => {
    const state = get();
    return state.history ?? state;
  };

  // Helper to wrap operations in set() calls
  const wrapMutation = <T extends unknown[]>(
    fn: (draft: CoreDraft, ...args: T) => void
  ) => (...args: T) => set((state) => fn(state as CoreDraft, ...args));

  return {
    // ========================================================================
    // STATE (viewport defined in unified interface below)
    // ========================================================================
    elements: new Map<ElementId, CanvasElement>(),
    elementOrder: [],
    selectedElementIds: new Set<ElementId>(),
    lastSelectedId: undefined,
    isTransforming: false,
    selectionVersion: 0,

    // ========================================================================
    // ELEMENT QUERIES (direct delegation)
    // ========================================================================
    hasElement: (id) => ElementOps.hasElement(get(), id),
    getElement: (id) => ElementOps.getElement(get(), id),
    getElements: (ids) => ElementOps.getElements(get(), ids),
    getAllElementsInOrder: () => ElementOps.getAllElementsInOrder(get()),

    // ========================================================================
    // ELEMENT MUTATIONS (with history tracking)
    // ========================================================================
    addElement: (element, opts) => {
      wrapMutation((draft) => ElementOps.addElement(draft, element, opts?.index))();
      if (opts?.pushHistory) getHistoryApi().record?.({ type: "add", elements: [element] });
      if (opts?.select) get().selection.selectOne(element.id as ElementId, false);
    },

    addElements: (elements, opts) => {
      wrapMutation((draft) => ElementOps.addElements(draft, elements, opts?.index))();
      if (opts?.pushHistory) getHistoryApi().record?.({ type: "add", elements });
      if (opts?.selectIds?.length) {
        const combined = new Set(get().selectedElementIds);
        opts.selectIds.forEach((id) => combined.add(id));
        get().setSelection(Array.from(combined));
      }
    },

    updateElement: (id, patch, opts) => {
      const before = deepClone(get().getElement(id));
      wrapMutation((draft) => ElementOps.updateElement(draft, id, patch))();
      if (opts?.pushHistory && before) {
        const after = deepClone(get().getElement(id));
        if (after) getHistoryApi().record?.({ type: "update", before: [before], after: [after] });
      }
    },

    updateElements: (patches, opts) => {
      const ids = patches.map((p) => p.id);
      const before = ids.map((id) => get().getElement(id)).filter((el): el is CanvasElement => Boolean(el)).map(deepClone);
      wrapMutation((draft) => ElementOps.updateElements(draft, patches))();
      if (opts?.pushHistory && before.length) {
        const after = ids.map((id) => get().getElement(id)).filter((el): el is CanvasElement => Boolean(el)).map(deepClone);
        getHistoryApi().record?.({ type: "update", before, after });
      }
    },

    moveElement: wrapMutation(ElementOps.moveElement),
    bringToFront: wrapMutation(ElementOps.bringToFront),
    sendToBack: wrapMutation(ElementOps.sendToBack),

    removeElement: (id, opts) => {
      const removed = deepClone(get().elements.get(id));
      if (!removed) return;
      wrapMutation((draft) => {
        ElementOps.removeElement(draft, id);
        if (opts?.deselect) SelectionOps.deselectElements(draft, [id]);
      })();
      if (opts?.pushHistory) getHistoryApi().record?.({ type: "remove", elements: [removed] });
    },

    removeElements: (ids, opts) => {
      const removed = ids.map((id) => get().elements.get(id)).filter((el): el is CanvasElement => Boolean(el)).map(deepClone);
      wrapMutation((draft) => {
        ElementOps.removeElements(draft, ids);
        if (opts?.deselect) SelectionOps.deselectElements(draft, ids);
      })();
      if (opts?.pushHistory && removed.length) {
        getHistoryApi().record?.({ type: "remove", elements: removed });
      }
    },

    duplicateElement: (id, opts) => {
      let newId: ElementId | undefined;
      set((state) => {
        const result = ElementOps.duplicateElement(state as CoreDraft, id, opts?.offset);
        if (result) newId = result.newId;
      });
      if (newId) {
        get().selection.selectOne(newId, false);
        const newEl = get().getElement(newId);
        if (newEl) getHistoryApi().record?.({ type: "add", elements: [newEl] });
      }
      return newId;
    },

    replaceAll: (elements, order) =>
      wrapMutation((draft) => {
        ElementOps.replaceAllElements(draft, elements, order);
        const validIds = new Set<ElementId>();
        draft.selectedElementIds.forEach((id) => {
          if (draft.elements.has(id)) validIds.add(id);
        });
        if (validIds.size !== draft.selectedElementIds.size || 
            (draft.lastSelectedId && !draft.elements.has(draft.lastSelectedId))) {
          SelectionOps.setSelection(draft, validIds);
        }
      })(),

    // ========================================================================
    // SELECTION QUERIES (direct delegation)
    // ========================================================================
    isSelected: (id) => SelectionOps.isSelected(get(), id),
    selectionCount: () => SelectionOps.selectionCount(get()),
    getSelectedIds: () => SelectionOps.getSelectedIds(get()),

    // ========================================================================
    // SELECTION MUTATIONS
    // ========================================================================
    setSelection: wrapMutation(SelectionOps.setSelection),
    clearSelection: wrapMutation(SelectionOps.clearSelection),
    addToSelection: wrapMutation(SelectionOps.addToSelection),
    removeFromSelection: wrapMutation(SelectionOps.removeFromSelection),
    toggleSelection: wrapMutation(SelectionOps.toggleSelection),
    replaceSelectionWithSingle: wrapMutation(SelectionOps.replaceSelectionWithSingle),
    pruneSelection: wrapMutation(SelectionOps.pruneSelection),
    bumpSelectionVersion: wrapMutation(SelectionOps.bumpSelectionVersion),
    beginTransform: () => set((state) => { (state as CoreDraft).isTransforming = true; }),
    endTransform: () => wrapMutation((draft) => { draft.isTransforming = false; SelectionOps.bumpSelectionVersion(draft); })(),

    // ========================================================================
    // UNIFIED INTERFACE OBJECTS
    // ========================================================================
    element: {
      upsert: (el) => { get().addElement(el, { pushHistory: true }); return el.id as ElementId; },
      update: (id, patch) => get().updateElement(id, patch, { pushHistory: true }),
      delete: (id) => get().removeElement(id, { pushHistory: true, deselect: true }),
      duplicate: (id) => get().duplicateElement(id) ?? null,
      bringToFront: (id) => { const before = get().elementOrder.slice(); get().bringToFront(id); const after = get().elementOrder.slice(); if (JSON.stringify(before) !== JSON.stringify(after)) getHistoryApi().record?.({ type: "reorder", before, after }); },
      sendToBack: (id) => { const before = get().elementOrder.slice(); get().sendToBack(id); const after = get().elementOrder.slice(); if (JSON.stringify(before) !== JSON.stringify(after)) getHistoryApi().record?.({ type: "reorder", before, after }); },
      getById: (id) => get().getElement(id),
      getAll: () => get().getAllElementsInOrder(),
      replaceAll: (elements, order) => get().replaceAll(elements, order),
    },

    selection: {
      selectOne: (id, additive) => { if (additive) get().addToSelection(id); else get().replaceSelectionWithSingle(id); const ids = Array.from(get().selectedElementIds); if (!ids.length) { const first = get().elementOrder[0]; if (first) get().setSelection([first]); } },
      set: (ids) => get().setSelection(ids),
      toggle: (id) => get().toggleSelection(id),
      clear: () => get().clearSelection(),
      selectAll: () => get().setSelection(get().elementOrder.slice()),
      deleteSelected: () => {
        const state = get();
        const ids = Array.from(state.selectedElementIds);
        if (!ids.length) return;

        const performDelete = () => state.removeElements(ids, { pushHistory: true, deselect: true });
        if (state.withUndo) {
          state.withUndo("Delete elements", performDelete);
        } else {
          performDelete();
        }
      },
      moveSelectedBy: (dx, dy) => { const ids = Array.from(get().selectedElementIds); ids.forEach((id) => get().updateElement(id, (el) => ({ ...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy }))); },
      getSelected: () => get().getElements(Array.from(get().selectedElementIds)),
      beginTransform: () => get().beginTransform(),
      endTransform: () => get().endTransform(),
    },

    viewport: {
      ...ViewportOps.VIEWPORT_DEFAULTS,
      setPan: (x, y) => wrapMutation((draft) => ViewportOps.setPan(draft, x, y))(),
      setScale: (scale) => wrapMutation((draft) => ViewportOps.setScale(draft, scale))(),
      zoomAt: (cx, cy, delta) => wrapMutation((draft) => ViewportOps.zoomAt(draft, cx, cy, delta))(),
      zoomIn: (cx = 0, cy = 0, step = 1.2) => get().viewport.zoomAt(cx, cy, step),
      zoomOut: (cx = 0, cy = 0, step = 1 / 1.2) => get().viewport.zoomAt(cx, cy, step),
      reset: () => wrapMutation(ViewportOps.resetViewport)(),
      fitToContent: (padding = 64) => set((state) => ViewportOps.fitToContent(state as CoreDraft, (state as CoreDraft).elements, padding)),
      worldToStage: (x, y) => ViewportOps.worldToStage(get().viewport, x, y),
      stageToWorld: (x, y) => ViewportOps.stageToWorld(get().viewport, x, y),
    },
  };
};

export default createCoreModule;
