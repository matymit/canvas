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
  const replaceSelectionWithSingle = useUnifiedCanvasStore((s) => s.replaceSelectionWithSingle);
  const bumpSelectionVersion = useUnifiedCanvasStore((s) => s.bumpSelectionVersion);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  // Tool state debugging removed for production

  const drawingRef = useRef<{
    circle: Konva.Circle | null;
    start: { x: number; y: number } | null;
  }>({ circle: null, start: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    // Capture ref value to avoid stale closure issues in cleanup
    const drawingRefCapture = drawingRef.current;

    const previewLayer =
      getNamedOrIndexedLayer(stage, 'preview', 2) || stage.getLayers()[stage.getLayers().length - 2] || stage.getLayers()[0];

    const onPointerDown = () => {
      // Pointer down triggered
      const pos = stage.getPointerPosition();
      if (!pos || !previewLayer) {
        // Missing pointer position or preview layer
        return;
      }

      // Starting circle creation
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

      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      // Remove preview
      circle.remove();
      previewLayer.batchDraw();

      // If click without drag, create default FigJam-sized circle
      // Scale size inversely with zoom to maintain consistent visual size
      const scale = Math.max(MIN_SCALE, stage.scaleX()); // Prevent division by tiny values
      const visualWidth = Math.min(MAX_DIMENSION, FIGJAM_CIRCLE_SIZE.width / scale);

      let centerX: number;
      let centerY: number;
      let diameter: number;

      if (w < 8 && h < 8) {
        // Single click - center the circle at click point
        centerX = start.x;
        centerY = start.y;
        diameter = visualWidth; // Use consistent diameter
      } else {
        // Dragged - use larger dimension for perfect circle
        const minSize = Math.max(MIN_DIMENSION, 40 / scale);
        const maxDimension = Math.max(w, h, minSize);
        diameter = Math.min(MAX_DIMENSION, maxDimension);
        // Calculate center of the dragged area
        centerX = (start.x + pos.x) / 2;
        centerY = (start.y + pos.y) / 2;
      }

      const radius = diameter / 2;
      
      // FIXED: Create element with proper center-based positioning and radius property
      const id = `circle-${Date.now()}`;
      // Creating circle element with center-based positioning

      if (upsertElement) {
        try {
          upsertElement({
            id,
            type: 'circle',
            // FIXED: Use center coordinates (Konva.Circle standard)
            x: centerX,
            y: centerY,
            // Include all dimension properties for compatibility
            width: diameter,
            height: diameter,
            bounds: {
              x: centerX - radius, // Bounds use top-left corner
              y: centerY - radius,
              width: diameter,
              height: diameter
            },
            draggable: true,
            text: '', // Start with empty text
            data: {
              text: '',
              radius: radius, // CRITICAL: Store radius in data for proper text positioning
              radiusX: radius,
              radiusY: radius,
              padding: 0,
              textLineHeight: 1.25
            },
            style: {
              stroke: strokeColor,
              strokeWidth,
              fill: fillColor,
              fontSize: 20,
            },
          });

          // Select the new circle
          try {
            // Attempting to select element
            replaceSelectionWithSingle?.(id);
            bumpSelectionVersion?.();
            // Selection successful
          } catch (e) {
            // Selection failed
          }

          // Auto-switch to select tool and open text editor
          setSelectedTool?.('select');

          // Open editor immediately after element creation
          // The editor itself will handle waiting for rendering
          console.log('[CircleTool] About to schedule openShapeTextEditor for:', id);
          requestAnimationFrame(() => {
            console.log('[CircleTool] RAF callback executing - calling openShapeTextEditor for:', id);
            console.log('[CircleTool] Stage available:', !!stage);
            openShapeTextEditor(stage, id);
            console.log('[CircleTool] openShapeTextEditor call completed');
          });
        } catch (error) {
          // Error creating element
        }
      } else {
        // No upsertElement function available
      }
    };

    // Attach handlers
    stage.on('pointerdown.circletool', onPointerDown);

    return () => {
      stage.off('pointerdown.circletool');
      stage.off('pointermove.circletool');
      stage.off('pointerup.circletool');

      // Cleanup preview using captured ref value
      if (drawingRefCapture.circle) {
        drawingRefCapture.circle.destroy();
        drawingRefCapture.circle = null;
      }
      drawingRefCapture.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool, replaceSelectionWithSingle, bumpSelectionVersion]);

  return null;
};

export default CircleTool;
