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

function getPreviewLayer(stage: Konva.Stage): Konva.Layer | null {
  const layers = stage.getLayers();
  return (layers[layers.length - 2] as Konva.Layer) ?? null; // background, main, preview, overlay
}

const MIN = 8;

export const CircleTool: React.FC<CircleToolProps> = ({ isActive, stageRef, toolId = 'draw-circle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const ref = useRef<{
    start: { x: number; y: number } | null;
    node: Konva.Ellipse | null;
  }>({ start: null, node: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;

    if (!stage || !active) return;

    const previewLayer = getPreviewLayer(stage);
    if (!previewLayer) return;

    const onDown = () => {
      const p = stage.getPointerPosition();
      if (!p) return;

      ref.current.start = { x: p.x, y: p.y };

      const node = new Konva.Ellipse({
        x: p.x,
        y: p.y,
        radiusX: 0,
        radiusY: 0,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        listening: false,
        perfectDrawEnabled: false,
        name: 'tool-preview-circle',
      });

      ref.current.node = node;
      previewLayer.add(node);
      previewLayer.batchDraw();
    };

    const onMove = () => {
      const start = ref.current.start;
      const node = ref.current.node;
      if (!start || !node) return;

      const p = stage.getPointerPosition();
      if (!p) return;

      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.max(MIN, Math.abs(p.x - start.x));
      const h = Math.max(MIN, Math.abs(p.y - start.y));

      node.position({ x: x + w / 2, y: y + h / 2 });
      node.radius({ x: w / 2, y: h / 2 });
      previewLayer.batchDraw();
    };

    const onUp = () => {
      const start = ref.current.start;
      const node = ref.current.node;
      ref.current.start = null;

      if (!node || !start) return;

      const p = stage.getPointerPosition() || start;
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.max(MIN, Math.abs(p.x - start.x));
      const h = Math.max(MIN, Math.abs(p.y - start.y));

      node.remove();
      node.destroy();
      ref.current.node = null;
      previewLayer.batchDraw();

      // Ignore taps without drag - place a default circle (FigJam-style size)
      const finalW = (w < MIN && h < MIN) ? 240 : w;
      const finalH = (w < MIN && h < MIN) ? 240 : h;

      // Commit to store (assume upsertElement returns id)
      const id = upsertElement?.({
        id: crypto.randomUUID(),
        type: 'circle',
        x,
        y,
        width: finalW,
        height: finalH,
        style: {
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth,
        },
      });

      // Immediately open overlay text editor
      if (id) {
        setSelectedTool?.('select');
        openShapeTextEditor(stage, id, {
          padding: 10,
          fontSize: 18,
          lineHeight: 1.3,
        });
      } else {
        setSelectedTool?.('select');
      }
    };

    stage.on('pointerdown.circletool', onDown);
    stage.on('pointermove.circletool', onMove);
    stage.on('pointerup.circletool', onUp);

    return () => {
      stage.off('pointerdown.circletool', onDown);
      stage.off('pointermove.circletool', onMove);
      stage.off('pointerup.circletool', onUp);

      // eslint-disable-next-line react-hooks/exhaustive-deps
      const currentRef = ref.current;
      try {
        currentRef.node?.destroy();
      } catch {
        // ignore
      }
      currentRef.node = null;
      currentRef.start = null;
      previewLayer?.batchDraw();
    };
  }, [isActive, selectedTool, toolId, stageRef, strokeColor, fillColor, strokeWidth, upsertElement, setSelectedTool]);

  return null;
};

export default CircleTool;