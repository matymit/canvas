// Table context menu helper to prevent position jumping and handle right-click events properly
// Integrates with existing context menu system while preserving table position

import type Konva from "konva";
import type { TableElement } from "../../types/table";

export interface TableContextMenuOptions {
  onAddRow?: (elementId: string, insertIndex?: number) => void;
  onAddColumn?: (elementId: string, insertIndex?: number) => void;
  onDeleteRow?: (elementId: string, rowIndex: number) => void;
  onDeleteColumn?: (elementId: string, columnIndex: number) => void;
  onTableProperties?: (elementId: string) => void;
  onDelete?: (elementId: string) => void;
}

/**
 * Helper class to manage table context menu interactions without position jumping
 */
export class TableContextMenuHelper {
  private element: TableElement;
  private readonly tableGroup: Konva.Group;
  private readonly options: TableContextMenuOptions;
  private preservedPosition?: { x: number; y: number };

  constructor(
    element: TableElement,
    tableGroup: Konva.Group,
    options: TableContextMenuOptions = {},
  ) {
    this.element = element;
    this.tableGroup = tableGroup;
    this.options = options;

    this.setupContextMenuHandling();
  }

  /**
   * Update the element reference when table data changes
   */
  updateElement(element: TableElement) {
    this.element = element;
  }

  /**
   * Setup context menu event handlers
   */
  private setupContextMenuHandling() {
    // Handle context menu on the table group
    this.tableGroup.on("contextmenu", (e) => {
      this.handleTableContextMenu(e);
    });

    // Handle context menu on cell areas (if they exist)
    this.tableGroup.on(
      "contextmenu",
      (e: Konva.KonvaEventObject<MouseEvent>) => {
        // Check if the target is a cell-clickable
        if (e.target?.name() === "cell-clickable") {
          this.handleCellContextMenu(e);
        }
      },
    );
  }

  /**
   * Handle context menu on the table group itself
   */
  private handleTableContextMenu(e: Konva.KonvaEventObject<MouseEvent>) {

    // CRITICAL: Preserve position before any context menu operations
    this.preservePosition();

    // Prevent default browser context menu
    e.evt.preventDefault();

    // Allow event to bubble to stage for global context menu handling
    e.cancelBubble = false;

    // Set up restoration after context menu closes
    this.schedulePositionRestoration();
  }

  /**
   * Handle context menu on specific cells
   */
  private handleCellContextMenu(e: Konva.KonvaEventObject<MouseEvent>) {
    const cellNode = e.target;
    if (!cellNode || cellNode.name() !== "cell-clickable") return;

    // Get cell coordinates from the node position
    const cellX = cellNode.x();
    const cellY = cellNode.y();

    // Calculate which row/column this cell belongs to
    const { row, col } = this.getCellCoordinates(cellX, cellY);


    // CRITICAL: Preserve position before context menu operations
    this.preservePosition();

    // Prevent default and allow bubbling for global context menu
    e.evt.preventDefault();
    e.cancelBubble = false;

    // Add cell-specific context menu data to the event
    (e.evt as Event & { tableContextData?: Record<string, unknown> }).tableContextData = {
      elementId: this.element.id,
      elementType: "table",
      cellRow: row,
      cellCol: col,
      actions: this.getCellContextMenuActions(row, col),
    };

    this.schedulePositionRestoration();
  }

  /**
   * Preserve the current table position
   */
  private preservePosition() {
    this.preservedPosition = {
      x: this.tableGroup.x(),
      y: this.tableGroup.y(),
    };

    // Also store in the group for external access
    this.tableGroup.setAttr("_preservedPosition", this.preservedPosition);
  }

  /**
   * Restore the preserved position if it was changed
   */
  private restorePosition() {
    if (!this.preservedPosition) return;

    const currentPos = this.tableGroup.position();
    const { x: preservedX, y: preservedY } = this.preservedPosition;

    // Check if position has drifted
    const positionDrift =
      Math.abs(currentPos.x - preservedX) > 0.1 ||
      Math.abs(currentPos.y - preservedY) > 0.1;

    if (positionDrift) {

      this.tableGroup.position(this.preservedPosition);
      this.tableGroup.getLayer()?.batchDraw();
    }

    // Clear preserved position
    this.preservedPosition = undefined;
    this.tableGroup.setAttr("_preservedPosition", null);
  }

