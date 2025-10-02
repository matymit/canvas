// Text renderer module for rendering text elements
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { openKonvaTextEditor } from "../../utils/editors/openShapeTextEditor";
import { getTextConfig } from "../../constants/TextConstants";

type Id = string;

// Extended window interface for type safety
interface ExtendedWindow extends Window {
  selectionModule?: {
    selectElement?: (elementId: string, options?: Record<string, unknown>) => void;
    clearSelection?: () => void;
    [key: string]: unknown;
  };
}

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
  resizable?: boolean; // Phase 18A: Control resize behavior
}

export class TextRenderer implements RendererModule {
  private readonly textNodes = new Map<Id, Konva.Text>();
  private layer?: Konva.Layer;
  private stage?: Konva.Stage;
  private unsubscribe?: () => void;
  private store?: ModuleRendererCtx["store"];

  mount(ctx: ModuleRendererCtx): () => void {
    // Mounting text renderer
    this.layer = ctx.layers.main;
    this.stage = ctx.stage;
    this.store = ctx.store;

    // Subscribe to store changes - watch text elements AND selectedTool with shallow equality
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract text elements AND selectedTool (for draggable state)
      (state) => {
        // Store subscription triggered
        const texts = new Map<Id, TextElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "text") {
            // Found text element in store
            texts.set(id, element as TextElement);
          }
        }
        // CRITICAL FIX: Include selectedTool so draggable state updates when tool changes
        // Returning text elements with selectedTool
        return { texts, selectedTool: state.ui?.selectedTool };
      },
      // Callback: reconcile changes (extract texts from returned object)
      ({ texts }) => this.reconcile(texts),
      // Options: ensure immediate fire but use simpler equality
      {
        fireImmediately: true,
        // Custom equality to prevent unnecessary reconciliation
        equalityFn: (a, b) => {
          // CRITICAL: Compare both texts AND selectedTool
          if (a.selectedTool !== b.selectedTool) return false;
          if (a.texts.size !== b.texts.size) return false;
          for (const [id, element] of a.texts) {
            const other = b.texts.get(id);
            if (
              !other ||
              other.text !== element.text ||
              other.x !== element.x ||
              other.y !== element.y
            ) {
              return false;
            }
          }
          return true;
        },
      },
    );

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    // Unmounting text renderer
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
    // Reconciling text elements

    if (!this.layer) {
      // Error: [TextRenderer] No layer available for reconciliation
      return;
    }

    const seen = new Set<Id>();

    // Add/update text elements
    for (const [id, text] of texts) {
      seen.add(id);
      let node = this.textNodes.get(id);

      if (
        !node ||
        (node &&
          "isDestroyed" in node &&
          typeof node.isDestroyed === "function" &&
          node.isDestroyed() === true)
      ) {
        // Remove destroyed node from tracking if it exists
        if (
          node &&
          "isDestroyed" in node &&
          typeof node.isDestroyed === "function" &&
          node.isDestroyed() === true
        ) {
          // Removing destroyed node from tracking
          this.textNodes.delete(id);
        }

        // Create new text node
        // Creating new text node
        try {
          node = this.createTextNode(text);
          this.textNodes.set(id, node);

          // Check if node is already in layer to prevent duplicates
          if (!node.getParent()) {
            this.layer.add(node);
            // Added text node to layer
          } else {
            // Node already has parent, not adding to layer
          }
        } catch (error) {
          // Error: [TextRenderer] Error creating text node: ${error}
          continue;
        }
      } else {
        // Update existing text node
        // Updating existing text node
        this.updateTextNode(node, text);
      }
    }

    // Remove deleted text elements
    for (const [id, node] of this.textNodes) {
      if (!seen.has(id)) {
        // Removing deleted text
        try {
          node.destroy();
        } catch (error) {
          // Error destroying node (non-critical)
        }
        this.textNodes.delete(id);
      }
    }

    // Calling batchDraw on layer

    try {
      this.layer.batchDraw();
      // BatchDraw completed successfully
    } catch (error) {
      // Error: [TextRenderer] Error during batchDraw: ${error}
    }
  }

  private createTextNode(text: TextElement): Konva.Text {
    // Creating text node

    // Check if pan tool is active - if so, disable dragging on elements
    const storeState = this.store?.getState();
    const isPanToolActive = storeState?.ui?.selectedTool === "pan";

    const node = new Konva.Text({
      id: text.id,
      name: `text-${text.id}`,
      x: text.x,
      y: text.y,
      width: text.width,
      text: text.text,
      padding: 4, // Add padding to match HTML editor
      // Apply consistent text styling with fallback support
      ...(() => {
        const textConfig = getTextConfig("TEXT");
        return {
          fontSize: text.style?.fontSize || textConfig.fontSize,
          fontFamily: text.style?.fontFamily || textConfig.fontFamily,
          fontStyle: text.style?.fontWeight || textConfig.fontWeight.toString(),
        };
      })(),
      fill: text.style?.fill || "#111827", // Use element's fill color
      align: text.style?.align || "left",
      rotation: text.rotation || 0,
      opacity: text.opacity || 1,
      wrap: "none", // Single line text for now
      listening: true,
      draggable: !isPanToolActive, // disable dragging when pan tool is active
      // Performance optimizations
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Set element ID for selection system - use both methods for compatibility
    node.setAttr("elementId", text.id);
    node.setAttr("nodeType", "text"); // Additional attribute to help with identification
    node.setAttr(
      "resizable",
      text.resizable !== undefined ? text.resizable : false,
    ); // Phase 18A: Text elements not resizable by default

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

    // Text node created with attributes

    return node;
  }

  private updateTextNode(node: Konva.Text, text: TextElement) {
    // Safety check: ensure node exists and hasn't been destroyed
    if (
      !node ||
      (node &&
        "isDestroyed" in node &&
        typeof node.isDestroyed === "function" &&
        node.isDestroyed() === true)
    ) {
      // Warning: [TextRenderer] Attempted to update destroyed or null text node: ${text.id}
      return;
    }

    try {
      node.setAttrs({
        x: text.x,
        y: text.y,
        width: text.width,
        text: text.text,
        padding: 4, // Consistent padding
        // Apply consistent text styling with fallback support
        ...(() => {
          const textConfig = getTextConfig("TEXT");
          return {
            fontSize: text.style?.fontSize || textConfig.fontSize,
            fontFamily: text.style?.fontFamily || textConfig.fontFamily,
          };
        })(),
        fontStyle: text.style?.fontWeight || "normal",
        fill: text.style?.fill || "#111827", // Use element's fill color
        align: text.style?.align || "left",
        rotation: text.rotation || 0,
        opacity: text.opacity || 1,
        // Performance optimizations
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
      });

      // Set element ID for selection system - use both methods for compatibility
      node.setAttr("elementId", text.id);
      node.setAttr("nodeType", "text");

      // Fixed-height content-hugging: adjust height based on text content
      if (!text.height) {
        // Auto-size height to content
        const textHeight = node.height();
        node.height(textHeight);
      } else {
        node.height(text.height);
      }
    } catch (error) {
      // Error: [TextRenderer] Error updating text node: ${error}, textId: ${text.id}
      // Remove the corrupted node from our tracking
      this.textNodes.delete(text.id);
      try {
        node.destroy();
      } catch (_destroyError) {
        // Warning: [TextRenderer] Error destroying corrupted node: ${destroyError}
      }
    }
  }

  private addEventHandlers(node: Konva.Text, text: TextElement) {
    // Handle single click for selection
    node.on("click", (e) => {
      // Text clicked for selection
      e.cancelBubble = true; // Prevent event bubbling

      // Select this text element via the global selection module
      const selectionModule = (window as ExtendedWindow).selectionModule;
      if (selectionModule?.selectElement) {
        selectionModule.selectElement?.(text.id);
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
    node.on("tap", (e) => {
      // Text tapped for selection
      e.cancelBubble = true;

      const selectionModule = (window as ExtendedWindow).selectionModule;
      if (selectionModule?.selectElement) {
        selectionModule.selectElement?.(text.id);
      }
    });

    // Handle dragging to update position
    node.on("dragstart", (e) => {
      // Text drag started
      // Set dragStatus for compatibility with transformer
      const textNode = e.target as Konva.Text;
      (textNode as Konva.Text & { dragStatus?: string }).dragStatus = "started";
    });

    node.on("dragend", (e) => {
      const textNode = e.target as Konva.Text;
      const nx = textNode.x();
      const ny = textNode.y();
      // Updating text position

      // Clear dragStatus
      (textNode as Konva.Text & { dragStatus?: string }).dragStatus = undefined;

      this.updateTextInStore(text.id, { x: nx, y: ny });
    });

    // Handle double-click for text editing
    node.on("dblclick", (e) => {
      // Text double-clicked for editing
      e.cancelBubble = true; // Prevent event bubbling
      this.startTextEditing(node, text);
    });

    // Handle double-tap for mobile
    node.on("dbltap", (e) => {
      // Text double-tapped for editing
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
        // No suitable update method found in store
        // Fall back to direct store update - not ideal but prevents crashes
        const currentElement = state?.elements?.get?.(textId);
        if (currentElement && state?.elements?.set) {
          const updatedElement = { ...currentElement, ...updates };
          state.elements.set(textId, updatedElement);
        }
      }
    } catch (error) {
      // Error: [TextRenderer] Error updating text in store: ${error}
    }
  }

  private startTextEditing(node: Konva.Text, text: TextElement) {
    const stage = this.stage;
    const layer = this.layer;
    if (!stage || !layer) {
      // Warning: [TextRenderer] No stage or layer available for text editing
      return;
    }

    // Don't clear selection - keep the selection frame visible as the border
    // The text editor won't have its own border

    // Opening text editor immediately
    openKonvaTextEditor({
        stage,
        layer,
        shape: node,
        onCommit: (newText: string) => {
          // Text editor committed
          if (newText !== text.text) {
            this.updateTextInStore(text.id, { text: newText });
          }
          // Don't auto-select after editing - let user click to select
        },
        onCancel: () => {
          // Text editing cancelled
        },
      });
  }
}
