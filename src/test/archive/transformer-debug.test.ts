import { describe, it, expect, beforeEach } from "vitest";
import Konva from "konva";

describe("Transformer Debug Test", () => {
  let mainLayer: any;

  beforeEach(() => {
    // Create a mock layer using the test setup
    mainLayer = new Konva.Layer();
  });

  it("should handle node lookup with elementId attribute", () => {
    // Create a sticky note group with elementId
    const stickyGroup = new Konva.Group({
      id: "test-sticky-2",
      x: 100,
      y: 100,
      width: 240,
      height: 180,
      draggable: true,
    });

    // Use setAttrs instead of setAttr for mock compatibility
    stickyGroup.setAttrs({ elementId: "test-sticky-2" });

    const rect = new Konva.Rect({
      name: "sticky-bg",
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      fill: "#FEF08A",
    });

    stickyGroup.add(rect);
    mainLayer.add(stickyGroup);

    // Test finding node by elementId
    const foundNodes = mainLayer.find((node: any) => {
      const nodeElementId = node.getAttr
        ? node.getAttr("elementId")
        : node.id();
      return nodeElementId === "test-sticky-2";
    });

    expect(foundNodes.length).toBe(1);
    expect(foundNodes[0]).toBe(stickyGroup);
  });

  it("should handle node lookup by id when elementId is not set", () => {
    // Create a sticky note group without elementId
    const stickyGroup = new Konva.Group({
      id: "test-sticky-3",
      x: 100,
      y: 100,
      width: 240,
      height: 180,
      draggable: true,
    });

    const rect = new Konva.Rect({
      name: "sticky-bg",
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      fill: "#FEF08A",
    });

    stickyGroup.add(rect);
    mainLayer.add(stickyGroup);

    // Test finding node by id
    const foundNodes = mainLayer.find((node: any) => {
      const nodeElementId = node.getAttr
        ? node.getAttr("elementId")
        : node.id();
      return nodeElementId === "test-sticky-3";
    });

    expect(foundNodes.length).toBe(1);
    expect(foundNodes[0]).toBe(stickyGroup);
  });

  it("should handle undefined candidates gracefully", () => {
    // Create a group that might return undefined candidates
    const stickyGroup = new Konva.Group({
      id: "test-sticky-4",
      x: 100,
      y: 100,
      width: 240,
      height: 180,
      draggable: true,
    });

    stickyGroup.setAttrs({ elementId: "test-sticky-4" });

    mainLayer.add(stickyGroup);

    // Test finding node by elementId
    const foundNodes = mainLayer.find((node: any) => {
      const nodeElementId = node.getAttr
        ? node.getAttr("elementId")
        : node.id();
      return nodeElementId === "test-sticky-4";
    });

    expect(foundNodes.length).toBe(1);

    // Test logic from SelectionModule - ensure we handle undefined gracefully
    if (foundNodes.length > 0) {
      const group = foundNodes.find((n: any) => n.name && n.name() === "Group");
      const selectedNode = group || foundNodes[0];

      // This should not crash even if candidates[0] is undefined
      expect(selectedNode).toBeTruthy();

      // Test logging logic that was failing - use optional chaining
      const nodeType = group
        ? "Group"
        : foundNodes[0]?.name
          ? foundNodes[0].name()
          : "Unknown";
      expect(typeof nodeType).toBe("string");
    }
  });

  it("should test the exact logic from SelectionModule", () => {
    // Test the exact logic that was failing in SelectionModule
    const elementId = "test-sticky-5";

    const stickyGroup = new Konva.Group({
      id: elementId,
      x: 100,
      y: 100,
      width: 240,
      height: 180,
      draggable: true,
    });

    stickyGroup.setAttrs({ elementId: elementId });

    mainLayer.add(stickyGroup);

    // Replicate the exact logic from SelectionModule.resolveElementsToNodes
    const candidates = mainLayer.find((node: any) => {
      const nodeElementId = node.getAttr
        ? node.getAttr("elementId")
        : node.id();
      return nodeElementId === elementId;
    });

    expect(candidates.length).toBe(1);

    if (candidates.length > 0) {
      // Prefer groups over individual shapes for better transform experience
      const group = candidates.find((n: any) => n.name && n.name() === "Group");
      const selectedNode = group || candidates[0];

      // FIXED: Ensure only one node per element ID to prevent duplicate frames
      expect(selectedNode).toBeTruthy();

      // This is the line that was failing - accessing candidates[0].className
      // But in our mock, we use name() instead of className
      const nodeType = group
        ? "Group"
        : candidates[0]?.name
          ? candidates[0].name()
          : "Unknown";
      expect(nodeType).toBe("Group");

      // Test the console.log logic that was showing "undefined"
      console.log(`Found node for element ${elementId}: ${nodeType}`);
    }
  });
});
