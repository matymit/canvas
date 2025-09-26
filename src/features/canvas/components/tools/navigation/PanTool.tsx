import React, { useRef, useEffect } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { StoreActions } from "../../../stores/facade";
import { RafBatcher } from "../../../utils/performance/RafBatcher";

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
  const rafBatcher = useRef(new RafBatcher()).current;

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

      rafBatcher.schedule(() => {
        console.log("PanTool RAF executing with deltas:", { deltaX, deltaY });

        try {
          StoreActions.panBy(deltaX, deltaY);

          console.log("PanTool viewport.setPan completed successfully");
        } catch (error) {
          console.error("PanTool: Failed to update viewport:", error);
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
