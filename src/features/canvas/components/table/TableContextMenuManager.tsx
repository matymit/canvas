// State management and integration for table context menu system
import React, { useState, useCallback, useEffect } from "react";
import { TableContextMenu } from "./TableContextMenu";
import { TableSpatialFeedback } from "./TableSpatialFeedback";
import { TableConfirmationDialog } from "./TableConfirmationDialog";
import { StoreSelectors, StoreActions } from "../../stores/facade";
import { TableContextMenuTool } from "../../tools/TableContextMenuTool";
import type Konva from "konva";
import type { TableElement } from "../../types/table";
import type { ToolEventHandler } from "../../hooks/useCanvasEventManager";
import {
  addRowAbove,
  addRowBelow,
  addColumnLeft,
  addColumnRight,
  deleteRow,
  deleteColumn,
} from "../../utils/table/tableOperations";

export interface TableContextMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  tableId: string | null;
  cellPosition: { row: number; col: number } | null;
}

export interface TableSpatialFeedbackState {
  visible: boolean;
  tableId: string | null;
  type: "row" | "column" | null;
  index: number | null;
}

export interface TableConfirmationState {
  visible: boolean;
  action: string | null;
  message: string | null;
  onConfirm: (() => void) | null;
}

interface TableContextMenuBridge {
  show?: (
    screenX: number,
    screenY: number,
    tableId: string,
    row: number,
    col: number,
  ) => void;
  close?: () => void;
}

interface ExtendedWindow extends Window {
  tableContextMenu?: TableContextMenuBridge;
}

export interface TableContextMenuManagerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  eventManager?: {
    registerTool: (id: string, handler: ToolEventHandler, priority?: number) => void;
    unregisterTool: (id: string) => void;
  };
}

export const TableContextMenuManager: React.FC<
  TableContextMenuManagerProps
