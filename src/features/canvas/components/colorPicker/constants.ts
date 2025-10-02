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
  '#FFD262', // Sun yellow
  '#FF9B71', // Tangerine
  '#FF6AD5', // Berry pink
  '#CBA9FF', // Lavender
  '#8FA7FF', // Cornflower
  '#66C6FF', // Sky blue
  '#66E0B8', // Mint
  '#A7F3D0', // Pastel teal
  '#FFEAD7', // Peach haze
  '#F8F0FF', // Soft lilac
  '#5D5AFF', // Indigo accent
  '#2F2A4A', // Deep slate
  '#FFFFFF', // White
  '#1F2937', // Charcoal (high contrast)
];

// FigJam-style horizontal palette tailored for sticky note toolbar
export const FIGMA_HORIZONTAL_PALETTE: string[] = [
  '#FFD262', // Sun yellow
  '#FF9B71', // Tangerine
  '#FF6AD5', // Berry pink
  '#8B7CF7', // Iris
  '#5D5AFF', // Indigo
  '#66C6FF', // Sky blue
  '#66E0B8', // Mint
  '#1F2544', // Deep slate
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