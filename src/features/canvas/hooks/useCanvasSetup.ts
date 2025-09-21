// features/canvas/hooks/useCanvasSetup.ts
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import Konva from 'konva';
import type { MutableRefObject } from 'react';
import type { CanvasLayers } from './canvasEventTypes';

export interface UseCanvasSetupOptions {
  width: number;
  height: number;
  dpr?: number; // devicePixelRatio override (1 for perf, >1 for crispness)
  listening?: boolean; // enable stage listening for events
  createPreviewAsFastLayer?: boolean; // use FastLayer for previews
  backgroundRenderer?: (background: Konva.Layer, stage: Konva.Stage) => void;
}

export interface UseCanvasSetupResult {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  stageRef: MutableRefObject<Konva.Stage | null>;
  layersRef: MutableRefObject<CanvasLayers | null>;
}

export default function useCanvasSetup(opts: UseCanvasSetupOptions): UseCanvasSetupResult {
  const { width, height, dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1, listening = true, createPreviewAsFastLayer = true, backgroundRenderer } =
    opts;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<CanvasLayers | null>(null);

  // Create stage + layers once
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stage = new Konva.Stage({
      container,
      width: Math.floor(width),
      height: Math.floor(height),
      listening,
    });

    const background = new Konva.Layer({ listening: false });
    const main = new Konva.Layer({ listening: true });
    const preview = createPreviewAsFastLayer ? new Konva.FastLayer({}) : new Konva.Layer({ listening: true });
    const overlay = new Konva.Layer({ listening: true });

    stage.add(background);
    stage.add(main);
    stage.add(preview);
    stage.add(overlay);

    stageRef.current = stage;
    layersRef.current = { background, main, preview: preview as Konva.Layer, overlay };

    // Apply pixel ratio for crisp rendering
    for (const ly of [background, main, preview, overlay]) {
      try {
        ly.getCanvas().setPixelRatio(dpr);
      } catch {
        // older Konva versions may not expose setPixelRatio here
      }
    }

    // Render background if provided (e.g., grid)
    if (backgroundRenderer) {
      backgroundRenderer(background, stage);
      background.batchDraw();
    }

    return () => {
      overlay.destroy();
      (preview as Konva.Layer).destroy();
      main.destroy();
      background.destroy();
      stage.destroy();
      stageRef.current = null;
      layersRef.current = null;
    };
    // Intentionally mount-once; resizing is handled by useCanvasSizing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to width/height/dpr changes
  useEffect(() => {
    const stage = stageRef.current;
    const layers = layersRef.current;
    if (!stage || !layers) return;

    stage.size({ width: Math.floor(width), height: Math.floor(height) });

    for (const ly of [layers.background, layers.main, layers.preview, layers.overlay]) {
      try {
        ly.getCanvas().setPixelRatio(dpr);
        ly.batchDraw();
      } catch {
        // ignore if not supported
      }
    }
  }, [width, height, dpr]);

  return useMemo(
    () => ({
      containerRef,
      stageRef,
      layersRef,
    }),
    [],
  );
}