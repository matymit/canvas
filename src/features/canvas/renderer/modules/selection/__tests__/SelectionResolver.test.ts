// @vitest-environment jsdom
import "vitest-canvas-mock";
import type Konva from "konva";
import { describe, it, expect } from "vitest";
import {
  categorizeSelection,
  filterTransformableNodes,
  resolveElementsToNodes,
} from "../SelectionResolver";

type NodeAttrs = Record<string, unknown>;

const createNode = (
  id: string,
  attrs: NodeAttrs = {},
  name = "",
  className = "Group",
): Konva.Node => {
  const store = { ...attrs };
  const node = {
    id: () => id,
    name: () => name,
    getAttr: (key: string) => store[key],
    getClassName: () => className,
  } as const;
  return node as unknown as Konva.Node;
};

describe("SelectionResolver", () => {
  describe("categorizeSelection", () => {
    it("groups connector, mindmap, and other element ids", () => {
      const elements = new Map<string, { type?: string }>([
        ["connector-1", { type: "connector" }],
        ["edge-1", { type: "mindmap-edge" }],
        ["sticky-1", { type: "sticky-note" }],
      ]);

      const result = categorizeSelection({
        selectedIds: new Set([
          "connector-1",
          "edge-1",
          "sticky-1",
          "missing",
        ]),
        elements,
      });

      expect(result).toEqual({
        connectorIds: ["connector-1"],
        mindmapEdgeIds: ["edge-1"],
        nonConnectorIds: ["sticky-1", "missing"],
      });
    });
  });

  describe("filterTransformableNodes", () => {
    it("removes connector and mindmap nodes", () => {
      const connector = createNode("connector", { elementType: "connector" }, "connector");
      const mindmapEdge = createNode("mindmap", { nodeType: "mindmap-edge" }, "mindmap-edge");
      const sticky = createNode("sticky", { nodeType: "mindmap-node" }, "mindmap-node");

      const filtered = filterTransformableNodes(
        [connector, mindmapEdge, sticky],
      );
      expect(filtered).toEqual([sticky]);
    });
  });

  describe("resolveElementsToNodes", () => {
    it("finds nodes across stage and layers while excluding connectors", () => {
      const elementNode = createNode(
        "elem-1",
        { elementId: "elem-1", nodeType: "mindmap-node" },
        "mindmap-node",
      );
      const connectorNode = createNode(
        "conn-1",
        { elementId: "conn-1", nodeType: "connector" },
        "connector",
      );

      const stage = {
        findOne: () => null,
      } as unknown as Konva.Stage;

      const layer = {
        find: (predicate: (node: Konva.Node) => boolean) =>
          [elementNode, connectorNode].filter(predicate),
      } as unknown as Konva.Container;

      const nodes = resolveElementsToNodes({
        stage,
        layers: [layer],
        elementIds: new Set(["elem-1", "conn-1"]),
      });

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id()).toBe("elem-1");
    });
  });
});
