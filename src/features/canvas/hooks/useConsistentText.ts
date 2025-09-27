/**
 * useConsistentText Hook
 *
 * Provides standardized text rendering utilities for all canvas elements.
 * Ensures consistent typography across text elements, shapes, sticky notes,
 * mindmaps, and other text-containing components.
 *
 * Phase 18A: Foundation Systems - Text Consistency Infrastructure
 */

import { useMemo } from 'react';
import {
  getTextConfig,
  createFontString,
  MIGRATION_HELPERS,
  type TextElementType,
  type TextConfig
} from '../constants/TextConstants';

/**
 * Parameters for text measurement and rendering
 */
interface TextMeasurementOptions {
  /** Maximum width for text wrapping */
  maxWidth?: number;
  /** Whether to include line height in measurements */
  includeLineHeight?: boolean;
  /** Canvas context for precise measurements */
  context?: CanvasRenderingContext2D;
}

/**
 * Result of text measurement operations
 */
interface TextMeasurement {
  /** Measured width of the text */
  width: number;
  /** Calculated height of the text */
  height: number;
  /** Number of lines if wrapping */
  lines: number;
  /** Font string used for measurement */
  fontString: string;
}

/**
 * Hook return type providing text utilities
 */
interface UseConsistentTextReturn {
  /** Get standardized text configuration for element type */
  getConfig: (elementType: TextElementType) => TextConfig;
  /** Create CSS font string from configuration */
  getFontString: (config: TextConfig) => string;
  /** Measure text dimensions with given configuration */
  measureText: (text: string, config: TextConfig, options?: TextMeasurementOptions) => TextMeasurement;
  /** Get configuration for element with fallback to consistent values */
  getElementConfig: (elementType: TextElementType, currentFontSize?: number, currentFontFamily?: string) => TextConfig;
  /** Normalize legacy text properties to consistent values */
  normalizeLegacyText: (fontSize?: number, fontFamily?: string) => { fontSize: number; fontFamily: string };
  /** Check if text configuration matches standard */
  isStandardConfig: (config: Partial<TextConfig>, elementType: TextElementType) => boolean;
}

/**
 * Hook providing consistent text rendering utilities across the canvas application
 *
 * Usage:
 * ```typescript
 * const { getConfig, measureText, getElementConfig } = useConsistentText();
 *
 * // Get standard configuration for element type
 * const textConfig = getConfig('TEXT');
 *
 * // Measure text for layout calculations
 * const measurement = measureText('Hello World', textConfig);
 *
 * // Get config with legacy fallbacks
 * const elementConfig = getElementConfig('STICKY_NOTE', element.style?.fontSize);
 * ```
 *
 * @returns Object containing text utilities and measurement functions
 */
