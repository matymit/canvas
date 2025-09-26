import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { getWorldPointer } from '../../../utils/pointer';
import { ToolPreviewLayer } from '../../../renderer/modules/ToolPreviewLayer';
import { RafBatcher } from '../../../utils/performance/RafBatcher';

const DEFAULT_COLOR = '#111827';
const DEFAULT_SIZE = 6;
const DEFAULT_OPACITY = 0.9;

const MarkerTool: React.FC<{
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  color?: string;
  size?: number;
  opacity?: number;
}> = ({
  stageRef,
  isActive,
  color = DEFAULT_COLOR,
  size = DEFAULT_SIZE,
  opacity = DEFAULT_OPACITY,
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
      ToolPreviewLayer.commitStroke(stageNow, line, { id: `marker-stroke-${Date.now()}`, type: 'drawing', subtype: 'marker', points: [...pointsRef.current], bounds, style: { stroke: color, strokeWidth: size, opacity, lineCap: 'round', lineJoin: 'round' } }, 'Draw with marker');

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
      stage.on('pointerdown.markertool', onPointerDown);
      stage.on('pointermove.markertool', onPointerMove);
      stage.on('pointerup.markertool', onPointerUp);
      stage.on('pointerleave.markertool', onPointerLeave);
    }

    return () => {
      stage.off('.markertool');

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
  }, [stageRef, isActive, color, size, opacity, rafBatcher]);

  return null;
};

export default MarkerTool;
