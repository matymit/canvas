// features/canvas/hooks/useTauriCanvas.ts

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import {
  applyHiDPI,
  applyStagePerfDefaults,
  configureStaticLayer,
  getFourLayersByIndex,
  rafBatchDraw,
} from '../services/TauriCanvasOptimizations';

// Tauri v1 vs v2 compatibility for current window
// - v1: import { appWindow } from '@tauri-apps/api/window'
// - v2: import { getCurrent as getCurrentWebviewWindow } from '@tauri-apps/api/window' or namespace changes
// We try both at runtime to remain flexible across setups.
async function getCurrentWindowCompat(): Promise<Record<string, unknown> | null> {
  try {
    // Prefer v2-style getter if available
     
    const mod = await import('@tauri-apps/api/window') as Record<string, unknown>;
    if (typeof mod.getCurrent === 'function') {
      return mod.getCurrent();
    }
    if (mod.appWindow) {
      return mod.appWindow as Record<string, unknown>;
    }
  } catch {
    // Not running in Tauri or API not available
  }
  return null;
}

export interface UseTauriCanvasOptions {
  // Initial device pixel ratio; default is window.devicePixelRatio or 1
  initialDpr?: number;
  // Optimize stage container CSS for performance
  optimizeStageContainer?: boolean;
  // Configure background layer as static (no hit graph/listening)
  markBackgroundStatic?: boolean;
}

export interface UseTauriCanvasResult {
  dpr: number;
  setDpr: (next: number) => void;
  // Receives the Konva.Stage from NonReactCanvasStage; sets HiDPI and layer refs
  onStageReady: (stage: Konva.Stage) => void;
  // Stable refs for imperative usage
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  layersRef: React.MutableRefObject<{
    background?: Konva.Layer;
    main?: Konva.Layer;
    preview?: Konva.Layer;
    overlay?: Konva.Layer;
  }>;
  // Convenience: per-layer raf batchDraw scheduler
  batchers: React.MutableRefObject<{
    background?: () => void;
    main?: () => void;
    preview?: () => void;
    overlay?: () => void;
  }>;
}

export default function useTauriCanvas(opts: UseTauriCanvasOptions = {}): UseTauriCanvasResult {
  const [dpr, setDpr] = useState<number>(() => {
    if (typeof window === 'undefined') return opts.initialDpr ?? 1;
    return (opts.initialDpr ?? window.devicePixelRatio) || 1;
  });

  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<{
    background?: Konva.Layer;
    main?: Konva.Layer;
    preview?: Konva.Layer;
    overlay?: Konva.Layer;
  }>({});

  const batchers = useRef<{
    background?: () => void;
    main?: () => void;
    preview?: () => void;
    overlay?: () => void;
  }>({});

  const applyDprToStage = useCallback(
    (nextDpr: number) => {
      const stage = stageRef.current;
      const layers = layersRef.current;
      if (!stage || !layers.background || !layers.main || !layers.preview || !layers.overlay) return;
      applyHiDPI(nextDpr, stage, [
        layers.background,
        layers.main,
        layers.preview,
        layers.overlay,
      ]);
    },
    []
  );

  const onStageReady = useCallback(
    (stage: Konva.Stage) => {
      stageRef.current = stage;

      // Map layers by the conventional 4-layer order: background, main, preview, overlay
      const layers = getFourLayersByIndex(stage);
      layersRef.current = layers;

      // Per-layer batchers for efficient coalesced draws
      batchers.current = {
        background: layers.background ? rafBatchDraw(layers.background) : undefined,
        main: layers.main ? rafBatchDraw(layers.main) : undefined,
        preview: layers.preview ? rafBatchDraw(layers.preview) : undefined,
        overlay: layers.overlay ? rafBatchDraw(layers.overlay) : undefined,
      };

      // Apply stage/container optimizations
      if (opts.optimizeStageContainer !== false) {
        applyStagePerfDefaults(stage);
      }

      // Configure static background if requested
      if (opts.markBackgroundStatic !== false && layers.background) {
        configureStaticLayer(layers.background);
      }

      // Initial HiDPI scaling
      applyDprToStage(dpr);
    },
    [applyDprToStage, dpr, opts.markBackgroundStatic, opts.optimizeStageContainer]
  );

  // React to DPR state changes
  useEffect(() => {
    applyDprToStage(dpr);
  }, [dpr, applyDprToStage]);

  // Subscribe to Tauri window scale changes for DPI updates
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    (async () => {
      const currentWindow = await getCurrentWindowCompat();
      if (!currentWindow || disposed) return;

      // v1 and v2 expose onScaleChanged with payload.scaleFactor
      const onScaleChanged = (currentWindow as Record<string, unknown>).onScaleChanged as ((handler: (event: { payload?: { scaleFactor?: number } }) => void) => Promise<() => void>) | undefined;
      unlisten = (await onScaleChanged?.((event: { payload?: { scaleFactor?: number } }) => {
        const scale = event.payload?.scaleFactor;
        if (typeof scale === 'number' && scale > 0) {
          setDpr(scale);
        }
      })) || null;
    })();

    return () => {
      disposed = true;
      try {
        unlisten?.();
      } catch {
        // ignore
      }
    };
  }, []);

  // Keep DPR in sync with window.devicePixelRatio in non-Tauri or when OS changes it
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      const next = window.devicePixelRatio || 1;
      if (next !== dpr) setDpr(next);
    };
    // resize + matchMedia change can hint DPR changes in browsers
    window.addEventListener('resize', handler);
    const mq = window.matchMedia?.(`(resolution: ${dpr}dppx)`);
    mq?.addEventListener?.('change', handler);
    return () => {
      window.removeEventListener('resize', handler);
      mq?.removeEventListener?.('change', handler);
    };
  }, [dpr]);

  // Stable API
  return useMemo(
    () => ({
      dpr,
      setDpr,
      onStageReady,
      stageRef,
      layersRef,
      batchers,
    }),
    [dpr, onStageReady]
  );
}