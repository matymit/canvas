import Konva from 'konva';
import type { AnchorSide } from '../../types/connector';

export interface AnchorPoint {
  x: number;
  y: number;
  elementId: string;
  side: AnchorSide;
  dist: number;
}

export interface AnchorSnapOptions {
  pixelThreshold?: number; // default 12
  includeCenter?: boolean; // default true
}

function sidePointsForRect(
  rect: { x: number; y: number; width: number; height: number },
  includeCenter: boolean
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const pts: Array<{ x: number; y: number; side: AnchorSide }> = [
    { x: rect.x, y: cy, side: 'left' },
    { x: rect.x + rect.width, y: cy, side: 'right' },
    { x: cx, y: rect.y, side: 'top' },
    { x: cx, y: rect.y + rect.height, side: 'bottom' },
  ];
  if (includeCenter) pts.push({ x: cx, y: cy, side: 'center' });
  return pts;
}

export function findNearestAnchor(
  point: { x: number; y: number },
  candidates: Konva.Node[],
  opts?: AnchorSnapOptions
): AnchorPoint | null {
  const threshold = opts?.pixelThreshold ?? 12;
  const includeCenter = opts?.includeCenter ?? true;
  let best: AnchorPoint | null = null;

  for (const node of candidates) {
    if (!node || !node.getStage()) continue;
    const rect = node.getClientRect({ skipStroke: true, skipShadow: true });
    const anchors = sidePointsForRect(rect, includeCenter);
    for (const a of anchors) {
      const dx = a.x - point.x;
      const dy = a.y - point.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { x: a.x, y: a.y, elementId: node.id(), side: a.side, dist };
      }
    }
  }
  return best;
}