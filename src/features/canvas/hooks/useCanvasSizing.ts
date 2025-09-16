// features/canvas/hooks/useCanvasSizing.ts
import { useEffect, useMemo, useRef, useState } from 'react';

export interface UseCanvasSizingOptions {
  observeDPR?: boolean;
  dprOverride?: number; // set 1 to disable HiDPI for perf, or a custom ratio
  // Optional min size to avoid 0-size stages during layout transitions
  minWidth?: number;
  minHeight?: number;
}

export interface UseCanvasSizingResult {
  width: number;
  height: number;
  dpr: number;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
}

function getDPR(override?: number): number {
  if (typeof override === 'number') return override;
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

export default function useCanvasSizing(opts: UseCanvasSizingOptions = {}): UseCanvasSizingResult {
  const { observeDPR = true, dprOverride, minWidth = 1, minHeight = 1 } = opts;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(() => ({
    width: minWidth,
    height: minHeight,
    dpr: getDPR(dprOverride),
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measure
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) => {
        const next = {
          width: Math.max(minWidth, Math.floor(rect.width)),
          height: Math.max(minHeight, Math.floor(rect.height)),
          dpr: getDPR(dprOverride),
        };
        if (prev.width !== next.width || prev.height !== next.height || prev.dpr !== next.dpr) {
          return next;
        }
        return prev;
      });
    };

    measure();

    // Resize observer for responsive stage
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    // Track DPR changes across displays or zoom
    let mq: MediaQueryList | null = null;
    const attachDPRListener = () => {
      if (!observeDPR || typeof window === 'undefined') return;
      // Using matchMedia to detect devicePixelRatio changes
      // Note: resolution media queries vary across browsers; re-measure on change
      mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const listener = () => measure();
      try {
        mq.addEventListener('change', listener);
        return () => mq?.removeEventListener('change', listener);
      } catch {
        // Safari fallback
        mq.addListener(listener);
        return () => {
          mq?.removeListener(listener);
        };
      }
    };
    const detach = attachDPRListener();

    // Window resize fallback
    const onWin = () => measure();
    window.addEventListener('resize', onWin);

    return () => {
      ro.disconnect();
      if (detach) detach();
      window.removeEventListener('resize', onWin);
    };
  }, [observeDPR, dprOverride, minWidth, minHeight]);

  return useMemo(
    () => ({
      width: size.width,
      height: size.height,
      dpr: size.dpr,
      containerRef,
    }),
    [size.width, size.height, size.dpr],
  );
}