// COMPLETELY REWRITTEN table transform logic that works correctly with Konva.Transformer
// Konva transformers modify scaleX/scaleY, NOT width/height directly
// This implementation handles the scale->dimension conversion properly

import type { TableElement } from "../../types/table";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";

/**
 * CRITICAL: Apply table resize based on Konva scale values
 * Konva.Transformer modifies scaleX/scaleY, so we convert those to actual dimensions
 * @param element - The table element to resize
 * @param scaleX - New X scale from transformer
 * @param scaleY - New Y scale from transformer
 * @param options - Resize options
 */
export function applyTableScaleResize(
  element: TableElement,
  scaleX: number,
  scaleY: number,
  options: {
    keepAspectRatio?: boolean;
    minScaleX?: number;
    minScaleY?: number;
  } = {}
): TableElement {
  const { minCellWidth, minCellHeight } = DEFAULT_TABLE_CONFIG;
  
  // Handle aspect ratio locking
  let finalScaleX = scaleX;
  let finalScaleY = scaleY;
  
  if (options.keepAspectRatio) {
    // Use the smaller scale to maintain aspect ratio
    const minScale = Math.min(scaleX, scaleY);
    finalScaleX = minScale;
    finalScaleY = minScale;
  }
  
  // Apply minimum scale constraints
  const minScaleX = options.minScaleX || 0.1;
  const minScaleY = options.minScaleY || 0.1;
  finalScaleX = Math.max(minScaleX, finalScaleX);
  finalScaleY = Math.max(minScaleY, finalScaleY);
  
  // Calculate new dimensions based on scale
  const newTotalWidth = Math.round(element.width * finalScaleX);
  const newTotalHeight = Math.round(element.height * finalScaleY);
  
  // Proportionally scale all column widths
  const newColWidths = element.colWidths.map(w => {
    const scaledWidth = Math.round(w * finalScaleX);
    return Math.max(minCellWidth, scaledWidth);
  });
  
  // Proportionally scale all row heights
  const newRowHeights = element.rowHeights.map(h => {
    const scaledHeight = Math.round(h * finalScaleY);
    return Math.max(minCellHeight, scaledHeight);
  });
  
  // Calculate actual dimensions after constraint application
  const actualWidth = newColWidths.reduce((sum, w) => sum + w, 0);
  const actualHeight = newRowHeights.reduce((sum, h) => sum + h, 0);
  
  return {
    ...element,
    width: actualWidth,
    height: actualHeight,
    colWidths: newColWidths,
    rowHeights: newRowHeights,
    // Cells remain unchanged during resize
    cells: [...element.cells],
  };
}

/**
 * Handle table transform end - this is where we reset scale and update dimensions
 * This is the CORRECT way to handle Konva transformer resize for complex elements
 * @param element - The table element
 * @param node - The Konva group node that was transformed
 * @param options - Transform options
 */
export function handleTableTransformEnd(
  element: TableElement,
  node: any, // Konva.Group
  options: {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
  } = {}
): { element: TableElement; resetAttrs: any } {
  const keepAspectRatio = options.shiftKey || false;
  
  // Get the current scale from the transformed node
  const currentScaleX = node.scaleX();
  const currentScaleY = node.scaleY();
  
  console.log('[TableTransform] Transform end:', {
    elementId: element.id,
    originalSize: { width: element.width, height: element.height },
    scale: { x: currentScaleX, y: currentScaleY },
    keepAspectRatio
  });
  
  // Apply the scale to get new table structure
  const resizedElement = applyTableScaleResize(
    element,
    currentScaleX,
    currentScaleY,
    { keepAspectRatio }
  );
  
  // CRITICAL: Reset the node's scale and update its size
  // This is the key to proper Konva transformer handling
  const resetAttrs = {
    scaleX: 1,
    scaleY: 1,
    width: resizedElement.width,
    height: resizedElement.height,
    // Position stays the same
    x: node.x(),
    y: node.y(),
  };
  
  console.log('[TableTransform] Applying reset attrs:', resetAttrs);
  
  return {
    element: {
      ...resizedElement,
      x: node.x(),
      y: node.y(),
    },
    resetAttrs
  };
}

/**
 * Handle ongoing table transform (live preview)
 * During transform, we just let Konva handle the scaling visually
 * @param element - The table element
 * @param node - The Konva group node
 */
