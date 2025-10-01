// StickyEventHandlers.ts
// Event handling for sticky note interactions

import type Konva from "konva";
import type { ModuleRendererCtx } from "../../index";
import type { CanvasElement, ElementId } from "../../../../../../types";
import { debug } from "../../../../../utils/debug";

interface SelectionModuleLike {
  selectElement?: (elementId: string, options?: Record<string, unknown>) => void;
  toggleSelection?: (elementId: string, additive?: boolean) => void;
  clearSelection?: () => void;
  [key: string]: unknown;
}

interface ExtendedWindow extends Window {
  selectionModule?: SelectionModuleLike;
}

export interface StickyEventHandlersOptions {
  getStoreContext: () => ModuleRendererCtx | undefined;
  startTextEditing: (group: Konva.Group, elementId: string) => void;
  getActiveEditor: () => HTMLTextAreaElement | null;
}

// Get reference to SelectionModule
function getSelectionModule(): SelectionModuleLike | undefined {
  return (window as ExtendedWindow).selectionModule;
}

/**
 * Event handlers subsystem for sticky notes
 * Handles click, drag, transform, and hover interactions
 */
export class StickyEventHandlers {
  private readonly options: StickyEventHandlersOptions;

  constructor(options: StickyEventHandlersOptions) {
    this.options = options;
  }

  /**
   * Setup all interaction handlers for a sticky note group
   */
  setupStickyInteractions(group: Konva.Group, elementId: string): void {
    // Click handler for selection
    group.on("click tap", (e) => {
      // Don't cancel bubble if clicking transformer
      const isTransformerClick =
        e.target?.getParent()?.className === "Transformer" ||
        e.target?.className === "Transformer";
      if (!isTransformerClick) {
        e.cancelBubble = true;
      }

      debug("Click on sticky note", {
        category: "StickyNoteModule",
        data: elementId,
      });

      const selectionModule = getSelectionModule();
      if (selectionModule) {
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
        selectionModule.selectElement?.(elementId, { autoFocus: !isAdditive });
      } else {
        // Fallback to direct store integration
        this.handleFallbackSelection(elementId, e.evt);
      }
    });

    // Drag handlers
    this.setupDragHandlers(group, elementId);

    // Transform handlers
    this.setupTransformHandlers(group, elementId);

    // Double-click to edit text
    group.on("dblclick dbltap", (e) => {
      e.cancelBubble = true;
      debug("Double-click - starting text editing", {
        category: "StickyNoteModule",
        data: elementId,
      });
      this.options.startTextEditing(group, elementId);
    });

    // Hover effects
    group.on("mouseenter", () => {
      if (!this.options.getActiveEditor()) {
        document.body.style.cursor = "move";
      }
    });

    group.on("mouseleave", () => {
      if (!this.options.getActiveEditor()) {
        document.body.style.cursor = "default";
      }
    });
  }

  /**
   * Fallback selection when SelectionModule is not available
   */
  private handleFallbackSelection(elementId: string, evt: MouseEvent | PointerEvent): void {
    debug("No SelectionModule, using fallback", {
      category: "StickyNoteModule",
    });

    const storeCtx = this.options.getStoreContext();
    if (!storeCtx) return;

  const store = storeCtx.store.getState();
    const isAdditive = evt.ctrlKey || evt.metaKey || evt.shiftKey;

  if ("setSelection" in store && typeof store.setSelection === "function") {
      if (isAdditive) {
        const current =
          ("selectedElementIds" in store
            ? store.selectedElementIds
            : new Set<ElementId>()) || new Set<ElementId>();
        const newSelection = new Set(current as Iterable<ElementId>);
        if (newSelection.has(elementId)) {
          newSelection.delete(elementId);
        } else {
          newSelection.add(elementId);
        }
        store.setSelection(Array.from(newSelection));
      } else {
        store.setSelection([elementId]);
      }
    } else if ("selection" in store && store.selection) {
      const selection = store.selection as {
        toggle?: (id: string) => void;
        set?: (ids: string[]) => void;
      };
      if (isAdditive) {
        selection.toggle?.(elementId);
      } else {
        selection.set?.([elementId]);
      }
    }
  }

