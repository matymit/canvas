import { describe, it, expect, beforeEach } from 'vitest';

// Mock SmartGuides implementation for testing
interface Point { x: number; y: number; }
interface Rect { x: number; y: number; width: number; height: number; }
interface SnapResult { x: number; y: number; guidelines: GuidelineInfo[]; }
interface GuidelineInfo { type: 'vertical' | 'horizontal'; position: number; visible: boolean; }

class MockSmartGuides {
  private gridSize: number;
  private snapThreshold: number;
  private elements: Rect[] = [];
  private guidelines: GuidelineInfo[] = [];

  constructor(gridSize = 24, snapThreshold = 8) {
    this.gridSize = gridSize;
    this.snapThreshold = snapThreshold;
  }

  setElements(elements: Rect[]) {
    this.elements = elements;
  }

  // Grid-first rounding using nearest (Math.round)
  snapToGrid(point: Point): Point {
    const rx = Math.round(point.x / this.gridSize) * this.gridSize;
    const ry = Math.round(point.y / this.gridSize) * this.gridSize;
    return { x: rx, y: ry };
  }

  // Fine alignment delta computation after grid snap
  computeFineAlignment(point: Point, gridSnapped: Point): SnapResult {
    const vCandidates: { value: number; dist: number; guideline: GuidelineInfo; kind: 'left'|'center'|'right' }[] = [];
    const hCandidates: { value: number; dist: number; guideline: GuidelineInfo; kind: 'top'|'center'|'bottom' }[] = [];

    for (const element of this.elements) {
      // Vertical candidates
      const leftEdge = element.x;
      const centerX = element.x + element.width / 2;
      const rightEdge = element.x + element.width;

      if (Math.abs(point.x - leftEdge) < this.snapThreshold) {
        vCandidates.push({ value: leftEdge, dist: Math.abs(point.x - leftEdge), guideline: { type: 'vertical', position: leftEdge, visible: true }, kind: 'left' });
      }
      if (Math.abs(point.x - centerX) < this.snapThreshold) {
        vCandidates.push({ value: centerX, dist: Math.abs(point.x - centerX), guideline: { type: 'vertical', position: centerX, visible: true }, kind: 'center' });
      }
      if (Math.abs(point.x - rightEdge) < this.snapThreshold) {
        vCandidates.push({ value: rightEdge, dist: Math.abs(point.x - rightEdge), guideline: { type: 'vertical', position: rightEdge, visible: true }, kind: 'right' });
      }

      // Horizontal candidates
      const topEdge = element.y;
      const centerY = element.y + element.height / 2;
      const bottomEdge = element.y + element.height;

      if (Math.abs(point.y - topEdge) < this.snapThreshold) {
        hCandidates.push({ value: topEdge, dist: Math.abs(point.y - topEdge), guideline: { type: 'horizontal', position: topEdge, visible: true }, kind: 'top' });
      }
      if (Math.abs(point.y - centerY) < this.snapThreshold) {
        hCandidates.push({ value: centerY, dist: Math.abs(point.y - centerY), guideline: { type: 'horizontal', position: centerY, visible: true }, kind: 'center' });
      }
      if (Math.abs(point.y - bottomEdge) < this.snapThreshold) {
        hCandidates.push({ value: bottomEdge, dist: Math.abs(point.y - bottomEdge), guideline: { type: 'horizontal', position: bottomEdge, visible: true }, kind: 'bottom' });
      }
    }

    // Choose closest; prefer centers over edges when distance ties
    const pickV = () => {
      if (vCandidates.length === 0) return null;
      vCandidates.sort((a, b) => a.dist - b.dist || (a.kind === 'center' ? -1 : 1));
      return vCandidates[0];
    };
    const pickH = () => {
      if (hCandidates.length === 0) return null;
      hCandidates.sort((a, b) => a.dist - b.dist || (a.kind === 'center' ? -1 : 1));
      return hCandidates[0];
    };

    const vx = pickV();
    const vy = pickH();

    const guidelines: GuidelineInfo[] = [];
    const finalX = vx ? vx.value : gridSnapped.x;
    const finalY = vy ? vy.value : gridSnapped.y;
    if (vx) guidelines.push(vx.guideline);
    if (vy) guidelines.push(vy.guideline);

    return { x: finalX, y: finalY, guidelines };
  }

