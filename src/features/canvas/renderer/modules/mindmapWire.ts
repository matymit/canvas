// Live re-routing integration for drag/transform events
// Provides automatic edge updates when nodes move or transform

import Konva from "konva";
import React from "react";
import type {
  MindmapEdgeElement,
  MindmapNodeElement,
} from "../../types/mindmap";

// Define proper typing for canvas elements that might be mindmap elements
interface CanvasElementWithMindmapData {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  style?: Record<string, unknown>;
  // Mindmap-specific properties that may exist on elements
  data?: {
    style?: Record<string, unknown>;
    text?: string;
    parentId?: string | null;
    fromId?: string;
    toId?: string;
  };
  // Direct properties that may exist
  parentId?: string | null;
  fromId?: string;
  toId?: string;
}
import {
  DEFAULT_BRANCH_STYLE,
  DEFAULT_NODE_STYLE,
  MINDMAP_CONFIG,
  getNodeConnectionPoint,
  measureMindmapLabel,
} from "../../types/mindmap";
import type { MindmapRenderer } from "./MindmapRenderer";
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
  options: MindmapWireOptions = {},
) {
  const { throttleMs = 16, nodeFilter } = options; // 60fps throttling by default
  let throttleTimer: number | null = null;

  // Helper to get all elements from store
  const getAllElements = () => {
    const state = useUnifiedCanvasStore.getState();
    const allElements =
      state.element?.getAll?.() || Array.from(state.elements?.values?.() || []);
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
        const rawStyle = element.style ?? (element as CanvasElementWithMindmapData).data?.style ?? {};
        const style = { ...DEFAULT_NODE_STYLE, ...rawStyle };
        const metrics = measureMindmapLabel(
          element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
          style,
        );
        const nodeData: MindmapNodeElement = {
          id: element.id,
          type: "mindmap-node",
          x: element.x ?? 0,
          y: element.y ?? 0,
          width: Math.max(
            element.width ?? metrics.width + style.paddingX * 2,
            MINDMAP_CONFIG.minNodeWidth,
          ),
          height: Math.max(
            element.height ?? metrics.height + style.paddingY * 2,
            MINDMAP_CONFIG.minNodeHeight,
          ),
          text: element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
          style,
          parentId:
            (element as CanvasElementWithMindmapData).parentId ??
            (element as CanvasElementWithMindmapData).data?.parentId ??
            null,
          textWidth: metrics.width,
          textHeight: metrics.height,
        };
        nodes.push(nodeData);
      } else if (element?.type === "mindmap-edge") {
        const rawStyle = element.style ?? (element as CanvasElementWithMindmapData).data?.style ?? {};
        const style = { ...DEFAULT_BRANCH_STYLE, ...rawStyle };
        const edgeData: MindmapEdgeElement = {
          id: element.id,
          type: "mindmap-edge",
          x: 0,
          y: 0,
          fromId:
            (element as CanvasElementWithMindmapData).fromId ?? (element as CanvasElementWithMindmapData).data?.fromId ?? "",
          toId: (element as CanvasElementWithMindmapData).toId ?? (element as CanvasElementWithMindmapData).data?.toId ?? "",
          style,
        };
        edges.push(edgeData);
      }
    }

    return { nodes, edges };
  };

  // Get node center point for routing calculations
  const getNodePoint = (
    nodeId: string,
    side: "left" | "right",
  ): { x: number; y: number } | null => {
    const element = getElementById(nodeId);
    if (!element || element.type !== "mindmap-node") return null;

    const rawStyle = element.style ?? (element as CanvasElementWithMindmapData).data?.style ?? {};
    const style = { ...DEFAULT_NODE_STYLE, ...rawStyle };
    const metrics = measureMindmapLabel(
      element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
      style,
    );
    const node: MindmapNodeElement = {
      id: element.id,
      type: "mindmap-node",
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: Math.max(
        element.width ?? metrics.width + style.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      ),
      height: Math.max(
        element.height ?? metrics.height + style.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      ),
      text: element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
      style,
      parentId:
        (element as CanvasElementWithMindmapData).parentId ?? (element as CanvasElementWithMindmapData).data?.parentId ?? null,
      textWidth: metrics.width,
      textHeight: metrics.height,
    };

    return getNodeConnectionPoint(node, side);
  };

  // Throttled re-routing function
  const rerouteConnectedEdges = (movedNodeId?: string) => {
    if (typeof renderer.isLiveRoutingPaused === "function" && renderer.isLiveRoutingPaused()) {
      return;
    }
    if (throttleTimer) return;

    throttleTimer = window.setTimeout(() => {
      throttleTimer = null;

      try {
        const { edges } = getElementsByType();

        // Filter edges that need re-routing
        const edgesToUpdate = movedNodeId
          ? edges.filter(
              (edge) =>
                edge.fromId === movedNodeId || edge.toId === movedNodeId,
            )
          : edges;

        // Apply node filter if provided
        const filteredEdges = nodeFilter
          ? edgesToUpdate.filter(
              (edge) => nodeFilter(edge.fromId) || nodeFilter(edge.toId),
            )
          : edgesToUpdate;

        // Re-render each affected edge
        filteredEdges.forEach((edge) => {
          renderer.renderEdge(edge, getNodePoint);
        });
      } catch (error) {
        // Warning: Error during mindmap re-routing: ${error}
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
  options: MindmapWireOptions = {},
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
  nodeId?: string,
) {
  const getAllElements = () => {
    const state = useUnifiedCanvasStore.getState();
    return (
      state.element?.getAll?.() || Array.from(state.elements?.values?.() || [])
    );
  };

  const getElementById = (id: string) => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getById?.(id) || state.elements?.get?.(id);
  };

  const getNodePoint = (
    nodeId: string,
    side: "left" | "right",
  ): { x: number; y: number } | null => {
    const element = getElementById(nodeId);
    if (!element || element.type !== "mindmap-node") return null;

    const rawStyle = element.style ?? (element as CanvasElementWithMindmapData).data?.style ?? {};
    const style = { ...DEFAULT_NODE_STYLE, ...rawStyle };
    const metrics = measureMindmapLabel(
      element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
      style,
    );
    const node: MindmapNodeElement = {
      id: element.id,
      type: "mindmap-node",
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: Math.max(
        element.width ?? metrics.width + style.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      ),
      height: Math.max(
        element.height ?? metrics.height + style.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      ),
      text: element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
      style,
      parentId:
        (element as CanvasElementWithMindmapData).parentId ?? (element as CanvasElementWithMindmapData).data?.parentId ?? null,
      textWidth: metrics.width,
      textHeight: metrics.height,
    };

    return getNodeConnectionPoint(node, side);
  };

  const allElements = getAllElements();
  const edges = allElements
    .filter((el) => el?.type === "mindmap-edge")
    .map(
      (el) =>
        ({
          id: el.id,
          type: "mindmap-edge",
          fromId: (el as CanvasElementWithMindmapData).fromId ?? (el as CanvasElementWithMindmapData).data?.fromId ?? "",
          toId: (el as CanvasElementWithMindmapData).toId ?? (el as CanvasElementWithMindmapData).data?.toId ?? "",
          style: {
            ...DEFAULT_BRANCH_STYLE,
            ...(el.style ?? (el as CanvasElementWithMindmapData).data?.style ?? {}),
          },
        }) as MindmapEdgeElement,
    );

  const edgesToUpdate = nodeId
    ? edges.filter((edge) => edge.fromId === nodeId || edge.toId === nodeId)
    : edges;

  edgesToUpdate.forEach((edge) => {
    renderer.renderEdge(edge, getNodePoint);
  });
}

/**
 * Batch update edges for multiple nodes
 * More efficient than individual updates
 */
export function batchMindmapReroute(
  renderer: MindmapRenderer,
  nodeIds: string[],
) {
  const nodeIdSet = new Set(nodeIds);

  const getAllElements = () => {
    const state = useUnifiedCanvasStore.getState();
    return (
      state.element?.getAll?.() || Array.from(state.elements?.values?.() || [])
    );
  };

  const getElementById = (id: string) => {
    const state = useUnifiedCanvasStore.getState();
    return state.element?.getById?.(id) || state.elements?.get?.(id);
  };

  const getNodePoint = (
    nodeId: string,
    side: "left" | "right",
  ): { x: number; y: number } | null => {
    const element = getElementById(nodeId);
    if (!element || element.type !== "mindmap-node") return null;

    const rawStyle = element.style ?? (element as CanvasElementWithMindmapData).data?.style ?? {};
    const node: MindmapNodeElement = {
      id: element.id,
      type: "mindmap-node",
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: element.width ?? MINDMAP_CONFIG.defaultNodeWidth,
      height: element.height ?? MINDMAP_CONFIG.defaultNodeHeight,
      text: element.text ?? (element as CanvasElementWithMindmapData).data?.text ?? "",
      style: { ...DEFAULT_NODE_STYLE, ...rawStyle },
      parentId:
        (element as CanvasElementWithMindmapData).parentId ?? (element as CanvasElementWithMindmapData).data?.parentId ?? null,
    };

    return getNodeConnectionPoint(node, side);
  };

  const allElements = getAllElements();
  const affectedEdges = allElements
    .filter((el) => el?.type === "mindmap-edge")
    .map(
      (el) =>
        ({
          id: el.id,
          type: "mindmap-edge",
          fromId: (el as CanvasElementWithMindmapData).fromId ?? (el as CanvasElementWithMindmapData).data?.fromId ?? "",
          toId: (el as CanvasElementWithMindmapData).toId ?? (el as CanvasElementWithMindmapData).data?.toId ?? "",
          style: {
            ...DEFAULT_BRANCH_STYLE,
            ...(el.style ?? (el as CanvasElementWithMindmapData).data?.style ?? {}),
          },
        }) as MindmapEdgeElement,
    )
    .filter((edge) => nodeIdSet.has(edge.fromId) || nodeIdSet.has(edge.toId));

  // Update all affected edges in one batch
  affectedEdges.forEach((edge) => {
    renderer.renderEdge(edge, getNodePoint);
  });
}
