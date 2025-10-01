// features/canvas/renderer/modules/StickyNoteModule.ts
// Sticky note rendering module - coordin ates subsystems for text editing, events, and rendering

import type Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { debug } from "../../../../utils/debug";
import { StickyTextEditor } from "./sticky-note/StickyTextEditor";
import { StickyEventHandlers } from "./sticky-note/StickyEventHandlers";
import {
  StickyRenderingEngine,
  type StickySnapshot,
} from "./sticky-note/StickyRenderingEngine";

const MIN_STICKY_WIDTH = 60;
const MIN_STICKY_HEIGHT = 40;

type Id = string;

/**
 * Result type for sticky resize operations
 */
export interface StickyResizeResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute sticky note resize dimensions from group transform
 * Exported for use by transform handlers
 */
export function computeStickyResizeUpdate(
  group: Konva.Group,
  opts: { minWidth?: number; minHeight?: number } = {},
): StickyResizeResult {
  const { minWidth = MIN_STICKY_WIDTH, minHeight = MIN_STICKY_HEIGHT } = opts;
  const scaleX = Math.abs(group.scaleX() ?? 1);
  const scaleY = Math.abs(group.scaleY() ?? 1);

  const baseWidth = group.width() || 0;
  const baseHeight = group.height() || 0;

  const widthCandidate =
    baseWidth > 0
      ? Math.round(baseWidth * scaleX)
      : Math.round(
          Math.abs(
            group.getClientRect({ skipShadow: true, skipStroke: true }).width,
          ),
        );
  const heightCandidate =
    baseHeight > 0
      ? Math.round(baseHeight * scaleY)
      : Math.round(
          Math.abs(
            group.getClientRect({ skipShadow: true, skipStroke: true }).height,
          ),
        );

  const width = Math.max(minWidth, widthCandidate);
  const height = Math.max(minHeight, heightCandidate);

  return {
    x: Math.round(group.x()),
    y: Math.round(group.y()),
    width,
    height,
  };
}

// Window extension interface
interface ExtendedWindow extends Window {
  stickyNoteModule?: StickyNoteModule;
}

/**
 * Sticky note module - coordinates text editing, events, and rendering subsystems
 */
export class StickyNoteModule implements RendererModule {
  private layers?: Konva.Layer;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;

  // Subsystems
  private textEditor?: StickyTextEditor;
  private eventHandlers?: StickyEventHandlers;
  private renderingEngine?: StickyRenderingEngine;

  /**
   * Mount the module and initialize subsystems
   */
  mount(ctx: ModuleRendererCtx): () => void {
    this.layers = ctx.layers.main;
    this.storeCtx = ctx;

    const extendedWindow = window as ExtendedWindow;

    debug("Mounting module", { category: "StickyNoteModule" });

    // Make module globally accessible for tool integration
    extendedWindow.stickyNoteModule = this;

    // Initialize subsystems
    this.textEditor = new StickyTextEditor({
      getStoreContext: () => this.storeCtx,
      getNodes: () => this.renderingEngine?.getNodes() || new Map(),
    });

    this.eventHandlers = new StickyEventHandlers({
      getStoreContext: () => this.storeCtx,
      startTextEditing: (group, elementId) => {
        this.textEditor?.startTextEditing(group, elementId);
      },
      getActiveEditor: () => this.textEditor?.getEditorElementId() ? document.querySelector(`[data-sticky-editor="${this.textEditor.getEditorElementId()}"]`) as HTMLTextAreaElement : null,
    });

    // CRITICAL FIX: Pass store directly instead of callback to avoid closure issues
    this.renderingEngine = new StickyRenderingEngine({
      layer: this.layers,
      setupStickyInteractions: (group, elementId) => {
        this.eventHandlers?.setupStickyInteractions(group, elementId);
      },
      getEditorElementId: () => this.textEditor?.getEditorElementId() || null,
      repositionActiveEditor: (group) => {
        this.textEditor?.repositionActiveEditor(group);
      },
      maybeStartPendingEdit: (elementId, group) => {
        this.textEditor?.maybeStartPendingEdit(elementId, group);
      },
            isPanToolActive: () => {
        const state = ctx.store.getState();
        return state?.ui?.selectedTool === "pan";
      },
    });

    // Subscribe to store changes - watch sticky-note elements AND selectedTool
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract sticky-note elements AND selectedTool (for draggable state)
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
              fill: element.fill || element.style?.fill || "#FFF59D",
              text:
                (typeof element.text === "string" ? element.text : "") ||
                (typeof element.data?.text === "string"
                  ? element.data.text
                  : "") ||
                "",
            });
          }
        }
        // CRITICAL FIX: Include selectedTool so draggable state updates when tool changes
        return { stickyNotes, selectedTool: state.ui?.selectedTool };
      },
      // Callback: reconcile changes (extract stickyNotes from returned object)
      ({ stickyNotes }) => this.renderingEngine?.reconcile(stickyNotes),
      // Options: shallow compare and fire immediately
      {
        fireImmediately: true,
        equalityFn: (
          a: { stickyNotes: Map<Id, StickySnapshot>; selectedTool?: string },
          b: { stickyNotes: Map<Id, StickySnapshot>; selectedTool?: string },
        ) => {
          // CRITICAL: Compare both stickyNotes AND selectedTool
          if (a.selectedTool !== b.selectedTool) return false;
          if (a.stickyNotes.size !== b.stickyNotes.size) return false;
          for (const [id, aSticky] of a.stickyNotes) {
            const bSticky = b.stickyNotes.get(id);
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

  /**
   * Unmount the module and cleanup
   */
  private unmount() {
    debug("Unmounting module", { category: "StickyNoteModule" });

    this.textEditor?.closeActiveEditor();
    this.textEditor?.clearPendingEdits();

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    this.renderingEngine?.destroy();

    if (this.layers) {
      this.layers.batchDraw();
    }

    // Clean up global reference
    const extendedWindow = window as ExtendedWindow;
    if (extendedWindow.stickyNoteModule === this) {
      extendedWindow.stickyNoteModule = undefined;
    }
  }

  /**
   * Public API: Start text editing for a specific element
   * Called by StickyNoteTool
   */
  public startTextEditingForElement(elementId: string) {
    debug("Public startTextEditingForElement", {
      category: "StickyNoteModule",
      data: elementId,
    });

    const nodes = this.renderingEngine?.getNodes();
    const group = nodes?.get(elementId);
    if (group) {
      this.textEditor?.startTextEditing(group, elementId);
    } else {
      debug("Group not found", {
        category: "StickyNoteModule",
        data: elementId,
      });
    }
  }

  /**
   * Public API: Trigger immediate text edit after creation
   * Called by StickyNoteTool for new sticky notes
   */
  public triggerImmediateTextEdit(elementId: string) {
    debug("triggerImmediateTextEdit called", {
      category: "StickyNoteModule",
      data: elementId,
    });
    this.textEditor?.triggerImmediateTextEdit(elementId);
  }
}
