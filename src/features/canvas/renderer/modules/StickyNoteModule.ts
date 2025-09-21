// features/canvas/renderer/modules/StickyNoteModule.ts
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";

type Id = string;

type StickySnapshot = {
  id: Id;
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  text?: string;
};

// Define interfaces for window extensions and store types
interface SelectionModule {
  selectElement: (elementId: string) => void;
}

interface ExtendedWindow extends Window {
  selectionModule?: SelectionModule;
  stickyNoteModule?: StickyNoteModule;
  pendingStickyNoteEdits?: Set<string>;
}

interface StoreWithHistory {
  history?: {
    withUndo: (description: string, fn: () => void) => void;
  };
  withUndo?: (description: string, fn: () => void) => void;
  element?: {
    update: (id: string, updates: Record<string, unknown>) => void;
  };
  updateElement?: (id: string, updates: Record<string, unknown>) => void;
}

// Get reference to SelectionModule for proper selection integration
function getSelectionModule(): SelectionModule | undefined {
  return (window as ExtendedWindow).selectionModule;
}

export class StickyNoteModule implements RendererModule {
  private nodes = new Map<Id, Konva.Group>();
  private layers?: Konva.Layer;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;
  private activeEditor: HTMLTextAreaElement | null = null;
  private editorElementId: string | null = null;

