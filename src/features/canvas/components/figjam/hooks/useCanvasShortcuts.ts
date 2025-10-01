import { useEffect } from "react";

import useKeyboardShortcuts from "../../../hooks/useKeyboardShortcuts";
import { clipboard } from "../../../utils/clipboard";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";

interface MindmapOperations {
  createChildNode: (nodeId: string) => void;
  duplicateNode: (
    nodeId: string,
    options: {
      includeDescendants: boolean;
    },
  ) => void;
}

interface UseCanvasShortcutsArgs {
  selectedElementIds: Set<string>;
  elements: Map<string, unknown>;
  viewport: {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    fitToContent: () => void;
  };
  withUndo?: (description: string, fn: () => void) => void;
  deleteSelected?: () => void;
  setSelection?: (ids: string[]) => void;
  undo?: () => void;
  redo?: () => void;
  setSelectedTool: (tool: string) => void;
  mindmapOps: MindmapOperations;
}

export const useCanvasShortcuts = ({
  selectedElementIds,
  elements,
  viewport,
  withUndo,
  deleteSelected,
  setSelection,
  undo,
  redo,
  setSelectedTool,
  mindmapOps,
}: UseCanvasShortcutsArgs) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey
      ) {
        if (selectedElementIds.size === 1) {
          const nodeId = Array.from(selectedElementIds)[0];
          const store = useUnifiedCanvasStore.getState();
          const getElement = store.getElement || store.element?.getById;
          const element = getElement?.(nodeId);

          if (element && element.type === "mindmap-node") {
            event.preventDefault();
            mindmapOps.createChildNode(nodeId);
            return;
          }
        }

        if (selectedElementIds.size > 0) {
          event.preventDefault();
          const store = useUnifiedCanvasStore.getState();
          store.setSelection?.([]);
          return;
        }
      }

      if (event.key === "d" || event.key === "D") {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
          if (selectedElementIds.size === 1) {
            const nodeId = Array.from(selectedElementIds)[0];
            const store = useUnifiedCanvasStore.getState();
            const getElement = store.getElement || store.element?.getById;
            const element = getElement?.(nodeId);

            if (element && element.type === "mindmap-node") {
              event.preventDefault();
              mindmapOps.duplicateNode(nodeId, { includeDescendants: true });
              return;
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElementIds, mindmapOps]);

  useKeyboardShortcuts(
    {
      onDelete: () => {
        if (selectedElementIds.size === 0) {
          return;
        }

        if (withUndo && deleteSelected) {
          withUndo("Delete selected elements", () => {
            deleteSelected();
          });
        } else {
          const store = useUnifiedCanvasStore.getState();

          if (store.removeElements) {
            const selectedIds = Array.from(selectedElementIds);
            store.removeElements(selectedIds);
            store.clearSelection?.();
          } else if (store.element?.delete) {
            selectedElementIds.forEach((id) => {
              store.element.delete(id);
            });
            store.clearSelection?.();
          }
        }
      },
      onCopy: () => {
        if (selectedElementIds.size > 0) {
          const elementsToCopy = Array.from(selectedElementIds)
            .map((id) => {
              const store = useUnifiedCanvasStore.getState();
              return store.element?.getById
                ? store.element.getById(id)
                : store.elements?.get(id);
            })
            .filter((el) => el !== undefined);
          if (elementsToCopy.length > 0) {
            clipboard.copy(elementsToCopy);
          }
        }
      },
      onPaste: () => {
        if (!clipboard.hasContent()) {
          return;
        }
        const store = useUnifiedCanvasStore.getState();
        const addElement = store.addElement;
        const selectionSetter = store.selection?.set || store.setSelection;

        if (withUndo && addElement) {
          withUndo("Paste elements", () => {
            const newIds: string[] = [];
            const elementsToCreate = clipboard.paste();
            elementsToCreate.forEach((element: any, index: number) => {
              const clone = { ...element } as any;
              const newId =
                crypto?.randomUUID?.() ??
                `${element.id}-paste-${Date.now()}-${index}`;
              clone.id = newId;

              const offset = 20 + index * 5;
              if (typeof clone.x === "number") clone.x += offset;
              if (typeof clone.y === "number") clone.y += offset;

              if (Array.isArray(clone.points) && clone.points.length >= 2) {
                const shifted: number[] = [];
                for (let i = 0; i < clone.points.length; i += 2) {
                  shifted.push(
                    clone.points[i] + offset,
                    clone.points[i + 1] + offset,
                  );
                }
                clone.points = shifted;
              }

              addElement(clone, { select: true });
              newIds.push(newId);
            });

            if (selectionSetter && newIds.length > 0) {
              selectionSetter(newIds);
            }
          });
        }
      },
      onUndo: () => {
        undo?.();
      },
      onRedo: () => {
        redo?.();
      },
      onSelectAll: () => {
        const allIds = Array.from(elements.keys());
        setSelection?.(allIds);
      },
      onZoomIn: () => {
        viewport.zoomIn();
      },
      onZoomOut: () => {
        viewport.zoomOut();
      },
      onZoomReset: () => {
        viewport.reset();
      },
      onFitToContent: () => {
        viewport.fitToContent();
      },
      onTool: (toolId: string) => {
        setSelectedTool(toolId);
      },
      onDuplicate: () => {
        if (selectedElementIds.size === 1) {
          const nodeId = Array.from(selectedElementIds)[0];
          const store = useUnifiedCanvasStore.getState();
          const getElement = store.getElement || store.element?.getById;
          const element = getElement?.(nodeId);

          if (element && element.type === "mindmap-node") {
            mindmapOps.duplicateNode(nodeId, { includeDescendants: false });
            return;
          }
        }

        if (selectedElementIds.size > 0) {
          const store = useUnifiedCanvasStore.getState();
          const duplicateElement =
            store.duplicateElement || store.element?.duplicate;

          if (withUndo && duplicateElement) {
            withUndo("Duplicate elements", () => {
              selectedElementIds.forEach((id) => {
                duplicateElement(id);
              });
            });
          }
        }
      },
    },
    window,
  );
};

export default useCanvasShortcuts;
