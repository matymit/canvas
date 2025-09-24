import React, { useRef, useCallback, useEffect } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
// RAF batching for smooth performance - using store-driven updates

interface PanToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

/**
 * PanTool: Handles canvas panning via mouse drag when pan tool is selected.
 *
 * Architecture:
 * - Uses mouse events (not Konva draggable) for precise control
 * - Updates viewport store which triggers FigJamCanvas useEffect to sync stage position
 * - Uses RAF batching for 60fps smooth panning performance
 * - Follows store-driven rendering pattern (no direct Konva manipulation)
 * - Follows the established tool pattern with isActive prop
 */
const PanTool: React.FC<PanToolProps> = ({ stageRef, isActive }) => {
  const isPanningRef = useRef(false);
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isActive || !stageRef.current) return;

    // Only handle left mouse button
    if (e.evt.button !== 0) return;

    // Prevent event from bubbling to other tools
    e.cancelBubble = true;

    isPanningRef.current = true;
    lastPointerPosRef.current = {
      x: e.evt.clientX,
      y: e.evt.clientY,
    };

    // Change cursor to grabbing during drag
    if (stageRef.current.container()) {
      stageRef.current.container().style.cursor = 'grabbing';
    }
  }, [isActive, stageRef]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isPanningRef.current || !lastPointerPosRef.current || !stageRef.current) return;

    const currentPos = {
      x: e.evt.clientX,
      y: e.evt.clientY,
    };

    // Calculate delta movement
    const deltaX = currentPos.x - lastPointerPosRef.current.x;
    const deltaY = currentPos.y - lastPointerPosRef.current.y;

    // Update both stage position (for immediate feedback) and store (for state consistency)
    requestAnimationFrame(() => {
      const stage = stageRef.current;
      const { viewport } = useUnifiedCanvasStore.getState();

      if (stage && viewport?.setPan) {
        // Update stage position immediately for smooth feedback
        stage.x(stage.x() + deltaX);
        stage.y(stage.y() + deltaY);
        stage.batchDraw();

        // Also update store to keep state in sync
        viewport.setPan(stage.x(), stage.y());
      }
    });

    lastPointerPosRef.current = currentPos;
  }, [stageRef]);

  const handleMouseUp = useCallback(() => {
    if (!isPanningRef.current) return;

    isPanningRef.current = false;
    lastPointerPosRef.current = null;

    // Reset cursor to grab (not grabbing)
    if (stageRef.current?.container() && isActive) {
      stageRef.current.container().style.cursor = 'grab';
    }
  }, [stageRef, isActive]);

  // Set up mouse event listeners when tool is active
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive) return;

    // Set initial cursor
    if (stage.container()) {
      stage.container().style.cursor = 'grab';
    }

    // Add event listeners
    stage.on('mousedown', handleMouseDown);
    stage.on('mousemove', handleMouseMove);
    stage.on('mouseup', handleMouseUp);

    // Also listen for mouse up on window to handle cases where mouse leaves canvas
    const handleWindowMouseUp = () => {
      if (isPanningRef.current) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      // Clean up event listeners
      stage.off('mousedown', handleMouseDown);
      stage.off('mousemove', handleMouseMove);
      stage.off('mouseup', handleMouseUp);
      window.removeEventListener('mouseup', handleWindowMouseUp);

      // Reset cursor
      if (stage.container()) {
        stage.container().style.cursor = 'default';
      }
    };
  }, [isActive, stageRef, handleMouseDown, handleMouseMove, handleMouseUp]);

  // This tool doesn't render any visual components - it only handles events
  return null;
};

export default PanTool;