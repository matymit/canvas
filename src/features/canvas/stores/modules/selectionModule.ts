// features/canvas/stores/modules/selectionModule.ts
import type { StoreSlice } from './types';
import type { ElementId } from '../../../../../types/index';

function firstElementIdOrNull(state: any): ElementId | undefined {
  const order: ElementId[] = Array.isArray(state.elementOrder) ? state.elementOrder : [];
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
    getSelected: () => any[]; // CanvasElement[] but avoiding circular import
  };
}

export const createSelectionModule: StoreSlice<SelectionModuleSlice> = (set, get) => ({
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
      (state as any).lastSelectedId = fallback ?? (state as any).lastSelectedId;
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
      selectedIds.forEach(id => {
        const removeElement = (state as any).removeElement ?? (state as any).element?.delete;
        removeElement?.(id);
      });
      // Clear selection
      state.clearSelection();
    },
    moveSelectedBy: (dx: number, dy: number) => {
      const state = get();
      const selectedIds = Array.from(state.selectedElementIds);
      // Update each selected element position
      selectedIds.forEach(id => {
        const updateElement = (state as any).updateElement ?? (state as any).element?.update;
        updateElement?.(id, (el: any) => ({ ...el, x: el.x + dx, y: el.y + dy }));
      });
    },
    getSelected: () => {
      const state = get();
      const selectedIds = Array.from(state.selectedElementIds);
      const getElements = (state as any).getElements ?? (state as any).element?.getAll;
      if (getElements && (state as any).getElements) {
        return (state as any).getElements(selectedIds);
      }
      // Fallback: get from elements map
      const elements = (state as any).elements ?? (state as any).element?.elements;
      if (elements) {
        return selectedIds.map(id => elements.get(id)).filter(Boolean);
      }
      return [];
    },
  },
});

export default createSelectionModule;