// features/canvas/renderermodular/modules/TextModule.ts
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

export interface TextOptions {
  fontFamily: () => string;
  fontSize: () => number;
  fill: () => string;
  align?: () => 'left' | 'center' | 'right';
  width?: () => number; // optional initial wrap width
}

export default class TextModule {
  private readonly layers: RendererLayers;
  private readonly store: StoreAdapter;
  private readonly opts: TextOptions;

  constructor(layers: RendererLayers, store: StoreAdapter, opts: TextOptions) {
    this.layers = layers;
    this.store = store;
    this.opts = opts;
  }

  onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    const p = stage?.getPointerPosition();
    if (!stage || !p) return false;

    const id = nanoid();

    const textNode = new Konva.Text({
      x: p.x,
      y: p.y,
      text: '',
      fontFamily: this.opts.fontFamily(),
      fontSize: this.opts.fontSize(),
      fill: this.opts.fill(),
      align: this.opts.align?.() ?? 'left',
      width: this.opts.width?.(),
      listening: true,
      perfectDrawEnabled: false,
      // Additional properties to match figjam-like text can be adjusted later
    });

    this.layers.main.add(textNode);
    this.layers.main.draw();

    this.store.addElement({
      id,
      type: 'text',
      x: textNode.x(),
      y: textNode.y(),
      text: '',
      fontFamily: textNode.fontFamily(),
      fontSize: textNode.fontSize(),
      fill: textNode.fill(),
      align: textNode.align(),
      width: textNode.width(),
    });

    // Let higher-level system open DOM overlay editor anchored at this position
    return true;
  };

  onClick = this.onPointerDown;
  onMouseDown = this.onPointerDown;
}