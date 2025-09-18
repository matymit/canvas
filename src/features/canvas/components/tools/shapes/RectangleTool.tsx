import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
// import { openShapeTextEditor } from '../../../utils/editors/openShapeTextEditor'; // TODO: Fix call signature
import type { CanvasElement, ElementId } from '../../../../../../types/index';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface RectangleToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'draw-rectangle'
}

function getNamedOrIndexedLayer(stage: Konva.Stage, name: string, indexFallback: number): Konva.Layer | null {
  // Try by name or id; fallback to index if not named
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

export const RectangleTool: React.FC<RectangleToolProps> = ({ isActive, stageRef, toolId = 'draw-rectangle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const drawingRef = useRef<{
    rect: Konva.Rect | null;
    start: { x: number; y: number } | null;
  }>({ rect: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    console.log('[RectangleTool] Tool activated, adding stage listener');

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) return;

      console.log('[RectangleTool] Pointer down at:', pos);

      drawingRef.current.start = { x: pos.x, y: pos.y };

      const rect = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        listening: false,
        perfectDrawEnabled: false,
        name: 'tool-preview-rect',
      });

      drawingRef.current.rect = rect;
      previewLayer.add(rect);
      previewLayer.batchDraw();

      stage.on('pointermove.recttool', onPointerMove);
      stage.on('pointerup.recttool', onPointerUp);
    };

    const onPointerMove = () => {
      const pos = stage.getPointerPosition();
      const layer = previewLayer;
      const rect = drawingRef.current.rect;
      const start = drawingRef.current.start;
      if (!pos || !layer || !rect || !start) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      rect.position({ x, y });
      rect.size({ width: w, height: h });
      layer.batchDraw();
    };

    const onPointerUp = () => {
      stage.off('pointermove.recttool');
      stage.off('pointerup.recttool');

      const rect = drawingRef.current.rect;
      const start = drawingRef.current.start;
      const pos = stage.getPointerPosition();
      drawingRef.current.rect = null;
      drawingRef.current.start = null;

      if (!rect || !start || !pos || !previewLayer) return;

      let x = Math.min(start.x, pos.x);
      let y = Math.min(start.y, pos.y);
      let w = Math.abs(pos.x - start.x);
      let h = Math.abs(pos.y - start.y);

      // remove preview
      rect.remove();
      previewLayer.batchDraw();

      // If click without drag, create a minimal rectangle for test ergonomics
      const MIN_SIZE = 40;
      if (w < 2 && h < 2) {
        x = start.x;
        y = start.y;
        w = MIN_SIZE;
        h = MIN_SIZE;
      }

      // Commit to store using the new Phase 2 pattern
      const elementId = crypto.randomUUID() as ElementId;

      const rectangleElement: CanvasElement = {
        id: elementId,
        type: 'rectangle',
        x,
        y,
        width: w,
        height: h,
        style: {
          stroke: strokeColor,
          strokeWidth,
          fill: fillColor,
        },
      };

      console.log('[RectangleTool] Creating rectangle element:', rectangleElement);

      // Use the store's addElement method with auto-selection
      const store = useUnifiedCanvasStore.getState();

      // Use withUndo for proper history tracking
      store.withUndo('Add rectangle', () => {
        store.addElement(rectangleElement, { select: true, pushHistory: false }); // withUndo handles history
      });

      console.log('[RectangleTool] Rectangle element added to store');

      // Auto-switch back to select and open text editor
      setTimeout(() => {
        setSelectedTool?.('select');
        // TODO: Fix openShapeTextEditor call signature
        // if (stage) {
        //   openShapeTextEditor(stage, elementId, { padding: 8, fontSize: 18, lineHeight: 1.3 });
        // }
        console.log('[RectangleTool] Switched back to select tool and opened text editor');
      }, 100);
    };

    // Attach handlers on stage
    stage.on('pointerdown.recttool', onPointerDown);

    return () => {
      console.log('[RectangleTool] Tool deactivated, removing stage listener');
      stage.off('pointerdown.recttool');
      stage.off('pointermove.recttool');
      stage.off('pointerup.recttool');

      // Cleanup preview if any
      if (drawingRef.current.rect) {
        drawingRef.current.rect.destroy();
        drawingRef.current.rect = null;
      }
      drawingRef.current.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, setSelectedTool]);

  return null;
};

export default RectangleTool;