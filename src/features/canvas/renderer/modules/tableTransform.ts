// Table transform helper for proportional resize handling
// Used by TransformerManager when table elements are resized

import type { TableElement } from "../../types/elements/table";
import { DEFAULT_TABLE_CONFIG } from "../../types/elements/table";

/**
 * Apply proportional resize to a table element
 * Scales column widths and row heights proportionally while maintaining constraints
 */
export function applyTableResize(
  element: TableElement, 
  newWidth: number, 
  newHeight: number
): TableElement {
  const { minCellWidth, minCellHeight } = DEFAULT_TABLE_CONFIG;
  
  // Calculate scale factors
  const wScale = newWidth / Math.max(1, element.width);
  const hScale = newHeight / Math.max(1, element.height);
  
  // Scale column widths proportionally with minimum constraints
  const colWidths = element.colWidths.map(w => {
    const scaledWidth = Math.round(w * wScale);
    return Math.max(minCellWidth, scaledWidth);
  });
  
  // Scale row heights proportionally with minimum constraints  
  const rowHeights = element.rowHeights.map(h => {
    const scaledHeight = Math.round(h * hScale);
    return Math.max(minCellHeight, scaledHeight);
  });
  
  // Calculate actual dimensions after constraint application
  const actualWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const actualHeight = rowHeights.reduce((sum, h) => sum + h, 0);
  
  return {
    ...element,
    width: actualWidth,
    height: actualHeight,
    colWidths,
    rowHeights,
  };
}

/**
 * Apply table resize while maintaining aspect ratio
 * Useful for uniform scaling operations
 */
export function applyTableResizeUniform(
  element: TableElement,
  newWidth: number,
  newHeight: number,
  maintainAspect: boolean = false
): TableElement {
  if (!maintainAspect) {
    return applyTableResize(element, newWidth, newHeight);
  }
  
  // Maintain aspect ratio by using the smaller scale factor
  const wScale = newWidth / element.width;
  const hScale = newHeight / element.height;
  const scale = Math.min(wScale, hScale);
  
  const scaledWidth = Math.round(element.width * scale);
  const scaledHeight = Math.round(element.height * scale);
  
  return applyTableResize(element, scaledWidth, scaledHeight);
}

/**
 * Resize specific columns in a table
 * Used for interactive column resizing
 */
export function resizeTableColumns(
  element: TableElement,
  columnIndex: number,
  newWidth: number
): TableElement {
  const { minCellWidth } = DEFAULT_TABLE_CONFIG;
  const constrainedWidth = Math.max(minCellWidth, newWidth);
  
  const newColWidths = [...element.colWidths];
  newColWidths[columnIndex] = constrainedWidth;
  
  const newTotalWidth = newColWidths.reduce((sum, w) => sum + w, 0);
  
  return {
    ...element,
    width: newTotalWidth,
    colWidths: newColWidths,
  };
}

/**
 * Resize specific rows in a table
 * Used for interactive row resizing
 */
export function resizeTableRows(
  element: TableElement,
  rowIndex: number,
  newHeight: number
): TableElement {
  const { minCellHeight } = DEFAULT_TABLE_CONFIG;
  const constrainedHeight = Math.max(minCellHeight, newHeight);
  
  const newRowHeights = [...element.rowHeights];
  newRowHeights[rowIndex] = constrainedHeight;
  
  const newTotalHeight = newRowHeights.reduce((sum, h) => sum + h, 0);
  
  return {
    ...element,
    height: newTotalHeight,
    rowHeights: newRowHeights,
  };
}

/**
 * Add a new column to the table
 */
export function addTableColumn(
  element: TableElement,
  insertIndex?: number
): TableElement {
  const insertAt = insertIndex ?? element.cols;
  const newColWidth = Math.round(element.width / (element.cols + 1));
  
  // Insert new column width
  const newColWidths = [...element.colWidths];
  newColWidths.splice(insertAt, 0, newColWidth);
  
  // Insert empty cells for the new column
  const newCells = [...element.cells];
  for (let row = 0; row < element.rows; row++) {
    const cellIndex = row * element.cols + insertAt;
    const adjustedIndex = row * (element.cols + 1) + insertAt;
    newCells.splice(adjustedIndex, 0, { text: "" });
  }
  
  return {
    ...element,
    cols: element.cols + 1,
    width: newColWidths.reduce((sum, w) => sum + w, 0),
    colWidths: newColWidths,
    cells: newCells,
  };
}

/**
 * Add a new row to the table
 */
export function addTableRow(
  element: TableElement,
  insertIndex?: number
): TableElement {
  const insertAt = insertIndex ?? element.rows;
  const newRowHeight = Math.round(element.height / (element.rows + 1));
  
  // Insert new row height
  const newRowHeights = [...element.rowHeights];
  newRowHeights.splice(insertAt, 0, newRowHeight);
  
  // Insert empty cells for the new row
  const newCells = [...element.cells];
  const insertCellIndex = insertAt * element.cols;
  const emptyCells = Array.from({ length: element.cols }, () => ({ text: "" }));
  newCells.splice(insertCellIndex, 0, ...emptyCells);
  
  return {
    ...element,
    rows: element.rows + 1,
    height: newRowHeights.reduce((sum, h) => sum + h, 0),
    rowHeights: newRowHeights,
    cells: newCells,
  };
}

/**
 * Remove a column from the table
 */
export function removeTableColumn(
  element: TableElement,
  columnIndex: number
): TableElement {
  if (element.cols <= 1) return element; // Can't remove last column
  
  // Remove column width
  const newColWidths = element.colWidths.filter((_, i) => i !== columnIndex);
  
  // Remove cells in the column
  const newCells = [];
  for (let row = 0; row < element.rows; row++) {
    for (let col = 0; col < element.cols; col++) {
      if (col !== columnIndex) {
        const cellIndex = row * element.cols + col;
        newCells.push(element.cells[cellIndex]);
      }
    }
  }
  
  return {
    ...element,
    cols: element.cols - 1,
    width: newColWidths.reduce((sum, w) => sum + w, 0),
    colWidths: newColWidths,
    cells: newCells,
  };
}

/**
 * Remove a row from the table
 */
export function removeTableRow(
  element: TableElement,
  rowIndex: number
): TableElement {
  if (element.rows <= 1) return element; // Can't remove last row
  
  // Remove row height
  const newRowHeights = element.rowHeights.filter((_, i) => i !== rowIndex);
  
  // Remove cells in the row
  const newCells = [...element.cells];
  const startIndex = rowIndex * element.cols;
  newCells.splice(startIndex, element.cols);
  
  return {
    ...element,
    rows: element.rows - 1,
    height: newRowHeights.reduce((sum, h) => sum + h, 0),
    rowHeights: newRowHeights,
    cells: newCells,
  };
}