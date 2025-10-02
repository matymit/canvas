// Image renderer module for main layer rendering with async bitmap loading
import Konva from 'konva';
import type ImageElement from '../../types/image';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import { loadImageFromIndexedDB } from '../../../../utils/imageStorage';
import { transformStateManager } from './selection/managers';
import { debug, error, warn } from '../../../../utils/debug';

const LOG_CATEGORY = 'renderer/image';

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
    debug('ImageRenderer: ensureBitmap invoked', {
      category: LOG_CATEGORY,
      data: {
        elementId: el.id,
        hasSrc: Boolean(el.src),
        srcLength: el.src?.length ?? 0,
        hasIdbKey: Boolean(el.idbKey),
        idbKey: el.idbKey ?? null,
      },
    });
    
    // If src is missing but we have idbKey, load from IndexedDB
    let src = el.src;
    if ((!src || src === '') && el.idbKey) {
      debug('ImageRenderer: loading image from IndexedDB', {
        category: LOG_CATEGORY,
        data: { elementId: el.id, idbKey: el.idbKey },
      });
      const loadedSrc = await loadImageFromIndexedDB(el.idbKey);
      if (loadedSrc) {
        src = loadedSrc;
        // Update the element in the store with the loaded src
        const store = useUnifiedCanvasStore.getState();
        if (store.updateElement) {
          store.updateElement(el.id, { src: loadedSrc }, { pushHistory: false });
        }
      } else {
        error('ImageRenderer: failed to load image from IndexedDB', {
          category: LOG_CATEGORY,
          data: { elementId: el.id, idbKey: el.idbKey },
        });
        return;
      }
    }
    
    if (!src) {
      error('ImageRenderer: no src available for image', {
        category: LOG_CATEGORY,
        data: { elementId: el.id },
      });
      return;
    }
    
    if (node.getAttr('src') === src && node.image()) {
      debug('ImageRenderer: image already loaded, skipping', {
        category: LOG_CATEGORY,
        data: { elementId: el.id },
      });
      return;
    }

    debug('ImageRenderer: loading new image', {
      category: LOG_CATEGORY,
      data: { elementId: el.id, srcLength: src.length },
    });
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const tag = new Image();
        tag.onload = () => resolve(tag);
        tag.onerror = (e) => reject(e);
        tag.src = src;
      });

      node.setAttr('src', src);
      node.image(img);
      debug('ImageRenderer: successfully loaded image', {
        category: LOG_CATEGORY,
        data: { elementId: el.id },
      });
    } catch (caughtError) {
      error('ImageRenderer: failed to load image from src', {
        category: LOG_CATEGORY,
        data: { elementId: el.id, error: caughtError },
      });
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
    debug('ImageRenderer: render invoked', {
      category: LOG_CATEGORY,
      data: {
        elementId: el.id,
        hasSrc: Boolean(el.src),
        srcLength: el.src?.length ?? 0,
        hasIdbKey: Boolean(el.idbKey),
        x: el.x,
        y: el.y,
      },
    });
    
    let g = this.groupById.get(el.id);
    if (!g || !g.getLayer()) {
      g = new Konva.Group({
        id: el.id,
        name: 'image',
        listening: true,
        draggable: false, // MarqueeDrag handles all dragging - native drag disabled
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

      // Note: Drag and transform are handled by MarqueeDrag and SelectionModule
      // ElementSynchronizer syncs positions back to store after drag completes
      // DO NOT add dragend handler here - it conflicts with MarqueeDrag and causes position jumps

      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }
    // Note: draggable is always false - MarqueeDrag handles all element dragging

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
        debug('ImageRenderer: syncing position from store', {
          category: LOG_CATEGORY,
          data: {
            elementId: el.id,
            currentPos,
            storePos: { x: el.x, y: el.y },
            diff: positionDiff,
          },
        });
        g.position({ x: el.x, y: el.y });
      }
    } else {
      debug('ImageRenderer: skipping position sync during interaction', {
        category: LOG_CATEGORY,
        data: {
          elementId: el.id,
          isDragging: g.isDragging(),
          isTransforming: transformStateManager.isTransformInProgress,
        },
      });
    }
    g.rotation(el.rotation ?? 0);
    g.opacity(el.opacity ?? 1);
    
    // CRITICAL FIX: Reset scale to 1 after transform
    // ElementSynchronizer already applied scale to width/height, so scale should be reset
    // This prevents scale accumulation on subsequent transforms
    g.scale({ x: 1, y: 1 });

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

      // FIXED: Do NOT set elementId on child bitmap - only parent Group should have it
      // This prevents stage.find() from returning duplicate nodes (Group + child Image)
      // Click events will bubble up to the parent Group which has the click handler
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

    // FIXED: Do NOT set elementId on child bitmap - only parent Group has elementId
    // Child attributes for metadata only (not used for selection)
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
    debug('ImageRenderer: setVisibility invoked', {
      category: LOG_CATEGORY,
      data: { id, visible },
    });
    const group = this.groupById.get(id);
    if (!group) {
      warn('ImageRenderer: group not found during visibility update', {
        category: LOG_CATEGORY,
        data: { id },
      });
      return;
    }
    if (group.visible() !== visible) {
      debug('ImageRenderer: updating visibility state', {
        category: LOG_CATEGORY,
        data: {
          id,
          previous: group.visible(),
          next: visible,
        },
      });
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
