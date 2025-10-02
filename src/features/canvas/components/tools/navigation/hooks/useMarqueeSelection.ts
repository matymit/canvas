// useMarqueeSelection.ts
// Marquee selection rectangle and element intersection logic

import type React from "react";
import Konva from "konva";
import { debug } from "../../../../../../utils/debug";
import type { MarqueeState } from "./useMarqueeState";
import type { CanvasElement } from "../../../../../../../types";

export interface MarqueeSelectionOptions {
  marqueeRef: React.MutableRefObject<MarqueeState>;
  stageRef: React.RefObject<Konva.Stage | null>;
  elements: Map<string, CanvasElement>;
  setSelection: (ids: string[]) => void;
  getWorldPointerPosition: () => { x: number; y: number } | null;
  getOverlayLayer: () => Konva.Layer;
}

type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
    debug("MarqueeSelection: starting marquee selection", {
      category: "marquee/selection",
    });

    // Clear any persistent selection from previous operations
    const hadSelection = marqueeRef.current.persistentSelection.length > 0;
    marqueeRef.current.persistentSelection = [];

    // Notify SelectionModule to clear visual feedback
    if (hadSelection) {
      const selectionModule =
        typeof window !== "undefined" ? window.selectionModule : undefined;
      if (selectionModule?.clearSelection) {
        debug("MarqueeSelection: clearing selection via SelectionModule", {
          category: "marquee/selection",
        });
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
      debug("MarqueeSelection: performing selection in bounds", {
        category: "marquee/selection",
        data: {
          bounds: selectionBounds,
          area: selectionBounds.width * selectionBounds.height,
        },
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
      debug("MarqueeSelection: marquee too small, not selecting", {
        category: "marquee/selection",
      });
      return null;
    }
  };

  /**
   * Select elements within bounds using SelectionModule or fallback
   */
  const selectElementsInBounds = (bounds: SelectionBounds): string[] => {
    const stage = stageRef.current;
    if (!stage) return [];

    debug("MarqueeSelection: selectElementsInBounds", {
      category: "marquee/selection",
      data: bounds,
    });

    // Use the modular SelectionModule approach
    const selectionModule =
      typeof window !== "undefined" ? window.selectionModule : undefined;
    if (selectionModule?.selectElementsInBounds) {
      debug("MarqueeSelection: using SelectionModule for marquee selection", {
        category: "marquee/selection",
      });
      const selectedIds = selectionModule.selectElementsInBounds(stage, bounds);
      debug("MarqueeSelection: SelectionModule returned", {
        category: "marquee/selection",
        data: {
          selectedIds,
          length: selectedIds.length,
          elementIds: selectedIds.slice(0, 5),
        },
      });

      if (selectedIds.length > 0) {
        marqueeRef.current.persistentSelection = selectedIds;

        // Prepare nodes for potential dragging
        const preparation =
          selectionModule.marqueeSelectionController?.prepareNodesForDrag?.(
            stage,
            selectedIds,
          ) ?? {
            nodes: [] as Konva.Node[],
            basePositions: new Map<string, { x: number; y: number }>(),
          };
        const { nodes, basePositions } = preparation;
        marqueeRef.current.selectedNodes = nodes;
        marqueeRef.current.basePositions = basePositions;

        debug("MarqueeSelection: prepared for drag", {
          category: "marquee/selection",
          data: {
            totalSelected: selectedIds.length,
            nodeCount: nodes.length,
            basePositions: Array.from(basePositions.entries()),
          },
        });

        return selectedIds;
      }
      return [];
    }

    // Fallback to direct implementation
    debug("MarqueeSelection: using fallback implementation", {
      category: "marquee/selection",
    });
    return fallbackSelectElementsInBounds(stage, bounds);
  };

  /**
   * Fallback implementation when SelectionModule is not available
   */
  const fallbackSelectElementsInBounds = (
    stage: Konva.Stage,
    bounds: SelectionBounds,
  ): string[] => {
    const selectedIdSet = new Set<string>();
    const selectedNodes: Konva.Node[] = [];

    const candidateNodes = stage.find<Konva.Node>((node: Konva.Node) => {
      if (typeof node.getAttr !== "function") return false;
      const elementId = node.getAttr("elementId") || node.id();
      return Boolean(elementId) && elements.has(elementId);
    });

    debug("MarqueeSelection: candidate nodes found", {
      category: "marquee/selection",
      data: { count: candidateNodes.length },
    });

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
    debug("MarqueeSelection: selected elements", {
      category: "marquee/selection",
      data: selectedIds,
    });

    if (selectedIds.length > 0) {
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
        let nodePos = node.position();

        if (element?.type === "connector") {
          return;
        }

        if (
          nodePos.x === 0 &&
          nodePos.y === 0 &&
          element &&
          typeof element.x === "number" &&
          typeof element.y === "number"
        ) {
          nodePos = { x: element.x, y: element.y };
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
