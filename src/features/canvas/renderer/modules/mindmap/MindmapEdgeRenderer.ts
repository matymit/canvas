// MindmapEdgeRenderer - Edge (branch) rendering
// Extracted from MindmapRenderer.ts as part of modularization

import Konva from "konva";
import type { RendererLayers } from "../../layers";
import {
  type MindmapEdgeElement,
  type BranchStyle,
  DEFAULT_BRANCH_STYLE,
} from "@/features/canvas/types/mindmap";
import { buildTaperedRibbonPoints, rightwardControls } from "../mindmapRouting";

export interface MindmapEdgeRendererOptions {
  edgeSegments?: number;
}

export class MindmapEdgeRenderer {
  private readonly layers: RendererLayers;
  private readonly edgeShapes: Map<string, Konva.Shape>;
  private options: MindmapEdgeRendererOptions;

  constructor(
    layers: RendererLayers,
    edgeShapes: Map<string, Konva.Shape>,
    options: MindmapEdgeRendererOptions,
  ) {
    this.layers = layers;
    this.edgeShapes = edgeShapes;
    this.options = options;
  }

  updateOptions(newOptions: Partial<MindmapEdgeRendererOptions>) {
    this.options = { ...this.options, ...newOptions };
  }

  mergeBranchStyle(style?: Partial<BranchStyle>): BranchStyle {
    return { ...DEFAULT_BRANCH_STYLE, ...style };
  }

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
}