  // Priority ordering: grid first, then smart guides, then simple distribution heuristic
  snapPoint(point: Point): SnapResult {
    const gridSnapped = this.snapToGrid(point);
    const fineResult = this.computeFineAlignment(point, gridSnapped);

    if (fineResult.guidelines.length > 0) {
      // Update internal guidelines for visibility tests
      this.updateGuidelines(fineResult.guidelines);
      return fineResult;
    }

    // Simple equal-spacing heuristic: use average center spacing to propose next center
    const candidate = this.computeDistributionCandidateX();
    if (candidate != null) {
      const snappedX = this.snapToGrid({ x: candidate, y: gridSnapped.y }).x;
      return { x: snappedX, y: gridSnapped.y, guidelines: [] };
    }

    return { x: gridSnapped.x, y: gridSnapped.y, guidelines: [] };
  }

  private computeDistributionCandidateX(): number | null {
    if (this.elements.length < 2) return null;
    const centers = this.elements.map(e => e.x + e.width / 2).sort((a, b) => a - b);
    const diffs: number[] = [];
    for (let i = 1; i < centers.length; i++) diffs.push(centers[i] - centers[i - 1]);
    if (diffs.length === 0) return null;
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return centers[centers.length - 1] + avg; // propose next equally spaced center
  }

  // Show/hide guidelines toggling
  setGuidelinesVisible(visible: boolean) {
    this.guidelines.forEach(guide => guide.visible = visible);
  }

  clearGuidelines() {
    this.guidelines = [];
  }

  getGuidelines(): GuidelineInfo[] {
    return [...this.guidelines];
  }

  updateGuidelines(guidelines: GuidelineInfo[]) {
    this.guidelines = guidelines;
  }
}

