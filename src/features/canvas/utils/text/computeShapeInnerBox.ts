import Konva from 'konva';

// Returns an inner content rect (world coords) for a shape with padding.
export type InnerBox = { x: number; y: number; width: number; height: number };

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

/**
 * EXACT SPECIFICATION: Computes the maximal square inscribed within a circle
 * for perfect text centering as specified in the user's comprehensive analysis.
 */
export function computeCircleTextBox(circle: { x: number; y: number; radius: number }): { x: number; y: number; size: number } {
  const size = circle.radius * Math.sqrt(2); // maximal square
  return {
    x: circle.x - size / 2,
    y: circle.y - size / 2,
    size
  };
}

/**
 * EXACT SPECIFICATION: Measures text height using Konva.Text for precise text positioning.
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

  console.log('[DEBUG] Text height measurement:', {
    text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    options,
    measuredHeight: height
  });

  return height;
}

export function computeShapeInnerBox(el: BaseShape, pad: number = 8): InnerBox {
  const px = Math.max(0, pad);
  if (el.type === 'rectangle' && el.width && el.height) {
    const w = Math.max(0, el.width - px * 2);
    const h = Math.max(0, el.height - px * 2);
    return { x: el.x + px, y: el.y + px, width: w, height: h };
  }

  // Circle: Use the EXACT specification from user's comprehensive analysis
  // Konva.Circle is positioned by center (x, y) and uses radius property
  if (el.type === 'circle') {
    // Get the actual radius - check data.radius first, then fallback to width/height
    let radius: number;
    if (el.data?.radius !== undefined) {
      radius = el.data.radius;
    } else if (el.width !== undefined && el.height !== undefined) {
      // Fallback: use smaller dimension to ensure perfect circle
      radius = Math.min(el.width, el.height) / 2;
    } else {
      // Default fallback
      radius = 50;
    }

    // Use the EXACT computeCircleTextBox function as specified
    const textBox = computeCircleTextBox({ x: el.x, y: el.y, radius });

    // Apply minimal padding to the textBox size, not the original calculation
    const paddedSize = Math.max(20, textBox.size - (px * 2));

    // Recalculate position with padding adjustment
    const adjustmentX = (textBox.size - paddedSize) / 2;
    const adjustmentY = (textBox.size - paddedSize) / 2;

    const result = {
      x: textBox.x + adjustmentX,
      y: textBox.y + adjustmentY,
      width: paddedSize,
      height: paddedSize,
    };

    console.log('[DEBUG] Circle text positioning (EXACT SPECIFICATION):', {
      elementId: el.id,
      inputElement: { x: el.x, y: el.y, dataRadius: el.data?.radius, width: el.width, height: el.height },
      calculatedRadius: radius,
      exactTextBox: textBox,
      paddingApplied: px,
      paddedSize: paddedSize,
      adjustments: { adjustmentX, adjustmentY },
      finalInnerBox: result,
      formula: 'size = radius * sqrt(2), perfectly centered'
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