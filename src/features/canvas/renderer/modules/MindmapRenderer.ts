// Mindmap renderer module for nodes and edges on main layer
// Follows established renderer patterns with vanilla Konva integration

import Konva from "konva";
import type { RendererLayers } from "../layers";
import type { CanvasElement } from "../../../../../types";
import { getTextConfig } from "../../constants/TextConstants";

// Store state interfaces
interface StoreState {
  elements?: Map<string, CanvasElement> | Record<string, CanvasElement>;
  element?: {
    all?: Map<string, CanvasElement> | Record<string, CanvasElement>;
    getById?: (id: string) => CanvasElement | undefined;
    update?: (
      id: string,
      changes: Partial<CanvasElement>,
      options?: { pushHistory?: boolean },
    ) => void;
  };
  selection?: {
    selectOne?: (id: string, additive: boolean) => void;
    replaceSelectionWithSingle?: (id: string) => void;
  };
  history?: {
    withUndo?: (description: string, fn: () => void) => void;
  };
  updateElement?: (
    id: string,
    changes: Partial<CanvasElement>,
    options?: { pushHistory?: boolean },
  ) => void;
  getElement?: (id: string) => CanvasElement | undefined;
  replaceSelectionWithSingle?: (id: string) => void;
}

// Mindmap element interfaces
interface MindmapNodeData extends Record<string, unknown> {
  text?: string;
  parentId?: string | null;
  level?: number;
  color?: string;
  textWidth?: number;
  textHeight?: number;
  style?: MindmapNodeStyle;
}

interface MindmapEdgeData extends Record<string, unknown> {
  fromId?: string;
  toId?: string;
  style?: BranchStyle;
}

