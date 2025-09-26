// features/canvas/stores/unifiedCanvasStore.ts
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

// Module creators
import { createCoreModule } from "./modules/coreModule";
import { createHistoryModule } from "./modules/historyModule";
import { createInteractionModule } from "./modules/interactionModule";

import type { CoreModuleSlice } from "./modules/coreModule";
import type { HistoryModuleSlice } from "./modules/historyModule";
import type { InteractionModuleSlice } from "./modules/interactionModule";

// Types (keep imports narrow to avoid circular types)
import type { CanvasElement, ElementId } from "../../../../types/index";
import type { StoreHistoryOp } from "./modules/historyModule";

// Persistence types
interface PersistedState {
  elements?: Array<[ElementId, CanvasElement]>;
  elementOrder?: ElementId[];
  selectedElementIds?: ElementId[];
  viewport?: {
    x: number;
    y: number;
    scale: number;
    minScale: number;
    maxScale: number;
  };
}

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  minScale: number;
  maxScale: number;
}

export interface StateSnapshot {
  elements: Array<[ElementId, CanvasElement]>;
  elementOrder: ElementId[];
  selected: ElementId[];
  viewport: ViewportState;
  description?: string;
  timestamp: number;
}

export interface HistorySlice {
  history: {
    past: StateSnapshot[];
    future: StateSnapshot[];
    limit: number;
    _batchDepth: number;
    _pending?: { before: StateSnapshot; description?: string };
    undo: () => void;
    redo: () => void;
    clear: () => void;
    beginBatch: (description?: string) => void;
    endBatch: () => void;
    snapshot: (description?: string) => void;
    withUndo: (description: string, mutator: () => void) => void;
  };
}

export interface ElementSlice {
  elements: Map<ElementId, CanvasElement>;
  elementOrder: ElementId[];
  element: {
    upsert: (el: CanvasElement) => ElementId;
    update: (id: ElementId, patch: Partial<CanvasElement>) => void;
    delete: (id: ElementId) => void;
    duplicate: (id: ElementId) => ElementId | null;
    bringToFront: (id: ElementId) => void;
    sendToBack: (id: ElementId) => void;
    getById: (id: ElementId) => CanvasElement | undefined;
    getAll: () => CanvasElement[];
  };
}

export interface SelectionSlice {
  selectedElementIds: Set<ElementId>;
  selection: {
    selectOne: (id: ElementId, additive?: boolean) => void;
    set: (ids: ElementId[]) => void;
    toggle: (id: ElementId) => void;
    clear: () => void;
    selectAll: () => void;
    deleteSelected: () => void;
    moveSelectedBy: (dx: number, dy: number) => void;
    getSelected: () => CanvasElement[];
    beginTransform: () => void;
    endTransform: () => void;
  };
}

