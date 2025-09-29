import type Konva from "konva";
import { describe, expect, it, vi } from "vitest";

import { TransformController } from "../controllers/TransformController";
import type { TransformSnapshot } from "../types";

const createSnapshot = (
  overrides: Partial<TransformSnapshot> = {},
): TransformSnapshot => ({
  basePositions: new Map<string, { x: number; y: number }>(),
  connectors: new Map(),
  mindmapEdges: new Map(),
  movedMindmapNodes: new Set(),
  ...overrides,
});

const createNode = (id: string, x: number, y: number) => {
  const position = { x, y };
  return {
    id: () => id,
    getAttr: (key: string) => (key === "elementId" ? id : undefined),
    position: () => position,
  } as unknown as Konva.Node;
};

const createController = () => {
  let transformer: Konva.Transformer | null = null;

  const deps = {
    getTransformer: () => transformer,
    applyAnchoredOverride: vi.fn(),
    setConnectorRoutingEnabled: vi.fn(),
    setMindmapRoutingEnabled: vi.fn(),
    updateConnectorElement: vi.fn(),
    rerouteAllConnectors: vi.fn(),
    rerouteMindmapNodes: vi.fn(),
    debug: vi.fn(),
  };

  const controller = new TransformController(deps);

  return {
    controller,
    deps,
    setTransformer(value: Konva.Transformer | null) {
      transformer = value;
    },
  };
};

describe("TransformController", () => {
  it("computes delta from baseline positions when available", () => {
    const { controller } = createController();
    const node = createNode("node-1", 25, 40);

    const snapshot = createSnapshot({
      basePositions: new Map([["node-1", { x: 10, y: 12 }]]),
    });

    controller.start(snapshot);

    expect(controller.computeDelta([node])).toEqual({ dx: 15, dy: 28 });
  });

  it("falls back to transformer box when baseline nodes are missing", () => {
    const { controller, setTransformer } = createController();

    const snapshot = createSnapshot({
      transformerBox: { x: 5, y: 8 },
    });

    controller.start(snapshot);

    const mockTransformer = {
      getClientRect: () => ({ x: 15, y: 20 } as Konva.Rect),
    } as unknown as Konva.Transformer;
    setTransformer(mockTransformer);

    expect(controller.computeDelta([])).toEqual({ dx: 10, dy: 12 });
  });

  it("restores anchored connectors and reroutes on release", () => {
    const { controller, deps } = createController();

    const snapshot = createSnapshot({
      connectors: new Map([
        [
          "conn-1",
          {
            originalFrom: { kind: "element", elementId: "from" },
            originalTo: { kind: "element", elementId: "to" },
            startFrom: { kind: "point", x: 0, y: 0 },
            startTo: { kind: "point", x: 10, y: 10 },
            wasAnchored: true,
          },
        ],
      ]),
      movedMindmapNodes: new Set(["node-a"]),
    });

    controller.start(snapshot);

    expect(deps.setConnectorRoutingEnabled).toHaveBeenCalledWith(false);

    controller.release();

    expect(deps.updateConnectorElement).toHaveBeenCalledWith("conn-1", {
      from: { kind: "element", elementId: "from" },
      to: { kind: "element", elementId: "to" },
    });
    expect(deps.setConnectorRoutingEnabled).toHaveBeenLastCalledWith(true);
    expect(deps.setMindmapRoutingEnabled).toHaveBeenLastCalledWith(true);
    expect(deps.rerouteAllConnectors).toHaveBeenCalled();
    expect(deps.rerouteMindmapNodes).toHaveBeenCalledWith(["node-a"]);
  });
});
