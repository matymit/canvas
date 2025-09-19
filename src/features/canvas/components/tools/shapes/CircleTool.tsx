import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { openShapeTextEditor } from '../../../utils/editors/openShapeTextEditor';

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

// FigJam-like default sizes (matches sticky note sizing)
const FIGJAM_CIRCLE_SIZE = { width: 160, height: 160 }; // Same as your sticky note reference

// Safety limits to prevent extreme dimensions
const MAX_DIMENSION = 5000;
const MIN_DIMENSION = 10;
const MIN_SCALE = 0.01; // Prevent division by extremely small scale values


export const CircleTool: React.FC<CircleToolProps> = ({ isActive, stageRef, toolId = 'draw-circle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const replaceSelectionWithSingle = useUnifiedCanvasStore((s: any) => s.replaceSelectionWithSingle);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  // Debug logging
  console.log('[CircleTool] Tool state:', {
    isActive,
    selectedTool,
    toolId,
    hasStageRef: !!stageRef.current,
    hasUpsertElement: !!upsertElement,
    hasReplaceSelection: !!replaceSelectionWithSingle
  });

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
      console.log('[CircleTool] Pointer down triggered');
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) {
        console.warn('[CircleTool] Missing pointer position or preview layer:', { pos, previewLayer });
        return;
      }

      console.log('[CircleTool] Starting circle creation at:', pos);
      drawingRef.current.start = { x: pos.x, y: pos.y };

      // Size accounting for current zoom level
      const scale = stage.scaleX();
      const strokeWidthScaled = strokeWidth / scale;

      const circle = new Konva.Circle({
        x: pos.x,
        y: pos.y,
        radius: 0,
        stroke: strokeColor,
        strokeWidth: strokeWidthScaled,
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

      // For perfect circles, use the larger dimension for radius
      const maxDimension = Math.max(w, h);
      const radius = maxDimension / 2;

      circle.position({ x: x + maxDimension / 2, y: y + maxDimension / 2 });
      circle.radius(radius); // Use single radius for Konva.Circle
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

      // Remove preview
      circle.remove();
      previewLayer.batchDraw();

      // If click without drag, create default FigJam-sized circle
      // Scale size inversely with zoom to maintain consistent visual size
      const scale = Math.max(MIN_SCALE, stage.scaleX()); // Prevent division by tiny values
      const visualWidth = Math.min(MAX_DIMENSION, FIGJAM_CIRCLE_SIZE.width / scale);
      const visualHeight = Math.min(MAX_DIMENSION, FIGJAM_CIRCLE_SIZE.height / scale);

      if (w < 8 && h < 8) {
        // Single click - center the shape at click point
        x = start.x - visualWidth / 2;
        y = start.y - visualHeight / 2;
        w = visualWidth;
        h = visualWidth; // Use same dimension for perfect circle
      } else {
        // Dragged - use larger dimension for perfect circle
        const minSize = Math.max(MIN_DIMENSION, 40 / scale);
        const maxDimension = Math.max(w, h, minSize);
        const safeDimension = Math.min(MAX_DIMENSION, maxDimension);
        w = safeDimension;
        h = safeDimension;
        // Adjust position to center the circle
        x = Math.min(start.x, pos.x) + (Math.abs(pos.x - start.x) - safeDimension) / 2;
        y = Math.min(start.y, pos.y) + (Math.abs(pos.y - start.y) - safeDimension) / 2;
      }

      // Create element in store
      const id = `circle-${Date.now()}`;
      console.log('[CircleTool] Creating circle element:', { id, x, y, w, h });

      if (upsertElement) {
        try {
          const element = upsertElement({
            id,
            type: 'circle',
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

          console.log('[CircleTool] Element created:', element);

          // Select the new circle
          try {
            console.log('[CircleTool] Attempting to select element:', id);
            replaceSelectionWithSingle?.(id as any);
            console.log('[CircleTool] Selection successful');
          } catch (e) {
            console.error('[CircleTool] Selection failed:', e);
          }

          // Auto-switch to select tool and open text editor
          setSelectedTool?.('select');

          // Longer delay to ensure element is fully rendered and selected before opening editor
          setTimeout(() => {
            console.log('[CircleTool] Opening text editor for:', id);
            openShapeTextEditor(stage, id);
          }, 200);
        } catch (error) {
          console.error('[CircleTool] Error creating element:', error);
        }
      } else {
        console.error('[CircleTool] No upsertElement function available!');
      }
    };

    // Attach handlers
    stage.on('pointerdown.circletool', onPointerDown);

    return () => {
      stage.off('pointerdown.circletool');
      stage.off('pointermove.circletool');
      stage.off('pointerup.circletool');

      // Cleanup preview
      if (drawingRef.current.circle) {
        drawingRef.current.circle.destroy();
        drawingRef.current.circle = null;
      }
      drawingRef.current.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool, replaceSelectionWithSingle]);

  return null;
};

export default CircleTool;