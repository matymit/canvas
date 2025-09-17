import { useUnifiedCanvasStore } from '../../features/canvas/stores/unifiedCanvasStore';

// Mount a minimal bridge for non-React modules (renderers, Konva handlers)
export function installStoreBridge() {
  (window as any).__canvasStore = {
    element: {
      getElement: (id: string) => {
        const state = (useUnifiedCanvasStore as any).getState();
        return state.elements?.get?.(id) || state.element?.getById?.(id);
      },
      updateElement: (id: string, patch: any, opts?: any) => {
        const state = (useUnifiedCanvasStore as any).getState();
        // Try multiple possible APIs for updateElement
        if (state.element?.update) {
          state.element.update(id, patch);
        } else if (state.updateElement) {
          state.updateElement(id, patch, opts);
        }
      },
    },
    history: {
      beginBatch: (label?: string) => {
        const state = (useUnifiedCanvasStore as any).getState();
        if (state.history?.beginBatch) {
          state.history.beginBatch(label);
        }
      },
      endBatch: (commit?: boolean) => {
        const state = (useUnifiedCanvasStore as any).getState();
        if (state.history?.endBatch) {
          state.history.endBatch(commit);
        }
      },
    },
  };
}

// Helper to get store bridge safely
export function getStoreBridge() {
  return (window as any).__canvasStore;
}