// Table event handlers - context menu, click, drag, and cell interaction
// Extracted from TableModule.ts for better testability and separation of concerns

import Konva from "konva";
import type { TableElement } from "../../../types/table";
import type { TableCellResolver } from "./TableCellResolver";
import type { TableEditorManager } from "./TableEditorManager";
import type { TableStoreHook } from "./tableTypes";

// Extended window interface for type safety
interface TableContextMenuBridge {
  show?: (
    screenX: number,
    screenY: number,
    tableId: string,
    row: number,
    col: number,
  ) => void;
  close?: () => void;
}

interface ExtendedWindow extends Window {
  selectionModule?: {
    selectElement?: (elementId: string, options?: Record<string, unknown>) => void;
    toggleSelection?: (elementId: string, additive?: boolean) => void;
    clearSelection?: () => void;
    [key: string]: unknown;
  };
  tableContextMenu?: TableContextMenuBridge;
}

export interface TableEventCallbacks {
  getTableFromStore: (elementId: string) => TableElement | undefined;
  getStoreHook: () => TableStoreHook | undefined;
}

/**
 * TableEventHandlers manages all table and cell interactions
 * Handles context menus, clicks, double-clicks, and drag operations
 */
export class TableEventHandlers {
  private readonly cellResolver: TableCellResolver;
  private readonly editorManager: TableEditorManager;
  private readonly callbacks: TableEventCallbacks;

  constructor(
    cellResolver: TableCellResolver,
    editorManager: TableEditorManager,
    callbacks: TableEventCallbacks,
  ) {
    this.cellResolver = cellResolver;
    this.editorManager = editorManager;
    this.callbacks = callbacks;
  }

  /**
   * Try to show the table context menu for a specific cell
   */
  tryShowContextMenu(
    tableId: string,
    row: number,
    col: number,
    event: MouseEvent,
  ): boolean {
    const bridge = (window as ExtendedWindow).tableContextMenu;
    if (!bridge?.show) return false;
    bridge.show(event.clientX, event.clientY, tableId, row, col);
    return true;
  }

  /**
   * Add clickable areas for each table cell with interaction handlers
   */
  addCellClickAreas(group: Konva.Group, el: TableElement): void {
    const { rows, cols, colWidths, rowHeights } = el;

    let yPos = 0;
    for (let row = 0; row < rows; row++) {
      let xPos = 0;
      for (let col = 0; col < cols; col++) {
        const cellWidth = colWidths[col];
        const cellHeight = rowHeights[row];

        // Create invisible clickable area for each cell
        const clickArea = new Konva.Rect({
          x: xPos,
          y: yPos,
          width: cellWidth,
          height: cellHeight,
          fill: "transparent",
          listening: true,
          name: "cell-clickable",
          perfectDrawEnabled: false,
        });

        // Context menu handling - attempt direct table menu invocation first
        clickArea.on("contextmenu", (evt) => {
          evt.evt.preventDefault();

          const mouseEvt = evt.evt as MouseEvent;
          const handled = this.tryShowContextMenu(el.id, row, col, mouseEvt);
          if (handled) {
            evt.cancelBubble = true;
            return;
          }

          // Fallback to stage-level handling if global bridge unavailable
          evt.cancelBubble = false;
        });

        // Double-click to edit using the tracked editor for live resize support
        clickArea.on("dblclick", (e) => {
          e.cancelBubble = true; // Prevent stage events for editing

          const stage = group.getStage();
          if (stage) {
            this.editorManager.openEditor({
              stage,
              elementId: el.id,
              element: el,
              row,
              col,
            });
          }
        });

        // Visual feedback for cell interaction
        clickArea.on("mouseenter", () => {
          const stage = group.getStage();
          if (stage?.container()) {
            stage.container().style.cursor = "text";
          }
        });

        clickArea.on("mouseleave", () => {
          const stage = group.getStage();
          if (stage?.container()) {
            stage.container().style.cursor = "default";
          }
        });

        group.add(clickArea);
        xPos += cellWidth;
      }
      yPos += rowHeights[row];
    }
  }

  /**
   * Setup table-level interaction handlers (selection, drag, context menu)
   */
  setupTableInteractions(group: Konva.Group, elementId: string): void {
    // Get reference to SelectionModule for proper selection integration
    const getSelectionModule = () => (window as ExtendedWindow).selectionModule;

    // Context menu handler for the table group
    group.on("contextmenu", (e) => {
      // Prevent position jumping during context menu
      e.evt.preventDefault();

      const mouseEvt = e.evt as MouseEvent;
      const stage = group.getStage();
      const table = this.callbacks.getTableFromStore(elementId);

      if (stage && table) {
        stage.setPointersPositions(mouseEvt);
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const local = group
            .getAbsoluteTransform()
            .copy()
            .invert()
            .point(pointer);
          const coords = this.cellResolver.resolveCellFromLocal(
            table,
            local.x,
            local.y,
          );
          const handled = this.tryShowContextMenu(
            elementId,
            coords.row,
            coords.col,
            mouseEvt,
          );
          if (handled) {
            e.cancelBubble = true;
            return;
          }
        }
      }

      e.cancelBubble = false; // Allow bubbling to stage for context menu handling

      // Store the current position to prevent any updates during context menu
      const currentPos = group.position();
      group.setAttr("_contextMenuPosition", currentPos);
    });

    // Enhanced click handler for selection
    group.on("click tap", (e) => {
      // Don't interfere with transformer handle clicks
      const isTransformerClick =
        e.target?.getParent()?.className === "Transformer" ||
        e.target?.className === "Transformer";
      if (!isTransformerClick) {
        e.cancelBubble = true; // Prevent stage click
      }

      const selectionModule = getSelectionModule();
      if (selectionModule) {
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
        if (isAdditive) {
          if (selectionModule.toggleSelection) {
            selectionModule.toggleSelection(elementId);
          } else if (selectionModule.selectElement) {
            selectionModule.selectElement(elementId);
          }
        } else {
          selectionModule.selectElement?.(elementId);
        }
      } else {
        // Fallback to direct store integration
        const storeHook = this.callbacks.getStoreHook();
        if (!storeHook) return;

        const store = storeHook.getState();
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;

        if (store.setSelection) {
          if (isAdditive) {
            const current = store.selectedElementIds || new Set();
            const newSelection = new Set(current);
            if (newSelection.has(elementId)) {
              newSelection.delete(elementId);
            } else {
              newSelection.add(elementId);
            }
            store.setSelection(Array.from(newSelection));
          } else {
            store.setSelection([elementId]);
          }
        } else if (store.selection) {
          if (isAdditive) {
            store.selection.toggle?.(elementId);
          } else {
            store.selection.set?.([elementId]);
          }
        }
      }
    });

    // Enhanced drag handling to prevent position drift
    group.on("dragend", () => {
      const newPos = group.position();
      const storeHook = this.callbacks.getStoreHook();
      if (storeHook) {
        const state = storeHook.getState();
        // Update store with exact final position
        state.element.update(elementId, {
          x: newPos.x,
          y: newPos.y,
        } as Partial<TableElement>);
      }
    });
  }
}