  /**
   * Setup drag event handlers
   */
  private setupDragHandlers(group: Konva.Group, elementId: string): void {
    let dragStartData: {
      x: number;
      y: number;
      storeX: number;
      storeY: number;
    } | null = null;

    group.on("dragstart", () => {
      const groupPos = group.position();
      const storeCtx = this.options.getStoreContext();
      const store = storeCtx?.store.getState();
      const element = store?.elements?.get?.(elementId as ElementId) as
        | CanvasElement
        | undefined;

      dragStartData = {
        x: groupPos.x,
        y: groupPos.y,
        storeX: element?.x || 0,
        storeY: element?.y || 0,
      };
    });

    group.on("dragend", () => {
      const storeCtx = this.options.getStoreContext();
      if (!storeCtx || !dragStartData) return;

      const pos = group.position();
  const store = storeCtx.store.getState();

      // Only update if position actually changed
      const deltaX = Math.abs(pos.x - dragStartData.storeX);
      const deltaY = Math.abs(pos.y - dragStartData.storeY);

      if (deltaX > 1 || deltaY > 1) {
        const withUndo =
          store.history?.withUndo?.bind(store.history) ?? store.withUndo;
        const updateElement = store.element?.update ?? store.updateElement;

        if (updateElement) {
          const updateFn = () => {
            updateElement?.(elementId, {
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

      dragStartData = null;
    });
  }

  /**
   * Setup transform event handlers for resize operations
   */
  private setupTransformHandlers(group: Konva.Group, elementId: string): void {
    let transformStartData: {
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      storeWidth: number;
      storeHeight: number;
      aspectRatio: number;
    } | null = null;

    group.on("transformstart", () => {
      const storeCtx = this.options.getStoreContext();
      const store = storeCtx?.store.getState();
      const element = store?.elements?.get?.(elementId as ElementId) as
        | CanvasElement
        | undefined;

      if (element) {
        const width = element.width ?? group.width() ?? 240;
        const height = element.height ?? group.height() ?? 180;
        transformStartData = {
          width,
          height,
          scaleX: group.scaleX() || 1,
          scaleY: group.scaleY() || 1,
          storeWidth: width,
          storeHeight: height,
          aspectRatio: width / height,
        };
      }
    });

    group.on("transformend", () => {
      const storeCtx = this.options.getStoreContext();
      if (!storeCtx || !transformStartData) return;

      const startData = transformStartData;
  const store = storeCtx.store.getState();

      // Calculate dimensions correctly using group's scale
      const scaleX = group.scaleX() || 1;
      const scaleY = group.scaleY() || 1;
      const newWidth = Math.max(50, Math.round(startData.width * scaleX));
      const newHeight = Math.max(50, Math.round(startData.height * scaleY));

      // Only update if size actually changed
      const deltaWidth = Math.abs(newWidth - startData.storeWidth);
      const deltaHeight = Math.abs(newHeight - startData.storeHeight);

      if (deltaWidth > 0 || deltaHeight > 0) {
        const withUndo =
          store.history?.withUndo?.bind(store.history) ?? store.withUndo;
        const updateElement = store.element?.update ?? store.updateElement;

        if (updateElement) {
          const updateFn = () => {
            const aspectRatio = startData.aspectRatio || 1;
            let constrainedWidth = newWidth;
            let constrainedHeight = newHeight;

            if (aspectRatio > 0) {
              const widthDelta = Math.abs(newWidth - startData.storeWidth);
              const heightDelta = Math.abs(newHeight - startData.storeHeight);
              if (widthDelta >= heightDelta) {
                constrainedHeight = Math.max(
                  50,
                  Math.round(constrainedWidth / aspectRatio),
                );
              } else {
                constrainedWidth = Math.max(
                  50,
                  Math.round(constrainedHeight * aspectRatio),
                );
              }
            }

            // Update width and height, preserve position
            updateElement?.(elementId, {
              width: constrainedWidth,
              height: constrainedHeight,
              keepAspectRatio: true,
            });

            // Reset scale to 1 to prevent accumulation
            group.scaleX(1);
            group.scaleY(1);
            group.width(constrainedWidth);
            group.height(constrainedHeight);
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
  }
}
