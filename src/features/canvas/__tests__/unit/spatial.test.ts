import { describe, it, expect, beforeEach } from "vitest";
import { QuadTree } from "../../utils/performance/QuadTree";
import {
  SimpleEraserIndex,
  StrokeInput,
  Bounds,
} from "../../utils/spatial/simpleEraserIndex";

describe("Spatial Index Queries", () => {
  describe("QuadTree Query Bounds", () => {
    let qt: QuadTree<string>;

    beforeEach(() => {
      qt = new QuadTree<string>({ x: 0, y: 0, width: 100, height: 100 }, 4, 4);
    });

    it("should return correct candidates for intersecting bounds", () => {
      // Insert items with different bounds
      qt.insert("A", { x: 10, y: 10, width: 20, height: 20 });
      qt.insert("B", { x: 50, y: 50, width: 20, height: 20 });
      qt.insert("C", { x: 80, y: 80, width: 20, height: 20 });
      qt.insert("D", { x: 200, y: 200, width: 10, height: 10 }); // Outside bounds

      // Query intersecting A and B
      const results = qt.query({ x: 15, y: 15, width: 40, height: 40 });
      expect(results).toContain("A");
      expect(results).toContain("B");
      expect(results).not.toContain("C");
      expect(results).not.toContain("D");
    });

    it("should handle edge cases with partial overlaps", () => {
      qt.insert("edge", { x: 90, y: 90, width: 20, height: 20 }); // Overlaps boundary

      const results = qt.query({ x: 95, y: 95, width: 10, height: 10 });
      expect(results).toContain("edge");
    });

    it("should return empty for non-intersecting queries", () => {
      qt.insert("item", { x: 10, y: 10, width: 10, height: 10 });

      const results = qt.query({ x: 50, y: 50, width: 10, height: 10 });
      expect(results).toHaveLength(0);
    });

    it("should handle multiple items in same area", () => {
      qt.insert("item1", { x: 10, y: 10, width: 5, height: 5 });
      qt.insert("item2", { x: 12, y: 12, width: 5, height: 5 });

      const results = qt.query({ x: 8, y: 8, width: 15, height: 15 });
      expect(results).toContain("item1");
      expect(results).toContain("item2");
    });

    it("should respect max depth and element limits", () => {
      // Insert many items to trigger subdivision
      for (let i = 0; i < 20; i++) {
        qt.insert(`item${i}`, { x: i * 5, y: i * 5, width: 5, height: 5 });
      }

      const results = qt.query({ x: 0, y: 0, width: 100, height: 100 });
      expect(results.length).toBe(20);
    });
  });

  describe("Eraser Spatial Index Queries", () => {
    let index: SimpleEraserIndex;

    beforeEach(() => {
      index = new SimpleEraserIndex(32); // Smaller cell size for testing
    });

    it("should intersect expected strokes with circle queries", () => {
      // Add a stroke: horizontal line from (10,10) to (50,10)
      const stroke: StrokeInput = {
        strokeId: "stroke1",
        points: [10, 10, 30, 10, 50, 10],
        strokeWidth: 4,
      };
      index.addStroke(stroke);

      // Query circle that intersects the stroke
      const hits = index.queryCircle(30, 10, 5); // Center on stroke, radius 5
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => h.strokeId === "stroke1")).toBe(true);
    });

    it("should avoid misses with circle queries", () => {
      const stroke: StrokeInput = {
        strokeId: "stroke2",
        points: [100, 100, 120, 100],
        strokeWidth: 2,
      };
      index.addStroke(stroke);

      // Query far away
      const hits = index.queryCircle(0, 0, 10);
      expect(hits.length).toBe(0);
    });

    it("should handle rect queries correctly", () => {
      const stroke: StrokeInput = {
        strokeId: "stroke3",
        points: [20, 20, 40, 20, 40, 40],
        strokeWidth: 6,
      };
      index.addStroke(stroke);

      // Query rect that overlaps
      const queryBounds: Bounds = { x: 35, y: 15, width: 10, height: 10 };
      const hits = index.queryRect(queryBounds);
      expect(hits.length).toBeGreaterThan(0);
    });

    it("should return stroke IDs without duplicates", () => {
      const stroke: StrokeInput = {
        strokeId: "stroke4",
        points: [0, 0, 10, 0, 20, 0, 30, 0],
        strokeWidth: 4,
      };
      index.addStroke(stroke);

      // Query multiple segments
      const strokeIds = index.queryCircleStrokeIds(15, 0, 10);
      expect(strokeIds.has("stroke4")).toBe(true);
      expect(strokeIds.size).toBe(1); // No duplicates
    });

    it("should handle stroke width inflation correctly", () => {
      const thinStroke: StrokeInput = {
        strokeId: "thin",
        points: [50, 50, 50, 70],
        strokeWidth: 2,
      };
      const thickStroke: StrokeInput = {
        strokeId: "thick",
        points: [60, 50, 60, 70],
        strokeWidth: 10,
      };
      index.addStroke(thinStroke);
      index.addStroke(thickStroke);

      // Query near thin stroke: with radius 1 and halfWidth 1, edge distance equals threshold -> counts as hit
      const thinHits = index.queryCircle(52, 60, 1);
      expect(thinHits.length).toBeGreaterThan(0);

      // Query near thick stroke (should hit due to width)
      const thickHits = index.queryCircle(62, 60, 3);
      expect(thickHits.length).toBeGreaterThan(0);
    });

    it("should update strokes correctly", () => {
      const original: StrokeInput = {
        strokeId: "update-test",
        points: [0, 0, 10, 10],
        strokeWidth: 2,
      };
      index.addStroke(original);

      // Update with new points
      const updated: StrokeInput = {
        strokeId: "update-test",
        points: [100, 100, 110, 110],
        strokeWidth: 4,
      };
      index.updateStroke(updated);

      // Old location should have no hits
      const oldHits = index.queryCircle(5, 5, 5);
      expect(oldHits.length).toBe(0);

      // New location should have hits
      const newHits = index.queryCircle(105, 105, 5);
      expect(newHits.length).toBeGreaterThan(0);
    });

    it("should remove strokes completely", () => {
      const stroke: StrokeInput = {
        strokeId: "remove-test",
        points: [70, 70, 80, 80],
        strokeWidth: 2,
      };
      index.addStroke(stroke);

      // Verify added
      const before = index.queryCircle(75, 75, 5);
      expect(before.length).toBeGreaterThan(0);

      // Remove
      index.removeStroke("remove-test");

      // Verify removed
      const after = index.queryCircle(75, 75, 5);
      expect(after.length).toBe(0);
    });

    it("should handle complex multi-segment strokes", () => {
      const complexStroke: StrokeInput = {
        strokeId: "complex",
        points: [0, 0, 10, 0, 10, 10, 0, 10, 0, 0], // Square
        strokeWidth: 4,
      };
      index.addStroke(complexStroke);

      // Query near an edge of the square so the eraser circle intersects a segment
      const insideHits = index.queryCircle(5, 5, 3);
      expect(insideHits.length).toBeGreaterThan(0);

      // Query outside
      const outsideHits = index.queryCircle(20, 20, 1);
      expect(outsideHits.length).toBe(0);
    });
  });
});
