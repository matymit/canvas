
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

const listenerOptions: AddEventListenerOptions = { capture: true, passive: false };

/**
 * PanTool: Handles canvas panning via mouse drag when pan tool is selected.
 *
 * Implementation uses DOM-level pointer events on the stage container so we can
 * intercept events before Konva nodes receive them. This guarantees elements do
 * not enter their own drag flows when the pan tool is active.
 */
const PanTool: React.FC<PanToolProps> = ({ stageRef, isActive, rafBatcher }) => {
  const isPanningRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const globalListenersAttachedRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    const container = stage?.container();

    if (!stage || !container || !isActive) {
      return;
    }

    const setCursor = (cursor: string) => {
      container.style.cursor = cursor;
    };
    setCursor("grab");

    const attachGlobalListeners = () => {
      if (globalListenersAttachedRef.current) {
        return;
      }

      window.addEventListener("pointermove", handlePointerMove, listenerOptions);
      window.addEventListener("pointerup", endPan, listenerOptions);
      window.addEventListener("pointercancel", endPan, listenerOptions);
      window.addEventListener("pointerleave", endPan, listenerOptions);
      globalListenersAttachedRef.current = true;
    };

    const detachGlobalListeners = () => {
      if (!globalListenersAttachedRef.current) {
        return;
      }

      window.removeEventListener("pointermove", handlePointerMove, listenerOptions);
      window.removeEventListener("pointerup", endPan, listenerOptions);
      window.removeEventListener("pointercancel", endPan, listenerOptions);
      window.removeEventListener("pointerleave", endPan, listenerOptions);
      globalListenersAttachedRef.current = false;
    };

    const performPan = (event: PointerEvent) => {
      if (!isPanningRef.current || !lastPointerPosRef.current) {
        return;
      }

      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const current = { x: event.clientX, y: event.clientY };
      const deltaX = current.x - lastPointerPosRef.current.x;
      const deltaY = current.y - lastPointerPosRef.current.y;

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      rafBatcher.schedule(() => {
        try {
          const state = useUnifiedCanvasStore.getState();
          const viewport = state.viewport;

          if (viewport && typeof viewport.setPan === "function") {
            const currentX = typeof viewport.x === "number" ? viewport.x : 0;
            const currentY = typeof viewport.y === "number" ? viewport.y : 0;
            viewport.setPan(currentX + deltaX, currentY + deltaY);
          } else if (typeof state.panBy === "function") {
            state.panBy(deltaX, deltaY);
          } else {
            StoreActions.panBy(deltaX, deltaY);
          }
        } catch {
          // Ignore pan errors to keep interaction responsive
        }
      });

      lastPointerPosRef.current = current;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      isPanningRef.current = true;
      lastPointerPosRef.current = { x: event.clientX, y: event.clientY };
      activePointerIdRef.current = event.pointerId;

      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture errors (e.g., unsupported environments)
      }

      container.classList.add("grabbing");
      setCursor("grabbing");
      attachGlobalListeners();
    };

    const handlePointerMove = (event: PointerEvent) => {
      performPan(event);
    };

    const endPan = (event?: PointerEvent) => {
      if (!isPanningRef.current) return;

      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      isPanningRef.current = false;
      lastPointerPosRef.current = null;

      if (activePointerIdRef.current != null) {
        try {
          container.releasePointerCapture(activePointerIdRef.current);
        } catch {
          // Ignore release errors
        }
        activePointerIdRef.current = null;
      }

      container.classList.remove("grabbing");
      setCursor("grab");
      detachGlobalListeners();
    };

    container.addEventListener("pointerdown", handlePointerDown, listenerOptions);
    container.addEventListener("pointermove", handlePointerMove, listenerOptions);
    container.addEventListener("pointerup", endPan, listenerOptions);
    container.addEventListener("pointercancel", endPan, listenerOptions);
    container.addEventListener("pointerleave", endPan, listenerOptions);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown, listenerOptions);
      container.removeEventListener("pointermove", handlePointerMove, listenerOptions);
      container.removeEventListener("pointerup", endPan, listenerOptions);
      container.removeEventListener("pointercancel", endPan, listenerOptions);
      container.removeEventListener("pointerleave", endPan, listenerOptions);

      detachGlobalListeners();

      if (isPanningRef.current && activePointerIdRef.current != null) {
        try {
          container.releasePointerCapture(activePointerIdRef.current);
        } catch {
          // Ignore release errors during cleanup
        }
      }

      isPanningRef.current = false;
      lastPointerPosRef.current = null;
      activePointerIdRef.current = null;
      container.classList.remove("grabbing");
      container.style.cursor = "";
    };
  }, [isActive, stageRef, rafBatcher]);

  return null;
};

export default PanTool;
