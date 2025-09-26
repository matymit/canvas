// features/canvas/renderermodular/modules/ShapeModule.ts
import Konva from 'konva';
import { nanoid } from 'nanoid';

export type RendererLayers = {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
};

export interface StoreAdapter {
  addElement: (element: Record<string, unknown>) => void;
}

export type ShapeKind = 'rectangle' | 'circle';

export interface ShapeOptions {
  kind: ShapeKind;
  stroke: () => string;
  fill: () => string;
  strokeWidth: () => number;
  opacity?: () => number;
}

export default class ShapeModule {
  private readonly layers: RendererLayers;
  private readonly store: StoreAdapter;
  private readonly opts: ShapeOptions;

  private origin: { x: number; y: number } | null = null;
  private previewRect?: Konva.Rect;
  private previewCircle?: Konva.Circle;

  constructor(layers: RendererLayers, store: StoreAdapter, opts: ShapeOptions) {
    this.layers = layers;
    this.store = store;
    this.opts = opts;
  }

  onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!stage || !p) return false;
    this.origin = { x: p.x, y: p.y };

    if (this.opts.kind === 'rectangle') {
      this.previewRect = new Konva.Rect({
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        stroke: this.opts.stroke(),
        strokeWidth: this.opts.strokeWidth(),
        fill: this.opts.fill(),
        opacity: this.opts.opacity?.() ?? 1,
        listening: false,
        perfectDrawEnabled: false,
      });
      this.layers.preview.add(this.previewRect);
    } else {
      this.previewCircle = new Konva.Circle({
        x: p.x,
        y: p.y,
        radius: 0,
        stroke: this.opts.stroke(),
        strokeWidth: this.opts.strokeWidth(),
        fill: this.opts.fill(),
        opacity: this.opts.opacity?.() ?? 1,
        listening: false,
        perfectDrawEnabled: false,
      });
      this.layers.preview.add(this.previewCircle);
    }

    this.layers.preview.draw();
    return true;
  };

  onPointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!this.origin) return false;

    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!stage || !p) return false;

    const x = Math.min(this.origin.x, p.x);
    const y = Math.min(this.origin.y, p.y);
    const w = Math.abs(p.x - this.origin.x);
    const h = Math.abs(p.y - this.origin.y);

    if (this.opts.kind === 'rectangle' && this.previewRect) {
      this.previewRect.position({ x, y });
      this.previewRect.size({ width: w, height: h });
    } else if (this.opts.kind === 'circle' && this.previewCircle) {
      const r = Math.max(w, h) / 2;
      this.previewCircle.radius(r);
      this.previewCircle.position({ x: this.origin.x + (p.x < this.origin.x ? -r : r) - 0, y: this.origin.y + (p.y < this.origin.y ? -r : r) - 0 });
    }

    this.layers.preview.batchDraw();
    return true;
  };

  onPointerUp = () => {
    if (!this.origin) return false;

    // Commit
    if (this.previewRect) {
      const rect = this.previewRect;
      this.previewRect = undefined;
      this.layers.preview.removeChildren();
      this.layers.preview.draw();

      rect.listening(true);
      this.layers.main.add(rect);
      this.layers.main.draw();

      this.store.addElement({
        id: nanoid(),
        type: 'rectangle',
        x: rect.x(),
        y: rect.y(),
        width: rect.width(),
        height: rect.height(),
        stroke: rect.stroke(),
        strokeWidth: rect.strokeWidth(),
        fill: rect.fill(),
        opacity: rect.opacity(),
      });
    } else if (this.previewCircle) {
      const circle = this.previewCircle;
      this.previewCircle = undefined;
      this.layers.preview.removeChildren();
      this.layers.preview.draw();

      circle.listening(true);
      this.layers.main.add(circle);
      this.layers.main.draw();

      this.store.addElement({
        id: nanoid(),
        type: 'circle',
        x: circle.x(),
        y: circle.y(),
        radius: circle.radius(),
        stroke: circle.stroke(),
        strokeWidth: circle.strokeWidth(),
        fill: circle.fill(),
        opacity: circle.opacity(),
      });
    }

    this.origin = null;
    return true;
  };

  onMouseDown = this.onPointerDown;
  onMouseMove = this.onPointerMove;
  onMouseUp = this.onPointerUp;
}