import { useUnifiedCanvasStore } from '../../features/canvas/stores/unifiedCanvasStore';

interface StoreBridge {
  element: {
    getElement: (id: string) => unknown;
    updateElement: (id: string, patch: Record<string, unknown>, opts?: Record<string, unknown>) => void;
  };
  history: {
    beginBatch: (label?: string) => void;
    endBatch: (commit?: boolean) => void;
  };
}

interface WindowWithStoreBridge extends Window {
  __canvasStore?: StoreBridge;
}

// Mount a minimal bridge for non-React modules (renderers, Konva handlers)
export function installStoreBridge() {
  (window as WindowWithStoreBridge).__canvasStore = {
    element: {
      getElement: (id: string) => {
        const state = useUnifiedCanvasStore.getState();
        return state.elements?.get?.(id) || state.element?.getById?.(id);
      },
      updateElement: (id: string, patch: Record<string, unknown>, opts?: Record<string, unknown>) => {
        const state = useUnifiedCanvasStore.getState();
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
        const state = useUnifiedCanvasStore.getState();
        if (state.history?.beginBatch) {
          state.history.beginBatch(label);
        }
      },
      endBatch: (commit?: boolean) => {
        const state = useUnifiedCanvasStore.getState();
        if (state.history?.endBatch) {
          state.history.endBatch(commit);
        }
      },
    },
  };
}

// Helper to get store bridge safely
export function getStoreBridge(): StoreBridge | undefined {
  return (window as WindowWithStoreBridge).__canvasStore;
}