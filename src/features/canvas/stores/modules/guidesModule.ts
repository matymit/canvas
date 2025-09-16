// features/canvas/stores/modules/guidesModule.ts
import type { StoreSlice } from './types';

export type GuideSource = 'grid' | 'object' | 'edge' | 'user';
export interface GuideLine {
  axis: 'x' | 'y';
  value: number;          // position in stage/world coords
  source?: GuideSource;   // provenance helps with styling
  strength?: number;      // 0..1, optional visual weight
}

export interface GuidesModuleSlice {
  enabled: boolean;         // master on/off for guides rendering
  snappingEnabled: boolean; // snapping behavior on/off
  snapThreshold: number;    // px
  activeGuides: GuideLine[]; // ephemeral, recalculated on interactions

  setEnabled(on: boolean): void;
  setSnappingEnabled(on: boolean): void;
  setSnapThreshold(px: number): void;

  setActiveGuides(guides: GuideLine[]): void;
  addActiveGuide(guide: GuideLine): void;
  clearActiveGuides(): void;
}

export const createGuidesModule: StoreSlice<GuidesModuleSlice> = (set, _get) => ({
  enabled: true,
  snappingEnabled: true,
  snapThreshold: 8,
  activeGuides: [],

  setEnabled: (on) =>
    set((state: any) => {
      const s = state.guides ?? state;
      s.enabled = !!on;
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
});

export default createGuidesModule;