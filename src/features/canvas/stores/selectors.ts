import type { UnifiedCanvasStore } from "./unifiedCanvasStore";
import type { CanvasElement, ElementId } from "../../../../types";

// Read-only selectors to reduce coupling on the full store

export const selectViewport = (s: UnifiedCanvasStore) => s.viewport;
export const selectSelectedTool = (s: UnifiedCanvasStore) => s.ui?.selectedTool;
export const selectElementsMap = (s: UnifiedCanvasStore) => s.elements;
export const selectSelectedIds = (s: UnifiedCanvasStore) => s.selectedElementIds;

export function getElementById(state: UnifiedCanvasStore, id: ElementId): CanvasElement | undefined {
  return state.elements.get(id);
}

export function getSelectedElements(state: UnifiedCanvasStore): CanvasElement[] {
  const out: CanvasElement[] = [];
  state.selectedElementIds.forEach((id) => {
    const el = state.elements.get(id);
    if (el) out.push(el);
  });
  return out;
}

export function getAllElements(state: UnifiedCanvasStore): CanvasElement[] {
  return Array.from(state.elements.values());
}

