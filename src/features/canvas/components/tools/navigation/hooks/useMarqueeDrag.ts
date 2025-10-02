// useMarqueeDrag.ts
// Element dragging logic for marquee selection tool

import type React from "react";
import type Konva from "konva";
import { debug, warn } from "../../../../../../utils/debug";
import type { StoreApi, UseBoundStore } from "zustand";
import type { MarqueeState } from "./useMarqueeState";
import type { CanvasElement } from "../../../../../../../types";
import type {
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorEndpointPoint,
} from "../../../../types/connector";
import type { UnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import type { ConnectorSelectionManager } from "../../../../renderer/modules/selection/managers/ConnectorSelectionManager";
import type { MindmapSelectionManager } from "../../../../renderer/modules/selection/managers/MindmapSelectionManager";
import { cloneEndpoint, connectorHasFreeEndpoint } from "./useMarqueeState";

const isPointEndpoint = (
  endpoint?: ConnectorEndpoint | null,
): endpoint is ConnectorEndpointPoint => endpoint?.kind === "point";

const isConnectorElement = (
  element: CanvasElement,
): element is ConnectorElement =>
  element.type === "connector" && "from" in element && "to" in element;

interface MindmapRendererLike {
  getAllDescendants?: (nodeId: string) => Set<string> | undefined;
}

export interface MarqueeDragOptions {
  marqueeRef: React.MutableRefObject<MarqueeState>;
  stageRef: React.RefObject<Konva.Stage | null>;
  elements: Map<string, CanvasElement>;
  setSelection: (ids: string[]) => void;
  beginTransform?: () => void;
  endTransform?: () => void;
  getWorldPointerPosition: () => { x: number; y: number } | null;
  useUnifiedCanvasStore: UseBoundStore<StoreApi<UnifiedCanvasStore>>;
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
    let currentNode: Konva.Node | null = target;
    let resolvedNode: Konva.Node | null = targetElementId ? target : null;

    debug("MarqueeDrag: resolving elementId", {
      category: "marquee/drag",
      data: {
        targetType: target.constructor.name,
        initialElementId: targetElementId,
        persistentSelectionCount: marqueeRef.current.persistentSelection.length,
      },
    });

    // Traverse up to find elementId if not found
    const traversalSteps: Array<{
      nodeName: string;
      elementId?: string;
      id: string | undefined;
    }> = [];

    while (currentNode && currentNode !== stage) {
      const elementIdAttr = currentNode.getAttr?.("elementId");
      const nodeId = elementIdAttr || currentNode.id?.();

      traversalSteps.push({
        nodeName: currentNode.constructor.name,
        elementId: elementIdAttr,
        id: currentNode.id?.(),
      });

      if (elementIdAttr) {
        targetElementId = elementIdAttr;
        resolvedNode = currentNode;
        break;
      }

      if (!targetElementId && nodeId) {
        targetElementId = nodeId;
        resolvedNode = currentNode;
      }

      const parent = currentNode.getParent?.();
      if (!parent) break;
      currentNode = parent as Konva.Node;
    }

    if (!resolvedNode && targetElementId) {
      const candidate = stage.findOne<Konva.Node>(`[elementId="${targetElementId}"]`) ??
        stage.findOne<Konva.Node>(`#${targetElementId}`) ??
        null;
      resolvedNode = candidate;
    }

    debug("MarqueeDrag: element resolved", {
      category: "marquee/drag",
      data: {
        targetElementId,
        traversalSteps,
        resolvedNodeType: resolvedNode?.constructor.name,
        nodeTypeAttr: resolvedNode?.getAttr?.("nodeType"),
        hasPersistentSelection:
          marqueeRef.current.persistentSelection.length > 0,
      },
    });

    // CRITICAL: Mindmap nodes use native Konva dragging, not MarqueeDrag
    // Check if this is a mindmap node and skip MarqueeDrag handling
    const nodeType = resolvedNode?.getAttr?.("nodeType");
    if (nodeType === "mindmap-node") {
      debug("MarqueeDrag: skipping mindmap node for native Konva drag", {
        category: "marquee/drag",
      });
      // Let Konva's native drag system handle this
      // Don't initiate MarqueeDrag, don't change selection
      return false;
    }

    // Check if element is in persistent selection - start drag
    if (
      targetElementId &&
      marqueeRef.current.persistentSelection.length > 0 &&
      marqueeRef.current.persistentSelection.includes(targetElementId)
    ) {
      debug("MarqueeDrag: starting drag on selected element", {
        category: "marquee/drag",
      });
      initiateDrag(stage, pos);
      return true;
    } else if (targetElementId) {
      // Clicked on non-selected element - select it
      debug("MarqueeDrag: selecting clicked element", {
        category: "marquee/drag",
        data: { clickedElementId: targetElementId },
      });

      setSelection([targetElementId]);
      marqueeRef.current.persistentSelection = [targetElementId];
      return false;
    }

    // No elementId found - clear selection
    debug("MarqueeDrag: no elementId found, clearing selection", {
      category: "marquee/drag",
    });
    marqueeRef.current.persistentSelection = [];
    return false;
  };

  /**
   * Initiate drag operation for selected elements
   */
  const initiateDrag = (stage: Konva.Stage, pos: { x: number; y: number }) => {
    debug("MarqueeDrag: initiating drag", {
      category: "marquee/drag",
      data: {
        currentIsDragging: marqueeRef.current.isDragging,
        persistentSelection: marqueeRef.current.persistentSelection,
        startPos: pos,
      },
    });
    
    marqueeRef.current.isDragging = true;
    marqueeRef.current.transformInitiated = false;
    marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

    debug("MarqueeDrag: finding nodes for drag", {
      category: "marquee/drag",
      data: {
        persistentSelectionCount: marqueeRef.current.persistentSelection.length,
      },
    });

    const originalDraggableStates = new Map<string, boolean>();
    const movableNodes: Konva.Node[] = [];
    marqueeRef.current.basePositions.clear();
    marqueeRef.current.connectorBaselines.clear();
    marqueeRef.current.selectedConnectorIds.clear();
  marqueeRef.current.mindmapDescendantBaselines.clear();
  marqueeRef.current.activeMindmapNodeIds = [];

    const findNodeForElement = (elementId: string): Konva.Node | null => {
      return (
        stage.findOne<Konva.Node>(`[elementId="${elementId}"]`) ??
        stage.findOne<Konva.Node>(`#${elementId}`) ??
        null
      );
    };

    marqueeRef.current.persistentSelection.forEach((elementId) => {
      const element = elements.get(elementId);
      if (!element) {
        return;
      }

      const node = findNodeForElement(elementId);

      if (isConnectorElement(element)) {
        const connectorElement = element;
        const connectorIsMovable = connectorHasFreeEndpoint(connectorElement);

        if (!connectorIsMovable) {
          marqueeRef.current.connectorBaselines.delete(elementId);
          marqueeRef.current.basePositions.delete(elementId);
          return;
        }

        let nodePos = node?.position() ?? { x: 0, y: 0 };

        if (nodePos.x === 0 && nodePos.y === 0) {
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

        const storePos = nodePos || { x: 0, y: 0 };
        const connectorGroup = (() => {
          if (!node) return null;
          const className = typeof node.getClassName === "function"
            ? node.getClassName()
            : undefined;
          if (className === "Group") {
            return node as Konva.Group;
          }
          const parent = node.getParent?.();
          return parent && typeof parent.getClassName === "function" && parent.getClassName() === "Group"
            ? (parent as Konva.Group)
            : null;
        })();

        const connectorShape = connectorGroup?.findOne<Konva.Line | Konva.Arrow>(
          ".connector-shape",
        ) ?? null;

        const baselineFrom = cloneEndpoint(connectorElement.from);
        const baselineTo = cloneEndpoint(connectorElement.to);

        marqueeRef.current.connectorBaselines.set(elementId, {
          position: {
            x: storePos.x ?? 0,
            y: storePos.y ?? 0,
          },
          from: baselineFrom,
          to: baselineTo,
          shape: connectorShape,
          group: connectorGroup,
          startFrom: isPointEndpoint(baselineFrom)
            ? { ...baselineFrom }
            : null,
          startTo: isPointEndpoint(baselineTo)
            ? { ...baselineTo }
            : null,
        });
        marqueeRef.current.basePositions.set(elementId, storePos);
        marqueeRef.current.selectedConnectorIds.add(elementId);
        return;
      }

      if (!node) {
        warn("MarqueeDrag: unable to resolve Konva node for element", {
          category: "marquee/drag",
          data: { elementId },
        });
        return;
      }

      originalDraggableStates.set(elementId, node.draggable());
      node.draggable(false);

      let nodePos = node.position();

      if (nodePos.x === 0 && nodePos.y === 0) {
        nodePos = { x: element.x, y: element.y };
      }

      marqueeRef.current.basePositions.set(elementId, nodePos);
      if (
        element.type === "mindmap-node" &&
        !marqueeRef.current.activeMindmapNodeIds.includes(elementId)
      ) {
        marqueeRef.current.activeMindmapNodeIds.push(elementId);
      }
      movableNodes.push(node);
    });

    marqueeRef.current.selectedNodes = movableNodes;

    // Capture base positions for mindmap descendants
    const mindmapRenderer =
      typeof window !== "undefined" ? window.mindmapRenderer ?? null : null;
    if (mindmapRenderer) {
      movableNodes.forEach((node) => {
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
                marqueeRef.current.mindmapDescendantBaselines.set(
                  descendantId,
                  descendantPos,
                );
              }
            });
          }
        }
      });
    }

    marqueeRef.current.originalDraggableStates = originalDraggableStates;

    debug("MarqueeDrag: captured base positions", {
      category: "marquee/drag",
      data: Array.from(marqueeRef.current.basePositions.entries()),
    });
  };

  /**
   * Handle drag movement
   */
  const handleDragMove = (stage: Konva.Stage) => {
    if (
      !marqueeRef.current.isDragging ||
      !marqueeRef.current.startPoint ||
      (marqueeRef.current.selectedNodes.length === 0 &&
        marqueeRef.current.selectedConnectorIds.size === 0)
    ) {
      debug("MarqueeDrag: handleDragMove blocked", {
        category: "marquee/drag",
        data: {
          isDragging: marqueeRef.current.isDragging,
          selectedNodesLength: marqueeRef.current.selectedNodes.length,
          connectorCount: marqueeRef.current.selectedConnectorIds.size,
          hasStartPoint: !!marqueeRef.current.startPoint,
        },
      });
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
      debug("MarqueeDrag: initiating transform on first movement", {
        category: "marquee/drag",
      });
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
        // Check if node is still in scene graph
        const isAttached = node.getParent() !== null;
        debug("MarqueeDrag: updating node position", {
          category: "marquee/drag",
          data: {
            elementId,
            isAttached,
            parentExists: !!node.getParent(),
            newPos,
          },
        });
        node.position(newPos);
      }
    });

    if (marqueeRef.current.selectedConnectorIds.size > 0) {
      marqueeRef.current.selectedConnectorIds.forEach((connectorId) => {
        const baseline = marqueeRef.current.connectorBaselines.get(connectorId);
        if (!baseline) {
          return;
        }

        if ((!baseline.group || !baseline.shape) && stage) {
          const resolvedNode =
            stage.findOne<Konva.Node>(`[elementId="${connectorId}"]`) ??
            stage.findOne<Konva.Node>(`#${connectorId}`) ??
            null;
          if (resolvedNode) {
            if (!baseline.group) {
              const className = resolvedNode.getClassName?.();
              if (className === "Group") {
                baseline.group = resolvedNode as Konva.Group;
              } else {
                const parent = resolvedNode.getParent?.();
                if (parent && parent.getClassName?.() === "Group") {
                  baseline.group = parent as Konva.Group;
                }
              }
            }
            if (!baseline.shape) {
              const container =
                (baseline.group as unknown as Konva.Container | undefined) ??
                (resolvedNode as unknown as Konva.Container | undefined);
              baseline.shape = container?.findOne<Konva.Line | Konva.Arrow>(
                ".connector-shape",
              ) ?? null;
            }
          }
        }

        if (
          baseline.shape &&
          baseline.startFrom &&
          baseline.startTo &&
          isPointEndpoint(baseline.startFrom) &&
          isPointEndpoint(baseline.startTo)
        ) {
          baseline.shape.points([
            baseline.startFrom.x + dragDelta.dx,
            baseline.startFrom.y + dragDelta.dy,
            baseline.startTo.x + dragDelta.dx,
            baseline.startTo.y + dragDelta.dy,
          ]);
          baseline.shape.getLayer()?.batchDraw();
        } else if (baseline.group) {
          baseline.group.position({
            x: baseline.position.x + dragDelta.dx,
            y: baseline.position.y + dragDelta.dy,
          });
          baseline.group.getLayer()?.batchDraw();
        }
      });
    }

    if (marqueeRef.current.activeMindmapNodeIds.length > 0) {
      const manager =
        typeof window !== "undefined"
          ? window.mindmapSelectionManager ?? null
          : null;
      if (manager?.moveMindmapDescendants) {
        manager.moveMindmapDescendants(
          marqueeRef.current.activeMindmapNodeIds,
          dragDelta,
          marqueeRef.current.mindmapDescendantBaselines,
        );
      }
      manager?.updateEdgeVisuals?.(dragDelta);
    }

    // CRITICAL FIX: DON'T update store during drag!
    // Store updates trigger re-renders that destroy/recreate components
    // which removes event listeners, breaking pointer move events
    // Only update Konva positions visually, commit to store on dragEnd
    
    // Redraw layer to show visual updates
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
      !marqueeRef.current.startPoint ||
      (marqueeRef.current.selectedNodes.length === 0 &&
        marqueeRef.current.selectedConnectorIds.size === 0)
    ) {
      return;
    }

    debug("MarqueeDrag: committing drag operation", {
      category: "marquee/drag",
    });

    const startPoint = marqueeRef.current.startPoint;
    const store = useUnifiedCanvasStore.getState();
    const finalDelta = {
      dx: pos.x - startPoint.x,
      dy: pos.y - startPoint.y,
    };

    // Separate connectors from regular elements
    const elementUpdates: Array<{
      id: string;
      patch: Partial<CanvasElement>;
    }> = [];

    marqueeRef.current.selectedNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      const element = store.elements?.get(elementId);
      const basePos = marqueeRef.current.basePositions.get(elementId);

      if (element) {
        if (element.type === "mindmap-node") {
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
                ? window.mindmapRenderer ?? null
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

    const connectorIds = new Set<string>(
      marqueeRef.current.selectedConnectorIds,
    );

    // Commit non-connector moves with history
    if (elementUpdates.length > 0 && store.updateElements) {
      store.updateElements(elementUpdates, { pushHistory: true });
    }

    // Commit connectors via ConnectorSelectionManager
    if (connectorIds.size > 0) {
      const manager =
        typeof window !== "undefined"
          ? window.connectorSelectionManager
          : undefined;
      if (manager && typeof manager.moveSelectedConnectors === "function") {
        manager.moveSelectedConnectors(
          connectorIds,
          finalDelta,
          marqueeRef.current.connectorBaselines,
        );
      }
    }

    if (marqueeRef.current.activeMindmapNodeIds.length > 0) {
      const mindmapManager =
        typeof window !== "undefined"
          ? window.mindmapSelectionManager ?? null
          : null;
      mindmapManager?.scheduleReroute?.(
        new Set(marqueeRef.current.activeMindmapNodeIds),
      );
    }

    // End transform if initiated
    if (marqueeRef.current.transformInitiated) {
      endTransform?.();
    }

    // CRITICAL: Cleanup drag state BEFORE re-selecting
    // This ensures selectedNodes array is cleared before reconcile creates new nodes
    marqueeRef.current.isDragging = false;
    marqueeRef.current.selectedNodes = []; // Clear stale node references
  marqueeRef.current.selectedConnectorIds.clear();
    marqueeRef.current.basePositions.clear();
    marqueeRef.current.originalDraggableStates.clear();
    marqueeRef.current.connectorBaselines.clear();
  marqueeRef.current.mindmapDescendantBaselines.clear();
  marqueeRef.current.activeMindmapNodeIds = [];

    // Re-select elements to maintain visual feedback
    // This will repopulate selectedNodes with fresh nodes after reconcile
    const persistentSelection = marqueeRef.current.persistentSelection;
    if (persistentSelection.length > 0) {
      setTimeout(() => {
        setSelection(persistentSelection);
      }, 10);
    }
  };

  return {
    handleElementClick,
    handleDragMove,
    handleDragComplete,
  };
};

declare global {
  interface Window {
    connectorSelectionManager?: ConnectorSelectionManager;
    mindmapSelectionManager?: MindmapSelectionManager;
    mindmapRenderer?: MindmapRendererLike;
  }
}
