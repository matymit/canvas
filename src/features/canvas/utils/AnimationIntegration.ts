// features/canvas/utils/AnimationIntegration.ts
import Konva from 'konva';
import type { InteractionModuleSlice, EasingName } from '../stores/modules/interactionModule';
import { animateAppear, animateTransform, animatePulse } from '../managers/animation/ElementAnimations';

/**
 * Utility to integrate the animation module with existing ElementAnimations
 */
export class AnimationIntegration {
  constructor(private readonly getAnimationState: () => InteractionModuleSlice) {}

  /**
   * Get the appropriate easing function from Konva.Easings based on store preset
   */
  private getEasing(easingName: EasingName): (t: number) => number {
    const state = this.getAnimationState();
    const konvaEasingKey = state.easingPresets[easingName];
    
    if (konvaEasingKey && Konva.Easings && (Konva.Easings as Record<string, unknown>)[konvaEasingKey]) {
      const easingFn = (Konva.Easings as Record<string, unknown>)[konvaEasingKey];
      // Konva easing functions have signature (t, b, c, d) but we need (t) => number
      return (t: number) => (easingFn as (t: number, b: number, c: number, d: number) => number)(t, 0, 1, 1);
    }
    
    // Fallback to linear if not found
    return (t: number) => t;
  }

  /**
   * Animate element appearance using store defaults
   */
  animateAppear(node: Konva.Node, options?: { layer?: Konva.Layer | null }) {
    const state = this.getAnimationState();
    
    if (!state.animationEnabled || state.preferReducedMotion) {
      return null;
    }

    return animateAppear(node, {
      duration: state.defaults.durationMs / 1000, // Convert ms to seconds
      easing: this.getEasing(state.defaults.easing),
      layer: options?.layer,
    });
  }

  /**
   * Animate element transformation using store defaults
   */
  animateTransform(
    node: Konva.Node, 
    to: Parameters<typeof animateTransform>[1]['to'],
    options?: { layer?: Konva.Layer | null; duration?: number; easing?: EasingName }
  ) {
    const state = this.getAnimationState();
    
    if (!state.animationEnabled || state.preferReducedMotion) {
      return null;
    }

    return animateTransform(node, {
      to,
      duration: (options?.duration ?? state.defaults.durationMs) / 1000,
      easing: this.getEasing(options?.easing ?? state.defaults.easing),
      layer: options?.layer,
    });
  }

  /**
   * Animate element pulse using store defaults
   */
  animatePulse(node: Konva.Node, options?: { layer?: Konva.Layer | null; scale?: number }) {
    const state = this.getAnimationState();
    
    if (!state.animationEnabled || state.preferReducedMotion) {
      return Promise.resolve();
    }

    return animatePulse(node, {
      duration: state.defaults.durationMs / 1000,
      easing: this.getEasing(state.defaults.easing),
      layer: options?.layer,
      scale: options?.scale,
    });
  }

  /**
   * Check if animations are enabled
   */
  isEnabled(): boolean {
    const state = this.getAnimationState();
    return state.animationEnabled && !state.preferReducedMotion;
  }

  /**
   * Get default animation duration in seconds
   */
  getDefaultDuration(): number {
    const state = this.getAnimationState();
    return state.defaults.durationMs / 1000;
  }
}

/**
 * Create an animation integration instance bound to the unified store
 */
export function createAnimationIntegration(getAnimationState: () => InteractionModuleSlice): AnimationIntegration {
  return new AnimationIntegration(getAnimationState);
}

export default AnimationIntegration;