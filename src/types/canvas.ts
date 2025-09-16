// types/canvas.ts
export type ElementId = string;

export interface CanvasElement {
  id: ElementId;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible?: boolean;
  locked?: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: Record<string, any>;
  data?: Record<string, any>;
}