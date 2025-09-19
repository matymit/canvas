import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { openShapeTextEditor } from '../../../utils/editors/openShapeTextEditor';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface RectangleToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'draw-rectangle'
}

function getNamedOrIndexedLayer(stage: Konva.Stage, name: string, indexFallback: number): Konva.Layer | null {
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

// FigJam-like default sizes (matches sticky note sizing)
const FIGJAM_RECT_SIZE = { width: 200, height: 120 }; // Slightly wider than tall like FigJam

// Safety limits to prevent extreme dimensions
const MAX_DIMENSION = 5000;
const MIN_DIMENSION = 10;
const MIN_SCALE = 0.01; // Prevent division by extremely small scale values


export const RectangleTool: React.FC<RectangleToolProps> = ({ isActive, stageRef, toolId = 'draw-rectangle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const replaceSelectionWithSingle = useUnifiedCanvasStore((s: any) => s.replaceSelectionWithSingle);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  // Debug logging
  console.log('[RectangleTool] Tool state:', {
    isActive,
    selectedTool,
    toolId,
    hasStageRef: !!stageRef.current,
    hasUpsertElement: !!upsertElement,
    hasReplaceSelection: !!replaceSelectionWithSingle
  });

  const drawingRef = useRef<{
    rect: Konva.Rect | null;
    start: { x: number; y: number } | null;
  }>({ rect: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const onPointerDown = () => {
      console.log('[RectangleTool] Pointer down triggered');
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) {
        console.warn('[RectangleTool] Missing pointer position or preview layer:', { pos, previewLayer });
        return;
      }

      console.log('[RectangleTool] Starting rectangle creation at:', pos);
      drawingRef.current.start = { x: pos.x, y: pos.y };

      // Size accounting for current zoom level
      const scale = stage.scaleX();
      const strokeWidthScaled = strokeWidth / scale;

      const rect = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: strokeColor,
        strokeWidth: strokeWidthScaled,
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

      // Remove preview
      rect.remove();
      previewLayer.batchDraw();

      // If click without drag, create default FigJam-sized rectangle
      // Scale size inversely with zoom to maintain consistent visual size
      const scale = Math.max(MIN_SCALE, stage.scaleX()); // Prevent division by tiny values
      const visualWidth = Math.min(MAX_DIMENSION, FIGJAM_RECT_SIZE.width / scale);
      const visualHeight = Math.min(MAX_DIMENSION, FIGJAM_RECT_SIZE.height / scale);

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
      const id = `rect-${Date.now()}`;
      console.log('[RectangleTool] Creating rectangle element:', { id, x, y, w, h });

      if (upsertElement) {
        try {
          const element = upsertElement({
            id,
            type: 'rectangle',
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

          console.log('[RectangleTool] Element created:', element);

          // Select the new rectangle
          try {
            console.log('[RectangleTool] Attempting to select element:', id);
            replaceSelectionWithSingle?.(id as any);
            console.log('[RectangleTool] Selection successful');
          } catch (e) {
            console.error('[RectangleTool] Selection failed:', e);
          }

          // Auto-switch to select tool and open text editor
          setSelectedTool?.('select');

          // Small delay to ensure element is rendered before opening editor
          setTimeout(() => {
            console.log('[RectangleTool] Opening text editor for:', id);
            openShapeTextEditor(stage, id);
          }, 100);
        } catch (error) {
          console.error('[RectangleTool] Error creating element:', error);
        }
      } else {
        console.error('[RectangleTool] No upsertElement function available!');
      }
    };

    // Attach handlers
    stage.on('pointerdown.recttool', onPointerDown);

    return () => {
      stage.off('pointerdown.recttool');
      stage.off('pointermove.recttool');
      stage.off('pointerup.recttool');

      // Cleanup preview
      if (drawingRef.current.rect) {
        drawingRef.current.rect.destroy();
        drawingRef.current.rect = null;
      }
      drawingRef.current.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool, replaceSelectionWithSingle]);

  return null;
};

export default RectangleTool;