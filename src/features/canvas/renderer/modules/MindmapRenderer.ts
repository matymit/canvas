// Mindmap renderer module for nodes and edges on main layer
// Follows established renderer patterns with vanilla Konva integration
// Refactored to coordinate subsystems: NodeRenderer, EdgeRenderer, EventHandlers, DragLogic

import type Konva from "konva";
import type { RendererLayers } from "../layers";
import type { CanvasElement } from "../../../../../types";
import {
  type MindmapEdgeElement,
  type MindmapNodeElement,
} from "@/features/canvas/types/mindmap";
import type { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import { MindmapNodeRenderer } from "./mindmap/MindmapNodeRenderer";
import { MindmapEdgeRenderer } from "./mindmap/MindmapEdgeRenderer";
import { MindmapEventHandlers } from "./mindmap/MindmapEventHandlers";
import { MindmapDragLogic } from "./mindmap/MindmapDragLogic";
import { normalizeBranchStyle } from "./mindmap/branchStyle";

// Store state interfaces
interface StoreState {
  elements?: Map<string, CanvasElement> | Record<string, CanvasElement>;
  element?: {
    all?: Map<string, CanvasElement> | Record<string, CanvasElement>;
  };
}

interface MindmapEdgeData extends Record<string, unknown> {
  fromId?: string;
  toId?: string;
  style?: Record<string, unknown>;
}

interface MindmapCanvasElement extends CanvasElement {
  data?: MindmapEdgeData;
  fromId?: string;
  toId?: string;
  style?: Record<string, unknown>;
}

export interface MindmapRendererOptions {
  // Performance options
  cacheNodes?: boolean;
  useHighQualityCurves?: boolean;
  edgeSegments?: number;
}

export class MindmapRenderer {
  private readonly layers: RendererLayers;
  private readonly nodeGroups = new Map<string, Konva.Group>();
  private readonly edgeShapes = new Map<string, Konva.Shape>();
  private options: MindmapRendererOptions;
  private readonly store: typeof useUnifiedCanvasStore;
  private liveRoutingPaused = false;

  // Subsystems
  private readonly nodeRenderer: MindmapNodeRenderer;
  private readonly edgeRenderer: MindmapEdgeRenderer;
  private readonly eventHandlers: MindmapEventHandlers;
  private readonly dragLogic: MindmapDragLogic;

  constructor(
    layers: RendererLayers,
    store: typeof useUnifiedCanvasStore,
    options?: MindmapRendererOptions,
  ) {
    this.layers = layers;
    this.store = store;
    this.options = {
      cacheNodes: false,
      useHighQualityCurves: true,
      edgeSegments: 12,
      ...options,
    };

    // Initialize subsystems with callbacks
    this.dragLogic = new MindmapDragLogic(store);

    this.nodeRenderer = new MindmapNodeRenderer(
      layers,
      store,
      this.nodeGroups,
      { cacheNodes: this.options.cacheNodes ?? false },
      (group, node) => this.eventHandlers.bindNodeEvents(group, node),
    );

    this.edgeRenderer = new MindmapEdgeRenderer(
      layers,
      this.edgeShapes,
      { edgeSegments: this.options.edgeSegments ?? 12 },
    );

    this.eventHandlers = new MindmapEventHandlers(
      layers,
      store,
      this.nodeGroups,
      this.dragLogic,
      (elementId) => this.nodeRenderer.lookupNode(elementId),
      (nodeId, getAllEdges, getNodePoint) =>
        this.updateConnectedEdges(nodeId, getAllEdges, getNodePoint),
      () => this.getAllEdges(),
      (id, side) => this.getNodePoint(id, side),
      (style) => this.edgeRenderer.mergeBranchStyle(style),
    );
  }

  public pauseLiveRouting(): void {
    this.liveRoutingPaused = true;
  }

  public resumeLiveRouting(): void {
    this.liveRoutingPaused = false;
  }

  public isLiveRoutingPaused(): boolean {
    return this.liveRoutingPaused;
  }

  /**
   * Render or update a mindmap node on the main layer
   */
  renderNode(element: MindmapNodeElement) {
    this.nodeRenderer.renderNode(element);
  }

  /**
   * Render or update a mindmap edge (branch) on the main layer
   */
  renderEdge(
    element: MindmapEdgeElement,
    getNodePoint: (
      id: string,
      side: "left" | "right",
    ) => { x: number; y: number } | null,
  ) {
    this.edgeRenderer.renderEdge(element, getNodePoint);
  }

  /**
   * Remove a node or edge from the renderer
   */
  remove(elementId: string) {
    // Remove node if exists
    const nodeGroup = this.nodeGroups.get(elementId);
    if (nodeGroup && nodeGroup.getLayer()) {
      nodeGroup.destroy();
      this.nodeGroups.delete(elementId);
    }

    // Remove edge if exists
    const edgeShape = this.edgeShapes.get(elementId);
    if (edgeShape && edgeShape.getLayer()) {
      edgeShape.destroy();
      this.edgeShapes.delete(elementId);
    }

    this.layers.main.batchDraw();
  }

  /**
   * Get a node group by ID (useful for selection/transformer)
   */
  getNodeGroup(elementId: string): Konva.Group | undefined {
    return this.nodeGroups.get(elementId);
  }

  /**
   * Update edge rendering for all edges connected to a specific node
   * Called during node drag/transform operations
   */
  updateConnectedEdges(
    nodeId: string,
    getAllEdges: () => MindmapEdgeElement[],
    getNodePoint: (
      id: string,
      side: "left" | "right",
    ) => { x: number; y: number } | null,
  ) {
    const allEdges = getAllEdges();
    const connectedEdges = allEdges.filter(
      (edge) => edge.fromId === nodeId || edge.toId === nodeId,
    );

    connectedEdges.forEach((edge) => {
      this.edgeRenderer.renderEdge(edge, getNodePoint);
    });
  }

  /**
   * Batch render multiple nodes and edges
   * More efficient than individual renders for initial load or bulk updates
   */
  renderBatch(
    nodes: MindmapNodeElement[],
    edges: MindmapEdgeElement[],
    getNodePoint: (
      id: string,
      side: "left" | "right",
    ) => { x: number; y: number } | null,
  ) {
    // Render all nodes first
    nodes.forEach((node) => {
      this.nodeRenderer.renderNode(node);
    });

    // Then render all edges
    edges.forEach((edge) => {
      this.edgeRenderer.renderEdge(edge, getNodePoint);
    });

    // Single batch draw at the end
    this.layers.main.batchDraw();
  }

  /**
   * Clear all mindmap elements from the renderer
   */
  clear() {
    // Destroy all node groups
    this.nodeGroups.forEach((group) => {
      if (group.getLayer()) {
        group.destroy();
      }
    });
    this.nodeGroups.clear();

    // Destroy all edge shapes
    this.edgeShapes.forEach((shape) => {
      if (shape.getLayer()) {
        shape.destroy();
      }
    });
    this.edgeShapes.clear();

    this.layers.main.batchDraw();
  }

  /**
   * Update renderer options
   */
  updateOptions(newOptions: Partial<MindmapRendererOptions>) {
    this.options = { ...this.options, ...newOptions };
    this.nodeRenderer.updateOptions({
      cacheNodes: this.options.cacheNodes,
    });
    this.edgeRenderer.updateOptions({
      edgeSegments: this.options.edgeSegments,
    });
  }

  /**
   * Get renderer statistics for debugging/monitoring
   */
  getStats() {
    return {
      nodeCount: this.nodeGroups.size,
      edgeCount: this.edgeShapes.size,
      options: { ...this.options },
    };
  }

  // Helper method for getAllEdges callback
  private getAllEdges(): MindmapEdgeElement[] {
    const state = this.store.getState() as StoreState;
    const elements = state.elements ?? state.element?.all;
    if (!elements) return [];

    const elementsMap =
      elements instanceof Map ? elements : new Map(Object.entries(elements));
    const edges: MindmapEdgeElement[] = [];

    elementsMap.forEach((element: CanvasElement) => {
      if (element.type === "mindmap-edge") {
        const mindmapElement = element as MindmapCanvasElement;
        const edgeData = mindmapElement.data as MindmapEdgeData | undefined;

        const edge: MindmapEdgeElement = {
          id: element.id,
          type: "mindmap-edge",
          x: 0,
          y: 0,
          fromId: mindmapElement.fromId ?? edgeData?.fromId ?? "",
          toId: mindmapElement.toId ?? edgeData?.toId ?? "",
          style: this.edgeRenderer.mergeBranchStyle(
            normalizeBranchStyle(mindmapElement.style ?? edgeData?.style),
          ),
        };
        edges.push(edge);
      }
    });

    return edges;
  }

  // Helper method for getNodePoint callback
  private getNodePoint(
    id: string,
    side: "left" | "right",
  ): { x: number; y: number } | null {
    const group = this.nodeGroups.get(id);
    if (!group) return null;

    const x = group.x();
    const y = group.y();
    const width = group.width();
    const height = group.height();

    if (side === "left") {
      return { x, y: y + height / 2 };
    } else {
      return { x: x + width, y: y + height / 2 };
    }
  }
}
