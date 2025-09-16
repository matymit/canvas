// features/canvas/stores/modules/viewportModule.ts
import type { StoreSlice } from './types';

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  minScale: number;
  maxScale: number;
}

export interface ViewportModuleSlice {
  viewport: ViewportState & {
    setPan: (x: number, y: number) => void;
    setScale: (scale: number) => void;
    zoomAt: (clientX: number, clientY: number, deltaScale: number) => void;
    zoomIn: (centerX?: number, centerY?: number, step?: number) => void;
    zoomOut: (centerX?: number, centerY?: number, step?: number) => void;
    reset: () => void;
    fitToContent: (padding?: number) => void;
    worldToStage: (x: number, y: number) => { x: number; y: number };
    stageToWorld: (x: number, y: number) => { x: number; y: number };
  };
}

function getElementBounds(el: any):
  | { x: number; y: number; width: number; height: number }
  | null {
  if (typeof el?.x === 'number' && typeof el?.y === 'number') {
    if (typeof el?.width === 'number' && typeof el?.height === 'number') {
      return { x: el.x, y: el.y, width: el.width, height: el.height };
    }
    if (Array.isArray(el?.points) && el.points.length >= 2) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < el.points.length; i += 2) {
        xs.push(el.points[i]);
        ys.push(el.points[i + 1]);
      }
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
  return null;
}

export const createViewportModule: StoreSlice<ViewportModuleSlice> = (set, get) => {
  const DEFAULTS = { x: 0, y: 0, scale: 1, minScale: 0.1, maxScale: 4 };

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
  }

  function toWorld(x: number, y: number) {
    const vp = (get() as any).viewport;
    return { x: (x - vp.x) / vp.scale, y: (y - vp.y) / vp.scale };
  }

  function toStage(x: number, y: number) {
    const vp = (get() as any).viewport;
    return { x: x * vp.scale + vp.x, y: y * vp.scale + vp.y };
  }

  return {
    viewport: {
      ...DEFAULTS,

      setPan: (x, y) => {
        set((draft) => {
          (draft as any).viewport.x = x;
          (draft as any).viewport.y = y;
        });
      },

      setScale: (scale) => {
        set((draft) => {
          const vp = (draft as any).viewport;
          vp.scale = clamp(scale, vp.minScale, vp.maxScale);
        });
      },

      zoomAt: (clientX, clientY, deltaScale) => {
        const { viewport } = get() as any;
        const targetScale = clamp(viewport.scale * deltaScale, viewport.minScale, viewport.maxScale);
        const before = toWorld(clientX, clientY);
        set((draft) => {
          (draft as any).viewport.scale = targetScale;
        });
        const after = toStage(before.x, before.y);
        set((draft) => {
          (draft as any).viewport.x += clientX - after.x;
          (draft as any).viewport.y += clientY - after.y;
        });
      },

      zoomIn: (cx, cy, step = 1.2) => {
        const centerX = cx ?? 0;
        const centerY = cy ?? 0;
        (get() as any).viewport.zoomAt(centerX, centerY, step);
      },

      zoomOut: (cx, cy, step = 1 / 1.2) => {
        const centerX = cx ?? 0;
        const centerY = cy ?? 0;
        (get() as any).viewport.zoomAt(centerX, centerY, step);
      },

      reset: () => {
        set((draft) => {
          const vp = (draft as any).viewport;
          vp.x = DEFAULTS.x;
          vp.y = DEFAULTS.y;
          vp.scale = DEFAULTS.scale;
          vp.minScale = DEFAULTS.minScale;
          vp.maxScale = DEFAULTS.maxScale;
        });
      },

      fitToContent: (padding = 64) => {
        const entries = Array.from((get() as any).elements.entries());
        if (entries.length === 0) {
          (get() as any).viewport.reset();
          return;
        }
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        entries.forEach((entry) => {
          const [_, el] = entry as [any, any];
          const b = getElementBounds(el as any);
          if (!b) return;
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        });

        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
          return;
        }

        const contentW = maxX - minX + padding * 2;
        const contentH = maxY - minY + padding * 2;
        // Assume stage size is managed by component; we fit relative to a nominal view box.
        // Consumers may call reset + fitToContent with actual container size.
        const targetW = 1200; // Fallback if container size is unknown here
        const targetH = 800;
        const scaleX = targetW / Math.max(contentW, 1);
        const scaleY = targetH / Math.max(contentH, 1);
        const nextScale = clamp(Math.min(scaleX, scaleY), (get() as any).viewport.minScale, (get() as any).viewport.maxScale);
        const stageCenterX = targetW / 2;
        const stageCenterY = targetH / 2;
        const worldCenterX = (minX + maxX) / 2;
        const worldCenterY = (minY + maxY) / 2;

        set((draft) => {
          const vp = (draft as any).viewport;
          vp.scale = nextScale;
          const stagePt = {
            x: worldCenterX * vp.scale,
            y: worldCenterY * vp.scale,
          };
          vp.x = stageCenterX - stagePt.x;
          vp.y = stageCenterY - stagePt.y;
        });
      },

      worldToStage: toStage,

      stageToWorld: toWorld,
    },
  };
};