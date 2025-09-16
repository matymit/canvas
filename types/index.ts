// Canvas element types
export type ElementId = string;

export interface CanvasElement {
  id: ElementId;
  type: 'rectangle' | 'ellipse' | 'line' | 'text' | 'path' | 'image' | 'group' | 'triangle' | 'table' | 'mindmap-node' | 'mindmap-edge' | 'connector';
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
  bounds?: Bounds; // For elements that track their bounds
  data?: any; // Type-specific data
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