import Konva from "konva";

export interface TransformerCallbacks {
  onTransformStart?: (nodes: Konva.Node[]) => void;
  onTransform?: (nodes: Konva.Node[]) => void;
  onTransformEnd?: (nodes: Konva.Node[]) => void;
}

export interface TransformerManagerOptions extends TransformerCallbacks {
  overlayLayer: Konva.Layer;
  enabledAnchors?: Array<
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
  >;
  rotateEnabled?: boolean;
  rotationSnapDeg?: number | null; // set to e.g. 15 for snapping on end
  padding?: number;
  anchorSize?: number;
  borderStroke?: string;
  borderStrokeWidth?: number;
  anchorStroke?: string;
  anchorFill?: string;
  ignoreStroke?: boolean; // ignore element stroke width for bounds
  keepRatioKey?: "Shift" | "Alt" | "Control" | null; // hold to keep ratio
  lockAspectRatio?: boolean; // always lock aspect ratio
}

export class TransformerManager {
  private readonly overlay: Konva.Layer;
  private readonly opts: Required<
    Omit<TransformerManagerOptions, keyof TransformerCallbacks>
  > &
    TransformerCallbacks;
  private transformer: Konva.Transformer | null = null;
  private stage: Konva.Stage | null = null;
  private keyboardCleanup: (() => void) | null = null;

  constructor(stage: Konva.Stage, options: TransformerManagerOptions) {
    this.stage = stage;
    this.overlay = options.overlayLayer;
    this.opts = {
      enabledAnchors: [
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      rotateEnabled: true,
      rotationSnapDeg: null,
      padding: 8,
      anchorSize: 8,
      borderStroke: "#4F46E5",
      borderStrokeWidth: 1,
      anchorStroke: "#4F46E5",
      anchorFill: "#E5E7EB",
      ignoreStroke: true,
      keepRatioKey: "Shift",
      lockAspectRatio: false, // Default: free resize
      onTransformStart: options.onTransformStart,
      onTransform: options.onTransform,
      onTransformEnd: options.onTransformEnd,
      ...options, // Override defaults with provided options
    };

    this.ensureTransformer();
  }

  private ensureTransformer() {
    if (this.transformer) return;

    this.transformer = new Konva.Transformer({
      name: "selection-transformer",
      padding: this.opts.padding,
      rotateEnabled: this.opts.rotateEnabled,
      enabledAnchors: this.opts.enabledAnchors,
      anchorSize: this.opts.anchorSize,
      borderStroke: this.opts.borderStroke,
      borderStrokeWidth: this.opts.borderStrokeWidth,
      anchorStroke: this.opts.anchorStroke,
      anchorFill: this.opts.anchorFill,
      ignoreStroke: this.opts.ignoreStroke,
      listening: true,
      // FIXED: Set default aspect ratio behavior
      keepRatio: this.opts.lockAspectRatio || false,
    });

    this.overlay.add(this.transformer!);
    this.overlay.batchDraw();

    // Wire events to callbacks and snapping behavior
    this.transformer!.on("transformstart", () => {
      const nodes = this.transformer!.nodes();

      this.opts.onTransformStart?.(nodes);
    });

    // Keep ratio when modifier is pressed (applied per move)
    const onTransform = () => {
      const tr = this.transformer!;
      if (!tr) return;
      const nodes = tr.nodes();
      this.opts.onTransform?.(nodes);
      this.overlay.batchDraw();
    };

    this.transformer!.on("transform", onTransform);

    this.transformer!.on("transformend", () => {
      const tr = this.transformer!;
      if (!tr) return;

      // Rotation snapping on transform end (optional)
      if (this.opts.rotationSnapDeg && this.opts.rotateEnabled !== false) {
        const step = this.opts.rotationSnapDeg;
        tr.nodes().forEach((n) => {
          const rot = n.rotation();
          const snapped = Math.round(rot / step) * step;
          n.rotation(snapped);
        });
      }

      const nodes = tr.nodes();

      this.opts.onTransformEnd?.(nodes);

      // FIXED: Clean overlay draw to prevent duplicate frames
      setTimeout(() => {
        this.overlay.batchDraw();
      }, 10);
    });

    // FIXED: Enhanced keyboard listener for aspect ratio control
    if (this.stage && this.opts.keepRatioKey) {
      const down = (e: KeyboardEvent) => {
        if (e.key === this.opts.keepRatioKey && this.transformer) {
          this.transformer.keepRatio(true);
        }
      };
      const up = (e: KeyboardEvent) => {
        if (e.key === this.opts.keepRatioKey && this.transformer) {
          this.transformer.keepRatio(this.opts.lockAspectRatio || false);
        }
      };

      // Attach listeners to document for global capture
      document.addEventListener("keydown", down, true);
      document.addEventListener("keyup", up, true);

      // Store cleanup function
      this.keyboardCleanup = () => {
        document.removeEventListener("keydown", down, true);
        document.removeEventListener("keyup", up, true);
      };
    }
  }

  attachToNodes(nodes: Konva.Node[]) {
    this.ensureTransformer();
    if (!this.transformer) return;

    // Filter nodes that are still in stage
    const live = nodes.filter((n) => {
      try {
        return n.getStage() !== null;
      } catch {
        return false;
      }
    });

    // FIXED: Clear any existing nodes first to prevent frame duplication
    this.transformer.nodes([]);
    this.overlay.batchDraw();

    // Attach directly without delay to prevent timing issues
    if (this.transformer && live.length > 0) {
      this.transformer.nodes(live);
      this.transformer.visible(true);
      this.overlay.batchDraw();

      // Debug: Check if transformer actually has nodes after attachment
      setTimeout(() => {
        if (this.transformer) {
          const attachedNodes = this.transformer.nodes();

          if (attachedNodes.length === 0) {
          }
        }
      }, 50);
    } else {
    }
  }

  attachToNodeIds(ids: string[]) {
    if (!this.stage) return;
    const nodes: Konva.Node[] = [];
    for (const id of ids) {
      const found = this.stage.findOne(`#${id}`);
      if (found) nodes.push(found);
    }
    this.attachToNodes(nodes);
  }

  detach() {
    if (!this.transformer) return;

    this.transformer.nodes([]);
    this.transformer.visible(false);
    this.overlay.batchDraw();
  }

  hasNodes() {
    return !!this.transformer && this.transformer.nodes().length > 0;
  }

  refresh() {
    if (!this.transformer) return;

    this.transformer.forceUpdate();
    this.overlay.batchDraw();
  }

  show() {
    if (!this.transformer) return;
    this.transformer.visible(true);
    this.overlay.batchDraw();
  }

  hide() {
    if (!this.transformer) return;
    this.transformer.visible(false);
    this.overlay.batchDraw();
  }

  // FIXED: Set aspect ratio locking dynamically
  setKeepRatio(keepRatio: boolean) {
    if (!this.transformer) return;
    this.transformer.keepRatio(keepRatio);
  }

  destroy() {
    if (!this.transformer) return;

    // Clean up keyboard listeners
    if (this.keyboardCleanup) {
      this.keyboardCleanup();
      this.keyboardCleanup = null;
    }

    this.transformer.destroy();
    this.transformer = null;
    this.overlay.batchDraw();
  }
}

export default TransformerManager;
