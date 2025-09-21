// features/canvas/renderermodular/modules/DrawingModule.ts
import Konva from 'konva';
import { nanoid } from 'nanoid';

export type RendererLayers = {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
};

export interface DrawingElement {
  id: string;
  type: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  points: number[];
}

export interface StoreAdapter {
  addElement: (element: DrawingElement) => void;
}

export interface DrawingOptions {
  color: () => string;
  width: () => number;
  opacity?: () => number; // 0..1
  // If true, line will be translucent to mimic highlighter
  multiplyBlend?: boolean;
}

export default class DrawingModule {
  private layers: RendererLayers;
  private store: StoreAdapter;
  private opts: DrawingOptions;

  private isDrawing = false;
  private points: number[] = [];
  private line?: Konva.Line;

  constructor(layers: RendererLayers, store: StoreAdapter, opts: DrawingOptions) {
    this.layers = layers;
    this.store = store;
    this.opts = opts;
  }

  onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (this.isDrawing) return true;

    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!stage || !p) return false;

    this.isDrawing = true;
    this.points = [p.x, p.y];

    this.line = new Konva.Line({
      points: this.points,
      stroke: this.opts.color(),
      strokeWidth: this.opts.width(),
      opacity: this.opts.opacity?.() ?? 1,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false, // performance
      perfectDrawEnabled: false, // performance
      tension: 0,
      shadowForStrokeEnabled: false,
      globalCompositeOperation: this.opts.multiplyBlend ? 'multiply' : 'source-over',
    });

    this.layers.preview.add(this.line);
    this.layers.preview.draw();

    return true;
  };

  onPointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.isDrawing || !this.line) return false;

    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!stage || !p) return false;

    this.points.push(p.x, p.y);
    this.line.points(this.points);

    // Immediate feedback on preview layer
    this.layers.preview.batchDraw();
    return true;
  };

  onPointerUp = (_e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.isDrawing || !this.line) return false;

    // Commit to main layer
    const committed = this.line;
    this.line = undefined;
    this.isDrawing = false;

    committed.listening(true); // re-enable if needed for selection/eraser hit detection
    this.layers.preview.removeChildren(); // clear preview
    this.layers.preview.draw();

    this.layers.main.add(committed);
    this.layers.main.draw();

    // Persist into store as an element record
    const id = nanoid();
    this.store.addElement({
      id,
      type: 'freehand',
      stroke: committed.stroke() as string,
      strokeWidth: committed.strokeWidth(),
      opacity: committed.opacity(),
      points: committed.points(),
      // additional metadata if needed
    });

    return true;
  };

  // Optional fallbacks
  onMouseDown = this.onPointerDown;
  onMouseMove = this.onPointerMove;
  onMouseUp = this.onPointerUp;
}