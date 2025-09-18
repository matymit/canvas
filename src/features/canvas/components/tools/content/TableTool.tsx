// Table tool for creating FigJam-style tables with preview/commit and auto-select functionality
// Follows existing tool patterns with four-layer usage and unified store integration

import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { nanoid } from "nanoid";
import type { TableElement } from "../../../types/elements/table";
import {
  createEmptyTable,
  DEFAULT_TABLE_STYLE,
  DEFAULT_TABLE_CONFIG,
} from "../../../types/elements/table";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TableToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // e.g., "table"
}

function getNamedOrIndexedLayer(
  stage: Konva.Stage,
  name: string,
  indexFallback: number,
): Konva.Layer | null {
  // Try by name or id; fallback to index if not named
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

export const TableTool: React.FC<TableToolProps> = ({
  isActive,
  stageRef,
  toolId = "table",
}) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);

  const drawingRef = useRef<{
    start: { x: number; y: number } | null;
    preview: Konva.Group | null;
  }>({ start: null, preview: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer =
      getNamedOrIndexedLayer(stage, "preview", 2) ||
      stage.getLayers()[stage.getLayers().length - 2] ||
      stage.getLayers()[0];

    if (!previewLayer) return;

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      drawingRef.current.start = { x: pos.x, y: pos.y };

      const g = new Konva.Group({
        listening: false,
        name: "table-preview",
        draggable: true,
      });

      const outer = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: DEFAULT_TABLE_STYLE.borderColor,
        strokeWidth: DEFAULT_TABLE_STYLE.borderWidth,
        fill: "transparent",
        listening: false,
        perfectDrawEnabled: false,
      });

      g.add(outer);
      previewLayer.add(g);
      drawingRef.current.preview = g;
      previewLayer.batchDraw();

      stage.on("pointermove.tabletool", onPointerMove);
      stage.on("pointerup.tabletool", onPointerUp);
    };

    const onPointerMove = () => {
      const start = drawingRef.current.start;
      const g = drawingRef.current.preview;
      if (!start || !g) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      const outer = g.findOne<Konva.Rect>("Rect");
      if (outer) {
        outer.position({ x, y });
        outer.size({ width: w, height: h });

        updateGridPreview(g, w, h);
      }
      previewLayer.batchDraw();
    };

    const commit = (x: number, y: number, w: number, h: number) => {
      const tableData = createEmptyTable(x, y, w, h);
      const id = nanoid();

      // FIXED: Create proper TableElement structure without redundant data/bounds
      const elementData: TableElement = {
        ...tableData,
        id,
        type: "table" as const,
      };

      // Use proper store methods like other tools
      const store = useUnifiedCanvasStore.getState();

      if (store.withUndo) {
        store.withUndo("Add table", () => {
          store.addElement(elementData, { select: true, pushHistory: false }); // withUndo handles history
        });
      } else {
        // Fallback if withUndo not available
        store.addElement(elementData, { select: true });
      }

      setSelectedTool("select");
    };

    const onPointerUp = () => {
      stage.off("pointermove.tabletool");
      stage.off("pointerup.tabletool");

      const start = drawingRef.current.start;
      const g = drawingRef.current.preview;
      drawingRef.current.start = null;

      if (g) {
        g.remove();
        g.destroy();
        previewLayer.batchDraw();
        drawingRef.current.preview = null;
      }

      const pos = stage.getPointerPosition();
      if (!start || !pos) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      const { minWidth, minHeight } = DEFAULT_TABLE_CONFIG;
      const finalW = w < 4 ? minWidth : Math.max(minWidth, w);
      const finalH = h < 4 ? minHeight : Math.max(minHeight, h);

      commit(x, y, finalW, finalH);
    };

    const onDoubleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      const table = e.target.getParent();
      if (table && table.name() === "table") {
        const pos = stage.getPointerPosition();
        if (!pos) return;
        const tableElement = table.attrs as TableElement;
        openFirstCellEditor(stage, tableElement.id, tableElement);
      }
    };

    stage.on("pointerdown.tabletool", onPointerDown);
    stage.on("dblclick.tabletool", onDoubleClick);

    return () => {
      stage.off("pointerdown.tabletool", onPointerDown);
      stage.off("pointermove.tabletool", onPointerMove);
      stage.off("pointerup.tabletool", onPointerUp);
      stage.off("dblclick.tabletool", onDoubleClick);

      const g = drawingRef.current.preview;
      if (g) {
        g.destroy();
        drawingRef.current.preview = null;
      }
      drawingRef.current.start = null;
      previewLayer.batchDraw();
    };
  }, [
    isActive,
    selectedTool,
    toolId,
    stageRef,
    setSelectedTool,
  ]);

  return null;
};

