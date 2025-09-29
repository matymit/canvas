import type Konva from "konva";
import type { TransformerManager } from "../../../../managers/TransformerManager";

type TransformSource = "drag" | "transform";

interface TransformLifecycleEvents {
  onBegin: (nodes: Konva.Node[], source: TransformSource) => void;
  onProgress: (nodes: Konva.Node[], source: TransformSource) => void;
  onEnd: (nodes: Konva.Node[], source: TransformSource) => void;
}

export class TransformLifecycleCoordinator {
  private readonly dragMonitoredNodes = new Set<Konva.Node>();
  private dragSessionActive = false;

  constructor(
    private readonly transformerManager: TransformerManager,
    private readonly events: TransformLifecycleEvents,
    private readonly debug?: (message: string, data?: unknown) => void,
  ) {}

  attach(nodes: Konva.Node[]) {
    this.detachDragHandlers();
    this.transformerManager.detach();

    if (nodes.length === 0) {
      return;
    }

    this.transformerManager.attachToNodes(nodes);
    this.attachDragHandlers(nodes);
  }

  detach() {
    this.detachDragHandlers();
    this.transformerManager.detach();
  }

  getTransformer(): Konva.Transformer | null {
    return this.transformerManager.getTransformer();
  }

  getTransformerRect(): ReturnType<Konva.Transformer["getClientRect"]> | null {
    const transformer = this.getTransformer();
    return transformer ? transformer.getClientRect() : null;
  }

  refresh() {
    this.transformerManager.refresh();
  }

  setKeepRatio(keep: boolean) {
    this.transformerManager.setKeepRatio(keep);
  }

  show() {
    this.transformerManager.show();
  }

  ensureVisible() {
    const transformer = this.transformerManager.getTransformer();
    if (transformer && !transformer.visible()) {
      transformer.visible(true);
      transformer.getLayer()?.batchDraw();
    }
  }

  handleTransformStart = (nodes: Konva.Node[]) => {
    this.events.onBegin(nodes, "transform");
  };

  handleTransformProgress = (nodes: Konva.Node[]) => {
    this.events.onProgress(nodes, "transform");
  };

  handleTransformEnd = (nodes: Konva.Node[]) => {
    this.events.onEnd(nodes, "transform");
  };

  private attachDragHandlers(nodes: Konva.Node[]) {
    nodes.forEach((node) => {
      try {
        node.on("dragstart.selection-transform", this.handleDragStart);
        node.on("dragmove.selection-transform", this.handleDragMove);
        node.on("dragend.selection-transform", this.handleDragEnd);
        node.on("dragcancel.selection-transform", this.handleDragEnd);
        this.dragMonitoredNodes.add(node);
      } catch (error) {
        this.debug?.("attachDragHandlers failed", { error });
      }
    });
  }

  private detachDragHandlers() {
    this.dragMonitoredNodes.forEach((node) => {
      try {
        node.off(".selection-transform");
      } catch (error) {
        this.debug?.("detachDragHandlers failed", { error });
      }
    });
    this.dragMonitoredNodes.clear();
    this.dragSessionActive = false;
  }

  private readonly handleDragStart = () => {
    const nodes = this.transformerManager.getTransformer()?.nodes() ?? [];
    if (nodes.length === 0) {
      return;
    }

    if (!this.dragSessionActive) {
      this.dragSessionActive = true;
      this.events.onBegin(nodes, "drag");
    }
  };

  private readonly handleDragMove = () => {
    if (!this.dragSessionActive) {
      return;
    }
    const nodes = this.transformerManager.getTransformer()?.nodes() ?? [];
    if (nodes.length === 0) {
      return;
    }
    this.events.onProgress(nodes, "drag");
  };

  private readonly handleDragEnd = () => {
    if (!this.dragSessionActive) {
      return;
    }
    this.dragSessionActive = false;
    const nodes = this.transformerManager.getTransformer()?.nodes() ?? [];
    this.events.onEnd(nodes, "drag");
  };
}
