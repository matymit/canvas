// Table cell resolution logic - coordinate calculations and hit testing
// Extracted from TableModule.ts for better testability and separation of concerns

import type { TableElement } from "../../../types/table";

export interface CellCoordinate {
  row: number;
  col: number;
}

export interface CellBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * TableCellResolver handles all cell coordinate calculations and hit testing
 * Pure functions with no side effects - easy to test and reason about
 */
export class TableCellResolver {
  /**
   * Convert local table coordinates to cell row/column
   * @param table - Table element with row/column configuration
   * @param localX - X coordinate relative to table origin
   * @param localY - Y coordinate relative to table origin
   * @returns Cell coordinates (row, col)
   */
  resolveCellFromLocal(
    table: TableElement,
    localX: number,
    localY: number,
  ): CellCoordinate {
    // Find column
    let cumulativeX = 0;
    let col = 0;
    for (let c = 0; c < table.cols; c++) {
      const width = table.colWidths[c] ?? 0;
      const next = cumulativeX + width;
      if (localX >= cumulativeX && localX <= next) {
        col = c;
        break;
      }
      col = c;
      cumulativeX = next;
    }

    // Clamp column to valid range
    if (localX < 0) {
      col = 0;
    } else if (localX > cumulativeX) {
      col = table.cols - 1;
    }

    // Find row
    let cumulativeY = 0;
    let row = 0;
    for (let r = 0; r < table.rows; r++) {
      const height = table.rowHeights[r] ?? 0;
      const next = cumulativeY + height;
      if (localY >= cumulativeY && localY <= next) {
        row = r;
        break;
      }
      row = r;
      cumulativeY = next;
    }

    // Clamp row to valid range
    if (localY < 0) {
      row = 0;
    } else if (localY > cumulativeY) {
      row = table.rows - 1;
    }

    return {
      row: Math.max(0, Math.min(table.rows - 1, row)),
      col: Math.max(0, Math.min(table.cols - 1, col)),
    };
  }

  /**
   * Get the bounds of a specific cell in local table coordinates
   * @param table - Table element
   * @param row - Row index
   * @param col - Column index
   * @returns Cell bounds { x, y, width, height }
   */
  getCellBounds(table: TableElement, row: number, col: number): CellBounds {
    let x = 0;
    for (let c = 0; c < col; c++) {
      x += table.colWidths[c] ?? 0;
    }

    let y = 0;
    for (let r = 0; r < row; r++) {
      y += table.rowHeights[r] ?? 0;
    }

    const width = table.colWidths[col] ?? 0;
    const height = table.rowHeights[row] ?? 0;

    return { x, y, width, height };
  }

  /**
   * Get the total bounds of the entire table
   * @param table - Table element
   * @returns Table bounds { x: 0, y: 0, width, height }
   */
  getTableBounds(table: TableElement): CellBounds {
    const width = table.colWidths.reduce((sum: number, w: number) => sum + w, 0);
    const height = table.rowHeights.reduce((sum: number, h: number) => sum + h, 0);
    return { x: 0, y: 0, width, height };
  }

  /**
   * Get the height of a specific row
   * @param table - Table element
   * @param row - Row index
   * @returns Row height in pixels
   */
  getRowHeight(table: TableElement, row: number): number {
    return table.rowHeights[row] ?? 0;
  }

  /**
   * Get the width of a specific column
   * @param table - Table element
   * @param col - Column index
   * @returns Column width in pixels
   */
  getColumnWidth(table: TableElement, col: number): number {
    return table.colWidths[col] ?? 0;
  }
}
