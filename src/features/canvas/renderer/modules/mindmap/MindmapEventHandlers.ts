// MindmapEventHandlers - Event binding for mindmap nodes
// Extracted from MindmapRenderer.ts as part of modularization

import type Konva from "konva";
import type { RendererLayers } from "../../layers";
import type { CanvasElement } from "../../../../../../types";
import type {
  MindmapNodeElement,
  MindmapEdgeElement,
  BranchStyle,
} from "@/features/canvas/types/mindmap";
import type { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import { openMindmapNodeEditor } from "@/features/canvas/utils/editors/openMindmapNodeEditor";
import type { MindmapDragLogic } from "./MindmapDragLogic";
import { normalizeBranchStyle } from "./branchStyle";

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

export class MindmapEventHandlers {
  private readonly layers: RendererLayers;
  private readonly store: typeof useUnifiedCanvasStore;
  private readonly nodeGroups: Map<string, Konva.Group>;
  private readonly dragLogic: MindmapDragLogic;
  private readonly lookupNodeCallback: (elementId: string) => MindmapNodeElement | null;
  private readonly updateConnectedEdgesCallback: (
    nodeId: string,
    getAllEdges: () => MindmapEdgeElement[],
    getNodePoint: (
      id: string,
      side: "left" | "right",
    ) => { x: number; y: number } | null,
  ) => void;
  private readonly getAllEdgesCallback: () => MindmapEdgeElement[];
  private readonly getNodePointCallback: (
    id: string,
    side: "left" | "right",
  ) => { x: number; y: number } | null;
  private readonly mergeBranchStyleCallback: (
    style?: Partial<BranchStyle>,
  ) => BranchStyle;

  private static readonly HANDLER_FLAG = "__mindmapHandlers";

  constructor(
    layers: RendererLayers,
    store: typeof useUnifiedCanvasStore,
    nodeGroups: Map<string, Konva.Group>,
    dragLogic: MindmapDragLogic,
    lookupNodeCallback: (elementId: string) => MindmapNodeElement | null,
    updateConnectedEdgesCallback: (
      nodeId: string,
      getAllEdges: () => MindmapEdgeElement[],
      getNodePoint: (
        id: string,
        side: "left" | "right",
      ) => { x: number; y: number } | null,
    ) => void,
    getAllEdgesCallback: () => MindmapEdgeElement[],
    getNodePointCallback: (
      id: string,
      side: "left" | "right",
    ) => { x: number; y: number } | null,
    mergeBranchStyleCallback: (
      style?: Partial<BranchStyle>,
    ) => BranchStyle,
  ) {
    this.layers = layers;
    this.store = store;
    this.nodeGroups = nodeGroups;
    this.dragLogic = dragLogic;
    this.lookupNodeCallback = lookupNodeCallback;
    this.updateConnectedEdgesCallback = updateConnectedEdgesCallback;
    this.getAllEdgesCallback = getAllEdgesCallback;
    this.getNodePointCallback = getNodePointCallback;
    this.mergeBranchStyleCallback = mergeBranchStyleCallback;
  }

  private updateConnectedEdgesForNode(nodeId: string) {
    // Get all edges from the store
    const state = this.store.getState() as StoreState;
    const elements = state.elements ?? state.element?.all;
    if (!elements) return;

    const elementsMap =
      elements instanceof Map ? elements : new Map(Object.entries(elements));
    const edges: MindmapEdgeElement[] = [];

    elementsMap.forEach((element: CanvasElement) => {
      if (element.type === "mindmap-edge") {
        const mindmapElement = element as MindmapCanvasElement;
        const edgeData = mindmapElement.data as MindmapEdgeData | undefined;

        if (
          mindmapElement.fromId === nodeId ||
          mindmapElement.toId === nodeId ||
          edgeData?.fromId === nodeId ||
          edgeData?.toId === nodeId
        ) {
          const edge: MindmapEdgeElement = {
            id: element.id,
            type: "mindmap-edge",
            x: 0,
            y: 0,
            fromId: mindmapElement.fromId ?? edgeData?.fromId ?? "",
            toId: mindmapElement.toId ?? edgeData?.toId ?? "",
            style: this.mergeBranchStyleCallback(
              normalizeBranchStyle(mindmapElement.style ?? edgeData?.style),
            ),
          };
          edges.push(edge);
        }
      }
    });

    // Re-render connected edges
    edges.forEach(() => {
      this.updateConnectedEdgesCallback(
        nodeId,
        this.getAllEdgesCallback,
        this.getNodePointCallback,
      );
    });
  }

  bindNodeEvents(group: Konva.Group, node: MindmapNodeElement) {
    if (group.getAttr(MindmapEventHandlers.HANDLER_FLAG)) return;
    group.setAttr(MindmapEventHandlers.HANDLER_FLAG, true);

    // Track click timing for double-click vs drag detection
    let lastClickTime = 0;
    let clickTimer: NodeJS.Timeout | null = null;

    const select = (evt: Konva.KonvaEventObject<Event>) => {
      evt.cancelBubble = true;

      // Clear any pending single-click timer
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      // Use a small delay for single click to allow double-click detection
      const now = Date.now();
      const timeSinceLastClick = now - lastClickTime;
      lastClickTime = now;

      // If this is potentially a double-click, don't select immediately
      if (timeSinceLastClick > 300) {
        clickTimer = setTimeout(() => {
          this.dragLogic.selectElement(node.id);
          clickTimer = null;
        }, 250);
      }
    };

    group.on("click", select);
    group.on("tap", select);

    // Double-click to edit text
    group.on("dblclick", (evt: Konva.KonvaEventObject<Event>) => {
      evt.cancelBubble = true;

      // Clear any pending single-click action
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      const stage = group.getStage();
      if (!stage) return;
      const latest = this.lookupNodeCallback(node.id);
      if (latest) {
        openMindmapNodeEditor(stage, node.id, latest);
      }
    });

    // Double-tap for mobile
    group.on("dbltap", (evt: Konva.KonvaEventObject<Event>) => {
      evt.cancelBubble = true;

      // Clear any pending single-click action
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }

      const stage = group.getStage();
      if (!stage) return;
      const latest = this.lookupNodeCallback(node.id);
      if (latest) {
        openMindmapNodeEditor(stage, node.id, latest);
      }
    });

    // Handle drag events for moving subtrees
    group.on("dragstart", (evt: Konva.KonvaEventObject<DragEvent>) => {
      // Clear any pending single-click action when starting drag
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      const target = evt.target as Konva.Group;

      // CRITICAL: Get fresh descendants from store each time, not cached
      // After commit, store is updated and descendants need to be re-queried
      const descendants = this.dragLogic.getAllDescendants(node.id);

      // Store initial positions
      const initialPositions = new Map<string, { x: number; y: number }>();

      // Store the dragged node's initial position
      initialPositions.set(node.id, { x: target.x(), y: target.y() });

      // Store descendants' initial positions from Konva nodes
      descendants.forEach((descendantId) => {
        const descendantGroup = this.nodeGroups.get(descendantId);
        if (descendantGroup) {
          initialPositions.set(descendantId, {
            x: descendantGroup.x(),
            y: descendantGroup.y(),
          });
        }
      });

      // Store drag data
      this.dragLogic.draggedNodeData = {
        nodeId: node.id,
        descendants,
        initialPositions,
      };
    });

    group.on("dragmove", (evt: Konva.KonvaEventObject<DragEvent>) => {
      if (!this.dragLogic.draggedNodeData) return;

      const target = evt.target as Konva.Group;
      const deltaX =
        target.x() -
        (this.dragLogic.draggedNodeData.initialPositions.get(node.id)?.x ?? 0);
      const deltaY =
        target.y() -
        (this.dragLogic.draggedNodeData.initialPositions.get(node.id)?.y ?? 0);

      // Move all descendant nodes by the same delta
      this.dragLogic.draggedNodeData.descendants.forEach((descendantId) => {
        const descendantGroup = this.nodeGroups.get(descendantId);
        const initialPos =
          this.dragLogic.draggedNodeData?.initialPositions.get(descendantId);

        if (descendantGroup && initialPos) {
          descendantGroup.position({
            x: initialPos.x + deltaX,
            y: initialPos.y + deltaY,
          });
        }
      });

      // Update all connected edges during drag
      const allNodes = new Set([
        node.id,
        ...this.dragLogic.draggedNodeData.descendants,
      ]);
      allNodes.forEach((nodeId) => {
        this.updateConnectedEdgesForNode(nodeId);
      });

      // Batch draw to update the canvas
      this.layers.main.batchDraw();
    });

    group.on("dragend", (evt: Konva.KonvaEventObject<DragEvent>) => {
      if (!this.dragLogic.draggedNodeData) {
        // Fallback to single node update if no drag data
        const target = evt.target as Konva.Group;
        this.dragLogic.updateNodePosition(node.id, target.x(), target.y());
        return;
      }

      const target = evt.target as Konva.Group;
      const deltaX =
        target.x() -
        (this.dragLogic.draggedNodeData.initialPositions.get(node.id)?.x ?? 0);
      const deltaY =
        target.y() -
        (this.dragLogic.draggedNodeData.initialPositions.get(node.id)?.y ?? 0);

      // Prepare batch update for all moved nodes
      const updates = new Map<string, { x: number; y: number }>();

      // Add the dragged node
      updates.set(node.id, { x: target.x(), y: target.y() });

      // Add all descendants with their new positions
      this.dragLogic.draggedNodeData.descendants.forEach((descendantId) => {
        const initialPos =
          this.dragLogic.draggedNodeData?.initialPositions.get(descendantId);
        if (initialPos) {
          updates.set(descendantId, {
            x: initialPos.x + deltaX,
            y: initialPos.y + deltaY,
          });
        }
      });

      // Update all positions in the store in a single transaction
      this.dragLogic.updateMultipleNodePositions(updates);

      // Clear drag data
      this.dragLogic.draggedNodeData = null;
    });
  }
}
