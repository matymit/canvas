import Konva from 'konva';

export type BaseLayerId = 'background' | 'main' | 'preview' | 'overlay';
export type CanvasLayerId = BaseLayerId | string;

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
  highlights?: Konva.Layer; // created on-demand for highlighter z-policy
}

export interface CanvasLayerManagerOptions {
  backgroundListening?: boolean; // default false
  mainListening?: boolean;       // default true
  previewListening?: boolean;    // default true
  overlayListening?: boolean;    // default true
  initialDevicePixelRatio?: number; // optional DPR force
  warnOnTooManyLayers?: boolean; // default true
}

type RequiredOpts = Required<Omit<CanvasLayerManagerOptions, 'initialDevicePixelRatio'>> & {
  initialDevicePixelRatio?: number;
};

type GridRenderer = (background: Konva.Layer, stage: Konva.Stage) => void;

type NodeOriginalParent = {
  parent: Konva.Container | null;
  index: number;
};

export class CanvasLayerManager {
  private readonly stage: Konva.Stage;
  private readonly layers = new Map<CanvasLayerId, Konva.Layer>();
  private order: CanvasLayerId[] = [];
  private readonly options: RequiredOpts;

  // Grid hook
  private gridEnabled = false;
  private gridRenderer?: GridRenderer;

  // Tracking temporary moves
  private readonly tempParent = new WeakMap<Konva.Node, NodeOriginalParent>();

  constructor(stage: Konva.Stage, opts?: CanvasLayerManagerOptions) {
    this.stage = stage;
    this.options = {
      backgroundListening: opts?.backgroundListening ?? false,
      mainListening: opts?.mainListening ?? true,
      previewListening: opts?.previewListening ?? true,
      overlayListening: opts?.overlayListening ?? true,
      initialDevicePixelRatio: opts?.initialDevicePixelRatio ?? undefined,
      warnOnTooManyLayers: opts?.warnOnTooManyLayers ?? true,
    };

    // Create and add base layers in canonical order
    this.createLayer('background', this.options.backgroundListening);
    this.createLayer('main', this.options.mainListening);
    this.createLayer('preview', this.options.previewListening);
    this.createLayer('overlay', this.options.overlayListening);

    this.addToStageInOrder('background', 'main', 'preview', 'overlay');

    // Optional DPR
    if (this.options.initialDevicePixelRatio && this.options.initialDevicePixelRatio > 0) {
      this.applyPixelRatio(this.options.initialDevicePixelRatio);
    }

    this.maybeWarnLayerCount();
  }

  // Accessors
  get<K extends BaseLayerId>(kind: K): Konva.Layer {
    return this.requireLayer(kind);
  }

  all(): RendererLayers {
    const layers: RendererLayers = {
      background: this.get('background'),
      main: this.get('main'),
      preview: this.get('preview'),
      overlay: this.get('overlay'),
    };
    if (this.layers.has('highlights')) {
      layers.highlights = this.requireLayer('highlights');
    }
    return layers;
  }

  ids(): CanvasLayerId[] {
    return [...this.order];
  }

  exists(id: CanvasLayerId): boolean {
    return this.layers.has(id);
  }

  // Visibility and input
  show(id: CanvasLayerId): void {
    const ly = this.requireLayer(id);
    ly.visible(true);
    ly.batchDraw();
  }

  hide(id: CanvasLayerId): void {
    const ly = this.requireLayer(id);
    ly.visible(false);
    ly.batchDraw();
  }

  lock(id: CanvasLayerId): void {
    const ly = this.requireLayer(id);
    ly.listening(false);
  }

  unlock(id: CanvasLayerId): void {
    const ly = this.requireLayer(id);
    ly.listening(true);
  }

  setListening(id: CanvasLayerId, listening: boolean): void {
    const ly = this.requireLayer(id);
    ly.listening(listening);
  }

  // Z-order
  setZOrder(nextOrder: CanvasLayerId[]): void {
    const unique = nextOrder.filter((id, idx, arr) => this.layers.has(id) && arr.indexOf(id) === idx);
    this.order = unique;
    unique.forEach((id, index) => {
      const ly = this.requireLayer(id);
      ly.zIndex(index);
    });
    this.stage.batchDraw();
  }

  moveLayerToIndex(id: CanvasLayerId, index: number): void {
    if (!this.layers.has(id)) return;
    const bounded = Math.max(0, Math.min(index, this.order.length - 1));
    const without = this.order.filter((x) => x !== id);
    without.splice(bounded, 0, id);
    this.setZOrder(without);
  }

  // Custom layers
  addCustomLayer(
    id: string,
    config?: { listening?: boolean; beforeId?: CanvasLayerId; afterId?: CanvasLayerId }
  ): Konva.Layer {
    if (this.layers.has(id)) throw new Error(`Layer id already exists: ${id}`);
    const ly = this.createLayer(id, config?.listening ?? true);

    // Default insertion: above preview, below overlay
    let insertIndex = this.order.indexOf('overlay');
    insertIndex = Math.max(0, insertIndex);
    if (config?.beforeId && this.layers.has(config.beforeId)) {
      insertIndex = Math.max(0, this.order.indexOf(config.beforeId));
    } else if (config?.afterId && this.layers.has(config.afterId)) {
      insertIndex = this.order.indexOf(config.afterId) + 1;
    }

    this.stage.add(ly);
    this.order.splice(insertIndex, 0, id);
    this.reapplyIndices();
    this.maybeWarnLayerCount();
    return ly;
  }

