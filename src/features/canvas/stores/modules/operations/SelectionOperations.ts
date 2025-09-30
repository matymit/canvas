// features/canvas/stores/modules/operations/SelectionOperations.ts
import type { WritableDraft } from "immer";
import type { ElementId } from "../../../../../../types/index";
import type { ElementState } from "./ElementOperations";

export interface SelectionState {
  selectedElementIds: Set<ElementId>;
  lastSelectedId?: ElementId;
  selectionVersion: number;
}

export function setSelection(
  draft: WritableDraft<SelectionState>,
  ids: Iterable<ElementId>
): void {
  draft.selectedElementIds = new Set(ids);
  const arr = Array.from(draft.selectedElementIds);
  draft.lastSelectedId = arr[arr.length - 1];
  draft.selectionVersion += 1;
}

export function clearSelection(
  draft: WritableDraft<SelectionState & ElementState>
): void {
  draft.selectedElementIds = new Set<ElementId>();
  // Fallback to first element if available
  const fallback = draft.elementOrder.length > 0 ? draft.elementOrder[0] : undefined;
  draft.lastSelectedId = fallback ?? draft.lastSelectedId;
  draft.selectionVersion += 1;
}

export function addToSelection(
  draft: WritableDraft<SelectionState>,
  id: ElementId
): void {
  const next = new Set<ElementId>(draft.selectedElementIds);
  next.add(id);
  draft.selectedElementIds = next;
  draft.lastSelectedId = id;
  draft.selectionVersion += 1;
}

export function removeFromSelection(
  draft: WritableDraft<SelectionState>,
  id: ElementId
): void {
  if (!draft.selectedElementIds.has(id)) return;
  
  const next = new Set<ElementId>(draft.selectedElementIds);
  next.delete(id);
  draft.selectedElementIds = next;
  
  if (draft.lastSelectedId === id) {
    const arr = Array.from(next);
    draft.lastSelectedId = arr[arr.length - 1];
  }
  draft.selectionVersion += 1;
}

export function toggleSelection(
  draft: WritableDraft<SelectionState>,
  id: ElementId
): void {
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
}

export function replaceSelectionWithSingle(
  draft: WritableDraft<SelectionState>,
  id: ElementId
): void {
  draft.selectedElementIds = new Set<ElementId>([id]);
  draft.lastSelectedId = id;
  draft.selectionVersion += 1;
}

export function pruneSelection(
  draft: WritableDraft<SelectionState & ElementState>
): void {
  const ids = draft.selectedElementIds;
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
}

export function bumpSelectionVersion(
  draft: WritableDraft<SelectionState>
): void {
  draft.selectionVersion += 1;
}

export function deselectElements(
  draft: WritableDraft<SelectionState>,
  ids: ElementId[]
): void {
  let changed = false;
  for (const id of ids) {
    if (draft.selectedElementIds.delete(id)) {
      changed = true;
    }
  }
  if (changed) draft.selectionVersion += 1;
}

// Query helpers
export function isSelected(
  state: SelectionState,
  id: ElementId
): boolean {
  return state.selectedElementIds.has(id);
}

export function selectionCount(state: SelectionState): number {
  return state.selectedElementIds.size;
}

export function getSelectedIds(state: SelectionState): ElementId[] {
  return Array.from(state.selectedElementIds);
}
