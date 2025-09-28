
import type React from "react";
import { useEffect, useRef } from "react";
import type Konva from "konva";
import { StoreActions } from "../../../stores/facade";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import type { RafBatcher } from "../../../utils/performance/RafBatcher";

interface PanToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  rafBatcher: RafBatcher;
}

/**
 * PanTool: Enables Konva stage dragging when the pan tool is active and keeps
 * the viewport store in sync with stage position. This leverages Konva's
 * built-in drag system for reliable pointer handling across mouse and touch.
 */
const PanTool: React.FC<PanToolProps> = ({ stageRef, isActive, rafBatcher }) => {
  const lastSyncedPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    const container = stage?.container();

    if (!stage || !container) {
      return;
    }

    const resetCursor = () => {
      container.classList.remove("grabbing");
      if (container.style.cursor === "grab" || container.style.cursor === "grabbing") {
        container.style.cursor = "";
      }
    };

    stage.off(".pan-tool");
    stage.draggable(false);

    if (!isActive) {
      resetCursor();
      return;
    }

    const setCursor = (cursor: string) => {
      container.style.cursor = cursor;
    };

    const syncViewportToStage = () => {
      const pos = stage.position();
      if (
        pos.x === lastSyncedPositionRef.current.x &&
        pos.y === lastSyncedPositionRef.current.y
      ) {
        return;
      }

      lastSyncedPositionRef.current = { x: pos.x, y: pos.y };

      rafBatcher.schedule(() => {
        try {
          const state = useUnifiedCanvasStore.getState();
          const viewport = state.viewport;
          const currentX = typeof viewport?.x === "number" ? viewport.x : 0;
          const currentY = typeof viewport?.y === "number" ? viewport.y : 0;

          if (viewport && typeof viewport.setPan === "function") {
            viewport.setPan(pos.x, pos.y);
          } else if (typeof state.panBy === "function") {
            state.panBy(pos.x - currentX, pos.y - currentY);
          } else {
            StoreActions.panBy(pos.x - currentX, pos.y - currentY);
          }
        } catch {
          // Ignore pan errors to keep interaction responsive
        }
      });
    };

    stage.draggable(true);
    setCursor("grab");

    const handleDragStart = () => {
      container.classList.add("grabbing");
      setCursor("grabbing");
    };

    const handleDragMove = () => {
      syncViewportToStage();
    };

    const handleDragEnd = () => {
      syncViewportToStage();
      container.classList.remove("grabbing");
      setCursor("grab");
    };

    const handleMouseEnter = () => {
      setCursor("grab");
    };

    const handleMouseLeave = () => {
      if (!stage.isDragging()) {
        resetCursor();
      }
    };

    stage.on("dragstart.pan-tool", handleDragStart);
    stage.on("dragmove.pan-tool", handleDragMove);
    stage.on("dragend.pan-tool", handleDragEnd);
    stage.on("mouseenter.pan-tool", handleMouseEnter);
    stage.on("mouseleave.pan-tool", handleMouseLeave);

    return () => {
      stage.off(".pan-tool");
      stage.draggable(false);
      resetCursor();
    };
  }, [isActive, stageRef, rafBatcher]);

  return null;
};

export default PanTool;
