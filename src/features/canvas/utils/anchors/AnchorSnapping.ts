import type Konva from 'konva';
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

// CRITICAL FIX: Add function to handle circular elements with trigonometric calculations
function sidePointsForCircle(
  rect: { x: number; y: number; width: number; height: number },
  includeCenter: boolean
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const radiusX = rect.width / 2;  // For ellipses, this is the horizontal radius
  const radiusY = rect.height / 2; // For ellipses, this is the vertical radius

  // Calculate anchor points on the circle/ellipse perimeter using trigonometry
  const pts: Array<{ x: number; y: number; side: AnchorSide }> = [
    {
      x: cx + radiusX * Math.cos(Math.PI), // π radians = leftmost point
      y: cy + radiusY * Math.sin(Math.PI),
      side: 'left'
    },
    {
      x: cx + radiusX * Math.cos(0), // 0 radians = rightmost point
      y: cy + radiusY * Math.sin(0),
      side: 'right'
    },
    {
      x: cx + radiusX * Math.cos(3 * Math.PI / 2), // 3π/2 radians = topmost point
      y: cy + radiusY * Math.sin(3 * Math.PI / 2),
      side: 'top'
    },
    {
      x: cx + radiusX * Math.cos(Math.PI / 2), // π/2 radians = bottommost point
      y: cy + radiusY * Math.sin(Math.PI / 2),
      side: 'bottom'
    },
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
    const stage = node.getStage();
    const rect = node.getClientRect({
      skipStroke: true,
      skipShadow: true,
      relativeTo: stage || undefined // CRITICAL FIX: Use stage coordinates for consistency with PortHoverModule
    });

    // CRITICAL FIX: Detect circular elements and use appropriate anchor calculation
    const elementType = node.getAttr('elementType') || node.name() || '';
    const isCircular = elementType.includes('circle') || elementType.includes('ellipse') ||
                      node.getAttr('shapeType') === 'circle' || node.getAttr('shapeType') === 'ellipse';

    const anchors = isCircular
      ? sidePointsForCircle(rect, includeCenter)
      : sidePointsForRect(rect, includeCenter);

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