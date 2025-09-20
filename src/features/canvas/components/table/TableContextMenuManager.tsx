// State management and integration for table context menu system
import React, { useState, useCallback, useEffect } from 'react';
import { TableContextMenu } from './TableContextMenu';
import { TableSpatialFeedback } from './TableSpatialFeedback';
import { TableConfirmationDialog } from './TableConfirmationDialog';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import {
  addRowAbove,
  addRowBelow,
  addColumnLeft,
  addColumnRight,
  deleteRow,
  deleteColumn,
} from '../../utils/table/tableOperations';

export interface TableContextMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  tableId: string | null;
  cellPosition: { row: number; col: number } | null;
}

export interface TableSpatialFeedbackState {
  visible: boolean;
  tableId: string | null;
  type: 'row' | 'column' | null;
  index: number | null;
}

export interface TableConfirmationState {
  visible: boolean;
  action: string | null;
  message: string | null;
  onConfirm: (() => void) | null;
}

export interface TableContextMenuManagerProps {
  stageRef: React.RefObject<any>; // Konva.Stage
}

export const TableContextMenuManager: React.FC<TableContextMenuManagerProps> = ({
  stageRef,
}) => {
  const [contextMenuState, setContextMenuState] = useState<TableContextMenuState>({
    visible: false,
    position: null,
    tableId: null,
    cellPosition: null,
  });

  const [spatialFeedbackState, setSpatialFeedbackState] = useState<TableSpatialFeedbackState>({
    visible: false,
    tableId: null,
    type: null,
    index: null,
  });

  const [confirmationState, setConfirmationState] = useState<TableConfirmationState>({
    visible: false,
    action: null,
    message: null,
    onConfirm: null,
  });

  // Get store methods directly from the hook for reactive access
  const getElement = useUnifiedCanvasStore((state) => state.element.getById);
  const updateElement = useUnifiedCanvasStore((state) => state.element.update);
  const withUndo = useUnifiedCanvasStore((state) => state.withUndo);
  const bumpSelectionVersion = useUnifiedCanvasStore((state) => state.bumpSelectionVersion);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuState({
      visible: false,
      position: null,
      tableId: null,
      cellPosition: null,
    });
    setSpatialFeedbackState({
      visible: false,
      tableId: null,
      type: null,
      index: null,
    });
  }, []);

  // Close confirmation dialog
  const closeConfirmation = useCallback(() => {
    setConfirmationState({
      visible: false,
      action: null,
      message: null,
      onConfirm: null,
    });
  }, []);

  // Show context menu at position
  const showContextMenu = useCallback((
    x: number,
    y: number,
    tableId: string,
    row: number,
    col: number
  ) => {
    console.log('[TableContextMenuManager] showContextMenu called with:', {
      x, y, tableId, row, col
    });

    // Adjust position to keep menu within viewport
    const menuWidth = 180;
    const menuHeight = 200;
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

    console.log('[TableContextMenuManager] Setting context menu state:', {
      visible: true,
      position: { x: adjustedX, y: adjustedY },
      tableId,
      cellPosition: { row, col }
    });

    setContextMenuState({
      visible: true,
      position: { x: adjustedX, y: adjustedY },
      tableId,
      cellPosition: { row, col },
    });
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback((actionId: string) => {
    const { tableId, cellPosition } = contextMenuState;
    if (!tableId || !cellPosition) return;

    const { row, col } = cellPosition;

    switch (actionId) {
      case 'add-row-above':
        setSpatialFeedbackState({
          visible: true,
          tableId,
          type: 'row',
          index: row,
        });
        setTimeout(() => {
          const latest = getElement(tableId);
          if (!latest || latest.type !== 'table') return;

          const apply = () => {
            const updatedTable = addRowAbove(latest as any, row);
            const { cells, rows, rowHeights, height } = updatedTable;
            updateElement(tableId, {
              cells,
              rows,
              rowHeights,
              height,
              x: latest.x,
              y: latest.y,
            });
            bumpSelectionVersion();
          };

          if (withUndo) {
            withUndo('Add row above', apply);
          } else {
            apply();
          }
          setSpatialFeedbackState({ visible: false, tableId: null, type: null, index: null });
        }, 300);
        break;

      case 'add-row-below':
        setSpatialFeedbackState({
          visible: true,
          tableId,
          type: 'row',
          index: row + 1,
        });
        setTimeout(() => {
          const latest = getElement(tableId);
          if (!latest || latest.type !== 'table') return;

          const apply = () => {
            const updatedTable = addRowBelow(latest as any, row);
            const { cells, rows, rowHeights, height } = updatedTable;
            updateElement(tableId, {
              cells,
              rows,
              rowHeights,
              height,
              x: latest.x,
              y: latest.y,
            });
            bumpSelectionVersion();
          };

          if (withUndo) {
            withUndo('Add row below', apply);
          } else {
            apply();
          }
          setSpatialFeedbackState({ visible: false, tableId: null, type: null, index: null });
        }, 300);
        break;

      case 'add-column-left':
        setSpatialFeedbackState({
          visible: true,
          tableId,
          type: 'column',
          index: col,
        });
        setTimeout(() => {
          const latest = getElement(tableId);
          if (!latest || latest.type !== 'table') return;

          const apply = () => {
            const updatedTable = addColumnLeft(latest as any, col);
            const { cells, cols, colWidths, width } = updatedTable;
            updateElement(tableId, {
              cells,
              cols,
              colWidths,
              width,
              x: latest.x,
              y: latest.y,
            });
            bumpSelectionVersion();
          };

          if (withUndo) {
            withUndo('Add column left', apply);
          } else {
            apply();
          }
          setSpatialFeedbackState({ visible: false, tableId: null, type: null, index: null });
        }, 300);
        break;

      case 'add-column-right':
        setSpatialFeedbackState({
          visible: true,
          tableId,
          type: 'column',
          index: col + 1,
        });
        setTimeout(() => {
          const latest = getElement(tableId);
          if (!latest || latest.type !== 'table') return;

          const apply = () => {
            const updatedTable = addColumnRight(latest as any, col);
            const { cells, cols, colWidths, width } = updatedTable;
            updateElement(tableId, {
              cells,
              cols,
              colWidths,
              width,
              x: latest.x,
              y: latest.y,
            });
            bumpSelectionVersion();
          };

          if (withUndo) {
            withUndo('Add column right', apply);
          } else {
            apply();
          }
          setSpatialFeedbackState({ visible: false, tableId: null, type: null, index: null });
        }, 300);
        break;

      case 'delete-row':
        {
          const latest = getElement(tableId);
          if (!latest || latest.type !== 'table') return;

          if ((latest as any).rows <= 1) {
            alert('Cannot delete the last row');
            return;
          }
          setConfirmationState({
            visible: true,
            action: 'delete-row',
            message: `Delete row ${row + 1}? This action cannot be undone.`,
            onConfirm: () => {
              const latestState = getElement(tableId);
              if (!latestState || latestState.type !== 'table') return;

              const apply = () => {
                const updatedTable = deleteRow(latestState as any, row);
                const { cells, rows, rowHeights, height } = updatedTable;
                updateElement(tableId, {
                  cells,
                  rows,
                  rowHeights,
                  height,
                  x: latestState.x,
                  y: latestState.y,
                });
                bumpSelectionVersion();
              };

              if (withUndo) {
                withUndo('Delete row', apply);
              } else {
                apply();
              }
              closeConfirmation();
            },
          });
        }
        break;

      case 'delete-column':
        {
          const latest = getElement(tableId);
          if (!latest || latest.type !== 'table') return;

          if ((latest as any).cols <= 1) {
            alert('Cannot delete the last column');
            return;
          }
          setConfirmationState({
            visible: true,
            action: 'delete-column',
            message: `Delete column ${String.fromCharCode(65 + col)}? This action cannot be undone.`,
            onConfirm: () => {
              const latestState = getElement(tableId);
              if (!latestState || latestState.type !== 'table') return;

              const apply = () => {
                const updatedTable = deleteColumn(latestState as any, col);
                const { cells, cols, colWidths, width } = updatedTable;
                updateElement(tableId, {
                  cells,
                  cols,
                  colWidths,
                  width,
                  x: latestState.x,
                  y: latestState.y,
                });
                bumpSelectionVersion();
              };

              if (withUndo) {
                withUndo('Delete column', apply);
              } else {
                apply();
              }
              closeConfirmation();
            },
          });
        }
        break;
    }
  }, [contextMenuState, getElement, updateElement, withUndo, closeConfirmation]);

  // Set up right-click event handling on stage with robust initialization
  useEffect(() => {
    let disposed = false;
    let contextMenuHandler: ((e: any) => void) | null = null;

    const attachWhenReady = () => {
      if (disposed) return;

      const stage = stageRef.current;
      if (!stage) {
        console.log('[TableContextMenuManager] Stage not ready, retrying...');
        setTimeout(attachWhenReady, 100);
        return;
      }

      console.log('[TableContextMenuManager] Setting up contextmenu event listener on stage');

      contextMenuHandler = (e: any) => {
        const stageInstance = stageRef.current;
        if (!stageInstance) {
          console.warn('[TableContextMenuManager] Stage unavailable during contextmenu');
          return;
        }

        console.log('🔥🔥🔥 [TableContextMenuManager] CONTEXTMENU EVENT RECEIVED!!! 🔥🔥🔥');
        console.log('[TableContextMenuManager] Right-click detected:', {
          target: e.target,
          targetName: e.target?.name?.(),
          targetClassName: e.target?.className,
          targetNodeName: e.target?.nodeType,
          isGroup: e.target?.className === 'Group',
          evt: e.evt,
          eventType: e.type,
          timeStamp: e.evt?.timeStamp || Date.now()
        });

        // Prevent browser context menu
        e.evt?.preventDefault?.();

        const target = e.target;
        if (!target) {
          console.log('[TableContextMenuManager] No target found');
          return;
        }

        // Check if we clicked on a table cell or table group
        let tableGroup = target;
        let searchDepth = 0;
        console.log('[TableContextMenuManager] Starting search for table-group, initial target:', {
          name: target.name?.(),
          className: target.className,
          id: target.id?.()
        });

        const hasTableName = (node: any) => {
          if (!node) return false;
          if (typeof node.hasName === 'function') return node.hasName('table-group');
          return node.name?.() === 'table-group';
        };

        while (tableGroup && !hasTableName(tableGroup) && searchDepth < 10) {
          tableGroup = tableGroup.getParent();
          searchDepth++;
          console.log(`[TableContextMenuManager] Search depth ${searchDepth}:`, {
            name: tableGroup?.name?.(),
            className: tableGroup?.className,
            id: tableGroup?.id?.()
          });
          if (!tableGroup) {
            console.log('[TableContextMenuManager] No parent found');
            return;
          }
        }

        if (!tableGroup || !hasTableName(tableGroup)) {
          console.log('[TableContextMenuManager] No table-group found after search');
          return;
        }

        console.log('[TableContextMenuManager] Found table-group:', tableGroup.id());

        // Find the cell that was clicked
        const tableId = tableGroup.id();
        const pointerPos = stageInstance.getPointerPosition() ?? {
          x: e.evt?.offsetX ?? e.evt?.layerX ?? 0,
          y: e.evt?.offsetY ?? e.evt?.layerY ?? 0,
        };

        console.log('[TableContextMenuManager] Pointer position:', pointerPos);

        // Get table element to calculate cell position
        const tableElement = getElement(tableId);
        if (!tableElement || tableElement.type !== 'table') {
          console.log('[TableContextMenuManager] Table element not found or invalid type:', {
            tableElement,
            type: tableElement?.type
          });
          return;
        }

        console.log('[TableContextMenuManager] Table element found:', {
          id: tableElement.id,
          width: (tableElement as any).width,
          height: (tableElement as any).height,
          rows: (tableElement as any).rows,
          cols: (tableElement as any).cols
        });

        // Calculate which cell was clicked based on pointer position and table transform
        const tableTransform = tableGroup.getAbsoluteTransform();
        const localPos = tableTransform.copy().invert().point(pointerPos);

        console.log('[TableContextMenuManager] Local position in table:', localPos);

        const cellWidth = (tableElement as any).width / (tableElement as any).cols;
        const cellHeight = (tableElement as any).height / (tableElement as any).rows;

        console.log('[TableContextMenuManager] Cell dimensions:', { cellWidth, cellHeight });

        const col = Math.floor(localPos.x / cellWidth);
        const row = Math.floor(localPos.y / cellHeight);

        console.log('[TableContextMenuManager] Calculated cell position:', { row, col });

        // Ensure we're within bounds
        if (row >= 0 && row < (tableElement as any).rows && col >= 0 && col < (tableElement as any).cols) {
          // Convert stage coordinates to screen coordinates
          const rect = stageInstance.container().getBoundingClientRect();
          const screenX = rect.left + pointerPos.x;
          const screenY = rect.top + pointerPos.y;

          console.log('[TableContextMenuManager] Showing context menu at screen position:', { screenX, screenY });
          showContextMenu(screenX, screenY, tableId, row, col);
        } else {
          console.log('[TableContextMenuManager] Cell position out of bounds:', {
            row, col,
            maxRow: (tableElement as any).rows - 1,
            maxCol: (tableElement as any).cols - 1
          });
        }
      };

      stage.on('contextmenu.table-menu', contextMenuHandler);
      console.log('[TableContextMenuManager] Event listener attached successfully');
    };

    attachWhenReady();

    return () => {
      disposed = true;
      const stage = stageRef.current;
      if (stage) {
        if (contextMenuHandler) {
          stage.off('contextmenu', contextMenuHandler);
        }
        stage.off('contextmenu.table-menu');
        console.log('[TableContextMenuManager] Event listener removed');
      }
    };
  }, [stageRef, showContextMenu, getElement]);

  // Close menus on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
        closeConfirmation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeContextMenu, closeConfirmation]);

  return (
    <>
      <TableContextMenu
        state={contextMenuState}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
      />

      <TableSpatialFeedback
        state={spatialFeedbackState}
        stageRef={stageRef}
      />

      <TableConfirmationDialog
        state={confirmationState}
        onConfirm={confirmationState.onConfirm || (() => {})}
        onCancel={closeConfirmation}
      />
    </>
  );
};

export default TableContextMenuManager;
