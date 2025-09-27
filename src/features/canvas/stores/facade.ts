import { useUnifiedCanvasStore } from './unifiedCanvasStore';
import type { UnifiedCanvasStore } from './unifiedCanvasStore';
import type { ElementId, CanvasElement } from '../../../../types';

export const StoreSelectors = {
  useViewport: () => useUnifiedCanvasStore((s) => s.viewport),
  useSelectedTool: () => useUnifiedCanvasStore((s) => s.ui?.selectedTool),
  useElements: () => useUnifiedCanvasStore((s) => s.elements),
  useSelectedIds: () => useUnifiedCanvasStore((s) => s.selectedElementIds),
  getElementById: (id: ElementId) => useUnifiedCanvasStore.getState().element.getById(id),
};

export const StoreActions = {
  withUndo: (label: string, fn: () => void) => useUnifiedCanvasStore.getState().withUndo?.(label, fn),
  updateElement: (id: ElementId, patch: Partial<CanvasElement>) => useUnifiedCanvasStore.getState().element.update(id, patch),
  bumpSelectionVersion: () => useUnifiedCanvasStore.getState().bumpSelectionVersion?.(),
  setSelectedTool: (tool: string) =>
    useUnifiedCanvasStore.getState().ui?.setSelectedTool?.(tool),
  selectSingle: (id: ElementId) => {
    const state: UnifiedCanvasStore = useUnifiedCanvasStore.getState();
    if (typeof state.replaceSelectionWithSingle === 'function') {
      return state.replaceSelectionWithSingle(id);
    }
    if (typeof state.setSelection === 'function') {
      return state.setSelection([id]);
    }
    if (state.selection && typeof state.selection.set === 'function') {
      return state.selection.set([id]);
    }
    return undefined;
  },
  panBy: (dx: number, dy: number) => useUnifiedCanvasStore.getState().panBy?.(dx, dy),
  clearSelection: () => useUnifiedCanvasStore.getState().selection.clear(),
};
