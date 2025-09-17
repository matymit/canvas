import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface CircleToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'draw-circle'
}

function getNamedOrIndexedLayer(stage: Konva.Stage, name: string, indexFallback: number): Konva.Layer | null {
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

export const CircleTool: React.FC<CircleToolProps> = ({ isActive, stageRef, toolId = 'draw-circle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const replaceSelectionWithSingle = useUnifiedCanvasStore((s: any) => s.replaceSelectionWithSingle);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const drawingRef = useRef<{
    circle: Konva.Circle | null;
    start: { x: number; y: number } | null;
  }>({ circle: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) return;

      drawingRef.current.start = { x: pos.x, y: pos.y };

      const circle = new Konva.Circle({
        x: pos.x,
        y: pos.y,
        radius: 0,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        listening: false,
        perfectDrawEnabled: false,
        name: 'tool-preview-circle',
      });

      drawingRef.current.circle = circle;
      previewLayer.add(circle);
      previewLayer.batchDraw();

      stage.on('pointermove.circletool', onPointerMove);
      stage.on('pointerup.circletool', onPointerUp);
    };

    const onPointerMove = () => {
      const pos = stage.getPointerPosition();
      const layer = previewLayer;
      const circle = drawingRef.current.circle;
      const start = drawingRef.current.start;
      if (!pos || !layer || !circle || !start) return;

      const dx = pos.x - start.x;
      const dy = pos.y - start.y;
      const radius = Math.sqrt(dx * dx + dy * dy);

      circle.radius(radius);
      layer.batchDraw();
    };

    const onPointerUp = () => {
      stage.off('pointermove.circletool');
      stage.off('pointerup.circletool');

      const circle = drawingRef.current.circle;
      const start = drawingRef.current.start;
      const pos = stage.getPointerPosition();
      drawingRef.current.circle = null;
      drawingRef.current.start = null;

      if (!circle || !start || !pos || !previewLayer) return;

      const dx = pos.x - start.x;
      const dy = pos.y - start.y;
      let radius = Math.sqrt(dx * dx + dy * dy);

      // remove preview
      circle.remove();
      previewLayer.batchDraw();

      // If click without drag, create a minimal circle for test ergonomics
      const MIN_RADIUS = 20;
      if (radius < 2) {
        radius = MIN_RADIUS;
      }

      // Commit to store; the renderer will update main layer
      const id = `circle-${Date.now()}`;
      const diameter = radius * 2;
      upsertElement?.({
        id,
        type: 'circle',
        x: start.x - radius,
        y: start.y - radius,
        width: diameter,
        height: diameter,
        radius,
        bounds: { x: start.x - radius, y: start.y - radius, width: diameter, height: diameter },
        draggable: true,
        style: {
          stroke: strokeColor,
          strokeWidth,
          fill: fillColor,
        },
      } as any);

      // Select the new circle to ensure transformer sentinel appears
      try { replaceSelectionWithSingle?.(id as any); } catch {}

      // Auto-switch back to select
      setSelectedTool?.('select');
    };

    // Attach handlers on stage
    stage.on('pointerdown.circletool', onPointerDown);

    return () => {
      stage.off('pointerdown.circletool');
      stage.off('pointermove.circletool');
      stage.off('pointerup.circletool');

      // Cleanup preview if any
      if (drawingRef.current.circle) {
        drawingRef.current.circle.destroy();
        drawingRef.current.circle = null;
      }
      drawingRef.current.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool]);

  return null;
};

export default CircleTool;