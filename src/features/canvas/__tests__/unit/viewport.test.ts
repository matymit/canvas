import { describe, it, expect, beforeEach } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

const state = () => useUnifiedCanvasStore.getState();

describe('Viewport Transforms', () => {
  beforeEach(() => {
    state().viewport.reset();
  });

  describe('World ↔ Screen Coordinate Mapping', () => {
    it('should correctly map world to screen coordinates', () => {
      const store = useUnifiedCanvasStore.getState();

      // At default viewport (0,0, scale=1), world and screen should be identical
      expect(store.viewport.worldToStage(10, 20)).toEqual({ x: 10, y: 20 });
      expect(store.viewport.stageToWorld(10, 20)).toEqual({ x: 10, y: 20 });
    });

    it('should handle pan offset correctly', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(100, 50);

      // With pan (100,50), screen coords are offset
      expect(store.viewport.worldToStage(10, 20)).toEqual({ x: 110, y: 70 });
      expect(store.viewport.stageToWorld(110, 70)).toEqual({ x: 10, y: 20 });
    });

    it('should handle zoom scaling correctly', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setScale(2);

      // With scale=2, world coords are scaled
      expect(store.viewport.worldToStage(10, 20)).toEqual({ x: 20, y: 40 });
      expect(store.viewport.stageToWorld(20, 40)).toEqual({ x: 10, y: 20 });
    });

    it('should combine pan and zoom correctly', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(100, 50);
      store.viewport.setScale(2);

      // Combined: scale then pan
      expect(store.viewport.worldToStage(10, 20)).toEqual({ x: 120, y: 90 });
      expect(store.viewport.stageToWorld(120, 90)).toEqual({ x: 10, y: 20 });
    });

    it('should handle negative coordinates', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(-50, -25);
      store.viewport.setScale(0.5);

      expect(store.viewport.worldToStage(-10, -20)).toEqual({ x: -55, y: -35 });
      expect(store.viewport.stageToWorld(-55, -35)).toEqual({ x: -10, y: -20 });
    });
  });

  describe('Zoom Scaling', () => {
    it('should clamp scale within min/max bounds', () => {
      const store = useUnifiedCanvasStore.getState();

      store.viewport.setScale(10); // Above max
      // Default maxScale is 4 in the current implementation
      expect(state().viewport.scale).toBe(4);

      store.viewport.setScale(0.01); // Below min
      expect(state().viewport.scale).toBe(0.1);
    });

    it('should zoom at point correctly', () => {
      const store = useUnifiedCanvasStore.getState();

      // Invariant: point under (100,100) stays at (100,100)
      const client = { x: 100, y: 100 };
      const worldBefore = store.viewport.stageToWorld(client.x, client.y);

      // Zoom in at (100, 100) with factor 2
      store.viewport.zoomAt(client.x, client.y, 2);

      expect(state().viewport.scale).toBe(2);
      const back = store.viewport.worldToStage(worldBefore.x, worldBefore.y);
      expect(back).toEqual(client);
    });

    it('should zoom out correctly', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setScale(4);

      const client = { x: 200, y: 200 };
      const worldBefore = store.viewport.stageToWorld(client.x, client.y);

      store.viewport.zoomAt(client.x, client.y, 0.5);

      expect(state().viewport.scale).toBe(2);
      const back = store.viewport.worldToStage(worldBefore.x, worldBefore.y);
      expect(back).toEqual(client);
    });

    it('should handle zoomIn/zoomOut helpers', () => {
      const store = useUnifiedCanvasStore.getState();

      store.viewport.zoomIn(0, 0);
      expect(state().viewport.scale).toBeCloseTo(1.2, 5);

      store.viewport.zoomOut(0, 0);
      expect(state().viewport.scale).toBeCloseTo(1, 5);
    });
  });

  describe('Pan Offset', () => {
    it('should set pan correctly', () => {
      const store = useUnifiedCanvasStore.getState();

      store.viewport.setPan(150, -75);

      expect(state().viewport.x).toBe(150);
      expect(state().viewport.y).toBe(-75);
    });

    it('should maintain pan during zoom operations', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(50, 25);

      store.viewport.zoomAt(100, 100, 1.5);

      // Pan should be adjusted to keep zoom point stable
      expect(store.viewport.x).not.toBe(50);
      expect(store.viewport.y).not.toBe(25);
    });
  });

  describe('Pointer-to-Content Correctness at Various DPR', () => {
    // DPR affects coordinate scaling, simulate by adjusting input coords
    it('should handle DPR=1 (standard)', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setScale(2);

      // Pointer at screen (200, 150)
      const world = store.viewport.stageToWorld(200, 150);
      expect(world).toEqual({ x: 100, y: 75 });

      const back = store.viewport.worldToStage(world.x, world.y);
      expect(back).toEqual({ x: 200, y: 150 });
    });

    it('should handle DPR=2 (high DPI)', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setScale(2);

      // Simulate DPR=2 by doubling coordinates
      const screenX = 400; // 200 * 2
      const screenY = 300; // 150 * 2

      // Convert to world (divide by DPR first, then transform)
      const dprAdjustedX = screenX / 2;
      const dprAdjustedY = screenY / 2;

      const world = store.viewport.stageToWorld(dprAdjustedX, dprAdjustedY);
      expect(world).toEqual({ x: 100, y: 75 });
    });

    it('should handle DPR=0.5 (low DPI)', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setScale(0.5);

      // Simulate DPR=0.5
      const screenX = 50; // 100 * 0.5
      const screenY = 37.5; // 75 * 0.5

      const dprAdjustedX = screenX / 0.5;
      const dprAdjustedY = screenY / 0.5;

      const world = store.viewport.stageToWorld(dprAdjustedX, dprAdjustedY);
      const back = store.viewport.worldToStage(world.x, world.y);
      expect(back).toEqual({ x: dprAdjustedX, y: dprAdjustedY });
    });

    it('should maintain accuracy with complex transforms and DPR', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(25, -10);
      store.viewport.setScale(1.5);

      // DPR=1.5 simulation
      const dpr = 1.5;
      const screenX = 300 / dpr; // Adjust for DPR
      const screenY = 225 / dpr;

      const world = store.viewport.stageToWorld(screenX, screenY);
      const back = store.viewport.worldToStage(world.x, world.y);

      expect(back.x).toBeCloseTo(screenX, 5);
      expect(back.y).toBeCloseTo(screenY, 5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero scale gracefully', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setScale(0.1); // Min scale

      expect(state().viewport.scale).toBe(0.1);
      expect(store.viewport.worldToStage(10, 10)).toEqual({ x: 1, y: 1 });
    });

    it('should handle large coordinate values', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(10000, -5000);
      store.viewport.setScale(0.01);

      const result = store.viewport.worldToStage(100000, -200000);
      expect(Number.isFinite(result.x)).toBe(true);
      expect(Number.isFinite(result.y)).toBe(true);
    });

    it('should reset viewport correctly', () => {
      const store = useUnifiedCanvasStore.getState();
      store.viewport.setPan(123, 456);
      store.viewport.setScale(3.14);

      store.viewport.reset();

      expect(store.viewport.x).toBe(0);
      expect(store.viewport.y).toBe(0);
      expect(store.viewport.scale).toBe(1);
    });
  });
});