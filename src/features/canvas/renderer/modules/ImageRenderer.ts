// Image renderer module for main layer rendering with async bitmap loading
import Konva from 'konva';
import type ImageElement from '../../types/image';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export class ImageRenderer {
  private readonly layers: RendererLayers;
  private readonly groupById = new Map<string, Konva.Group>();
  private readonly imageNodeById = new Map<string, Konva.Image>();
  private pendingDraw: number | null = null;

  constructor(layers: RendererLayers) {
    this.layers = layers;
  }

  /**
   * Ensures the bitmap is loaded and cached on the Konva.Image node
   */
  private async ensureBitmap(el: ImageElement, node: Konva.Image): Promise<void> {
    if (node.getAttr('src') === el.src && node.image()) return;

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const tag = new Image();
        tag.onload = () => resolve(tag);
        tag.onerror = (e) => reject(e);
        tag.src = el.src;
      });

      node.setAttr('src', el.src);
      node.image(img);
    } catch (error) {
      // Error: Failed to load image
      // Set a placeholder or handle error gracefully
    }
  }

  private requestLayerRedraw(): void {
    if (this.pendingDraw !== null) return;
    const raf =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame
          : null;

    if (!raf) {
      this.layers.main.batchDraw();
      return;
    }

    this.pendingDraw = raf(() => {
      this.pendingDraw = null;
      this.layers.main.batchDraw();
    });
  }

  /**
   * Render or update an image element on the main layer
   */
  async render(el: ImageElement): Promise<void> {
    let g = this.groupById.get(el.id);
    if (!g || !g.getLayer()) {
      g = new Konva.Group({
        id: el.id,
        name: 'image',
        listening: true,
        // REMOVED: draggable: true - this was causing conflicts with selection system
        x: el.x,
        y: el.y,
      });

      // FIXED: Set elementId attribute for selection detection
      g.setAttr('elementId', el.id);
      g.setAttr('elementType', 'image');
      g.setAttr('nodeType', 'image');
      if (typeof el.keepAspectRatio === 'boolean') {
        g.setAttr('keepAspectRatio', el.keepAspectRatio);
      }

      // FIXED: Add click handler that properly integrates with selection
      g.on('click', (e) => {
        e.cancelBubble = true; // Prevent event from bubbling to stage
        const store = useUnifiedCanvasStore.getState();
        if (store.setSelection) {
          store.setSelection([el.id]);
        }
      });

      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }

    // FIXED: Always sync position from store (prevents snap-back)
    g.position({ x: el.x, y: el.y });
    g.rotation(el.rotation ?? 0);
    g.opacity(el.opacity ?? 1);

    // Ensure elementId is maintained
    g.setAttr('elementId', el.id);
    g.setAttr('elementType', 'image');
    g.setAttr('nodeType', 'image');
    if (typeof el.keepAspectRatio === 'boolean') {
      g.setAttr('keepAspectRatio', el.keepAspectRatio);
    } else {
      g.setAttr('keepAspectRatio', true);
    }

    let bitmap = this.imageNodeById.get(el.id);
    if (!bitmap || !bitmap.getLayer()) {
      bitmap = new Konva.Image({
        x: 0,
        y: 0,
        width: el.width,
        height: el.height,
        listening: true,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        name: 'image-bitmap',
        image: undefined, // will be set by ensureBitmap
      });

      // Set elementId on bitmap for click detection
      bitmap.setAttr('elementId', el.id);
      bitmap.on('click', (e) => {
        e.cancelBubble = true;
        const store = useUnifiedCanvasStore.getState();
        if (store.setSelection) {
          store.setSelection([el.id]);
        }
      });

      g.add(bitmap);
      this.imageNodeById.set(el.id, bitmap);
    }

    bitmap.setAttr('elementId', el.id);
    bitmap.setAttr('elementType', 'image');
    bitmap.setAttr('nodeType', 'image');
    bitmap.setAttr(
      'keepAspectRatio',
      typeof el.keepAspectRatio === 'boolean' ? el.keepAspectRatio : true,
    );

    // Load bitmap asynchronously and update size
    await this.ensureBitmap(el, bitmap);

    // Ensure dimensions are valid
    const safeWidth = Math.max(1, el.width);
    const safeHeight = Math.max(1, el.height);
    bitmap.size({ width: safeWidth, height: safeHeight });

    this.requestLayerRedraw();
  }

  setVisibility(id: string, visible: boolean): void {
    const group = this.groupById.get(id);
    if (!group) return;
    if (group.visible() !== visible) {
      group.visible(visible);
      const bitmap = this.imageNodeById.get(id);
      bitmap?.visible(visible);
      this.requestLayerRedraw();
    }
  }

  /**
   * Remove an image element from the renderer
   */
  remove(id: string): void {
    const g = this.groupById.get(id);
    if (g) g.destroy();
    this.groupById.delete(id);
    this.imageNodeById.delete(id);
    this.requestLayerRedraw();
  }

  /**
   * Clean up all rendered elements
   */
  clear(): void {
    for (const [id] of this.groupById) {
      this.remove(id);
    }
    if (this.pendingDraw !== null) {
      const caf =
        typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
          ? window.cancelAnimationFrame.bind(window)
          : typeof cancelAnimationFrame === 'function'
            ? cancelAnimationFrame
            : null;
      if (caf) {
        caf(this.pendingDraw);
      }
      this.pendingDraw = null;
    }
  }
}

export default ImageRenderer;
