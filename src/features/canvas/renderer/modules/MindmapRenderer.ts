// Mindmap renderer module for nodes and edges on main layer
// Follows established renderer patterns with vanilla Konva integration

import Konva from "konva";
import type { RendererLayers } from "../layers";
import type { CanvasElement } from "../../../../../types";
import {
  DEFAULT_BRANCH_STYLE,
  DEFAULT_NODE_STYLE,
  MINDMAP_CONFIG,
  measureMindmapLabel,
  type MindmapEdgeElement,
  type MindmapNodeElement,
  type MindmapNodeStyle,
  type BranchStyle,
} from "@/features/canvas/types/mindmap";
import { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import { openMindmapNodeEditor } from "@/features/canvas/utils/editors/openMindmapNodeEditor";
import { rightwardControls } from "./mindmapRouting";

export interface MindmapRendererOptions {
  // Performance options
  cacheNodes?: boolean;
  useHighQualityCurves?: boolean;
  edgeSegments?: number;
}

export class MindmapRenderer {
  private layers: RendererLayers;
  private nodeGroups = new Map<string, Konva.Group>();
  private edgeShapes = new Map<string, Konva.Shape>();
  private options: MindmapRendererOptions;
  private readonly store: typeof useUnifiedCanvasStore;
  private static readonly HANDLER_FLAG = "__mindmapHandlers";

  constructor(
    layers: RendererLayers,
    store: typeof useUnifiedCanvasStore,
    options?: MindmapRendererOptions
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
    const state = this.store.getState() as any;
    const replace = state.replaceSelectionWithSingle ?? state.selection?.replaceSelectionWithSingle;
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
    const state = this.store.getState() as any;
    const update = state.updateElement ?? state.element?.update;
    if (typeof update === "function") {
      update(elementId, { x, y }, { pushHistory: true });
    }
  }

  private lookupNode(elementId: string): MindmapNodeElement | null {
    const state = this.store.getState() as any;
    const getElement: ((id: string) => CanvasElement | undefined) |
      undefined = state.getElement ?? state.element?.getById;
    const raw = getElement?.(elementId);
    if (!raw || raw.type !== "mindmap-node") return null;

    const style = this.mergeNodeStyle((raw as any).style);
    return {
      id: raw.id,
      type: "mindmap-node",
      x: raw.x ?? 0,
      y: raw.y ?? 0,
      width: raw.width ?? MINDMAP_CONFIG.defaultNodeWidth,
      height: raw.height ?? MINDMAP_CONFIG.defaultNodeHeight,
      text: (raw as any).text ?? (raw as any).data?.text ?? "",
      style,
      parentId: (raw as any).parentId ?? (raw as any).data?.parentId ?? null,
    };
  }

  private bindNodeEvents(group: Konva.Group, node: MindmapNodeElement) {
    if (group.getAttr(MindmapRenderer.HANDLER_FLAG)) return;
    group.setAttr(MindmapRenderer.HANDLER_FLAG, true);
    group.draggable(true);

    const select = (evt: Konva.KonvaEventObject<Event>) => {
      evt.cancelBubble = true;
      this.selectElement(node.id);
    };

    group.on("click", select);
    group.on("tap", select);

    const openEditor = (evt: Konva.KonvaEventObject<Event>) => {
      evt.cancelBubble = true;
      const stage = group.getStage();
      if (!stage) return;
      const latest = this.lookupNode(node.id);
      if (latest) {
        openMindmapNodeEditor(stage, node.id, latest);
      }
    };

    group.on("dblclick", openEditor);
    group.on("dbltap", openEditor as any);

    group.on("dragend", (evt: Konva.KonvaEventObject<DragEvent>) => {
      const target = evt.target as Konva.Group;
      this.updateNodePosition(node.id, target.x(), target.y());
    });
  }

  /**
   * Render or update a mindmap node on the main layer
   */
  renderNode(element: MindmapNodeElement) {
    const style = this.mergeNodeStyle(element.style);
    const metrics = measureMindmapLabel(element.text ?? "", style);
    const contentWidth = Math.max(metrics.width, 1);
    const contentHeight = Math.max(metrics.height, style.fontSize);
    const totalWidth = contentWidth + style.paddingX * 2;
    const totalHeight = contentHeight + style.paddingY * 2;

    const normalized: MindmapNodeElement = {
      ...element,
      style,
      width: totalWidth,
      height: totalHeight,
      textWidth: contentWidth,
      textHeight: contentHeight,
    };

    let group = this.nodeGroups.get(element.id);
    
    // Create group if it doesn't exist or needs recreation
    if (!group || group.getLayer() !== this.layers.main) {
      if (group) {
        group.remove();
        this.nodeGroups.delete(element.id);
      }
      group = new Konva.Group({
        id: element.id,
        name: "mindmap-node",
        x: element.x,
        y: element.y,
        width: totalWidth,
        height: totalHeight,
        listening: true,
        draggable: true,
      });
      
      this.layers.main.add(group);
      this.nodeGroups.set(element.id, group);
    }

    // Update position and size
    group.position({ x: normalized.x, y: normalized.y });
    group.size({ width: totalWidth, height: totalHeight });
    group.draggable(true);
    group.listening(true);

    // Clear previous children and rebuild
    group.destroyChildren();

    // Invisible hit rect for interaction
    const hitRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: totalWidth,
      height: totalHeight,
      cornerRadius: style.cornerRadius,
      fill: "#ffffff",
      opacity: 0.001,
      listening: true,
      perfectDrawEnabled: false,
      name: "node-hit",
    });
    group.add(hitRect);

    // Text content
    const text = new Konva.Text({
      x: style.paddingX,
      y: style.paddingY,
      width: contentWidth,
      height: totalHeight - style.paddingY * 2,
      text: normalized.text ?? "",
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle ?? 'bold',
      fill: style.textColor,
      align: "left",
      verticalAlign: "middle",
      wrap: "word",
      ellipsis: true,
      listening: false,
      perfectDrawEnabled: false,
      name: "node-text",
    });
    group.add(text);

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
    getNodePoint: (id: string, side: 'left' | 'right') => { x: number; y: number } | null
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

    // Get node centers
    const fromCenter = getNodePoint(element.fromId, 'right');
    const toCenter = getNodePoint(element.toId, 'left');
    
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
    shape.sceneFunc((ctx: any, shapeNode: Konva.Shape) => {
      this.drawTaperedBranch(
        ctx,
        shapeNode,
        fromCenter,
        c1,
        c2,
        toCenter,
        widthStart,
        widthEnd,
        color
      );
    });

    this.layers.main.batchDraw();
  }

  /**
   * Draw a tapered branch using the canvas context
   */
  private drawTaperedBranch(
    ctx: any,
    shape: Konva.Shape,
    start: { x: number; y: number },
    c1: { x: number; y: number },
    c2: { x: number; y: number },
    end: { x: number; y: number },
    widthStart: number,
    widthEnd: number,
    color: string
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(widthStart, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    if (widthEnd > 0) {
      ctx.beginPath();
      ctx.arc(end.x, end.y, Math.max(1, widthEnd * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
    ctx.strokeShape(shape);
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
    getNodePoint: (id: string, side: 'left' | 'right') => { x: number; y: number } | null
  ) {
    const allEdges = getAllEdges();
    const connectedEdges = allEdges.filter(
      edge => edge.fromId === nodeId || edge.toId === nodeId
    );

    connectedEdges.forEach(edge => {
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
    getNodePoint: (id: string, side: 'left' | 'right') => { x: number; y: number } | null
  ) {
    // Render all nodes first
    nodes.forEach(node => {
      this.renderNode(node);
    });

    // Then render all edges
    edges.forEach(edge => {
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
    this.nodeGroups.forEach(group => {
      if (group.getLayer()) {
        group.destroy();
      }
    });
    this.nodeGroups.clear();

    // Destroy all edge shapes  
    this.edgeShapes.forEach(shape => {
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
