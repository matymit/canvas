// features/canvas/stores/modules/operations/ViewportOperations.ts
import type { WritableDraft } from "immer";
import type { CanvasElement, ElementId } from "../../../../../../types/index";

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
  minScale: number;
  maxScale: number;
}

export const VIEWPORT_DEFAULTS: ViewportState = {
  x: 0,
  y: 0,
  scale: 1,
  minScale: 0.1,
  maxScale: 4,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function setPan(
  draft: WritableDraft<{ viewport: ViewportState }>,
  x: number,
  y: number
): void {
  draft.viewport.x = x;
  draft.viewport.y = y;
}

export function setScale(
  draft: WritableDraft<{ viewport: ViewportState }>,
  scale: number
): void {
  const vp = draft.viewport;
  vp.scale = clamp(scale, vp.minScale, vp.maxScale);
}

export function resetViewport(
  draft: WritableDraft<{ viewport: ViewportState }>
): void {
  const vp = draft.viewport;
  vp.x = VIEWPORT_DEFAULTS.x;
  vp.y = VIEWPORT_DEFAULTS.y;
  vp.scale = VIEWPORT_DEFAULTS.scale;
  vp.minScale = VIEWPORT_DEFAULTS.minScale;
  vp.maxScale = VIEWPORT_DEFAULTS.maxScale;
}

// Coordinate transformation helpers
export function worldToStage(
  viewport: ViewportState,
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: x * viewport.scale + viewport.x,
    y: y * viewport.scale + viewport.y,
  };
}

export function stageToWorld(
  viewport: ViewportState,
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: (x - viewport.x) / viewport.scale,
    y: (y - viewport.y) / viewport.scale,
  };
}

export function zoomAt(
  draft: WritableDraft<{ viewport: ViewportState }>,
  clientX: number,
  clientY: number,
  deltaScale: number
): void {
  const viewport = draft.viewport;
  const targetScale = clamp(
    viewport.scale * deltaScale,
    viewport.minScale,
    viewport.maxScale
  );

  // Convert client point to world coordinates before zoom
  const beforeWorld = stageToWorld(viewport, clientX, clientY);

  // Apply new scale
  viewport.scale = targetScale;

  // Convert world point back to stage with new scale
  const afterStage = worldToStage(viewport, beforeWorld.x, beforeWorld.y);

  // Adjust pan to keep point under cursor
  viewport.x += clientX - afterStage.x;
  viewport.y += clientY - afterStage.y;
}

function getElementBounds(
  el: CanvasElement
): { x: number; y: number; width: number; height: number } | null {
  if (typeof el?.x === "number" && typeof el?.y === "number") {
    if (typeof el?.width === "number" && typeof el?.height === "number") {
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

export function fitToContent(
  draft: WritableDraft<{ viewport: ViewportState }>,
  elements: Map<ElementId, CanvasElement>,
  padding: number = 64,
  targetW: number = 1200,
  targetH: number = 800
): void {
  const entries = Array.from(elements.entries());
  if (entries.length === 0) {
    resetViewport(draft);
    return;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  entries.forEach(([, el]) => {
    const bounds = getElementBounds(el);
    if (!bounds) return;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  if (
    !isFinite(minX) ||
    !isFinite(minY) ||
    !isFinite(maxX) ||
    !isFinite(maxY)
  ) {
    return;
  }

  const contentW = maxX - minX + padding * 2;
  const contentH = maxY - minY + padding * 2;
  const scaleX = targetW / Math.max(contentW, 1);
  const scaleY = targetH / Math.max(contentH, 1);
  
  const viewport = draft.viewport;
  const nextScale = clamp(
    Math.min(scaleX, scaleY),
    viewport.minScale,
    viewport.maxScale
  );

  const stageCenterX = targetW / 2;
  const stageCenterY = targetH / 2;
  const worldCenterX = (minX + maxX) / 2;
  const worldCenterY = (minY + maxY) / 2;

  viewport.scale = nextScale;
  const stagePt = {
    x: worldCenterX * viewport.scale,
    y: worldCenterY * viewport.scale,
  };
  viewport.x = stageCenterX - stagePt.x;
  viewport.y = stageCenterY - stagePt.y;
}
