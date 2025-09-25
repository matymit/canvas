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
    const container = stage?.container();
    const hasContainer = !!container;

    console.log("PanTool useEffect:", {
      stage: !!stage,
      isActive,
      stageId: stage?.id(),
      hasContainer,
      containerType: container?.tagName
    });

    if (!stage || !isActive) {
      console.log("PanTool not activating:", { stage: !!stage, isActive, hasContainer });
      return;
    }

    if (!container) {
      console.error("PanTool: Stage has no container - cannot set up event handlers");
      return;
    }

    console.log("PanTool activated - setting up event handlers");

    // Set initial cursor
    container.style.cursor = "grab";
    console.log("PanTool cursor set to grab");

    const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      console.log("PanTool handlePointerDown:", { button: e.evt.button, type: e.evt.type });

      // Only handle left mouse button/primary touch
      if (e.evt.button !== undefined && e.evt.button !== 0) {
        console.log("PanTool ignoring non-left button:", e.evt.button);
        return;
      }

      e.evt.preventDefault();
      e.evt.stopPropagation();
      e.cancelBubble = true;

      isPanningRef.current = true;
      lastPointerPosRef.current = {
        x: e.evt.clientX,
        y: e.evt.clientY,
      };

      console.log("PanTool starting pan operation:", lastPointerPosRef.current);

      // Change cursor to grabbing during drag
      container.style.cursor = "grabbing";
      console.log("PanTool cursor set to grabbing");
    };

    const handlePointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isPanningRef.current || !lastPointerPosRef.current) {
        return;
      }

      e.evt.preventDefault();
      // Removed stopPropagation to allow other handlers to work

      const currentPos = {
        x: e.evt.clientX,
        y: e.evt.clientY,
      };

      // Calculate delta movement
      const deltaX = currentPos.x - lastPointerPosRef.current.x;
      const deltaY = currentPos.y - lastPointerPosRef.current.y;

      console.log("PanTool handlePointerMove:", { deltaX, deltaY, currentPos, lastPos: lastPointerPosRef.current });

      // Cancel existing RAF to prevent batching
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // RAF BATCHING - wrap store updates in requestAnimationFrame
      rafRef.current = requestAnimationFrame(() => {
        console.log("PanTool RAF executing with deltas:", { deltaX, deltaY });

        // Get fresh store state inside RAF callback
        const storeState = useUnifiedCanvasStore.getState();
        const { viewport } = storeState;

        console.log("PanTool store state:", {
          hasViewport: !!viewport,
          hasSetPan: !!viewport?.setPan,
          currentX: viewport?.x,
          currentY: viewport?.y
        });

        if (!viewport?.setPan) {
          console.error("PanTool: viewport.setPan not available");
          return;
        }

        try {
          // Use store as single source of truth - calculate from current viewport position
          const currentX = viewport.x || 0;
          const currentY = viewport.y || 0;
          const newX = currentX + deltaX;
          const newY = currentY + deltaY;

          console.log("PanTool updating viewport:", {
            currentX,
            currentY,
            deltaX,
            deltaY,
            newX,
            newY
          });

          // ONLY update store - FigJamCanvas useEffect will sync stage
          viewport.setPan(newX, newY);

          console.log("PanTool viewport.setPan completed successfully");
        } catch (error) {
          console.error("PanTool: Failed to update viewport:", error);
          // Removed fallback: do not manipulate stage or layers directly
        }
      });

      lastPointerPosRef.current = currentPos;
    };

    const handlePointerUp = () => {
      console.log("PanTool handlePointerUp:", { isPanning: isPanningRef.current });

      if (!isPanningRef.current) return;

      isPanningRef.current = false;
      lastPointerPosRef.current = null;

      console.log("PanTool ending pan operation");

      // Reset cursor to grab
      container.style.cursor = "grab";
      console.log("PanTool cursor reset to grab");
    };

    // Use proper Konva event system with namespaced handlers
    console.log("PanTool registering event handlers on stage");
    stage.on("pointerdown.pantool", handlePointerDown);
    stage.on("pointermove.pantool", handlePointerMove);
    stage.on("pointerup.pantool", handlePointerUp);
    stage.on("pointercancel.pantool", handlePointerUp);
    stage.on("pointerleave.pantool", handlePointerUp);
    console.log("PanTool event handlers registered successfully");

    // Also handle window-level pointer up to catch events outside canvas
    const handleWindowPointerUp = () => {
      if (isPanningRef.current) {
        handlePointerUp();
      }
    };
    window.addEventListener("pointerup", handleWindowPointerUp);

    return () => {
      console.log("PanTool cleanup - removing event handlers");

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
      const currentContainer = stage.container();
      if (currentContainer) {
        currentContainer.style.cursor = "default";
      }

      console.log("PanTool cleanup completed");
    };
  }, [isActive, stageRef]);

  return null;
};

export default PanTool;
