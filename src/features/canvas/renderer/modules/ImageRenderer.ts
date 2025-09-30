// Image renderer module for main layer rendering with async bitmap loading
import Konva from 'konva';
import type ImageElement from '../../types/image';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import { loadImageFromIndexedDB } from '../../../../utils/imageStorage';
import { transformStateManager } from './selection/managers';

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
  private storeCtx?: { store: ReturnType<typeof useUnifiedCanvasStore.getState> };

  constructor(layers: RendererLayers) {
    this.layers = layers;
  }

  setStoreContext(ctx: { store: ReturnType<typeof useUnifiedCanvasStore.getState> }) {
    this.storeCtx = ctx;
  }

  /**
   * Ensures the bitmap is loaded and cached on the Konva.Image node
   */
  private async ensureBitmap(el: ImageElement, node: Konva.Image): Promise<void> {
    console.log(`[ImageRenderer] ensureBitmap called for ${el.id}`, { 
      hasSrc: !!el.src, 
      srcLength: el.src?.length || 0,
      hasIdbKey: !!(el as any).idbKey,
      idbKey: (el as any).idbKey 
    });
    
    // If src is missing but we have idbKey, load from IndexedDB
    let src = el.src;
    if ((!src || src === '') && (el as any).idbKey) {
      console.log(`[ImageRenderer] Loading image from IndexedDB: ${(el as any).idbKey}`);
      const loadedSrc = await loadImageFromIndexedDB((el as any).idbKey);
      if (loadedSrc) {
        src = loadedSrc;
        // Update the element in the store with the loaded src
        const store = useUnifiedCanvasStore.getState();
        if (store.updateElement) {
          store.updateElement(el.id, { src: loadedSrc } as any, { pushHistory: false });
        }
      } else {
        console.error(`[ImageRenderer] Failed to load image from IndexedDB: ${(el as any).idbKey}`);
        return;
      }
    }
    
    if (!src) {
      console.error('[ImageRenderer] No src available for image:', el.id);
      return;
    }
    
    if (node.getAttr('src') === src && node.image()) {
      console.log(`[ImageRenderer] Image already loaded, skipping: ${el.id}`);
      return;
    }

    console.log(`[ImageRenderer] Loading new image for ${el.id}, srcLength: ${src.length}`);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const tag = new Image();
        tag.onload = () => resolve(tag);
        tag.onerror = (e) => reject(e);
        tag.src = src;
      });

      node.setAttr('src', src);
      node.image(img);
      console.log(`[ImageRenderer] Successfully loaded image for ${el.id}`);
    } catch (error) {
      console.error('[ImageRenderer] Failed to load image:', error);
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
    console.log(`[ImageRenderer] render() called for ${el.id}`, {
      hasSrc: !!el.src,
      srcLength: el.src?.length || 0,
      hasIdbKey: !!(el as any).idbKey,
      x: el.x,
      y: el.y
    });
    
    // Check if pan tool is active - if so, disable dragging on elements
    const storeState = this.storeCtx?.store;
    const isPanToolActive = storeState?.ui?.selectedTool === 'pan';
    
    let g = this.groupById.get(el.id);
    if (!g || !g.getLayer()) {
      g = new Konva.Group({
        id: el.id,
        name: 'image',
        listening: true,
        draggable: !isPanToolActive, // Enable dragging when not in pan mode
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

      // CRITICAL FIX: Add dragend handler to persist position changes
      // Without this, dragging changes the Konva node position but never saves to store
      // This is why images snap back - the store position is never updated!
      g.on('dragend', (e) => {
        const group = e.target as Konva.Group;
        const newX = group.x();
        const newY = group.y();
        
        console.log(`[ImageRenderer] Drag ended for ${el.id}`, {
          oldPos: { x: el.x, y: el.y },
          newPos: { x: newX, y: newY }
        });
        
        const store = useUnifiedCanvasStore.getState();
        if (store.updateElement) {
          store.updateElement(el.id, { x: newX, y: newY }, { pushHistory: true });
        }
      });

      // Note: Drag and transform are handled by SelectionModule's transformer
      // No need for duplicate event handlers here

      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    } else {
      // CRITICAL FIX: Update draggable state on every render based on current tool
      // This ensures images become draggable when switching from pan to select tool
      g.draggable(!isPanToolActive);
    }

    // Only sync position from store when NOT actively dragging/transforming
    // This prevents snap-back during user interactions
    // CRITICAL FIX: Check both isDragging() AND transform state to prevent position jumps
    // When user drags with Transformer attached, it's "transforming" not "dragging"
    const isUserInteracting = g.isDragging() || transformStateManager.isTransformInProgress;
    
    if (!isUserInteracting) {
      const currentPos = g.position();
      const positionDiff = Math.abs(currentPos.x - el.x) + Math.abs(currentPos.y - el.y);
      // Increased threshold to 5 pixels to tolerate small floating-point differences
      // and prevent micro-adjustments after transforms complete
      const isSignificantDiff = positionDiff > 5;
      
      if (isSignificantDiff) {
        console.log(`[ImageRenderer] Position sync needed for ${el.id}`, {
          currentPos,
          storePos: { x: el.x, y: el.y },
          diff: positionDiff
        });
        g.position({ x: el.x, y: el.y });
      }
    } else {
      console.log(`[ImageRenderer] Skipping position sync - user interacting (${el.id})`, {
        isDragging: g.isDragging(),
        isTransforming: transformStateManager.isTransformInProgress
      });
    }
    g.rotation(el.rotation ?? 0);
    g.opacity(el.opacity ?? 1);
    
    // CRITICAL FIX: Reset scale to 1 after transform
    // ElementSynchronizer already applied scale to width/height, so scale should be reset
    // This prevents scale accumulation on subsequent transforms
    g.scale({ x: 1, y: 1 });

    // Update draggable state based on current tool (variables declared at line 120-121)
    g.draggable(!isPanToolActive);

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
    
    // CRITICAL FIX: Set Group size to match image dimensions
    // This allows Transformer to properly calculate bounds during active transforms
    // Must be updated on every render to reflect size changes from transforms
    g.size({ width: safeWidth, height: safeHeight });

    this.requestLayerRedraw();
  }

  setVisibility(id: string, visible: boolean): void {
    console.log(`[ImageRenderer] setVisibility(${id}, ${visible})`);
    const group = this.groupById.get(id);
    if (!group) {
      console.log(`[ImageRenderer] setVisibility: group not found for ${id}`);
      return;
    }
    if (group.visible() !== visible) {
      console.log(`[ImageRenderer] Changing visibility for ${id}: ${group.visible()} → ${visible}`);
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
