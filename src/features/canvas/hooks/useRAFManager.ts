// features/canvas/hooks/useRAFManager.ts
import { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';

type RAFCallback = (ts: number, dt: number) => void;

export interface UseRAFManager {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  subscribe(cb: RAFCallback): () => void;
  scheduleLayerDraw(layer: Konva.Layer): void;
}

export default function useRAFManager(): UseRAFManager {
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const subsRef = useRef<Set<RAFCallback>>(new Set());
  const pendingLayersRef = useRef<Set<Konva.Layer>>(new Set());

  const loop = useCallback(
    (ts: number) => {
      const last = lastTsRef.current || ts;
      const dt = ts - last;
      lastTsRef.current = ts;

      // Run subscribers
      for (const cb of Array.from(subsRef.current)) {
        cb(ts, dt);
      }

      // Coalesce draw calls using Konva batchDraw
      // Konva will cap draws to optimal FPS internally
      for (const layer of Array.from(pendingLayersRef.current)) {
        try {
          layer.batchDraw();
        } catch {
          // ignore if destroyed
        }
      }
      pendingLayersRef.current.clear();

      rafIdRef.current = requestAnimationFrame(loop);
    },
    [],
  );

  const start = useCallback(() => {
    if (rafIdRef.current != null) return;
    lastTsRef.current = 0;
    rafIdRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const isRunning = useCallback(() => rafIdRef.current != null, []);

  const subscribe = useCallback<UseRAFManager['subscribe']>((cb) => {
    subsRef.current.add(cb);
    return () => subsRef.current.delete(cb);
  }, []);

  const scheduleLayerDraw = useCallback<UseRAFManager['scheduleLayerDraw']>((layer) => {
    pendingLayersRef.current.add(layer);
  }, []);

  // Ensure stop on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // Capture ref values at cleanup time
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Ref values captured at cleanup time as recommended
      const subs = subsRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Ref values captured at cleanup time as recommended
      const pendingLayers = pendingLayersRef.current;
      subs.clear();
      pendingLayers.clear();
    };
  }, []);

  return { start, stop, isRunning, subscribe, scheduleLayerDraw };
}