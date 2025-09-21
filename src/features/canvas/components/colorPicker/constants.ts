/**
 * Color picker constants and type definitions
 */

export type ColorPickerMode = 'palette' | 'picker' | 'hybrid' | 'figma-horizontal';

export interface UnifiedColorPickerProps {
  // Core props
  open: boolean;
  mode?: ColorPickerMode;
  color?: string;
  onChange: (color: string) => void;
  onClose: () => void;

  // Positioning - use one or the other
  anchorRect?: DOMRect | null; // For toolbar positioning (bottom/left)
  anchor?: { x: number; y: number }; // For floating positioning (x/y)

  // Customization
  title?: string;
  colors?: string[]; // Custom palette colors
  showColorValue?: boolean; // Show hex value
  autoFocus?: boolean;
  className?: string;

  // Deprecated - for backward compatibility
  selected?: string; // Use 'color' instead
  onSelect?: (color: string) => void; // Use 'onChange' instead
}

// Default FigJam-like sticky note palette
export const DEFAULT_PALETTE: string[] = [
  '#FDE68A', // Yellow
  '#FCA5A5', // Red
  '#86EFAC', // Green
  '#93C5FD', // Blue
  '#C4B5FD', // Purple
  '#FBCFE8', // Pink
  '#FCD34D', // Amber
  '#FDBA74', // Orange
  '#A7F3D0', // Teal
  '#BAE6FD', // Sky
  '#DDD6FE', // Violet
  '#F5D0FE', // Fuchsia
];

// FigJam-style horizontal palette tailored for sticky note toolbar
export const FIGMA_HORIZONTAL_PALETTE: string[] = [
  '#FEF08A', // Bright Yellow
  '#FCA5A5', // Light Red
  '#DDA0DD', // Plum
  '#C4B5FD', // Light Purple
  '#93C5FD', // Light Blue
];

// Additional extended palette
export const EXTENDED_PALETTE: string[] = [
  ...DEFAULT_PALETTE,
  '#F87171', // Red-500
  '#FB923C', // Orange-500
  '#FACC15', // Yellow-500
  '#4ADE80', // Green-500
  '#22D3EE', // Cyan-500
  '#60A5FA', // Blue-500
  '#A78BFA', // Violet-500
  '#F472B6', // Pink-500
  '#E5E7EB', // Gray-200
  '#9CA3AF', // Gray-400
  '#4B5563', // Gray-600
  '#1F2937', // Gray-800
];