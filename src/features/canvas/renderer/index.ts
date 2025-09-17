import Konva from 'konva';
import {
  RendererLayers,
  createRendererLayers,
  destroyLayers,
  ensureOverlayOnTop,
  resizeRenderer,
  setLayersPixelRatio,
} from './layers';
import { TransformerController, TransformerControllerOptions } from './TransformerController';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import { StickyNoteModule } from './modules/StickyNoteModule';
import { ConnectorRendererAdapter } from './modules/ConnectorRendererAdapter';
import { TableModuleAdapter } from './modules/TableModuleAdapter';
import { ImageRendererAdapter } from './modules/ImageRendererAdapter';
import { MindmapRendererAdapter } from './modules/MindmapRendererAdapter';
import { TextRenderer } from './modules/TextRenderer';
import { ShapeRenderer } from './modules/ShapeRenderer';
import { DrawingRenderer } from './modules/DrawingRenderer';

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
  layers: { background: Konva.Layer; main: Konva.Layer; highlighter: Konva.Layer; preview: Konva.Layer; overlay: Konva.Layer };
  store: typeof useUnifiedCanvasStore;
}

export interface RendererModule {
  mount(ctx: ModuleRendererCtx): () => void; // returns dispose
}

// Setup renderer modules
export function setupRenderer(stage: Konva.Stage, layers: ModuleRendererCtx['layers']) {
  const modules: RendererModule[] = [
    new StickyNoteModule(),
    new ConnectorRendererAdapter(),
    new TableModuleAdapter(),
    new ImageRendererAdapter(),
    new MindmapRendererAdapter(),
    new TextRenderer(),
    new ShapeRenderer(),
    new DrawingRenderer(),
  ];

  console.log('[Renderer] Mounting', modules.length, 'renderer modules');
  const unsubs = modules.map(m => m.mount({ stage, layers, store: useUnifiedCanvasStore }));

  return () => {
    console.log('[Renderer] Unmounting all renderer modules');
    unsubs.forEach(u => u && u());
  };
}

/**
 * Minimal orchestrator for stage + layers + transformer with a clean, DI-friendly API.
 * It doesn't own app state; instead, callers provide element accessors & node reconciliation.
 */
export class CanvasRenderer {
  private readonly stage: Konva.Stage;
  private layers: RendererLayers;
  private transformer: TransformerController;
  private dpr: number;

  private getVisibleElements?: () => CanvasElementLike[];
  private reconcileNode?: (e: CanvasElementLike) => Konva.Node;
  // private _disposeNode?: (n: Konva.Node) => void; // Removed unused
  private resolveSelectionNodes?: (ids: string[]) => Konva.Node[];
  private onBackgroundDraw?: (background: Konva.Layer, stage: Konva.Stage) => void;

  constructor(stage: Konva.Stage, options: CanvasRendererOptions = {}) {
    this.stage = stage;
    this.dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this.layers = options.layers ?? createRendererLayers(stage, { dpr: this.dpr });

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
      borderStroke: '#4F46E5',
      borderStrokeWidth: 1,
      anchorStroke: '#FFFFFF',
      anchorFill: '#4F46E5',
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
    this.layers.highlighter.batchDraw();
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
  destroy({ destroyInjectedLayers = false }: { destroyInjectedLayers?: boolean } = {}) {
    this.transformer.destroy();
    if (destroyInjectedLayers) {
      destroyLayers(this.layers);
    }
  }
}