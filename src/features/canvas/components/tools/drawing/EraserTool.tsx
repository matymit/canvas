import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import DrawingModule from '../../../renderer/modules/DrawingModule';
import { RafBatcher } from '../../../utils/performance/RafBatcher';

const DEFAULT_SIZE = 20;

export interface EraserToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  size?: number;
  opacity?: number;
  rafBatcher?: RafBatcher;
}

const EraserTool: React.FC<EraserToolProps> = ({
  stageRef,
  isActive,
  size = DEFAULT_SIZE,
  opacity = 1,
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
        subtype: 'eraser',
        color: () => '#FFFFFF',
        width: () => size,
        opacity: () => opacity,
        interactiveAfterCommit: false,
        rafBatcher: batcher,
      },
      stage,
    );

    stage.on('pointerdown.erasertool', drawModule.onPointerDown);
    stage.on('pointermove.erasertool', drawModule.onPointerMove);
    stage.on('pointerup.erasertool', drawModule.onPointerUp);
    stage.on('pointerleave.erasertool', drawModule.onPointerLeave);

    return () => {
      stage.off('.erasertool');
      drawModule.dispose();
    };
  }, [stageRef, isActive, size, opacity, batcher]);

  return null;
};

export default EraserTool;