export interface ViewportSlice {
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

export interface UISlice {
  ui: {
    selectedTool: string;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    setSelectedTool: (tool: string) => void;
    setStrokeColor: (color: string) => void;
    setFillColor: (color: string) => void;
    setStrokeWidth: (width: number) => void;
  };
}

// Add convenience properties for UI and history at root level
export interface ConvenienceSlice {
  ui: {
    selectedTool: string;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    stickyNoteColor: string;
    setSelectedTool: (tool: string) => void;
    setStrokeColor: (color: string) => void;
    setFillColor: (color: string) => void;
    setStrokeWidth: (width: number) => void;
    setStickyNoteColor: (color: string) => void;
  };
}

export type UnifiedCanvasStore = CoreModuleSlice &
  HistoryModuleSlice &
  InteractionModuleSlice &
  ConvenienceSlice & {
    panBy: (dx: number, dy: number) => void;
    // Compatibility history object for modules expecting nested history structure
    history: {
      record: (input: StoreHistoryOp | StoreHistoryOp[] | CanvasElement | CanvasElement[]) => void;
      push: (ops: StoreHistoryOp[], label?: string, mergeKey?: string) => void;
      add: (input: StoreHistoryOp | StoreHistoryOp[] | CanvasElement | CanvasElement[]) => void;
      withUndo: (description: string, mutator: () => void) => void;
      beginBatch: (label?: string) => void;
      endBatch: (commit?: boolean) => void;
      undo: () => void;
      redo: () => void;
      clear: () => void;
    };
  };

// Helper for persistence: serialize Map/Set into arrays
function partializeForPersist(state: UnifiedCanvasStore) {
  return {
    elements: Array.from(state.elements.entries()),
    elementOrder: state.elementOrder,
    selectedElementIds: Array.from(state.selectedElementIds.values()),
    viewport: {
      x: state.viewport.x,
      y: state.viewport.y,
      scale: state.viewport.scale,
      minScale: state.viewport.minScale,
      maxScale: state.viewport.maxScale,
    },
    // do not persist history to keep storage lean and avoid function serialization
  };
}

// Helper to rebuild Map/Set when rehydrating
function mergeAfterHydration(
  persisted: PersistedState,
  current: UnifiedCanvasStore,
): UnifiedCanvasStore {
  const restored = { ...current } as UnifiedCanvasStore;
  if (persisted?.elements) restored.elements = new Map(persisted.elements);
  if (persisted?.selectedElementIds) {
    restored.selectedElementIds = new Set(persisted.selectedElementIds);
  }
  if (persisted?.elementOrder) restored.elementOrder = persisted.elementOrder;
  if (persisted?.viewport) {
    restored.viewport.x = persisted.viewport.x ?? current.viewport.x;
    restored.viewport.y = persisted.viewport.y ?? current.viewport.y;
    restored.viewport.scale =
      persisted.viewport.scale ?? current.viewport.scale;
    restored.viewport.minScale =
      persisted.viewport.minScale ?? current.viewport.minScale;
    restored.viewport.maxScale =
      persisted.viewport.maxScale ?? current.viewport.maxScale;
  }
  return restored;
}

// Default tool state
const DEFAULT_UI = {
  selectedTool: "select",
  strokeColor: "#000000",
  fillColor: "#ffffff",
  strokeWidth: 2,
};

// Enable Map/Set support for Immer-based store slices
enableMapSet();

export const useUnifiedCanvasStore = create<UnifiedCanvasStore>()(
  persist(
    subscribeWithSelector(
      immer((set, get) => {
        // Create consolidated modules
        const historyModule = createHistoryModule(set as Parameters<typeof createHistoryModule>[0], get as Parameters<typeof createHistoryModule>[1]);
        const coreModule = createCoreModule(set as Parameters<typeof createCoreModule>[0], get as Parameters<typeof createCoreModule>[1]);
        const interactionModule = createInteractionModule(
          set as Parameters<typeof createInteractionModule>[0],
          get as Parameters<typeof createInteractionModule>[1],
        );

        return {
          // Spread all modules
          ...historyModule,
          ...coreModule,
          ...interactionModule,

          panBy: (dx: number, dy: number) => {
            set(state => {
              const vx = state.viewport.x ?? 0;
              const vy = state.viewport.y ?? 0;
              state.viewport.x = vx + dx;
              state.viewport.y = vy + dy;
            });
          },

          // Compatibility shim for modules that expect state.history object with helper methods
          history: {
            record: (input: StoreHistoryOp | StoreHistoryOp[] | CanvasElement | CanvasElement[]) => get().record?.(input),
            push: (ops: StoreHistoryOp[], label?: string, mergeKey?: string) =>
              get().push?.(ops, label, mergeKey),
            add: (input: StoreHistoryOp | StoreHistoryOp[] | CanvasElement | CanvasElement[]) => get().add?.(input),
            withUndo: (description: string, mutator: () => void) =>
              historyModule.withUndo(description, mutator),
            beginBatch: historyModule.beginBatch,
            endBatch: historyModule.endBatch,
            undo: historyModule.undo,
            redo: historyModule.redo,
            clear: historyModule.clear,
          },

          // Unified UI state (single source of truth)
          ui: {
            selectedTool: DEFAULT_UI.selectedTool,
            strokeColor: DEFAULT_UI.strokeColor,
            fillColor: DEFAULT_UI.fillColor,
            strokeWidth: DEFAULT_UI.strokeWidth,
            stickyNoteColor: "#FFF59D",
            setSelectedTool: (tool: string) =>
              set((state) => {
                if (state.ui) {
                  state.ui.selectedTool = tool;
                }
              }),
            setStrokeColor: (color: string) => {
              set((state) => {
                if (state.ui) {
                  state.ui.strokeColor = color;
                }
                if (state.colors) state.colors.stroke = color;
              });
              interactionModule.setStrokeColor(color);
            },
            setFillColor: (color: string) => {
              set((state) => {
                if (state.ui) {
                  state.ui.fillColor = color;
                }
                if (state.colors) state.colors.fill = color;
              });
              interactionModule.setFillColor(color);
            },
            setStrokeWidth: (width: number) =>
              set((state) => {
                if (state.ui) {
                  state.ui.strokeWidth = width;
                }
              }),
            setStickyNoteColor: (color: string) =>
              set((state) => {
                if (state.ui) {
                  state.ui.stickyNoteColor = color;
                }
                if (state.colors) state.colors.stickyNote = color;
              }),
          },
        };
      }),
    ),
    {
      name: "libreollama-canvas",
      version: 2,
      partialize: partializeForPersist,
      merge: (persisted, current) =>
        mergeAfterHydration(persisted as PersistedState, current as UnifiedCanvasStore),
    },
  ),
);
