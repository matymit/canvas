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

  // Circle: Optimized for better text space utilization
  // Konva.Circle is positioned by center (x, y) and uses radius property
  if (el.type === 'circle') {
    // Get the actual radius - prefer radius property, fallback to width/height
    let radius: number;
    if (el.radius !== undefined) {
      radius = el.radius;
    } else if (el.width !== undefined && el.height !== undefined) {
      // Fallback: use smaller dimension to ensure perfect circle
      radius = Math.min(el.width, el.height) / 2;
    } else {
      // Default fallback
      radius = 50;
    }

    // Circle is positioned at its center (x, y)
    const centerX = el.x;
    const centerY = el.y;

    // OPTIMIZED: Use 85% of radius for much better text space utilization
    // This gives users more space to type while keeping text well within circle bounds
    // Mathematical note: inscribed square (radius * √2) ≈ 141% of radius, but that's too small
    // 85% provides the sweet spot between usability and aesthetics
    const effectiveRadius = radius * 0.85;
    const textAreaSide = effectiveRadius * 2; // Full diameter of the text area
    
    // Reduce padding for circles to maximize text space
    const circularPadding = Math.min(px, 4); // Cap padding at 4px for circles
    const paddedSide = Math.max(20, textAreaSide - (circularPadding * 2)); // Minimum 20px text area

    // Position the text area centered within the circle
    const squareX = centerX - (paddedSide / 2);
    const squareY = centerY - (paddedSide / 2);

    const result = {
      x: squareX,
      y: squareY,
      width: paddedSide,
      height: paddedSide,
    };

    console.log('[DEBUG] Circle text positioning (OPTIMIZED):', {
      elementId: el.id,
      inputElement: { x: el.x, y: el.y, radius: el.radius, width: el.width, height: el.height },
      calculatedRadius: radius,
      circleCenter: { centerX, centerY },
      effectiveRadius: effectiveRadius,
      textAreaSide: textAreaSide,
      paddedSide: paddedSide,
      finalInnerBox: result,
      paddingUsed: circularPadding,
      spaceUtilization: `${Math.round((paddedSide / (radius * 2)) * 100)}% of circle diameter`
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