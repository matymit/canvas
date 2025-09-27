import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import DrawingModule from '../../../renderer/modules/DrawingModule';
import { RafBatcher } from '../../../utils/performance/RafBatcher';

export interface PenToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  color?: string;
  size?: number;
  opacity?: number;
  rafBatcher?: RafBatcher;
}

export const PenTool: React.FC<PenToolProps> = ({
  stageRef,
  isActive,
  color = '#111827',
  size = 2,
  opacity = 1.0,
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
        subtype: 'pen',
        color: () => color,
        width: () => size,
        opacity: () => opacity,
        rafBatcher: batcher,
      },
      stage,
    );

    stage.on('pointerdown.pentool', drawModule.onPointerDown);
    stage.on('pointermove.pentool', drawModule.onPointerMove);
    stage.on('pointerup.pentool', drawModule.onPointerUp);
    stage.on('pointerleave.pentool', drawModule.onPointerLeave);

    return () => {
      stage.off('.pentool');
      drawModule.dispose();
    };
  }, [stageRef, isActive, color, size, opacity, batcher]);

  return null;
};

export default PenTool;