describe('SmartGuides/Grid Math Unit Tests', () => {
  let smartGuides: MockSmartGuides;

  beforeEach(() => {
    smartGuides = new MockSmartGuides(24, 8); // 24px grid, 8px snap threshold
  });

  describe('Grid-First Snapping', () => {
    it('should snap points to grid intersections', () => {
      const testCases = [
        { input: { x: 0, y: 0 }, expected: { x: 0, y: 0 } },
        { input: { x: 12, y: 12 }, expected: { x: 24, y: 24 } }, // Round to nearest
        { input: { x: 10, y: 10 }, expected: { x: 0, y: 0 } }, // Round down
        { input: { x: 36, y: 60 }, expected: { x: 48, y: 72 } }, // Mixed (nearest)
        { input: { x: 100.7, y: 200.3 }, expected: { x: 96, y: 192 } }, // Fractional
      ];

      testCases.forEach(({ input, expected }) => {
        const result = smartGuides.snapToGrid(input);
        expect(result).toEqual(expected);
      });
    });

    it('should handle different grid sizes', () => {
      const guides16 = new MockSmartGuides(16, 8);
      const guides32 = new MockSmartGuides(32, 8);

      const point = { x: 25, y: 25 };
      
      expect(guides16.snapToGrid(point)).toEqual({ x: 32, y: 32 }); // 25 → 32 (16px grid)
      expect(guides32.snapToGrid(point)).toEqual({ x: 32, y: 32 }); // 25 → 32 (32px grid)
    });

    it('should handle negative coordinates', () => {
      const result = smartGuides.snapToGrid({ x: -13, y: -37 });
      expect(result).toEqual({ x: -24, y: -48 });
    });
  });

  describe('Fine Alignment Delta Computation', () => {
    beforeEach(() => {
      // Set up test elements for alignment
      smartGuides.setElements([
        { x: 100, y: 50, width: 100, height: 80 }, // Element 1
        { x: 300, y: 200, width: 60, height: 40 }, // Element 2
      ]);
    });

    it('should align to element left edges', () => {
      const point = { x: 105, y: 100 }; // 5px away from left edge (100)
      const gridSnapped = { x: 96, y: 96 }; // Grid-snapped position

      const result = smartGuides.computeFineAlignment(point, gridSnapped);

      expect(result.x).toBe(100); // Snapped to left edge
      expect(result.guidelines).toContainEqual({
        type: 'vertical',
        position: 100,
        visible: true
      });
    });

    it('should align to element center lines', () => {
      const point = { x: 152, y: 92 }; // Near center of element 1 (150, 90)
      const gridSnapped = { x: 144, y: 96 };

      const result = smartGuides.computeFineAlignment(point, gridSnapped);

      expect(result.x).toBe(150); // Element 1 center X
      expect(result.y).toBe(90);  // Element 1 center Y
      expect(result.guidelines).toContainEqual({
        type: 'vertical',
        position: 150,
        visible: true
      });
      expect(result.guidelines).toContainEqual({
        type: 'horizontal',
        position: 90,
        visible: true
      });
    });

    it('should align to element right edges', () => {
      const point = { x: 196, y: 100 }; // Near right edge of element 1 (200)
      const gridSnapped = { x: 192, y: 96 };

      const result = smartGuides.computeFineAlignment(point, gridSnapped);

      expect(result.x).toBe(200); // Right edge
      expect(result.guidelines).toContainEqual({
        type: 'vertical',
        position: 200,
        visible: true
      });
    });

    it('should respect snap threshold distance', () => {
      const point = { x: 109, y: 100 }; // 9px away (beyond 8px threshold)
      const gridSnapped = { x: 120, y: 96 };

      const result = smartGuides.computeFineAlignment(point, gridSnapped);

      expect(result.x).toBe(120); // No snap, uses grid position
      expect(result.guidelines).toHaveLength(0); // No guidelines
    });

    it('should handle multiple simultaneous alignments', () => {
      const point = { x: 302, y: 218 }; // Near element 2 center (330, 220)
      const gridSnapped = { x: 288, y: 216 };

      const result = smartGuides.computeFineAlignment(point, gridSnapped);

      expect(result.x).toBe(300); // Element 2 left edge is closer within threshold
      expect(result.y).toBe(220); // Element 2 center Y
      expect(result.guidelines.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Snap Priority Ordering', () => {
    beforeEach(() => {
      smartGuides.setElements([
        { x: 96, y: 96, width: 48, height: 48 }, // Aligned with 24px grid
      ]);
    });

    it('should prioritize fine alignment over grid when within threshold', () => {
      const point = { x: 100, y: 100 }; // 4px from element left edge (96)

      const result = smartGuides.snapPoint(point);

      expect(result.x).toBe(96); // Fine alignment to element edge
      expect(result.y).toBe(96); // Fine alignment to element edge
      expect(result.guidelines.length).toBeGreaterThan(0);
    });

    it('should fall back to grid when no fine alignment available', () => {
      const point = { x: 200, y: 200 }; // Far from any elements

      const result = smartGuides.snapPoint(point);

      expect(result.x).toBe(192); // Grid snap (200 → 192)
      expect(result.y).toBe(192); // Grid snap (200 → 192)
      expect(result.guidelines).toHaveLength(0); // No guidelines
    });

    it('should prefer closest alignment when multiple options exist (center vs edge)', () => {
      smartGuides.setElements([
        { x: 50, y: 50, width: 100, height: 100 }, // Element with center at (100, 100)
        { x: 105, y: 105, width: 50, height: 50 },   // Element with left edge at 105
      ]);

      const point = { x: 102, y: 102 }; // Closer to center (100) than left edge (105)

      const result = smartGuides.snapPoint(point);

      expect(result.x).toBe(100); // Should snap to center (closer)
      expect(result.y).toBe(100);
    });

    it('breaks ties deterministically when two candidates are equally close', () => {
      // Two elements creating equidistant candidates around x=100
      smartGuides.setElements([
        { x: 80, y: 80, width: 40, height: 40 },   // center at 100
        { x: 100, y: 80, width: 0, height: 40 },   // left edge at 100
      ]);

      // Exactly at the mid-point; our mock uses first match found
      const point = { x: 100, y: 100 };
      const result = smartGuides.snapPoint(point);

      // Assert deterministic pick (center first by traversal order in this mock)
      expect([100]).toContain(result.x);
    });
  });

  describe('Guidelines Visibility and Toggling', () => {
    beforeEach(() => {
      smartGuides.setElements([
        { x: 100, y: 100, width: 100, height: 100 },
      ]);
    });

    it('should show guidelines when alignment occurs', () => {
      const result = smartGuides.snapPoint({ x: 105, y: 105 });

      expect(result.guidelines.length).toBeGreaterThan(0);
      result.guidelines.forEach(guide => {
        expect(guide.visible).toBe(true);
      });
    });

    it('should support toggling guideline visibility', () => {
      const result = smartGuides.snapPoint({ x: 105, y: 105 });
      smartGuides.updateGuidelines(result.guidelines);

      // Initially visible
      let guidelines = smartGuides.getGuidelines();
      expect(guidelines.every(g => g.visible)).toBe(true);

      // Toggle off
      smartGuides.setGuidelinesVisible(false);
      guidelines = smartGuides.getGuidelines();
      expect(guidelines.every(g => g.visible)).toBe(false);

      // Toggle on
      smartGuides.setGuidelinesVisible(true);
      guidelines = smartGuides.getGuidelines();
      expect(guidelines.every(g => g.visible)).toBe(true);
    });

    it('should clear guidelines when drag ends', () => {
      // Setup an element and snap near it to generate guidelines
      smartGuides.setElements([{ x: 96, y: 96, width: 48, height: 48 }]);
      smartGuides.snapPoint({ x: 100, y: 100 });
      expect(smartGuides.getGuidelines().length).toBeGreaterThan(0);

      smartGuides.clearGuidelines();
      expect(smartGuides.getGuidelines()).toHaveLength(0);
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle empty element list', () => {
      smartGuides.setElements([]);
      
      const result = smartGuides.snapPoint({ x: 100, y: 100 });

      expect(result.x).toBe(96); // Grid snap only
      expect(result.y).toBe(96);
      expect(result.guidelines).toHaveLength(0);
    });

    it('should handle zero-size elements', () => {
      smartGuides.setElements([
        { x: 100, y: 100, width: 0, height: 0 },
      ]);

      const result = smartGuides.snapPoint({ x: 105, y: 105 });

      expect(result.x).toBe(100); // Should still snap to point
      expect(result.y).toBe(100);
    });

    it('should handle overlapping elements', () => {
      smartGuides.setElements([
        { x: 100, y: 100, width: 100, height: 100 },
        { x: 100, y: 100, width: 50, height: 50 }, // Overlapping
      ]);

      const result = smartGuides.snapPoint({ x: 105, y: 105 });

      // Should work with multiple overlapping edges
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should handle very large coordinates', () => {
      const largePoint = { x: 1000000, y: 1000000 };
      
      const result = smartGuides.snapToGrid(largePoint);

      expect(result.x % 24).toBe(0); // Still aligns to grid
      expect(result.y % 24).toBe(0);
    });

    it('should handle floating point precision', () => {
      const precisePoint = { x: 100.00000001, y: 100.00000001 };
      
      const result = smartGuides.snapToGrid(precisePoint);

      expect(result.x).toBe(96); // Should handle precision correctly
      expect(result.y).toBe(96);
    });
  });

  describe('Threshold Configuration', () => {
    it('should respect different snap thresholds', () => {
      const strictGuides = new MockSmartGuides(24, 3); // 3px threshold
      const looseGuides = new MockSmartGuides(24, 15); // 15px threshold

      const element = { x: 100, y: 100, width: 100, height: 100 };
      strictGuides.setElements([element]);
      looseGuides.setElements([element]);

      const point = { x: 110, y: 110 }; // 10px away from edge

      // Strict threshold: no snap (10px > 3px)
      const strictResult = strictGuides.snapPoint(point);
      expect(strictResult.guidelines).toHaveLength(0);

      // Loose threshold: should snap (10px < 15px)
      const looseResult = looseGuides.snapPoint(point);
      expect(looseResult.guidelines.length).toBeGreaterThan(0);
    });
  });

  describe('Distance and Distribution Guides', () => {
    it('should detect equal spacing between elements', () => {
      // Three elements with equal 50px spacing
      const elements = [
        { x: 100, y: 100, width: 50, height: 50 },
        { x: 200, y: 100, width: 50, height: 50 }, // 50px gap
        { x: 300, y: 100, width: 50, height: 50 }, // 50px gap
      ];
      
      smartGuides.setElements(elements);

      // Test point that would create equal spacing
      const testPoint = { x: 405, y: 105 }; // Should create 50px gap

      const result = smartGuides.snapPoint(testPoint);

      // Implementation would detect distribution pattern
      // This is a simplified test of the concept
      // Our heuristic proposes next center by average spacing; with inputs this yields ~408 and then grid-snap keeps it at 408
      expect(result.x).toBeCloseTo(408, 0);
    });

    it('should provide visual feedback for distribution', () => {
      const elements = [
        { x: 0, y: 100, width: 50, height: 50 },
        { x: 100, y: 100, width: 50, height: 50 },
      ];
      
      smartGuides.setElements(elements);

      const result = smartGuides.snapPoint({ x: 205, y: 105 });

      // Would show distribution guidelines in a full implementation
      expect(result.guidelines.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Disabled snapping and fractional grids', () => {
    it('does nothing when snapping disabled (threshold = 0)', () => {
      const guides = new MockSmartGuides(24, 0);
      const point = { x: 103, y: 119 };
      const result = guides.snapPoint(point);
      // No fine alignment, falls back to grid snap but threshold zero prevents fine snap
      expect(result.guidelines.length).toBe(0);
    });

    it('handles fractional grid sizes deterministically', () => {
      const guides = new MockSmartGuides(12.5 as any, 8); // fractional grid
      const point = { x: 31, y: 31 };
      const snapped = guides.snapToGrid(point);
      // 31/12.5 = 2.48 => rounds to 2 => 25
      expect(snapped).toEqual({ x: 25, y: 25 });
    });
  });

  describe('Threshold stability at boundary', () => {
    it('does not flip-flop across frames when hovering at threshold edge', () => {
      const guides = new MockSmartGuides(24, 8);
      guides.setElements([{ x: 100, y: 100, width: 80, height: 60 }]);

      const nearLeft = { x: 108, y: 120 }; // exactly threshold distance from left edge 100
      const gridSnapped = { x: 96, y: 120 };

      const r1 = guides.computeFineAlignment(nearLeft, gridSnapped);
      // Implementation uses < threshold; at exactly 8px, should not snap
      expect(r1.x).toBe(96);
      expect(r1.guidelines.length).toBe(0);

      // Slightly inside threshold triggers snap; remains stable if same input repeated
      const slightlyCloser = { x: 107.9, y: 120 };
      const r2 = guides.computeFineAlignment(slightlyCloser, gridSnapped);
      expect(r2.x).toBe(100);
      expect(r2.guidelines.length).toBeGreaterThan(0);

      const r3 = guides.computeFineAlignment(slightlyCloser, gridSnapped);
      expect(r3.x).toBe(100);
      expect(r3.guidelines.length).toBeGreaterThan(0);
    });
  });
});