  /**
   * Schedule position restoration after context menu operations
   */
  private schedulePositionRestoration() {
    // Restore position after a short delay to allow context menu to process
    setTimeout(() => {
      this.restorePosition();
    }, 50);

    // Also restore on next animation frame as a backup
    requestAnimationFrame(() => {
      this.restorePosition();
    });
  }

  /**
   * Calculate row/column coordinates from pixel position
   */
  private getCellCoordinates(
    x: number,
    y: number,
  ): { row: number; col: number } {
    let currentX = 0;
    let currentY = 0;
    let col = 0;
    let row = 0;

    // Find column
    for (let c = 0; c < this.element.colWidths.length; c++) {
      if (x >= currentX && x < currentX + this.element.colWidths[c]) {
        col = c;
        break;
      }
      currentX += this.element.colWidths[c];
    }

    // Find row
    for (let r = 0; r < this.element.rowHeights.length; r++) {
      if (y >= currentY && y < currentY + this.element.rowHeights[r]) {
        row = r;
        break;
      }
      currentY += this.element.rowHeights[r];
    }

    return { row, col };
  }

  /**
   * Get context menu actions for a specific cell
   */
  private getCellContextMenuActions(row: number, col: number) {
    return {
      addRowAbove: () => this.options.onAddRow?.(this.element.id, row),
      addRowBelow: () => this.options.onAddRow?.(this.element.id, row + 1),
      addColumnLeft: () => this.options.onAddColumn?.(this.element.id, col),
      addColumnRight: () =>
        this.options.onAddColumn?.(this.element.id, col + 1),
      deleteRow:
        this.element.rows > 1
          ? () => this.options.onDeleteRow?.(this.element.id, row)
          : undefined,
      deleteColumn:
        this.element.cols > 1
          ? () => this.options.onDeleteColumn?.(this.element.id, col)
          : undefined,
      tableProperties: () => this.options.onTableProperties?.(this.element.id),
      deleteTable: () => this.options.onDelete?.(this.element.id),
    };
  }

  /**
   * Get table-level context menu actions
   */
  getTableContextMenuActions() {
    return {
      addRow: () => this.options.onAddRow?.(this.element.id),
      addColumn: () => this.options.onAddColumn?.(this.element.id),
      tableProperties: () => this.options.onTableProperties?.(this.element.id),
      deleteTable: () => this.options.onDelete?.(this.element.id),
    };
  }

  /**
   * Force position restoration (can be called externally)
   */
  forceRestorePosition() {
    this.restorePosition();
  }

  /**
   * Check if position is currently preserved
   */
  hasPreservedPosition(): boolean {
    return this.preservedPosition !== undefined;
  }

  /**
   * Clean up event handlers
   */
  destroy() {
    this.tableGroup.off("contextmenu");
    this.preservedPosition = undefined;
  }
}

/**
 * Factory function to create a table context menu helper
 */
export function createTableContextMenuHelper(
  element: TableElement,
  tableGroup: Konva.Group,
  options: TableContextMenuOptions = {},
): TableContextMenuHelper {
  return new TableContextMenuHelper(element, tableGroup, options);
}

/**
 * Utility to check if a Konva event has table context data
 */
export function getTableContextData(event: Event): {
  elementId: string;
  elementType: string;
  cellRow?: number;
  cellCol?: number;
  actions?: Record<string, unknown>[];
} | null {
  const data = (event as Event & { tableContextData?: Record<string, unknown> }).tableContextData;

  // Type guard to ensure data has required properties
  if (data &&
      typeof data === 'object' &&
      'elementId' in data &&
      'elementType' in data &&
      typeof data.elementId === 'string' &&
      typeof data.elementType === 'string') {
    return {
      elementId: data.elementId,
      elementType: data.elementType,
      cellRow: typeof data.cellRow === 'number' ? data.cellRow : undefined,
      cellCol: typeof data.cellCol === 'number' ? data.cellCol : undefined,
      actions: Array.isArray(data.actions) ? data.actions : undefined
    };
  }

  return null;
}

/**
 * Utility to prevent position jumping during any table operation
 */
export function withPositionPreservation<T>(
  tableGroup: Konva.Group,
  operation: () => T,
): T {
  const originalPos = tableGroup.position();

  try {
    const result = operation();

    // Restore position if it changed
    const newPos = tableGroup.position();
    if (
      Math.abs(newPos.x - originalPos.x) > 0.1 ||
      Math.abs(newPos.y - originalPos.y) > 0.1
    ) {
      tableGroup.position(originalPos);
    }

    return result;
  } catch (error) {
    // Restore position even if operation failed
    tableGroup.position(originalPos);
    throw error;
  }
}
