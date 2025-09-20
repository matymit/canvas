// Mindmap routing utilities for curved branch geometry
// Provides Bézier curve calculations and tapered ribbon polygon generation

export interface Pt { 
  x: number; 
  y: number; 
}

/**
 * Calculate rightward-biased control points for smooth curved branches
 * @param a Start point (parent node)
 * @param b End point (child node)  
 * @param k Curvature factor (0 = straight, 1 = very curved)
 * @returns Control points for cubic Bézier curve
 */
export function rightwardControls(a: Pt, b: Pt, k = 0.35): [Pt, Pt] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  
  return [
    { x: a.x + dx * k, y: a.y + dy * k * 0.2 },
    { x: b.x - dx * k, y: b.y - dy * k * 0.2 },
  ];
}

/**
 * Calculate point on cubic Bézier curve at parameter t
 * @param p0 Start point
 * @param p1 First control point
 * @param p2 Second control point
 * @param p3 End point
 * @param t Parameter (0 to 1)
 * @returns Point on curve
 */
function cubicBezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Calculate derivative (tangent) of cubic Bézier curve at parameter t
 * @param p0 Start point
 * @param p1 First control point
 * @param p2 Second control point
 * @param p3 End point
 * @param t Parameter (0 to 1)
 * @returns Tangent vector at t
 */
function cubicBezierDerivative(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  
  return {
    x: 3 * mt2 * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x),
    y: 3 * mt2 * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y),
  };
}

/**
 * Generate polygon points for a tapered ribbon along a Bézier curve
 * Creates a filled shape with varying width for organic branch appearance
 * @param p0 Start point
 * @param c1 First control point
 * @param c2 Second control point
 * @param p3 End point
 * @param w0 Width at start
 * @param w1 Width at end
 * @param segments Number of segments (higher = smoother)
 * @returns Array of points forming closed polygon
 */
export function buildTaperedRibbonPoints(
  p0: Pt, 
  c1: Pt, 
  c2: Pt, 
  p3: Pt, 
  w0: number, 
  w1: number, 
  segments = 12
): Pt[] {
  const leftSide: Pt[] = [];
  const rightSide: Pt[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Point on curve
    const point = cubicBezier(p0, c1, c2, p3, t);
    
    // Tangent at this point
    const tangent = cubicBezierDerivative(p0, c1, c2, p3, t);
    const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
    
    // Normal vector (perpendicular to tangent)
    const normal = {
      x: -tangent.y / tangentLength,
      y: tangent.x / tangentLength,
    };
    
    // Interpolated width at this point
    const width = w0 + (w1 - w0) * t;
    const halfWidth = width * 0.5;
    
    // Points on either side of curve
    leftSide.push({
      x: point.x + normal.x * halfWidth,
      y: point.y + normal.y * halfWidth,
    });
    
    rightSide.push({
      x: point.x - normal.x * halfWidth,
      y: point.y - normal.y * halfWidth,
    });
  }
  
  // Reverse right side to create closed polygon
  rightSide.reverse();
  
  return [...leftSide, ...rightSide];
}

/**
 * Calculate smooth control points for multiple connected branches
 * Useful for maintaining flow when multiple children branch from one parent
 * @param parentCenter Center point of parent node
 * @param childCenters Array of child node centers
 * @param curvature Base curvature factor
 * @returns Array of control point pairs for each branch
 */
export function calculateMultiBranchControls(
  parentCenter: Pt,
  childCenters: Pt[],
  curvature = 0.35
): Array<{ c1: Pt; c2: Pt }> {
  return childCenters.map((child) => {
    // Adjust curvature based on vertical separation to avoid overlaps
    const verticalSeparation = Math.abs(child.y - parentCenter.y);
    const adjustedCurvature = curvature * Math.min(1, verticalSeparation / 100);

    const [c1, c2] = rightwardControls(parentCenter, child, adjustedCurvature);
    return { c1, c2 };
  });
}

/**
 * Check if a point is approximately on a Bézier curve
 * Useful for hit testing or branch interaction
 * @param point Point to test
 * @param p0 Curve start
 * @param c1 First control point
 * @param c2 Second control point  
 * @param p3 Curve end
 * @param tolerance Distance tolerance for "near" curve
 * @param samples Number of samples to check along curve
 * @returns True if point is within tolerance of curve
 */
export function isPointNearCurve(
  point: Pt,
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p3: Pt,
  tolerance = 5,
  samples = 20
): boolean {
  const toleranceSquared = tolerance * tolerance;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const curvePoint = cubicBezier(p0, c1, c2, p3, t);
    
    const dx = point.x - curvePoint.x;
    const dy = point.y - curvePoint.y;
    const distanceSquared = dx * dx + dy * dy;
    
    if (distanceSquared <= toleranceSquared) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the length of a Bézier curve using numerical approximation
 * @param p0 Start point
 * @param c1 First control point
 * @param c2 Second control point
 * @param p3 End point
 * @param samples Number of samples for approximation
 * @returns Approximate curve length
 */
export function getCurveLength(
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p3: Pt,
  samples = 50
): number {
  let length = 0;
  let prevPoint = p0;
  
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const point = cubicBezier(p0, c1, c2, p3, t);
    
    const dx = point.x - prevPoint.x;
    const dy = point.y - prevPoint.y;
    length += Math.hypot(dx, dy);
    
    prevPoint = point;
  }
  
  return length;
}

/**
 * Create arrow head points at the end of a curve
 * @param p0 Curve start
 * @param c1 First control point
 * @param c2 Second control point
 * @param p3 Curve end
 * @param arrowSize Size of arrow head
 * @returns Array of points forming arrow head
 */
export function createArrowHead(
  p0: Pt,
  c1: Pt,
  c2: Pt,
  p3: Pt,
  arrowSize = 8
): Pt[] {
  // Get tangent at end of curve
  const tangent = cubicBezierDerivative(p0, c1, c2, p3, 1);
  const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
  
  // Normalize tangent
  const normalizedTangent = {
    x: tangent.x / tangentLength,
    y: tangent.y / tangentLength,
  };
  
  // Calculate arrow points
  const backPoint = {
    x: p3.x - normalizedTangent.x * arrowSize,
    y: p3.y - normalizedTangent.y * arrowSize,
  };
  
  const leftPoint = {
    x: backPoint.x - normalizedTangent.y * arrowSize * 0.5,
    y: backPoint.y + normalizedTangent.x * arrowSize * 0.5,
  };
  
  const rightPoint = {
    x: backPoint.x + normalizedTangent.y * arrowSize * 0.5,
    y: backPoint.y - normalizedTangent.x * arrowSize * 0.5,
  };
  
  return [p3, leftPoint, backPoint, rightPoint];
}
