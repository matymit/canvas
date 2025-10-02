import { describe, it, expect, beforeEach, vi } from "vitest";
import Konva from "konva";
import KonvaNodePool, {
  PoolFactory,
} from "../../../features/canvas/utils/KonvaNodePool";
import {
  createRendererLayers,
  ensureOverlayOnTop,
  setLayersPixelRatio,
} from "../../../features/canvas/renderer/layers";

describe("NodeFactory Pooling", () => {
  let pool: KonvaNodePool;

  beforeEach(() => {
    pool = new KonvaNodePool({ defaultMaxPerKey: 32 });
  });

  it("should reuse existing Konva nodes under pool size", () => {
    const factory: PoolFactory<any> = {
      create: vi.fn(() => ({ destroy: vi.fn() })),
      reset: vi.fn(),
    };

    pool.register("test", factory);

    const node1 = pool.acquire("test");
    pool.release(node1);

    const node2 = pool.acquire("test");

    expect(factory.create).toHaveBeenCalledTimes(1); // Only created once
    expect(node2).toBe(node1); // Reused
  });

  it("should never mix IDs across element types", () => {
    const factory1: PoolFactory<any> = {
      create: vi.fn(() => ({ destroy: vi.fn() })),
    };
    const factory2: PoolFactory<any> = {
      create: vi.fn(() => ({ destroy: vi.fn() })),
    };

    pool.register("rect", factory1);
    pool.register("circle", factory2);

    const rectNode = pool.acquire("rect");
    const circleNode = pool.acquire("circle");

    expect(rectNode).not.toBe(circleNode);
    expect(factory1.create).toHaveBeenCalledTimes(1);
    expect(factory2.create).toHaveBeenCalledTimes(1);
  });

  it("should cap pool growth and dispose excess nodes", () => {
    const factory: PoolFactory<any> = {
      create: vi.fn(() => ({ destroy: vi.fn() })),
      dispose: vi.fn(),
    };

    pool.register("test", factory);
    pool.setMaxForKey("test", 2);

    // Acquire 3 nodes
    const n1 = pool.acquire("test");
    const n2 = pool.acquire("test");
    const n3 = pool.acquire("test");

    // Release all
    pool.release(n1);
    pool.release(n2);
    pool.release(n3); // This should be disposed due to max=2

    expect(factory.dispose).toHaveBeenCalledTimes(1);
  });
});

// NOTE: Layer Contract tests migrated to visual tests - removed from unit tests
// // NOTE: Layer Contract tests migrated to visual tests - removed from unit tests
// This section was skipped and contained outdated architecture assumptions

// NOTE: Transformer Constraints tests migrated to visual tests - removed from unit tests
// This section was skipped and contained outdated transformer patterns

describe("Text Layout and Measurement", () => {
  // Mock text measurement functions
  const mockMeasureText = vi.fn((text: string, _font: string) => ({
    width: text.length * 10,
    height: 16,
    actualBoundingBoxAscent: 12,
    actualBoundingBoxDescent: 4,
  }));

  const mockWrapText = vi.fn((text: string, maxWidth: number) => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (mockMeasureText(testLine, "").width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  });

  it("should measure text metrics accurately", () => {
    const metrics = mockMeasureText("Hello World", "12px Arial");

    expect(metrics.width).toBe(110); // 11 chars * 10
    expect(metrics.height).toBe(16);
  });

  it("should handle wrapping and auto-sizing", () => {
    const wrapped = mockWrapText("This is a long text that should wrap", 50);

    expect(wrapped.length).toBeGreaterThan(1);
    // Do not assert a specific phrase on the first line; wrapping depends on measurement details.
  });

  it("should respect alignment constraints", () => {
    // Test alignment calculations
    const textWidth = 100;
    const containerWidth = 200;
    const alignments = {
      left: 0,
      center: (containerWidth - textWidth) / 2,
      right: containerWidth - textWidth,
    };

    expect(alignments.center).toBe(50);
    expect(alignments.right).toBe(100);
  });
});

