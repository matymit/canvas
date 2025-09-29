import type Konva from "konva";
import type {
  RendererLayers} from "./layers";
import {
  createRendererLayers,
  destroyLayers,
  ensureOverlayOnTop,
  resizeRenderer,
  setLayersPixelRatio,
} from "./layers";
import { TransformerController } from "./TransformerController";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
// facade not used directly here
import { StickyNoteModule } from "./modules/StickyNoteModule";
import { ConnectorRendererAdapter } from "./modules/ConnectorRendererAdapter";
import { TableModuleAdapter } from "./modules/TableModuleAdapter";
import { ImageRendererAdapter } from "./modules/ImageRendererAdapter";
import { MindmapRendererAdapter } from "./modules/MindmapRendererAdapter";
import { TextRenderer } from "./modules/TextRenderer";
import { ShapeRenderer } from "./modules/ShapeRenderer";
import { DrawingRenderer } from "./modules/DrawingRenderer";
import { SelectionModule } from "./modules/SelectionModule";
import { PortHoverModule } from "./modules/PortHoverModule";
import { ViewportRenderer } from "./modules/ViewportRenderer";

import type {
  CanvasElementLike,
  CanvasRendererOptions,
  ModuleRendererCtx,
  RendererModule,
} from "./types";

// Re-export types for backward compatibility
export type {
  CanvasElementLike,
  CanvasRendererOptions,
  ModuleRendererCtx,
  RendererModule,
} from "./types";

// CRITICAL FIX: Setup renderer modules with proper ordering
export function setupRenderer(
  stage: Konva.Stage,
  layers: ModuleRendererCtx["layers"],
) {
  const modules: RendererModule[] = [
    // Content rendering modules first
    new StickyNoteModule(),
    new ConnectorRendererAdapter(),
    new TableModuleAdapter(),
    new ImageRendererAdapter(),
    new MindmapRendererAdapter(),
    new TextRenderer(),
    new ShapeRenderer(),
    new DrawingRenderer(),
    // CRITICAL FIX: Add port hover functionality
    new PortHoverModule(),
    // Viewport renderer to handle stage transformations
    new ViewportRenderer(),
    // Selection module last so it can find rendered nodes
    new SelectionModule(),
  ];

  const unsubs = modules.map((moduleInstance) => {
    try {
      const dispose = moduleInstance.mount({
        stage,
        layers,
        store: useUnifiedCanvasStore,
      });
      // Expose PortHoverModule for tools wanting to hide ports immediately after commit
      if (moduleInstance instanceof PortHoverModule && typeof window !== "undefined") {
        window.portHoverModule = moduleInstance;
      }
      // Expose SelectionModule for marquee selection and other tools  
      if (moduleInstance instanceof SelectionModule && typeof window !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).selectionModule = moduleInstance;
      }
      return dispose;
    } catch (error) {
      return () => {}; // Return no-op dispose function
    }
  });

  return () => {
    unsubs.forEach((u) => u && u());
  };
}

/**
 * Minimal orchestrator for stage + layers + transformer with a clean, DI-friendly API.
 * It doesn't own app state; instead, callers provide element accessors & node reconciliation.
 */
export class CanvasRenderer {
  private readonly stage: Konva.Stage;
  private readonly layers: RendererLayers;
  private readonly transformer: TransformerController;
  private dpr: number;

  private readonly getVisibleElements?: () => CanvasElementLike[];
  private readonly reconcileNode?: (e: CanvasElementLike) => Konva.Node;
  // private _disposeNode?: (n: Konva.Node) => void; // Removed unused
  private readonly resolveSelectionNodes?: (ids: string[]) => Konva.Node[];
  private readonly onBackgroundDraw?: (
    background: Konva.Layer,
    stage: Konva.Stage,
  ) => void;

  constructor(stage: Konva.Stage, options: CanvasRendererOptions = {}) {
    this.stage = stage;
    this.dpr =
      options.dpr ??
      (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    this.layers =
      options.layers ?? createRendererLayers(stage, { dpr: this.dpr });

    this.getVisibleElements = options.getVisibleElements;
    this.reconcileNode = options.reconcileNode;
    // this._disposeNode = options.disposeNode; // Removed unused
    this.resolveSelectionNodes = options.resolveSelectionNodes;
    this.onBackgroundDraw = options.onBackgroundDraw;

    // Transformer mounted to overlay
    this.transformer = new TransformerController({
      stage: this.stage,
      layer: this.layers.overlay,
      keepRatio: false,
      rotateEnabled: true,
      anchorSize: 8,
      borderStroke: "#4F46E5",
      borderStrokeWidth: 1,
      anchorStroke: "#FFFFFF",
      anchorFill: "#4F46E5",
      anchorCornerRadius: 2,
      minSize: 6,
      onTransform: () => {
        // keep overlay interactive and snappy
        this.layers.overlay.batchDraw();
      },
      ...(options.transformer || {}),
    });

    ensureOverlayOnTop(this.layers);

    // Initial background render (e.g., grid)
    this.onBackgroundDraw?.(this.layers.background, this.stage);
  }

  /**
   * Render visible elements, delegating node reconciliation to the caller.
   * Keep this minimal; higher-level batching and culling should feed getVisibleElements.
   */
  render() {
    const elements = this.getVisibleElements?.() ?? [];
    if (this.reconcileNode) {
      for (const el of elements) {
        this.reconcileNode(el);
      }
    }
    // Only draw layers that changed; callers can manage finer-grained invalidation
    this.layers.main.batchDraw();
    this.layers.preview.batchDraw();
    this.layers.overlay.batchDraw();
  }

  /**
   * Update canvas DPR and force crisp redraw on all layers.
   */
  setDpr(dpr: number) {
    this.dpr = dpr;
    setLayersPixelRatio(this.layers, dpr);
    this.onBackgroundDraw?.(this.layers.background, this.stage);
  }

  /**
   * Resize stage and layers; optionally re-apply DPR and background render.
   */
  resize(width: number, height: number) {
    resizeRenderer(this.stage, this.layers, width, height, this.dpr);
    this.onBackgroundDraw?.(this.layers.background, this.stage);
  }

  /**
   * Update selection; attaches transformer to the resolved Konva nodes.
   */
  setSelection(ids: string[]) {
    const nodes = this.resolveSelectionNodes?.(ids) ?? [];
    if (nodes.length === 0) {
      this.transformer.detach();
    } else {
      this.transformer.attach(nodes);
    }
  }

  /**
   * Access layers for advanced callers (e.g., direct previews).
   */
  getLayers(): RendererLayers {
    return this.layers;
  }

  /**
   * Access Konva.Transformer for special cases (e.g., custom anchor logic).
   */
  getTransformer(): Konva.Transformer {
    return this.transformer.getNode();
  }

  /**
   * Destroy all resources. If layers were injected, this won't destroy them by default.
   */
  destroy({
    destroyInjectedLayers = false,
  }: { destroyInjectedLayers?: boolean } = {}) {
    this.transformer.destroy();
    if (destroyInjectedLayers) {
      destroyLayers(this.layers);
    }
  }
}
