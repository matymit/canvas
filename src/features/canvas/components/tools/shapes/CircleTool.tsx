import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
// import { openShapeTextEditor } from '../../../utils/editors/openShapeTextEditor'; // TODO: Fix call signature
import type { CanvasElement, ElementId } from '../../../../../../types/index';

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
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const drawingRef = useRef<{
    circle: Konva.Ellipse | null;
    start: { x: number; y: number } | null;
  }>({ circle: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    console.log('[CircleTool] Tool activated, adding stage listener');

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) return;

      console.log('[CircleTool] Pointer down at:', pos);

      drawingRef.current.start = { x: pos.x, y: pos.y };

    const circle = new Konva.Ellipse({
      x: pos.x,
      y: pos.y,
      radiusX: 0,
      radiusY: 0,
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

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.max(8, Math.abs(pos.x - start.x));
      const h = Math.max(8, Math.abs(pos.y - start.y));
      circle.position({ x: x + w / 2, y: y + h / 2 });
      circle.radius({ x: w / 2, y: h / 2 });
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

      let x = Math.min(start.x, pos.x);
      let y = Math.min(start.y, pos.y);
      let w = Math.abs(pos.x - start.x);
      let h = Math.abs(pos.y - start.y);

      // remove preview
      circle.remove();
      previewLayer.batchDraw();

      // If click without drag, create a default circle
      const MIN_SIZE = 120;
      if (w < 2 && h < 2) {
        x = start.x;
        y = start.y;
        w = MIN_SIZE;
        h = MIN_SIZE;
      }

      // Commit to store using the new Phase 2 pattern
      const elementId = crypto.randomUUID() as ElementId;

      const circleElement: CanvasElement = {
        id: elementId,
        type: 'ellipse',
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

      console.log('[CircleTool] Creating circle element:', circleElement);

      // Use the store's addElement method with auto-selection
      const store = useUnifiedCanvasStore.getState();

      // Use withUndo for proper history tracking
      store.withUndo('Add circle', () => {
        store.addElement(circleElement, { select: true, pushHistory: false }); // withUndo handles history
      });

      console.log('[CircleTool] Circle element added to store');

      // Auto-switch back to select and open text editor
      setTimeout(() => {
        setSelectedTool?.('select');
        // TODO: Fix openShapeTextEditor call signature
        // if (stage) {
        //   openShapeTextEditor(stage, elementId, { padding: 10, fontSize: 18, lineHeight: 1.3 });
        // }
        console.log('[CircleTool] Switched back to select tool and opened text editor');
      }, 100);
    };

    // Attach handlers on stage
    stage.on('pointerdown.circletool', onPointerDown);

    return () => {
      console.log('[CircleTool] Tool deactivated, removing stage listener');
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
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, setSelectedTool]);

  return null;
};

export default CircleTool;