  removeLayer(id: CanvasLayerId): void {
    if (id === 'background' || id === 'main' || id === 'preview' || id === 'overlay') {
      throw new Error(`Cannot remove base layer id: ${id}`);
    }
    const ly = this.layers.get(id);
    if (!ly) return;
    ly.destroy();
    this.layers.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.reapplyIndices();
    this.stage.batchDraw();
  }

  // HiDPI
  applyPixelRatio(dpr: number): void {
    for (const id of this.order) {
      const ly = this.requireLayer(id);
      try {
        const canvas = ly.getCanvas() as unknown as HTMLCanvasElement & { setPixelRatio?: (dpr: number) => void };
        canvas?.setPixelRatio?.(dpr);
      } catch {
        // ignore
      }
      ly.batchDraw();
    }
  }

  batchDraw(): void {
    for (const id of this.order) {
      this.requireLayer(id).batchDraw();
    }
  }

  // Temporary node moves
  moveNodeToLayer(node: Konva.Node, targetLayerId: CanvasLayerId): void {
    const target = this.requireLayer(targetLayerId);
    node.moveTo(target);
    target.batchDraw();
  }

  beginTempMove(node: Konva.Node, targetLayerId: CanvasLayerId): void {
    if (!this.tempParent.has(node)) {
      const parent = node.getParent();
      const index = parent ? parent.getChildren().indexOf(node) : -1;
      this.tempParent.set(node, { parent, index });
    }
    this.moveNodeToLayer(node, targetLayerId);
  }

  restoreNode(node: Konva.Node): void {
    const info = this.tempParent.get(node);
    if (!info) return;
    if (info.parent && info.index >= 0) {
      node.moveTo(info.parent);
      node.zIndex(info.index);
      info.parent.getLayer()?.batchDraw();
    }
    this.tempParent.delete(node);
  }

  async withTemporaryLayer<T>(
    node: Konva.Node,
    targetLayerId: CanvasLayerId,
    op: () => Promise<T> | T
  ): Promise<T> {
    this.beginTempMove(node, targetLayerId);
    try {
      return await op();
    } finally {
      this.restoreNode(node);
    }
  }

  // Highlighter z-policy
  // Place "highlighter" strokes on a dedicated layer above main and below overlay
  // so multiply compositing looks correct over content but under overlay UI.
  getOrCreateHighlightsLayer(): Konva.Layer {
    if (this.layers.has('highlights')) {
      return this.requireLayer('highlights');
    }
    // Insert below overlay
    const ly = this.addCustomLayer('highlights', {
      listening: true,
      beforeId: 'overlay',
    });
    return ly;
  }

  placeHighlighter(node: Konva.Node): void {
    const highlights = this.getOrCreateHighlightsLayer();
    node.moveTo(highlights);
    highlights.batchDraw();
  }

  // Grid hook-in
  setGridRenderer(renderer: GridRenderer | undefined): void {
    this.gridRenderer = renderer;
    this.redrawGrid();
  }

  setGridEnabled(enabled: boolean): void {
    this.gridEnabled = enabled;
    this.redrawGrid();
  }

  redrawGrid(): void {
    const background = this.get('background');
    background.destroyChildren();
    if (this.gridEnabled && this.gridRenderer) {
      this.gridRenderer(background, this.stage);
    }
    background.batchDraw();
  }

  // Destroy
  destroy(): void {
    for (const id of [...this.order]) {
      const ly = this.layers.get(id);
      if (!ly) continue;
      ly.destroy();
      this.layers.delete(id);
    }
    this.order = [];
  }

  // Internals
  private createLayer(id: CanvasLayerId, listening: boolean): Konva.Layer {
    const layer = new Konva.Layer({ listening, name: String(id), id: String(id) });
    this.layers.set(id, layer);
    return layer;
  }

  private addToStageInOrder(...ids: CanvasLayerId[]): void {
    ids.forEach((id) => {
      const ly = this.requireLayer(id);
      this.stage.add(ly);
      this.order.push(id);
    });
    this.reapplyIndices();
  }

  private reapplyIndices(): void {
    this.order.forEach((id, index) => {
      this.requireLayer(id).zIndex(index);
    });
  }

  private requireLayer(id: CanvasLayerId): Konva.Layer {
    const ly = this.layers.get(id);
    if (!ly) throw new Error(`Managed layer not found: ${id}`);
    return ly;
    }

  private maybeWarnLayerCount(): void {
    if (!this.options.warnOnTooManyLayers) return;
    const count = this.order.length;
    if (count > 5) {
      // Warning: CanvasLayerManager: the stage has ${count} layers. Recommended maximum is ~3-5 for performance.
    }
  }
}

// Convenience factory
export function createCanvasLayerManager(stage: Konva.Stage, opts?: CanvasLayerManagerOptions) {
  return new CanvasLayerManager(stage, opts);
}

export default CanvasLayerManager;
