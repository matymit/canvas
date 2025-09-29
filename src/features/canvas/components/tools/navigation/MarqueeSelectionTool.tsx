// MarqueeSelectionTool.tsx
// Marquee selection for drag-to-select multiple elements

import type React from "react";
import { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
// import { StoreActions } from "../../../stores/facade";
import type { CanvasElement } from "../../../../../../types/index";
import type { ConnectorElement } from "../../../types/connector";

export interface MarqueeSelectionToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

export const MarqueeSelectionTool: React.FC<MarqueeSelectionToolProps> = ({
  stageRef,
  isActive,
}) => {
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const selectedElementIds = useUnifiedCanvasStore((state) => state.selectedElementIds);
  const beginTransform = useUnifiedCanvasStore((state) => state.selection?.beginTransform);
  const endTransform = useUnifiedCanvasStore((state) => state.selection?.endTransform);
  const selectionRef = useRef<string[]>([]);
  const selectedTool = useUnifiedCanvasStore((state) => state.ui?.selectedTool);

  // Keep selectionRef in sync with actual selection state
  useEffect(() => {
    const currentSelected = Array.isArray(selectedElementIds) ? selectedElementIds : [];
    selectionRef.current = currentSelected;
    console.log("[MarqueeSelectionTool] Selection updated", {
      category: "marquee-selection", 
      data: {
        newSelection: currentSelected,
        length: currentSelected.length,
        elementIds: currentSelected.slice(0, 5) // Show first 5 IDs to avoid spam
      }
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
  }>({
    isSelecting: false,
    isDragging: false,
    startPoint: null,
    selectionRect: null,
    selectedNodes: [],
    basePositions: new Map(),
    persistentSelection: [], // Initialize persistent selection
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
        pos
      });

      // Check if clicking on an already selected element to start drag
      if (marqueeRef.current.persistentSelection.length > 0 && e.target !== stage) {
        // Look for elementId on the target or traverse up to parent groups
        let targetElementId = e.target.getAttr?.("elementId") || e.target.id();
        let currentNode: Konva.Node = e.target;
        
        console.log("[MarqueeSelectionTool] Starting drag detection traversal", {
          targetType: e.target.constructor.name,
          targetName: e.target.name?.(),
          initialElementId: targetElementId,
          persistentSelectionCount: marqueeRef.current.persistentSelection.length,
          persistentSelection: marqueeRef.current.persistentSelection.slice(0, 3) // Show first 3
        });
        
        // If no elementId found, check parent groups
        const traversalSteps: Array<{nodeName: string, elementId?: string, id: string}> = [];
        while (!targetElementId && currentNode.getParent && currentNode.getParent() !== stage) {
          const parent = currentNode.getParent();
          if (!parent) break;
          currentNode = parent as Konva.Node;
          targetElementId = currentNode.getAttr?.("elementId") || currentNode.id?.();
          
          traversalSteps.push({
            nodeName: currentNode.constructor.name,
            elementId: currentNode.getAttr?.("elementId"),
            id: currentNode.id?.()
          });
        }
        
        console.log("[MarqueeSelectionTool] checking if target is selected", {
          originalTarget: e.target.constructor.name,
          originalTargetId: e.target.id(),
          originalElementId: e.target.getAttr?.("elementId"),
          finalTarget: currentNode.constructor.name,
          finalTargetId: currentNode.id(),
          targetElementId,
          persistentSelection: marqueeRef.current.persistentSelection.slice(0, 3),
          traversalSteps,
          targetAttrs: {
            name: e.target.name?.(),
            nodeType: e.target.getAttr?.("nodeType"),
            elementType: e.target.getAttr?.("elementType")
          },
          parentInfo: currentNode !== e.target ? {
            parentName: currentNode.name?.(),
            parentNodeType: currentNode.getAttr?.("nodeType"), 
            parentElementType: currentNode.getAttr?.("elementType")
          } : null
        });

        if (targetElementId && marqueeRef.current.persistentSelection.includes(targetElementId)) {
          console.log("[MarqueeSelectionTool] starting drag on selected element");
          // Start dragging selected elements
          marqueeRef.current.isDragging = true;
          marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

          // Get all selected nodes for dragging
          const selectedNodes = stage.find<Konva.Node>((node: Konva.Node) => {
            const elementId = node.getAttr("elementId") || node.id();
            return elementId && selectionRef.current.includes(elementId);
          });

          console.log("[MarqueeSelectionTool] found selected nodes for drag:", selectedNodes.length);

          marqueeRef.current.selectedNodes = selectedNodes;
          marqueeRef.current.basePositions.clear();
          
          // Capture base positions
          selectedNodes.forEach((node) => {
            const elementId = node.getAttr("elementId") || node.id();
            // For connectors and other groups, get the actual position
            // Connectors might not have explicit x,y positioning since they're drawn with points
            let nodePos = node.position();
            
            // If position is (0,0), this might be a connector group - get position from store instead
            if (nodePos.x === 0 && nodePos.y === 0) {
              const element = elements.get(elementId);
              if (element) {
                if (element.type === 'connector') {
                  // For connectors, calculate center position from endpoints
                  const connectorElement = element as ConnectorElement;
                  if (connectorElement.from && connectorElement.to) {
                    let fromX = 0, fromY = 0, toX = 0, toY = 0;
                    
                    if (connectorElement.from.kind === 'point') {
                      fromX = connectorElement.from.x;
                      fromY = connectorElement.from.y;
                    }
                    if (connectorElement.to.kind === 'point') {
                      toX = connectorElement.to.x;
                      toY = connectorElement.to.y;
                    }
                    
                    nodePos = {
                      x: (fromX + toX) / 2,
                      y: (fromY + toY) / 2
                    };
                    
                    console.log("[MarqueeSelectionTool] calculated connector center for drag", {
                      elementId,
                      centerPos: nodePos
                    });
                  }
                } else if (typeof element.x === 'number' && typeof element.y === 'number') {
                  nodePos = { x: element.x, y: element.y };
                  console.log("[MarqueeSelectionTool] using store position for element", {
                    elementId,
                    storePos: nodePos,
                    konvaPos: node.position(),
                    elementType: element.type
                  });
                }
              } else {
                console.log("[MarqueeSelectionTool] element not found in store or no position", {
                  elementId,
                  hasElement: elements.has(elementId),
                  element: element
                });
              }
            }
            
            // Use store position as base, not node position to avoid drift
            const storeElement = elements.get(elementId);
            const storePos = storeElement ? { x: storeElement.x, y: storeElement.y } : nodePos;
            marqueeRef.current.basePositions.set(elementId, storePos);
          });

          console.log("[MarqueeSelectionTool] captured base positions for drag:", Array.from(marqueeRef.current.basePositions.entries()));

          // Initialize transform via store method
          beginTransform?.();

          return; // Exit early, we're dragging not selecting
        }
      }

      // Only start marquee if clicking on empty stage
      if (e.target !== stage) return;

      console.log("[MarqueeSelectionTool] starting marquee selection");

      // Clear any persistent selection from previous operations
      marqueeRef.current.persistentSelection = [];

      marqueeRef.current.isSelecting = true;
      marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

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
    };

    const onPointerMove = (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!marqueeRef.current.isSelecting || !marqueeRef.current.startPoint || !marqueeRef.current.selectionRect) return;

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
      if (marqueeRef.current.isDragging && marqueeRef.current.selectedNodes.length > 0) {
        console.log("[MarqueeSelectionTool] dragging elements", {
          nodeCount: marqueeRef.current.selectedNodes.length,
          startPoint: marqueeRef.current.startPoint,
          currentPos: pos
        });
        
        // Calculate drag delta from original position
        const dragDelta = {
          dx: pos.x - startPoint.x,
          dy: pos.y - startPoint.y,
        };

        console.log("[MarqueeSelectionTool] drag delta", dragDelta);

        // Update node positions for live feedback
        marqueeRef.current.selectedNodes.forEach((node, index) => {
          const elementId = node.getAttr("elementId") || node.id();
          const basePos = marqueeRef.current.basePositions.get(elementId);
          if (basePos) {
            const newPos = {
              x: basePos.x + dragDelta.dx,
              y: basePos.y + dragDelta.dy,
            };
            
            console.log(`[MarqueeSelectionTool] Updating node ${index} for element ${elementId}`);
            
            node.position(newPos);
          }
        });

        // Update element positions in store for connectors/mindmap (without history)
        const store = useUnifiedCanvasStore.getState();
        marqueeRef.current.selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = store.elements?.get(elementId);
          
          // Handle connectors differently - update their center position
          if (element?.type === 'connector') {
            console.log("[MarqueeSelectionTool] skipping connector store update during drag", {
              elementId,
              reason: "connectors will be updated via endpoint rerouting"
            });
            return;
          }
          
          const basePos = marqueeRef.current.basePositions.get(elementId);
          if (basePos && store.updateElement) {
            const newStorePos = {
              x: basePos.x + dragDelta.dx,
              y: basePos.y + dragDelta.dy,
            };
            
            console.log("[MarqueeSelectionTool] updating element in store", {
              elementId,
              basePos,
              newStorePos,
              dragDelta,
              elementType: element?.type
            });
            
            store.updateElement(
              elementId,
              newStorePos,
              { pushHistory: false } // Don't add to undo history during live drag
            );
          }
        });

        // Redraw relevant layers
        const layers = stage.getLayers();
        const mainLayer = layers[1]; // Main layer is the second layer
        if (mainLayer) mainLayer.batchDraw();
      }
    };

    const onPointerUp = () => {
      if (!marqueeRef.current.isSelecting || !marqueeRef.current.startPoint || !marqueeRef.current.selectionRect) return;

      const pos = getWorldPointerPosition();
      if (!pos) {
        // Cleanup if no position
        cleanup();
        return;
      }

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
          area: selectionBounds.width * selectionBounds.height
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
        console.log("[MarqueeSelectionTool] marquee too small, not selecting");
        cleanup();
      }

      // End any active transform
      if (marqueeRef.current.isDragging && marqueeRef.current.selectedNodes.length > 0) {
        // Commit final positions to store with history
        const store = useUnifiedCanvasStore.getState();
        const finalDelta = {
          dx: pos.x - startPoint.x,
          dy: pos.y - startPoint.y,
        };

        // Update elements with history for undo support
        const elementUpdates: Array<{ id: string; patch: Partial<CanvasElement> }> = [];
        marqueeRef.current.selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = store.elements?.get(elementId);
          const basePos = marqueeRef.current.basePositions.get(elementId);
          
          if (basePos && element) {
            // Skip connectors - they will be handled by ConnectorSelectionManager
            if (element.type === 'connector') {
              return;
            }
            
            elementUpdates.push({
              id: elementId,
              patch: {
                x: basePos.x + finalDelta.dx,
                y: basePos.y + finalDelta.dy,
              },
            });
          }
        });

        if (elementUpdates.length > 0 && store.updateElements) {
          store.updateElements(elementUpdates, { pushHistory: true });
        }

        // End transform
        endTransform?.();
        
        marqueeRef.current.isDragging = false;
        marqueeRef.current.selectedNodes = [];
        marqueeRef.current.basePositions.clear();
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
      marqueeRef.current.startPoint = null;
      marqueeRef.current.selectionRect = null;
      marqueeRef.current.selectedNodes = [];
      marqueeRef.current.basePositions.clear();
      selectionRef.current = [];
    };

    const selectElementsInBounds = (bounds: { x: number; y: number; width: number; height: number }) => {
      const stage = stageRef.current;
      if (!stage) return;

      console.log("[MarqueeSelectionTool] selectElementsInBounds", bounds);

      // Use the modular SelectionModule approach
      const selectionModule = typeof window !== "undefined" ? (window as any).selectionModule : undefined;
      if (selectionModule?.selectElementsInBounds) {
        console.log("[MarqueeSelectionTool] using SelectionModule for marquee selection");
        const selectedIds = selectionModule.selectElementsInBounds(stage, bounds);
        console.log("[MarqueeSelectionTool] SelectionModule returned", {
          selectedIds,
          length: selectedIds.length,
          elementIds: selectedIds.slice(0, 5) // Show first 5 to avoid spam
        });
        
        if (selectedIds.length > 0) {
          selectionRef.current = selectedIds;
          marqueeRef.current.persistentSelection = selectedIds; // Store persistent selection
          
          // Prepare nodes for potential dragging using the controller
          const { nodes, basePositions } = selectionModule.marqueeSelectionController?.prepareNodesForDrag?.(stage, selectedIds) || { nodes: [], basePositions: new Map() };
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
              position: n.position()
            }))
          });
        }
        return;
      }

      // Fallback to direct implementation if module not available
      console.log("[MarqueeSelectionTool] using fallback implementation");
      fallbackSelectElementsInBounds(stage, bounds);
    };

    const fallbackSelectElementsInBounds = (stage: Konva.Stage, bounds: { x: number; y: number; width: number; height: number }) => {
      // Keep the existing implementation as fallback
      const selectedIdSet = new Set<string>();
      const selectedNodes: Konva.Node[] = [];

      const candidateNodes = stage.find<Konva.Node>((node: Konva.Node) => {
        if (typeof node.getAttr !== "function") return false;
        return Boolean(node.getAttr("elementId"));
      });

      console.log("[MarqueeSelectionTool] candidateNodes found:", candidateNodes.length);

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
          elementType: node.getAttr("elementType")
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
          length: selectedIds.length
        });
        
        // Try delaying the selection to avoid conflicts with other handlers
        setTimeout(() => {
          console.log("[MarqueeSelectionTool] executing delayed setSelection");
          setSelection(selectedIds);
          selectionRef.current = selectedIds;
        }, 10);

        // Store nodes and base positions for potential dragging
        marqueeRef.current.selectedNodes = selectedNodes;
        marqueeRef.current.basePositions.clear();
        
        selectedNodes.forEach((node) => {
          const elementId = node.getAttr("elementId") || node.id();
          const element = elements.get(elementId);
          
          // Skip connectors from position-based dragging
          if (element?.type === 'connector') {
            console.log("[MarqueeSelectionTool] skipping connector from drag preparation", {
              elementId,
              reason: "connectors use endpoint-based positioning"
            });
            return;
          }
          
          // For non-connector elements, get the actual position
          let nodePos = node.position();
          
          console.log("[MarqueeSelectionTool] processing selected node", {
            elementId,
            nodeType: node.getAttr("nodeType"),
            elementType: element?.type,
            konvaPos: nodePos,
            hasInElements: elements.has(elementId)
          });
          
          // If position is (0,0), this might be a connector group - get position from store instead
          if (nodePos.x === 0 && nodePos.y === 0) {
            const element = elements.get(elementId);
            if (element) {
              if (element.type === 'connector') {
                // For connectors, calculate center position from endpoints
                const connectorElement = element as ConnectorElement;
                if (connectorElement.from && connectorElement.to) {
                  // Calculate approximate center of connector for drag purposes
                  let fromX = 0, fromY = 0, toX = 0, toY = 0;
                  
                  if (connectorElement.from.kind === 'point') {
                    fromX = connectorElement.from.x;
                    fromY = connectorElement.from.y;
                  }
                  if (connectorElement.to.kind === 'point') {
                    toX = connectorElement.to.x;
                    toY = connectorElement.to.y;
                  }
                  
                  nodePos = {
                    x: (fromX + toX) / 2,
                    y: (fromY + toY) / 2
                  };
                  
                  console.log("[MarqueeSelectionTool] calculated connector center position", {
                    elementId,
                    from: connectorElement.from,
                    to: connectorElement.to,
                    centerPos: nodePos
                  });
                }
              } else if (typeof element.x === 'number' && typeof element.y === 'number') {
                nodePos = { x: element.x, y: element.y };
                console.log("[MarqueeSelectionTool] using store position for element in selection", {
                  elementId,
                  storePos: nodePos,
                  konvaPos: node.position(),
                  elementType: element.type
                });
              }
            } else {
              console.log("[MarqueeSelectionTool] cannot get position from store", {
                elementId,
                hasElement: elements.has(elementId),
                element: element ? { 
                  type: (element as CanvasElement).type, 
                  x: (element as CanvasElement).x, 
                  y: (element as CanvasElement).y 
                } : null
              });
            }
          }
          
          marqueeRef.current.basePositions.set(elementId, { x: nodePos.x, y: nodePos.y });
        });

        console.log("[MarqueeSelectionTool] stored base positions:", Array.from(marqueeRef.current.basePositions.entries()));

        // Notify selection module so it can refresh transformer state / connector overlays
        console.log("[MarqueeSelectionTool] calling bumpSelectionVersion");
        // TEMPORARILY DISABLED: StoreActions.bumpSelectionVersion?.();
        
        // Add a delay to see if selection gets cleared immediately
        setTimeout(() => {
          const currentStore = useUnifiedCanvasStore.getState();
          console.log("[MarqueeSelectionTool] selection state after 100ms", {
            storeSelection: currentStore.selectedElementIds,
            refSelection: selectionRef.current
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
  }, [isActive, selectedTool, stageRef, elements, setSelection, beginTransform, endTransform, selectedElementIds]);

  return null;
};

export default MarqueeSelectionTool;
