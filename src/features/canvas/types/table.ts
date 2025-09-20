// Table element types for FigJam-style table functionality
// Provides serializable data model that fits the existing four-layer pipeline

export type ElementId = string;

export interface TableCell {
  // Plain text for now; rich text can be introduced later via marks
  text: string;
}

export interface TableStyle {
  cellFill: string;        // e.g., "#FFFFFF"
  borderColor: string;     // e.g., "#D1D5DB"
  borderWidth: number;     // e.g., 1
  fontFamily: string;      // e.g., "Inter"
  fontSize: number;        // e.g., 14
  textColor: string;       // e.g., "#111827"
  paddingX: number;        // px inside cells
  paddingY: number;        // px inside cells
  cornerRadius: number;    // radius for cell rects if desired (0 for square)
}

export interface TableElement {
  id: ElementId;
  type: "table";
  x: number;
  y: number;
  width: number;          // total table width
  height: number;         // total table height
  rows: number;
  cols: number;
  colWidths: number[];    // length = cols, sum = width
  rowHeights: number[];   // length = rows, sum = height
  cells: TableCell[];     // length = rows * cols, row-major
  style: TableStyle;
}

// Default style configuration for new tables
export const DEFAULT_TABLE_STYLE: TableStyle = {
  cellFill: "#FFFFFF",
  borderColor: "#D1D5DB",
  borderWidth: 1,
  fontFamily: "Inter",
  fontSize: 14,
  textColor: "#111827",
  paddingX: 8,
  paddingY: 6,
  cornerRadius: 0,
};

// Default table dimensions
export const DEFAULT_TABLE_CONFIG = {
  rows: 2,
  cols: 3,
  minWidth: 360,
  minHeight: 96,
  minCellWidth: 120,
  minCellHeight: 28,
} as const;

// Helper functions for table operations
export function getCellIndex(row: number, col: number, cols: number): number {
  return row * cols + col;
}

export function getCellPosition(index: number, cols: number): { row: number; col: number } {
  return {
    row: Math.floor(index / cols),
    col: index % cols,
  };
}

export function createEmptyTable(x: number, y: number, width?: number, height?: number): Omit<TableElement, "id"> {
  const { rows, cols, minWidth, minHeight, minCellWidth, minCellHeight } = DEFAULT_TABLE_CONFIG;
  
  const tableWidth = width || minWidth;
  const tableHeight = height || minHeight;
  
  const colWidth = Math.max(minCellWidth, Math.round(tableWidth / cols));
  const rowHeight = Math.max(minCellHeight, Math.round(tableHeight / rows));
  
  const colWidths = Array.from({ length: cols }, () => colWidth);
  const rowHeights = Array.from({ length: rows }, () => rowHeight);
  
  const actualWidth = colWidths.reduce((a, b) => a + b, 0);
  const actualHeight = rowHeights.reduce((a, b) => a + b, 0);
  
  const cells = Array.from({ length: rows * cols }, () => ({ text: "" }));

  return {
    type: "table",
    x,
    y,
    width: actualWidth,
    height: actualHeight,
    rows,
    cols,
    colWidths,
    rowHeights,
    cells,
    style: { ...DEFAULT_TABLE_STYLE },
  };
}
