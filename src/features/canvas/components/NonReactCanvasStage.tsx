// features/canvas/components/NonReactCanvasStage.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import Konva from 'konva';

export interface NonReactCanvasStageProps {
  width: number;
  height: number;
  dpr?: number;
  selectedTool: string;
  // Optional external stage ref for parent control
  stageRef?: React.RefObject<Konva.Stage | null>;
  // Provided by CanvasContainer via cloneElement
  onStageReady?: (stage: Konva.Stage) => void;
  // Optional background renderer (e.g., grid)
  backgroundRenderer?: (background: Konva.Layer, stage: Konva.Stage) => void;
}

type Layers = {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
};

const DEFAULT_CURSOR_BY_TOOL: Record<string, string> = {
  select: 'default',
  pan: 'grab',
  pen: 'crosshair',
  marker: 'crosshair',
  highlighter: 'crosshair',
  eraser: 'crosshair',
  text: 'text',
  'draw-rectangle': 'crosshair',
  'draw-circle': 'crosshair',
  'connector-line': 'crosshair',
  'sticky-note': 'crosshair',
  image: 'crosshair',
  custom: 'crosshair',
};

export const NonReactCanvasStage: React.FC<NonReactCanvasStageProps> = ({
  width,
  height,
  dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  selectedTool,
  stageRef,
  onStageReady,
  backgroundRenderer,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const localStageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<Layers | null>(null);

  // Create stage and layers once
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const stage = new Konva.Stage({
      container: containerRef.current,
      width: Math.floor(width),
      height: Math.floor(height),
      listening: true,
    });

    const background = new Konva.Layer({ listening: false }); // grid/guides
    const main = new Konva.Layer({ listening: true });        // elements
    const preview = new Konva.Layer({ listening: true });     // tool previews
    const overlay = new Konva.Layer({ listening: true });     // selection/handles

    stage.add(background);
    stage.add(main);
    stage.add(preview);
    stage.add(overlay);

    // Save refs
    localStageRef.current = stage;
    layersRef.current = { background, main, preview, overlay };

    // Apply pixel ratio for crisp rendering on HiDPI screens
    [background, main, preview, overlay].forEach((ly) => {
      try {
        // SceneCanvas#setPixelRatio is supported by Konva for HiDPI optimization
        ly.getCanvas().setPixelRatio(dpr);
      } catch {
        // No-op if unavailable
      }
    });

    // Initial background render (e.g., grid)
    if (backgroundRenderer) {
      backgroundRenderer(background, stage);
      background.draw();
    }

    // Notify parent
    if (stageRef && 'current' in stageRef) {
      (stageRef as React.MutableRefObject<Konva.Stage | null>).current = stage;
    }
    onStageReady?.(stage);

    return () => {
      // Cleanup Konva resources
      overlay.destroy();
      preview.destroy();
      main.destroy();
      background.destroy();
      stage.destroy();
      localStageRef.current = null;
      layersRef.current = null;
      if (stageRef && 'current' in stageRef) {
        (stageRef as React.MutableRefObject<Konva.Stage | null>).current = null;
      }
    };
    // Intentionally run only on first mount; subsequent updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // Resize and DPR updates
  useEffect(() => {
    const stage = localStageRef.current;
    const layers = layersRef.current;
    if (!stage || !layers) return;

    stage.size({ width: Math.floor(width), height: Math.floor(height) });

    [layers.background, layers.main, layers.preview, layers.overlay].forEach((ly) => {
      try {
        ly.getCanvas().setPixelRatio(dpr);
      } catch {
        // ignore
      }
      // Redraw after DPR change to ensure crispness
      ly.batchDraw();
    });
  }, [width, height, dpr]);

  // Cursor updates per tool
  useEffect(() => {
    const stage = localStageRef.current;
    if (!stage) return;
    const container = stage.container();
    const cursor = DEFAULT_CURSOR_BY_TOOL[selectedTool] ?? 'default';
    container.style.cursor = cursor;
  }, [selectedTool]);

  // Memoized inline style to guarantee size without Tailwind dependency
  const containerStyle = useMemo<React.CSSProperties>(() => ({ width: '100%', height: '100%' }), []);

  return <div ref={containerRef} style={containerStyle} className="konva-stage-container" data-testid="konva-stage-container" />;
};

export default NonReactCanvasStage;