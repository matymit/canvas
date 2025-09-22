/**
 * Aspect Ratio Constraint Utility
 *
 * Provides utilities for maintaining aspect ratios during resize operations.
 * Supports sticky notes, shapes, and other elements that need consistent
 * proportions while preserving user flexibility.
 *
 * Phase 18A: Foundation Systems - Aspect Ratio System
 */

/**
 * Constraint modes for aspect ratio handling
 */
export type AspectRatioMode =
  | 'free'        // No constraints, allow any proportions
  | 'locked'      // Maintain current aspect ratio
  | 'square'      // Force 1:1 aspect ratio
  | 'custom';     // Use provided aspect ratio value

/**
 * Configuration for aspect ratio constraints
 */
export interface AspectRatioConfig {
  /** Constraint mode to apply */
  mode: AspectRatioMode;
  /** Custom aspect ratio (width/height) when mode is 'custom' */
  ratio?: number;
  /** Minimum width constraint */
  minWidth?: number;
  /** Minimum height constraint */
  minHeight?: number;
  /** Maximum width constraint */
  maxWidth?: number;
  /** Maximum height constraint */
  maxHeight?: number;
  /** Whether to snap to integer dimensions */
  snapToInteger?: boolean;
}

/**
 * Input dimensions for constraint calculation
 */
export interface DimensionInput {
  /** Current or target width */
  width: number;
  /** Current or target height */
  height: number;
  /** Original width (for ratio calculation) */
  originalWidth?: number;
  /** Original height (for ratio calculation) */
  originalHeight?: number;
}

/**
 * Result of aspect ratio constraint calculation
 */
export interface ConstrainedDimensions {
  /** Constrained width */
  width: number;
  /** Constrained height */
  height: number;
  /** Whether dimensions were modified */
  wasConstrained: boolean;
  /** The aspect ratio that was applied */
  appliedRatio: number;
}

/**
 * Default configurations for common element types
 */
export const DEFAULT_ASPECT_CONFIGS = {
  /** No constraints - free resize */
  FREE: {
    mode: 'free' as const,
    minWidth: 20,
    minHeight: 20,
    snapToInteger: true
  },

  /** Square aspect ratio (1:1) */
  SQUARE: {
    mode: 'square' as const,
    minWidth: 20,
    minHeight: 20,
    snapToInteger: true
  },

  /** Sticky note - typically free but with sensible minimums */
  STICKY_NOTE: {
    mode: 'free' as const,
    minWidth: 60,
    minHeight: 40,
    maxWidth: 400,
    maxHeight: 300,
    snapToInteger: true
  },

  /** Sticky note locked - maintain current proportions */
  STICKY_NOTE_LOCKED: {
    mode: 'locked' as const,
    minWidth: 60,
    minHeight: 40,
    maxWidth: 400,
    maxHeight: 300,
    snapToInteger: true
  },

  /** Text elements - width can change, height typically fixed */
  TEXT: {
    mode: 'free' as const,
    minWidth: 20,
    minHeight: 16,
    snapToInteger: true
  },

  /** Image - typically maintain original aspect ratio */
  IMAGE: {
    mode: 'locked' as const,
    minWidth: 20,
    minHeight: 20,
    snapToInteger: true
  }
} as const;

/**
 * Calculate constrained dimensions based on aspect ratio configuration
 *
 * @param input - Current dimensions and optional original dimensions
 * @param config - Aspect ratio configuration
 * @returns Constrained dimensions with metadata
 */
export function constrainAspectRatio(
  input: DimensionInput,
  config: AspectRatioConfig
): ConstrainedDimensions {
  let { width, height } = input;
  let wasConstrained = false;

  // Calculate the target aspect ratio based on mode
  let targetRatio: number | null = null;

  switch (config.mode) {
    case 'free':
      // No aspect ratio constraints
      break;

    case 'square':
      targetRatio = 1.0;
      break;

    case 'locked': {
      // Use original dimensions if available, otherwise current
      const refWidth = input.originalWidth ?? width;
      const refHeight = input.originalHeight ?? height;
      if (refWidth > 0 && refHeight > 0) {
        targetRatio = refWidth / refHeight;
      }
      break;
    }

    case 'custom':
      if (config.ratio && config.ratio > 0) {
        targetRatio = config.ratio;
      }
      break;
  }

  // Apply aspect ratio constraint if needed
  if (targetRatio !== null && targetRatio > 0) {
    const currentRatio = width / height;

    // Only constrain if the ratio is significantly different
    const ratioTolerance = 0.01;
    if (Math.abs(currentRatio - targetRatio) > ratioTolerance) {
      // Determine which dimension to adjust based on which changed more
      const widthChange = input.originalWidth ? Math.abs(width - input.originalWidth) : 0;
      const heightChange = input.originalHeight ? Math.abs(height - input.originalHeight) : 0;

      if (widthChange >= heightChange) {
        // Width changed more, adjust height
        height = width / targetRatio;
      } else {
        // Height changed more, adjust width
        width = height * targetRatio;
      }

      wasConstrained = true;
    }
  }

  // Apply size constraints
  if (config.minWidth !== undefined && width < config.minWidth) {
    width = config.minWidth;
    if (targetRatio !== null && targetRatio > 0) {
      height = width / targetRatio;
    }
    wasConstrained = true;
  }

  if (config.minHeight !== undefined && height < config.minHeight) {
    height = config.minHeight;
    if (targetRatio !== null && targetRatio > 0) {
      width = height * targetRatio;
    }
    wasConstrained = true;
  }

  if (config.maxWidth !== undefined && width > config.maxWidth) {
    width = config.maxWidth;
    if (targetRatio !== null && targetRatio > 0) {
      height = width / targetRatio;
    }
    wasConstrained = true;
  }

  if (config.maxHeight !== undefined && height > config.maxHeight) {
    height = config.maxHeight;
    if (targetRatio !== null && targetRatio > 0) {
      width = height * targetRatio;
    }
    wasConstrained = true;
  }

  // Snap to integer dimensions if requested
  if (config.snapToInteger) {
    const originalWidth = width;
    const originalHeight = height;
    width = Math.round(width);
    height = Math.round(height);

    if (width !== originalWidth || height !== originalHeight) {
      wasConstrained = true;
    }
  }

  // Calculate the final applied ratio
  const appliedRatio = height > 0 ? width / height : 1;

  return {
    width,
    height,
    wasConstrained,
    appliedRatio
  };
}

