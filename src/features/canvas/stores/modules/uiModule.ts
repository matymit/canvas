// features/canvas/stores/modules/uiModule.ts
import type { StoreSlice } from './types';

export type RectLike = { x: number; y: number; width: number; height: number };

export interface GridState {
  visible: boolean;      // show/hide grid
  density: number;       // grid spacing in px
  color: string;         // CSS color for grid lines
}

export type ContextToolbarMode =
  | 'none'
  | 'selection'
  | 'shape'
  | 'text'
  | 'image'
  | 'connector';

export interface ContextualToolbarState {
  visible: boolean;
  mode: ContextToolbarMode;
  anchor: RectLike | null; // stage/world rect of the anchor
}

export type ColorPickerTarget = 'stroke' | 'fill' | 'grid';
export interface ColorPickerState {
  open: boolean;
  target: ColorPickerTarget | null;
  anchor: RectLike | null; // DOM/world rect handed in by UI code
}

export interface UIModuleSlice {
  grid: GridState;
  contextualToolbar: ContextualToolbarState;
  colors: { stroke: string; fill: string; stickyNote: string };
  colorPicker: ColorPickerState;

  // Grid controls
  setGridVisible(visible: boolean): void;
  toggleGrid(): void;
  setGridDensity(density: number): void; // clamped >= 2
  setGridColor(color: string): void;

  // Colors
  setStrokeColor(color: string): void;
  setFillColor(color: string): void;
  setStickyNoteColor(color: string): void;

  // Color picker
  openColorPicker(target: ColorPickerTarget, anchor?: RectLike | null): void;
  closeColorPicker(): void;

  // Contextual toolbar
  setContextToolbarVisible(visible: boolean): void;
  setContextToolbarMode(mode: ContextToolbarMode): void;
  setContextToolbarAnchor(anchor: RectLike | null): void;
  patchContextToolbar(patch: Partial<ContextualToolbarState>): void;
}

export const createUIModule: StoreSlice<UIModuleSlice> = (set, _get) => ({
  grid: {
    visible: true,
    density: 20,
    color: '#E5E5E5',
  },

  contextualToolbar: {
    visible: false,
    mode: 'none',
    anchor: null,
  },

  colors: {
    stroke: '#1F2937', // slate-800
    fill: '#3B82F6',   // blue-500
    stickyNote: '#FFF59D', // light yellow (default sticky note color)
  },

  colorPicker: {
    open: false,
    target: null,
    anchor: null,
  },

  // Grid
  setGridVisible: (visible) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.grid.visible = !!visible;
    }),

  toggleGrid: () =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.grid.visible = !ui.grid.visible;
    }),

  setGridDensity: (density) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      const d = Math.max(2, Math.round(density || 0));
      ui.grid.density = d;
    }),

  setGridColor: (color) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.grid.color = color;
    }),

  // Colors
  setStrokeColor: (color) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.colors.stroke = color;
    }),

  setFillColor: (color) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.colors.fill = color;
    }),

  setStickyNoteColor: (color) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.colors.stickyNote = color;
    }),

  // Color picker
  openColorPicker: (target, anchor = null) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.colorPicker.open = true;
      ui.colorPicker.target = target;
      ui.colorPicker.anchor = anchor ?? null;
    }),

  closeColorPicker: () =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.colorPicker.open = false;
      ui.colorPicker.target = null;
      ui.colorPicker.anchor = null;
    }),

  // Context toolbar
  setContextToolbarVisible: (visible) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.contextualToolbar.visible = !!visible;
    }),

  setContextToolbarMode: (mode) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.contextualToolbar.mode = mode;
    }),

  setContextToolbarAnchor: (anchor) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.contextualToolbar.anchor = anchor ?? null;
    }),

  patchContextToolbar: (patch) =>
    set((state: any) => {
      const ui = state.ui ?? state;
      ui.contextualToolbar = { ...ui.contextualToolbar, ...patch };
    }),
});

export default createUIModule;