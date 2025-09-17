// features/canvas/stores/modules/interactionModule.ts
import type { StoreSlice } from './types';

// ============================================================================
// UI MODULE TYPES AND IMPLEMENTATION
// ============================================================================

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

// ============================================================================
// GUIDES MODULE TYPES AND IMPLEMENTATION
// ============================================================================

export type GuideSource = 'grid' | 'object' | 'edge' | 'user';
export interface GuideLine {
  axis: 'x' | 'y';
  value: number;          // position in stage/world coords
  source?: GuideSource;   // provenance helps with styling
  strength?: number;      // 0..1, optional visual weight
}

export interface GuidesModuleSlice {
  guidesEnabled: boolean;         // master on/off for guides rendering
  snappingEnabled: boolean; // snapping behavior on/off
  snapThreshold: number;    // px
  activeGuides: GuideLine[]; // ephemeral, recalculated on interactions

  setGuidesEnabled(on: boolean): void;
  setSnappingEnabled(on: boolean): void;
  setSnapThreshold(px: number): void;

  setActiveGuides(guides: GuideLine[]): void;
  addActiveGuide(guide: GuideLine): void;
  clearActiveGuides(): void;
}

// ============================================================================
// ANIMATION MODULE TYPES AND IMPLEMENTATION
// ============================================================================

export type EasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'backOut'
  | 'elasticOut'
  | 'bounceOut';

export interface AnimationDefaults {
  durationMs: number;
  easing: EasingName;
}

export interface AnimationModuleSlice {
  animationEnabled: boolean;               // master flag for tweens/animations
  preferReducedMotion: boolean;   // mirror user/system preference
  defaults: AnimationDefaults;    // default tween config
  easingPresets: Record<string, string>; // name -> Konva.Easings key

  setAnimationEnabled(on: boolean): void;
  setPreferReducedMotion(on: boolean): void;

  setDefaultDuration(ms: number): void;
  setDefaultEasing(name: EasingName): void;

  // Register or override a preset mapping to a Konva.Easings key, e.g., 'EaseInOut' or 'BackEaseOut'
  registerEasing(name: string, konvaEasingKey: string): void;
  unregisterEasing(name: string): void;
}

// ============================================================================
// COMBINED INTERACTION MODULE SLICE
// ============================================================================

export interface InteractionModuleSlice extends UIModuleSlice, GuidesModuleSlice, AnimationModuleSlice {}

// ============================================================================
// INTERACTION MODULE CREATOR
// ============================================================================

export const createInteractionModule: StoreSlice<InteractionModuleSlice> = (set, _get) => ({
  // ========================================================================
  // UI MODULE IMPLEMENTATION
  // ========================================================================
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

  // ========================================================================
  // GUIDES MODULE IMPLEMENTATION
  // ========================================================================
  guidesEnabled: true,
  snappingEnabled: true,
  snapThreshold: 8,
  activeGuides: [],

  setGuidesEnabled: (on) =>
    set((state: any) => {
      const s = state.guides ?? state;
      s.guidesEnabled = !!on;
    }),

  setSnappingEnabled: (on) =>
    set((state: any) => {
      const s = state.guides ?? state;
      s.snappingEnabled = !!on;
    }),

  setSnapThreshold: (px) =>
    set((state: any) => {
      const s = state.guides ?? state;
      const v = Math.max(0, Math.round(px || 0));
      s.snapThreshold = v;
    }),

  setActiveGuides: (guides) =>
    set((state: any) => {
      const s = state.guides ?? state;
      s.activeGuides = Array.isArray(guides) ? guides.slice() : [];
    }),

  addActiveGuide: (guide) =>
    set((state: any) => {
      const s = state.guides ?? state;
      s.activeGuides.push(guide);
    }),

  clearActiveGuides: () =>
    set((state: any) => {
      const s = state.guides ?? state;
      s.activeGuides = [];
    }),

  // ========================================================================
  // ANIMATION MODULE IMPLEMENTATION
  // ========================================================================
  animationEnabled: true,
  preferReducedMotion: false,

  defaults: {
    durationMs: 180,
    easing: 'easeInOut',
  },

  // sensible presets mapped to Konva.Easings names
  easingPresets: {
    linear: 'Linear',
    easeIn: 'EaseIn',
    easeOut: 'EaseOut',
    easeInOut: 'EaseInOut',
    backOut: 'BackEaseOut',
    elasticOut: 'ElasticEaseOut',
    bounceOut: 'BounceEaseOut',
  },

  setAnimationEnabled: (on) =>
    set((state: any) => {
      const s = state.animation ?? state;
      s.animationEnabled = !!on;
    }),

  setPreferReducedMotion: (on) =>
    set((state: any) => {
      const s = state.animation ?? state;
      s.preferReducedMotion = !!on;
    }),

  setDefaultDuration: (ms) =>
    set((state: any) => {
      const s = state.animation ?? state;
      const v = Math.max(0, Math.round(ms || 0));
      s.defaults.durationMs = v;
    }),

  setDefaultEasing: (name) =>
    set((state: any) => {
      const s = state.animation ?? state;
      s.defaults.easing = name;
    }),

  registerEasing: (name, konvaEasingKey) =>
    set((state: any) => {
      const s = state.animation ?? state;
      s.easingPresets[name] = konvaEasingKey;
    }),

  unregisterEasing: (name) =>
    set((state: any) => {
      const s = state.animation ?? state;
      delete s.easingPresets[name];
    }),
});

export default createInteractionModule;