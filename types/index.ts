// Canvas element types
export type ElementId = string;

export interface CanvasElement {
  readonly id: ElementId;
  readonly type:
    | "rectangle"
    | "ellipse"
    | "line"
    | "text"
    | "path"
    | "image"
    | "group"
    | "triangle"
    | "table"
    | "mindmap-node"
    | "mindmap-edge"
    | "connector"
    | "sticky-note"
    | "pen"
    | "marker"
    | "highlighter"
    | "eraser"
    | "drawing"
    | "circle";
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  draggable?: boolean;
  resizable?: boolean; // Phase 18A: Control whether element can be resized via transformer
  keepAspectRatio?: boolean; // Preserve aspect ratio during transforms
  bounds?: Bounds; // For elements that track their bounds
  data?: Record<string, unknown>; // Type-specific data
  fill?: string; // Direct fill property for some elements
  text?: string; // Direct text property for text elements
  imageUrl?: string; // Direct image URL for image elements
  src?: string; // Image source for raster elements
  idbKey?: string; // IndexedDB storage key for large assets
  path?: string; // Direct path for path elements
  points?: number[]; // Direct points for line/path elements
  textColor?: string; // Direct text color for text elements
  colWidths?: number[]; // Column widths for table elements
  rowHeights?: number[]; // Row heights for table elements
  rows?: number; // Number of rows for table elements
  cols?: number; // Number of columns for table elements
  cells?: Array<{ text: string }>; // Cell data for table elements
  subtype?: string; // For drawing tools (pen, marker, etc.)
  style?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDashArray?: number[];
    fontSize?: number;
    fontFamily?: string;
    textAlign?: string;
    opacity?: number;
    lineCap?: string;
    lineJoin?: string;
    globalCompositeOperation?: string;
  };
  lockAspectRatio?: boolean; // Optional aspect ratio lock flag for transforms
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skewX?: number;
  skewY?: number;
}