> = ({ stageRef, eventManager }) => {
  const [contextMenuState, setContextMenuState] =
    useState<TableContextMenuState>({
      visible: false,
      position: null,
      tableId: null,
      cellPosition: null,
    });

  const [spatialFeedbackState, setSpatialFeedbackState] =
    useState<TableSpatialFeedbackState>({
      visible: false,
      tableId: null,
      type: null,
      index: null,
    });

  const [confirmationState, setConfirmationState] =
    useState<TableConfirmationState>({
      visible: false,
      action: null,
      message: null,
      onConfirm: null,
    });

  // Get store methods directly from the hook for reactive access
  const getElement = StoreSelectors.getElementById;
  const updateElement = StoreActions.updateElement;
  const withUndo = StoreActions.withUndo;
  const bumpSelectionVersion = StoreActions.bumpSelectionVersion;

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
  const showContextMenu = useCallback(
    (x: number, y: number, tableId: string, row: number, col: number) => {
      // Adjust position to keep menu within viewport
      const menuWidth = 180;
      const menuHeight = 200;
      const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
      const adjustedY =
        y + menuHeight > window.innerHeight ? y - menuHeight : y;

      setContextMenuState({
        visible: true,
        position: { x: adjustedX, y: adjustedY },
        tableId,
        cellPosition: { row, col },
      });
    },
    [],
  );

  // Expose a bridge for canvas modules that want to open the table menu directly
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const bridge: TableContextMenuBridge = {
      show: (screenX, screenY, tableId, row, col) => {
        showContextMenu(screenX, screenY, tableId, row, col);
      },
      close: () => {
        closeContextMenu();
        closeConfirmation();
      },
    };

    const globalWindow = window as ExtendedWindow;
    globalWindow.tableContextMenu = bridge;

    return () => {
      if (globalWindow.tableContextMenu === bridge) {
        delete globalWindow.tableContextMenu;
      }
    };
  }, [showContextMenu, closeContextMenu, closeConfirmation]);

  // Handle context menu actions
  const handleContextMenuAction = useCallback(
    (actionId: string) => {
      const { tableId, cellPosition } = contextMenuState;
      if (!tableId || !cellPosition) return;

      const { row, col } = cellPosition;

      switch (actionId) {
        case "add-row-above":
          setSpatialFeedbackState({
            visible: true,
            tableId,
            type: "row",
            index: row,
          });
          setTimeout(() => {
            const latest = getElement(tableId);
            if (!latest || latest.type !== "table") return;

            const apply = () => {
              const updatedTable = addRowAbove(latest as TableElement, row);
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
              withUndo("Add row above", apply);
            } else {
              apply();
            }
            setSpatialFeedbackState({
              visible: false,
              tableId: null,
              type: null,
              index: null,
            });
          }, 300);
          break;

        case "add-row-below":
          setSpatialFeedbackState({
            visible: true,
            tableId,
            type: "row",
            index: row + 1,
          });
          setTimeout(() => {
            const latest = getElement(tableId);
            if (!latest || latest.type !== "table") return;

            const apply = () => {
              const updatedTable = addRowBelow(latest as TableElement, row);
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
              withUndo("Add row below", apply);
            } else {
              apply();
            }
            setSpatialFeedbackState({
              visible: false,
              tableId: null,
              type: null,
              index: null,
            });
          }, 300);
          break;

        case "add-column-left":
          setSpatialFeedbackState({
            visible: true,
            tableId,
            type: "column",
            index: col,
          });
          setTimeout(() => {
            const latest = getElement(tableId);
            if (!latest || latest.type !== "table") return;

            const apply = () => {
              const updatedTable = addColumnLeft(latest as TableElement, col);
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
              withUndo("Add column left", apply);
            } else {
              apply();
            }
            setSpatialFeedbackState({
              visible: false,
              tableId: null,
              type: null,
              index: null,
            });
          }, 300);
          break;

        case "add-column-right":
          setSpatialFeedbackState({
            visible: true,
            tableId,
            type: "column",
            index: col + 1,
          });
          setTimeout(() => {
            const latest = getElement(tableId);
            if (!latest || latest.type !== "table") return;

            const apply = () => {
              const updatedTable = addColumnRight(latest as TableElement, col);
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
              withUndo("Add column right", apply);
            } else {
              apply();
            }
            setSpatialFeedbackState({
              visible: false,
              tableId: null,
              type: null,
              index: null,
            });
          }, 300);
          break;

        case "delete-row":
          {
            const latest = getElement(tableId);
            if (!latest || latest.type !== "table") return;

            if ((latest as TableElement).rows <= 1) {
              alert("Cannot delete the last row");
              return;
            }
            setConfirmationState({
              visible: true,
              action: "delete-row",
              message: `Delete row ${row + 1}? This action cannot be undone.`,
              onConfirm: () => {
                const latestState = getElement(tableId);
                if (!latestState || latestState.type !== "table") return;

                const apply = () => {
                  const updatedTable = deleteRow(
                    latestState as TableElement,
                    row,
                  );
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
                  withUndo("Delete row", apply);
                } else {
                  apply();
                }
                closeConfirmation();
              },
            });
          }
          break;

        case "delete-column":
          {
            const latest = getElement(tableId);
            if (!latest || latest.type !== "table") return;

            if ((latest as TableElement).cols <= 1) {
              alert("Cannot delete the last column");
              return;
            }
            setConfirmationState({
              visible: true,
              action: "delete-column",
              message: `Delete column ${String.fromCharCode(65 + col)}? This action cannot be undone.`,
              onConfirm: () => {
                const latestState = getElement(tableId);
                if (!latestState || latestState.type !== "table") return;

                const apply = () => {
                  const updatedTable = deleteColumn(
                    latestState as TableElement,
                    col,
                  );
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
                  withUndo("Delete column", apply);
                } else {
                  apply();
                }
                closeConfirmation();
              },
            });
          }
          break;
      }
    },
    [
      contextMenuState,
      getElement,
      updateElement,
      withUndo,
      closeConfirmation,
      bumpSelectionVersion,
    ],
  );

  // Set up right-click event handling through the event manager
  useEffect(() => {
    if (!eventManager) {
      // Fallback to direct stage registration if no event manager available
      let disposed = false;
      let contextMenuHandler: ((e: Konva.KonvaEventObject<MouseEvent>) => void) | null = null;
      const currentStage = stageRef.current;

      const attachWhenReady = () => {
        if (disposed) return;
        const stage = currentStage;
        if (!stage) {
          setTimeout(attachWhenReady, 100);
          return;
        }

        contextMenuHandler = (e: Konva.KonvaEventObject<MouseEvent>) => {
          // Use existing table context menu logic as fallback
          const target = e.target;
          if (!target) return;

          let tableGroup: Konva.Node | null = target;
          let searchDepth = 0;

          const hasTableName = (node: Konva.Node | null) => {
            if (!node) return false;
            if (typeof node.hasName === "function") return node.hasName("table-group");
            return node.name?.() === "table-group";
          };

          while (tableGroup && !hasTableName(tableGroup) && searchDepth < 10) {
            tableGroup = tableGroup.getParent();
            searchDepth++;
            if (!tableGroup) return;
          }

          if (!tableGroup || !hasTableName(tableGroup)) return;

          e.evt?.preventDefault?.();

          stage.setPointersPositions(e.evt as MouseEvent);

          const tableId = tableGroup.id();
          const pointerPos = stage.getPointerPosition() ?? {
            x: e.evt?.offsetX ?? e.evt?.layerX ?? 0,
            y: e.evt?.offsetY ?? e.evt?.layerY ?? 0,
          };

          const tableElement = getElement(tableId);
          if (!tableElement || tableElement.type !== "table") return;

          const tableTransform = tableGroup.getAbsoluteTransform();
          const localPos = tableTransform.copy().invert().point(pointerPos);

          const table = tableElement as TableElement;

          let computedCol = -1;
          let cumulativeX = 0;
          for (let c = 0; c < table.cols; c++) {
            const width = table.colWidths[c] ?? table.width / table.cols;
            if (localPos.x >= cumulativeX && localPos.x <= cumulativeX + width) {
              computedCol = c;
              break;
            }
            cumulativeX += width;
          }

          let computedRow = -1;
          let cumulativeY = 0;
          for (let r = 0; r < table.rows; r++) {
            const height = table.rowHeights[r] ?? table.height / table.rows;
            if (localPos.y >= cumulativeY && localPos.y <= cumulativeY + height) {
              computedRow = r;
              break;
            }
            cumulativeY += height;
          }

          if (computedRow === -1 || computedCol === -1) {
            return;
          }

          const nativeEvent = e.evt as MouseEvent;
          const screenX = nativeEvent.clientX;
          const screenY = nativeEvent.clientY;
          showContextMenu(screenX, screenY, tableId, computedRow, computedCol);
        };

        stage.on("contextmenu.table-menu", contextMenuHandler);
      };

      attachWhenReady();

      return () => {
        disposed = true;
        if (currentStage && contextMenuHandler) {
          currentStage.off("contextmenu", contextMenuHandler);
          currentStage.off("contextmenu.table-menu");
        }
      };
    } else {
      // Use the event manager for better integration
      const tableContextMenuTool = new TableContextMenuTool(showContextMenu);
      eventManager.registerTool('table-context-menu', tableContextMenuTool, 10);

      return () => {
        eventManager.unregisterTool('table-context-menu');
      };
    }
  }, [stageRef, showContextMenu, getElement, eventManager]);

  // Close menus on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
        closeConfirmation();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeContextMenu, closeConfirmation]);

  return (
    <>
      <TableContextMenu
        state={contextMenuState}
        onAction={handleContextMenuAction}
        onClose={closeContextMenu}
      />

      <TableSpatialFeedback state={spatialFeedbackState} stageRef={stageRef} />

      <TableConfirmationDialog
        state={confirmationState}
        onConfirm={confirmationState.onConfirm || (() => {})}
        onCancel={closeConfirmation}
      />
    </>
  );
};

export default TableContextMenuManager;