/**
 * Helper function to get aspect ratio configuration for common element types
 *
 * @param elementType - Type of element
 * @param locked - Whether aspect ratio should be locked
 * @returns Appropriate aspect ratio configuration
 */
export function getElementAspectConfig(
  elementType: 'sticky-note' | 'text' | 'image' | 'shape' | 'free',
  locked = false
): AspectRatioConfig {
  switch (elementType) {
    case 'sticky-note':
      return locked ? DEFAULT_ASPECT_CONFIGS.STICKY_NOTE_LOCKED : DEFAULT_ASPECT_CONFIGS.STICKY_NOTE;

    case 'text':
      return DEFAULT_ASPECT_CONFIGS.TEXT;

    case 'image':
      return DEFAULT_ASPECT_CONFIGS.IMAGE;

    case 'shape':
      return locked ? DEFAULT_ASPECT_CONFIGS.SQUARE : DEFAULT_ASPECT_CONFIGS.FREE;

    case 'free':
    default:
      return DEFAULT_ASPECT_CONFIGS.FREE;
  }
}

/**
 * Create a constraint function for use in transform operations
 *
 * @param config - Aspect ratio configuration
 * @param originalDimensions - Original dimensions for reference
 * @returns Function that can be used as Konva boundBoxFunc
 */
export function createAspectRatioConstraint(
  config: AspectRatioConfig,
  originalDimensions?: { width: number; height: number }
) {
  return (_oldBox: { x: number; y: number; width: number; height: number; rotation: number }, newBox: { x: number; y: number; width: number; height: number; rotation: number }) => {
    const constrained = constrainAspectRatio(
      {
        width: newBox.width,
        height: newBox.height,
        originalWidth: originalDimensions?.width,
        originalHeight: originalDimensions?.height
      },
      config
    );

    return {
      ...newBox,
      width: constrained.width,
      height: constrained.height
    };
  };
}

/**
 * Check if an aspect ratio is approximately square
 *
 * @param ratio - Aspect ratio to check
 * @param tolerance - Tolerance for square detection (default: 0.1)
 * @returns True if ratio is approximately 1:1
 */
export function isApproximatelySquare(ratio: number, tolerance = 0.1): boolean {
  return Math.abs(ratio - 1.0) <= tolerance;
}

/**
 * Calculate aspect ratio from dimensions
 *
 * @param width - Width dimension
 * @param height - Height dimension
 * @returns Aspect ratio (width/height)
 */
export function calculateAspectRatio(width: number, height: number): number {
  return height > 0 ? width / height : 1;
}

/**
 * Find the closest standard aspect ratio to given dimensions
 *
 * @param width - Width dimension
 * @param height - Height dimension
 * @returns Object with ratio value and descriptive name
 */
export function findClosestStandardRatio(width: number, height: number): { ratio: number; name: string } {
  const currentRatio = calculateAspectRatio(width, height);

  const standardRatios = [
    { ratio: 1.0, name: 'Square (1:1)' },
    { ratio: 4/3, name: 'Traditional (4:3)' },
    { ratio: 3/2, name: 'Classic (3:2)' },
    { ratio: 16/9, name: 'Widescreen (16:9)' },
    { ratio: 1.618, name: 'Golden Ratio (φ)' },
    { ratio: 2.0, name: 'Double (2:1)' }
  ];

  let closest = standardRatios[0];
  let minDifference = Math.abs(currentRatio - closest.ratio);

  for (const standard of standardRatios) {
    const difference = Math.abs(currentRatio - standard.ratio);
    if (difference < minDifference) {
      minDifference = difference;
      closest = standard;
    }
  }

  return closest;
}

/**
 * Type guard to check if a configuration has aspect ratio constraints
 *
 * @param config - Aspect ratio configuration
 * @returns True if configuration applies constraints
 */
export function hasAspectConstraints(config: AspectRatioConfig): boolean {
  return config.mode !== 'free';
}