export default TableTool;

// Helper function to update grid preview
function updateGridPreview(group: Konva.Group, width: number, height: number) {
  // Remove existing grid preview
  const existing = group.findOne(".grid-preview");
  if (existing) existing.destroy();

  if (width < 20 || height < 20) return; // Too small for grid preview

  // Add simple grid lines
  const { rows, cols } = DEFAULT_TABLE_CONFIG;
  const colWidth = width / cols;
  const rowHeight = height / rows;

  const gridShape = new Konva.Shape({
    sceneFunc: (ctx: any, shape: Konva.Shape) => {
      ctx.save();
      ctx.strokeStyle = DEFAULT_TABLE_STYLE.borderColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;

      // Vertical lines
      for (let c = 1; c < cols; c++) {
        const x = c * colWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let r = 1; r < rows; r++) {
        const y = r * rowHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.restore();
      ctx.fillStrokeShape(shape);
    },
    listening: false,
    name: "grid-preview",
  });

  group.add(gridShape);
}

// Helper function to open editor for the first cell (0,0)
function openFirstCellEditor(
  stage: Konva.Stage,
  tableId: string,
  tableElement: TableElement
) {
  openCellEditor(stage, tableId, tableElement, 0, 0);
}

// Precise cell editor with proper coordinate calculation
function openCellEditor(
  stage: Konva.Stage,
  tableId: string,
  tableElement: TableElement,
  row: number = 0,
  col: number = 0
) {
  const container = stage.container();
  const rect = container.getBoundingClientRect();

  // CRITICAL FIX: Get proper stage transform including scale and position
  const stageAttrs = stage.attrs;
  const stageX = stageAttrs.x || 0;
  const stageY = stageAttrs.y || 0;
  const scale = stage.scaleX(); // Account for zoom

  // Calculate exact cell bounds in stage coordinates
  let cellX = tableElement.x;
  let cellY = tableElement.y;

  // Add column widths to get to target column
  for (let c = 0; c < col; c++) {
    cellX += tableElement.colWidths[c];
  }

  // Add row heights to get to target row
  for (let r = 0; r < row; r++) {
    cellY += tableElement.rowHeights[r];
  }

  const cellWidth = tableElement.colWidths[col];
  const cellHeight = tableElement.rowHeights[row];

  // FIXED: Apply stage transform correctly (scale first, then translate)
  const scaledCellX = cellX * scale;
  const scaledCellY = cellY * scale;
  const screenX = rect.left + scaledCellX + stageX;
  const screenY = rect.top + scaledCellY + stageY;
  const screenWidth = cellWidth * scale;
  const screenHeight = cellHeight * scale;

  console.log(`[TableTool] Opening editor for cell [${row}, ${col}] at screen pos: ${screenX}, ${screenY}`);

  // Create precisely positioned editor
  const textarea = document.createElement('textarea');
  Object.assign(textarea.style, {
    position: 'absolute',
    left: `${screenX + 4}px`,  // Small padding inside cell
    top: `${screenY + 4}px`,
    width: `${Math.max(60, screenWidth - 8)}px`,  // Account for padding
    height: `${Math.max(20, screenHeight - 8)}px`,
    border: '2px solid #4F46E5',
    borderRadius: '3px',
    outline: 'none',
    resize: 'none',
    background: '#ffffff',
    color: '#333333',
    fontFamily: tableElement.style.fontFamily,
    fontSize: `${Math.max(12, tableElement.style.fontSize * scale)}px`, // Scale font with zoom
    lineHeight: '1.2',
    padding: '2px 4px',
    textAlign: 'center',
    verticalAlign: 'middle',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  } as CSSStyleDeclaration);

  // Get current cell text
  const cellIndex = row * tableElement.cols + col;
  const currentText = tableElement.cells[cellIndex]?.text || '';
  textarea.value = currentText;

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  // Track if commit has already been called to prevent multiple calls
  let isCommitted = false;

  // Commit changes
  const commit = (canceled: boolean) => {
    if (isCommitted) return;
    isCommitted = true;

    const newText = textarea.value.trim();

    // Remove textarea from DOM
    if (textarea.parentElement) {
      textarea.remove();
    }

    if (!canceled && newText !== currentText) {
      // Update cell in store
      const store = useUnifiedCanvasStore.getState();
      const currentElement = store.elements.get(tableId) as TableElement;
      if (currentElement) {
        const newCells = [...(currentElement.cells || [])];
        while (newCells.length <= cellIndex) {
          newCells.push({ text: "" });
        }
        newCells[cellIndex] = { text: newText };

        if (store.withUndo) {
          store.withUndo(`Edit cell (${row},${col})`, () => {
            store.updateElement(tableId, { cells: newCells }, { pushHistory: false });
          });
        } else {
          store.updateElement(tableId, { cells: newCells });
        }
      }
    }
  };

  // Event handlers
  textarea.addEventListener('keydown', (e) => {
    // CRITICAL FIX: Stop propagation for ALL keydown events to prevent keyboard shortcuts
    e.stopPropagation();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commit(false);

      // Navigate to next cell
      const nextCol = (col + 1) % tableElement.cols;
      const nextRow = nextCol === 0 ? row + 1 : row;

      if (nextRow < tableElement.rows) {
        setTimeout(() => {
          openCellEditor(stage, tableId, tableElement, nextRow, nextCol);
        }, 50);
      }
    }
    // For all other keys (including 'h'), allow normal text input behavior
    // and prevent canvas keyboard shortcuts by stopping propagation
  });

  // Also prevent keyup events from bubbling to prevent any remaining shortcuts
  textarea.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });

  // Prevent keypress events from bubbling as well
  textarea.addEventListener('keypress', (e) => {
    e.stopPropagation();
  });

  textarea.addEventListener('blur', () => {
    // Add small delay to prevent race conditions with keydown events
    setTimeout(() => commit(false), 10);
  }, { once: true });
}