interface MindmapCanvasElement extends CanvasElement {
  type: "mindmap-node" | "mindmap-edge";
  text?: string;
  parentId?: string | null;
  level?: number;
  color?: string;
  textWidth?: number;
  textHeight?: number;
  fromId?: string;
  toId?: string;
  data?: MindmapNodeData | MindmapEdgeData;
}
import {
  DEFAULT_BRANCH_STYLE,
  DEFAULT_NODE_STYLE,
  MINDMAP_CONFIG,
  MINDMAP_THEME,
  measureMindmapLabelWithWrap,
  type MindmapEdgeElement,
  type MindmapNodeElement,
  type MindmapNodeStyle,
  type BranchStyle,
} from "@/features/canvas/types/mindmap";
import type { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import { openMindmapNodeEditor } from "@/features/canvas/utils/editors/openMindmapNodeEditor";
import { buildTaperedRibbonPoints, rightwardControls } from "./mindmapRouting";

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
  private static readonly HANDLER_FLAG = "__mindmapHandlers";
  private draggedNodeData: {
    nodeId: string;
    descendants: Set<string>;
    initialPositions: Map<string, { x: number; y: number }>;
  } | null = null;

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
  }

  private mergeNodeStyle(style?: MindmapNodeStyle): MindmapNodeStyle {
    return { ...DEFAULT_NODE_STYLE, ...(style ?? {}) };
  }

  private mergeBranchStyle(style?: BranchStyle): BranchStyle {
    return { ...DEFAULT_BRANCH_STYLE, ...(style ?? {}) };
  }

  private selectElement(elementId: string) {
    const state = this.store.getState() as StoreState;
    const replace =
      state.replaceSelectionWithSingle ??
      state.selection?.replaceSelectionWithSingle;
    if (typeof replace === "function") {
      replace(elementId);
      return;
    }

    const selectOne = state.selection?.selectOne;
    if (typeof selectOne === "function") {
      selectOne(elementId, false);
    }
  }

  private updateNodePosition(elementId: string, x: number, y: number) {
    const state = this.store.getState() as StoreState;
    const update = state.updateElement ?? state.element?.update;
    if (typeof update === "function") {
      update(elementId, { x, y }, { pushHistory: true });
    }
  }

  private updateMultipleNodePositions(
    updates: Map<string, { x: number; y: number }>,
  ) {
    const state = this.store.getState() as StoreState;
    const update = state.updateElement ?? state.element?.update;
    if (typeof update === "function") {
      // Update all nodes in a single history transaction
      const withUndo = state.history?.withUndo;
      if (typeof withUndo === "function") {
        withUndo("Move mindmap nodes", () => {
          updates.forEach((position, nodeId) => {
            update(nodeId, position, { pushHistory: false });
          });
        });
      } else {
        // Fallback if withUndo is not available
        updates.forEach((position, nodeId) => {
          update(nodeId, position, { pushHistory: true });
        });
      }
    }
  }

  private getAllDescendants(nodeId: string): Set<string> {
    const descendants = new Set<string>();
    const state = this.store.getState() as StoreState;
    const elements = state.elements ?? state.element?.all;

    if (!elements) return descendants;

    // Recursive function to find all descendants
    const findDescendants = (parentId: string) => {
      const elementsMap =
        elements instanceof Map ? elements : new Map(Object.entries(elements));
      elementsMap.forEach((element: CanvasElement, id: string) => {
        if (element.type === "mindmap-node") {
          const mindmapElement = element as MindmapCanvasElement;
          const elementParentId =
            mindmapElement.parentId ?? mindmapElement.data?.parentId;
          if (elementParentId === parentId) {
            descendants.add(id);
            // Recursively find descendants of this child
            findDescendants(id);
          }
        }
      });
    };

    findDescendants(nodeId);
    return descendants;
  }

  private lookupNode(elementId: string): MindmapNodeElement | null {
    const state = this.store.getState() as StoreState;
    const getElement: ((id: string) => CanvasElement | undefined) | undefined =
      state.getElement ?? state.element?.getById;
    const raw = getElement?.(elementId);
    if (!raw || raw.type !== "mindmap-node") return null;

    const mindmapElement = raw as MindmapCanvasElement;
    const nodeData = mindmapElement.data as MindmapNodeData | undefined;

    const level =
      mindmapElement.level ??
      nodeData?.level ??
      ((mindmapElement.parentId ?? (nodeData as MindmapNodeData)?.parentId)
        ? 1
        : 0);
    const color =
      mindmapElement.color ??
      nodeData?.color ??
      MINDMAP_THEME.nodeColors[level % MINDMAP_THEME.nodeColors.length];

    const style = this.mergeNodeStyle(
      (mindmapElement.style as MindmapNodeStyle | undefined) ?? nodeData?.style,
    );
    const hydratedStyle: MindmapNodeStyle = {
      ...style,
      fill: style.fill ?? color,
      textColor: style.textColor ?? DEFAULT_NODE_STYLE.textColor,
      fontStyle: style.fontStyle ?? (level === 0 ? "bold" : "normal"),
      // Apply consistent text styling for mindmap nodes
      fontSize:
        style.fontSize ??
        (() => {
          const textConfig = getTextConfig(
            level === 0 ? "MINDMAP_ROOT" : "MINDMAP_CHILD",
          );
          return textConfig.fontSize;
        })(),
      cornerRadius: style.cornerRadius ?? DEFAULT_NODE_STYLE.cornerRadius,
      stroke:
        style.stroke ?? (level === 0 ? "#374151" : DEFAULT_NODE_STYLE.stroke),
      strokeWidth:
        style.strokeWidth ?? (level === 0 ? 2 : DEFAULT_NODE_STYLE.strokeWidth),
      shadowColor: style.shadowColor ?? DEFAULT_NODE_STYLE.shadowColor,
      shadowBlur: style.shadowBlur ?? DEFAULT_NODE_STYLE.shadowBlur,
      shadowOffsetX: style.shadowOffsetX ?? DEFAULT_NODE_STYLE.shadowOffsetX,
      shadowOffsetY: style.shadowOffsetY ?? DEFAULT_NODE_STYLE.shadowOffsetY,
    };
    return {
      id: raw.id,
      type: "mindmap-node",
      x: raw.x ?? 0,
      y: raw.y ?? 0,
      width: raw.width ?? MINDMAP_CONFIG.defaultNodeWidth,
      height: raw.height ?? MINDMAP_CONFIG.defaultNodeHeight,
      text: mindmapElement.text ?? (nodeData as MindmapNodeData)?.text ?? "",
      style: hydratedStyle,
      parentId:
        mindmapElement.parentId ??
        (nodeData as MindmapNodeData)?.parentId ??
        null,
      level,
      color,
      // CRITICAL: Preserve textWidth and textHeight from the raw element
      textWidth:
        mindmapElement.textWidth ?? (nodeData as MindmapNodeData)?.textWidth,
      textHeight:
        mindmapElement.textHeight ?? (nodeData as MindmapNodeData)?.textHeight,
    };
  }

  private bindNodeEvents(group: Konva.Group, node: MindmapNodeElement) {
    if (group.getAttr(MindmapRenderer.HANDLER_FLAG)) return;
    group.setAttr(MindmapRenderer.HANDLER_FLAG, true);

    // Check if pan tool is active - if so, disable dragging on elements
    const storeState = this.store.getState();
    const isPanToolActive = storeState?.ui?.selectedTool === "pan";
    group.draggable(!isPanToolActive);

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
          this.selectElement(node.id);
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
      const latest = this.lookupNode(node.id);
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
      const latest = this.lookupNode(node.id);
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

      // Get all descendants of this node
      const descendants = this.getAllDescendants(node.id);

      // Store initial positions
      const initialPositions = new Map<string, { x: number; y: number }>();

      // Store the dragged node's initial position
      initialPositions.set(node.id, { x: target.x(), y: target.y() });

      // Store descendants' initial positions
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
      this.draggedNodeData = {
        nodeId: node.id,
        descendants,
        initialPositions,
      };
    });

    group.on("dragmove", (evt: Konva.KonvaEventObject<DragEvent>) => {
      if (!this.draggedNodeData) return;

      const target = evt.target as Konva.Group;
      const deltaX =
        target.x() -
        (this.draggedNodeData.initialPositions.get(node.id)?.x ?? 0);
      const deltaY =
        target.y() -
        (this.draggedNodeData.initialPositions.get(node.id)?.y ?? 0);

      // Move all descendant nodes by the same delta
      this.draggedNodeData.descendants.forEach((descendantId) => {
        const descendantGroup = this.nodeGroups.get(descendantId);
        const initialPos =
          this.draggedNodeData?.initialPositions.get(descendantId);

        if (descendantGroup && initialPos) {
          descendantGroup.position({
            x: initialPos.x + deltaX,
            y: initialPos.y + deltaY,
          });
        }
      });

      // Update all connected edges during drag
      const allNodes = new Set([node.id, ...this.draggedNodeData.descendants]);
      allNodes.forEach((nodeId) => {
        this.updateConnectedEdgesForNode(nodeId);
      });

      // Batch draw to update the canvas
      this.layers.main.batchDraw();
    });

    group.on("dragend", (evt: Konva.KonvaEventObject<DragEvent>) => {
      if (!this.draggedNodeData) {
        // Fallback to single node update if no drag data
        const target = evt.target as Konva.Group;
        this.updateNodePosition(node.id, target.x(), target.y());
        return;
      }

      const target = evt.target as Konva.Group;
      const deltaX =
        target.x() -
        (this.draggedNodeData.initialPositions.get(node.id)?.x ?? 0);
      const deltaY =
        target.y() -
        (this.draggedNodeData.initialPositions.get(node.id)?.y ?? 0);

      // Prepare batch update for all moved nodes
      const updates = new Map<string, { x: number; y: number }>();

      // Add the dragged node
      updates.set(node.id, { x: target.x(), y: target.y() });

      // Add all descendants with their new positions
      this.draggedNodeData.descendants.forEach((descendantId) => {
        const initialPos =
          this.draggedNodeData?.initialPositions.get(descendantId);
        if (initialPos) {
          updates.set(descendantId, {
            x: initialPos.x + deltaX,
            y: initialPos.y + deltaY,
          });
        }
      });

      // Update all positions in the store in a single transaction
      this.updateMultipleNodePositions(updates);

      // Clear drag data
      this.draggedNodeData = null;
    });
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
            style: this.mergeBranchStyle(
              (mindmapElement.style as BranchStyle | undefined) ??
                edgeData?.style,
            ),
          };
          edges.push(edge);
        }
      }
    });

    // Helper to get node connection point
    const getNodePoint = (
      id: string,
      side: "left" | "right",
    ): { x: number; y: number } | null => {
      const group = this.nodeGroups.get(id);
      if (!group) return null;

      const width = group.width() ?? 100;
      const height = group.height() ?? 40;
      const x = group.x();
      const y = group.y();

      return side === "left"
        ? { x, y: y + height / 2 }
        : { x: x + width, y: y + height / 2 };
    };

    // Re-render connected edges
    edges.forEach((edge) => {
      this.renderEdge(edge, getNodePoint);
    });
  }

  /**
   * Render or update a mindmap node on the main layer
   */
  renderNode(element: MindmapNodeElement) {
    const style = this.mergeNodeStyle(element.style);

    // Use provided dimensions if they exist (from editor updates), otherwise calculate
    let totalWidth = element.width || MINDMAP_CONFIG.defaultNodeWidth;
    let totalHeight = element.height || MINDMAP_CONFIG.defaultNodeHeight;
    let textWidth = element.textWidth;
    let textHeight = element.textHeight;

    // If dimensions aren't provided, calculate them with wrapping
    if (!textWidth || !textHeight) {
      const maxTextWidth =
        Math.max(MINDMAP_CONFIG.defaultNodeWidth, totalWidth) -
        style.paddingX * 2;
      const metrics = measureMindmapLabelWithWrap(
        element.text ?? "",
        style,
        maxTextWidth,
        MINDMAP_CONFIG.lineHeight,
      );
      textWidth = metrics.width;
      textHeight = metrics.height;
      totalWidth = Math.max(
        textWidth + style.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      );
      totalHeight = Math.max(
        textHeight + style.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      );
    }

    const normalized: MindmapNodeElement = {
      ...element,
      style,
      width: totalWidth,
      height: totalHeight,
      textWidth: textWidth || 1,
      textHeight: textHeight || style.fontSize,
    };

    let group = this.nodeGroups.get(element.id);

    // Create group if it doesn't exist or needs recreation
    if (!group || group.getLayer() !== this.layers.main) {
      if (group) {
        group.remove();
        this.nodeGroups.delete(element.id);
      }
      // Check if pan tool is active - if so, disable dragging on elements
      const storeState = this.store.getState();
      const isPanToolActive = storeState?.ui?.selectedTool === "pan";

      group = new Konva.Group({
        id: element.id,
        name: "mindmap-node",
        x: element.x,
        y: element.y,
        width: totalWidth,
        height: totalHeight,
        listening: true,
        draggable: !isPanToolActive,
      });
      group.setAttr("elementId", element.id);
      group.setAttr("nodeType", "mindmap-node");

      this.layers.main.add(group);
      this.nodeGroups.set(element.id, group);
    }

    // Update position and size
    group.position({ x: normalized.x, y: normalized.y });
    group.size({ width: totalWidth, height: totalHeight });

    // Check if pan tool is active - if so, disable dragging on elements
    const storeState = this.store.getState();
    const isPanToolActive = storeState?.ui?.selectedTool === "pan";
    group.draggable(!isPanToolActive);
    group.listening(true);
    // Ensure the group can receive mouse events
    group.setAttr("cursor", "pointer");

    // Clear previous children and rebuild
    group.destroyChildren();

    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: totalWidth,
      height: totalHeight,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      cornerRadius: style.cornerRadius,
      shadowColor: style.shadowColor,
      shadowBlur: style.shadowBlur,
      shadowOffsetX: style.shadowOffsetX ?? 0,
      shadowOffsetY: style.shadowOffsetY ?? 0,
      listening: false,
      perfectDrawEnabled: false,
      name: "node-bg",
    });
    group.add(background);

    // Determine vertical alignment based on content height
    const contentHeight = totalHeight - style.paddingY * 2;
    const verticalAlign = contentHeight < style.fontSize * 2 ? "middle" : "top";

    const text = new Konva.Text({
      x: style.paddingX,
      y: style.paddingY,
      width: totalWidth - style.paddingX * 2,
      height: totalHeight - style.paddingY * 2,
      text: normalized.text ?? "",
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle ?? "normal",
      fill: style.textColor,
      align: "center",
      verticalAlign: verticalAlign,
      wrap: "word",
      lineHeight: MINDMAP_CONFIG.lineHeight,
      ellipsis: false, // Don't truncate, let it wrap
      listening: false,
      perfectDrawEnabled: false,
      name: "node-text",
    });
    group.add(text);

    // Add an invisible hit area for better event detection
    const hitRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: totalWidth,
      height: totalHeight,
      cornerRadius: style.cornerRadius,
      fill: "transparent",
      listening: true,
      perfectDrawEnabled: false,
      name: "node-hit",
    });
    group.add(hitRect);

    // Optional caching for performance
    if (this.options.cacheNodes) {
      group.cache();
    }

    this.bindNodeEvents(group, normalized);

    this.layers.main.batchDraw();
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
    const style = this.mergeBranchStyle(element.style);

    let shape = this.edgeShapes.get(element.id);

    // Create shape if it doesn't exist or needs recreation
    if (!shape || shape.getLayer() !== this.layers.main) {
      if (shape) {
        shape.remove();
        this.edgeShapes.delete(element.id);
      }
      shape = new Konva.Shape({
        id: element.id,
        name: "mindmap-edge",
        listening: false, // Edges are not interactive
        perfectDrawEnabled: false,
      });

      this.layers.main.add(shape);
      this.edgeShapes.set(element.id, shape);
    } else if (shape.id() !== element.id) {
      shape.id(element.id);
    }
    shape.setAttr("elementId", element.id);
    shape.setAttr("nodeType", "mindmap-edge");

    // Get node centers
    const fromCenter = getNodePoint(element.fromId, "right");
    const toCenter = getNodePoint(element.toId, "left");

    if (!fromCenter || !toCenter) {
      shape.hide();
      return;
    }

    shape.show();

    // Calculate curve geometry
    const { curvature, color, widthStart, widthEnd } = style;
    const k = Math.max(0, Math.min(1, curvature));
    const [c1, c2] = rightwardControls(fromCenter, toCenter, k);

    // Update the shape's rendering function
    shape.sceneFunc((ctx: Konva.Context, shapeNode: Konva.Shape) => {
      this.drawTaperedBranch(
        ctx,
        shapeNode,
        fromCenter,
        c1,
        c2,
        toCenter,
        widthStart,
        widthEnd,
        color,
        this.options.edgeSegments ?? 12,
      );
    });

    this.layers.main.batchDraw();
  }

  /**
   * Draw a tapered branch using the canvas context
   */
  private drawTaperedBranch(
    ctx: Konva.Context,
    shape: Konva.Shape,
    start: { x: number; y: number },
    c1: { x: number; y: number },
    c2: { x: number; y: number },
    end: { x: number; y: number },
    widthStart: number,
    widthEnd: number,
    color: string,
    segments: number,
  ) {
    const ribbon = buildTaperedRibbonPoints(
      start,
      c1,
      c2,
      end,
      widthStart,
      widthEnd,
      segments,
    );
    if (!ribbon.length) return;

    ctx.save();
    ctx.beginPath();
    ribbon.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(end.x, end.y, Math.max(widthEnd, 1) * 0.5 + 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
    ctx.fillStrokeShape(shape);
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
      this.renderEdge(edge, getNodePoint);
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
      this.renderNode(node);
    });

    // Then render all edges
    edges.forEach((edge) => {
      this.renderEdge(edge, getNodePoint);
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
}
