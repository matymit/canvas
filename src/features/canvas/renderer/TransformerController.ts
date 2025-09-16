import Konva from 'konva';

export interface TransformerControllerOptions {
  stage: Konva.Stage;
  layer: Konva.Layer;
  enabledAnchors?: string[];
  rotateEnabled?: boolean;
  keepRatio?: boolean;      // maintain aspect ratio during resize
  anchorSize?: number;
  borderStroke?: string;
  borderStrokeWidth?: number;
  anchorStroke?: string;
  anchorFill?: string;
  anchorCornerRadius?: number;
  minSize?: number;         // minimal width/height in px for resizing
  // Optional bounding box customizer
  boundBoxFunc?: (
    oldBox: Konva.NodeConfig,
    newBox: Konva.NodeConfig
  ) => Konva.NodeConfig;

  // Lifecycle callbacks
  onTransformStart?: (nodes: Konva.Node[]) => void;
  onTransform?: (nodes: Konva.Node[]) => void;
  onTransformEnd?: (nodes: Konva.Node[]) => void;
}

/**
 * Manages a single Konva.Transformer instance on the overlay layer.
 * - Attaches/detaches to selected nodes
 * - Enforces min-size & optional keepRatio
 * - Emits transform lifecycle events
 */
export class TransformerController {
  // private readonly _stage: Konva.Stage; // Removed unused
  private readonly layer: Konva.Layer;
  private readonly tr: Konva.Transformer;
  private minSize: number;
  private keepRatio: boolean;

  constructor(options: TransformerControllerOptions) {
    const {
      // stage, // Removed unused parameter
      layer,
      enabledAnchors = [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'middle-left',
        'middle-right',
        'top-center',
        'bottom-center',
      ],
      rotateEnabled = true,
      keepRatio = false,
      anchorSize = 8,
      borderStroke = '#4F46E5',
      borderStrokeWidth = 1,
      anchorStroke = '#FFFFFF',
      anchorFill = '#4F46E5',
      anchorCornerRadius = 2,
      minSize = 6,
      boundBoxFunc,
      onTransformStart,
      onTransform,
      onTransformEnd,
    } = options;

    // this._stage = stage; // Removed unused
    this.layer = layer;
    this.keepRatio = keepRatio;
    this.minSize = Math.max(1, minSize);

    this.tr = new Konva.Transformer({
      rotateEnabled,
      enabledAnchors,
      keepRatio: this.keepRatio,
      anchorSize,
      borderStroke,
      borderStrokeWidth,
      anchorStroke,
      anchorFill,
      anchorCornerRadius,
      // Bound box to enforce min size and allow custom constraints
      boundBoxFunc: (oldBox, newBox) => {
        const withMin = this.applyMinSize(oldBox, newBox);
        if (boundBoxFunc) {
          const result = boundBoxFunc(oldBox, withMin);
          return {
            x: result.x ?? 0,
            y: result.y ?? 0,
            width: result.width ?? 0,
            height: result.height ?? 0,
            rotation: result.rotation ?? 0,
          };
        }
        return {
          x: withMin.x ?? 0,
          y: withMin.y ?? 0,
          width: withMin.width ?? 0,
          height: withMin.height ?? 0,
          rotation: withMin.rotation ?? 0,
        };
      },
      // Prefer high-resolution hit canvas for precise anchor interactions
      ignoreStroke: false,
    });

    // Start hidden
    this.tr.visible(false);
    layer.add(this.tr);

    // Emit transform lifecycle
    this.tr.on('transformstart', () => {
      onTransformStart?.(this.tr.nodes());
    });
    this.tr.on('transform', () => {
      onTransform?.(this.tr.nodes());
      // Keep overlay up-to-date during interactive transform
      this.layer.batchDraw();
    });
    this.tr.on('transformend', () => {
      onTransformEnd?.(this.tr.nodes());
      // Make sure to flush after end
      this.layer.batchDraw();
    });

    this.layer.draw();
  }

  /**
   * Enforce minimal width/height in the transform bounding box.
   */
  private applyMinSize(
    _oldBox: Konva.NodeConfig,
    newBox: Konva.NodeConfig
  ): Konva.NodeConfig {
    const w = Math.max(this.minSize, newBox.width ?? 0);
    const h = Math.max(this.minSize, newBox.height ?? 0);
    return { ...newBox, width: w, height: h };
  }

  /**
   * Attach to a set of nodes, making transformer visible. If empty, detaches and hides.
   */
  attach(nodes: Konva.Node[]) {
    if (!nodes || nodes.length === 0) {
      this.detach();
      return;
    }
    this.tr.nodes(nodes);
    this.tr.visible(true);
    this.forceUpdate();
  }

  /**
   * Detach from all nodes and hide transformer.
   */
  detach() {
    this.tr.nodes([]);
    this.tr.visible(false);
    this.forceUpdate();
  }

  /**
   * Update visual settings and anchor configuration at runtime.
   */
  updateStyle(options: Partial<TransformerControllerOptions>) {
    if (typeof options.keepRatio === 'boolean') {
      this.keepRatio = options.keepRatio;
      this.tr.keepRatio(this.keepRatio);
    }
    if (typeof options.minSize === 'number') {
      this.minSize = Math.max(1, options.minSize);
    }
    if (Array.isArray(options.enabledAnchors)) {
      this.tr.enabledAnchors(options.enabledAnchors);
    }
    if (typeof options.rotateEnabled === 'boolean') {
      this.tr.rotateEnabled(options.rotateEnabled);
    }
    // border, anchor visuals
    if (typeof options.borderStroke === 'string') {
      this.tr.borderStroke(options.borderStroke);
    }
    if (typeof options.borderStrokeWidth === 'number') {
      this.tr.borderStrokeWidth(options.borderStrokeWidth);
    }
    if (typeof options.anchorSize === 'number') {
      this.tr.anchorSize(options.anchorSize);
    }
    if (typeof options.anchorStroke === 'string') {
      this.tr.anchorStroke(options.anchorStroke);
    }
    if (typeof options.anchorFill === 'string') {
      this.tr.anchorFill(options.anchorFill);
    }
    if (typeof options.anchorCornerRadius === 'number') {
      this.tr.anchorCornerRadius(options.anchorCornerRadius);
    }
    this.forceUpdate();
  }

  /**
   * Force transformer and overlay to redraw.
   */
  forceUpdate() {
    this.tr.getLayer()?.batchDraw();
  }

  /**
   * Destroy transformer node.
   */
  destroy() {
    this.tr.destroy();
    this.layer.batchDraw();
  }

  /**
   * Access the underlying Konva.Transformer instance.
   */
  getNode(): Konva.Transformer {
    return this.tr;
  }
}