// Visual feedback for table operations showing which row/column will be affected
import type React from 'react';
import { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { TableElement } from '../../types/table';

export interface TableSpatialFeedbackState {
  visible: boolean;
  tableId: string | null;
  type: 'row' | 'column' | null;
  index: number | null;
}

export interface TableSpatialFeedbackProps {
  state: TableSpatialFeedbackState;
  stageRef: React.RefObject<Konva.Stage | null>;
}

export const TableSpatialFeedback: React.FC<TableSpatialFeedbackProps> = ({
  state,
  stageRef,
}) => {
  const highlightRef = useRef<Konva.Rect | null>(null);
  const store = useUnifiedCanvasStore.getState();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // Get overlay layer (top layer for UI feedback)
    const layers = stage.getLayers();
    const overlayLayer = layers[layers.length - 1]; // Overlay layer by convention
    if (!overlayLayer) return;

    // Clean up existing highlight
    if (highlightRef.current) {
      highlightRef.current.destroy();
      highlightRef.current = null;
    }

    if (!state.visible || !state.tableId || !state.type || state.index === null) {
      overlayLayer.batchDraw();
      return;
    }

    // Find the table group
    const tableGroup = stage.findOne(`#${state.tableId}`);
    if (!tableGroup || tableGroup.name() !== 'table') {
      overlayLayer.batchDraw();
      return;
    }

    // Get table element data
    const tableElement = store.getElement?.(state.tableId);
    if (!tableElement || tableElement.type !== 'table') {
      overlayLayer.batchDraw();
      return;
    }

    // Calculate highlight position and size
    const tableRect = tableGroup.getClientRect();
    const cellWidth = tableRect.width / (tableElement as TableElement).cols;
    const cellHeight = tableRect.height / (tableElement as TableElement).rows;

    let highlightX: number;
    let highlightY: number;
    let highlightWidth: number;
    let highlightHeight: number;

    if (state.type === 'row') {
      // Highlight entire row
      highlightX = tableRect.x;
      highlightY = tableRect.y + (state.index * cellHeight);
      highlightWidth = tableRect.width;
      highlightHeight = cellHeight;

      // For new row insertion, show a thin line
      if (state.index === (tableElement as TableElement).rows) {
        highlightY = tableRect.y + tableRect.height;
        highlightHeight = 3;
      } else if (state.index < (tableElement as TableElement).rows) {
        highlightHeight = 3;
      }
    } else {
      // Highlight entire column
      highlightX = tableRect.x + (state.index * cellWidth);
      highlightY = tableRect.y;
      highlightWidth = cellWidth;
      highlightHeight = tableRect.height;

      // For new column insertion, show a thin line
      if (state.index === (tableElement as TableElement).cols) {
        highlightX = tableRect.x + tableRect.width;
        highlightWidth = 3;
      } else if (state.index < (tableElement as TableElement).cols) {
        highlightWidth = 3;
      }
    }

    // Create highlight rectangle
    const highlight = new Konva.Rect({
      x: highlightX,
      y: highlightY,
      width: highlightWidth,
      height: highlightHeight,
      fill: '#007AFF',
      opacity: 0.3,
      listening: false,
      perfectDrawEnabled: false,
    });

    // Add pulsing animation for insertion indicators
    if ((state.type === 'row' && (state.index === (tableElement as TableElement).rows || highlightHeight === 3)) ||
        (state.type === 'column' && (state.index === (tableElement as TableElement).cols || highlightWidth === 3))) {
      const tween = new Konva.Tween({
        node: highlight,
        duration: 0.5,
        opacity: 0.7,
        yoyo: true,
        repeat: -1,
        easing: Konva.Easings.EaseInOut,
      });
      tween.play();
    }

    highlightRef.current = highlight;
    overlayLayer.add(highlight);
    overlayLayer.batchDraw();

    // Clean up on unmount or state change
    return () => {
      if (highlightRef.current) {
        try {
          highlightRef.current.destroy();
        } catch (e) {
          // Ignore errors during cleanup
        }
        highlightRef.current = null;
      }
      overlayLayer.batchDraw();
    };
  }, [state, stageRef, store]);

  return null; // This component only manages Konva elements
};

export default TableSpatialFeedback;