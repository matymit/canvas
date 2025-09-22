import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

export interface EraserToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  size?: number;
  opacity?: number;
}

const DEFAULT_SIZE = 20;

const EraserTool: React.FC<EraserToolProps> = ({
  stageRef,
  isActive,
  size = DEFAULT_SIZE,
  opacity = 1,
}) => {
  const withUndo = useUnifiedCanvasStore((s) => s.history?.withUndo);
  const deleteElement = useUnifiedCanvasStore((s) => s.element?.delete);
  const elements = useUnifiedCanvasStore((s) => s.elements);
  const selectedTool = useUnifiedCanvasStore((s) => s.selectedTool ?? s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore((s) => s.setSelectedTool ?? s.ui?.setSelectedTool);

  const ref = useRef<{ erasing: boolean; erasedElements: Set<string> }>({ erasing: false, erasedElements: new Set() });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && (selectedTool === 'eraser');
    if (!stage || !active) return;

    const layers = stage.getLayers();

    const showCursor = (pos: { x: number; y: number }) => {
      const overlay = layers[layers.length - 1] as Konva.Layer | undefined;
      if (!overlay) return;
      let cursor = overlay.findOne<Konva.Circle>('.eraser-cursor');
      if (!cursor) {
        cursor = new Konva.Circle({
          x: pos.x,
          y: pos.y,
          radius: size / 2,
          stroke: '#ef4444',
          strokeWidth: 1,
          fill: 'rgba(239,68,68,0.08)',
          listening: false,
          name: 'eraser-cursor',
        });
        overlay.add(cursor);
      } else {
        cursor.position(pos);
      }
      overlay.batchDraw();
    };

    const checkForElementsToErase = (x: number, y: number) => {
      if (!deleteElement || !elements) return;

      const mainLayer = stage.getLayers().find(layer => layer.name() === 'main' || layer === layers[1]);
      if (!mainLayer) return;

      // Find all nodes that intersect with the eraser circle
      const eraserRadius = size / 2;
      const allNodes = mainLayer.find('*');

      for (const node of allNodes) {
        try {
          const elementId = node.getAttr('elementId') || node.id();
          if (!elementId || ref.current?.erasedElements.has(elementId)) continue;

          // Get node bounds
          const bounds = node.getClientRect();
          if (!bounds || bounds.width === 0 || bounds.height === 0) continue;

          // Check if eraser position intersects with element bounds
          const nodeLeft = bounds.x;
          const nodeRight = bounds.x + bounds.width;
          const nodeTop = bounds.y;
          const nodeBottom = bounds.y + bounds.height;

          // Simple circle-rectangle intersection
          const closestX = Math.max(nodeLeft, Math.min(x, nodeRight));
          const closestY = Math.max(nodeTop, Math.min(y, nodeBottom));
          const distanceSquared = (x - closestX) ** 2 + (y - closestY) ** 2;

          if (distanceSquared <= eraserRadius ** 2) {
            // Element intersects with eraser - mark for deletion
            if (elements.has(elementId)) {
              ref.current?.erasedElements.add(elementId);
              console.debug('[EraserTool] Marked element for deletion:', elementId);
            }
          }
        } catch (error) {
          console.warn('[EraserTool] Error checking node for erasure:', error);
        }
      }
    };

    const onDown = () => {
      const p = stage.getPointerPosition();
      if (!p) return;
      if (!ref.current) ref.current = { erasing: false, erasedElements: new Set() };
      ref.current.erasing = true;
      ref.current.erasedElements.clear();

      // Start checking for elements to erase
      checkForElementsToErase(p.x, p.y);
    };

    const onMove = () => {
      const p = stage.getPointerPosition();
      if (!p) return;
      showCursor(p);

      // Continue checking for elements to erase during drag
      if (ref.current?.erasing) {
        checkForElementsToErase(p.x, p.y);
      }
    };

    const onUp = () => {
      if (!ref.current?.erasing) return;
      ref.current.erasing = false;

      // Delete all marked elements
      const elementsToDelete = Array.from(ref.current.erasedElements);
      ref.current.erasedElements.clear();

      if (elementsToDelete.length > 0 && deleteElement) {
        const commitFn = () => {
          console.debug('[EraserTool] Deleting elements:', elementsToDelete);
          for (const elementId of elementsToDelete) {
            deleteElement(elementId);
          }
        };

        if (withUndo) {
          withUndo(`Erase ${elementsToDelete.length} element${elementsToDelete.length > 1 ? 's' : ''}`, commitFn);
        } else {
          commitFn();
        }
      }

      // Switch back to select tool to match FigJam flows
      setSelectedTool?.('select');
    };

    stage.on('pointerdown.eraser', onDown);
    stage.on('pointermove.eraser', onMove);
    stage.on('pointerup.eraser', onUp);
    stage.on('mouseleave.eraser', onUp);

    return () => {
      stage.off('pointerdown.eraser', onDown);
      stage.off('pointermove.eraser', onMove);
      stage.off('pointerup.eraser', onUp);
      stage.off('mouseleave.eraser', onUp);
      const overlay = layers[layers.length - 1] as Konva.Layer | undefined;
      try { overlay?.find('.eraser-cursor').forEach(n => n.destroy()); overlay?.batchDraw(); } catch (error) {
        // Ignore cleanup errors
        // Cleanup error
      }
      ref.current = { erasing: false, erasedElements: new Set() };
    };
  }, [stageRef, isActive, size, opacity, selectedTool, setSelectedTool, withUndo, deleteElement, elements]);

  return null;
};

export default EraserTool;
