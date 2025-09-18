// Image renderer module for main layer rendering with async bitmap loading
import Konva from 'konva';
import type ImageElement from '../../types/image';

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
        draggable: false,  // FIXED: Dragging handled by selection/transformer, not element directly
        x: el.x,
        y: el.y,
      });

      // CRITICAL FIX: Set both elementId attribute AND className for SelectionModule integration
      g.setAttr('elementId', el.id);
      g.className = 'image-group'; // Ensure className is set for proper recognition

      // CRITICAL: Also set the bitmap to have the elementId for click detection
      // FIXED: Removed cancelBubble to allow proper event propagation for selection in FigJamCanvas
      g.on('click', () => {
        console.log('[ImageRenderer] Group clicked, elementId:', el.id, 'listening:', g.listening(), 'visible:', g.visible());
        // Allow event to bubble up to stage click handler for selection
      });

      // FIXED: Removed dragend handler - dragging is now handled by transformer/selection system

      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }

    // Update group transform properties
    console.log(`[ImageRenderer] Updating image ${el.id} position to (${el.x}, ${el.y})`);
    g.position({ x: el.x, y: el.y });
    g.rotation(el.rotation ?? 0);
    g.opacity(el.opacity ?? 1);

    // CRITICAL FIX: Ensure elementId attribute is maintained during updates
    g.setAttr('elementId', el.id);
    g.className = 'image-group';

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

      // CRITICAL: Set elementId on bitmap too for click detection
      bitmap.setAttr('elementId', el.id);
      // FIXED: Removed cancelBubble to allow proper event propagation for selection in FigJamCanvas
      bitmap.on('click', () => {
        console.log('[ImageRenderer] Bitmap clicked, elementId:', el.id, 'listening:', bitmap.listening(), 'visible:', bitmap.visible());
        // Allow event to bubble up to stage click handler for selection
      });
      g.add(bitmap);
      this.imageNodeById.set(el.id, bitmap);
    }

    // Load bitmap asynchronously and update size
    await this.ensureBitmap(el, bitmap);

    // CRITICAL FIX: Ensure image dimensions are always positive
    // This prevents images from disappearing when dimensions become 0 or negative
    const MIN_SIZE = 1; // Minimum 1px to keep image visible
    const safeWidth = Math.max(MIN_SIZE, el.width);
    const safeHeight = Math.max(MIN_SIZE, el.height);

    bitmap.size({ width: safeWidth, height: safeHeight });

    // DEBUG: Verify final position after update
    const finalPos = g.position();
    console.log(`[ImageRenderer] Final Konva position for ${el.id}: (${finalPos.x}, ${finalPos.y})`);

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