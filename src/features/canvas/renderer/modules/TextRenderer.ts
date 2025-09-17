// Text renderer module for rendering text elements
import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';
import { openShapeTextEditor } from '../../utils/editors/openShapeTextEditor';

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
  private stage?: Konva.Stage;
  private unsubscribe?: () => void;
  private store?: any;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[TextRenderer] Mounting...');
    this.layer = ctx.layers.main;
    this.stage = ctx.stage;
    this.store = ctx.store;

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
        this.textNodes.set(id, node);
        this.layer.add(node);
        console.log('[TextRenderer] Created text node:', { id, text: text.text });
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
      name: `text-${text.id}`,
      x: text.x,
      y: text.y,
      width: text.width,
      text: text.text,
      fontSize: text.style?.fontSize || 18,
      fontFamily: text.style?.fontFamily || 'Inter, system-ui, sans-serif',
      fontStyle: text.style?.fontWeight || 'normal',
      fill: text.style?.fill || '#111827',
      align: text.style?.align || 'left',
      rotation: text.rotation || 0,
      opacity: text.opacity || 1,
      wrap: 'none', // Single line text for now
      listening: true,
      draggable: true, // enable dragging
      // Performance optimizations
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Set element ID for selection system
    node.setAttr('elementId', text.id);

    // Add event handlers
    this.addEventHandlers(node, text);

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
      fontSize: text.style?.fontSize || 18,
      fontFamily: text.style?.fontFamily || 'Inter, system-ui, sans-serif',
      fontStyle: text.style?.fontWeight || 'normal',
      fill: text.style?.fill || '#111827',
      align: text.style?.align || 'left',
      rotation: text.rotation || 0,
      opacity: text.opacity || 1,
      // Performance optimizations
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Set element ID for selection system
    node.setAttr('elementId', text.id);

    // Fixed-height content-hugging: adjust height based on text content
    if (!text.height) {
      // Auto-size height to content
      const textHeight = node.height();
      node.height(textHeight);
    } else {
      node.height(text.height);
    }
  }

  private addEventHandlers(node: Konva.Text, text: TextElement) {
    // Handle dragging to update position
    node.on('dragend', (e) => {
      const textNode = e.target as Konva.Text;
      const nx = textNode.x();
      const ny = textNode.y();
      console.log('[TextRenderer] Updating text position:', { id: text.id, x: nx, y: ny });
      
      this.updateTextInStore(text.id, { x: nx, y: ny });
    });

    // Handle double-click for text editing
    node.on('dblclick', (e) => {
      console.log('[TextRenderer] Text double-clicked for editing:', text.id);
      this.startTextEditing(node, text);
    });

    // Handle double-tap for mobile
    node.on('dbltap', (e) => {
      console.log('[TextRenderer] Text double-tapped for editing:', text.id);
      this.startTextEditing(node, text);
    });
  }

  private updateTextInStore(textId: string, updates: Partial<TextElement>) {
    try {
      const state = this.store?.getState();
      
      // Try different store method patterns
      if (state?.updateElement) {
        state.updateElement(textId, updates, { pushHistory: true });
      } else if (state?.element?.update) {
        state.element.update(textId, updates);
      } else {
        console.warn('[TextRenderer] No suitable update method found in store');
        // Fall back to direct store update - not ideal but prevents crashes
        const currentElement = state?.elements?.get?.(textId);
        if (currentElement && state?.elements?.set) {
          const updatedElement = { ...currentElement, ...updates };
          state.elements.set(textId, updatedElement);
        }
      }
    } catch (error) {
      console.error('[TextRenderer] Error updating text in store:', error);
    }
  }

  private startTextEditing(node: Konva.Text, text: TextElement) {
    if (!this.stage || !this.layer) {
      console.warn('[TextRenderer] No stage or layer available for text editing');
      return;
    }

    console.log('[TextRenderer] Opening text editor for:', text.id);
    
    openShapeTextEditor({
      stage: this.stage,
      layer: this.layer,
      shape: node,
      onCommit: (newText: string) => {
        console.log('[TextRenderer] Text editor committed:', newText);
        if (newText !== text.text) {
          this.updateTextInStore(text.id, { text: newText });
        }
      },
      onCancel: () => {
        console.log('[TextRenderer] Text editing cancelled');
      }
    });
  }
}