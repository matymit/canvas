import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import DrawingModule from '../../../renderer/modules/DrawingModule';
import { RafBatcher } from '../../../utils/performance/RafBatcher';

const DEFAULT_COLOR = '#111827';
const DEFAULT_SIZE = 6;
const DEFAULT_OPACITY = 0.9;

export interface MarkerToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  color?: string;
  size?: number;
  opacity?: number;
  rafBatcher?: RafBatcher;
}

const MarkerTool: React.FC<MarkerToolProps> = ({
  stageRef,
  isActive,
  color = DEFAULT_COLOR,
  size = DEFAULT_SIZE,
  opacity = DEFAULT_OPACITY,
  rafBatcher,
}) => {
  const fallbackBatcherRef = useRef<RafBatcher | null>(null);
  const batcher = useMemo(() => {
    if (rafBatcher) {
      return rafBatcher;
    }
    if (!fallbackBatcherRef.current) {
      fallbackBatcherRef.current = new RafBatcher();
    }
    return fallbackBatcherRef.current;
  }, [rafBatcher]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive) return;

    const drawModule = new DrawingModule(
      {
        subtype: 'marker',
        color: () => color,
        width: () => size,
        opacity: () => opacity,
        rafBatcher: batcher,
      },
      stage,
    );

    stage.on('pointerdown.markertool', drawModule.onPointerDown);
    stage.on('pointermove.markertool', drawModule.onPointerMove);
    stage.on('pointerup.markertool', drawModule.onPointerUp);
    stage.on('pointerleave.markertool', drawModule.onPointerLeave);

    return () => {
      stage.off('.markertool');
      drawModule.dispose();
    };
  }, [stageRef, isActive, color, size, opacity, batcher]);

  return null;
};

export default MarkerTool;
