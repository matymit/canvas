// Live re-routing integration for drag/transform events
// Provides automatic edge updates when nodes move or transform

import Konva from "konva";
import React from "react";
import type { MindmapEdgeElement, MindmapNodeElement } from "../../types/elements/mindmap";
import { getNodeConnectionPoint } from "../../types/elements/mindmap";
import { MindmapRenderer } from "./MindmapRenderer";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";

export interface MindmapWireOptions {
  // Throttle re-routing for performance during rapid movement
  throttleMs?: number;
  // Only re-route edges connected to specific node types
  nodeFilter?: (nodeId: string) => boolean;
}

/**
 * Wire mindmap live routing to stage events
 * Call this to enable automatic edge re-routing during node drag/transform
 */
export function wireMindmapLiveRouting(
  stage: Konva.Stage, 
  renderer: MindmapRenderer,
  options: MindmapWireOptions = {}
) {
  const { throttleMs = 16, nodeFilter } = options; // 60fps throttling by default
  let throttleTimer: number | null = null;

  // Helper to get all elements from store
  const getAllElements = () => {
    const state = useUnifiedCanvasStore.getState();
    const allElements = state.element?.getAll?.() || 
                       Array.from(state.elements?.values?.() || []);
    return allElements;
  };

  // Helper to get element by ID
  const getElementById = (id: string) => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getById?.(id) || state.elements?.get?.(id);
  };

  // Separate elements by type
  const getElementsByType = () => {
    const allElements = getAllElements();
    const nodes: MindmapNodeElement[] = [];
    const edges: MindmapEdgeElement[] = [];
    
    for (const element of allElements) {
      if (element?.type === "mindmap-node") {
        // Reconstruct mindmap node from CanvasElement data
        const nodeData = {
          ...element,
          text: element.data?.text || "",
          style: element.data?.style || {},
          parentId: element.data?.parentId,
        } as MindmapNodeElement;
        nodes.push(nodeData);
      } else if (element?.type === "mindmap-edge") {
        // Reconstruct mindmap edge from CanvasElement data
        const edgeData = {
          ...element,
          fromId: element.data?.fromId || "",
          toId: element.data?.toId || "",
          style: element.data?.style || {},
        } as MindmapEdgeElement;
        edges.push(edgeData);
      }
    }
    
    return { nodes, edges };
  };

  // Get node center point for routing calculations
  const getNodeCenter = (nodeId: string): { x: number; y: number } | null => {
    const element = getElementById(nodeId);
    if (!element || element.type !== "mindmap-node") return null;
    
    // Reconstruct mindmap node
    const node = {
      ...element,
      text: element.data?.text || "",
      style: element.data?.style || {},
      parentId: element.data?.parentId,
    } as MindmapNodeElement;
    
    return getNodeConnectionPoint(node, 'right'); // Right-side connection for outward flow
  };

  // Throttled re-routing function
  const rerouteConnectedEdges = (movedNodeId?: string) => {
    if (throttleTimer) return;

    throttleTimer = window.setTimeout(() => {
      throttleTimer = null;
      
      try {
        const { edges } = getElementsByType();
        
        // Filter edges that need re-routing
        const edgesToUpdate = movedNodeId 
          ? edges.filter(edge => 
              edge.fromId === movedNodeId || edge.toId === movedNodeId
            )
          : edges;

        // Apply node filter if provided
        const filteredEdges = nodeFilter
          ? edgesToUpdate.filter(edge => 
              nodeFilter(edge.fromId) || nodeFilter(edge.toId)
            )
          : edgesToUpdate;

        // Re-render each affected edge
        filteredEdges.forEach(edge => {
          renderer.renderEdge(edge, getNodeCenter);
        });
      } catch (error) {
        console.warn("Error during mindmap re-routing:", error);
      }
    }, throttleMs);
  };

  // Event handlers
  const handleNodeMove = (e: Konva.KonvaEventObject<DragEvent | Event>) => {
    const target = e.target;
    if (target instanceof Konva.Group && target.name() === "mindmap-node") {
      rerouteConnectedEdges(target.id());
    }
  };

  const handleTransform = (e: Konva.KonvaEventObject<Event>) => {
    const target = e.target;
    if (target instanceof Konva.Group && target.name() === "mindmap-node") {
      rerouteConnectedEdges(target.id());
    }
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const target = e.target;
    if (target instanceof Konva.Group && target.name() === "mindmap-node") {
      // Final re-route with no throttling for accuracy
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }
      rerouteConnectedEdges(target.id());
    }
  };

  // Attach event listeners
  stage.on("dragmove.mindmap-route", handleNodeMove);
  stage.on("transform.mindmap-route", handleTransform);
  stage.on("transformend.mindmap-route", handleTransform);
  stage.on("dragend.mindmap-route", handleDragEnd);

  // Cleanup function
  return () => {
    stage.off("dragmove.mindmap-route");
    stage.off("transform.mindmap-route");
    stage.off("transformend.mindmap-route");
    stage.off("dragend.mindmap-route");
    
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
  };
}

