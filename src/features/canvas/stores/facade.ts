import { useUnifiedCanvasStore } from './unifiedCanvasStore';
import type { ElementId, CanvasElement } from '../../../../types';

export const StoreSelectors = {
  useViewport: () => useUnifiedCanvasStore((s) => s.viewport),
  useSelectedTool: () => useUnifiedCanvasStore((s) => s.selectedTool ?? s.ui?.selectedTool),
  useElements: () => useUnifiedCanvasStore((s) => s.elements),
  useSelectedIds: () => useUnifiedCanvasStore((s) => s.selectedElementIds),
  getElementById: (id: ElementId) => useUnifiedCanvasStore.getState().element.getById(id),
};

export const StoreActions = {
  withUndo: (label: string, fn: () => void) => useUnifiedCanvasStore.getState().withUndo?.(label, fn),
  updateElement: (id: ElementId, patch: Partial<CanvasElement>) => useUnifiedCanvasStore.getState().element.update(id, patch),
  bumpSelectionVersion: () => useUnifiedCanvasStore.getState().bumpSelectionVersion?.(),
  setSelectedTool: (tool: string) => useUnifiedCanvasStore.getState().setSelectedTool?.(tool),
  selectSingle: (id: ElementId) => {
    const s: any = useUnifiedCanvasStore.getState();
    if (typeof s.replaceSelectionWithSingle === 'function') return s.replaceSelectionWithSingle(id);
    if (typeof s.setSelection === 'function') return s.setSelection([id]);
    if (s.selection && typeof s.selection.set === 'function') return s.selection.set([id]);
  },
  panBy: (dx: number, dy: number) => useUnifiedCanvasStore.getState().panBy?.(dx, dy),
};
