import React, { useRef, useEffect } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive) return;

    // Set initial cursor
    const container = stage.container();
    if (container) {
      container.style.cursor = 'grab';
    }

    const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
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

      // Change cursor to grabbing during drag
      const container = stage.container();
      if (container) {
        container.style.cursor = 'grabbing';
      }
    };

    const handlePointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!isPanningRef.current || !lastPointerPosRef.current) return;

      e.evt.preventDefault();
      e.evt.stopPropagation();

      const currentPos = {
        x: e.evt.clientX,
        y: e.evt.clientY,
      };

      // Calculate delta movement
      const deltaX = currentPos.x - lastPointerPosRef.current.x;
      const deltaY = currentPos.y - lastPointerPosRef.current.y;

      // STORE-ONLY UPDATE with RAF batching for smooth performance
      requestAnimationFrame(() => {
        const { viewport } = useUnifiedCanvasStore.getState();
        if (viewport?.setPan) {
          const stage = stageRef.current;
          // Get current position from stage or fallback to viewport state
          const newX = (stage?.x() || viewport.x) + deltaX;
          const newY = (stage?.y() || viewport.y) + deltaY;

          // ONLY update store - FigJamCanvas useEffect will sync stage
          viewport.setPan(newX, newY);
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
        container.style.cursor = 'grab';
      }
    };

    // Use proper Konva event system with namespaced handlers
    stage.on('pointerdown.pantool', handlePointerDown);
    stage.on('pointermove.pantool', handlePointerMove);
    stage.on('pointerup.pantool', handlePointerUp);
    stage.on('pointercancel.pantool', handlePointerUp);
    stage.on('pointerleave.pantool', handlePointerUp);

    // Also handle window-level pointer up to catch events outside canvas
    const handleWindowPointerUp = () => {
      if (isPanningRef.current) {
        handlePointerUp();
      }
    };
    window.addEventListener('pointerup', handleWindowPointerUp);

    return () => {
      // Clean up Konva event listeners
      stage.off('.pantool');

      // Clean up window event listener
      window.removeEventListener('pointerup', handleWindowPointerUp);

      // Reset cursor
      const container = stage.container();
      if (container) {
        container.style.cursor = 'default';
      }
    };
  }, [isActive, stageRef]);

  return null;
};

export default PanTool;