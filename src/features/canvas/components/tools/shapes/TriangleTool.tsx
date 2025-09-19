import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { openShapeTextEditor } from '../../../utils/editors/openShapeTextEditor';

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

// FigJam-like default sizes (matches sticky note sizing)
const FIGJAM_TRIANGLE_SIZE = { width: 160, height: 140 }; // Slightly taller than wide for triangle

// Safety limits to prevent extreme dimensions
const MAX_DIMENSION = 5000;
const MIN_DIMENSION = 10;
const MIN_SCALE = 0.01; // Prevent division by extremely small scale values


export const TriangleTool: React.FC<TriangleToolProps> = ({ isActive, stageRef, toolId = 'draw-triangle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const replaceSelectionWithSingle = useUnifiedCanvasStore((s: any) => s.replaceSelectionWithSingle);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const drawingRef = useRef<{
    triangle: Konva.Shape | null;
    start: { x: number; y: number } | null;
  }>({ triangle: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    // Remove the makeTrianglePoints function since we'll use sceneFunc instead

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) return;

      drawingRef.current.start = { x: pos.x, y: pos.y };

      // Size accounting for current zoom level
      const scale = stage.scaleX();
      const strokeWidthScaled = strokeWidth / scale;

      const triangle = new Konva.Shape({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: strokeColor,
        strokeWidth: strokeWidthScaled,
        fill: fillColor,
        listening: false,
        perfectDrawEnabled: false,
        name: 'tool-preview-triangle',
        sceneFunc: function(context, shape) {
          const w = shape.width();
          const h = shape.height();

          // Draw isosceles triangle with proper geometry (same as ShapeRenderer)
          context.beginPath();
          context.moveTo(w / 2, 0);        // top center
          context.lineTo(0, h);            // bottom left
          context.lineTo(w, h);            // bottom right
          context.closePath();

          // Fill and stroke the shape
          context.fillStrokeShape(shape);
        }
      });

      drawingRef.current.triangle = triangle;
      previewLayer.add(triangle);
      previewLayer.batchDraw();

      stage.on('pointermove.triangletool', onPointerMove);
      stage.on('pointerup.triangletool', onPointerUp);
    };

    const onPointerMove = () => {
      const pos = stage.getPointerPosition();
      const layer = previewLayer;
      const triangle = drawingRef.current.triangle;
      const start = drawingRef.current.start;
      if (!pos || !layer || !triangle || !start) return;

      // Calculate bounds
      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      // Update triangle shape position and dimensions
      triangle.setAttrs({
        x,
        y,
        width: w,
        height: h
      });
      layer.batchDraw();
    };

    const onPointerUp = () => {
      stage.off('pointermove.triangletool');
      stage.off('pointerup.triangletool');

      const triangle = drawingRef.current.triangle;
      const start = drawingRef.current.start;
      const pos = stage.getPointerPosition();
      drawingRef.current.triangle = null;
      drawingRef.current.start = null;

      if (!triangle || !start || !pos || !previewLayer) return;

      let x = Math.min(start.x, pos.x);
      let y = Math.min(start.y, pos.y);
      let w = Math.abs(pos.x - start.x);
      let h = Math.abs(pos.y - start.y);

      // Remove preview
      triangle.remove();
      previewLayer.batchDraw();

      // If click without drag, create default FigJam-sized triangle
      // Scale size inversely with zoom to maintain consistent visual size
      const scale = Math.max(MIN_SCALE, stage.scaleX()); // Prevent division by tiny values
      const visualWidth = Math.min(MAX_DIMENSION, FIGJAM_TRIANGLE_SIZE.width / scale);
      const visualHeight = Math.min(MAX_DIMENSION, FIGJAM_TRIANGLE_SIZE.height / scale);

      if (w < 8 && h < 8) {
        // Single click - center the shape at click point
        x = start.x - visualWidth / 2;
        y = start.y - visualHeight / 2;
        w = visualWidth;
        h = visualHeight;
      } else {
        // Dragged - use actual dimensions but ensure minimum size
        const minSize = Math.max(MIN_DIMENSION, 40 / scale);
        w = Math.max(minSize, Math.min(MAX_DIMENSION, w));
        h = Math.max(minSize, Math.min(MAX_DIMENSION, h));
      }

      // Create element in store
      const id = `triangle-${Date.now()}`;
      if (upsertElement) {
        upsertElement({
          id,
          type: 'triangle',
          x,
          y,
          width: w,
          height: h,
          bounds: { x, y, width: w, height: h },
          draggable: true,
          text: '', // Start with empty text
          data: { text: '' },
          style: {
            stroke: strokeColor,
            strokeWidth,
            fill: fillColor,
          },
        } as any);

        // Select the new triangle
        try {
          console.log('[TriangleTool] Attempting to select element:', id);
          replaceSelectionWithSingle?.(id as any);
          console.log('[TriangleTool] Selection successful');
        } catch (e) {
          console.error('[TriangleTool] Selection failed:', e);
        }

        // Auto-switch to select tool and open text editor
        setSelectedTool?.('select');

        // Small delay to ensure element is rendered before opening editor
        setTimeout(() => {
          console.log('[TriangleTool] Opening text editor for:', id);
          openShapeTextEditor(stage, id);
        }, 100);
      }
    };

    // Attach handlers
    stage.on('pointerdown.triangletool', onPointerDown);

    return () => {
      stage.off('pointerdown.triangletool');
      stage.off('pointermove.triangletool');
      stage.off('pointerup.triangletool');

      // Cleanup preview
      if (drawingRef.current.triangle) {
        drawingRef.current.triangle.destroy();
        drawingRef.current.triangle = null;
      }
      drawingRef.current.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool, replaceSelectionWithSingle]);

  return null;
};

export default TriangleTool;