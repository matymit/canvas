import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Konva from "konva";
import { CanvasRenderer } from "../../../features/canvas/renderer";

describe("CanvasRenderer selection lifecycle", () => {
  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let renderer: CanvasRenderer;
  let rect: Konva.Rect;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "400px";
    container.style.height = "300px";
    document.body.appendChild(container);

    stage = new Konva.Stage({
      container,
      width: 400,
      height: 300,
    });

    const rectId = "rect-1";
    rect = new Konva.Rect({
      id: rectId,
      x: 50,
      y: 60,
      width: 120,
      height: 80,
      fill: "#F87171",
      listening: true,
    });

    renderer = new CanvasRenderer(stage, {
      resolveSelectionNodes: (ids) => (ids.includes(rectId) ? [rect] : []),
    });

    const layers = renderer.getLayers();
    layers.main.add(rect);
    layers.main.draw();
  });

  afterEach(() => {
    renderer?.destroy({ destroyInjectedLayers: true });
    stage?.destroy();
    container?.remove();
  });

  it("attaches transformer to resolved nodes and detaches on clear", () => {
    const transformer = renderer.getTransformer();

    expect(transformer.visible()).toBe(false);
    expect(transformer.nodes()).toHaveLength(0);

    renderer.setSelection(["rect-1"]);

    expect(transformer.visible()).toBe(true);
    expect(transformer.nodes()).toHaveLength(1);
    expect(transformer.nodes()[0]).toBe(rect);

    renderer.setSelection([]);

    expect(transformer.visible()).toBe(false);
    expect(transformer.nodes()).toHaveLength(0);

    renderer.setSelection(["unknown"]);

    expect(transformer.visible()).toBe(false);
    expect(transformer.nodes()).toHaveLength(0);
  });
});
