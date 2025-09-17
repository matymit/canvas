// Canvas element types
export type ElementId = string;

export interface CanvasElement {
  id: ElementId;
  type:
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
  bounds?: Bounds; // For elements that track their bounds
  data?: any; // Type-specific data
  fill?: string; // Direct fill property for some elements
  text?: string; // Direct text property for text elements
  imageUrl?: string; // Direct image URL for image elements
  path?: string; // Direct path for path elements
  points?: number[]; // Direct points for line/path elements
  textColor?: string; // Direct text color for text elements
  colWidths?: number[]; // Column widths for table elements
  style?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    strokeDashArray?: number[];
    fontSize?: number;
    fontFamily?: string;
    textAlign?: string;
  };
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
