// MarqueeSelectionTool.tsx
// Marquee selection for drag-to-select multiple elements
// Refactored to use custom hooks for selection and drag logic

import type React from "react";
import { useEffect, useRef } from "react";
import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { debug } from "../../../../../utils/debug";
import { useMarqueeState } from "./hooks/useMarqueeState";
import { useMarqueeSelection } from "./hooks/useMarqueeSelection";
import { useMarqueeDrag } from "./hooks/useMarqueeDrag";

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
  const getWorldPointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  };

  const getOverlayLayer = (): Konva.Layer => {
    const stage = stageRef.current;
    if (!stage) throw new Error("Stage not available");
    const layers = stage.getLayers();
    return layers[layers.length - 1] as Konva.Layer;
  };

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

      console.log("[MarqueeSelectionTool] onPointerDown", {
        target: e.target.constructor.name,
        targetId: e.target.id(),
        selectionCount: selectionRef.current.length,
        pos,
      });

      // Stage click - start marquee selection
      if (e.target === stage) {
        // If there's a current selection, clear it on first click
        if (selectionRef.current.length > 0) {
          console.log(
            "[MarqueeSelectionTool] clearing selection on stage click",
          );
          setSelection([]);
          marqueeRef.current.persistentSelection = [];
          return;
        }

        // Start marquee selection
        handleStageClick(stage, pos);
        return;
      }

      // Element click - handle selection or drag
      handleElementClick(e.target, stage, pos);
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
        console.log("[MarqueeSelectionTool] onPointerMove calling handleDragMove");
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
      marqueeRef.current.basePositions.clear();
      marqueeRef.current.originalDraggableStates.clear();
      marqueeRef.current.connectorBaselines.clear();
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
  ]);

  return null;
};

export default MarqueeSelectionTool;
