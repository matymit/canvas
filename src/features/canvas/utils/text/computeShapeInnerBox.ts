import Konva from 'konva';

// Returns an inner content rect (world coords) for a shape with padding.
export type InnerBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  circleContainerSide?: number;
  circlePadding?: number;
  circleClipRadius?: number;
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
    [key: string]: any;
  };
}

const MIN_CONTENT_SIDE = 12;
const CIRCLE_TEXT_CONTAINER_RATIO = 0.75;
const CIRCLE_TEXT_CONTENT_RATIO = 0.9; // leaves 5% inset per side within the container
const CIRCLE_TEXT_MIN_PADDING = 4;

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

  // Circle: Use conservative, proportional geometry to guarantee circular containment
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

    const diameter = radius * 2;
    const containerSide = Math.max(MIN_CONTENT_SIDE, diameter * CIRCLE_TEXT_CONTAINER_RATIO);

    const basePadding = Math.max(
      CIRCLE_TEXT_MIN_PADDING,
      (containerSide * (1 - CIRCLE_TEXT_CONTENT_RATIO)) / 2
    );

    const requestedPadding = px;
    const totalPadding = Math.min(
      containerSide / 2 - 1,
      basePadding + requestedPadding
    );

    const contentSide = Math.max(
      MIN_CONTENT_SIDE,
      containerSide - totalPadding * 2
    );

    const halfContent = contentSide / 2;

    return {
      x: el.x - halfContent,
      y: el.y - halfContent,
      width: contentSide,
      height: contentSide,
      circleContainerSide: containerSide,
      circlePadding: totalPadding,
      circleClipRadius: containerSide / 2,
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
