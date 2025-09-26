import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { getWorldPointer } from '../../../utils/pointer';
import { ToolPreviewLayer } from '../../../renderer/modules/ToolPreviewLayer';
import { RafBatcher } from '../../../utils/performance/RafBatcher';

const DEFAULT_SIZE = 20;

const EraserTool: React.FC<{
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  size?: number;
  opacity?: number;
}> = ({
  stageRef,
  isActive,
  size = DEFAULT_SIZE,
  opacity = 1,
}) => {
  const previewLayerRef = useRef<Konva.Layer | null>(null);
  const lineRef = useRef<Konva.Line | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<number[]>([]);
  const rafBatcher = useRef(new RafBatcher()).current;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const previewLayer = ToolPreviewLayer.getPreviewLayer(stage);
    previewLayerRef.current = previewLayer || null;

    const commitStroke = () => {
      const stageNow = stageRef.current;
      const line = lineRef.current;
      if (!stageNow || !line) return;

      const bounds = {
          x: Math.min(...pointsRef.current.filter((_, i) => i % 2 === 0)),
          y: Math.min(...pointsRef.current.filter((_, i) => i % 2 === 1)),
          width: Math.max(...pointsRef.current.filter((_, i) => i % 2 === 0)) - Math.min(...pointsRef.current.filter((_, i) => i % 2 === 0)),
          height: Math.max(...pointsRef.current.filter((_, i) => i % 2 === 1)) - Math.min(...pointsRef.current.filter((_, i) => i % 2 === 1))
      };
      ToolPreviewLayer.commitStroke(stageNow, line, { id: `eraser-stroke-${Date.now()}`, type: 'drawing', subtype: 'eraser', points: [...pointsRef.current], bounds, style: { stroke: '#FFFFFF', strokeWidth: size, opacity, lineCap: 'round', lineJoin: 'round' } }, 'Erase with eraser', false);

      // Reset temp state for next stroke.
      lineRef.current = null;
      pointsRef.current = [];
      drawingRef.current = false;
      try { previewLayerRef.current?.batchDraw(); } catch (error) {
        // Ignore cleanup errors
      }
    };

    const onPointerDown = () => {
      if (!isActive || drawingRef.current) return;
      const pos = getWorldPointer(stage);
      if (!pos) return;
      drawingRef.current = true;
      pointsRef.current = [pos.x, pos.y];

      const line = new Konva.Line({
        points: pointsRef.current,
        stroke: '#FFFFFF',
        strokeWidth: size,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        globalCompositeOperation: 'destination-out',
      });

      lineRef.current = line;
      previewLayerRef.current?.add(line);
      previewLayerRef.current?.batchDraw();
    };

    const onPointerMove = () => {
      if (!isActive || !drawingRef.current) return;
      const pos = getWorldPointer(stage);
      if (!pos) return;

      pointsRef.current.push(pos.x, pos.y);

      rafBatcher.schedule(() => {
          const line = lineRef.current;
          if (!line) return;
          line.points(pointsRef.current);
          previewLayerRef.current?.batchDraw();
      });
    };

    const endStroke = () => {
      if (!drawingRef.current) return;
      commitStroke();
    };

    const onPointerUp = () => endStroke();
    const onPointerLeave = () => endStroke();

    if (isActive) {
      stage.on('pointerdown.erasertool', onPointerDown);
      stage.on('pointermove.erasertool', onPointerMove);
      stage.on('pointerup.erasertool', onPointerUp);
      stage.on('pointerleave.erasertool', onPointerLeave);
    }

    return () => {
      stage.off('.erasertool');

      try {
        lineRef.current?.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
      lineRef.current = null;
      previewLayerRef.current = null;
      drawingRef.current = false;
      pointsRef.current = [];
    };
  }, [stageRef, isActive, size, opacity, rafBatcher]);

  return null;
};

export default EraserTool;