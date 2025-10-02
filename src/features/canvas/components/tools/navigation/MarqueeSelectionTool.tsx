// MarqueeSelectionTool.tsx
// Marquee selection for drag-to-select multiple elements
// Refactored to use custom hooks for selection and drag logic

import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { debug } from "../../../../../utils/debug";
const LOG_CATEGORY = "marquee/tool";
import { useMarqueeState } from "./hooks/useMarqueeState";
import { useMarqueeSelection } from "./hooks/useMarqueeSelection";
import { useMarqueeDrag } from "./hooks/useMarqueeDrag";

const OVERLAY_INTERACTIVE_NAMES = new Set([
  "selection-transformer",
  "connector-endpoints",
  "connector-hit-line",
  "from-endpoint",
  "to-endpoint",
  "port-hover-group",
  "rotater",
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const OVERLAY_INTERACTIVE_NAME_PREFIXES = ["port-hit-", "transformer-anchor"] as const;

const overlayNameMatches = (name?: string | null) => {
  if (!name) return false;
  if (OVERLAY_INTERACTIVE_NAMES.has(name)) {
    return true;
  }
  return OVERLAY_INTERACTIVE_NAME_PREFIXES.some((prefix) =>
    name.startsWith(prefix),
  );
};

export interface MarqueeSelectionToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

export const MarqueeSelectionTool: React.FC<MarqueeSelectionToolProps> = ({
  stageRef,
  isActive,
}) => {
  // Store hooks
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const selectedElementIds = useUnifiedCanvasStore(
    (state) => state.selectedElementIds,
  );
  const beginTransform = useUnifiedCanvasStore(
    (state) => state.selection?.beginTransform,
  );
  const endTransform = useUnifiedCanvasStore(
    (state) => state.selection?.endTransform,
  );
  const selectedTool = useUnifiedCanvasStore((state) => state.ui?.selectedTool);

  // Local ref to track selection changes
  const selectionRef = useRef<string[]>([]);

  // Keep selectionRef in sync with actual selection state
  useEffect(() => {
    const currentSelected = Array.isArray(selectedElementIds)
      ? selectedElementIds
      : [];
    selectionRef.current = currentSelected;
    debug("[MarqueeSelectionTool] Selection updated", {
      category: "marquee-selection",
      data: {
        newSelection: currentSelected,
        length: currentSelected.length,
        elementIds: currentSelected.slice(0, 5),
      },
    });
  }, [selectedElementIds]);

  // Initialize marquee state management
  const { marqueeRef } = useMarqueeState();

  // Helper functions for hooks
  const getWorldPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  }, [stageRef]);

  const getOverlayLayer = useCallback((): Konva.Layer => {
    const stage = stageRef.current;
    if (!stage) throw new Error("Stage not available");
    const layers = stage.getLayers();
    return layers[layers.length - 1] as Konva.Layer;
  }, [stageRef]);

  const resolveElementTarget = useCallback(
    (
    stage: Konva.Stage,
    target: Konva.Node,
  ): {
    elementId: string | null;
    resolvedNode: Konva.Node | null;
    traversal: Array<{ nodeName: string; elementId?: string; id?: string }>;
    } => {
    if (!stage) {
      return { elementId: null, resolvedNode: null, traversal: [] };
    }

    let currentNode: Konva.Node | null = target;
    const initialAttr = target.getAttr?.("elementId");
    let elementId: string | null =
      initialAttr && elements.has(initialAttr) ? initialAttr : null;
    let resolvedNode: Konva.Node | null = elementId ? target : null;

    const traversal: Array<{
      nodeName: string;
      elementId?: string;
      id?: string;
    }> = [];

    while (currentNode && currentNode !== stage) {
      traversal.push({
        nodeName: currentNode.constructor.name,
        elementId: currentNode.getAttr?.("elementId"),
        id: currentNode.id?.(),
      });

      if (!elementId) {
        const attrId = currentNode.getAttr?.("elementId");
        if (attrId && elements.has(attrId)) {
          elementId = attrId;
          resolvedNode = currentNode;
          break;
        }

        const nodeId = currentNode.id?.();
        if (nodeId && elements.has(nodeId)) {
          elementId = nodeId;
          resolvedNode = currentNode;
        }
      }

      const parent = currentNode.getParent?.();
      if (!parent) break;
      currentNode = parent as Konva.Node;
    }

    return { elementId, resolvedNode, traversal };
  }, [elements]);

  // Initialize selection hook
  const { handleStageClick, handleSelectionMove, handleSelectionComplete } =
    useMarqueeSelection({
      marqueeRef,
      stageRef,
      elements,
      setSelection,
      getWorldPointerPosition,
      getOverlayLayer,
    });

  // Initialize drag hook
  const { handleElementClick, handleDragMove, handleDragComplete } =
    useMarqueeDrag({
      marqueeRef,
      stageRef,
      elements,
      setSelection,
      beginTransform,
      endTransform,
      getWorldPointerPosition,
      useUnifiedCanvasStore,
    });

  // Setup event handlers
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive || selectedTool !== "select") return;

    /**
     * Handle pointer down event
     * Routes to selection or drag logic based on target
     */
    const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = getWorldPointerPosition();
      if (!pos) return;

      const stageTarget = stageRef.current;
      if (!stageTarget) return;

      let overlayLayer: Konva.Layer | null = null;
      try {
        overlayLayer = getOverlayLayer();
      } catch (error) {
        overlayLayer = null;
      }

      const targetLayer = e.target.getLayer?.() ?? null;
      const targetName = e.target.name?.() ?? null;
      const parentName = e.target.getParent?.()?.name?.() ?? null;

      const overlayBehavior: "default" | "allow" | "block" = (() => {
        if (!overlayLayer || targetLayer !== overlayLayer) {
          return "default";
        }

        if (overlayNameMatches(targetName) || overlayNameMatches(parentName)) {
          return "block";
        }

        return "allow";
      })();

      if (overlayBehavior === "block") {
        debug("MarqueeSelectionTool: overlay target is interactive - deferring", {
          category: LOG_CATEGORY,
          data: {
            targetName,
            parentName,
          },
        });
        return;
      }

      const resolved = resolveElementTarget(stageTarget, e.target);

      debug("MarqueeSelectionTool: pointer down", {
        category: LOG_CATEGORY,
        data: {
          target: e.target.constructor.name,
          targetId: e.target.id(),
          selectionCount: selectionRef.current.length,
          pos,
          resolvedElementId: resolved.elementId,
        },
      });

      const isStageClick =
        overlayBehavior === "allow" ||
        e.target === stageTarget ||
        resolved.elementId === null;

      // Stage click or element-less target - start marquee selection
      if (isStageClick) {
        // If there's a current selection, clear it on first click
        if (selectionRef.current.length > 0) {
          debug("MarqueeSelectionTool: clearing selection on stage click", {
            category: LOG_CATEGORY,
            data: {
              previousSelectionCount: selectionRef.current.length,
            },
          });
          setSelection([]);
          marqueeRef.current.persistentSelection = [];
          selectionRef.current = [];
        }

        // Start marquee selection
        handleStageClick(stageTarget, pos);
        return;
      }

      // Element click - handle selection or drag
      handleElementClick(e.target, stageTarget, pos);
    };

    /**
     * Handle pointer move event
     * Updates selection rectangle or drags elements
     */
    const onPointerMove = (_e: Konva.KonvaEventObject<PointerEvent>) => {
      // Handle marquee selection rectangle update
      handleSelectionMove();

      // Handle element dragging
      if (marqueeRef.current.isDragging) {
        debug("MarqueeSelectionTool: pointer move delegating to handleDragMove", {
          category: LOG_CATEGORY,
        });
        handleDragMove(stage);
      }
    };

    /**
     * Handle pointer up event
     * Completes selection or drag operation
     */
    const onPointerUp = () => {
      const pos = getWorldPointerPosition();
      if (!pos) {
        cleanup();
        return;
      }

      // Handle marquee selection completion
      if (marqueeRef.current.isSelecting) {
        const selectedIds = handleSelectionComplete(pos);
        if (selectedIds && selectedIds.length > 0) {
          selectionRef.current = selectedIds;
        } else {
          cleanup();
        }
        return;
      }

      // Handle drag completion
      if (marqueeRef.current.isDragging) {
        handleDragComplete(pos);
      }
    };

    /**
     * Cleanup marquee state
     */
    const cleanup = () => {
      if (marqueeRef.current.selectionRect) {
        marqueeRef.current.selectionRect.destroy();
        const overlayLayer = getOverlayLayer();
        overlayLayer.batchDraw();
      }

      marqueeRef.current.isSelecting = false;
      marqueeRef.current.isDragging = false;
      marqueeRef.current.transformInitiated = false;
      marqueeRef.current.startPoint = null;
      marqueeRef.current.selectionRect = null;
      marqueeRef.current.selectedNodes = [];
      marqueeRef.current.selectedConnectorIds.clear();
      marqueeRef.current.basePositions.clear();
      marqueeRef.current.originalDraggableStates.clear();
      marqueeRef.current.connectorBaselines.clear();
      marqueeRef.current.mindmapDescendantBaselines.clear();
      marqueeRef.current.activeMindmapNodeIds = [];
      selectionRef.current = [];
    };

    /**
     * Handle escape key to cancel marquee
     */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && marqueeRef.current.isSelecting) {
        cleanup();
      }
    };

    // Register event handlers
    stage.on("pointerdown.marquee", onPointerDown);
    stage.on("pointermove.marquee", onPointerMove);
    stage.on("pointerup.marquee", onPointerUp);
    window.addEventListener("keydown", onKeyDown);

    // Cleanup on unmount
    return () => {
      stage.off("pointerdown.marquee", onPointerDown);
      stage.off("pointermove.marquee", onPointerMove);
      stage.off("pointerup.marquee", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);

      // Cleanup any ongoing marquee
      cleanup();
    };
  }, [
    isActive,
    selectedTool,
    stageRef,
    elements,
    setSelection,
    beginTransform,
    endTransform,
    selectedElementIds,
    marqueeRef,
    handleStageClick,
    handleSelectionMove,
    handleSelectionComplete,
    handleElementClick,
    handleDragMove,
    handleDragComplete,
      getOverlayLayer,
      getWorldPointerPosition,
      resolveElementTarget,
  ]);

  return null;
};

export default MarqueeSelectionTool;
