import Konva from "konva";
import { createAspectRatioConstraint, getElementAspectConfig } from "../utils/AspectRatioConstraint";

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
  rotationSnapDeg?: number | null;
  padding?: number;
  anchorSize?: number;
  borderStroke?: string;
  borderStrokeWidth?: number;
  anchorStroke?: string;
  anchorFill?: string;
  ignoreStroke?: boolean;
  keepRatioKey?: "Shift" | "Alt" | "Control" | null;
  lockAspectRatio?: boolean;
}

export class TransformerManager {
  private readonly overlay: Konva.Layer;
  private readonly opts: Required<
    Omit<TransformerManagerOptions, keyof TransformerCallbacks>
  > &
    TransformerCallbacks;
  private transformer: Konva.Transformer | null = null;
  private readonly stage: Konva.Stage | null = null;
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
      lockAspectRatio: false,
      onTransformStart: options.onTransformStart,
      onTransform: options.onTransform,
      onTransformEnd: options.onTransformEnd,
      ...options,
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
      draggable: false,
      keepRatio: this.opts.lockAspectRatio || false,
    });

    if (this.transformer) {
      this.overlay.add(this.transformer);
      this.overlay.batchDraw();

      this.transformer.on("transformstart", () => {
        const nodes = this.transformer?.nodes();
        if (!nodes) return;
        this.opts.onTransformStart?.(nodes);
      });

      const onTransform = () => {
        const tr = this.transformer;
        if (!tr) return;
        const nodes = tr.nodes();

        nodes.forEach(node => {
          const scale = node.scale();
          if (scale) {
            const MIN_SCALE = 0.01;
            if (Math.abs(scale.x) < MIN_SCALE) {
              node.scaleX(scale.x < 0 ? -MIN_SCALE : MIN_SCALE);
            }
            if (Math.abs(scale.y) < MIN_SCALE) {
              node.scaleY(scale.y < 0 ? -MIN_SCALE : MIN_SCALE);
            }
          }
        });

        this.opts.onTransform?.(nodes);
        
        // Force transformer to update its bounds to match the transformed nodes
        tr.forceUpdate();
        
        this.overlay.batchDraw();
      };

      if (this.transformer) {
        this.transformer.on("transform", onTransform);
      }

      if (this.transformer) {
        this.transformer.on("transformend", () => {
          const tr = this.transformer;
          if (!tr) return;

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

          setTimeout(() => {
            this.overlay.batchDraw();
          }, 10);
        });
      }

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

        document.addEventListener("keydown", down, true);
        document.addEventListener("keyup", up, true);

        this.keyboardCleanup = () => {
          document.removeEventListener("keydown", down, true);
          document.removeEventListener("keyup", up, true);
        };
      }
    }
  }

  attachToNodes(nodes: Konva.Node[]) {
    this.ensureTransformer();
    if (!this.transformer) return;

    const live = nodes.filter((n) => {
      try {
        return n.getStage() !== null;
      } catch {
        return false;
      }
    });

    this.transformer.nodes([]);
    this.overlay.batchDraw();

    if (this.transformer && live.length > 0) {
      live.forEach((node) => {
        if (!Object.prototype.hasOwnProperty.call(node, '_originalDraggable')) {
          node.setAttr('_originalDraggable', node.draggable());
        }
        node.draggable(true);
      });

      try {
        this.transformer.nodes(live);
        this.transformer.visible(true);
        this.transformer.update();
      } catch {
        // Ignore transformer update failures so selection can proceed
      }

      try {
        this.applyElementConstraints(live);
      } catch {
        // Ignore constraint application failures; transformer will keep prior anchors
      }

      this.overlay.batchDraw();
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

    const nodes = this.transformer.nodes();
    nodes.forEach(node => {
      const originalDraggable = node.getAttr('_originalDraggable');
      if (originalDraggable !== undefined) {
        node.draggable(originalDraggable);
        node.setAttr('_originalDraggable', undefined);
      }
    });

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

  getTransformer(): Konva.Transformer | null {
    this.ensureTransformer();
    return this.transformer;
  }

  /**
   * CRITICAL FIX: Properly apply aspect ratio constraints for sticky notes
   * Fixed element type detection and constraint application
   */
  private applyElementConstraints(nodes: Konva.Node[]) {
    if (!this.transformer) return;

    const primaryNode = nodes[0];
    const elementType = this.getElementType(primaryNode);
    const isTextElement = elementType === 'text';
    const keepAspectAttr = primaryNode.getAttr('keepAspectRatio');
    const forceAspectRatio = keepAspectAttr === true;

    // Hard guard: NEVER show a transformer for connectors
    if (elementType === 'connector') {
      this.transformer.nodes([]);
      this.transformer.visible(false);
      this.overlay.batchDraw();
      return;
    }

    const elementResizable = primaryNode.getAttr('resizable');
    const isResizeDisabled = elementResizable === false || isTextElement;

    if (isResizeDisabled) {
      this.transformer.enabledAnchors([]);
      this.transformer.rotateEnabled(true);
      this.transformer.boundBoxFunc(undefined);
      this.transformer.keepRatio(false);
      return;
    }

    // CRITICAL FIX: Check for sticky notes with multiple detection methods
    const isStickyNote = this.isStickyNoteElement(primaryNode);
    
    if (isStickyNote) {
      // CRITICAL FIX: Set corner-only anchors for sticky notes
      this.transformer.enabledAnchors([
        "top-left", 
        "top-right", 
        "bottom-left", 
        "bottom-right"
      ]);

      // Get aspect configuration for sticky notes (locked by default)
      const aspectConfig = getElementAspectConfig('sticky-note', true);
      
      // Get original dimensions for constraint reference
      const originalDimensions = {
        width: primaryNode.width() * (primaryNode.scaleX() || 1),
        height: primaryNode.height() * (primaryNode.scaleY() || 1)
      };

      // Create and apply constraint function
      const constraintFunc = createAspectRatioConstraint(aspectConfig, originalDimensions);
      this.transformer.boundBoxFunc(constraintFunc);
      
      // CRITICAL: Force aspect ratio to be locked by default for sticky notes
      this.transformer.keepRatio(true);
    } else if (elementType === 'image' || forceAspectRatio) {
      // Enable corner-only anchors for images to maintain aspect ratio
      this.transformer.enabledAnchors([
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right"
      ]);

      // Get aspect configuration for images
      const aspectConfig = getElementAspectConfig('image', true);

      let nodeForSize = primaryNode;
      if (elementType === 'image' && primaryNode instanceof Konva.Group) {
        const imageNode = primaryNode.findOne('Image');
        if (imageNode) {
          nodeForSize = imageNode;
        }
      }
      // Get original dimensions for constraint reference
      const originalDimensions = {
        width: nodeForSize.width() * (nodeForSize.scaleX() || 1),
        height: nodeForSize.height() * (nodeForSize.scaleY() || 1)
      };

      // Create and apply constraint function
      const constraintFunc = createAspectRatioConstraint(aspectConfig, originalDimensions);
      this.transformer.boundBoxFunc(constraintFunc);

      // Force aspect ratio to be locked for images
      this.transformer.keepRatio(true);
    } else {
      // CRITICAL FIX: Enable all anchors for non-sticky elements
      this.transformer.enabledAnchors(this.opts.enabledAnchors || [
        "top-left", "top-center", "top-right",
        "middle-left", "middle-right",
        "bottom-left", "bottom-center", "bottom-right"
      ]);

      // Clear constraints for other element types
      this.transformer.boundBoxFunc(undefined);
      this.transformer.keepRatio(this.opts.lockAspectRatio || false);
    }
  }

  /**
   * CRITICAL FIX: Enhanced sticky note detection with multiple fallback methods
   */
  private isStickyNoteElement(node: Konva.Node): boolean {
    // Method 1: Check nodeType attribute (most reliable)
    const nodeType = node.getAttr('nodeType');
    if (nodeType === 'sticky-note' || nodeType === 'stickyNote') {
      return true;
    }

    // Method 2: Check elementType attribute
    const elementType = node.getAttr('elementType');
    if (elementType === 'sticky-note' || elementType === 'stickyNote') {
      return true;
    }

    // Method 3: Check node name
    const name = node.name();
    if (name && (name.includes('sticky') || name.includes('note'))) {
      return true;
    }

    // Method 4: Check node ID
    const id = node.id();
    if (id && (id.includes('sticky') || id.includes('note'))) {
      return true;
    }

    // Method 5: Check parent group or related nodes (for complex sticky note structures)
    const parent = node.getParent();
    if (parent) {
      const parentName = parent.name();
      const parentId = parent.id();
      if ((parentName && (parentName.includes('sticky') || parentName.includes('note'))) ||
          (parentId && (parentId.includes('sticky') || parentId.includes('note')))) {
        return true;
      }
    }

    // Method 6: Check for sticky note specific attributes
    const stickyColor = node.getAttr('stickyColor');
    const stickySize = node.getAttr('stickySize');
    if (stickyColor || stickySize) {
      return true;
    }

    return false;
  }

  /**
   * CRITICAL FIX: Improved element type detection with better fallbacks
   */
  private getElementType(node: Konva.Node): string {
    // Primary method: check nodeType attribute
    const nodeType = node.getAttr('nodeType');
    if (nodeType) {
      return nodeType;
    }

    // Secondary method: check elementType attribute
    const elementType = node.getAttr('elementType');
    if (elementType) {
      return elementType;
    }

    // Tertiary method: analyze node name
    const name = node.name();
    if (name) {
      if (name.includes('text')) return 'text';
      if (name.includes('sticky') || name.includes('note')) return 'sticky-note';
      if (name.includes('shape') || name.includes('rect') || name.includes('circle') || name.includes('triangle')) return 'shape';
      if (name.includes('image')) return 'image';
      if (name.includes('table')) return 'table';
      if (name.includes('connector')) return 'connector';
    }

    // Fallback method: analyze node type
    const className = node.className;
    if (className === 'Text') return 'text';
    if (className === 'Rect') return 'shape';
    if (className === 'Circle') return 'shape';
    if (className === 'Image') return 'image';

    return 'element';
  }

  setKeepRatio(keepRatio: boolean) {
    if (!this.transformer) return;
    this.transformer.keepRatio(keepRatio);
  }

  destroy() {
    if (!this.transformer) return;

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
