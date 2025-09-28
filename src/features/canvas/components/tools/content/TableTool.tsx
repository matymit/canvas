// Table tool for creating FigJam-style tables with preview/commit and auto-select functionality
// Follows existing tool patterns with four-layer usage and unified store integration

import type React from "react";
import { useEffect, useRef } from "react";
import Konva from "konva";
import { nanoid } from "nanoid";
import type { TableElement } from "../../../types/table";
import {
  createEmptyTable,
  DEFAULT_TABLE_STYLE,
  DEFAULT_TABLE_CONFIG,
} from "../../../types/table";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { openCellEditorWithTracking } from "../../../utils/editors/openCellEditorWithTracking";

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
  const selectedTool = useUnifiedCanvasStore((s) => s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.ui?.setSelectedTool);

  const drawingRef = useRef<{
    start: { x: number; y: number } | null;
    preview: Konva.Group | null;
  }>({ start: null, preview: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    // Capture ref value to avoid stale closure issues in cleanup
    const drawingRefCapture = drawingRef.current;

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
      const viewport = useUnifiedCanvasStore.getState().viewport;
      const toWorld = viewport?.stageToWorld;

      const topLeftWorld = toWorld ? toWorld(x, y) : { x, y };
      const bottomRightWorld = toWorld
        ? toWorld(x + w, y + h)
        : { x: x + w, y: y + h };

      let worldX = Math.min(topLeftWorld.x, bottomRightWorld.x);
      let worldY = Math.min(topLeftWorld.y, bottomRightWorld.y);
      let worldWidth = Math.abs(bottomRightWorld.x - topLeftWorld.x);
      let worldHeight = Math.abs(bottomRightWorld.y - topLeftWorld.y);

      const { minWidth, minHeight } = DEFAULT_TABLE_CONFIG;
      if (worldWidth < minWidth) {
        const centerX = worldX + worldWidth / 2;
        worldWidth = minWidth;
        worldX = centerX - worldWidth / 2;
      }
      if (worldHeight < minHeight) {
        const centerY = worldY + worldHeight / 2;
        worldHeight = minHeight;
        worldY = centerY - worldHeight / 2;
      }

      const tableData = createEmptyTable(worldX, worldY, worldWidth, worldHeight);
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

      setSelectedTool?.("select");
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

      commit(x, y, w, h);
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

      const g = drawingRefCapture.preview;
      if (g) {
        g.destroy();
        drawingRefCapture.preview = null;
      }
      drawingRefCapture.start = null;
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
    sceneFunc: (ctx: Konva.Context, shape: Konva.Shape) => {
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
  openCellEditorWithTracking({
    stage,
    elementId: tableId,
    element: tableElement,
    getElement: () => {
      const element = useUnifiedCanvasStore.getState().element.getById?.(tableId);
      return element as TableElement;
    },
    row: 0,
    col: 0,
  });
}

// Cell editing is now handled by the centralized openCellEditorWithTracking utility
// All duplicate implementations have been removed to prevent conflicts
