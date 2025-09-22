import Konva from 'konva';

// Returns an inner content rect (world coords) for a shape with padding.
export type InnerBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface BaseShape {
  id: string;
  type: 'rectangle' | 'circle' | 'triangle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  // Optional text props if already present
  padding?: number;
  data?: {
    radius?: number; // for circle - stored in data object
    [key: string]: unknown;
  };
}

const MIN_CONTENT_SIDE = 12;
const CIRCLE_TEXT_RATIO = 0.7;

/**
 * Measures text height using Konva.Text for precise text positioning.
 * Required for matching editor overlay height with Konva.Text rendering.
 */
export function measureTextHeight(text: string, options: {
  fontSize: number;
  fontFamily: string;
  width: number;
  lineHeight?: number;
}): number {
  // Create temporary Konva.Text instance for measurement
  const tempText = new Konva.Text({
    text: text,
    fontSize: options.fontSize,
    fontFamily: options.fontFamily,
    width: options.width,
    lineHeight: options.lineHeight || 1.2,
    wrap: 'word'
  });

  const height = tempText.height();
  tempText.destroy();

  return height;
}

export function computeShapeInnerBox(el: BaseShape, pad: number = 8): InnerBox {
  const px = Math.max(0, pad);
  if (el.type === 'rectangle' && el.width && el.height) {
    const w = Math.max(0, el.width - px * 2);
    const h = Math.max(0, el.height - px * 2);
    return { x: el.x + px, y: el.y + px, width: w, height: h };
  }

  // Circle: reserve a fixed square (70% of the current diameter) so manual resizing stays predictable.
  // Konva.Circle is positioned by center (x, y) and uses radius property
  if (el.type === 'circle') {
    let radius: number;
    if (el.data?.radius !== undefined) {
      radius = el.data.radius;
    } else if (el.width !== undefined && el.height !== undefined) {
      radius = Math.min(el.width, el.height) / 2;
    } else {
      radius = 50;
    }

    const diameterX = el.width ?? radius * 2;
    const diameterY = el.height ?? radius * 2;
    const diameter = Math.max(MIN_CONTENT_SIDE, Math.min(diameterX, diameterY));
    const targetSide = diameter * CIRCLE_TEXT_RATIO;
    const contentSide = Math.max(MIN_CONTENT_SIDE, targetSide - px * 2);
    const halfSide = contentSide / 2;

    return {
      x: el.x - halfSide,
      y: el.y - halfSide,
      width: contentSide,
      height: contentSide,
    };
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

    // Debug: Triangle inner box calculation: elementId=${el.id}, elementPosition=${JSON.stringify({ x: el.x, y: el.y })}, elementSize=${JSON.stringify({ width: el.width, height: el.height })}, textAreaFactors=${JSON.stringify({ textAreaTop, textAreaHeight, textAreaWidth })}, calculatedInnerBox=${JSON.stringify({ x, y, width: textWidth, height: textHeight })}

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
