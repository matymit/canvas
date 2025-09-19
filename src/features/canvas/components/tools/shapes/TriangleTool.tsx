import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { openShapeTextEditor } from '../../../utils/editors/openShapeTextEditor';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TriangleToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'draw-triangle'
}

function getPreviewLayer(stage: Konva.Stage): Konva.Layer | null {
  const layers = stage.getLayers();
  return (layers[layers.length - 2] as Konva.Layer) ?? null; // background, main, preview, overlay
}

const MIN = 8;

export const TriangleTool: React.FC<TriangleToolProps> = ({ isActive, stageRef, toolId = 'draw-triangle' }) => {
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const strokeColor = useUnifiedCanvasStore((s) => s.ui?.strokeColor ?? '#333');
  const fillColor = useUnifiedCanvasStore((s) => s.ui?.fillColor ?? '#ffffff');
  const strokeWidth = useUnifiedCanvasStore((s) => s.ui?.strokeWidth ?? 2);

  const ref = useRef<{
    start: { x: number; y: number } | null;
    node: Konva.Line | null;
  }>({ start: null, node: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;

    if (!stage || !active) return;

    const previewLayer = getPreviewLayer(stage);
    if (!previewLayer) return;

    const makePoints = (sx: number, sy: number, ex: number, ey: number): number[] => {
      const x = Math.min(sx, ex);
      const y = Math.min(sy, ey);
      const w = Math.abs(ex - sx);
      const h = Math.abs(ey - sy);

      // Isosceles triangle: top vertex centered, base along bottom
      const p1 = { x: x + w / 2, y };       // top
      const p2 = { x, y: y + h };           // bottom-left
      const p3 = { x: x + w, y: y + h };    // bottom-right
      return [p1.x, p1.y, p2.x, p2.y, p3.x, p3.y];
    };

    const onDown = () => {
      const p = stage.getPointerPosition();
      if (!p) return;

      ref.current.start = { x: p.x, y: p.y };

      const node = new Konva.Line({
        points: [p.x, p.y, p.x, p.y, p.x, p.y],
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        closed: true,
        listening: false,
        perfectDrawEnabled: false,
        name: 'tool-preview-triangle',
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

      node.points(makePoints(start.x, start.y, p.x, p.y));
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

      // Ignore taps without drag - place a default triangle (FigJam-style size)
      const finalW = (w < MIN && h < MIN) ? 240 : w;
      const finalH = (w < MIN && h < MIN) ? 240 : h;

      // Commit to store (assume upsertElement returns id)
      const id = upsertElement?.({
        id: crypto.randomUUID(),
        type: 'triangle',
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

    stage.on('pointerdown.triangletool', onDown);
    stage.on('pointermove.triangletool', onMove);
    stage.on('pointerup.triangletool', onUp);

    return () => {
      stage.off('pointerdown.triangletool', onDown);
      stage.off('pointermove.triangletool', onMove);
      stage.off('pointerup.triangletool', onUp);

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

export default TriangleTool;