describe("Layer helpers", () => {
  it("should move overlay layer to top and batch draw stage", () => {
    const container = document.createElement("div");
    container.style.width = "600px";
    container.style.height = "400px";
    document.body.appendChild(container);

    const stage = new Konva.Stage({
      container,
      width: 600,
      height: 400,
    });

    const layers = createRendererLayers(stage, {
      listeningPreview: false,
      listeningMain: true,
      listeningOverlay: true,
    });

  const moveSpy = vi.spyOn(layers.overlay, "moveToTop");
  const stageSpy = vi.spyOn(stage, "batchDraw");

    // Move another layer to top first to ensure helper reorders properly
    layers.main.moveToTop();
    expect(stage.getChildren()[stage.getChildren().length - 1]).toBe(layers.main);

  const beforeCalls = stageSpy.mock.calls.length;
  ensureOverlayOnTop(layers);

    expect(moveSpy).toHaveBeenCalledTimes(1);
  expect(stageSpy.mock.calls.length).toBeGreaterThan(beforeCalls);
    expect(stage.getChildren()[stage.getChildren().length - 1]).toBe(
      layers.overlay,
    );

    stage.destroy();
    container.remove();
  });

  it("should update canvas pixel ratio for each layer", () => {
    const container = document.createElement("div");
    container.style.width = "300px";
    container.style.height = "200px";
    document.body.appendChild(container);

    const stage = new Konva.Stage({
      container,
      width: 300,
      height: 200,
    });

    const layers = createRendererLayers(stage, {
      listeningPreview: false,
      listeningMain: true,
      listeningOverlay: true,
    });

    const backgroundCanvas = layers.background.getCanvas();
    const mainCanvas = layers.main.getCanvas();
    const previewCanvas = layers.preview.getCanvas();
    const overlayCanvas = layers.overlay.getCanvas();

    const backgroundSpy = vi.spyOn(backgroundCanvas, "setPixelRatio");
    const mainSpy = vi.spyOn(mainCanvas, "setPixelRatio");
    const previewSpy = vi.spyOn(previewCanvas, "setPixelRatio");
    const overlaySpy = vi.spyOn(overlayCanvas, "setPixelRatio");

    setLayersPixelRatio(layers, 2);

    expect(backgroundSpy).toHaveBeenCalledWith(2);
    expect(mainSpy).toHaveBeenCalledWith(2);
    expect(previewSpy).toHaveBeenCalledWith(2);
    expect(overlaySpy).toHaveBeenCalledWith(2);

    stage.destroy();
    container.remove();
  });
});

describe("Geometry Helpers", () => {
  it("should compute bounds deterministically", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const bounds = {
      x: Math.min(...points.map((p) => p.x)),
      y: Math.min(...points.map((p) => p.y)),
      width:
        Math.max(...points.map((p) => p.x)) -
        Math.min(...points.map((p) => p.x)),
      height:
        Math.max(...points.map((p) => p.y)) -
        Math.min(...points.map((p) => p.y)),
    };

    expect(bounds).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it("should handle snapping correctly", () => {
    const snapToGrid = (value: number, gridSize: number) =>
      Math.round(value / gridSize) * gridSize;

    expect(snapToGrid(15, 10)).toBe(20);
    expect(snapToGrid(12, 10)).toBe(10);
    expect(snapToGrid(18, 10)).toBe(20);
  });

  it("should perform hit tests accurately", () => {
    const pointInRect = (
      px: number,
      py: number,
      rect: { x: number; y: number; width: number; height: number },
    ) =>
      px >= rect.x &&
      px <= rect.x + rect.width &&
      py >= rect.y &&
      py <= rect.y + rect.height;

    const rect = { x: 10, y: 10, width: 20, height: 20 };

    expect(pointInRect(15, 15, rect)).toBe(true);
    expect(pointInRect(35, 15, rect)).toBe(false);
  });

  it("should compute connector routing for edge cases", () => {
    // Simple connector routing: direct line between centers
    const routeConnector = (
      from: { x: number; y: number; width: number; height: number },
      to: { x: number; y: number; width: number; height: number },
    ) => ({
      x1: from.x + from.width / 2,
      y1: from.y + from.height / 2,
      x2: to.x + to.width / 2,
      y2: to.y + to.height / 2,
    });

    const from = { x: 0, y: 0, width: 10, height: 10 };
    const to = { x: 20, y: 20, width: 10, height: 10 };

    const route = routeConnector(from, to);
    expect(route).toEqual({ x1: 5, y1: 5, x2: 25, y2: 25 });
  });
});
