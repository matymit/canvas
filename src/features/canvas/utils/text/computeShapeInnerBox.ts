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

  // Triangle: position text in lower visual mass with proper width constraints
  // Assumes isosceles triangle with top tip and flat base created by tool.
  // Position text editor in the lower 60% area where triangle is widest
  if (el.type === 'triangle' && el.width && el.height) {
    const h = Math.max(0, el.height - px * 2);

    // Position text area in lower 60% of triangle (where most visual mass is)
    const textAreaTop = 0.3; // Start 30% down from top
    const textAreaHeight = 0.6; // Use 60% of height
    const textAreaWidth = 0.7; // Use 70% of width at the center for better fit

    // Calculate actual dimensions
    const textWidth = Math.max(0, el.width * textAreaWidth);
    const textHeight = Math.max(0, h * textAreaHeight);

    // Center horizontally and position vertically in lower area
    const x = el.x + (el.width - textWidth) / 2;
    const y = el.y + px + (h * textAreaTop);

    return { x, y, width: textWidth, height: textHeight };
  }

  // Fallback: treat as rectangle-like
  return {
    x: el.x + px,
    y: el.y + px,
    width: Math.max(0, (el.width ?? 0) - px * 2),
    height: Math.max(0, (el.height ?? 0) - px * 2),
  };
}