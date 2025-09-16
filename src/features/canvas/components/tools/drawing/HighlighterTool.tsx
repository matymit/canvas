import React, { useEffect, useRef } from 'react';
import Konva from 'konva';

export interface HighlighterToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  color?: string;
  size?: number;
  opacity?: number;
}

function getMainLayer(stage: Konva.Stage | null): Konva.Layer | null {
  if (!stage) return null;
  const layers = stage.getLayers();
  return layers[1] as Konva.Layer | null;
}

function ensureOverlayOnTop(stage: Konva.Stage | null) {
  if (!stage) return;
  const layers = stage.getLayers();
  const overlay = layers[3] as Konva.Layer | undefined;
  if (overlay) overlay.moveToTop();
}

const DEFAULT_COLOR = '#F59E0B'; // amber-like
const DEFAULT_SIZE = 12;
const DEFAULT_OPACITY = 0.35;

const HighlighterTool: React.FC<HighlighterToolProps> = ({
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
  const rafPendingRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const layers = stage.getLayers();
    const previewLayer = (layers[2] as Konva.Layer) ?? new Konva.Layer({ listening: false });
    if (!previewLayer.getStage()) stage.add(previewLayer);
    previewLayerRef.current = previewLayer;
    ensureOverlayOnTop(stage);

    const commitStroke = () => {
      const st = stageRef.current;
      const ln = lineRef.current;
      if (!st || !ln) return;
      const main = getMainLayer(st);
      if (main) {
        ln.listening(true);
        ln.moveTo(main);
        main.batchDraw();
      } else {
        ln.moveToTop();
        st.draw();
      }
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
        // Multiply blending to emulate highlighter passing over content
        globalCompositeOperation: 'multiply',
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

      try {
        lineRef.current?.destroy();
      } catch {}
      lineRef.current = null;

      previewLayerRef.current = null;

      drawingRef.current = false;
      pointsRef.current = [];
      rafPendingRef.current = false;
    };
  }, [stageRef, isActive, color, size, opacity]);

  return null;
};

export default HighlighterTool;