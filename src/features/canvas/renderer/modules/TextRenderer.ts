// Text renderer module for rendering text elements
import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';
import { openKonvaTextEditor } from '../../utils/editors/openShapeTextEditor';

type Id = string;

interface TextElement {
  id: Id;
  type: "text";
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
    align?: "left" | "center" | "right";
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
    console.log("[TextRenderer] Mounting...");
    this.layer = ctx.layers.main;
    this.stage = ctx.stage;
    this.store = ctx.store;

    // Subscribe to store changes - watch text elements with shallow equality
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract text elements
      (state) => {
        console.log('[TextRenderer] Store subscription triggered, total elements:', state.elements.size);
        const texts = new Map<Id, TextElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "text") {
            console.log('[TextRenderer] Found text element in store:', { id, text: element.text });
            texts.set(id, element as TextElement);
          }
        }
        console.log('[TextRenderer] Selector returning', texts.size, 'text elements');
        return texts;
      },
      // Callback: reconcile changes
      (texts) => this.reconcile(texts),
      // Options: ensure immediate fire but use simpler equality
      {
        fireImmediately: true,
        // Custom equality to prevent unnecessary reconciliation
        equalityFn: (a, b) => {
          if (a.size !== b.size) return false;
          for (const [id, element] of a) {
            const other = b.get(id);
            if (!other ||
                other.text !== element.text ||
                other.x !== element.x ||
                other.y !== element.y) {
              return false;
            }
          }
          return true;
        }
      }
    );

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log("[TextRenderer] Unmounting...");
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
    // Always log reconciliation attempts for debugging
    console.log("[TextRenderer] 🔄 Reconciling", texts.size, "text elements", Array.from(texts.keys()));

    if (!this.layer) {
      console.error('[TextRenderer] ❌ No layer available for reconciliation');
      return;
    }

    const seen = new Set<Id>();

    // Add/update text elements
    for (const [id, text] of texts) {
      seen.add(id);
      let node = this.textNodes.get(id);

      if (!node || (node && (node as any).isDestroyed?.() === true)) {
        // Remove destroyed node from tracking if it exists
        if (node && (node as any).isDestroyed?.() === true) {
          console.log('[TextRenderer] 🗑️ Removing destroyed node from tracking:', id);
          this.textNodes.delete(id);
        }

        // Create new text node
        console.log('[TextRenderer] ✨ Creating new text node for:', { id, text: text.text, fill: text.style?.fill });
        try {
          node = this.createTextNode(text);
          this.textNodes.set(id, node);

          // Check if node is already in layer to prevent duplicates
          if (!node.getParent()) {
            this.layer.add(node);
            console.log('[TextRenderer] ✅ Added text node to layer:', { id, nodeCount: this.textNodes.size, layerChildren: this.layer.children.length });
          } else {
            console.warn('[TextRenderer] ⚠️ Node already has parent, not adding to layer:', id);
          }
        } catch (error) {
          console.error('[TextRenderer] ❌ Error creating text node:', error);
          continue;
        }
      } else {
        // Update existing text node
        console.log('[TextRenderer] 🔄 Updating existing text node:', { id, text: text.text });
        this.updateTextNode(node, text);
      }
    }

    // Remove deleted text elements
    for (const [id, node] of this.textNodes) {
      if (!seen.has(id)) {
        console.log("[TextRenderer] 🗑️ Removing deleted text:", id);
        try {
          node.destroy();
        } catch (error) {
          console.warn('[TextRenderer] ⚠️ Error destroying node:', error);
        }
        this.textNodes.delete(id);
      }
    }

    console.log('[TextRenderer] 🎨 Calling batchDraw on layer with', this.textNodes.size, 'text nodes, layer children:', this.layer.children.length);

    try {
      this.layer.batchDraw();
      console.log('[TextRenderer] ✅ BatchDraw completed successfully');
    } catch (error) {
      console.error('[TextRenderer] ❌ Error during batchDraw:', error);
    }
  }

  private createTextNode(text: TextElement): Konva.Text {
    console.log('[TextRenderer] Creating text node:', { id: text.id, text: text.text, style: text.style });

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
      fill: text.style?.fill || '#111827', // Use element's fill color
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

    // Set element ID for selection system - use both methods for compatibility
    node.setAttr('elementId', text.id);
    node.setAttr('nodeType', 'text'); // Additional attribute to help with identification

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

    console.log('[TextRenderer] Text node created with attributes:', {
      id: node.id(),
      elementId: node.getAttr('elementId'),
      x: node.x(),
      y: node.y(),
      text: node.text(),
      fill: node.fill(),
      fontSize: node.fontSize(),
      listening: node.listening(),
      draggable: node.draggable()
    });

    return node;
  }

  private updateTextNode(node: Konva.Text, text: TextElement) {
    // Safety check: ensure node exists and hasn't been destroyed
    if (!node || (node && (node as any).isDestroyed?.() === true)) {
      console.warn('[TextRenderer] Attempted to update destroyed or null text node:', text.id);
      return;
    }

    try {
      node.setAttrs({
        x: text.x,
        y: text.y,
        width: text.width,
        text: text.text,
        fontSize: text.style?.fontSize || 18,
        fontFamily: text.style?.fontFamily || 'Inter, system-ui, sans-serif',
        fontStyle: text.style?.fontWeight || 'normal',
        fill: text.style?.fill || '#111827', // Use element's fill color
        align: text.style?.align || 'left',
        rotation: text.rotation || 0,
        opacity: text.opacity || 1,
        // Performance optimizations
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
      });

      // Set element ID for selection system - use both methods for compatibility
      node.setAttr('elementId', text.id);
      node.setAttr('nodeType', 'text');

      // Fixed-height content-hugging: adjust height based on text content
      if (!text.height) {
        // Auto-size height to content
        const textHeight = node.height();
        node.height(textHeight);
      } else {
        node.height(text.height);
      }
    } catch (error) {
      console.error('[TextRenderer] Error updating text node:', error, { textId: text.id });
      // Remove the corrupted node from our tracking
      this.textNodes.delete(text.id);
      try {
        node.destroy();
      } catch (destroyError) {
        console.warn('[TextRenderer] Error destroying corrupted node:', destroyError);
      }
    }
  }

  private addEventHandlers(node: Konva.Text, text: TextElement) {
    // Handle single click for selection
    node.on('click', (e) => {
      console.log('[TextRenderer] Text clicked for selection:', text.id);
      e.cancelBubble = true; // Prevent event bubbling

      // Select this text element via the global selection module
      const selectionModule = (window as any).selectionModule;
      if (selectionModule?.selectElement) {
        selectionModule.selectElement(text.id);
      } else {
        // Fallback to store-based selection
        if (this.store) {
          const state = this.store.getState();
          if (state.setSelection) {
            state.setSelection([text.id]);
          } else if (state.selection?.set) {
            state.selection.set([text.id]);
          }
        }
      }
    });

    // Handle tap for mobile selection
    node.on('tap', (e) => {
      console.log('[TextRenderer] Text tapped for selection:', text.id);
      e.cancelBubble = true;

      const selectionModule = (window as any).selectionModule;
      if (selectionModule?.selectElement) {
        selectionModule.selectElement(text.id);
      }
    });

    // Handle dragging to update position
    node.on('dragstart', (e) => {
      console.log('[TextRenderer] Text drag started:', text.id);
      // Set dragStatus for compatibility with transformer
      const textNode = e.target as Konva.Text;
      (textNode as any).dragStatus = 'started';
    });

    node.on('dragend', (e) => {
      const textNode = e.target as Konva.Text;
      const nx = textNode.x();
      const ny = textNode.y();
      console.log('[TextRenderer] Updating text position:', { id: text.id, x: nx, y: ny });

      // Clear dragStatus
      (textNode as any).dragStatus = undefined;

      this.updateTextInStore(text.id, { x: nx, y: ny });
    });

    // Handle double-click for text editing
    node.on('dblclick', (e) => {
      console.log('[TextRenderer] Text double-clicked for editing:', text.id);
      e.cancelBubble = true; // Prevent event bubbling
      this.startTextEditing(node, text);
    });

    // Handle double-tap for mobile
    node.on('dbltap', (e) => {
      console.log('[TextRenderer] Text double-tapped for editing:', text.id);
      e.cancelBubble = true;
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

    openKonvaTextEditor({
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