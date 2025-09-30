// useMarqueeDrag.ts
// Element dragging logic for marquee selection tool

import type React from "react";
import type Konva from "konva";
import type { MarqueeState } from "./useMarqueeState";
import type { CanvasElement } from "../../../../../../../types";
import type { ConnectorElement } from "../../../../types/connector";
import { cloneEndpoint, connectorHasFreeEndpoint } from "./useMarqueeState";

export interface MarqueeDragOptions {
  marqueeRef: React.MutableRefObject<MarqueeState>;
  stageRef: React.RefObject<Konva.Stage | null>;
  elements: Map<string, CanvasElement>;
  setSelection: (ids: string[]) => void;
  beginTransform?: () => void;
  endTransform?: () => void;
  getWorldPointerPosition: () => { x: number; y: number } | null;
  useUnifiedCanvasStore: any; // Store hook
}

/**
 * Hook for marquee drag functionality
 * Handles element selection, drag initiation, and drag completion
 */
export const useMarqueeDrag = (options: MarqueeDragOptions) => {
  const {
    marqueeRef,
    elements,
    setSelection,
    beginTransform,
    endTransform,
    getWorldPointerPosition,
    useUnifiedCanvasStore,
  } = options;

  /**
   * Handle element click to start dragging or selection
   * Returns true if drag was initiated, false if selection should happen
   */
  const handleElementClick = (
    target: Konva.Node,
    stage: Konva.Stage,
    pos: { x: number; y: number },
  ): boolean => {
    // Resolve element ID from target
    let targetElementId = target.getAttr?.("elementId") || target.id();
    let currentNode: Konva.Node = target;

    console.log("[MarqueeDrag] Click on element - resolving elementId", {
      targetType: target.constructor.name,
      initialElementId: targetElementId,
      persistentSelectionCount: marqueeRef.current.persistentSelection.length,
    });

    // Traverse up to find elementId if not found
    const traversalSteps: Array<{
      nodeName: string;
      elementId?: string;
      id: string;
    }> = [];
    while (
      !targetElementId &&
      currentNode.getParent &&
      currentNode.getParent() !== stage
    ) {
      const parent = currentNode.getParent();
      if (!parent) break;
      currentNode = parent as Konva.Node;
      targetElementId = currentNode.getAttr?.("elementId") || currentNode.id?.();

      traversalSteps.push({
        nodeName: currentNode.constructor.name,
        elementId: currentNode.getAttr?.("elementId"),
        id: currentNode.id?.(),
      });
    }

    console.log("[MarqueeDrag] Element ID resolved", {
      targetElementId,
      traversalSteps,
      hasPersistentSelection:
        marqueeRef.current.persistentSelection.length > 0,
    });

    // Check if element is in persistent selection - start drag
    if (
      targetElementId &&
      marqueeRef.current.persistentSelection.length > 0 &&
      marqueeRef.current.persistentSelection.includes(targetElementId)
    ) {
      console.log("[MarqueeDrag] starting drag on selected element");
      initiateDrag(stage, pos);
      return true;
    } else if (targetElementId) {
      // Clicked on non-selected element - select it
      console.log("[MarqueeDrag] selecting clicked element", {
        clickedElementId: targetElementId,
      });

      setSelection([targetElementId]);
      marqueeRef.current.persistentSelection = [targetElementId];
      return false;
    }

    // No elementId found - clear selection
    console.log("[MarqueeDrag] No elementId found, clearing selection");
    marqueeRef.current.persistentSelection = [];
    return false;
  };

  /**
   * Initiate drag operation for selected elements
   */
  const initiateDrag = (stage: Konva.Stage, pos: { x: number; y: number }) => {
    marqueeRef.current.isDragging = true;
    marqueeRef.current.transformInitiated = false;
    marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

    console.log("[MarqueeDrag] Finding nodes for drag", {
      persistentSelectionCount: marqueeRef.current.persistentSelection.length,
    });

    // Find all selected nodes
    const selectedNodes = stage.find<Konva.Node>((node: Konva.Node) => {
      const elementId = node.getAttr("elementId") || node.id();
      return (
        elementId &&
        marqueeRef.current.persistentSelection.includes(elementId)
      );
    });

    console.log("[MarqueeDrag] found selected nodes:", selectedNodes.length);

    marqueeRef.current.selectedNodes = selectedNodes;
    marqueeRef.current.basePositions.clear();
    marqueeRef.current.connectorBaselines.clear();

    const originalDraggableStates = new Map<string, boolean>();

    // Capture base positions and setup dragging
    selectedNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      const element = elements.get(elementId);

      // Store original draggable state and disable Konva's drag system
      originalDraggableStates.set(elementId, node.draggable());
      node.draggable(false);

      let nodePos = node.position();

      // Get position from store if Konva position is (0,0)
      if (nodePos.x === 0 && nodePos.y === 0) {
        const element = elements.get(elementId);
        if (element) {
          if ((element as any).type === "connector") {
            const connectorElement = element as unknown as ConnectorElement;
            if (connectorElement.from && connectorElement.to) {
              let fromX = 0,
                fromY = 0,
                toX = 0,
                toY = 0;

              if (connectorElement.from.kind === "point") {
                fromX = connectorElement.from.x;
                fromY = connectorElement.from.y;
              }
              if (connectorElement.to.kind === "point") {
                toX = connectorElement.to.x;
                toY = connectorElement.to.y;
              }

              nodePos = {
                x: (fromX + toX) / 2,
                y: (fromY + toY) / 2,
              };
            }
          } else if (
            typeof element.x === "number" &&
            typeof element.y === "number"
          ) {
            nodePos = { x: element.x, y: element.y };
          }
        }
      }

      const connectorElement =
        (element as any)?.type === "connector"
          ? (element as unknown as ConnectorElement)
          : undefined;
      const connectorIsMovable = connectorHasFreeEndpoint(connectorElement);

      if (connectorElement && connectorIsMovable) {
        const storePos = nodePos || { x: 0, y: 0 };
        marqueeRef.current.connectorBaselines.set(elementId, {
          position: {
            x: storePos?.x ?? 0,
            y: storePos?.y ?? 0,
          },
          from: cloneEndpoint(connectorElement.from),
          to: cloneEndpoint(connectorElement.to),
        });
        marqueeRef.current.basePositions.set(elementId, storePos);
      } else if (connectorElement) {
        // Fully anchored connector - skip
        marqueeRef.current.connectorBaselines.delete(elementId);
        marqueeRef.current.basePositions.delete(elementId);
      } else {
        const storePos = element ? { x: element.x, y: element.y } : nodePos;
        if (storePos) {
          marqueeRef.current.basePositions.set(elementId, storePos);
        }
      }
    });

    // Capture base positions for mindmap descendants
    const mindmapRenderer =
      typeof window !== "undefined" ? (window as any).mindmapRenderer : null;
    if (mindmapRenderer) {
      selectedNodes.forEach((node) => {
        const elementId = node.getAttr("elementId") || node.id();
        const element = elements.get(elementId);

        if (element?.type === "mindmap-node") {
          const descendants = mindmapRenderer.getAllDescendants?.(elementId);
          if (descendants && descendants.size > 0) {
            descendants.forEach((descendantId: string) => {
              const descendantElement = elements.get(descendantId);
              if (descendantElement) {
                const descendantPos = {
                  x: descendantElement.x,
                  y: descendantElement.y,
                };
                marqueeRef.current.basePositions.set(descendantId, descendantPos);
              }
            });
          }
        }
      });
    }

    marqueeRef.current.originalDraggableStates = originalDraggableStates;

    console.log(
      "[MarqueeDrag] captured base positions:",
      Array.from(marqueeRef.current.basePositions.entries()),
    );
  };

  /**
   * Handle drag movement
   */
  const handleDragMove = (stage: Konva.Stage) => {
    if (
      !marqueeRef.current.isDragging ||
      marqueeRef.current.selectedNodes.length === 0 ||
      !marqueeRef.current.startPoint
    ) {
      return;
    }

    const pos = getWorldPointerPosition();
    if (!pos) return;

    const startPoint = marqueeRef.current.startPoint;
    const dragDelta = {
      dx: pos.x - startPoint.x,
      dy: pos.y - startPoint.y,
    };

    // Call beginTransform on first actual movement
    if (
      !marqueeRef.current.transformInitiated &&
      (Math.abs(dragDelta.dx) > 1 || Math.abs(dragDelta.dy) > 1)
    ) {
      console.log("[MarqueeDrag] initiating transform on first movement");
      beginTransform?.();
      marqueeRef.current.transformInitiated = true;
    }

    // Update node positions for live feedback
    marqueeRef.current.selectedNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      const basePos = marqueeRef.current.basePositions.get(elementId);
      if (basePos) {
        const newPos = {
          x: basePos.x + dragDelta.dx,
          y: basePos.y + dragDelta.dy,
        };
        node.position(newPos);
      }
    });

    // Update element positions in store
    const store = useUnifiedCanvasStore.getState();
    const movedElementIds = new Set<string>();

    marqueeRef.current.selectedNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      const element = store.elements?.get(elementId);

      if (!store.updateElement) return;

      // Handle connectors
      if ((element as any)?.type === "connector") {
        const connectorBaseline =
          marqueeRef.current.connectorBaselines.get(elementId);
        if (!connectorBaseline) return;

        const newStorePos = {
          x: connectorBaseline.position.x + dragDelta.dx,
          y: connectorBaseline.position.y + dragDelta.dy,
        };

        const connectorElement = element as unknown as ConnectorElement;
        const connectorPatch: Partial<ConnectorElement> = {
          ...newStorePos,
        };

        const baselineFrom =
          connectorBaseline.from ?? connectorElement.from;
        if (baselineFrom?.kind === "point") {
          connectorPatch.from = {
            ...baselineFrom,
            x: baselineFrom.x + dragDelta.dx,
            y: baselineFrom.y + dragDelta.dy,
          };
        }

        const baselineTo = connectorBaseline.to ?? connectorElement.to;
        if (baselineTo?.kind === "point") {
          connectorPatch.to = {
            ...baselineTo,
            x: baselineTo.x + dragDelta.dx,
            y: baselineTo.y + dragDelta.dy,
          };
        }

        store.updateElement(elementId, connectorPatch, {
          pushHistory: false,
        });
        movedElementIds.add(elementId);
        return;
      }

      // Handle mindmap nodes - move descendants
      if (element?.type === "mindmap-node") {
        const mindmapRenderer =
          typeof window !== "undefined"
            ? (window as any).mindmapRenderer
            : null;
        if (mindmapRenderer) {
          const descendants = mindmapRenderer.getAllDescendants?.(elementId);
          if (descendants && descendants.size > 0) {
            descendants.forEach((descendantId: string) => {
              const descendantGroup =
                mindmapRenderer.nodeGroups?.get(descendantId);
              const descendantBasePos =
                marqueeRef.current.basePositions.get(descendantId);

              if (descendantGroup && descendantBasePos) {
                descendantGroup.position({
                  x: descendantBasePos.x + dragDelta.dx,
                  y: descendantBasePos.y + dragDelta.dy,
                });
              }

              const descendantElement = store.elements?.get(descendantId);
              if (descendantElement && store.updateElement) {
                const descendantStoreBasePos =
                  marqueeRef.current.basePositions.get(descendantId);
                if (descendantStoreBasePos) {
                  store.updateElement(
                    descendantId,
                    {
                      x: descendantStoreBasePos.x + dragDelta.dx,
                      y: descendantStoreBasePos.y + dragDelta.dy,
                    },
                    { pushHistory: false },
                  );
                  movedElementIds.add(descendantId);
                }
              }
            });

            // Update edges
            if (mindmapRenderer.updateConnectedEdgesForNode) {
              const allNodes = new Set([elementId, ...Array.from(descendants)]);
              allNodes.forEach((nodeId: string) => {
                mindmapRenderer.updateConnectedEdgesForNode(nodeId);
              });
            }
          }
        }
      }

      const basePos = marqueeRef.current.basePositions.get(elementId);
      if (!basePos) return;

      const newStorePos = {
        x: basePos.x + dragDelta.dx,
        y: basePos.y + dragDelta.dy,
      };

      store.updateElement(elementId, newStorePos, { pushHistory: false });
      movedElementIds.add(elementId);
    });

    // Refresh connectors attached to moved elements
    if (typeof window !== "undefined" && movedElementIds.size > 0) {
      (window as any).connectorSelectionManager?.scheduleRefresh(
        movedElementIds,
      );
    }

    // Redraw layers
    const layers = stage.getLayers();
    const mainLayer = layers[1];
    if (mainLayer) mainLayer.batchDraw();
  };

  /**
   * Complete drag operation and commit changes
   */
  const handleDragComplete = (pos: { x: number; y: number }) => {
    if (
      !marqueeRef.current.isDragging ||
      marqueeRef.current.selectedNodes.length === 0 ||
      !marqueeRef.current.startPoint
    ) {
      return;
    }

    console.log(
      "[MarqueeDrag] *** EXECUTING DRAG COMMIT LOGIC IN onPointerUp ***",
    );

    const startPoint = marqueeRef.current.startPoint;
    const store = useUnifiedCanvasStore.getState();
    const finalDelta = {
      dx: pos.x - startPoint.x,
      dy: pos.y - startPoint.y,
    };

    // Separate connectors from regular elements
    const connectorIds = new Set<string>();
    const elementUpdates: Array<{
      id: string;
      patch: Partial<CanvasElement>;
    }> = [];

    marqueeRef.current.selectedNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      const element = store.elements?.get(elementId);
      const basePos = marqueeRef.current.basePositions.get(elementId);

      if (element) {
        if ((element as any).type === "connector") {
          const connectorBaseline =
            marqueeRef.current.connectorBaselines.get(elementId);
          if (connectorBaseline) {
            connectorIds.add(elementId);
          }
        } else if (element.type === "mindmap-node") {
          // Commit parent and descendants
          if (basePos) {
            elementUpdates.push({
              id: elementId,
              patch: {
                x: basePos.x + finalDelta.dx,
                y: basePos.y + finalDelta.dy,
              },
            });

            const mindmapRenderer =
              typeof window !== "undefined"
                ? (window as any).mindmapRenderer
                : null;
            if (mindmapRenderer) {
              const descendants =
                mindmapRenderer.getAllDescendants?.(elementId);
              if (descendants && descendants.size > 0) {
                descendants.forEach((descendantId: string) => {
                  const descendantBasePos =
                    marqueeRef.current.basePositions.get(descendantId);
                  if (descendantBasePos) {
                    elementUpdates.push({
                      id: descendantId,
                      patch: {
                        x: descendantBasePos.x + finalDelta.dx,
                        y: descendantBasePos.y + finalDelta.dy,
                      },
                    });
                  }
                });
              }
            }
          }
        } else if (basePos) {
          elementUpdates.push({
            id: elementId,
            patch: {
              x: basePos.x + finalDelta.dx,
              y: basePos.y + finalDelta.dy,
            },
          });
        }
      }
    });

    // Commit non-connector moves with history
    if (elementUpdates.length > 0 && store.updateElements) {
      store.updateElements(elementUpdates, { pushHistory: true });
    }

    // Commit connectors via ConnectorSelectionManager
    if (connectorIds.size > 0) {
      const manager = (window as any).connectorSelectionManager;
      if (manager && typeof manager.moveSelectedConnectors === "function") {
        manager.moveSelectedConnectors(
          connectorIds,
          finalDelta,
          marqueeRef.current.connectorBaselines,
        );
      }
    }

    // Restore original draggable states
    marqueeRef.current.selectedNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      const originalDraggable =
        marqueeRef.current.originalDraggableStates.get(elementId);
      if (originalDraggable !== undefined) {
        node.draggable(originalDraggable);
      }
    });

    // End transform if initiated
    if (marqueeRef.current.transformInitiated) {
      endTransform?.();
    }

    // Re-select elements to maintain visual feedback
    const persistentSelection = marqueeRef.current.persistentSelection;
    if (persistentSelection.length > 0) {
      setTimeout(() => {
        setSelection(persistentSelection);
      }, 10);
    }

    // Cleanup drag state
    marqueeRef.current.isDragging = false;
    marqueeRef.current.selectedNodes = [];
    marqueeRef.current.basePositions.clear();
    marqueeRef.current.originalDraggableStates.clear();
    marqueeRef.current.connectorBaselines.clear();
  };

  return {
    handleElementClick,
    handleDragMove,
    handleDragComplete,
  };
};
