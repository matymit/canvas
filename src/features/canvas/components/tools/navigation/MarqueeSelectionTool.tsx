// MarqueeSelectionTool.tsx
// Marquee selection for drag-to-select multiple elements

import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";

export interface MarqueeSelectionToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

export const MarqueeSelectionTool: React.FC<MarqueeSelectionToolProps> = ({
  stageRef,
  isActive,
}) => {
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const selectedTool = useUnifiedCanvasStore((state) => state.selectedTool);

  // Track marquee state
  const marqueeRef = useRef<{
    isSelecting: boolean;
    startPoint: { x: number; y: number } | null;
    selectionRect: Konva.Rect | null;
  }>({
    isSelecting: false,
    startPoint: null,
    selectionRect: null,
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive || selectedTool !== "select") return;

    const layers = stage.getLayers();
    const overlayLayer = layers[layers.length - 1] as Konva.Layer; // Overlay layer

    const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Only start marquee if clicking on empty stage
      if (e.target !== stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      marqueeRef.current.isSelecting = true;
      marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

      // Create selection rectangle
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

    const onPointerMove = (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!marqueeRef.current.isSelecting || !marqueeRef.current.startPoint || !marqueeRef.current.selectionRect) return;

      const pos = stage.getPointerPosition();
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

      overlayLayer.batchDraw();
    };

    const onPointerUp = () => {
      if (!marqueeRef.current.isSelecting || !marqueeRef.current.startPoint || !marqueeRef.current.selectionRect) return;

      const pos = stage.getPointerPosition();
      if (!pos) {
        // Cleanup if no position
        cleanup();
        return;
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
        selectElementsInBounds(selectionBounds);
      }

      cleanup();
    };

    const cleanup = () => {
      if (marqueeRef.current.selectionRect) {
        marqueeRef.current.selectionRect.destroy();
        overlayLayer.batchDraw();
      }

      marqueeRef.current.isSelecting = false;
      marqueeRef.current.startPoint = null;
      marqueeRef.current.selectionRect = null;
    };

    const selectElementsInBounds = (bounds: { x: number; y: number; width: number; height: number }) => {
      const selectedIds: string[] = [];
      const mainLayer = layers[1]; // Main layer

      if (!mainLayer) return;

      // Find all element nodes that intersect with the selection bounds
      const allNodes = mainLayer.getChildren();

      for (const node of allNodes) {
        const elementId = node.getAttr("elementId") || node.id();

        if (elementId && elements.has(elementId)) {
          const nodeRect = node.getClientRect();

          // Check if node intersects with selection bounds
          const intersects = !(
            nodeRect.x > bounds.x + bounds.width ||
            nodeRect.x + nodeRect.width < bounds.x ||
            nodeRect.y > bounds.y + bounds.height ||
            nodeRect.y + nodeRect.height < bounds.y
          );

          if (intersects) {
            selectedIds.push(elementId);
          }
        }
      }

      // Update selection if any elements were found
      if (selectedIds.length > 0 && setSelection) {
        setSelection(selectedIds);
      }
    };

    // Register event handlers
    stage.on("pointerdown.marquee", onPointerDown);
    stage.on("pointermove.marquee", onPointerMove);
    stage.on("pointerup.marquee", onPointerUp);

    // Handle escape key to cancel marquee
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && marqueeRef.current.isSelecting) {
        cleanup();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      stage.off("pointerdown.marquee", onPointerDown);
      stage.off("pointermove.marquee", onPointerMove);
      stage.off("pointerup.marquee", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);

      // Cleanup any ongoing marquee
      cleanup();
    };
  }, [isActive, selectedTool, stageRef, elements, setSelection]);

  return null;
};

export default MarqueeSelectionTool;