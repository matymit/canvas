Phase 1: Core Infrastructure – Required Files
To establish the foundational layer (build pipeline, state management, rendering core, and event system), the following files and folders from your source tree are essential:

src/app/pages/Canvas.tsx
src/vite.config.ts

features/canvas/components/CanvasContainer.tsx
features/canvas/components/NonReactCanvasStage.tsx
features/canvas/components/ErrorBoundary.tsx

features/canvas/stores/unifiedCanvasStore.ts
features/canvas/stores/modules/elementModule.ts
features/canvas/stores/modules/selectionModule.ts
features/canvas/stores/modules/viewportModule.ts
features/canvas/stores/modules/historyModule.ts

features/canvas/utils/KonvaNodePool.ts
features/canvas/utils/performance/RafBatcher.ts
features/canvas/utils/performance/QuadTree.ts

features/canvas/contexts/CanvasEventContext.tsx
features/canvas/hooks/useCanvasSetup.ts
features/canvas/hooks/useCanvasSizing.ts
features/canvas/hooks/useRAFManager.ts
features/canvas/hooks/useViewportControls.ts

features/canvas/layers/CanvasLayerManager.ts

features/canvas/renderer/index.ts
features/canvas/renderer/layers.ts
features/canvas/renderer/TransformerController.ts


features/canvas/tauri/TauriCanvasOptimizations.ts

This set covers:

Build & entry: Vite config and Canvas entry page

State management: Unified store and core slices

Rendering core: Renderer index, layer setup, node pooling, spatial indexing

Event system: Context, hooks for setup, sizing, RAF batching, viewport controls

Infrastructure: Error boundaries, validation, Tauri integration