  mount(ctx: ModuleRendererCtx): () => void {
    this.layers = ctx.layers.main;
    this.storeCtx = ctx;

    const extendedWindow = window as ExtendedWindow;

    // FIXED: Make module globally accessible for tool integration
    extendedWindow.stickyNoteModule = this;
    if (!extendedWindow.pendingStickyNoteEdits) {
      extendedWindow.pendingStickyNoteEdits = new Set();
    }

    // Subscribe to store changes - watch only sticky-note elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract sticky-note elements
      (state) => {
        const stickyNotes = new Map<Id, StickySnapshot>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "sticky-note") {
            stickyNotes.set(id, {
              id,
              x: element.x || 0,
              y: element.y || 0,
              width: element.width || 240,
              height: element.height || 180,
              fill: element.fill || element.style?.fill || "#FFF59D", // Check fill first, then style.fill
              text: (typeof element.text === 'string' ? element.text : '') ||
                    (typeof element.data?.text === 'string' ? element.data.text : '') || "",
            });
          }
        }
        return stickyNotes;
      },
      // Callback: reconcile changes
      (stickyNotes) => this.reconcile(stickyNotes),
      // Options: shallow compare and fire immediately
      {
        fireImmediately: true,
        equalityFn: (
          a: Map<Id, StickySnapshot>,
          b: Map<Id, StickySnapshot>,
        ) => {
          if (a.size !== b.size) return false;
          for (const [id, aSticky] of a) {
            const bSticky = b.get(id);
            if (!bSticky) return false;
            if (JSON.stringify(aSticky) !== JSON.stringify(bSticky))
              return false;
          }
          return true;
        },
      },
    );

    return () => this.unmount();
  }

  private unmount() {
    this.closeActiveEditor();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    for (const group of this.nodes.values()) {
      group.destroy();
    }
    this.nodes.clear();
    if (this.layers) {
      this.layers.batchDraw();
    }

    // Clean up global reference
    const extendedWindow = window as ExtendedWindow;
    if (extendedWindow.stickyNoteModule === this) {
      extendedWindow.stickyNoteModule = undefined;
    }
  }

  private reconcile(stickyNotes: Map<Id, StickySnapshot>) {
    if (!this.layers) {
      return;
    }

    const seen = new Set<Id>();

    // Add/update existing sticky notes
    for (const [id, sticky] of stickyNotes) {
      seen.add(id);
      let group = this.nodes.get(id);

      if (!group) {
        // Create new sticky note
        group = this.createStickyGroup(sticky);
        this.nodes.set(id, group);
        this.layers.add(group);
        this.consumePendingImmediateEdit(id, group);
      } else {
        // Update existing sticky note
        this.updateStickyGroup(group, sticky);
        this.consumePendingImmediateEdit(id, group);
      }
    }

    // Remove deleted sticky notes
    for (const [id, group] of this.nodes) {
      if (!seen.has(id)) {
        group.destroy();
        this.nodes.delete(id);
      }
    }

    this.layers.batchDraw();
  }

  private createStickyGroup(sticky: StickySnapshot): Konva.Group {
    const group = new Konva.Group({
      id: sticky.id,
      x: sticky.x,
      y: sticky.y,
      width: sticky.width,
      height: sticky.height,
      draggable: true,
    });

    // FIXED: Set elementId attribute for SelectionModule integration
    group.setAttr("elementId", sticky.id);

    // Add interaction handlers
    this.setupStickyInteractions(group, sticky.id);

    const rect = new Konva.Rect({
      name: "sticky-bg",
      x: 0,
      y: 0,
      width: sticky.width,
      height: sticky.height,
      fill: sticky.fill || "#FEF08A", // Default sticky yellow
      stroke: "#E5E7EB",
      strokeWidth: 1,
      cornerRadius: 8,
      shadowColor: "black",
      shadowBlur: 10,
      shadowOpacity: 0.1,
      shadowOffset: { x: 0, y: 2 },
    });

    const text = new Konva.Text({
      name: "sticky-text",
      x: 12,
      y: 12,
      width: Math.max(0, sticky.width - 24),
      height: Math.max(0, sticky.height - 24),
      text: sticky.text || "",
      fontSize: 14,
      fontFamily: "Inter, system-ui, sans-serif",
      fill: "#374151",
      wrap: "word",
      lineHeight: 1.4,
      verticalAlign: "top",
    });

    group.add(rect);
    group.add(text);

    return group;
  }

  private updateStickyGroup(group: Konva.Group, sticky: StickySnapshot) {
    // Update position and size
    group.setAttrs({
      x: sticky.x,
      y: sticky.y,
      width: sticky.width,
      height: sticky.height,
    });

    // Ensure elementId attribute is maintained
    group.setAttr("elementId", sticky.id);

    // Update rectangle
    const rect = group.findOne(".sticky-bg") as Konva.Rect;
    if (rect) {
      rect.setAttrs({
        width: sticky.width,
        height: sticky.height,
        fill: sticky.fill || "#FEF08A",
      });
    }

    // Update text
    const text = group.findOne(".sticky-text") as Konva.Text;
    if (text) {
      text.setAttrs({
        width: Math.max(0, sticky.width - 24),
        height: Math.max(0, sticky.height - 24),
        text: sticky.text || "",
      });
    }

    // Update active editor if editing this element
    if (this.activeEditor && this.editorElementId === sticky.id) {
      this.repositionActiveEditor(group);
    }
  }

  private setupStickyInteractions(group: Konva.Group, elementId: string) {
    // FIXED: Proper click handler for selection using SelectionModule
    group.on("click tap", (e) => {
      // Don't cancel bubble if the click is on a transformer (resize handles)
      const isTransformerClick =
        e.target?.getParent()?.className === "Transformer" ||
        e.target?.className === "Transformer";
      if (!isTransformerClick) {
        e.cancelBubble = true; // Prevent stage click
      }

      const selectionModule = getSelectionModule();
      if (selectionModule) {
        // Use SelectionModule for consistent selection behavior
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
        if (isAdditive) {
          // For additive selection, we need to get current selection and toggle
          selectionModule.selectElement(elementId); // Simplified for now
        } else {
          selectionModule.selectElement(elementId);
        }
      } else {
        // Fallback to direct store integration
        if (!this.storeCtx) return;

        const store = this.storeCtx.store.getState();
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;

        if ('setSelection' in store && typeof store.setSelection === 'function') {
          if (isAdditive) {
            // Get current selection and toggle
            const current = ('selectedElementIds' in store ? store.selectedElementIds : new Set()) || new Set();
            const newSelection = new Set(current as Iterable<string>);
            if (newSelection.has(elementId)) {
              newSelection.delete(elementId);
            } else {
              newSelection.add(elementId);
            }
            store.setSelection(Array.from(newSelection));
          } else {
            store.setSelection([elementId]);
          }
        } else if ('selection' in store && store.selection) {
          const selection = store.selection as { toggle?: (id: string) => void; set?: (ids: string[]) => void };
          if (isAdditive) {
            selection.toggle?.(elementId);
          } else {
            selection.set?.([elementId]);
          }
        }
      }
    });

    // FIXED: Improved drag handling with proper store commits
    let dragStartData: {
      x: number;
      y: number;
      storeX: number;
      storeY: number;
    } | null = null;

    // FIXED: Add transform start data tracking
    let transformStartData: {
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      storeWidth: number;
      storeHeight: number;
    } | null = null;

    group.on("dragstart", () => {
      const groupPos = group.position();
      const store = this.storeCtx?.store.getState();
      const element = store?.elements?.get?.(elementId);

      dragStartData = {
        x: groupPos.x,
        y: groupPos.y,
        storeX: element?.x || 0,
        storeY: element?.y || 0,
      };

      // Transform handling is managed by TransformerManager
      // No need for manual beginTransform calls during drag
    });

    group.on("dragend", () => {
      if (!this.storeCtx || !dragStartData) return;

      const pos = group.position();
      const store = this.storeCtx.store.getState();

      // Only update if position actually changed
      const deltaX = Math.abs(pos.x - dragStartData.storeX);
      const deltaY = Math.abs(pos.y - dragStartData.storeY);

      if (deltaX > 1 || deltaY > 1) {
        const storeWithHistory = store as StoreWithHistory;
        const withUndo =
          storeWithHistory.history?.withUndo?.bind(storeWithHistory.history) ||
          storeWithHistory.withUndo;
        const updateElement = storeWithHistory.element?.update || storeWithHistory.updateElement;

        if (updateElement) {
          const updateFn = () => {
            updateElement(elementId, {
              x: Math.round(pos.x),
              y: Math.round(pos.y),
            });
          };

          if (withUndo) {
            withUndo("Move sticky note", updateFn);
          } else {
            updateFn();
          }
        }
      }

      // Transform handling is managed by TransformerManager
      // No need for manual endTransform calls during drag
      dragStartData = null;
    });

    // FIXED: Add transform event handlers for resize operations
    group.on("transformstart", () => {
      const store = this.storeCtx?.store.getState();
      const element = store?.elements?.get?.(elementId);

      if (element) {
        transformStartData = {
          width: group.width() || element.width || 240,
          height: group.height() || element.height || 180,
          scaleX: group.scaleX() || 1,
          scaleY: group.scaleY() || 1,
          storeWidth: element.width || 240,
          storeHeight: element.height || 180,
        };
      }
    });

    group.on("transform", () => {
      // Update the group's width/height during transform for visual feedback
      // The actual store update happens in transformend
    });

    group.on("transformend", () => {
      if (!this.storeCtx || !transformStartData) return;

      const store = this.storeCtx.store.getState();
      const newWidth = Math.max(
        50,
        Math.round(
          (group.width() || transformStartData.width) * (group.scaleX() || 1),
        ),
      );
      const newHeight = Math.max(
        50,
        Math.round(
          (group.height() || transformStartData.height) * (group.scaleY() || 1),
        ),
      );

      // Only update if size actually changed
      const deltaWidth = Math.abs(newWidth - transformStartData.storeWidth);
      const deltaHeight = Math.abs(newHeight - transformStartData.storeHeight);

      if (deltaWidth > 1 || deltaHeight > 1) {
        const storeWithHistory = store as StoreWithHistory;
        const withUndo =
          storeWithHistory.history?.withUndo?.bind(storeWithHistory.history) ||
          storeWithHistory.withUndo;
        const updateElement = storeWithHistory.element?.update || storeWithHistory.updateElement;

        if (updateElement) {
          const updateFn = () => {
            updateElement(elementId, {
              width: newWidth,
              height: newHeight,
            });

            // Reset scale to 1 to maintain consistent hit testing
            group.scaleX(1);
            group.scaleY(1);
          };

          if (withUndo) {
            withUndo("Resize sticky note", updateFn);
          } else {
            updateFn();
          }
        }
      }

      transformStartData = null;
    });

    // Double-click to edit text
    group.on("dblclick dbltap", (e) => {
      e.cancelBubble = true;
      this.startTextEditing(group, elementId);
    });

    // Hover effects
    group.on("mouseenter", () => {
      if (!this.activeEditor) {
        document.body.style.cursor = "move";
      }
    });

    group.on("mouseleave", () => {
      if (!this.activeEditor) {
        document.body.style.cursor = "default";
      }
    });
  }

  // Public method to trigger immediate text editing (called by StickyNoteTool)
  public startTextEditingForElement(elementId: string) {
    const group = this.nodes.get(elementId);
    if (group) {
      this.startTextEditing(group, elementId);
    }
  }

  private startTextEditing(group: Konva.Group, elementId: string) {
    // Close any existing editor
    this.closeActiveEditor();

    if (!this.storeCtx) return;

    const extendedWindow = window as ExtendedWindow;
    extendedWindow.pendingStickyNoteEdits?.delete(elementId);

    // Get stage and text element for positioning
    const stage = group.getStage();
    const textNode = group.findOne(".sticky-text") as Konva.Text;
    const bgNode = group.findOne(".sticky-bg") as Konva.Rect;
    if (!stage || !textNode || !bgNode) return;

    const container = stage.container();
    const rect = container.getBoundingClientRect();
    const textAbsPos = textNode.absolutePosition();

    // Create seamlessly integrated text editor
    const fillValue = bgNode.fill();
    this.activeEditor = this.createSeamlessEditor(
      rect.left + textAbsPos.x,
      rect.top + textAbsPos.y,
      textNode.width(),
      textNode.height(),
      typeof fillValue === "string" ? fillValue : "#FEF08A",
      elementId,
    );

    this.editorElementId = elementId;

    // Hide the Konva text while editing
    textNode.visible(false);
    textNode.getLayer()?.batchDraw();
  }

  private createSeamlessEditor(
    pageX: number,
    pageY: number,
    width: number,
    height: number,
    bgColor: string,
    elementId: string,
  ): HTMLTextAreaElement {
    const editor = document.createElement("textarea");
    editor.setAttribute("data-sticky-editor", elementId);
    editor.setAttribute("data-testid", "sticky-note-input");

    // Get current text from store
    const store = this.storeCtx?.store.getState();
    const element =
      store?.elements?.get?.(elementId) || store?.element?.getById?.(elementId);
    const currentText = (typeof element?.text === 'string' ? element.text : '') ||
                       (typeof element?.data?.text === 'string' ? element.data.text : '') || "";

    editor.value = currentText;

    // FIXED: Seamless integration styling with background color matching
    editor.style.cssText = `
      position: fixed;
      left: ${pageX}px;
      top: ${pageY}px;
      width: ${width}px;
      height: ${height}px;
      border: none;
      outline: none;
      background: ${bgColor || "#FEF08A"};
      z-index: 1000;
      font-family: Inter, system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      color: #374151;
      resize: none;
      padding: 0;
      margin: 0;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      border-radius: 8px;
    `;

    document.body.appendChild(editor);

    // FIXED: Immediate focus with visible caret
    editor.focus();
    if (currentText) {
      editor.select();
    } else {
      editor.setSelectionRange(0, 0);
    }

    const commit = () => {
      const newText = editor.value;

      if (this.storeCtx) {
        const store = this.storeCtx.store.getState();
        const storeWithHistory = store as StoreWithHistory;
        const updateElement = storeWithHistory.element?.update || storeWithHistory.updateElement;
        const withUndo =
          storeWithHistory.history?.withUndo?.bind(storeWithHistory.history) ||
          storeWithHistory.withUndo;

        if (updateElement) {
          const updateFn = () => {
            updateElement(elementId, { text: newText });
          };

          if (withUndo) {
            withUndo("Edit sticky note text", updateFn);
          } else {
            updateFn();
          }
        }
      }

      this.closeActiveEditor();
    };

    // Event handlers
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        commit();
      }

      // Allow other keys to bubble for normal typing
      e.stopPropagation();
    });

    editor.addEventListener("blur", commit, { once: true });

    // Click outside to commit
    const clickOutside = (e: Event) => {
      if (!editor.contains(e.target as Node)) {
        commit();
        document.removeEventListener("click", clickOutside, true);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", clickOutside, true);
    }, 100);

    return editor;
  }

  private repositionActiveEditor(group: Konva.Group) {
    if (!this.activeEditor) return;

    const stage = group.getStage();
    const textNode = group.findOne(".sticky-text") as Konva.Text;
    if (!stage || !textNode) return;

    const container = stage.container();
    const rect = container.getBoundingClientRect();
    const textAbsPos = textNode.absolutePosition();

    this.activeEditor.style.left = `${rect.left + textAbsPos.x}px`;
    this.activeEditor.style.top = `${rect.top + textAbsPos.y}px`;
    this.activeEditor.style.width = `${textNode.width()}px`;
    this.activeEditor.style.height = `${textNode.height()}px`;
  }

  private closeActiveEditor() {
    if (!this.activeEditor || !this.editorElementId) return;

    // Show the Konva text again
    const group = this.nodes.get(this.editorElementId);
    if (group) {
      const textNode = group.findOne(".sticky-text") as Konva.Text;
      if (textNode) {
        textNode.visible(true);
        textNode.getLayer()?.batchDraw();
      }
    }

    // Remove editor
    try {
      this.activeEditor.remove();
    } catch (error) {
      // Ignore cleanup errors
      // Debug: [StickyNoteModule] Cleanup error: ${error}
    }

    this.activeEditor = null;
    this.editorElementId = null;

    // Restore cursor
    document.body.style.cursor = "default";
  }

  // FIXED: Public method for immediate text editing after creation with improved timing
  public triggerImmediateTextEdit(elementId: string) {
    const extendedWindow = window as ExtendedWindow;
    extendedWindow.pendingStickyNoteEdits?.add(elementId);
    this.consumePendingImmediateEdit(elementId);
  }

  private consumePendingImmediateEdit(
    elementId: string,
    group?: Konva.Group,
    attempt = 0,
  ) {
    const extendedWindow = window as ExtendedWindow;
    const pendingSet = extendedWindow.pendingStickyNoteEdits;

    if (!pendingSet?.has(elementId)) {
      return;
    }

    const targetGroup = group ?? this.nodes.get(elementId);
    if (!targetGroup) {
      if (attempt > 120) {
        return;
      }
      setTimeout(() => this.consumePendingImmediateEdit(elementId, undefined, attempt + 1), 16);
      return;
    }

    pendingSet.delete(elementId);

    if (this.editorElementId === elementId) {
      return;
    }

    setTimeout(() => {
      this.startTextEditing(targetGroup, elementId);
    }, 16);
  }
}
