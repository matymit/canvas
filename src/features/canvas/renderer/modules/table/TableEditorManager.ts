// Table cell editor management - handles cell editing lifecycle and auto-resize
// Extracted from TableModule.ts for better testability and separation of concerns

import type Konva from "konva";
import type { TableElement } from "../../../types/table";
import { DEFAULT_TABLE_CONFIG } from "../../../types/table";
import {
  openCellEditorWithTracking,
} from "../../../utils/editors/openCellEditorWithTracking";
import type { TableCellSizeChangePayload } from "../../../utils/editors/openCellEditorWithTracking";
import type { TableStoreHook } from "./tableTypes";

export interface TableEditorCallbacks {
  getTableFromStore: (elementId: string) => TableElement | undefined;
  getStoreHook: () => TableStoreHook | undefined;
}

export interface OpenEditorOptions {
  stage: Konva.Stage;
  elementId: string;
  element: TableElement;
  row: number;
  col: number;
}

/**
 * TableEditorManager handles all cell editing operations
 * Manages editor lifecycle, text commits, and auto-resize behavior
 */
export class TableEditorManager {
  private isUpdatingTransformer = false;
  private readonly callbacks: TableEditorCallbacks;

  constructor(callbacks: TableEditorCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Open the cell editor for a specific cell
   */
  openEditor(options: OpenEditorOptions): void {
    const { stage, elementId, element, row, col } = options;

    openCellEditorWithTracking({
      stage,
      elementId,
      element,
      getElement: () => {
        const store = this.callbacks.getStoreHook();
        if (!store) return element;
        const latest = store.getState().element.getById(elementId);
        return (latest && latest.type === "table" ? latest : element) as TableElement;
      },
      row,
      col,
      onCommit: (value: string, tableId: string, commitRow: number, commitCol: number) =>
        this.commitCellText(tableId, commitRow, commitCol, value),
      onSizeChange: (payload: TableCellSizeChangePayload) =>
        this.handleCellAutoResize(payload),
    });
  }

  /**
   * Commit edited text to a table cell
   */
  commitCellText(
    elementId: string,
    row: number,
    col: number,
    value: string,
  ): void {
    const storeHook = this.callbacks.getStoreHook();
    if (!storeHook) return;

    const runUpdate = () => {
      const state = storeHook.getState();
      const current = state.element.getById?.(elementId) as
        | TableElement
        | undefined;
      if (!current || current.type !== "table") return;

      const idx = row * current.cols + col;
      const cells = current.cells.slice();
      const existing = cells[idx] ?? { text: "" };
      if (existing.text === value) return;

      cells[idx] = { ...existing, text: value };

      // CRITICAL FIX: Preserve position during cell text updates to prevent jumping
      state.element.update(elementId, {
        cells,
        // Explicitly preserve position to prevent jumping
        x: current.x,
        y: current.y,
      } as Partial<TableElement>);
    };

    const state = storeHook.getState();
    const history = state.history;

    if (history?.withUndo) {
      history.withUndo("Edit table cell", () => {
        runUpdate();
      });
    } else {
      runUpdate();
    }
  }

  /**
   * Handle automatic cell resize when content requires more space
   */
  handleCellAutoResize(payload: TableCellSizeChangePayload): void {
    const storeHook = this.callbacks.getStoreHook();
    if (!storeHook) return;

    const { elementId, row, col, requiredWidth, requiredHeight } = payload;
    if (!Number.isFinite(requiredWidth) || !Number.isFinite(requiredHeight))
      return;

    const state = storeHook.getState();
    const table = state.element.getById?.(elementId) as
      | TableElement
      | undefined;
    if (!table || table.type !== "table") return;

    const currentColWidths = table.colWidths.slice();
    const currentRowHeights = table.rowHeights.slice();

    const minWidth = DEFAULT_TABLE_CONFIG.minCellWidth;
    const minHeight = DEFAULT_TABLE_CONFIG.minCellHeight;

    const targetWidth = Math.max(
      currentColWidths[col] || 0,
      requiredWidth,
      minWidth,
    );
    const targetHeight = Math.max(
      currentRowHeights[row] || 0,
      requiredHeight,
      minHeight,
    );

    const widthChanged = targetWidth - (currentColWidths[col] || 0) > 0.5;
    const heightChanged = targetHeight - (currentRowHeights[row] || 0) > 0.5;

    if (!widthChanged && !heightChanged) return;

    // CRITICAL FIX: Store exact current position BEFORE making any updates
    const preservedPosition = { x: table.x, y: table.y };

    const patch: Partial<TableElement> = {
      // ALWAYS preserve exact position during auto-resize
      x: preservedPosition.x,
      y: preservedPosition.y,
    };

    if (widthChanged) {
      currentColWidths[col] = targetWidth;
      patch.colWidths = currentColWidths;
      patch.width = currentColWidths.reduce((sum: number, w: number) => sum + w, 0);
    }

    if (heightChanged) {
      currentRowHeights[row] = targetHeight;
      patch.rowHeights = currentRowHeights;
      patch.height = currentRowHeights.reduce((sum: number, h: number) => sum + h, 0);
    }

    // Update with position preservation and no immediate transformer refresh
    state.element.update(elementId, patch as Partial<TableElement>);

    // Only refresh transformer if selected, with debouncing to prevent loops
    const selectedIds = state.selectedElementIds || new Set<string>();
    if (
      selectedIds.has &&
      selectedIds.has(elementId) &&
      !this.isUpdatingTransformer
    ) {
      this.isUpdatingTransformer = true;
      const bumpVersion = state.bumpSelectionVersion;
      if (typeof bumpVersion === "function") {
        // Debounced transformer refresh to prevent update loops
        setTimeout(() => {
          try {
            bumpVersion();
          } finally {
            this.isUpdatingTransformer = false;
          }
        }, 100);
      } else {
        this.isUpdatingTransformer = false;
      }
    }
  }
}
