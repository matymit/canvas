// MarqueeSelectionTool.tsx
// Marquee selection for drag-to-select multiple elements

import type React from "react";
import { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
// import { StoreActions } from "../../../stores/facade";
import type { CanvasElement } from "../../../../../../types/index";
import type {
  ConnectorElement,
  ConnectorEndpoint,
} from "../../../types/connector";
import { debug } from "../../../../../utils/debug";

export interface MarqueeSelectionToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

type ConnectorDragBaseline = {
  position: { x: number; y: number };
  from?: ConnectorEndpoint;
  to?: ConnectorEndpoint;
};

const cloneEndpoint = (
  endpoint?: ConnectorEndpoint,
): ConnectorEndpoint | undefined => {
  if (!endpoint) return undefined;
  if (endpoint.kind === "point") {
    return { ...endpoint };
  }
  return {
    ...endpoint,
    offset: endpoint.offset ? { ...endpoint.offset } : undefined,
  };
};

const connectorHasFreeEndpoint = (connector?: ConnectorElement): boolean => {
  if (!connector) return false;
  return connector.from?.kind === "point" || connector.to?.kind === "point";
};

export const MarqueeSelectionTool: React.FC<MarqueeSelectionToolProps> = ({
  stageRef,
  isActive,
}) => {
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const selectedElementIds = useUnifiedCanvasStore(
    (state) => state.selectedElementIds,
  );
  const beginTransform = useUnifiedCanvasStore(
    (state) => state.selection?.beginTransform,
  );
  const endTransform = useUnifiedCanvasStore(
    (state) => state.selection?.endTransform,
  );
  const selectionRef = useRef<string[]>([]);
  const selectedTool = useUnifiedCanvasStore((state) => state.ui?.selectedTool);

  // Keep selectionRef in sync with actual selection state
  useEffect(() => {
    const currentSelected = Array.isArray(selectedElementIds)
      ? selectedElementIds
      : [];
    selectionRef.current = currentSelected;
    debug("[MarqueeSelectionTool] Selection updated", {
      category: "marquee-selection",
      data: {
        newSelection: currentSelected,
        length: currentSelected.length,
        elementIds: currentSelected.slice(0, 5), // Show first 5 IDs to avoid spam
      },
    });
  }, [selectedElementIds]);

  // Track marquee state
  const marqueeRef = useRef<{
    isSelecting: boolean;
    isDragging: boolean;
    startPoint: { x: number; y: number } | null;
    selectionRect: Konva.Rect | null;
    selectedNodes: Konva.Node[];
    basePositions: Map<string, { x: number; y: number }>;
    persistentSelection: string[]; // Add persistent selection state
    originalDraggableStates: Map<string, boolean>; // Track original draggable states
    connectorBaselines: Map<string, ConnectorDragBaseline>;
    transformInitiated: boolean; // Track if transform has been initiated for drag
  }>({
    isSelecting: false,
    isDragging: false,
    startPoint: null,
    selectionRect: null,
    selectedNodes: [],
    basePositions: new Map(),
    persistentSelection: [], // Initialize persistent selection
    originalDraggableStates: new Map(), // Initialize draggable state tracking
    connectorBaselines: new Map(),
    transformInitiated: false, // Initialize transform initiated flag
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive || selectedTool !== "select") return;

    const layers = stage.getLayers();
    const overlayLayer = layers[layers.length - 1] as Konva.Layer; // Overlay layer

    const getWorldPointerPosition = () => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      return transform.point(pointer);
    };

    const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = getWorldPointerPosition();
      if (!pos) return;

      console.log("[MarqueeSelectionTool] onPointerDown", {
        target: e.target.constructor.name,
        targetId: e.target.id(),
        targetElementId: e.target.getAttr?.("elementId"),
        selectionCount: selectionRef.current.length,
        currentSelection: selectionRef.current,
        pos,
      });

      // If clicking on stage (empty canvas), start marquee selection
      if (e.target === stage) {
        // If there's a current selection, clear it immediately on first click
        if (selectionRef.current.length > 0) {
          console.log(
            "[MarqueeSelectionTool] clearing selection on stage click",
          );
          setSelection([]);
          marqueeRef.current.persistentSelection = [];
          return;
        }

        // Otherwise start marquee for multi-select
        console.log("[MarqueeSelectionTool] starting marquee selection");

        // Clear any persistent selection from previous operations
        const hadSelection = marqueeRef.current.persistentSelection.length > 0;
        marqueeRef.current.persistentSelection = [];

        // Notify SelectionModule to clear visual feedback
        if (hadSelection) {
          const selectionModule =
            typeof window !== "undefined"
              ? (window as any).selectionModule
              : undefined;
          if (selectionModule?.clearSelection) {
            console.log(
              "[MarqueeSelectionTool] Clearing selection via SelectionModule",
            );
            selectionModule.clearSelection();
          }
        }

        marqueeRef.current.isSelecting = true;
        marqueeRef.current.startPoint = { x: pos.x, y: pos.y };
        marqueeRef.current.connectorBaselines.clear();

        // Create selection rectangle
        const selectionRect = new Konva.Rect({
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          fill: "rgba(79, 70, 229, 0.1)", // Light blue fill
          stroke: "#4F46E5", // Blue border
          strokeWidth: 1,
          dash: [5, 5],
          listening: false,
          perfectDrawEnabled: false,
          shadowForStrokeEnabled: false,
          name: "marquee-selection",
        });

        marqueeRef.current.selectionRect = selectionRect;
        overlayLayer.add(selectionRect);
        overlayLayer.batchDraw();
        return;
      }

      // Clicking on an element (not stage) - resolve its elementId
      let targetElementId = e.target.getAttr?.("elementId") || e.target.id();
      let currentNode: Konva.Node = e.target;

      console.log(
        "[MarqueeSelectionTool] Click on element - resolving elementId",
        {
          targetType: e.target.constructor.name,
          targetName: e.target.name?.(),
          initialElementId: targetElementId,
          persistentSelectionCount:
            marqueeRef.current.persistentSelection.length,
        },
      );

      // If no elementId found, traverse up to parent groups
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
        targetElementId =
          currentNode.getAttr?.("elementId") || currentNode.id?.();

        traversalSteps.push({
          nodeName: currentNode.constructor.name,
          elementId: currentNode.getAttr?.("elementId"),
          id: currentNode.id?.(),
        });
      }

      console.log("[MarqueeSelectionTool] Element ID resolved", {
        targetElementId,
        traversalSteps,
        hasPersistentSelection:
          marqueeRef.current.persistentSelection.length > 0,
        persistentSelection: marqueeRef.current.persistentSelection.slice(0, 3),
      });

      // Check if we have a persistent selection and if this element is in it
      if (
        targetElementId &&
        marqueeRef.current.persistentSelection.length > 0 &&
        marqueeRef.current.persistentSelection.includes(targetElementId)
      ) {
        console.log("[MarqueeSelectionTool] starting drag on selected element");
        // Start dragging selected elements
        marqueeRef.current.isDragging = true;
        marqueeRef.current.transformInitiated = false; // Reset transform flag for new drag
        marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

        // Get all selected nodes for dragging
        console.log("[MarqueeSelectionTool] Finding nodes for drag", {
          persistentSelectionCount:
            marqueeRef.current.persistentSelection.length,
          persistentSelection: marqueeRef.current.persistentSelection.slice(
            0,
            5,
          ),
          selectionRefCount: selectionRef.current.length,
          selectionRef: selectionRef.current.slice(0, 5),
        });

        const selectedNodes = stage.find<Konva.Node>((node: Konva.Node) => {
          const elementId = node.getAttr("elementId") || node.id();
          // Use persistentSelection instead of selectionRef to ensure consistency
          return (
            elementId &&
            marqueeRef.current.persistentSelection.includes(elementId)
          );
        });

        console.log(
          "[MarqueeSelectionTool] found selected nodes for drag:",
          selectedNodes.length,
        );

        // Enhanced debugging for connectors
        selectedNodes.forEach((node, index) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = elements.get(elementId);
          console.log(`[MarqueeSelectionTool] Selected node ${index}:`, {
            elementId,
            nodeType: node.constructor.name,
            elementType: element?.type,
            position: node.position(),
            draggable: node.draggable(),
          });
        });

        marqueeRef.current.selectedNodes = selectedNodes;
        marqueeRef.current.basePositions.clear();
        marqueeRef.current.connectorBaselines.clear();

        // Store original draggable states and enable dragging for connectors
        const originalDraggableStates = new Map<string, boolean>();

        // Capture base positions
        selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = elements.get(elementId);

          // Store original draggable state and DISABLE Konva's automatic drag system
          // We handle all dragging manually via pointer events to prevent Konva dragstart/dragend interference
          originalDraggableStates.set(elementId, node.draggable());
          node.draggable(false); // Critical: prevents Konva's internal drag lifecycle from firing

          // For connectors and other groups, get the actual position
          // Connectors might not have explicit x,y positioning since they're drawn with points
          let nodePos = node.position();

          // If position is (0,0), this might be a connector group - get position from store instead
          if (nodePos.x === 0 && nodePos.y === 0) {
            const element = elements.get(elementId);
            if (element) {
              if (element.type === "connector") {
                // For connectors, calculate center position from endpoints
                const connectorElement = element as ConnectorElement;
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

                  console.log(
                    "[MarqueeSelectionTool] calculated connector center for drag",
                    {
                      elementId,
                      centerPos: nodePos,
                    },
                  );
                }
              } else if (
                typeof element.x === "number" &&
                typeof element.y === "number"
              ) {
                nodePos = { x: element.x, y: element.y };
                console.log(
                  "[MarqueeSelectionTool] using store position for element",
                  {
                    elementId,
                    storePos: nodePos,
                    konvaPos: node.position(),
                    elementType: element.type,
                  },
                );
              }
            } else {
              console.log(
                "[MarqueeSelectionTool] element not found in store or no position",
                {
                  elementId,
                  hasElement: elements.has(elementId),
                  element: element,
                },
              );
            }
          }

          const connectorElement =
            element?.type === "connector"
              ? (element as ConnectorElement)
              : undefined;
          const connectorIsMovable = connectorHasFreeEndpoint(connectorElement);

          // Store original draggable state (but don't enable - we handle dragging manually via pointer events)
          originalDraggableStates.set(elementId, node.draggable());

          if (connectorElement) {
            if (connectorIsMovable) {
              const storePos = nodePos || { x: 0, y: 0 };
              console.log(
                "[MarqueeSelectionTool] Using connector center as base position",
                {
                  elementId,
                  centerPos: storePos,
                  originalStorePos: {
                    x: connectorElement.x,
                    y: connectorElement.y,
                  },
                },
              );

              marqueeRef.current.connectorBaselines.set(elementId, {
                position: {
                  x: storePos?.x ?? 0,
                  y: storePos?.y ?? 0,
                },
                from: cloneEndpoint(connectorElement.from),
                to: cloneEndpoint(connectorElement.to),
              });

              marqueeRef.current.basePositions.set(elementId, storePos);
            } else {
              console.log(
                `[MarqueeSelectionTool] Connector ${elementId} is fully anchored; skipping baseline capture`,
              );
              marqueeRef.current.connectorBaselines.delete(elementId);
              marqueeRef.current.basePositions.delete(elementId);
            }
          } else {
            const storePos = element ? { x: element.x, y: element.y } : nodePos;
            if (storePos) {
              marqueeRef.current.basePositions.set(elementId, storePos);
            }
          }
        });

        // Store the original draggable states for cleanup
        marqueeRef.current.originalDraggableStates = originalDraggableStates;

        console.log(
          "[MarqueeSelectionTool] captured base positions for drag:",
          Array.from(marqueeRef.current.basePositions.entries()),
        );

        // DON'T call beginTransform here - wait until actual movement starts in onPointerMove
        // This prevents Konva from immediately firing dragend events

        return; // Exit early, we're dragging not selecting
      } else if (targetElementId) {
        // Clicked on an element that's NOT in the persistent selection
        // Clear persistent selection and trigger normal single-element selection
        console.log(
          "[MarqueeSelectionTool] Clicked on non-selected element, clearing persistent selection and selecting clicked element",
          {
            clickedElementId: targetElementId,
            persistentSelection: marqueeRef.current.persistentSelection,
          },
        );

        marqueeRef.current.persistentSelection = [];

        // Trigger SelectionModule to select the clicked element
        // This will show the blue transformer borders
        setSelection([targetElementId]);
        return; // Exit after handling selection
      } else {
        // No elementId found at all (shouldn't happen) - clear any selection
        console.log(
          "[MarqueeSelectionTool] No elementId found for non-stage element, clearing selection",
        );
        marqueeRef.current.persistentSelection = [];
        return; // Exit early
      }
    };

    const onPointerMove = (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (
        !marqueeRef.current.isSelecting ||
        !marqueeRef.current.startPoint ||
        !marqueeRef.current.selectionRect
      )
        return;

      const pos = getWorldPointerPosition();
      if (!pos) return;

      const startPoint = marqueeRef.current.startPoint;
      const rect = marqueeRef.current.selectionRect;

      // Calculate rectangle bounds
      const x1 = Math.min(startPoint.x, pos.x);
      const y1 = Math.min(startPoint.y, pos.y);
      const x2 = Math.max(startPoint.x, pos.x);
      const y2 = Math.max(startPoint.y, pos.y);

      rect.x(x1);
      rect.y(y1);
      rect.width(x2 - x1);
      rect.height(y2 - y1);

      overlayLayer.batchDraw();

      // Check if we're dragging selected elements
      if (
        marqueeRef.current.isDragging &&
        marqueeRef.current.selectedNodes.length > 0
      ) {
        console.log("[MarqueeSelectionTool] dragging elements", {
          nodeCount: marqueeRef.current.selectedNodes.length,
          startPoint: marqueeRef.current.startPoint,
          currentPos: pos,
        });

        // Calculate drag delta from original position
        const dragDelta = {
          dx: pos.x - startPoint.x,
          dy: pos.y - startPoint.y,
        };

        console.log("[MarqueeSelectionTool] drag delta", dragDelta);

        // Call beginTransform on first actual movement (not on click)
        if (
          !marqueeRef.current.transformInitiated &&
          (Math.abs(dragDelta.dx) > 1 || Math.abs(dragDelta.dy) > 1)
        ) {
          console.log(
            "[MarqueeSelectionTool] initiating transform on first movement",
          );
          beginTransform?.();
          marqueeRef.current.transformInitiated = true;
        }

        // Update node positions for live feedback
        marqueeRef.current.selectedNodes.forEach((node, index) => {
          const elementId = node.getAttr("elementId") || node.id();
          const basePos = marqueeRef.current.basePositions.get(elementId);
          if (basePos) {
            const newPos = {
              x: basePos.x + dragDelta.dx,
              y: basePos.y + dragDelta.dy,
            };

            console.log(
              `[MarqueeSelectionTool] Updating node ${index} for element ${elementId}`,
            );

            node.position(newPos);
          }
        });

        // Update element positions in store for connectors/mindmap (without history)
        const store = useUnifiedCanvasStore.getState();
        const movedElementIds = new Set<string>();
        marqueeRef.current.selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = store.elements?.get(elementId);

          if (!store.updateElement) {
            return;
          }

          if (element?.type === "connector") {
            const connectorBaseline =
              marqueeRef.current.connectorBaselines.get(elementId);
            if (!connectorBaseline) {
              console.log(
                `[MarqueeSelectionTool] skipping anchored connector ${elementId} during live drag`,
              );
              return;
            }

            const newStorePos = {
              x: connectorBaseline.position.x + dragDelta.dx,
              y: connectorBaseline.position.y + dragDelta.dy,
            };

            console.log(
              "[MarqueeSelectionTool] updating connector position during drag",
              {
                elementId,
                oldPos: { x: element.x, y: element.y },
                newPos: newStorePos,
                dragDelta,
              },
            );

            const connectorElement = element as ConnectorElement;
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

          const basePos = marqueeRef.current.basePositions.get(elementId);
          if (!basePos) {
            return;
          }

          const newStorePos = {
            x: basePos.x + dragDelta.dx,
            y: basePos.y + dragDelta.dy,
          };

          store.updateElement(elementId, newStorePos, { pushHistory: false });
          movedElementIds.add(elementId);
        });

        // Ask connector manager to refresh connectors attached to moved elements (batched via RAF)
        if (typeof window !== "undefined" && movedElementIds.size > 0) {
          (window as any).connectorSelectionManager?.scheduleRefresh(
            movedElementIds,
          );
        }

        // Redraw relevant layers
        const layers = stage.getLayers();
        const mainLayer = layers[1]; // Main layer is the second layer
        if (mainLayer) mainLayer.batchDraw();
      }
    };

    const onPointerUp = () => {
      const pos = getWorldPointerPosition();
      if (!pos) {
        // Cleanup if no position
        cleanup();
        return;
      }

      // Handle marquee selection completion
      if (
        marqueeRef.current.isSelecting &&
        marqueeRef.current.startPoint &&
        marqueeRef.current.selectionRect
      ) {
        const startPoint = marqueeRef.current.startPoint;

        // Calculate selection rectangle bounds
        const x1 = Math.min(startPoint.x, pos.x);
        const y1 = Math.min(startPoint.y, pos.y);
        const x2 = Math.max(startPoint.x, pos.x);
        const y2 = Math.max(startPoint.y, pos.y);

        const selectionBounds = {
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
        };

        // Only perform selection if the marquee has meaningful size
        if (selectionBounds.width > 5 && selectionBounds.height > 5) {
          console.log("[MarqueeSelectionTool] performing selection in bounds", {
            bounds: selectionBounds,
            area: selectionBounds.width * selectionBounds.height,
          });
          selectElementsInBounds(selectionBounds);

          // Clean up selection rectangle immediately but preserve selection state
          if (marqueeRef.current.selectionRect) {
            marqueeRef.current.selectionRect.destroy();
            overlayLayer.batchDraw();
            marqueeRef.current.selectionRect = null;
          }
          marqueeRef.current.isSelecting = false;
          marqueeRef.current.startPoint = null;
        } else {
          console.log(
            "[MarqueeSelectionTool] marquee too small, not selecting",
          );
          cleanup();
        }
        return; // Exit after handling marquee selection
      }

      // Handle drag completion
      if (
        marqueeRef.current.isDragging &&
        marqueeRef.current.selectedNodes.length > 0 &&
        marqueeRef.current.startPoint
      ) {
        console.log(
          "[MarqueeSelectionTool] *** EXECUTING DRAG COMMIT LOGIC IN onPointerUp ***",
        );

        const startPoint = marqueeRef.current.startPoint;

        // Commit final positions to store with history
        const store = useUnifiedCanvasStore.getState();
        const finalDelta = {
          dx: pos.x - startPoint.x,
          dy: pos.y - startPoint.y,
        };

        // Update elements with history for undo support
        // Separate connectors from regular elements
        const connectorIds = new Set<string>();
        const elementUpdates: Array<{
          id: string;
          patch: Partial<CanvasElement>;
        }> = [];

        console.log(
          "[MarqueeSelectionTool] Processing nodes for final update",
          {
            nodeCount: marqueeRef.current.selectedNodes.length,
            finalDelta,
            hasStore: !!store,
            hasElements: !!store.elements,
          },
        );

        marqueeRef.current.selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = store.elements?.get(elementId);
          const basePos = marqueeRef.current.basePositions.get(elementId);

          console.log("[MarqueeSelectionTool] Processing node for update", {
            elementId,
            elementType: element?.type,
            hasBasePos: !!basePos,
            hasElement: !!element,
          });

          if (element) {
            if (element.type === "connector") {
              const connectorBaseline =
                marqueeRef.current.connectorBaselines.get(elementId);
              if (connectorBaseline) {
                console.log(
                  "[MarqueeSelectionTool] Adding movable connector to connectorIds:",
                  elementId,
                );
                connectorIds.add(elementId);
              } else {
                console.log(
                  "[MarqueeSelectionTool] Skipping anchored connector during commit",
                  { elementId },
                );
              }
            } else if (basePos) {
              // Handle regular elements
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

        // Commit connectors via ConnectorSelectionManager BEFORE endTransform
        if (connectorIds.size > 0) {
          console.log(
            "[MarqueeSelectionTool] Moving selected connectors via ConnectorSelectionManager:",
            {
              connectorCount: connectorIds.size,
              delta: finalDelta,
              connectorIds: Array.from(connectorIds),
            },
          );

          const manager = (window as any).connectorSelectionManager;
          if (manager && typeof manager.moveSelectedConnectors === "function") {
            manager.moveSelectedConnectors(
              connectorIds,
              finalDelta,
              marqueeRef.current.connectorBaselines,
            );
          } else {
            console.warn(
              "[MarqueeSelectionTool] ConnectorSelectionManager not available for connector movement",
            );
          }
        }

        // Restore original draggable states
        marqueeRef.current.selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const originalDraggable =
            marqueeRef.current.originalDraggableStates.get(elementId);
          if (originalDraggable !== undefined) {
            console.log(
              `[MarqueeSelectionTool] Restoring draggable state for ${elementId}: ${originalDraggable}`,
            );
            node.draggable(originalDraggable);
          }
        });

        // End transform only if it was initiated (actual movement occurred)
        // This will finalize the store state but may detach transformer
        if (marqueeRef.current.transformInitiated) {
          endTransform?.();
        }

        // CRITICAL FIX: Re-select elements to re-attach transformer and maintain visual feedback
        // This ensures blue borders persist after drag completion
        const persistentSelection = marqueeRef.current.persistentSelection;
        console.log(
          "[MarqueeSelectionTool] Re-selecting elements to maintain visual feedback",
          {
            persistentSelection,
            count: persistentSelection.length,
          },
        );

        // Use store's setSelection to trigger transformer re-attachment through SelectionModule
        if (persistentSelection.length > 0) {
          // Small delay to ensure endTransform() completes before re-selection
          setTimeout(() => {
            console.log(
              "[MarqueeSelectionTool] Executing delayed setSelection to restore transformer",
            );
            setSelection(persistentSelection);
          }, 10);
        }

        marqueeRef.current.isDragging = false;
        marqueeRef.current.selectedNodes = [];
        marqueeRef.current.basePositions.clear();
        marqueeRef.current.originalDraggableStates.clear();
        marqueeRef.current.connectorBaselines.clear();
      }

      // Don't cleanup immediately here - already handled above with delay
    };

    const cleanup = () => {
      if (marqueeRef.current.selectionRect) {
        marqueeRef.current.selectionRect.destroy();
        overlayLayer.batchDraw();
      }

      marqueeRef.current.isSelecting = false;
      marqueeRef.current.isDragging = false;
      marqueeRef.current.transformInitiated = false;
      marqueeRef.current.startPoint = null;
      marqueeRef.current.selectionRect = null;
      marqueeRef.current.selectedNodes = [];
      marqueeRef.current.basePositions.clear();
      marqueeRef.current.originalDraggableStates.clear();
      marqueeRef.current.connectorBaselines.clear();
      selectionRef.current = [];
    };

    const selectElementsInBounds = (bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }) => {
      const stage = stageRef.current;
      if (!stage) return;

      console.log("[MarqueeSelectionTool] selectElementsInBounds", bounds);

      // Use the modular SelectionModule approach
      const selectionModule =
        typeof window !== "undefined"
          ? (window as any).selectionModule
          : undefined;
      if (selectionModule?.selectElementsInBounds) {
        console.log(
          "[MarqueeSelectionTool] using SelectionModule for marquee selection",
        );
        const selectedIds = selectionModule.selectElementsInBounds(
          stage,
          bounds,
        );
        console.log("[MarqueeSelectionTool] SelectionModule returned", {
          selectedIds,
          length: selectedIds.length,
          elementIds: selectedIds.slice(0, 5), // Show first 5 to avoid spam
        });

        if (selectedIds.length > 0) {
          selectionRef.current = selectedIds;
          marqueeRef.current.persistentSelection = selectedIds; // Store persistent selection

          // Prepare nodes for potential dragging using the controller
          const { nodes, basePositions } =
            selectionModule.marqueeSelectionController?.prepareNodesForDrag?.(
              stage,
              selectedIds,
            ) || { nodes: [], basePositions: new Map() };
          marqueeRef.current.selectedNodes = nodes;
          marqueeRef.current.basePositions = basePositions;

          console.log("[MarqueeSelectionTool] prepared for drag", {
            totalSelected: selectedIds.length,
            nodeCount: nodes.length,
            skippedConnectors: selectedIds.length - nodes.length,
            basePositions: Array.from(basePositions.entries()),
            dragNodeTypes: nodes.map((n: Konva.Node) => ({
              id: n.getAttr("elementId") || n.id(),
              type: n.getAttr("nodeType"),
              position: n.position(),
            })),
          });
        }
        return;
      }

      // Fallback to direct implementation if module not available
      console.log("[MarqueeSelectionTool] using fallback implementation");
      fallbackSelectElementsInBounds(stage, bounds);
    };

    const fallbackSelectElementsInBounds = (
      stage: Konva.Stage,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      // Keep the existing implementation as fallback
      const selectedIdSet = new Set<string>();
      const selectedNodes: Konva.Node[] = [];

      const candidateNodes = stage.find<Konva.Node>((node: Konva.Node) => {
        if (typeof node.getAttr !== "function") return false;
        // Include connectors by id or shapes by elementId
        const elementId = node.getAttr("elementId") || node.id();
        return Boolean(elementId) && elements.has(elementId);
      });

      console.log(
        "[MarqueeSelectionTool] candidateNodes found:",
        candidateNodes.length,
      );

      for (const node of candidateNodes) {
        const elementId = node.getAttr("elementId") || node.id();
        if (!elementId || !elements.has(elementId)) continue;

        const nodeRect = node.getClientRect({
          skipStroke: false,
          skipShadow: true,
        });

        const intersects = !(
          nodeRect.x > bounds.x + bounds.width ||
          nodeRect.x + nodeRect.width < bounds.x ||
          nodeRect.y > bounds.y + bounds.height ||
          nodeRect.y + nodeRect.height < bounds.y
        );

        console.log("[MarqueeSelectionTool] checking node", {
          elementId,
          nodeRect,
          intersects,
          nodeType: node.getAttr("nodeType"),
          elementType: node.getAttr("elementType"),
        });

        if (intersects) {
          selectedIdSet.add(elementId);
          selectedNodes.push(node);
        }
      }

      const selectedIds = Array.from(selectedIdSet);
      console.log("[MarqueeSelectionTool] selected elements:", selectedIds);

      if (selectedIds.length > 0 && setSelection) {
        console.log("[MarqueeSelectionTool] calling setSelection with delay", {
          selectedIds,
          length: selectedIds.length,
        });

        // Try delaying the selection to avoid conflicts with other handlers
        setTimeout(() => {
          console.log("[MarqueeSelectionTool] executing delayed setSelection");
          setSelection(selectedIds);
          selectionRef.current = selectedIds;
        }, 10);

        // Store nodes and base positions for potential dragging
        marqueeRef.current.selectedNodes = selectedNodes;
        marqueeRef.current.persistentSelection = selectedIds; // Store persistent selection for drag detection
        marqueeRef.current.basePositions.clear();

        selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = elements.get(elementId);

          // Skip connectors from position-based dragging
          if (element?.type === "connector") {
            console.log(
              "[MarqueeSelectionTool] skipping connector from drag preparation",
              {
                elementId,
                reason: "connectors use endpoint-based positioning",
              },
            );
            return;
          }

          // For non-connector elements, get the actual position
          let nodePos = node.position();

          console.log("[MarqueeSelectionTool] processing selected node", {
            elementId,
            nodeType: node.getAttr("nodeType"),
            elementType: element?.type,
            konvaPos: nodePos,
            hasInElements: elements.has(elementId),
          });

          // If position is (0,0), this might be a connector group - get position from store instead
          if (nodePos.x === 0 && nodePos.y === 0) {
            const element = elements.get(elementId);
            if (element) {
              if (element.type === "connector") {
                // For connectors, calculate center position from endpoints
                const connectorElement = element as ConnectorElement;
                if (connectorElement.from && connectorElement.to) {
                  // Calculate approximate center of connector for drag purposes
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

                  console.log(
                    "[MarqueeSelectionTool] calculated connector center position",
                    {
                      elementId,
                      from: connectorElement.from,
                      to: connectorElement.to,
                      centerPos: nodePos,
                    },
                  );
                }
              } else if (
                typeof element.x === "number" &&
                typeof element.y === "number"
              ) {
                nodePos = { x: element.x, y: element.y };
                console.log(
                  "[MarqueeSelectionTool] using store position for element in selection",
                  {
                    elementId,
                    storePos: nodePos,
                    konvaPos: node.position(),
                    elementType: element.type,
                  },
                );
              }
            } else {
              console.log(
                "[MarqueeSelectionTool] cannot get position from store",
                {
                  elementId,
                  hasElement: elements.has(elementId),
                  element: element
                    ? {
                        type: (element as CanvasElement).type,
                        x: (element as CanvasElement).x,
                        y: (element as CanvasElement).y,
                      }
                    : null,
                },
              );
            }
          }

          marqueeRef.current.basePositions.set(elementId, {
            x: nodePos.x,
            y: nodePos.y,
          });
        });

        console.log(
          "[MarqueeSelectionTool] stored base positions:",
          Array.from(marqueeRef.current.basePositions.entries()),
        );

        // Notify selection module so it can refresh transformer state / connector overlays
        console.log("[MarqueeSelectionTool] calling bumpSelectionVersion");
        // TEMPORARILY DISABLED: StoreActions.bumpSelectionVersion?.();

        // Add a delay to see if selection gets cleared immediately
        setTimeout(() => {
          const currentStore = useUnifiedCanvasStore.getState();
          console.log("[MarqueeSelectionTool] selection state after 100ms", {
            storeSelection: currentStore.selectedElementIds,
            refSelection: selectionRef.current,
          });
        }, 100);
      }
    };

    // Register event handlers
    stage.on("pointerdown.marquee", onPointerDown);
    stage.on("pointermove.marquee", onPointerMove);
    stage.on("pointerup.marquee", onPointerUp);
    // Note: drag events are now handled within pointer events for better integration

    // Handle escape key to cancel marquee
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && marqueeRef.current.isSelecting) {
        cleanup();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      stage.off("pointerdown.marquee", onPointerDown);
      stage.off("pointermove.marquee", onPointerMove);
      stage.off("pointerup.marquee", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);

      // Cleanup any ongoing marquee
      cleanup();
    };
  }, [
    isActive,
    selectedTool,
    stageRef,
    elements,
    setSelection,
    beginTransform,
    endTransform,
    selectedElementIds,
  ]);

  return null;
};

export default MarqueeSelectionTool;
