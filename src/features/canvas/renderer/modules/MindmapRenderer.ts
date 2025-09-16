// Mindmap renderer module for nodes and edges on main layer
// Follows established renderer patterns with vanilla Konva integration

import Konva from "konva";
import type { MindmapNodeElement, MindmapEdgeElement } from "../../types/elements/mindmap";
import { rightwardControls, buildTaperedRibbonPoints } from "./mindmapRouting";

// Re-use existing RendererLayers interface
export interface RendererLayers { 
  background: Konva.Layer; 
  main: Konva.Layer; 
  preview: Konva.Layer; 
  overlay: Konva.Layer; 
}

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

  constructor(layers: RendererLayers, options?: MindmapRendererOptions) {
    this.layers = layers;
    this.options = {
      cacheNodes: false,
      useHighQualityCurves: true,
      edgeSegments: 12,
      ...options,
    };
  }

  /**
   * Render or update a mindmap node on the main layer
   */
  renderNode(element: MindmapNodeElement) {
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
        width: element.width,
        height: element.height,
        listening: true, // Enable selection and dragging
      });
      
      this.layers.main.add(group);
      this.nodeGroups.set(element.id, group);
    }

    // Update position and size
    group.position({ x: element.x, y: element.y });
    group.size({ width: element.width, height: element.height });

    // Clear previous children and rebuild
    group.destroyChildren();

    // Background rectangle
    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: element.width,
      height: element.height,
      fill: element.style.fill,
      stroke: element.style.stroke,
      strokeWidth: element.style.strokeWidth,
      cornerRadius: element.style.cornerRadius,
      listening: false,
      perfectDrawEnabled: false,
      name: "node-bg",
      shadowColor: '#000',
      shadowBlur: 6,
      shadowOpacity: 0.15,
    });
    group.add(background);

    // Text content
    const textWidth = Math.max(0, element.width - element.style.paddingX * 2);
    const textHeight = Math.max(0, element.height - element.style.paddingY * 2);
    
    const text = new Konva.Text({
      x: element.style.paddingX,
      y: element.style.paddingY,
      width: textWidth,
      height: textHeight,
      text: element.text,
      fontFamily: element.style.fontFamily,
      fontSize: element.style.fontSize,
      fontStyle: element.style.fontStyle ?? 'bold',
      fill: element.style.textColor,
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

    this.layers.main.batchDraw();
  }

  /**
   * Render or update a mindmap edge (branch) on the main layer
   */
  renderEdge(
    element: MindmapEdgeElement, 
    getNodeCenter: (id: string) => { x: number; y: number } | null
  ) {
    let shape = this.edgeShapes.get(element.id);
    
    // Create shape if it doesn't exist or needs recreation
    if (!shape || shape.getLayer() !== this.layers.main) {
      if (shape) {
        shape.remove();
        this.edgeShapes.delete(element.id);
      }
      shape = new Konva.Shape({
        name: "mindmap-edge",
        listening: false, // Edges are not interactive
        perfectDrawEnabled: false,
      });
      
      this.layers.main.add(shape);
      this.edgeShapes.set(element.id, shape);
    }

    // Get node centers
    const fromCenter = getNodeCenter(element.fromId);
    const toCenter = getNodeCenter(element.toId);
    
    if (!fromCenter || !toCenter) {
      shape.hide();
      return;
    }
    
    shape.show();

    // Calculate curve geometry
    const { curvature, color, widthStart, widthEnd } = element.style;
    const k = Math.max(0, Math.min(1, curvature));
    const { c1, c2 } = rightwardControls(fromCenter, toCenter, k);

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
    
    // Generate ribbon polygon points
    const points = buildTaperedRibbonPoints(
      start,
      c1,
      c2,
      end,
      widthStart,
      widthEnd,
      this.options.edgeSegments
    );

    // Draw the main ribbon
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Draw rounded end cap at child node
    if (widthEnd > 0) {
      ctx.beginPath();
      ctx.arc(end.x, end.y, Math.max(1, widthEnd * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();
    
    // Required by Konva custom shape
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
    getNodeCenter: (id: string) => { x: number; y: number } | null
  ) {
    const allEdges = getAllEdges();
    const connectedEdges = allEdges.filter(
      edge => edge.fromId === nodeId || edge.toId === nodeId
    );

    connectedEdges.forEach(edge => {
      this.renderEdge(edge, getNodeCenter);
    });
  }

  /**
   * Batch render multiple nodes and edges
   * More efficient than individual renders for initial load or bulk updates
   */
  renderBatch(
    nodes: MindmapNodeElement[],
    edges: MindmapEdgeElement[],
    getNodeCenter: (id: string) => { x: number; y: number } | null
  ) {
    // Render all nodes first
    nodes.forEach(node => {
      this.renderNode(node);
    });

    // Then render all edges
    edges.forEach(edge => {
      this.renderEdge(edge, getNodeCenter);
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