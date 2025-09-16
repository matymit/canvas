import React, { useEffect, useRef, useState } from 'react';
import Konva from 'konva';
import CanvasLayerManager from '../layers/CanvasLayerManager';
import { TransformerController } from '../renderer/TransformerController';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';

export type CanvasStageHandles = {
  stage: Konva.Stage | null;
  layers: ReturnType<CanvasLayerManager['all']> | null;
};

function drawGrid(layer: Konva.Layer, stage: Konva.Stage, gridSize = 24) {
  const g = new Konva.Group({ listening: false });
  const w = stage.width();
  const h = stage.height();
  const color = '#eee';
  for (let x = 0; x < w; x += gridSize) {
    g.add(new Konva.Line({ points: [x, 0, x, h], stroke: color, strokeWidth: 1 } as any));
  }
  for (let y = 0; y < h; y += gridSize) {
    g.add(new Konva.Line({ points: [0, y, w, y], stroke: color, strokeWidth: 1 } as any));
  }
  layer.add(g);
  layer.batchDraw();
}

export default function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [handles, setHandles] = useState<CanvasStageHandles>({ stage: null, layers: null });

  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool);
  const viewport = useUnifiedCanvasStore((s) => s.viewport);
  const selectionApi = useUnifiedCanvasStore((s) => s.selection);
  const elementApi = useUnifiedCanvasStore((s) => s.element);
  const beginBatch = useUnifiedCanvasStore((s) => (s as any).beginBatch);
  const endBatch = useUnifiedCanvasStore((s) => (s as any).endBatch);

  useEffect(() => {
    if (!containerRef.current) return;

    // Stage sizing
    const width = containerRef.current.clientWidth || 1200;
    const height = containerRef.current.clientHeight || 800;

    const stage = new Konva.Stage({ container: containerRef.current, width, height });
    const lm = new CanvasLayerManager(stage, {
      backgroundListening: false,
      mainListening: true,
      previewListening: true,
      overlayListening: true,
    });

    // Grid
    drawGrid(lm.get('background'), stage);

    // Transformer on overlay
    const tr = new TransformerController({ stage, layer: lm.get('overlay'), keepRatio: false, minSize: 6 });

    // Accessibility attrs on container
    stage.container().setAttribute('role', 'application');
    stage.container().setAttribute('aria-roledescription', 'Canvas');

    // Basic interactions
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      viewport.zoomAt(cx, cy, delta);
      const { x, y, scale } = useUnifiedCanvasStore.getState().viewport;
      stage.scale({ x: scale, y: scale });
      stage.position({ x, y });
      stage.batchDraw();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isPanning = true;
        stage.container().style.cursor = 'grab';
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isPanning = false;
        stage.container().style.cursor = selectedTool === 'pan' ? 'grab' : 'default';
      }
    };

    const onPointerDown = (evt: Konva.KonvaEventObject<PointerEvent>) => {
      const pt = stage.getPointerPosition();
      if (!pt) return;
      // Pan
      if (isPanning || selectedTool === 'pan') {
        isPanning = true;
        panStart = { x: pt.x - stage.x(), y: pt.y - stage.y() };
        stage.container().style.cursor = 'grabbing';
        return;
      }
      // Text tool → notify editor overlay
      if (selectedTool === 'text') {
        window.dispatchEvent(new CustomEvent('canvas:text-begin', { detail: { x: pt.x, y: pt.y } }));
        return;
      }
      // TODO: handle other tools (rect, circle, connector, etc.) with preview layer
    };

    const onPointerMove = (evt: Konva.KonvaEventObject<PointerEvent>) => {
      const pt = stage.getPointerPosition();
      if (!pt) return;
      if (isPanning) {
        viewport.setPan(pt.x - panStart.x, pt.y - panStart.y);
        const { x, y } = useUnifiedCanvasStore.getState().viewport;
        stage.position({ x, y });
        stage.batchDraw();
        return;
      }
      // TODO: live preview for drawing/marquee/connector
    };

    const onPointerUp = () => {
      if (isPanning) {
        stage.container().style.cursor = 'grab';
        isPanning = false;
      }
    };

    stage.on('pointerdown', onPointerDown);
    stage.on('pointermove', onPointerMove);
    stage.on('pointerup', onPointerUp);

    const wheelHandler = onWheel as unknown as (e: Event) => void;
    const kd = onKeyDown as unknown as (e: Event) => void;
    const ku = onKeyUp as unknown as (e: Event) => void;
    stage.container().addEventListener('wheel', wheelHandler, { passive: false } as any);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    setHandles({ stage, layers: lm.all() });

    return () => {
      stage.container().removeEventListener('wheel', wheelHandler as any);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      tr.destroy();
      lm.destroy();
      stage.destroy();
      setHandles({ stage: null, layers: null });
    };
  }, [containerRef]);

  useEffect(() => {
    if (!handles.stage) return;
    const { stage } = handles;
    // Apply viewport transform changes to Konva stage
    const { x, y, scale } = useUnifiedCanvasStore.getState().viewport;
    stage.scale({ x: scale, y: scale });
    stage.position({ x, y });
    stage.batchDraw();
  }, [handles.stage, viewport.x, viewport.y, viewport.scale]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 48px)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', outline: 'none' }} />
    </div>
  );
}