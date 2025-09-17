// Image renderer module for main layer rendering with async bitmap loading
import Konva from 'konva';
import type ImageElement from '../../types/elements/image';

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export class ImageRenderer {
  private layers: RendererLayers;
  private groupById = new Map<string, Konva.Group>();
  private imageNodeById = new Map<string, Konva.Image>();

  constructor(layers: RendererLayers) {
    this.layers = layers;
  }

  /**
   * Ensures the bitmap is loaded and cached on the Konva.Image node
   */
  private async ensureBitmap(el: ImageElement, node: Konva.Image): Promise<void> {
    if (node.getAttr('src') === el.src && node.image()) return;
    
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const tag = new Image();
      tag.onload = () => resolve(tag);
      tag.onerror = (e) => reject(e);
      tag.src = el.src;
    });
    
    node.setAttr('src', el.src);
    node.image(img);
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
        listening: true, // element-level interactions
        draggable: true,  // enable element-level drag
        x: el.x,
        y: el.y,
      });
      // Commit x/y on dragend
      g.on('dragend', (e) => {
        const grp = e.target as Konva.Group;
        const nx = grp.x();
        const ny = grp.y();
        // store facade via global bridge
        (window as any).__canvasStore?.element?.updateElement?.(el.id, { x: nx, y: ny }, { pushHistory: true });
      });
      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }

    // Update group transform properties
    g.position({ x: el.x, y: el.y });
    g.rotation(el.rotation ?? 0);
    g.opacity(el.opacity ?? 1);

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
      g.add(bitmap);
      this.imageNodeById.set(el.id, bitmap);
    }

    // Load bitmap asynchronously and update size
    await this.ensureBitmap(el, bitmap);
    bitmap.size({ width: el.width, height: el.height });

    this.layers.main.batchDraw();
  }

  /**
   * Remove an image element from the renderer
   */
  remove(id: string): void {
    const g = this.groupById.get(id);
    if (g) g.destroy();
    this.groupById.delete(id);
    this.imageNodeById.delete(id);
    this.layers.main.batchDraw();
  }

  /**
   * Clean up all rendered elements
   */
  clear(): void {
    for (const [id] of this.groupById) {
      this.remove(id);
    }
  }
}

export default ImageRenderer;