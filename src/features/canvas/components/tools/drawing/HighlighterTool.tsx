import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import DrawingModule from '../../../renderer/modules/DrawingModule';
import { RafBatcher } from '../../../utils/performance/RafBatcher';

const DEFAULT_COLOR = '#F59E0B'; // amber-like
const DEFAULT_SIZE = 12;
const DEFAULT_OPACITY = 0.35;

export interface HighlighterToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  color?: string;
  size?: number;
  opacity?: number;
  rafBatcher?: RafBatcher;
}

const HighlighterTool: React.FC<HighlighterToolProps> = ({
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
        subtype: 'highlighter',
        color: () => color,
        width: () => size,
        opacity: () => opacity,
        multiplyBlend: true,
        rafBatcher: batcher,
      },
      stage,
    );

    stage.on('pointerdown.highlightertool', drawModule.onPointerDown);
    stage.on('pointermove.highlightertool', drawModule.onPointerMove);
    stage.on('pointerup.highlightertool', drawModule.onPointerUp);
    stage.on('pointerleave.highlightertool', drawModule.onPointerLeave);

    return () => {
      stage.off('.highlightertool');
      drawModule.dispose();
    };
  }, [stageRef, isActive, color, size, opacity, batcher]);

  return null;
};

export default HighlighterTool;
