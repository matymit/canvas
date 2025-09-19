import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

export interface EraserToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  size?: number;
  opacity?: number;
}

const DEFAULT_SIZE = 20;

const EraserTool: React.FC<EraserToolProps> = ({
  stageRef,
  isActive,
  size = DEFAULT_SIZE,
  opacity = 1,
}) => {
  const withUndo = useUnifiedCanvasStore((s: any) => s.history?.withUndo);
  const upsertElement = useUnifiedCanvasStore((s: any) => s.element?.upsert);
  const selectedTool = useUnifiedCanvasStore((s: any) => s.selectedTool ?? s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s: any) => s.setSelectedTool ?? s.ui?.setSelectedTool);

  const ref = useRef<{ drawing: boolean; points: number[]; line?: Konva.Line } | null>({ drawing: false, points: [] });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && (selectedTool === 'eraser');
    if (!stage || !active) return;

    const layers = stage.getLayers();
    const previewLayer = layers[Math.max(0, layers.length - 2)] as Konva.Layer | undefined; // preview

    const showCursor = (pos: { x: number; y: number }) => {
      const overlay = layers[layers.length - 1] as Konva.Layer | undefined;
      if (!overlay) return;
      let cursor = overlay.findOne<Konva.Circle>('.eraser-cursor');
      if (!cursor) {
        cursor = new Konva.Circle({
          x: pos.x,
          y: pos.y,
          radius: size / 2,
          stroke: '#ef4444',
          strokeWidth: 1,
          fill: 'rgba(239,68,68,0.08)',
          listening: false,
          name: 'eraser-cursor',
        });
        overlay.add(cursor);
      } else {
        cursor.position(pos);
      }
      overlay.batchDraw();
    };

    const onDown = () => {
      const p = stage.getPointerPosition();
      if (!p || !previewLayer) return;
      if (!ref.current) ref.current = { drawing: false, points: [] };
      ref.current.drawing = true;
      ref.current.points = [p.x, p.y];
      const line = new Konva.Line({
        points: ref.current.points,
        stroke: '#000', // irrelevant for destination-out
        strokeWidth: size,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
        listening: false,
        perfectDrawEnabled: false,
        globalCompositeOperation: 'destination-out',
        name: 'eraser-preview',
      });
      ref.current.line = line;
      previewLayer.add(line);
      previewLayer.batchDraw();
    };

    const onMove = () => {
      const p = stage.getPointerPosition();
      if (!p) return;
      showCursor(p);
      if (!ref.current?.drawing || !ref.current?.line || !previewLayer) return;
      const pts = ref.current.points;
      const lastX = pts[pts.length - 2] ?? p.x;
      const lastY = pts[pts.length - 1] ?? p.y;
      const dx = p.x - lastX;
      const dy = p.y - lastY;
      if (dx * dx + dy * dy < 4) return; // min distance
      pts.push(p.x, p.y);
      ref.current.line.points(pts);
      previewLayer.batchDraw();
    };

    const onUp = () => {
      if (!ref.current?.drawing || !ref.current?.line) return;
      const committed = ref.current.line;
      const points = committed.points();
      ref.current.line = undefined;
      ref.current.drawing = false;

      // Clear preview
      previewLayer?.removeChildren();
      previewLayer?.draw();

      // Do not move preview stroke to main to avoid duplicate nodes.
      // Rely on DrawingRenderer to reconcile from store and create the persistent line.
      try { committed.destroy(); } catch (error) {
        // Ignore cleanup errors
        console.debug('[EraserTool] Cleanup error:', error);
      }
      previewLayer?.batchDraw();

      const commitFn = () => {
        upsertElement?.({
          id: crypto.randomUUID(),
          type: 'eraser',
          points,
          style: { strokeWidth: size, opacity },
        } as any);
      };

      if (withUndo) withUndo('Erase', commitFn); else commitFn();

      // Switch back to select tool to match FigJam flows
      setSelectedTool?.('select');
    };

    stage.on('pointerdown.eraser', onDown);
    stage.on('pointermove.eraser', onMove);
    stage.on('pointerup.eraser', onUp);
    stage.on('mouseleave.eraser', onUp);

    return () => {
      stage.off('pointerdown.eraser', onDown);
      stage.off('pointermove.eraser', onMove);
      stage.off('pointerup.eraser', onUp);
      stage.off('mouseleave.eraser', onUp);
      const overlay = layers[layers.length - 1] as Konva.Layer | undefined;
      try { overlay?.find('.eraser-cursor').forEach(n => n.destroy()); overlay?.batchDraw(); } catch (error) {
        // Ignore cleanup errors
        console.debug('[EraserTool] Cleanup error:', error);
      }
      try { previewLayer?.removeChildren(); previewLayer?.draw(); } catch (error) {
        // Ignore cleanup errors
        console.debug('[EraserTool] Cleanup error:', error);
      }
      ref.current = { drawing: false, points: [] };
    };
  }, [stageRef, isActive, size, opacity, selectedTool, setSelectedTool, withUndo, upsertElement]);

  return null;
};

export default EraserTool;