export function useConsistentText(): UseConsistentTextReturn {
  // Memoize commonly used configurations to avoid recreations
  const standardConfigs = useMemo(() => {
    const configs = {} as Record<TextElementType, TextConfig>;
    (['TEXT', 'STICKY_NOTE', 'SHAPE', 'CIRCLE', 'MINDMAP_ROOT', 'MINDMAP_CHILD', 'UI', 'TABLE'] as const).forEach(type => {
      configs[type] = getTextConfig(type);
    });
    return configs;
  }, []);

  // Get standardized text configuration for element type
  const getConfig = useMemo(() => (elementType: TextElementType): TextConfig => {
    return standardConfigs[elementType];
  }, [standardConfigs]);

  // Create CSS font string from configuration
  const getFontString = useMemo(() => (config: TextConfig): string => {
    return createFontString(config);
  }, []);

  // Measure text dimensions with given configuration
  const measureText = useMemo(() => (
    text: string,
    config: TextConfig,
    options: TextMeasurementOptions = {}
  ): TextMeasurement => {
    const { maxWidth, includeLineHeight = true, context } = options;

    // Create measurement context if not provided
    const canvas = context ? null : document.createElement('canvas');
    const ctx = context || canvas?.getContext('2d');

    if (!ctx) {
      // Fallback measurement for SSR or context creation failure
      const fallbackWidth = text.length * (config.fontSize * 0.6);
      return {
        width: maxWidth ? Math.min(fallbackWidth, maxWidth) : fallbackWidth,
        height: config.fontSize * (includeLineHeight ? config.lineHeight : 1),
        lines: maxWidth ? Math.ceil(fallbackWidth / maxWidth) : 1,
        fontString: getFontString(config)
      };
    }

    // Set font for accurate measurement
    const fontString = getFontString(config);
    ctx.font = fontString;

    // Handle single line measurement
    if (!maxWidth) {
      const metrics = ctx.measureText(text);
      const width = metrics.width;
      const height = config.fontSize * (includeLineHeight ? config.lineHeight : 1);

      return {
        width,
        height,
        lines: 1,
        fontString
      };
    }

    // Handle multi-line text with wrapping
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate final dimensions
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const totalHeight = lines.length * config.fontSize * (includeLineHeight ? config.lineHeight : 1);

    // Cleanup temporary canvas
    if (canvas) {
      canvas.remove();
    }

    return {
      width: Math.min(maxLineWidth, maxWidth),
      height: totalHeight,
      lines: lines.length,
      fontString
    };
  }, [getFontString]);

  // Get configuration for element with fallback to consistent values
  const getElementConfig = useMemo(() => (
    elementType: TextElementType,
    currentFontSize?: number,
    currentFontFamily?: string
  ): TextConfig => {
    const standardConfig = getConfig(elementType);

    // If no overrides provided, return standard config
    if (currentFontSize === undefined && currentFontFamily === undefined) {
      return standardConfig;
    }

    // Apply migration helpers for legacy values
    const normalizedSize = currentFontSize !== undefined
      ? MIGRATION_HELPERS.getLegacyFontSize(currentFontSize)
      : standardConfig.fontSize;

    const normalizedFamily = currentFontFamily !== undefined
      ? MIGRATION_HELPERS.getLegacyFontFamily(currentFontFamily)
      : standardConfig.fontFamily;

    return {
      ...standardConfig,
      fontSize: normalizedSize,
      fontFamily: normalizedFamily
    } as TextConfig;
  }, [getConfig]);

  // Normalize legacy text properties to consistent values
  const normalizeLegacyText = useMemo(() => (
    fontSize?: number,
    fontFamily?: string
  ) => {
    return {
      fontSize: MIGRATION_HELPERS.getLegacyFontSize(fontSize),
      fontFamily: MIGRATION_HELPERS.getLegacyFontFamily(fontFamily)
    };
  }, []);

  // Check if text configuration matches standard
  const isStandardConfig = useMemo(() => (
    config: Partial<TextConfig>,
    elementType: TextElementType
  ): boolean => {
    const standardConfig = getConfig(elementType);

    // Check each provided property against standard
    return Object.entries(config).every(([key, value]) => {
      return standardConfig[key as keyof TextConfig] === value;
    });
  }, [getConfig]);

  return {
    getConfig,
    getFontString,
    measureText,
    getElementConfig,
    normalizeLegacyText,
    isStandardConfig
  };
}

/**
 * Utility hook for text width measurement specifically
 * Optimized for cases where only width is needed
 */
export function useTextWidth() {
  const { measureText, getConfig } = useConsistentText();

  return useMemo(() => (
    text: string,
    elementType: TextElementType = 'TEXT',
    context?: CanvasRenderingContext2D
  ): number => {
    const config = getConfig(elementType);
    const measurement = measureText(text, config, { context, includeLineHeight: false });
    return measurement.width;
  }, [measureText, getConfig]);
}

/**
 * Utility hook for checking if an element needs text config updates
 * Helps identify elements that should be migrated to consistent typography
 */
export function useTextConfigValidation() {
  const { isStandardConfig, getConfig } = useConsistentText();

  return useMemo(() => (
    element: { style?: { fontSize?: number; fontFamily?: string } },
    elementType: TextElementType
  ): { needsUpdate: boolean; standardConfig: TextConfig; currentConfig: Partial<TextConfig> } => {
    const standardConfig = getConfig(elementType);
    const currentConfig = {
      fontSize: element.style?.fontSize,
      fontFamily: element.style?.fontFamily
    };

    // Remove undefined values for comparison
    const cleanCurrentConfig = Object.fromEntries(
      Object.entries(currentConfig).filter(([, value]) => value !== undefined)
    );

    const needsUpdate = !isStandardConfig(cleanCurrentConfig, elementType);

    return {
      needsUpdate,
      standardConfig,
      currentConfig: cleanCurrentConfig
    };
  }, [isStandardConfig, getConfig]);
}
