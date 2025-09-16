// Table tool for creating FigJam-style tables with preview/commit and auto-select functionality
// Follows existing tool patterns with four-layer usage and unified store integration

import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { nanoid } from "nanoid";
import type { TableElement } from "../../../types/elements/table";
import { createEmptyTable, DEFAULT_TABLE_STYLE, DEFAULT_TABLE_CONFIG } from "../../../types/elements/table";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TableToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // e.g., "table"
}

function getNamedOrIndexedLayer(stage: Konva.Stage, name: string, indexFallback: number): Konva.Layer | null {
  // Try by name or id; fallback to index if not named
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

export const TableTool: React.FC<TableToolProps> = ({ isActive, stageRef, toolId = "table" }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const replaceSelectionWithSingle = useUnifiedCanvasStore((s) => s.replaceSelectionWithSingle);

  const drawingRef = useRef<{
    start: { x: number; y: number } | null;
    preview: Konva.Group | null;
  }>({ start: null, preview: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer = getNamedOrIndexedLayer(stage, 'preview', 2) || 
                        stage.getLayers()[stage.getLayers().length - 2] || 
                        stage.getLayers()[0];

    if (!previewLayer) return;

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      drawingRef.current.start = { x: pos.x, y: pos.y };

      // Create minimal preview: outer rect and inner grid lines
      const g = new Konva.Group({ listening: false, name: "table-preview" });
      
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

      stage.on('pointermove.tabletool', onPointerMove);
      stage.on('pointerup.tabletool', onPointerUp);
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
        
        // Add grid lines preview for better visual feedback
        updateGridPreview(g, w, h);
      }
      previewLayer.batchDraw();
    };

    const commit = (x: number, y: number, w: number, h: number) => {
      // Create table with proper dimensions
      const tableData = createEmptyTable(x, y, w, h);
      const id = nanoid();
      
      const elementData = {
        ...tableData,
        id,
        type: "table" as const,
        // Convert to CanvasElement format
        bounds: { x, y, width: w, height: h },
        data: {
          rows: tableData.rows,
          cols: tableData.cols,
          colWidths: tableData.colWidths,
          rowHeights: tableData.rowHeights,
          cells: tableData.cells,
          style: tableData.style,
        }
      };
      
      upsertElement?.(elementData);

      // Auto-select and switch back to select tool
      if (replaceSelectionWithSingle) {
        replaceSelectionWithSingle(id);
      }
      setSelectedTool("select");
      
      // Open first cell editor after a brief delay to ensure rendering
      setTimeout(() => openFirstCellEditor(stage, id, tableData as TableElement), 50);
    };

    const onPointerUp = () => {
      stage.off('pointermove.tabletool');
      stage.off('pointerup.tabletool');

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

      // Click without drag -> default size
      const { minWidth, minHeight } = DEFAULT_TABLE_CONFIG;
      const finalW = w < 4 ? minWidth : Math.max(minWidth, w);
      const finalH = h < 4 ? minHeight : Math.max(minHeight, h);
      
      commit(x, y, finalW, finalH);
    };

    stage.on('pointerdown.tabletool', onPointerDown);

    return () => {
      stage.off('pointerdown.tabletool', onPointerDown);
      stage.off('pointermove.tabletool', onPointerMove);
      stage.off('pointerup.tabletool', onPointerUp);
      
      const g = drawingRef.current.preview;
      if (g) {
        g.destroy();
        drawingRef.current.preview = null;
      }
      drawingRef.current.start = null;
      previewLayer.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, upsertElement, setSelectedTool, replaceSelectionWithSingle]);

  return null;
};

export default TableTool;

// Helper function to update grid preview
function updateGridPreview(group: Konva.Group, width: number, height: number) {
  // Remove existing grid preview
  const existing = group.findOne('.grid-preview');
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
    name: 'grid-preview'
  });
  
  group.add(gridShape);
}

// Simple editor entry point for the first cell
function openFirstCellEditor(stage: Konva.Stage, tableId: string, tableModel: TableElement) {
  // Position at first cell's top-left with padding
  const px = tableModel.x + tableModel.style.paddingX;
  const py = tableModel.y + tableModel.style.paddingY;
  
  // Create a DOM textarea overlay at the cell position
  const container = stage.container();
  const rect = container.getBoundingClientRect();
  const stageTransform = stage.getAbsoluteTransform();
  
  // Transform table coordinates to screen coordinates
  const screenPos = stageTransform.point({ x: px, y: py });
  const left = rect.left + screenPos.x;
  const top = rect.top + screenPos.y;

  const textarea = document.createElement("textarea");
  Object.assign(textarea.style, {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    minWidth: "120px",
    minHeight: "28px",
    padding: "4px 6px",
    border: "2px solid #3B82F6",
    borderRadius: "4px",
    outline: "none",
    resize: "none",
    background: "#ffffff",
    color: tableModel.style.textColor,
    fontFamily: tableModel.style.fontFamily,
    fontSize: `${tableModel.style.fontSize}px`,
    lineHeight: "1.3",
    zIndex: "1000",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  } as CSSStyleDeclaration);
  
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const commit = (cancel: boolean) => {
    const value = textarea.value.trim();
    if (textarea.parentElement) {
      textarea.parentElement.removeChild(textarea);
    }
    
    if (cancel || value.length === 0) return;
    
    // Update cell (0,0) in store via element update
    const store = useUnifiedCanvasStore.getState();
    const updateElement = store.element?.update;
    if (updateElement) {
      updateElement(tableId, {
        data: {
          ...store.element.getById?.(tableId)?.data,
          cells: [
            { text: value },
            ...(store.element.getById?.(tableId)?.data?.cells?.slice(1) || [])
          ]
        }
      });
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      commit(true);
    }
    // Allow Shift+Enter for new lines within cell
  };
  
  const handleBlur = () => {
    commit(false);
  };

  textarea.addEventListener("keydown", handleKeyDown);
  textarea.addEventListener("blur", handleBlur, { once: true });
}