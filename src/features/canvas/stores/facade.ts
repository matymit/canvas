import { useUnifiedCanvasStore } from './unifiedCanvasStore';
import type { ElementId, CanvasElement } from '../../../../types';

export const StoreSelectors = {
  viewport: () => useUnifiedCanvasStore((s) => s.viewport),
  selectedTool: () => useUnifiedCanvasStore((s) => s.selectedTool ?? s.ui?.selectedTool),
  elements: () => useUnifiedCanvasStore((s) => s.elements),
  selectedIds: () => useUnifiedCanvasStore((s) => s.selectedElementIds),
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
};
