import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  commitTransformForNode,
  beginTransformBatch,
  endTransformBatch,
} from "../../managers/interaction/TransformCommit";

// Mock Konva node for testing
class MockKonvaNode {
  private _x = 0;
  private _y = 0;
  private _scaleX = 1;
  private _scaleY = 1;
  private _rotation = 0;
  private _id = "";

  constructor(attrs: Record<string, unknown> = {}) {
    this._x = attrs.x || 0;
    this._y = attrs.y || 0;
    this._scaleX = attrs.scaleX || 1;
    this._scaleY = attrs.scaleY || 1;
    this._rotation = attrs.rotation || 0;
    this._id = attrs.id || "";
  }

  x(val?: number) {
    if (val !== undefined) this._x = val;
    return this._x;
  }
  y(val?: number) {
    if (val !== undefined) this._y = val;
    return this._y;
  }
  scaleX(val?: number) {
    if (val !== undefined) this._scaleX = val;
    return this._scaleX;
  }
  scaleY(val?: number) {
    if (val !== undefined) this._scaleY = val;
    return this._scaleY;
  }
  rotation(val?: number) {
    if (val !== undefined) this._rotation = val;
    return this._rotation;
  }
  id() {
    return this._id;
  }
}

describe("Geometry Helpers Unit Tests", () => {
  let mockStore: {
    getElement: ReturnType<typeof vi.fn>;
    updateElement: ReturnType<typeof vi.fn>;
    history: {
      beginBatch: ReturnType<typeof vi.fn>;
      endBatch: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockStore = {
      getElement: vi.fn(),
      updateElement: vi.fn(),
      history: {
        beginBatch: vi.fn(),
        endBatch: vi.fn(),
      },
    };
  });

  describe("Transform Normalization", () => {
    it("should convert node scale to width/height for rectangles", () => {
      const element = {
        id: "rect-1",
        type: "rectangle",
        x: 100,
        y: 200,
        width: 150,
        height: 100,
        rotation: 0,
      };

      mockStore.getElement.mockReturnValue(element);

      // Create node with scale transformation
      const node = new MockKonvaNode({
        id: "rect-1",
        x: 150, // moved
        y: 250, // moved
        scaleX: 1.5, // scaled 1.5x
        scaleY: 2.0, // scaled 2x
        rotation: Math.PI / 4, // 45 degrees
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      // Verify scale was normalized to width/height
      expect(node.scaleX()).toBe(1);
      expect(node.scaleY()).toBe(1);

      // Verify store update with absolute dimensions
      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "rect-1",
        {
          x: 150,
          y: 250,
          width: Math.round(150 * 1.5), // 225
          height: Math.round(100 * 2.0), // 200
          rotation: Math.PI / 4,
        },
        { pushHistory: true },
      );
    });

    it("should handle image resize normalization", () => {
      const element = {
        id: "img-1",
        type: "image",
        x: 50,
        y: 75,
        width: 200,
        height: 150,
      };

      mockStore.getElement.mockReturnValue(element);

      const node = new MockKonvaNode({
        id: "img-1",
        x: 50,
        y: 75,
        scaleX: 0.8,
        scaleY: 0.8, // uniform scaling to maintain aspect
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "img-1",
        {
          x: 50,
          y: 75,
          width: Math.round(200 * 0.8), // 160
          height: Math.round(150 * 0.8), // 120
          rotation: 0,
        },
        { pushHistory: true },
      );
    });

    it("should handle table proportional scaling of colWidths/rowHeights", () => {
      const element = {
        id: "table-1",
        type: "table",
        x: 100,
        y: 200,
        width: 300,
        height: 200,
        colWidths: [100, 100, 100],
        rowHeights: [50, 50, 50, 50],
      };

      mockStore.getElement.mockReturnValue(element);

      const node = new MockKonvaNode({
        id: "table-1",
        x: 120,
        y: 220,
        scaleX: 1.2,
        scaleY: 0.8,
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      const expectedColWidths = [120, 120, 120]; // 100 * 1.2 each
      const expectedRowHeights = [40, 40, 40, 40]; // 50 * 0.8 each
      const expectedTotalWidth = expectedColWidths.reduce((a, b) => a + b, 0);
      const expectedTotalHeight = expectedRowHeights.reduce((a, b) => a + b, 0);

      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "table-1",
        {
          x: 120,
          y: 220,
          width: expectedTotalWidth,
          height: expectedTotalHeight,
          rotation: 0,
          colWidths: expectedColWidths,
          rowHeights: expectedRowHeights,
        },
        { pushHistory: true },
      );
    });

    it("should enforce minimum dimensions and clamps", () => {
      const element = {
        id: "small-rect",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      };

      mockStore.getElement.mockReturnValue(element);

      const node = new MockKonvaNode({
        id: "small-rect",
        scaleX: 0.05, // Would result in 0.5px width
        scaleY: 0.05,
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      // Should enforce minimum 1px dimensions
      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "small-rect",
        expect.objectContaining({
          width: 1, // Math.max(1, round(10 * 0.05))
          height: 1,
        }),
        { pushHistory: true },
      );
    });

    it("should handle table minimum cell sizes", () => {
      const element = {
        id: "tiny-table",
        type: "table",
        x: 0,
        y: 0,
        width: 20,
        height: 16,
        colWidths: [10, 10],
        rowHeights: [8, 8],
      };

      mockStore.getElement.mockReturnValue(element);

      const node = new MockKonvaNode({
        id: "tiny-table",
        scaleX: 0.5,
        scaleY: 0.5,
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      // Should enforce minimum 8px cell dimensions
      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "tiny-table",
        expect.objectContaining({
          colWidths: [8, 8], // Math.max(8, round(10 * 0.5))
          rowHeights: [8, 8], // Math.max(8, round(8 * 0.5))
        }),
        { pushHistory: true },
      );
    });

    it("should handle connector position/rotation only (no resize)", () => {
      const element = {
        id: "connector-1",
        type: "connector",
        x: 100,
        y: 100,
        rotation: 0,
      };

      mockStore.getElement.mockReturnValue(element);

      const node = new MockKonvaNode({
        id: "connector-1",
        x: 150,
        y: 175,
        scaleX: 2.0, // Scale should be ignored for connectors
        scaleY: 1.5,
        rotation: Math.PI / 6, // 30 degrees
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      // Should only update position and rotation, ignore scaling
      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "connector-1",
        {
          x: 150,
          y: 175,
          rotation: Math.PI / 6,
        },
        { pushHistory: true },
      );

      // Scales should not be reset for connectors since they don't resize
      expect(node.scaleX()).toBe(2.0);
      expect(node.scaleY()).toBe(1.5);
    });

    it("should handle missing element gracefully", () => {
      mockStore.getElement.mockReturnValue(undefined);

      const node = new MockKonvaNode({ id: "missing-element" });

      // Should not throw or call updateElement
      expect(() => {
        commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });
      }).not.toThrow();

      expect(mockStore.updateElement).not.toHaveBeenCalled();
    });

    it("should handle nodes without ID gracefully", () => {
      const node = new MockKonvaNode({ id: "" });

      expect(() => {
        commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });
      }).not.toThrow();

      expect(mockStore.getElement).not.toHaveBeenCalled();
      expect(mockStore.updateElement).not.toHaveBeenCalled();
    });
  });

  describe("History Batching Integration", () => {
    it("should begin batch with correct label", () => {
      const deps = { getStore: () => mockStore };

      beginTransformBatch(deps, "Custom transform");

      expect(mockStore.history.beginBatch).toHaveBeenCalledWith(
        "Custom transform",
      );
    });

    it("should use default label when none provided", () => {
      const deps = { getStore: () => mockStore };

      beginTransformBatch(deps);

      expect(mockStore.history.beginBatch).toHaveBeenCalledWith("transform");
    });

    it("should end batch with commit=true", () => {
      const deps = { getStore: () => mockStore };

      endTransformBatch(deps);

      expect(mockStore.history.endBatch).toHaveBeenCalledWith(true);
    });

    it("should handle missing history gracefully", () => {
      const storeWithoutHistory = {
        getElement: vi.fn(),
        updateElement: vi.fn(),
      };
      const deps = { getStore: () => storeWithoutHistory };

      expect(() => {
        beginTransformBatch(deps);
        endTransformBatch(deps);
      }).not.toThrow();
    });
  });

  describe("Rounding and Precision", () => {
    it("should round fractional pixels to integers", () => {
      const element = {
        id: "precise-rect",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      };

      mockStore.getElement.mockReturnValue(element);

      const node = new MockKonvaNode({
        id: "precise-rect",
        x: 123.456,
        y: 789.123,
        scaleX: 1.2345,
        scaleY: 0.6789,
      });

      commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

      expect(mockStore.updateElement).toHaveBeenCalledWith(
        "precise-rect",
        {
          x: 123.456, // Position not rounded (sub-pixel positioning allowed)
          y: 789.123,
          width: Math.round(100 * 1.2345), // 123
          height: Math.round(100 * 0.6789), // 68
          rotation: 0,
        },
        { pushHistory: true },
      );
    });
  });

  describe("Element Type Coverage", () => {
    const testCases = [
      { type: "rectangle", expectedCommit: "rectLike" },
      { type: "circle", expectedCommit: "rectLike" },
      { type: "triangle", expectedCommit: "rectLike" },
      { type: "shape", expectedCommit: "rectLike" },
      { type: "image", expectedCommit: "image" },
      { type: "table", expectedCommit: "table" },
      { type: "text", expectedCommit: "text" },
      { type: "sticky-note", expectedCommit: "sticky" },
      { type: "mindmap-node", expectedCommit: "mindmapNode" },
      { type: "connector", expectedCommit: "connector" },
      { type: "line", expectedCommit: "connector" },
      { type: "arrow", expectedCommit: "connector" },
      { type: "unknown-type", expectedCommit: "default" },
    ];

    testCases.forEach(({ type, expectedCommit }) => {
      it(`should handle ${type} elements correctly`, () => {
        const element = {
          id: `${type}-1`,
          type,
          x: 100,
          y: 100,
          width: 100,
          height: 100,
        };

        mockStore.getElement.mockReturnValue(element);

        const node = new MockKonvaNode({
          id: `${type}-1`,
          scaleX: 1.1,
          scaleY: 1.1,
        });

        commitTransformForNode(node as MockKonvaNode, { getStore: () => mockStore });

        expect(mockStore.updateElement).toHaveBeenCalled();

        if (expectedCommit === "connector") {
          // Connectors should not have width/height in update
          expect(mockStore.updateElement).toHaveBeenCalledWith(
            `${type}-1`,
            expect.not.objectContaining({
              width: expect.anything(),
              height: expect.anything(),
            }),
            { pushHistory: true },
          );
        } else {
          // All other types should have normalized dimensions
          expect(mockStore.updateElement).toHaveBeenCalledWith(
            `${type}-1`,
            expect.objectContaining({
              x: expect.any(Number),
              y: expect.any(Number),
            }),
            { pushHistory: true },
          );
        }
      });
    });
  });
  it("normalizes image resize with keepAspectRatio using natural aspect", () => {
    const element = {
      id: "img-2",
      type: "image",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      keepAspectRatio: true,
      naturalWidth: 400,
      naturalHeight: 200,
    };

    mockStore.getElement.mockReturnValue(element);

    const node = new MockKonvaNode({ id: "img-2", scaleX: 1.5, scaleY: 0.5 });

    commitTransformForNode(node as any, { getStore: () => mockStore });

    // Expect width/height materialized respecting 2:1 aspect
    expect(mockStore.updateElement).toHaveBeenCalledWith(
      "img-2",
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      }),
      { pushHistory: true },
    );
  });
});