// Global text editor tracking for live resize support
interface ActiveCellEditor {
  element: HTMLTextAreaElement;
  tableId: string;
  row: number;
  col: number;
  stage: Konva.Stage;
  cleanup: () => void;
}

(window as any).activeCellEditors = new Set<ActiveCellEditor>();

// Enhanced cell editor with live resize support
function openCellEditorWithTracking(
  stage: Konva.Stage,
  tableId: string,
  tableElement: TableElement,
  row: number = 0,
  col: number = 0
) {
  // Close any existing editor for this table
  (window as any).activeCellEditors.forEach((editor: ActiveCellEditor) => {
    if (editor.tableId === tableId) {
      editor.cleanup();
      (window as any).activeCellEditors.delete(editor);
    }
  });

  const container = stage.container();
  const rect = container.getBoundingClientRect();
  const scale = stage.scaleX();

  // Calculate exact cell bounds
  let cellX = tableElement.x;
  let cellY = tableElement.y;

  // Add column widths to get to target column
  for (let c = 0; c < col; c++) {
    cellX += tableElement.colWidths[c];
  }

  // Add row heights to get to target row
  for (let r = 0; r < row; r++) {
    cellY += tableElement.rowHeights[r];
  }

  const cellWidth = tableElement.colWidths[col];
  const cellHeight = tableElement.rowHeights[row];

  // Apply stage transform (zoom + pan)
  const stageTransform = stage.getAbsoluteTransform();
  const cellPoint = stageTransform.point({ x: cellX, y: cellY });
  const screenX = rect.left + cellPoint.x;
  const screenY = rect.top + cellPoint.y;
  const screenWidth = cellWidth * scale;
  const screenHeight = cellHeight * scale;

  console.log(`[TableTool] Opening tracked editor for cell [${row}, ${col}] at screen pos: ${screenX}, ${screenY}`);

  // Create precisely positioned editor
  const textarea = document.createElement('textarea');

  const updateTextareaPosition = () => {
    // Get current table element (it may have been resized)
    const store = useUnifiedCanvasStore.getState();
    const currentElement = store.elements.get(tableId) as TableElement;
    if (!currentElement) return;

    // Recalculate cell position
    let newCellX = currentElement.x;
    let newCellY = currentElement.y;

    for (let c = 0; c < col; c++) {
      newCellX += currentElement.colWidths[c];
    }

    for (let r = 0; r < row; r++) {
      newCellY += currentElement.rowHeights[r];
    }

    const newCellWidth = currentElement.colWidths[col];
    const newCellHeight = currentElement.rowHeights[row];

    // FIXED: Apply stage transform correctly for live updates
    const currentStageAttrs = stage.attrs;
    const currentStageX = currentStageAttrs.x || 0;
    const currentStageY = currentStageAttrs.y || 0;
    const currentScale = stage.scaleX();
    const scaledNewCellX = newCellX * currentScale;
    const scaledNewCellY = newCellY * currentScale;
    const newScreenX = rect.left + scaledNewCellX + currentStageX;
    const newScreenY = rect.top + scaledNewCellY + currentStageY;
    const newScreenWidth = newCellWidth * currentScale;
    const newScreenHeight = newCellHeight * currentScale;

    // Update textarea position and size
    Object.assign(textarea.style, {
      left: `${newScreenX + 4}px`,
      top: `${newScreenY + 4}px`,
      width: `${Math.max(60, newScreenWidth - 8)}px`,
      height: `${Math.max(20, newScreenHeight - 8)}px`,
      fontSize: `${Math.max(12, currentElement.style.fontSize * currentScale)}px`,
    });
  };

  // Initial positioning
  Object.assign(textarea.style, {
    position: 'absolute',
    left: `${screenX + 4}px`,
    top: `${screenY + 4}px`,
    width: `${Math.max(60, screenWidth - 8)}px`,
    height: `${Math.max(20, screenHeight - 8)}px`,
    border: '2px solid #4F46E5',
    borderRadius: '3px',
    outline: 'none',
    resize: 'none',
    background: '#ffffff',
    color: '#333333',
    fontFamily: tableElement.style.fontFamily,
    fontSize: `${Math.max(12, tableElement.style.fontSize * scale)}px`,
    lineHeight: '1.2',
    padding: '2px 4px',
    textAlign: 'center',
    verticalAlign: 'middle',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '10000',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  } as CSSStyleDeclaration);

  // Get current cell text
  const cellIndex = row * tableElement.cols + col;
  const currentText = tableElement.cells[cellIndex]?.text || '';
  textarea.value = currentText;

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  // Track if commit has already been called to prevent multiple calls
  let isCommitted = false;

  // Commit changes
  const commit = (canceled: boolean) => {
    if (isCommitted) return;
    isCommitted = true;

    const newText = textarea.value.trim();

    // Remove textarea from DOM
    if (textarea.parentElement) {
      textarea.remove();
    }

    // Remove from tracking
    (window as any).activeCellEditors.forEach((editor: ActiveCellEditor) => {
      if (editor.element === textarea) {
        (window as any).activeCellEditors.delete(editor);
      }
    });

    if (!canceled && newText !== currentText) {
      // Update cell in store
      const store = useUnifiedCanvasStore.getState();
      const currentElement = store.elements.get(tableId) as TableElement;
      if (currentElement) {
        const newCells = [...(currentElement.cells || [])];
        while (newCells.length <= cellIndex) {
          newCells.push({ text: "" });
        }
        newCells[cellIndex] = { text: newText };

        if (store.withUndo) {
          store.withUndo(`Edit cell (${row},${col})`, () => {
            store.updateElement(tableId, { cells: newCells }, { pushHistory: false });
          });
        } else {
          store.updateElement(tableId, { cells: newCells });
        }
      }
    }
  };

  const cleanup = () => {
    if (textarea.parentElement) {
      textarea.remove();
    }
  };

  // Event handlers
  textarea.addEventListener('keydown', (e) => {
    // CRITICAL FIX: Stop propagation for ALL keydown events to prevent keyboard shortcuts
    e.stopPropagation();

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commit(false);

      // Navigate to next cell
      const nextCol = (col + 1) % tableElement.cols;
      const nextRow = nextCol === 0 ? row + 1 : row;

      if (nextRow < tableElement.rows) {
        setTimeout(() => {
          openCellEditorWithTracking(stage, tableId, tableElement, nextRow, nextCol);
        }, 50);
      }
    }
    // For all other keys (including 'h'), allow normal text input behavior
    // and prevent canvas keyboard shortcuts by stopping propagation
  });

  // Also prevent keyup events from bubbling to prevent any remaining shortcuts
  textarea.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });

  // Prevent keypress events from bubbling as well
  textarea.addEventListener('keypress', (e) => {
    e.stopPropagation();
  });

  textarea.addEventListener('blur', () => {
    // Add small delay to prevent race conditions with keydown events
    setTimeout(() => commit(false), 10);
  }, { once: true });

  // Add to tracking system
  const editorData: ActiveCellEditor = {
    element: textarea,
    tableId,
    row,
    col,
    stage,
    cleanup
  };

  (window as any).activeCellEditors.add(editorData);

  // Set up live position updates (expose update function)
  (editorData as any).updatePosition = updateTextareaPosition;
}

// Expose both the original and tracked versions
(window as any).openCellEditor = openCellEditor;
(window as any).openCellEditorWithTracking = openCellEditorWithTracking;
