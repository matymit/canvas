// Text measurement utility scaffold for table cell text and future text wrapping
// Provides baseline functionality that can be expanded with canvas measurement and wrapping

export interface MeasureInput {
  text: string;
  fontFamily: string;
  fontSize: number;
  maxWidth?: number;
  lineHeight?: number;
}

export interface MeasureResult {
  width: number;
  height: number;
  lines: string[];
  lineWidths: number[];
}

export interface TextMetrics {
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  fontBoundingBoxAscent: number;
  fontBoundingBoxDescent: number;
  width: number;
}

// Cache for repeated measurements
const measurementCache = new Map<string, MeasureResult>();
const MAX_CACHE_SIZE = 1000;

/**
 * Generate cache key for measurement input
 */
function getCacheKey(input: MeasureInput): string {
  return `${input.fontFamily}-${input.fontSize}-${input.maxWidth || 'auto'}-${input.lineHeight || 'auto'}-${input.text}`;
}

/**
 * Prune cache if it exceeds maximum size
 */
function pruneCache() {
  if (measurementCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (Map maintains insertion order)
    const keysToDelete = Array.from(measurementCache.keys()).slice(0, Math.floor(MAX_CACHE_SIZE * 0.3));
    keysToDelete.forEach(key => measurementCache.delete(key));
  }
}

/**
 * Measure text using canvas context for accurate dimensions
 * Falls back to approximate calculation if canvas is not available
 */
export function measureText(input: MeasureInput): MeasureResult {
  const cacheKey = getCacheKey(input);
  const cached = measurementCache.get(cacheKey);
  if (cached) return cached;

  let result: MeasureResult;

  try {
    result = measureTextWithCanvas(input);
  } catch {
    // Fallback to approximate measurement
    result = measureTextApproximate(input);
  }

  // Cache the result
  measurementCache.set(cacheKey, result);
  pruneCache();

  return result;
}

/**
 * Accurate text measurement using canvas context
 */
function measureTextWithCanvas(input: MeasureInput): MeasureResult {
  const { text, fontFamily, fontSize, maxWidth, lineHeight = fontSize * 1.2 } = input;
  
  // Create offscreen canvas for measurement
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.font = `${fontSize}px ${fontFamily}`;
  
  if (!maxWidth) {
    // Single line measurement
    const metrics = ctx.measureText(text);
    return {
      width: metrics.width,
      height: lineHeight,
      lines: [text],
      lineWidths: [metrics.width],
    };
  }

  // Multi-line text wrapping
  const words = text.split(/\s+/);
  const lines: string[] = [];
  const lineWidths: number[] = [];
  let currentLine = '';
  let maxLineWidth = 0;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        lineWidths.push(ctx.measureText(currentLine).width);
        maxLineWidth = Math.max(maxLineWidth, lineWidths[lineWidths.length - 1]);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
    lineWidths.push(ctx.measureText(currentLine).width);
    maxLineWidth = Math.max(maxLineWidth, lineWidths[lineWidths.length - 1]);
  }

  return {
    width: maxLineWidth,
    height: lines.length * lineHeight,
    lines,
    lineWidths,
  };
}

/**
 * Approximate text measurement for fallback scenarios
 * Less accurate but works without canvas context
 */
function measureTextApproximate(input: MeasureInput): MeasureResult {
  const { text, fontSize, maxWidth, lineHeight = fontSize * 1.2 } = input;
  
  // Rough character width estimation (varies by font)
  const avgCharWidth = fontSize * 0.6;
  
  if (!maxWidth) {
    // Single line
    const width = text.length * avgCharWidth;
    return {
      width,
      height: lineHeight,
      lines: [text],
      lineWidths: [width],
    };
  }

  // Simple word wrapping approximation
  const words = text.split(/\s+/);
  const lines: string[] = [];
  const lineWidths: number[] = [];
  let currentLine = '';
  let maxLineWidth = 0;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        const lineWidth = currentLine.length * avgCharWidth;
        lineWidths.push(lineWidth);
        maxLineWidth = Math.max(maxLineWidth, lineWidth);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
    const lineWidth = currentLine.length * avgCharWidth;
    lineWidths.push(lineWidth);
    maxLineWidth = Math.max(maxLineWidth, lineWidth);
  }

  return {
    width: maxLineWidth,
    height: lines.length * lineHeight,
    lines,
    lineWidths,
  };
}

/**
 * Calculate optimal cell height for given text content
 * Used by table renderer to auto-size rows based on text
 */
export function calculateCellHeight(
  text: string,
  cellWidth: number,
  style: {
    fontFamily: string;
    fontSize: number;
    paddingX: number;
    paddingY: number;
  }
): number {
  const contentWidth = Math.max(0, cellWidth - 2 * style.paddingX);
  
  const measurement = measureText({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    maxWidth: contentWidth,
  });

  return measurement.height + 2 * style.paddingY;
}

/**
 * Calculate optimal cell width for given text content
 * Used for auto-sizing columns
 */
export function calculateCellWidth(
  text: string,
  style: {
    fontFamily: string;
    fontSize: number;
    paddingX: number;
  },
  minWidth: number = 60
): number {
  const measurement = measureText({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
  });

  const contentWidth = measurement.width + 2 * style.paddingX;
  return Math.max(minWidth, contentWidth);
}

/**
 * Break text into lines that fit within a given width
 * Returns array of text lines
 */
export function wrapText(
  text: string,
  maxWidth: number,
  style: {
    fontFamily: string;
    fontSize: number;
  }
): string[] {
  const measurement = measureText({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    maxWidth,
  });

  return measurement.lines;
}

/**
 * Clear the measurement cache
 * Useful for memory management or when font loading changes
 */
export function clearMeasurementCache(): void {
  measurementCache.clear();
}

/**
 * Get current cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: measurementCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}