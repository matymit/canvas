// Text renderer module for rendering text elements
import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';

type Id = string;

interface TextElement {
  id: Id;
  type: 'text';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fill?: string;
    align?: 'left' | 'center' | 'right';
  };
  rotation?: number;
  opacity?: number;
}

export class TextRenderer implements RendererModule {
  private textNodes = new Map<Id, Konva.Text>();
  private layer?: Konva.Layer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[TextRenderer] Mounting...');
    this.layer = ctx.layers.main;

    // Subscribe to store changes - watch text elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract text elements
      (state) => {
        const texts = new Map<Id, TextElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === 'text') {
            texts.set(id, element as TextElement);
          }
        }
        return texts;
      },
      // Callback: reconcile changes
      (texts) => this.reconcile(texts)
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialTexts = new Map<Id, TextElement>();
    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === 'text') {
        initialTexts.set(id, element as TextElement);
      }
    }
    this.reconcile(initialTexts);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log('[TextRenderer] Unmounting...');
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    for (const node of this.textNodes.values()) {
      node.destroy();
    }
    this.textNodes.clear();
    if (this.layer) {
      this.layer.batchDraw();
    }
  }

  private reconcile(texts: Map<Id, TextElement>) {
    console.log('[TextRenderer] Reconciling', texts.size, 'text elements');

    if (!this.layer) return;

    const seen = new Set<Id>();

    // Add/update text elements
    for (const [id, text] of texts) {
      seen.add(id);
      let node = this.textNodes.get(id);

      if (!node) {
        // Create new text node
        node = this.createTextNode(text);
        // Add dragend handler for position commit
        node.on('dragend', (e) => {
          const textNode = e.target as Konva.Text;
          const nx = textNode.x();
          const ny = textNode.y();
          (window as any).__canvasStore?.element?.updateElement?.(text.id, { x: nx, y: ny }, { pushHistory: true });
        });
        this.textNodes.set(id, node);
        this.layer.add(node);
      } else {
        // Update existing text node
        this.updateTextNode(node, text);
      }
    }

    // Remove deleted text elements
    for (const [id, node] of this.textNodes) {
      if (!seen.has(id)) {
        console.log('[TextRenderer] Removing text:', id);
        node.destroy();
        this.textNodes.delete(id);
      }
    }

    this.layer.batchDraw();
  }

  private createTextNode(text: TextElement): Konva.Text {
    const node = new Konva.Text({
      id: text.id,
      x: text.x,
      y: text.y,
      width: text.width,
      text: text.text,
      fontSize: text.style?.fontSize || 16,
      fontFamily: text.style?.fontFamily || 'Arial, sans-serif',
      fontStyle: text.style?.fontWeight || 'normal',
      fill: text.style?.fill || '#000000',
      align: text.style?.align || 'left',
      rotation: text.rotation || 0,
      opacity: text.opacity || 1,
      wrap: 'word',
      listening: true,
      draggable: true, // enable dragging
      // Performance optimizations
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Fixed-height content-hugging: adjust height based on text content
    if (!text.height) {
      // Auto-size height to content
      const textHeight = node.height();
      node.height(textHeight);
    } else {
      node.height(text.height);
    }

    return node;
  }

  private updateTextNode(node: Konva.Text, text: TextElement) {
    node.setAttrs({
      x: text.x,
      y: text.y,
      width: text.width,
      text: text.text,
      fontSize: text.style?.fontSize || 16,
      fontFamily: text.style?.fontFamily || 'Arial, sans-serif',
      fontStyle: text.style?.fontWeight || 'normal',
      fill: text.style?.fill || '#000000',
      align: text.style?.align || 'left',
      rotation: text.rotation || 0,
      opacity: text.opacity || 1,
      // Performance optimizations
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Fixed-height content-hugging: adjust height based on text content
    if (!text.height) {
      // Auto-size height to content
      const textHeight = node.height();
      node.height(textHeight);
    } else {
      node.height(text.height);
    }
  }
}