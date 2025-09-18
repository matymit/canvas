// Table operations for adding and deleting rows and columns
import type { TableElement } from '../../types/table';

/**
 * Add a new row above the specified row index
 */
export function addRowAbove(tableElement: TableElement, rowIndex: number): TableElement {
  const { cols, cells, rowHeights } = tableElement;

  // Create new empty cells for the new row
  const newRowCells = Array.from({ length: cols }, () => ({ text: '' }));

  // Insert the new row at the specified index
  const newCells = [...cells];
  newCells.splice(rowIndex * cols, 0, ...newRowCells);

  // Add new row height (use same height as existing rows or default)
  const newRowHeight = rowHeights[rowIndex] || rowHeights[0] || 28;
  const newRowHeights = [...rowHeights];
  newRowHeights.splice(rowIndex, 0, newRowHeight);

  // Return new table element with updated properties
  return {
    ...tableElement,
    cells: newCells,
    rows: tableElement.rows + 1,
    rowHeights: newRowHeights,
    height: tableElement.height + newRowHeight,
  };
}

/**
 * Add a new row below the specified row index
 */
export function addRowBelow(tableElement: TableElement, rowIndex: number): TableElement {
  const { cols, cells, rowHeights } = tableElement;

  // Create new empty cells for the new row
  const newRowCells = Array.from({ length: cols }, () => ({ text: '' }));

  // Insert the new row after the specified index
  const insertIndex = (rowIndex + 1) * cols;
  const newCells = [...cells];
  newCells.splice(insertIndex, 0, ...newRowCells);

  // Add new row height (use same height as the row we're inserting below)
  const newRowHeight = rowHeights[rowIndex] || rowHeights[0] || 28;
  const newRowHeights = [...rowHeights];
  newRowHeights.splice(rowIndex + 1, 0, newRowHeight);

  // Return new table element with updated properties
  return {
    ...tableElement,
    cells: newCells,
    rows: tableElement.rows + 1,
    rowHeights: newRowHeights,
    height: tableElement.height + newRowHeight,
  };
}

/**
 * Add a new column to the left of the specified column index
 */
export function addColumnLeft(tableElement: TableElement, colIndex: number): TableElement {
  const { rows, cols, cells, colWidths } = tableElement;

  const newCells = [];

  // Iterate through each row and insert a new cell at the specified column index
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= cols; col++) {
      if (col === colIndex) {
        // Insert new empty cell
        newCells.push({ text: '' });
      }
      if (col < cols) {
        // Copy existing cell
        const originalIndex = row * cols + col;
        newCells.push(cells[originalIndex]);
      }
    }
  }

  // Add new column width (use same width as existing columns or default)
  const newColWidth = colWidths[colIndex] || colWidths[0] || 60;
  const newColWidths = [...colWidths];
  newColWidths.splice(colIndex, 0, newColWidth);

  // Return new table element with updated properties
  return {
    ...tableElement,
    cells: newCells,
    cols: tableElement.cols + 1,
    colWidths: newColWidths,
    width: tableElement.width + newColWidth,
  };
}

/**
 * Add a new column to the right of the specified column index
 */
export function addColumnRight(tableElement: TableElement, colIndex: number): TableElement {
  const { rows, cols, cells, colWidths } = tableElement;

  const newCells = [];

  // Iterate through each row and insert a new cell after the specified column index
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= cols; col++) {
      if (col <= colIndex && col < cols) {
        // Copy existing cell
        const originalIndex = row * cols + col;
        newCells.push(cells[originalIndex]);
      }
      if (col === colIndex + 1) {
        // Insert new empty cell
        newCells.push({ text: '' });
      }
      if (col > colIndex + 1 && col < cols + 1) {
        // Copy remaining existing cells
        const originalIndex = row * cols + (col - 1);
        newCells.push(cells[originalIndex]);
      }
    }
  }

  // Add new column width (use same width as the column we're inserting to the right of)
  const newColWidth = colWidths[colIndex] || colWidths[0] || 60;
  const newColWidths = [...colWidths];
  newColWidths.splice(colIndex + 1, 0, newColWidth);

  // Return new table element with updated properties
  return {
    ...tableElement,
    cells: newCells,
    cols: tableElement.cols + 1,
    colWidths: newColWidths,
    width: tableElement.width + newColWidth,
  };
}

/**
 * Delete the specified row
 */
export function deleteRow(tableElement: TableElement, rowIndex: number): TableElement {
  const { cols, rows, cells, rowHeights } = tableElement;

  if (rows <= 1) {
    throw new Error('Cannot delete the last row');
  }

  // Remove cells for the specified row
  const startIndex = rowIndex * cols;
  const newCells = [...cells];
  newCells.splice(startIndex, cols);

  // Remove the row height
  const deletedRowHeight = rowHeights[rowIndex] || 0;
  const newRowHeights = [...rowHeights];
  newRowHeights.splice(rowIndex, 1);

  // Return new table element with updated properties
  return {
    ...tableElement,
    cells: newCells,
    rows: tableElement.rows - 1,
    rowHeights: newRowHeights,
    height: tableElement.height - deletedRowHeight,
  };
}

/**
 * Delete the specified column
 */
export function deleteColumn(tableElement: TableElement, colIndex: number): TableElement {
  const { cols, rows, cells, colWidths } = tableElement;

  if (cols <= 1) {
    throw new Error('Cannot delete the last column');
  }

  const newCells = [];

  // Iterate through each row and exclude the specified column
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col !== colIndex) {
        const originalIndex = row * cols + col;
        newCells.push(cells[originalIndex]);
      }
    }
  }

  // Remove the column width
  const deletedColWidth = colWidths[colIndex] || 0;
  const newColWidths = [...colWidths];
  newColWidths.splice(colIndex, 1);

  // Return new table element with updated properties
  return {
    ...tableElement,
    cells: newCells,
    cols: tableElement.cols - 1,
    colWidths: newColWidths,
    width: tableElement.width - deletedColWidth,
  };
}

/**
 * Get the cell at the specified row and column
 */
export function getCell(tableElement: TableElement, row: number, col: number) {
  const { cols, cells } = tableElement;
  const index = row * cols + col;
  return cells[index];
}

/**
 * Set the content of the cell at the specified row and column
 */
export function setCell(tableElement: TableElement, row: number, col: number, text: string): TableElement {
  const { cols, cells } = tableElement;
  const index = row * cols + col;
  if (index >= 0 && index < cells.length) {
    const newCells = [...cells];
    newCells[index] = { text };
    return {
      ...tableElement,
      cells: newCells,
    };
  }
  return tableElement;
}

/**
 * Validate table structure and fix any inconsistencies
 */
export function validateTableStructure(tableElement: TableElement): TableElement {
  const { rows, cols, cells } = tableElement;
  const expectedCellCount = rows * cols;

  let newCells = [...cells];

  if (cells.length !== expectedCellCount) {
    // Adjust cells array to match expected size
    if (cells.length < expectedCellCount) {
      // Add missing cells
      const missingCount = expectedCellCount - cells.length;
      const emptyCells = Array.from({ length: missingCount }, () => ({ text: '' }));
      newCells = [...cells, ...emptyCells];
    } else {
      // Remove excess cells
      newCells = cells.slice(0, expectedCellCount);
    }
  }

  // Ensure all cells have the required structure
  newCells = newCells.map(cell => ({
    text: cell?.text || ''
  }));

  return {
    ...tableElement,
    cells: newCells,
  };
}