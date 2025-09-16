// features/canvas/stores/modules/drawingModule.ts
import { nanoid } from 'nanoid';
import type { StoreSlice } from './types';
import type { ElementId, CanvasElement } from '../../../../../types/index';

export interface Point {
  x: number;
  y: number;
}

export type DrawingToolId = 'pen' | 'marker' | 'highlighter';

export interface BrushStyle {
  color: string;
  width: number;
  opacity: number;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'miter' | 'bevel';
  smoothing: number; // 0..1, consumer decides smoothing algorithm
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay';
}

export interface DrawingTransientState {
  isDrawing: boolean;
  activeTool: DrawingToolId;
  currentPoints: number[]; // flat [x1,y1,x2,y2,...]
  currentStrokeId?: ElementId; // optional if consumer mirrors temp node
  startedAt?: number; // ms
}

export interface DrawingModuleSlice {
  // Settings for each drawing tool (editable via UI)
  brushByTool: Record<DrawingToolId, BrushStyle>;

  // Transient drawing state
  drawing: DrawingTransientState;

  // Mutators
  setDrawingTool: (tool: DrawingToolId) => void;
  setBrush: (tool: DrawingToolId, patch: Partial<BrushStyle>) => void;

  // Ephemeral lifecycle (drive direct Konva via tool components)
  startDrawing: (start: Point, opts?: { strokeId?: ElementId }) => void;
  addPoint: (pt: Point) => void;
  addPoints: (pts: Point[]) => void;
  endDrawing: (opts?: { commit?: boolean }) => ElementId | undefined;
  cancelDrawing: () => void;
}

export const createDrawingModule: StoreSlice<DrawingModuleSlice> = (set, get) => ({
  brushByTool: {
    pen: {
      color: '#1f2937', // slate-800
      width: 2,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      smoothing: 0.2,
      blendMode: 'normal',
    },
    marker: {
      color: '#111827', // gray-900
      width: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      smoothing: 0.25,
      blendMode: 'normal',
    },
    highlighter: {
      color: '#f59e0b', // amber-500
      width: 10,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
      smoothing: 0.1,
      blendMode: 'multiply',
    },
  },

  drawing: {
    isDrawing: false,
    activeTool: 'pen',
    currentPoints: [],
    currentStrokeId: undefined,
    startedAt: undefined,
  },

  setDrawingTool: (tool) =>
    set((state) => {
      (state as any).drawing.activeTool = tool;
    }),

  setBrush: (tool, patch) =>
    set((state) => {
      (state as any).brushByTool[tool] = { ...(state as any).brushByTool[tool], ...patch };
    }),

  startDrawing: (start, opts) =>
    set((state) => {
      (state as any).drawing.isDrawing = true;
      (state as any).drawing.currentPoints = [start.x, start.y];
      (state as any).drawing.currentStrokeId = opts?.strokeId;
      (state as any).drawing.startedAt = performance.now();
    }),

  addPoint: (pt) =>
    set((state) => {
      (state as any).drawing.currentPoints.push(pt.x, pt.y);
    }),

  addPoints: (pts) =>
    set((state) => {
      for (const p of pts) {
        (state as any).drawing.currentPoints.push(p.x, p.y);
      }
    }),

  endDrawing: (opts) => {
    const { drawing, brushByTool } = get();
    const tool = drawing.activeTool;
    const points = drawing.currentPoints.slice();
    const commit = opts?.commit ?? true;

    // Reset ephemeral regardless of commit
    set((state) => {
      (state as any).drawing.isDrawing = false;
      (state as any).drawing.currentPoints = [];
      (state as any).drawing.currentStrokeId = undefined;
      (state as any).drawing.startedAt = undefined;
    });

    if (!commit || points.length < 4) return undefined;

    // Materialize stroke as a serializable canvas element
    const id = nanoid() as unknown as ElementId;
    const style = brushByTool[tool];

    const strokeElement: CanvasElement = {
      id,
      type: 'stroke', // must align with union in typeselements
      tool,
      points,
      stroke: style.color,
      strokeWidth: style.width,
      opacity: style.opacity,
      lineCap: style.lineCap,
      lineJoin: style.lineJoin,
      blendMode: style.blendMode ?? 'normal',
      perfectDrawEnabled: false, // perf default; renderer may override
      listening: true,
      // additional stroke props as your union supports (e.g., shadow, dash)
    } as unknown as CanvasElement;

    // Insert via element module if present
    const anyState = get() as any;
    if (anyState.addElement) {
      anyState.addElement(strokeElement, { select: false, pushHistory: true });
    } else if (anyState.element?.addElement) {
      anyState.element.addElement(strokeElement, { select: false, pushHistory: true });
    }

    // Attempt to record history (best-effort across possible APIs)
    const history = (get() as any).history;
    history?.record?.({ op: 'add', elements: [strokeElement] });
    history?.push?.({ type: 'add', elements: [strokeElement] });
    history?.add?.({ type: 'add', payload: { element: strokeElement } });

    return id;
  },

  cancelDrawing: () =>
    set((state) => {
      (state as any).drawing.isDrawing = false;
      (state as any).drawing.currentPoints = [];
      (state as any).drawing.currentStrokeId = undefined;
      (state as any).drawing.startedAt = undefined;
    }),
});

export default createDrawingModule;