// State management and integration for canvas context menu system
import React, { useState, useCallback, useEffect } from "react";
import { CanvasContextMenu } from "./CanvasContextMenu";
import { CanvasContextMenuTool } from "../tools/CanvasContextMenuTool";
import { StoreSelectors, StoreActions } from "../stores/facade";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import type Konva from "konva";
import type { CanvasElement } from "../../../../types";
import { clipboard } from "../utils/clipboard";

export interface CanvasContextMenuState {
  visible: boolean;
  position: { x: number; y: number } | null;
  selectedElementIds: string[];
  clickedElementId?: string | null;
}

export interface CanvasContextMenuManagerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  eventManager?: {
    registerTool: (id: string, handler: unknown, priority?: number) => void;
    unregisterTool: (id: string) => void;
  };
}

// Use shared clipboard utility

export const CanvasContextMenuManager: React.FC<
  CanvasContextMenuManagerProps
> = ({ stageRef, eventManager }) => {
  const [contextMenuState, setContextMenuState] =
    useState<CanvasContextMenuState>({
      visible: false,
      position: null,
      selectedElementIds: [],
      clickedElementId: null,
    });

  // Use direct store access instead of reactive selectors to avoid infinite loops
  const store = useUnifiedCanvasStore.getState();
  const deleteSelected = store.selection?.deleteSelected;
  const duplicate = store.element?.duplicate;
  const setSelection = store.selection?.set;
  const addElement = store.addElement;
  const bringToFront = store.element?.bringToFront;
  const sendToBack = store.element?.sendToBack;

  // Use facade for non-reactive methods
  const getElement = StoreSelectors.getElementById;
  const withUndo = StoreActions.withUndo;

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenuState({
      visible: false,
      position: null,
      selectedElementIds: [],
      clickedElementId: null,
    });
  }, []);

  // Show context menu at position
  const showContextMenu = useCallback(
    (x: number, y: number, clickedElementId?: string) => {
      // Adjust position to keep menu within viewport
      const menuWidth = 180;
      const menuHeight = 200;
      const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
      const adjustedY =
        y + menuHeight > window.innerHeight ? y - menuHeight : y;

      // Get current selectedElementIds at call time to avoid stale closure
      const currentSelectedIds = Array.from(useUnifiedCanvasStore.getState().selectedElementIds);

      setContextMenuState({
        visible: true,
        position: { x: adjustedX, y: adjustedY },
        selectedElementIds: currentSelectedIds,
        clickedElementId,
      });
    },
    [], // Empty dependency array since we get current state at call time
  );

  // Handle context menu actions
  const handleContextMenuAction = useCallback(
    (actionId: string, _clickedElementId?: string) => {
      // Get current selectedElementIds at call time to avoid stale closure
      const currentSelectedIds = Array.from(useUnifiedCanvasStore.getState().selectedElementIds);

      switch (actionId) {
        case "copy":
          // Copy selected elements to clipboard
          if (currentSelectedIds.length > 0) {
            const elements = currentSelectedIds
              .map(id => getElement(id))
              .filter(el => el !== undefined) as CanvasElement[];
            clipboard.copy(elements);
          }
          break;

        case "paste":
          // Paste elements from clipboard with offset
          if (clipboard.hasContent() && withUndo && addElement) {
            withUndo("Paste elements", () => {
              const newIds: string[] = [];
              const elementsToCreate = clipboard.paste();
              elementsToCreate.forEach((element, index) => {
                const clone = { ...element };
                const newId = crypto?.randomUUID?.() ?? `${element.id}-copy-${Date.now()}`;
                clone.id = newId;

                // Apply offset so pasted elements don't overlap originals
                const offset = 20 + (index * 5); // Slight stagger for multiple elements
                if (typeof clone.x === 'number') clone.x += offset;
                if (typeof clone.y === 'number') clone.y += offset;

                // Handle points array for paths/lines
                if (Array.isArray(clone.points) && clone.points.length >= 2) {
                  const shifted: number[] = [];
                  for (let i = 0; i < clone.points.length; i += 2) {
                    shifted.push(clone.points[i] + offset, clone.points[i + 1] + offset);
                  }
                  clone.points = shifted;
                }

                addElement(clone, { select: true });
                newIds.push(newId);
              });

              // Select the newly pasted elements
              if (setSelection && newIds.length > 0) {
                setSelection(newIds);
              }
            });
          }
          break;

        case "duplicate":
          // Duplicate selected elements
          if (currentSelectedIds.length > 0 && withUndo && duplicate) {
            withUndo("Duplicate elements", () => {
              const newIds: string[] = [];
              currentSelectedIds.forEach(id => {
                const newId = duplicate(id);
                if (newId) {
                  newIds.push(newId);
                }
              });

              // Select the newly duplicated elements
              if (setSelection && newIds.length > 0) {
                setSelection(newIds);
              }
            });
          }
          break;

        case "delete":
          // Delete selected elements
          if (deleteSelected && withUndo) {
            withUndo("Delete elements", () => {
              deleteSelected();
            });
          }
          break;

        case "bring-to-front":
          // Bring selected elements to front
          if (currentSelectedIds.length > 0 && bringToFront && withUndo) {
            withUndo("Bring to front", () => {
              currentSelectedIds.forEach(id => {
                bringToFront(id);
              });
            });
          }
          break;

        case "send-to-back":
          // Send selected elements to back
          if (currentSelectedIds.length > 0 && sendToBack && withUndo) {
            withUndo("Send to back", () => {
              currentSelectedIds.forEach(id => {
                sendToBack(id);
              });
            });
          }
          break;

        default:
          // Unknown context menu action - silently ignore
          break;
      }
    },
    [
      getElement,
      withUndo,
      addElement,
      duplicate,
      deleteSelected,
      setSelection,
      bringToFront,
      sendToBack,
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
          const target = e.target;

          // Defer to specialized menus (tables, mindmap) before falling back
          if (target && target !== stage) {
            let node: Konva.Node | null = target;
            let depth = 0;
            const isSpecialNode = (n: Konva.Node | null) => {
              if (!n) return false;
              const hasName = typeof n.hasName === "function" ? n.hasName.bind(n) : null;
              if (hasName?.("table-group") || n.name?.() === "table-group") return true;
              if (hasName?.("mindmap-node") || n.name?.() === "mindmap-node") return true;
              return false;
            };

            while (node && node !== stage && depth < 10) {
              if (isSpecialNode(node)) {
                return; // Let specialized context menu handlers run
              }
              node = node.getParent();
              depth += 1;
            }
          }

          e.evt?.preventDefault?.();

          const pointer = stage.getPointerPosition() ?? {
            x: e.evt?.offsetX ?? e.evt?.layerX ?? 0,
            y: e.evt?.offsetY ?? e.evt?.layerY ?? 0,
          };

          // Convert stage coordinates to screen coordinates
          const container = stage.container();
          const rect = container.getBoundingClientRect();
          const screenX = rect.left + pointer.x;
          const screenY = rect.top + pointer.y;

          // Check if we right-clicked on a specific element
          let clickedElementId: string | undefined;

          if (target && target !== stage) {
            // Try to find the element ID from the Konva node
            let node: Konva.Node | null = target;
            while (node && node !== stage) {
              const id = node.id();
              if (id && getElement(id)) {
                clickedElementId = id;
                break;
              }
              node = node.getParent();
            }
          }

          showContextMenu(screenX, screenY, clickedElementId);
        };

        stage.on("contextmenu.canvas-menu", contextMenuHandler);
      };

      attachWhenReady();

      return () => {
        disposed = true;
        if (currentStage && contextMenuHandler) {
          currentStage.off("contextmenu", contextMenuHandler);
          currentStage.off("contextmenu.canvas-menu");
        }
      };
    } else {
      // Use the event manager for better integration
      const canvasContextMenuTool = new CanvasContextMenuTool(showContextMenu, getElement);
      eventManager.registerTool('canvas-context-menu', canvasContextMenuTool, 5);

      return () => {
        eventManager.unregisterTool('canvas-context-menu');
      };
    }
  }, [stageRef, showContextMenu, getElement, eventManager]);

  // Close menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeContextMenu]);

  return (
    <CanvasContextMenu
      state={contextMenuState}
      onAction={handleContextMenuAction}
      onClose={closeContextMenu}
      hasClipboard={clipboard.hasContent()}
    />
  );
};

export default CanvasContextMenuManager;
