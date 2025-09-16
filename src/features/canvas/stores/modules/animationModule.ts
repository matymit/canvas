// features/canvas/stores/modules/animationModule.ts
import type { StoreSlice } from './types';

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
  enabled: boolean;               // master flag for tweens/animations
  preferReducedMotion: boolean;   // mirror user/system preference
  defaults: AnimationDefaults;    // default tween config
  easingPresets: Record<string, string>; // name -> Konva.Easings key

  setEnabled(on: boolean): void;
  setPreferReducedMotion(on: boolean): void;

  setDefaultDuration(ms: number): void;
  setDefaultEasing(name: EasingName): void;

  // Register or override a preset mapping to a Konva.Easings key, e.g., 'EaseInOut' or 'BackEaseOut'
  registerEasing(name: string, konvaEasingKey: string): void;
  unregisterEasing(name: string): void;
}

export const createAnimationModule: StoreSlice<AnimationModuleSlice> = (set, _get) => ({
  enabled: true,
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

  setEnabled: (on) =>
    set((state: any) => {
      const s = state.animation ?? state;
      s.enabled = !!on;
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

export default createAnimationModule;