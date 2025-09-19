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

  // Circle: use maximal axis-aligned inscribed square
  // For a circle with diameter D, the inscribed square has side length D/√2
  if (el.type === 'circle' && el.width && el.height) {
    const diameter = Math.min(el.width, el.height); // Use smaller dimension for true circle
    const centerX = el.x + el.width / 2;
    const centerY = el.y + el.height / 2;

    // Inscribed square side length = diameter / √2
    const inscribedSize = diameter / Math.sqrt(2);
    const innerSize = Math.max(0, inscribedSize - px * 2);

    const result = {
      x: centerX - innerSize / 2,
      y: centerY - innerSize / 2,
      width: innerSize,
      height: innerSize,
    };

    console.log('[DEBUG] Circle text positioning:', {
      elementId: el.id,
      circleCenter: { centerX, centerY },
      diameter,
      inscribedSize,
      innerSize,
      finalPosition: { x: result.x, y: result.y },
      dimensions: { width: innerSize, height: innerSize }
    });

    return result;
  }

  // Triangle: position text in lower visual mass with proper width constraints
  // Assumes isosceles triangle with top tip and flat base created by tool.
  // Position text editor in the lower 60% area where triangle is widest
  if (el.type === 'triangle' && el.width && el.height) {
    // Position text area in lower 60% of triangle (where most visual mass is)
    const textAreaTop = 0.4; // Start 40% down from top (lower than before)
    const textAreaHeight = 0.5; // Use 50% of height for text area
    const textAreaWidth = 0.7; // Use 70% of width at the center for better fit

    // Calculate actual dimensions using full triangle height (not reduced by padding)
    const textWidth = Math.max(0, el.width * textAreaWidth);
    const textHeight = Math.max(0, el.height * textAreaHeight);

    // Center horizontally and position vertically in lower visual mass area
    const x = el.x + (el.width - textWidth) / 2;
    const y = el.y + (el.height * textAreaTop); // Use full height, not padding-reduced height

    console.log('[DEBUG] Triangle inner box calculation:', {
      elementId: el.id,
      elementPosition: { x: el.x, y: el.y },
      elementSize: { width: el.width, height: el.height },
      textAreaFactors: { textAreaTop, textAreaHeight, textAreaWidth },
      calculatedInnerBox: { x, y, width: textWidth, height: textHeight }
    });

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