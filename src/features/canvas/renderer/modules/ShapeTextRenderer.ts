// Adds/updates Konva.Text inside shape groups on the main layer.

import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';
import type { CanvasElement } from '../../../../../types';

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  highlighter: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

type ShapeWithText = CanvasElement & {
  type: 'rectangle' | 'circle' | 'ellipse' | 'triangle';
  data?: {
    text?: string;
    padding?: number;
  };
  style?: {
    fontSize?: number;
    fontFamily?: string;
    textColor?: string;
    textAlign?: 'left' | 'center' | 'right';
  };
};

export interface ShapeTextRendererDeps {
  // Returns the root Konva.Group (or node) by element id if present in main layer.
  getNodeById: (id: string) => Konva.Node | null;
}

export class ShapeTextRenderer implements RendererModule {
  private layers?: RendererLayers;
  private readonly textById = new Map<string, Konva.Text>();
  private getNodeById?: (id: string) => Konva.Node | null;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    this.layers = ctx.layers as RendererLayers;
    
    // Create a basic node finder that searches the main layer
    this.getNodeById = (id: string) => {
      const main = this.layers?.main;
      // Prefer Konva's native id selector
      return (
        (main?.findOne(`#${id}`) as Konva.Node | null) ||
        (main?.findOne(`[id="${id}"]`) as Konva.Node | null) ||
        null
      );
    };

    // Subscribe to store changes
    this.unsubscribe = ctx.store.subscribe(
      (state) => ({ elements: state.elements }),
      (current, previous) => {
        // Check for changes in elements with text
        for (const [id, element] of current.elements) {
          const prevElement = previous?.elements?.get(id);
          
          if (this.isTextShapeType(element)) {
            // Check if text content changed or element is new
            const currentText = typeof element.data?.text === 'string' ? element.data.text : '';
            const prevText = typeof prevElement?.data?.text === 'string' ? prevElement.data.text : '';

            if (currentText !== prevText || !prevElement) {
              if (currentText && currentText.trim()) {
                this.render(element as ShapeWithText);
              } else if (prevText && prevText.trim()) {
                // Previously had text, now cleared -> remove
                this.remove(id);
              }
            }
          }
        }
        
        // Check for deleted elements
        if (previous?.elements) {
          for (const [id] of previous.elements) {
            if (!current.elements.has(id)) {
              this.remove(id);
            }
          }
        }
      }
    );

    return () => {
      this.unsubscribe?.();
      this.cleanup();
    };
  }

  private isTextShapeType(el: CanvasElement): el is ShapeWithText {
    return ['rectangle', 'circle', 'ellipse', 'triangle'].includes(el.type as string);
  }

  render(el: ShapeWithText) {
    if (!this.layers || !this.getNodeById) return;

    const root = this.getNodeById(el.id);
    if (!root) {
      // Shape not rendered yet; nothing to do.
      return;
    }

    const padding = el.data?.padding ?? 8;
    const fontFamily = el.style?.fontFamily ?? 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial';
    const fontSize = el.style?.fontSize ?? 16;
    const fill = el.textColor ?? el.style?.textColor ?? '#111827';
    const align = el.style?.textAlign ?? 'center';
    const w = Math.max(0, (el.width ?? 0) - padding * 2);
    const h = Math.max(0, (el.height ?? 0) - padding * 2);

    let textNode = this.textById.get(el.id);
    // If we don't have a node or it was detached/destroyed (no parent), recreate it
    if (!textNode || (typeof textNode.getParent === 'function' && !textNode.getParent())) {
      textNode = new Konva.Text({
        x: padding,
        y: padding,
        width: w,
        height: h,
        text: el.data?.text ?? '',
        fontFamily,
        fontSize,
        fill,
        align,
        verticalAlign: 'middle',
        listening: false,
        perfectDrawEnabled: false,
        name: 'shape-text',
      });

      // Ensure root is a Group to position text inside local coords
      if (root instanceof Konva.Group) {
        root.add(textNode);
      } else {
        // Wrap in a group if needed. Preserve identifier on the group for reliable lookup.
        const g = new Konva.Group({ id: el.id, name: 'shape' });
        const layer = this.layers.main;
        const currentLayer = root.getLayer();
        (currentLayer ?? layer).add(g);
        root.moveTo(g);
        g.add(textNode);
      }

      this.textById.set(el.id, textNode);
    }

    textNode.setAttrs({
      x: padding,
      y: padding,
      width: w,
      height: h,
      text: el.data?.text ?? '',
      fontFamily,
      fontSize,
      fill,
      align,
      verticalAlign: 'middle',
    });

    this.layers.main.batchDraw();
  }

  remove(id: string) {
    if (!this.layers) return;
    
    const t = this.textById.get(id);
    if (t) {
      try { 
        t.destroy(); 
      } catch {
        // Node might already be destroyed
      }
      this.textById.delete(id);
      this.layers.main.batchDraw();
    }
  }

  private cleanup() {
    // Clean up all text nodes
    for (const [id] of this.textById) {
      this.remove(id);
    }
    this.textById.clear();
  }
}