export function handleTableTransformLive(
  element: TableElement,
  node: any, // Konva.Group
  options: {
    shiftKey?: boolean;
  } = {}
): void {
  // During live transform, we can optionally enforce aspect ratio
  if (options.shiftKey) {
    const currentScaleX = node.scaleX();
    const currentScaleY = node.scaleY();
    
    // Use the smaller scale to maintain aspect ratio
    const minScale = Math.min(Math.abs(currentScaleX), Math.abs(currentScaleY));
    
    node.scaleX(currentScaleX >= 0 ? minScale : -minScale);
    node.scaleY(currentScaleY >= 0 ? minScale : -minScale);
  }
  
  // Let Konva handle the visual scaling during transform
  // No need to update the element data structure during live transform
}

/**
 * Create proper boundBoxFunc for table transformers
 * This prevents malformed tables and enforces minimum sizes
 */
export function createTableBoundBoxFunc(
  element: TableElement
) {
  return (oldBox: any, newBox: any) => {
    // Calculate minimum dimensions based on table structure
    const minTableWidth = element.colWidths.length * DEFAULT_TABLE_CONFIG.minCellWidth;
    const minTableHeight = element.rowHeights.length * DEFAULT_TABLE_CONFIG.minCellHeight;
    
    // Calculate minimum scale factors
    const minScaleX = minTableWidth / element.width;
    const minScaleY = minTableHeight / element.height;
    
    // Calculate what the scale would be for the new box
    const newScaleX = newBox.width / element.width;
    const newScaleY = newBox.height / element.height;
    
    // Enforce minimum scales
    const constrainedScaleX = Math.max(minScaleX, newScaleX);
    const constrainedScaleY = Math.max(minScaleY, newScaleY);
    
    // Handle aspect ratio locking with shift key
    const event = window.event as KeyboardEvent | undefined;
    const shiftKey = event?.shiftKey ?? false;
    
    let finalScaleX = constrainedScaleX;
    let finalScaleY = constrainedScaleY;
    
    if (shiftKey) {
      // Use the smaller scale to maintain aspect ratio
      const minScale = Math.min(constrainedScaleX, constrainedScaleY);
      finalScaleX = minScale;
      finalScaleY = minScale;
    }
    
    // Return the constrained bounds
    return {
      x: newBox.x || 0,
      y: newBox.y || 0,
      width: element.width * finalScaleX,
      height: element.height * finalScaleY,
      rotation: newBox.rotation || 0,
    };
  };
}

/**
 * Legacy compatibility function - use handleTableTransformEnd instead
 * @deprecated
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
  console.warn('[TableTransform] handleTableTransform is deprecated, use handleTableTransformEnd instead');
  
  // Calculate scale from bounds
  const scaleX = newBounds.width / element.width;
  const scaleY = newBounds.height / element.height;
  
  const resized = applyTableScaleResize(
    element,
    scaleX,
    scaleY,
    { keepAspectRatio: transformState.shiftKey }
  );
  
  return {
    ...resized,
    x: newBounds.x,
    y: newBounds.y,
  };
}

// Keep existing functions for table structure modification (add/remove rows/cols)
// These don't need to change as they work with the data structure directly

/**
 * Resize specific columns in a table
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
  const newColWidth = Math.max(
    DEFAULT_TABLE_CONFIG.minCellWidth,
    Math.round(element.width / (element.cols + 1))
  );
  
  // Insert new column width
  const newColWidths = [...element.colWidths];
  newColWidths.splice(insertAt, 0, newColWidth);
  
  // Insert empty cells for the new column
  const newCells = [];
  for (let row = 0; row < element.rows; row++) {
    for (let col = 0; col <= element.cols; col++) {
      if (col === insertAt) {
        newCells.push({ text: "" });
      } else {
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
  const newRowHeight = Math.max(
    DEFAULT_TABLE_CONFIG.minCellHeight,
    Math.round(element.height / (element.rows + 1))
  );
  
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
  if (element.cols <= 1) return element;
  
  const newColWidths = element.colWidths.filter((_, i) => i !== columnIndex);
  
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
  if (element.rows <= 1) return element;
  
  const newRowHeights = element.rowHeights.filter((_, i) => i !== rowIndex);
  
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