/**
 * Hook for integrating mindmap live routing with React components
 */
export function useMindmapLiveRouting(
  stageRef: React.RefObject<Konva.Stage | null>,
  renderer: MindmapRenderer | null,
  options: MindmapWireOptions = {}
) {
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !renderer) return;

    const cleanup = wireMindmapLiveRouting(stage, renderer, options);
    return cleanup;
  }, [stageRef, renderer, options]);
}

/**
 * Utility to manually trigger edge re-routing
 * Useful for programmatic node updates
 */
export function triggerMindmapReroute(
  renderer: MindmapRenderer,
  nodeId?: string
) {
  const getAllElements = () => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getAll?.() || Array.from(state.elements?.values?.() || []);
  };

  const getElementById = (id: string) => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getById?.(id) || state.elements?.get?.(id);
  };

  const getNodeCenter = (nodeId: string): { x: number; y: number } | null => {
    const element = getElementById(nodeId);
    if (!element || element.type !== "mindmap-node") return null;
    
    const node = {
      ...element,
      text: element.data?.text || "",
      style: element.data?.style || {},
      parentId: element.data?.parentId,
    } as MindmapNodeElement;
    
    return getNodeConnectionPoint(node, 'right');
  };

  const allElements = getAllElements();
  const edges = allElements
    .filter(el => el?.type === "mindmap-edge")
    .map(el => ({
      ...el,
      fromId: el.data?.fromId || "",
      toId: el.data?.toId || "",
      style: el.data?.style || {},
    }) as MindmapEdgeElement);

  const edgesToUpdate = nodeId
    ? edges.filter(edge => edge.fromId === nodeId || edge.toId === nodeId)
    : edges;

  edgesToUpdate.forEach(edge => {
    renderer.renderEdge(edge, getNodeCenter);
  });
}

/**
 * Batch update edges for multiple nodes
 * More efficient than individual updates
 */
export function batchMindmapReroute(
  renderer: MindmapRenderer,
  nodeIds: string[]
) {
  const nodeIdSet = new Set(nodeIds);
  
  const getAllElements = () => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getAll?.() || Array.from(state.elements?.values?.() || []);
  };

  const getElementById = (id: string) => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getById?.(id) || state.elements?.get?.(id);
  };

  const getNodeCenter = (nodeId: string): { x: number; y: number } | null => {
    const element = getElementById(nodeId);
    if (!element || element.type !== "mindmap-node") return null;
    
    const node = {
      ...element,
      text: element.data?.text || "",
      style: element.data?.style || {},
      parentId: element.data?.parentId,
    } as MindmapNodeElement;
    
    return getNodeConnectionPoint(node, 'right');
  };

  const allElements = getAllElements();
  const affectedEdges = allElements
    .filter(el => el?.type === "mindmap-edge")
    .map(el => ({
      ...el,
      fromId: el.data?.fromId || "",
      toId: el.data?.toId || "",
      style: el.data?.style || {},
    }) as MindmapEdgeElement)
    .filter(edge => 
      nodeIdSet.has(edge.fromId) || nodeIdSet.has(edge.toId)
    );

  // Update all affected edges in one batch
  affectedEdges.forEach(edge => {
    renderer.renderEdge(edge, getNodeCenter);
  });
}