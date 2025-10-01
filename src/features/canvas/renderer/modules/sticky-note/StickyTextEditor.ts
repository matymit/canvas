// StickyTextEditor.ts
// Text editor management for sticky notes

import type Konva from "konva";
import { debug, error as logError } from "../../../../../utils/debug";
import { getTextConfig } from "../../../constants/TextConstants";
import type { UnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import type { CanvasElement, ElementId } from "../../../../../../types";

type StoreContext = {
  store: {
    getState: () => UnifiedCanvasStore;
  };
};

type StoreUpdateFn = (id: ElementId, updates: Partial<CanvasElement>) => void;
type UndoHandler = (description: string, fn: () => void) => void;
type StoreWithLegacyUndo = UnifiedCanvasStore & {
  withUndo?: UndoHandler;
};

export interface StickyTextEditorOptions {
  getStoreContext: () => StoreContext | undefined;
  getNodes: () => Map<string, Konva.Group>;
}

/**
 * Text editor subsystem for sticky notes
 * Manages text editing lifecycle, editor positioning, and text commits
 */
export class StickyTextEditor {
  private activeEditor: HTMLTextAreaElement | null = null;
  private editorElementId: ElementId | null = null;
  private readonly pendingImmediateEdits = new Set<ElementId>();
  private readonly options: StickyTextEditorOptions;

  constructor(options: StickyTextEditorOptions) {
    this.options = options;
  }

  /**
   * Get active editor element ID
   */
  getEditorElementId(): ElementId | null {
    return this.editorElementId;
  }

  /**
   * Check if currently editing a specific element
   */
  isEditing(elementId: ElementId): boolean {
    return this.editorElementId === elementId;
  }

  /**
   * Start text editing for a sticky note group
   */
  startTextEditing(group: Konva.Group, elementId: ElementId): void {
    debug("Starting text editing", {
      category: "StickyNoteModule",
      data: elementId,
    });

    // Close any existing editor
    this.closeActiveEditor();

    const storeCtx = this.options.getStoreContext();
    if (!storeCtx) {
      debug("No store context", { category: "StickyNoteModule" });
      return;
    }

    // Get stage and text element for positioning
    const stage = group.getStage();
    const textNode = group.findOne(".sticky-text") as Konva.Text;
    const bgNode = group.findOne(".sticky-bg") as Konva.Rect;
    if (!stage || !textNode || !bgNode) {
      debug("Missing required nodes", {
        category: "StickyNoteModule",
        data: { stage: !!stage, textNode: !!textNode, bgNode: !!bgNode },
      });
      return;
    }

    const container = stage.container();
    const rect = container.getBoundingClientRect();
    const textAbsPos = textNode.absolutePosition();

    debug("Editor positioning", {
      category: "StickyNoteModule",
      data: {
        containerRect: rect,
        textAbsPos,
        finalPos: { x: rect.left + textAbsPos.x, y: rect.top + textAbsPos.y },
      },
    });

    // Create seamlessly integrated text editor
    const fillValue = bgNode.fill();
    this.activeEditor = this.createSeamlessEditor(
      rect.left + textAbsPos.x,
      rect.top + textAbsPos.y,
      textNode.width(),
      textNode.height(),
      typeof fillValue === "string" ? fillValue : "#FEF08A",
      elementId,
      storeCtx,
    );

    this.editorElementId = elementId;

    // Hide the Konva text while editing
    textNode.visible(false);
    textNode.getLayer()?.batchDraw();
  }

  /**
   * Create seamless HTML textarea editor
   */
  private createSeamlessEditor(
    pageX: number,
    pageY: number,
    width: number,
    height: number,
    bgColor: string,
    elementId: ElementId,
    storeCtx: StoreContext,
  ): HTMLTextAreaElement {
    const editor = document.createElement("textarea");
    editor.setAttribute("data-sticky-editor", elementId);
    editor.setAttribute("data-testid", "sticky-note-input");

    // Get current text from store
    const store = storeCtx.store.getState();
    const element =
      store.elements.get(elementId) ?? store.element?.getById?.(elementId);
    const currentText =
      (typeof element?.text === "string" ? element.text : "") ||
      (typeof element?.data?.text === "string" ? element.data.text : "") ||
      "";

    editor.value = currentText;

    debug("Creating editor", {
      category: "StickyNoteModule",
      data: {
        elementId,
        currentText,
        position: { pageX, pageY, width, height },
        bgColor,
      },
    });

    // Seamless integration styling
    const textConfig = getTextConfig("STICKY_NOTE");
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
      font-family: ${textConfig.fontFamily};
      font-size: ${textConfig.fontSize}px;
      line-height: ${textConfig.lineHeight};
      font-weight: ${textConfig.fontWeight};
      color: #374151;
      resize: none;
      padding: 0;
      margin: 0;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      border-radius: 8px;
      box-shadow: none;
    `;

    document.body.appendChild(editor);

    // Immediate focus with visible caret
    const focusEditor = () => {
      try {
        editor.focus();
        if (currentText) {
          editor.select();
        } else {
          editor.setSelectionRange(0, 0);
        }
        debug("Editor focused and caret positioned", {
          category: "StickyNoteModule",
        });
      } catch (error) {
        debug("Focus error", { category: "StickyNoteModule", data: error });
      }
    };

    focusEditor();
    setTimeout(focusEditor, 10);
    requestAnimationFrame(focusEditor);

    const commit = () => {
      const newText = editor.value;
      debug("Committing text", {
        category: "StickyNoteModule",
        data: { elementId, newText },
      });

      const store = storeCtx.store.getState();
      const storeWithLegacyUndo = store as StoreWithLegacyUndo;
      const updateElement: StoreUpdateFn | undefined =
        store.element?.update ?? store.updateElement;
      const withUndo: UndoHandler | undefined =
        store.history?.withUndo ?? storeWithLegacyUndo.withUndo;

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

  /**
   * Reposition active editor when sticky is transformed
   */
  repositionActiveEditor(group: Konva.Group): void {
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

  /**
   * Close active editor and show Konva text
   */
  closeActiveEditor(): void {
    if (!this.activeEditor || !this.editorElementId) return;

    debug("Closing editor", {
      category: "StickyNoteModule",
      data: this.editorElementId,
    });

    // Show the Konva text again
    const nodes = this.options.getNodes();
    const group = nodes.get(this.editorElementId);
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
      logError("Cleanup error", { category: "StickyNoteModule", data: error });
    }

    this.activeEditor = null;
    this.editorElementId = null;

    // Restore cursor
    document.body.style.cursor = "default";
  }

  /**
   * Trigger immediate text edit after creation
   */
  triggerImmediateTextEdit(elementId: ElementId): void {
    debug("triggerImmediateTextEdit called", {
      category: "StickyNoteModule",
      data: elementId,
    });
    this.pendingImmediateEdits.add(elementId);
    this.maybeStartPendingEdit(elementId);
  }

  /**
   * Check and start pending edit when group is ready
   */
  maybeStartPendingEdit(elementId: ElementId, group?: Konva.Group): void {
    if (!this.pendingImmediateEdits.has(elementId)) {
      return;
    }

    const nodes = this.options.getNodes();
    const targetGroup = group ?? nodes.get(elementId);
    if (!targetGroup) {
      requestAnimationFrame(() => this.maybeStartPendingEdit(elementId));
      return;
    }

    if (this.editorElementId === elementId) {
      this.pendingImmediateEdits.delete(elementId);
      return;
    }

    requestAnimationFrame(() => {
      if (!this.pendingImmediateEdits.has(elementId)) {
        return;
      }
      this.pendingImmediateEdits.delete(elementId);
      this.startTextEditing(targetGroup, elementId);
    });
  }

  /**
   * Clear pending edits (for cleanup)
   */
  clearPendingEdits(): void {
    this.pendingImmediateEdits.clear();
  }
}
