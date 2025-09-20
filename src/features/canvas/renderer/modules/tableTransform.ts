// Table transform helper for proportional resize handling
// Used by TransformerManager when table elements are resized
// Enhanced with aspect ratio locking and cell integrity preservation

import type { TableElement } from "../../types/table";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";

/**
 * Apply proportional resize to a table element with aspect ratio options
 * Scales column widths and row heights proportionally while maintaining constraints
 * @param element - The table element to resize
 * @param newWidth - Target width
 * @param newHeight - Target height  
 * @param options - Resize options including aspect ratio locking
 */
export function applyTableResize(
  element: TableElement, 
  newWidth: number, 
  newHeight: number,
  options: {
    keepAspectRatio?: boolean;
    lockToWidth?: boolean; // When true with keepAspectRatio, height follows width
    lockToHeight?: boolean; // When true with keepAspectRatio, width follows height
  } = {}
): TableElement {
  const { minCellWidth, minCellHeight } = DEFAULT_TABLE_CONFIG;
  
  // Handle aspect ratio locking
  if (options.keepAspectRatio) {
    const originalAspect = element.width / element.height;
    
    if (options.lockToWidth) {
      // Height follows width to maintain aspect ratio
      newHeight = newWidth / originalAspect;
    } else if (options.lockToHeight) {
      // Width follows height to maintain aspect ratio
      newWidth = newHeight * originalAspect;
    } else {
      // Use the smaller scale factor to fit both dimensions
      const wScale = newWidth / element.width;
      const hScale = newHeight / element.height;
      const scale = Math.min(wScale, hScale);
      newWidth = element.width * scale;
      newHeight = element.height * scale;
    }
  }
  
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
  
  // Ensure cell data integrity is preserved
  const preservedCells = [...element.cells];
  
  return {
    ...element,
    width: actualWidth,
    height: actualHeight,
    colWidths,
    rowHeights,
    cells: preservedCells, // Preserve all cell data during resize
  };
}

/**
 * Apply table resize while maintaining aspect ratio (legacy compatibility)
 * @deprecated Use applyTableResize with options.keepAspectRatio instead
 */
export function applyTableResizeUniform(
  element: TableElement,
  newWidth: number,
  newHeight: number,
  maintainAspect: boolean = false
): TableElement {
  return applyTableResize(element, newWidth, newHeight, {
    keepAspectRatio: maintainAspect
  });
}

/**
 * Enhanced table resize with shift-key modifier support for aspect ratio
 * This is the main function that should be called from TransformManager
 */
export function handleTableTransform(
  element: TableElement,
  newBounds: { x: number; y: number; width: number; height: number },
  transformState: {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
  } = {}
): TableElement {
  const keepAspectRatio = transformState.shiftKey || false;
  
  // Apply position and size changes
  const resized = applyTableResize(
    element, 
    newBounds.width, 
    newBounds.height,
    { keepAspectRatio }
  );
  
  return {
    ...resized,
    x: newBounds.x,
    y: newBounds.y,
  };
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
  const newColWidth = Math.max(DEFAULT_TABLE_CONFIG.minCellWidth, 
    Math.round(element.width / (element.cols + 1)));
  
  // Insert new column width
  const newColWidths = [...element.colWidths];
  newColWidths.splice(insertAt, 0, newColWidth);
  
  // Insert empty cells for the new column
  const newCells = [];
  for (let row = 0; row < element.rows; row++) {
    for (let col = 0; col <= element.cols; col++) {
      if (col === insertAt) {
        // Insert new empty cell
        newCells.push({ text: "" });
      } else {
        // Copy existing cell, adjusting index for insertions
        const sourceCol = col > insertAt ? col - 1 : col;
        const sourceIndex = row * element.cols + sourceCol;
        newCells.push(element.cells[sourceIndex] || { text: "" });
      }
    }
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
  const newRowHeight = Math.max(DEFAULT_TABLE_CONFIG.minCellHeight,
    Math.round(element.height / (element.rows + 1)));
  
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
        newCells.push(element.cells[cellIndex] || { text: "" });
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

/**
 * Validate table element integrity after transform operations
 */
export function validateTableIntegrity(element: TableElement): TableElement {
  const { rows, cols, colWidths, rowHeights, cells } = element;
  
  // Ensure arrays have correct lengths
  const validColWidths = colWidths.length === cols ? colWidths : 
    Array.from({ length: cols }, (_, i) => colWidths[i] || DEFAULT_TABLE_CONFIG.minCellWidth);
    
  const validRowHeights = rowHeights.length === rows ? rowHeights :
    Array.from({ length: rows }, (_, i) => rowHeights[i] || DEFAULT_TABLE_CONFIG.minCellHeight);
    
  const expectedCellCount = rows * cols;
  const validCells = cells.length === expectedCellCount ? cells :
    Array.from({ length: expectedCellCount }, (_, i) => cells[i] || { text: "" });
  
  // Recalculate dimensions
  const actualWidth = validColWidths.reduce((sum, w) => sum + w, 0);
  const actualHeight = validRowHeights.reduce((sum, h) => sum + h, 0);
  
  return {
    ...element,
    width: actualWidth,
    height: actualHeight,
    colWidths: validColWidths,
    rowHeights: validRowHeights,
    cells: validCells,
  };
}