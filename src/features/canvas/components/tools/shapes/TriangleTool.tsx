import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TriangleToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'draw-triangle'
}

function getNamedOrIndexedLayer(stage: Konva.Stage, name: string, indexFallback: number): Konva.Layer | null {
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

export const TriangleTool: React.FC<TriangleToolProps> = ({ isActive, stageRef, toolId = 'draw-triangle' }) => {
  const getSelectedTool = useUnifiedCanvasStore((s) => s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.ui?.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element.upsert);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const drawingRef = useRef<{
    tri: Konva.Line | null;
    start: { x: number; y: number } | null;
  }>({ tri: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && getSelectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const makePoints = (sx: number, sy: number, ex: number, ey: number): number[] => {
      const x = Math.min(sx, ex);
      const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx);
      const h = Math.abs(ey - sy);

      // Isosceles triangle: top vertex centered, base along bottom
      const p1 = { x: x + w / 2, y };       // top
      const p2 = { x, y: y + h };           // bottom-left
      const p3 = { x: x + w, y: y + h };    // bottom-right
      return [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y];
    };

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) return;

      drawingRef.current.start = { x: pos.x, y: pos.y };

      const tri = new Konva.Line({
        points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y],
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        closed: true,
        listening: false,
        perfectDrawEnabled: false,
        name: 'tool-preview-triangle',
      });

      drawingRef.current.tri = tri;
      previewLayer.add(tri);
      previewLayer.batchDraw();

      stage.on('pointermove.tritool', onPointerMove);
      stage.on('pointerup.tritool', onPointerUp);
    };

    const onPointerMove = () => {
      const pos = stage.getPointerPosition();
      const layer = previewLayer;
      const tri = drawingRef.current.tri;
      const start = drawingRef.current.start;
      if (!pos || !layer || !tri || !start) return;

      tri.points(makePoints(start.x, start.y, pos.x, pos.y));
      layer.batchDraw();
    };

    const onPointerUp = () => {
      stage.off('pointermove.tritool');
      stage.off('pointerup.tritool');

      const tri = drawingRef.current.tri;
      const start = drawingRef.current.start;
      const pos = stage.getPointerPosition();
      drawingRef.current.tri = null;
      drawingRef.current.start = null;

      if (!tri || !start || !pos || !previewLayer) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      // remove preview
      tri.remove();
      previewLayer.batchDraw();

      if (w < 2 || h < 2) return;

      // Commit to store; renderer will update main layer
      upsertElement?.({
        id: `triangle-${Date.now()}`,
        type: 'triangle',
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

    stage.on('pointerdown.tritool', onPointerDown);

    return () => {
      stage.off('pointerdown.tritool');
      stage.off('pointermove.tritool');
      stage.off('pointerup.tritool');

      if (drawingRef.current.tri) {
        drawingRef.current.tri.destroy();
        drawingRef.current.tri = null;
      }
      drawingRef.current.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, getSelectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool]);

  return null;
};

export default TriangleTool;