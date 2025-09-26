// CORRECTED table transform logic that properly handles Konva.Transformer
// Implements the scale→reset→resize pattern correctly for complex elements

import type Konva from "konva";
import type { TableElement } from "../../types/table";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";

/**
 * Helper function for proportional scaling with minimum constraints and redistribution
 * This is the key to preventing horizontal locking when shrinking
 */
function rescaleWithMins(arr: number[], scale: number, min: number): number[] {
  const proposed = arr.map((v) => Math.max(v * scale, min));
  const proposedSum = proposed.reduce((a, b) => a + b, 0);
  const targetSum = arr.reduce((a, b) => a + b, 0) * scale;

  // If some mins triggered, proposedSum may exceed targetSum.
  // Normalize to targetSum to avoid drift, but never drop below min.
  if (proposedSum === 0) return arr.map(() => min);

  const correction = targetSum / proposedSum;
  const corrected = proposed.map((v) => Math.max(v * correction, min));

  // Final normalization to exactly match targetSum
  const finalSum = corrected.reduce((a, b) => a + b, 0);
  const delta = targetSum - finalSum;
  if (Math.abs(delta) > 0.5) {
    // distribute delta across columns > min
    const flexIdx = corrected
      .map((v, i) => [v, i] as const)
      .filter(([v]) => v > min)
      .map(([, i]) => i);

    if (flexIdx.length) {
      const per = delta / flexIdx.length;
      flexIdx.forEach(
        (i) => (corrected[i] = Math.max(corrected[i] + per, min)),
      );
    }
  }
  return corrected;
}

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
  } = {},
): TableElement {
  const { minCellWidth, minCellHeight } = DEFAULT_TABLE_CONFIG;

  // Handle aspect ratio locking
  let finalScaleX = scaleX;
  let finalScaleY = scaleY;

  if (options.keepAspectRatio) {
    // Use the smaller scale to maintain aspect ratio
    const minScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
    finalScaleX = scaleX >= 0 ? minScale : -minScale;
    finalScaleY = scaleY >= 0 ? minScale : -minScale;
  }

  // Apply minimum scale constraints
  const minScaleX = options.minScaleX || 0.1;
  const minScaleY = options.minScaleY || 0.1;
  finalScaleX =
    Math.max(minScaleX, Math.abs(finalScaleX)) * Math.sign(finalScaleX);
  finalScaleY =
    Math.max(minScaleY, Math.abs(finalScaleY)) * Math.sign(finalScaleY);

  // Use the corrected rescaling function that prevents horizontal locking
  const newColWidths = rescaleWithMins(
    element.colWidths,
    Math.abs(finalScaleX),
    minCellWidth,
  );
  const newRowHeights = rescaleWithMins(
    element.rowHeights,
    Math.abs(finalScaleY),
    minCellHeight,
  );

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
  node: Konva.Node,
  options: {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
  } = {},
): { element: TableElement; resetAttrs: { scaleX: number; scaleY: number; width: number; height: number; x: number; y: number } } {
  const keepAspectRatio = options.shiftKey || false;

  // Get the current scale from the transformed node
  const currentScaleX = node.scaleX();
  const currentScaleY = node.scaleY();

  // Debug: Transform end for element

  // Apply the scale to get new table structure
  const resizedElement = applyTableScaleResize(
    element,
    currentScaleX,
    currentScaleY,
    { keepAspectRatio },
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

  // Debug: Applying reset attrs

  return {
    element: {
      ...resizedElement,
      x: node.x(),
      y: node.y(),
    },
    resetAttrs,
  };
}

/**
 * Handle ongoing table transform (live preview)
 * During transform, we just let Konva handle the scaling visually
 * @param element - The table element
 * @param node - The Konva group node
 */
export function handleTableTransformLive(
  _element: TableElement,
  node: Konva.Node,
  options: {
    shiftKey?: boolean;
  } = {},
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
 * CORRECTED boundBoxFunc for table transformers
 * This prevents the horizontal locking issue by never returning oldBox
 * Always returns a constrained newBox instead
 */
export function createTableBoundBoxFunc(element: TableElement) {
  return (_oldBox: Konva.NodeConfig, newBox: Konva.NodeConfig) => {
    const { minCellWidth, minCellHeight } = DEFAULT_TABLE_CONFIG;

    // Calculate minimum dimensions based on table structure
    const minTableWidth = element.cols * minCellWidth;
    const minTableHeight = element.rows * minCellHeight;

    // CRITICAL FIX: Always return a constrained newBox, never oldBox
    // This prevents the horizontal "dead stop" when shrinking
    const constrainedWidth = Math.max(newBox.width ?? 0, minTableWidth);
    const constrainedHeight = Math.max(newBox.height ?? 0, minTableHeight);

    // Handle aspect ratio locking with shift key
    const event = (typeof window !== "undefined" && window.event) as
      | KeyboardEvent
      | undefined;
    const shiftKey = event?.shiftKey ?? false;

    let finalWidth = constrainedWidth;
    let finalHeight = constrainedHeight;

    if (shiftKey) {
      // Calculate current aspect ratio
      const aspectRatio = element.width / element.height;

      // Determine which dimension to adjust based on the change ratio
      const widthRatio = constrainedWidth / element.width;
      const heightRatio = constrainedHeight / element.height;

      if (widthRatio < heightRatio) {
        // Width is the limiting factor
        finalHeight = Math.max(constrainedWidth / aspectRatio, minTableHeight);
      } else {
        // Height is the limiting factor
        finalWidth = Math.max(constrainedHeight * aspectRatio, minTableWidth);
      }
    }

    // CRITICAL: Always return a valid box, never oldBox
    return {
      x: newBox.x || 0,
      y: newBox.y || 0,
      width: finalWidth,
      height: finalHeight,
      rotation: newBox.rotation || 0,
    };
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
  newWidth: number,
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
  newHeight: number,
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
  insertIndex?: number,
): TableElement {
  const insertAt = insertIndex ?? element.cols;
  const newColWidth = Math.max(
    DEFAULT_TABLE_CONFIG.minCellWidth,
    Math.round(element.width / (element.cols + 1)),
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
  insertIndex?: number,
): TableElement {
  const insertAt = insertIndex ?? element.rows;
  const newRowHeight = Math.max(
    DEFAULT_TABLE_CONFIG.minCellHeight,
    Math.round(element.height / (element.rows + 1)),
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
  columnIndex: number,
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
  rowIndex: number,
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
  const validColWidths =
    colWidths.length === cols
      ? colWidths
      : Array.from(
          { length: cols },
          (_, i) => colWidths[i] || DEFAULT_TABLE_CONFIG.minCellWidth,
        );

  const validRowHeights =
    rowHeights.length === rows
      ? rowHeights
      : Array.from(
          { length: rows },
          (_, i) => rowHeights[i] || DEFAULT_TABLE_CONFIG.minCellHeight,
        );

  const expectedCellCount = rows * cols;
  const validCells =
    cells.length === expectedCellCount
      ? cells
      : Array.from(
          { length: expectedCellCount },
          (_, i) => cells[i] || { text: "" },
        );

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
  } = {},
): TableElement {
  // Warning: handleTableTransform is deprecated, use handleTableTransformEnd instead

  // Calculate scale from bounds
  const scaleX = newBounds.width / element.width;
  const scaleY = newBounds.height / element.height;

  const resized = applyTableScaleResize(element, scaleX, scaleY, {
    keepAspectRatio: transformState.shiftKey,
  });

  return {
    ...resized,
    x: newBounds.x,
    y: newBounds.y,
  };
}
