import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

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
  const getSelectedTool = useUnifiedCanvasStore((s) => s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.ui?.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element.upsert);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const drawingRef = useRef<{
    rect: Konva.Rect | null;
    start: { x: number; y: number } | null;
  }>({ rect: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && getSelectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) return;

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

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      // remove preview
      rect.remove();
      previewLayer.batchDraw();

      // Ignore clicks that didn't drag enough
      if (w < 2 || h < 2) return;

      // Commit to store; the renderer will update main layer
      upsertElement?.({
        id: `rect-${Date.now()}`,
        type: 'rectangle',
        x,
        y,
        width: w,
        height: h,
        bounds: { x, y, width: w, height: h },
        style: {
          stroke: strokeColor,
          strokeWidth,
          fill: fillColor,
        },
      });

      // Auto-switch back to select
      setSelectedTool?.('select');
    };

    // Attach handlers on stage
    stage.on('pointerdown.recttool', onPointerDown);

    return () => {
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
  }, [isActive, getSelectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool]);

  return null;
};

export default RectangleTool;