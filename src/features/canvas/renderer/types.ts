import type Konva from "konva";
import type { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import type { RendererLayers } from "./layers";
import type { TransformerControllerOptions } from "./TransformerController";

export interface CanvasElementLike {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  // Extend as needed (fill, stroke, text, points, etc.)
}

export interface CanvasRendererOptions {
  dpr?: number;
  // Provide externally if layers are managed elsewhere; otherwise created automatically
  layers?: RendererLayers;

  // Optional transformer options
  transformer?: Partial<TransformerControllerOptions>;

  // Rendering hooks
  getVisibleElements?: () => CanvasElementLike[]; // return only elements in viewport
  reconcileNode?: (element: CanvasElementLike) => Konva.Node; // create/update node and ensure it is on a layer
  disposeNode?: (node: Konva.Node) => void; // clean up node when removed

  // Selection resolution
  resolveSelectionNodes?: (ids: string[]) => Konva.Node[]; // map element ids to Konva nodes for transformer

  // Called when stage size or DPR changes for custom drawing (e.g., grid on background)
  onBackgroundDraw?: (background: Konva.Layer, stage: Konva.Stage) => void;
}

// Module registry interfaces
export interface ModuleRendererCtx {
  stage: Konva.Stage;
  layers: {
    background: Konva.Layer;
    main: Konva.Layer;
    highlighter: Konva.Group;
    preview: Konva.Layer;
    overlay: Konva.Layer;
  };
  store: typeof useUnifiedCanvasStore;
}

export interface RendererModule {
  mount(ctx: ModuleRendererCtx): () => void; // returns dispose
}
