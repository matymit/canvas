import React, { useRef, useEffect } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";

interface PanToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

/**
 * PanTool: Handles canvas panning via mouse drag when pan tool is selected.
 *
 * Architecture:
 * - Uses store-only updates to avoid feedback loops
 * - FigJamCanvas useEffect handles stage sync from store
 * - Uses namespaced events to avoid conflicts
 * - No direct stage manipulation
 */
const PanTool: React.FC<PanToolProps> = ({ stageRef, isActive }) => {
  const isPanningRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive) return;

    // Pan tool activated

    // Set initial cursor
    const container = stage.container();
    if (container) {
      container.style.cursor = "grab";
    }

    const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Pan tool pointer down

      // Only handle left mouse button/primary touch
      if (e.evt.button !== undefined && e.evt.button !== 0) return;

      e.evt.preventDefault();
      e.evt.stopPropagation();
      e.cancelBubble = true;

      isPanningRef.current = true;
      lastPointerPosRef.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
      };

      // Pan tool starting pan operation

      // Change cursor to grabbing during drag
      const container = stage.container();
      if (container) {
        container.style.cursor = "grabbing";
      }
    };

    const handlePointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Pan tool pointer move

      if (!isPanningRef.current || !lastPointerPosRef.current) return;

      e.evt.preventDefault();
      // Removed stopPropagation to allow other handlers to work

      const currentPos = {
        x: e.evt.clientX,
        y: e.evt.clientY,
      };

      // Pan tool processing pointer move

      // Calculate delta movement
      const deltaX = currentPos.x - lastPointerPosRef.current.x;
      const deltaY = currentPos.y - lastPointerPosRef.current.y;

      // Cancel existing RAF to prevent batching
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // RAF BATCHING - wrap store updates in requestAnimationFrame
      rafRef.current = requestAnimationFrame(() => {
        const storeState = useUnifiedCanvasStore.getState();
        const { viewport } = storeState;
        if (!viewport?.setPan) {
          return;
        }

        try {
          // Use store as single source of truth
          const newX = viewport.x + deltaX;
          const newY = viewport.y + deltaY;

          // ONLY update store - FigJamCanvas useEffect will sync stage
          viewport.setPan(newX, newY);
        } catch (error) {
          console.error("PanTool: Failed to update viewport:", error);
          // Fallback: direct stage manipulation if store fails
          const stage = stageRef.current;
          if (stage) {
            const newX = stage.x() + deltaX;
            const newY = stage.y() + deltaY;
            stage.x(newX);
            stage.y(newY);
            stage.batchDraw();
          }
        }
      });

      lastPointerPosRef.current = currentPos;
    };

    const handlePointerUp = () => {
      if (!isPanningRef.current) return;

      isPanningRef.current = false;
      lastPointerPosRef.current = null;

      // Reset cursor to grab
      const container = stage.container();
      if (container) {
        container.style.cursor = "grab";
      }
    };

    // Use proper Konva event system with namespaced handlers
    stage.on("pointerdown.pantool", handlePointerDown);
    stage.on("pointermove.pantool", handlePointerMove);
    stage.on("pointerup.pantool", handlePointerUp);
    stage.on("pointercancel.pantool", handlePointerUp);
    stage.on("pointerleave.pantool", handlePointerUp);

    // Also handle window-level pointer up to catch events outside canvas
    const handleWindowPointerUp = () => {
      if (isPanningRef.current) {
        handlePointerUp();
      }
    };
    window.addEventListener("pointerup", handleWindowPointerUp);

    return () => {
      // Clean up Konva event listeners
      stage.off(".pantool");

      // Clean up window event listener
      window.removeEventListener("pointerup", handleWindowPointerUp);

      // Clean up RAF to prevent memory leaks
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Reset cursor
      const container = stage.container();
      if (container) {
        container.style.cursor = "default";
      }
    };
  }, [isActive, stageRef]);

  return null;
};

export default PanTool;
