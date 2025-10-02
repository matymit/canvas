/**
 * Unified Text Constants for Canvas Application
 *
 * Provides consistent typography across all canvas elements including text, shapes,
 * sticky notes, mindmaps, and UI components. Follows FigJam-style design principles
 * with clear hierarchy and accessibility.
 *
 * Phase 18A: Foundation Systems - Text Consistency Infrastructure
 */

/**
 * Standard font family stack following modern best practices
 * Consistent with existing Inter usage across the application
 */
export const FONT_FAMILIES = {
  /** Primary font stack for all canvas text content */
  PRIMARY: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

  /** System font stack for UI elements and overlays */
  SYSTEM: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',

  /** Monospace font for code or special content */
  MONO: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace'
} as const;

/**
 * Font sizes following consistent scale and element hierarchy
 * Based on analysis of existing usage patterns across renderers
 */
export const FONT_SIZES = {
  /** Large headings and primary text elements */
  LARGE: 16,

  /** Standard body text and most canvas elements */
  MEDIUM: 16,

  /** Secondary text, sticky notes, mindmap child nodes */
  SMALL: 16,

  /** UI labels, annotations, spacing indicators */
  TINY: 16,

  /** Circle text (special case for readability in constrained space) */
  CIRCLE: 16,

  /** Mindmap root nodes (emphasis for hierarchy) */
  MINDMAP_ROOT: 18,

  /** Mindmap child nodes */
  MINDMAP_CHILD: 15
} as const;

/**
 * Font weights for text hierarchy and emphasis
 */
export const FONT_WEIGHTS = {
  /** Normal text weight */
  NORMAL: 400,

  /** Medium weight for subtle emphasis */
  MEDIUM: 500,

  /** Semi-bold for headings and important text */
  SEMI_BOLD: 600,

  /** Bold for strong emphasis */
  BOLD: 700
} as const;

/**
 * Line height values for optimal readability
 */
export const LINE_HEIGHTS = {
  /** Tight line height for compact text */
  TIGHT: 1.2,

  /** Normal line height for standard readability */
  NORMAL: 1.4,

  /** Relaxed line height for large text */
  RELAXED: 1.6
} as const;

/**
 * Text element type configurations combining size, family, and weight
 * Provides easy access to consistent text styling for each element type
 */
export const TEXT_ELEMENT_CONFIGS = {
  /** Configuration for standalone text elements */
  TEXT: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.LARGE,
    fontWeight: FONT_WEIGHTS.NORMAL,
    lineHeight: LINE_HEIGHTS.NORMAL
  },

  /** Configuration for sticky note text */
  STICKY_NOTE: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.SMALL,
    fontWeight: FONT_WEIGHTS.NORMAL,
    lineHeight: LINE_HEIGHTS.NORMAL
  },

  /** Configuration for shape text (rectangle, triangle) */
  SHAPE: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.MEDIUM,
    fontWeight: FONT_WEIGHTS.NORMAL,
    lineHeight: LINE_HEIGHTS.TIGHT
  },

  /** Configuration for circle text (special case) */
  CIRCLE: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.CIRCLE,
    fontWeight: FONT_WEIGHTS.MEDIUM,
    lineHeight: LINE_HEIGHTS.TIGHT
  },

  /** Configuration for mindmap root nodes */
  MINDMAP_ROOT: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.MINDMAP_ROOT,
    fontWeight: FONT_WEIGHTS.MEDIUM,
    lineHeight: LINE_HEIGHTS.NORMAL
  },

  /** Configuration for mindmap child nodes */
  MINDMAP_CHILD: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.MINDMAP_CHILD,
    fontWeight: FONT_WEIGHTS.NORMAL,
    lineHeight: LINE_HEIGHTS.NORMAL
  },

  /** Configuration for UI elements and overlays */
  UI: {
    fontFamily: FONT_FAMILIES.SYSTEM,
    fontSize: FONT_SIZES.TINY,
    fontWeight: FONT_WEIGHTS.NORMAL,
    lineHeight: LINE_HEIGHTS.NORMAL
  },

  /** Configuration for table cells */
  TABLE: {
    fontFamily: FONT_FAMILIES.PRIMARY,
    fontSize: FONT_SIZES.MEDIUM,
    fontWeight: FONT_WEIGHTS.NORMAL,
    lineHeight: LINE_HEIGHTS.NORMAL
  }
} as const;

/**
 * Helper function to get text configuration for an element type
 * Provides type safety and consistent access to text styling
 *
 * @param elementType - The type of canvas element
 * @returns Complete text configuration object
 */
export function getTextConfig(elementType: keyof typeof TEXT_ELEMENT_CONFIGS) {
  return TEXT_ELEMENT_CONFIGS[elementType];
}

/**
 * Helper function to create CSS font shorthand
 * Useful for DOM elements and measurements
 *
 * @param config - Text configuration object
 * @returns CSS font shorthand string
 */
export function createFontString(config: typeof TEXT_ELEMENT_CONFIGS[keyof typeof TEXT_ELEMENT_CONFIGS]): string {
  return `${config.fontWeight} ${config.fontSize}px/${config.lineHeight} ${config.fontFamily}`;
}

/**
 * Migration helpers for updating existing elements
 * Provides backward compatibility while encouraging consistent usage
 */
export const MIGRATION_HELPERS = {
  /** Get appropriate font size for legacy elements */
  getLegacyFontSize: (
    currentSize?: number,
  ): typeof FONT_SIZES[keyof typeof FONT_SIZES] => {
    if (!currentSize) return FONT_SIZES.MEDIUM;

    // Map existing sizes to standardized ones
    if (currentSize <= 12) return FONT_SIZES.TINY;
    if (currentSize <= 14) return FONT_SIZES.SMALL;
    if (currentSize <= 16) return FONT_SIZES.MEDIUM;
    if (currentSize <= 18) return FONT_SIZES.LARGE;
    return FONT_SIZES.CIRCLE; // For sizes > 18
  },

  /** Get standardized font family from legacy strings */
  getLegacyFontFamily: (
    _currentFamily?: string,
  ): typeof FONT_FAMILIES.PRIMARY | typeof FONT_FAMILIES.SYSTEM => {
    // All elements should use primary font family for consistency
    return FONT_FAMILIES.PRIMARY;
  }
} as const;

/**
 * Type definitions for TypeScript integration
 */
export type FontFamily = typeof FONT_FAMILIES[keyof typeof FONT_FAMILIES];
export type FontSize = typeof FONT_SIZES[keyof typeof FONT_SIZES];
export type FontWeight = typeof FONT_WEIGHTS[keyof typeof FONT_WEIGHTS];
export type LineHeight = typeof LINE_HEIGHTS[keyof typeof LINE_HEIGHTS];
export type TextElementType = keyof typeof TEXT_ELEMENT_CONFIGS;
export type TextConfig = typeof TEXT_ELEMENT_CONFIGS[TextElementType];
