// Anchor snapping utility for finding nearest element-side attachment points
import Konva from 'konva';
import type { AnchorSide } from '../../types/elements/connector';

export interface AnchorPoint {
  x: number;
  y: number;
  elementId: string;
  side: AnchorSide;
  dist: number;
}

export interface AnchorSnapOptions {
  pixelThreshold?: number;   // default 12px
  includeCenter?: boolean;   // default true
  includeCorners?: boolean;  // default false for this spec; sides preferred
}

/**
 * Generate anchor points for element sides and center
 */
function sidePointsForRect(
  rect: { x: number; y: number; width: number; height: number }, 
  includeCenter: boolean
) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  
  const pts: { x: number; y: number; side: AnchorSide }[] = [
    { x: rect.x, y: cy, side: 'left' },
    { x: rect.x + rect.width, y: cy, side: 'right' },
    { x: cx, y: rect.y, side: 'top' },
    { x: cx, y: rect.y + rect.height, side: 'bottom' },
  ];
  
  if (includeCenter) {
    pts.push({ x: cx, y: cy, side: 'center' });
  }
  
  return pts;
}

/**
 * Find the nearest anchor point to a given position within threshold
 */
export function findNearestAnchor(
  stage: Konva.Stage,
  point: { x: number; y: number },
  candidates: Konva.Node[],
  opts?: AnchorSnapOptions
): AnchorPoint | null {
  const threshold = opts?.pixelThreshold ?? 12;
  const includeCenter = opts?.includeCenter ?? true;

  let best: AnchorPoint | null = null;

  for (const node of candidates) {
    if (!node.getLayer()) continue;
    
    // Use Konva's bounding box in stage coordinates
    const rect = node.getClientRect({ skipStroke: true, skipShadow: true });
    const anchors = sidePointsForRect(rect, includeCenter);
    
    for (const a of anchors) {
      const dx = a.x - point.x;
      const dy = a.y - point.y;
      const dist = Math.hypot(dx, dy);
      
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { 
          x: a.x, 
          y: a.y, 
          elementId: node.id(), 
          side: a.side, 
          dist 
        };
      }
    }
  }
  
  return best;
}

/**
 * Get all anchor points for a single element (useful for debugging/visualization)
 */
export function getElementAnchors(
  node: Konva.Node,
  includeCenter: boolean = true
): Array<{ x: number; y: number; side: AnchorSide }> {
  if (!node.getLayer()) return [];
  
  const rect = node.getClientRect({ skipStroke: true, skipShadow: true });
  return sidePointsForRect(rect, includeCenter);
}