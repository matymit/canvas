// Returns an inner content rect (world coords) for a shape with padding.
export type InnerBox = { x: number; y: number; width: number; height: number };

export interface BaseShape {
  id: string;
  type: 'rectangle' | 'circle' | 'triangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number; // for circle
  // Optional text props if already present
  padding?: number;
}

export function computeShapeInnerBox(el: BaseShape, pad: number = 8): InnerBox {
  const px = Math.max(0, pad);
  if (el.type === 'rectangle' && el.width && el.height) {
    const w = Math.max(0, el.width - px * 2);
    const h = Math.max(0, el.height - px * 2);
    return { x: el.x + px, y: el.y + px, width: w, height: h };
  }

  // Circle/Ellipse: use maximal axis-aligned inscribed rect
  // For circle radii rx, ry, maximal rect is width=√2*rx, height=√2*ry; apply padding.
  if (el.type === 'circle' && el.width && el.height) {
    const rx = el.width / 2;
    const ry = el.height / 2;
    // Maximal inscribed rect (axis-aligned) is width/√2 by height/√2. Apply padding uniformly.
    const inscribedW = Math.SQRT1_2 * el.width;
    const inscribedH = Math.SQRT1_2 * el.height;
    const innerW = Math.max(0, inscribedW - px * 2);
    const innerH = Math.max(0, inscribedH - px * 2);
    return {
      x: el.x + rx - innerW / 2,
      y: el.y + ry - innerH / 2,
      width: innerW,
      height: innerH,
    };
  }

  // Triangle: use its bounding box minus padding (approximation).
  // Assumes isosceles triangle with top tip and flat base created by tool.
  if (el.type === 'triangle' && el.width && el.height) {
    const w = Math.max(0, el.width - px * 2);
    const h = Math.max(0, el.height - px * 2);
    const x = el.x + px;
    const y = el.y + px + h * 0.05; // lift a hair to avoid tip
    return { x, y, width: w, height: Math.max(0, h - h * 0.05) };
  }

  // Fallback: treat as rectangle-like
  return {
    x: el.x + px,
    y: el.y + px,
    width: Math.max(0, (el.width ?? 0) - px * 2),
    height: Math.max(0, (el.height ?? 0) - px * 2),
  };
}