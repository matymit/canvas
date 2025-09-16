// features/canvas/renderermodular/modules/StickyNoteModule.ts
import Konva from 'konva';

type ElementId = string;

interface StickyNoteElement {
  id: ElementId;
  type: 'sticky-note' | string;
  x: number;
  y: number;
  width: number;    // target width for wrapping
  minHeight?: number;
  padding?: number;
  rotation?: number;
  text: string;
  style?: {
    fill?: string;         // rect fill
    stroke?: string;       // rect stroke
    strokeWidth?: number;  // rect strokeWidth
    textColor?: string;    // text fill
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: string;    // 'normal' | 'bold' | 'italic' | ...
    align?: 'left' | 'center' | 'right';
  };
}

interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

interface StoreApi {
  getStickyNotes?: () => Map<ElementId, StickyNoteElement>;
  onElementsChange?: (cb: () => void) => () => void;
}

interface ModuleContext {
  layers: RendererLayers;
  store?: StoreApi;
  stage?: Konva.Stage;
}

type NodeBundle = {
  group: Konva.Group;
  rect: Konva.Rect;
  text: Konva.Text;
};

export default class StickyNoteModule {
  readonly id = 'sticky-note-module';

  private layers!: RendererLayers;
  private store?: StoreApi;

  private nodes = new Map<ElementId, NodeBundle>();
  private unsubElements?: () => void;

  mount(ctx: ModuleContext) {
    this.layers = ctx.layers;
    this.store = ctx.store;

    if (this.store?.onElementsChange) {
      this.unsubElements = this.store.onElementsChange(() => this.render());
    }

    this.render();
  }

  unmount() {
    for (const [, bundle] of this.nodes) {
      bundle.group.destroy();
    }
    this.nodes.clear();
    if (this.unsubElements) this.unsubElements();
    this.layers.main.batchDraw();
  }

  render() {
    const map = this.store?.getStickyNotes?.();
    if (!map) return;

    const seen = new Set<ElementId>();

    for (const [id, el] of map.entries()) {
      seen.add(id);
      let bundle = this.nodes.get(id);

      if (!bundle) {
        bundle = this.createBundle(el);
        this.layers.main.add(bundle.group);
        this.nodes.set(id, bundle);
      }

      // Update transform/position
      bundle.group.position({ x: el.x, y: el.y });
      bundle.group.rotation(el.rotation ?? 0);

      // Update styles and content
      this.updateStyles(bundle, el);
      this.updateContentAndAutosize(bundle, el);
    }

    // Destroy removed notes
    for (const [id, bundle] of this.nodes.entries()) {
      if (!seen.has(id)) {
        bundle.group.destroy();
        this.nodes.delete(id);
      }
    }

    this.layers.main.batchDraw();
  }

  private createBundle(el: StickyNoteElement): NodeBundle {
    const padding = el.padding ?? 12;
    const minHeight = Math.max(40, el.minHeight ?? 80);

    const group = new Konva.Group({
      x: el.x,
      y: el.y,
      rotation: el.rotation ?? 0,
      listening: true,
      draggable: false, // selection/transformer system should handle drag
    });

    const rect = new Konva.Rect({
      x: 0,
      y: 0,
      width: Math.max(80, el.width),
      height: minHeight,
      cornerRadius: 8,
      fill: el.style?.fill ?? '#FEF08A',
      stroke: el.style?.stroke ?? '#EAB308',
      strokeWidth: el.style?.strokeWidth ?? 1,
      listening: false,
      perfectDrawEnabled: false,
    });

    const text = new Konva.Text({
      x: padding,
      y: padding,
      width: Math.max(60, el.width - padding * 2),
      text: el.text ?? '',
      fill: el.style?.textColor ?? '#111827',
      fontFamily: el.style?.fontFamily ?? 'Inter, system-ui, -apple-system, Segoe UI, Roboto',
      fontSize: el.style?.fontSize ?? 16,
      fontStyle: el.style?.fontStyle ?? 'normal',
      align: el.style?.align ?? 'left',
      lineHeight: 1.2,
      listening: false,
      perfectDrawEnabled: false,
      wrap: 'word',
      ellipsis: false,
    });

    group.add(rect);
    group.add(text);

    const bundle = { group, rect, text };
    // Initial autosize
    this.updateContentAndAutosize(bundle, el);

    return bundle;
  }

  private updateStyles(bundle: NodeBundle, el: StickyNoteElement) {
    bundle.rect.fill(el.style?.fill ?? '#FEF08A');
    bundle.rect.stroke(el.style?.stroke ?? '#EAB308');
    bundle.rect.strokeWidth(el.style?.strokeWidth ?? 1);

    bundle.text.fill(el.style?.textColor ?? '#111827');
    bundle.text.fontFamily(el.style?.fontFamily ?? 'Inter, system-ui, -apple-system, Segoe UI, Roboto');
    bundle.text.fontSize(el.style?.fontSize ?? 16);
    bundle.text.fontStyle(el.style?.fontStyle ?? 'normal');
    bundle.text.align(el.style?.align ?? 'left');
  }

  private updateContentAndAutosize(bundle: NodeBundle, el: StickyNoteElement) {
    const padding = el.padding ?? 12;
    const minHeight = Math.max(40, el.minHeight ?? 80);

    // Ensure target width is reflected on both rect and text.
    const width = Math.max(80, el.width);
    bundle.rect.width(width);
    bundle.text.width(Math.max(60, width - padding * 2));

    // Update text content
    if (bundle.text.text() !== (el.text ?? '')) {
      bundle.text.text(el.text ?? '');
    }

    // Force a text measurement by drawing the layer synchronously where possible.
    // Konva.Text computes height after width/text changes; we then update rect height.
    // Use getHeight() to read the actual rendered height with current font settings.
    const measuredTextHeight = Math.max(bundle.text.getHeight(), bundle.text.height());

    const targetHeight = Math.max(minHeight, measuredTextHeight + padding * 2);
    if (Math.abs(bundle.rect.height() - targetHeight) > 0.5) {
      bundle.rect.height(targetHeight);
    }
  }
}