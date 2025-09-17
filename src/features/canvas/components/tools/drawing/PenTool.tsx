import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

export interface PenToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  color?: string;
  size?: number;
  opacity?: number;
}

function getMainLayer(stage: Konva.Stage | null): Konva.Layer | null {
  if (!stage) return null;
  // Assumes four-layer architecture: [background, main, preview, overlay]
  const layers = stage.getLayers();
  return layers[1] as Konva.Layer | null;
}

function ensureOverlayOnTop(stage: Konva.Stage | null) {
  if (!stage) return;
  const layers = stage.getLayers();
  const overlay = layers[3] as Konva.Layer | undefined;
  if (overlay) overlay.moveToTop();
}

export const PenTool: React.FC<PenToolProps> = ({
  stageRef,
  isActive,
  color = '#111827',
  size = 2,
  opacity = 1.0,
}) => {
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const withUndo = useUnifiedCanvasStore((s) => s.withUndo);
  const previewLayerRef = useRef<Konva.Layer | null>(null);
  const lineRef = useRef<Konva.Line | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<number[]>([]);
  const rafPendingRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Use existing preview layer (four-layer pipeline: [background, main, preview, overlay])
    const layers = stage.getLayers();
    const previewLayer = (layers[2] as Konva.Layer) ?? new Konva.Layer({ listening: false });
    // Only add if missing (should not happen in our pipeline)
    if (!previewLayer.getStage()) stage.add(previewLayer);
    previewLayerRef.current = previewLayer;
    ensureOverlayOnTop(stage);

    const commitStroke = () => {
      const stageNow = stageRef.current;
      const line = lineRef.current;
      if (!stageNow || !line) return;

      // Move the finished stroke into the main layer for persistence/selection.
      const main = getMainLayer(stageNow);
      if (main) {
        line.listening(true); // Enable hit detection once committed.
        line.moveTo(main);
        main.batchDraw();
      } else {
        // Fallback: keep it on stage if main layer is not available.
        line.moveToTop();
        stageNow.draw();
      }

      // Also save to unified store for persistence with undo support
      if (upsertElement && withUndo && pointsRef.current.length >= 4) {
        const bounds = {
          x: Math.min(...pointsRef.current.filter((_, i) => i % 2 === 0)),
          y: Math.min(...pointsRef.current.filter((_, i) => i % 2 === 1)),
          width: Math.max(...pointsRef.current.filter((_, i) => i % 2 === 0)) - Math.min(...pointsRef.current.filter((_, i) => i % 2 === 0)),
          height: Math.max(...pointsRef.current.filter((_, i) => i % 2 === 1)) - Math.min(...pointsRef.current.filter((_, i) => i % 2 === 1))
        };

        withUndo('Draw with pen', () => {
          upsertElement({
            id: `pen-stroke-${Date.now()}`,
            type: 'drawing',
            subtype: 'pen',
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            bounds,
            points: [...pointsRef.current],
            style: {
              stroke: color,
              strokeWidth: size,
              opacity,
              lineCap: 'round',
              lineJoin: 'round'
            }
          } as any);
        });
      }

      // Reset temp state for next stroke.
      lineRef.current = null;
      pointsRef.current = [];
      drawingRef.current = false;
      rafPendingRef.current = false;
      try { previewLayerRef.current?.batchDraw(); } catch {}
    };

    const onPointerDown = () => {
      if (!isActive || drawingRef.current) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      drawingRef.current = true;
      pointsRef.current = [pos.x, pos.y];

      const line = new Konva.Line({
        points: pointsRef.current,
        stroke: color,
        strokeWidth: size,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        globalCompositeOperation: 'source-over',
      });

      lineRef.current = line;
      previewLayerRef.current?.add(line);
      previewLayerRef.current?.batchDraw();
    };

    const onPointerMove = () => {
      if (!isActive || !drawingRef.current) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      pointsRef.current.push(pos.x, pos.y);

      if (!rafPendingRef.current) {
        rafPendingRef.current = true;
        requestAnimationFrame(() => {
          rafPendingRef.current = false;
          const line = lineRef.current;
          if (!line) return;
          line.points(pointsRef.current);
          previewLayerRef.current?.batchDraw();
        });
      }
    };

    const endStroke = () => {
      if (!drawingRef.current) return;
      commitStroke();
    };

    const onPointerUp = () => endStroke();
    const onPointerLeave = () => endStroke();

    if (isActive) {
      stage.on('pointerdown', onPointerDown);
      stage.on('pointermove', onPointerMove);
      stage.on('pointerup', onPointerUp);
      stage.on('pointerleave', onPointerLeave);
    }

    return () => {
      stage.off('pointerdown', onPointerDown);
      stage.off('pointermove', onPointerMove);
      stage.off('pointerup', onPointerUp);
      stage.off('pointerleave', onPointerLeave);

      // Cleanup transient resources
      try {
        lineRef.current?.destroy();
      } catch {}
      lineRef.current = null;

      // Do not destroy shared preview layer
      previewLayerRef.current = null;

      drawingRef.current = false;
      pointsRef.current = [];
      rafPendingRef.current = false;
    };
  }, [stageRef, isActive, color, size, opacity]);

  return null;
};

export default PenTool;