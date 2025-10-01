// useMarqueeSelection.ts
// Marquee selection rectangle and element intersection logic

import type React from "react";
import Konva from "konva";
import type { MarqueeState } from "./useMarqueeState";
import type { CanvasElement } from "../../../../../../../types";
import type { ConnectorElement } from "../../../../types/connector";

export interface MarqueeSelectionOptions {
  marqueeRef: React.MutableRefObject<MarqueeState>;
  stageRef: React.RefObject<Konva.Stage | null>;
  elements: Map<string, CanvasElement>;
  setSelection: (ids: string[]) => void;
  getWorldPointerPosition: () => { x: number; y: number } | null;
  getOverlayLayer: () => Konva.Layer;
}

/**
 * Hook for marquee selection functionality
 * Handles stage clicks, marquee rectangle creation, and element intersection
 */
export const useMarqueeSelection = (options: MarqueeSelectionOptions) => {
  const {
    marqueeRef,
    stageRef,
    elements,
    setSelection,
    getWorldPointerPosition,
    getOverlayLayer,
  } = options;

  /**
   * Handle stage click to start marquee selection
   * Called from onPointerDown when clicking empty canvas
   */
  const handleStageClick = (
    _stage: Konva.Stage,
    pos: { x: number; y: number },
  ) => {
    console.log("[MarqueeSelection] starting marquee selection");

    // Clear any persistent selection from previous operations
    const hadSelection = marqueeRef.current.persistentSelection.length > 0;
    marqueeRef.current.persistentSelection = [];

    // Notify SelectionModule to clear visual feedback
    if (hadSelection) {
      const selectionModule =
        typeof window !== "undefined"
          ? (window as any).selectionModule
          : undefined;
      if (selectionModule?.clearSelection) {
        console.log(
          "[MarqueeSelection] Clearing selection via SelectionModule",
        );
        selectionModule.clearSelection();
      }
    }

    marqueeRef.current.isSelecting = true;
    marqueeRef.current.startPoint = { x: pos.x, y: pos.y };
    marqueeRef.current.connectorBaselines.clear();

    // Create selection rectangle
  const overlayLayer = getOverlayLayer();
  const selectionRect = new Konva.Rect({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      fill: "rgba(79, 70, 229, 0.1)", // Light blue fill
      stroke: "#4F46E5", // Blue border
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      name: "marquee-selection",
    });

    marqueeRef.current.selectionRect = selectionRect;
    overlayLayer.add(selectionRect);
    overlayLayer.batchDraw();
  };

  /**
   * Update marquee rectangle during pointer move
   * Called from onPointerMove when isSelecting is true
   */
  const handleSelectionMove = () => {
    if (
      !marqueeRef.current.isSelecting ||
      !marqueeRef.current.startPoint ||
      !marqueeRef.current.selectionRect
    ) {
      return;
    }

    const pos = getWorldPointerPosition();
    if (!pos) return;

    const startPoint = marqueeRef.current.startPoint;
    const rect = marqueeRef.current.selectionRect;

    // Calculate rectangle bounds
    const x1 = Math.min(startPoint.x, pos.x);
    const y1 = Math.min(startPoint.y, pos.y);
    const x2 = Math.max(startPoint.x, pos.x);
    const y2 = Math.max(startPoint.y, pos.y);

    rect.x(x1);
    rect.y(y1);
    rect.width(x2 - x1);
    rect.height(y2 - y1);

    const overlayLayer = getOverlayLayer();
    overlayLayer.batchDraw();
  };

  /**
   * Complete marquee selection on pointer up
   * Returns selected element IDs or null if selection was too small
   */
  const handleSelectionComplete = (pos: {
    x: number;
    y: number;
  }): string[] | null => {
    if (
      !marqueeRef.current.isSelecting ||
      !marqueeRef.current.startPoint ||
      !marqueeRef.current.selectionRect
    ) {
      return null;
    }

    const startPoint = marqueeRef.current.startPoint;

    // Calculate selection rectangle bounds
    const x1 = Math.min(startPoint.x, pos.x);
    const y1 = Math.min(startPoint.y, pos.y);
    const x2 = Math.max(startPoint.x, pos.x);
    const y2 = Math.max(startPoint.y, pos.y);

    const selectionBounds = {
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
    };

    // Only perform selection if the marquee has meaningful size
    if (selectionBounds.width > 5 && selectionBounds.height > 5) {
      console.log("[MarqueeSelection] performing selection in bounds", {
        bounds: selectionBounds,
        area: selectionBounds.width * selectionBounds.height,
      });

      const selectedIds = selectElementsInBounds(selectionBounds);

      // Clean up selection rectangle
      const overlayLayer = getOverlayLayer();
      if (marqueeRef.current.selectionRect) {
        marqueeRef.current.selectionRect.destroy();
        overlayLayer.batchDraw();
        marqueeRef.current.selectionRect = null;
      }
      marqueeRef.current.isSelecting = false;
      marqueeRef.current.startPoint = null;

      return selectedIds;
    } else {
      console.log("[MarqueeSelection] marquee too small, not selecting");
      return null;
    }
  };

  /**
   * Select elements within bounds using SelectionModule or fallback
   */
  const selectElementsInBounds = (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): string[] => {
    const stage = stageRef.current;
    if (!stage) return [];

    console.log("[MarqueeSelection] selectElementsInBounds", bounds);

    // Use the modular SelectionModule approach
    const selectionModule =
      typeof window !== "undefined"
        ? (window as any).selectionModule
        : undefined;
    if (selectionModule?.selectElementsInBounds) {
      console.log(
        "[MarqueeSelection] using SelectionModule for marquee selection",
      );
      const selectedIds = selectionModule.selectElementsInBounds(stage, bounds);
      console.log("[MarqueeSelection] SelectionModule returned", {
        selectedIds,
        length: selectedIds.length,
        elementIds: selectedIds.slice(0, 5),
      });

      if (selectedIds.length > 0) {
        marqueeRef.current.persistentSelection = selectedIds;

        // Prepare nodes for potential dragging
        const { nodes, basePositions } =
          selectionModule.marqueeSelectionController?.prepareNodesForDrag?.(
            stage,
            selectedIds,
          ) || { nodes: [], basePositions: new Map() };
        marqueeRef.current.selectedNodes = nodes;
        marqueeRef.current.basePositions = basePositions;

        console.log("[MarqueeSelection] prepared for drag", {
          totalSelected: selectedIds.length,
          nodeCount: nodes.length,
          basePositions: Array.from(basePositions.entries()),
        });

        return selectedIds;
      }
      return [];
    }

    // Fallback to direct implementation
    console.log("[MarqueeSelection] using fallback implementation");
    return fallbackSelectElementsInBounds(stage, bounds);
  };

  /**
   * Fallback implementation when SelectionModule is not available
   */
  const fallbackSelectElementsInBounds = (
    stage: Konva.Stage,
    bounds: { x: number; y: number; width: number; height: number },
  ): string[] => {
    const selectedIdSet = new Set<string>();
    const selectedNodes: Konva.Node[] = [];

    const candidateNodes = stage.find<Konva.Node>((node: Konva.Node) => {
      if (typeof node.getAttr !== "function") return false;
      const elementId = node.getAttr("elementId") || node.id();
      return Boolean(elementId) && elements.has(elementId);
    });

    console.log(
      "[MarqueeSelection] candidateNodes found:",
      candidateNodes.length,
    );

    for (const node of candidateNodes) {
      const elementId = node.getAttr("elementId") || node.id();
      if (!elementId || !elements.has(elementId)) continue;

      const nodeRect = node.getClientRect({
        skipStroke: false,
        skipShadow: true,
      });

      const intersects = !(
        nodeRect.x > bounds.x + bounds.width ||
        nodeRect.x + nodeRect.width < bounds.x ||
        nodeRect.y > bounds.y + bounds.height ||
        nodeRect.y + nodeRect.height < bounds.y
      );

      if (intersects) {
        selectedIdSet.add(elementId);
        selectedNodes.push(node);
      }
    }

    const selectedIds = Array.from(selectedIdSet);
    console.log("[MarqueeSelection] selected elements:", selectedIds);

    if (selectedIds.length > 0 && setSelection) {
      setTimeout(() => {
        setSelection(selectedIds);
      }, 10);

      // Store nodes and base positions for potential dragging
      marqueeRef.current.selectedNodes = selectedNodes;
      marqueeRef.current.persistentSelection = selectedIds;
      marqueeRef.current.basePositions.clear();

      selectedNodes.forEach((node) => {
        const elementId = node.getAttr("elementId") || node.id();
        const element = elements.get(elementId);

        // Skip connectors from position-based dragging
        if (element?.type === "connector") {
          return;
        }

        let nodePos = node.position();

        // If position is (0,0), get from store
        if (nodePos.x === 0 && nodePos.y === 0 && element) {
          if ((element as any).type === "connector") {
            const connectorElement = element as unknown as ConnectorElement;
            if (connectorElement.from && connectorElement.to) {
              let fromX = 0,
                fromY = 0,
                toX = 0,
                toY = 0;

              if (connectorElement.from.kind === "point") {
                fromX = connectorElement.from.x;
                fromY = connectorElement.from.y;
              }
              if (connectorElement.to.kind === "point") {
                toX = connectorElement.to.x;
                toY = connectorElement.to.y;
              }

              nodePos = {
                x: (fromX + toX) / 2,
                y: (fromY + toY) / 2,
              };
            }
          } else if (
            typeof element.x === "number" &&
            typeof element.y === "number"
          ) {
            nodePos = { x: element.x, y: element.y };
          }
        }

        marqueeRef.current.basePositions.set(elementId, {
          x: nodePos.x,
          y: nodePos.y,
        });
      });
    }

    return selectedIds;
  };

  return {
    handleStageClick,
    handleSelectionMove,
    handleSelectionComplete,
  };
};
