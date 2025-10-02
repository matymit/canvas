import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Konva from "konva";
import { createRendererLayers } from "../../../features/canvas/renderer/layers";
import { TransformerController } from "../../../features/canvas/renderer/TransformerController";

describe("TransformerController lifecycle", () => {
  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let controller: TransformerController;

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
  });

  afterEach(() => {
    controller?.destroy();
    stage?.destroy();
    container?.remove();
  });

  it("fires transform lifecycle callbacks and redraws overlay", () => {
    const layers = createRendererLayers(stage);

    const startSpy = vi.fn();
    const transformSpy = vi.fn();
    const endSpy = vi.fn();
    const overlayDrawSpy = vi.spyOn(layers.overlay, "batchDraw");

    controller = new TransformerController({
      stage,
      layer: layers.overlay,
      onTransformStart: startSpy,
      onTransform: transformSpy,
      onTransformEnd: endSpy,
    });

    const rect = new Konva.Rect({
      id: "rect-1",
      x: 40,
      y: 40,
      width: 100,
      height: 120,
      fill: "#60A5FA",
    });

    layers.main.add(rect);
    layers.main.draw();

    controller.attach([rect]);
    const transformer = controller.getNode();

    overlayDrawSpy.mockClear();

    transformer.fire("transformstart");
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy.mock.calls[0]?.[0]).toEqual([rect]);

    transformer.fire("transform");
    expect(transformSpy).toHaveBeenCalledTimes(1);
    expect(transformSpy.mock.calls[0]?.[0]).toEqual([rect]);
    expect(overlayDrawSpy).toHaveBeenCalled();

    overlayDrawSpy.mockClear();

    transformer.fire("transformend");
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy.mock.calls[0]?.[0]).toEqual([rect]);
    expect(overlayDrawSpy).toHaveBeenCalled();

    controller.detach();
    expect(transformer.visible()).toBe(false);
    expect(transformer.nodes()).toHaveLength(0);
  });
});
