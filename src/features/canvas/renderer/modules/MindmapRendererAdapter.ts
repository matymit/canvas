// Adapter for MindmapRenderer to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { MindmapRenderer } from "./MindmapRenderer";
import type {
  MindmapNodeElement,
  MindmapEdgeElement,
  MindmapNodeStyle,
  BranchStyle,
} from "../../types/mindmap";
import type { CanvasElement } from "../../../../../types";
import {
  DEFAULT_BRANCH_STYLE,
  DEFAULT_NODE_STYLE,
  MINDMAP_CONFIG,
  MINDMAP_THEME,
  getNodeConnectionPoint,
  measureMindmapLabel,
} from "@/features/canvas/types/mindmap";

type Id = string;

interface MindmapElements {
  nodes: Map<Id, MindmapNodeElement>;
  edges: Map<Id, MindmapEdgeElement>;
}

function mergeNodeStyle(style?: MindmapNodeStyle): MindmapNodeStyle {
  return { ...DEFAULT_NODE_STYLE, ...(style ?? {}) };
}

function mergeBranchStyle(style?: BranchStyle): BranchStyle {
  return { ...DEFAULT_BRANCH_STYLE, ...(style ?? {}) };
}

function toMindmapNode(element: CanvasElement): MindmapNodeElement | null {
  if (element.type !== "mindmap-node") return null;

  const level =
    (element as any).level ??
    (element as any).data?.level ??
    ((element as any).parentId ?? (element as any).data?.parentId ? 1 : 0);
  const color =
    (element as any).color ??
    (element as any).data?.color ??
    MINDMAP_THEME.nodeColors[level % MINDMAP_THEME.nodeColors.length];

  const style = mergeNodeStyle((element as any).style ?? (element as any).data?.style);
  const hydratedStyle: MindmapNodeStyle = {
    ...style,
    fill: style.fill ?? color,
    textColor: style.textColor ?? DEFAULT_NODE_STYLE.textColor,
    fontStyle: style.fontStyle ?? (level === 0 ? "bold" : "normal"),
    fontSize: style.fontSize ?? (level === 0 ? 16 : 14),
    cornerRadius: style.cornerRadius ?? MINDMAP_THEME.nodeRadius,
    stroke: style.stroke ?? (level === 0 ? "#374151" : DEFAULT_NODE_STYLE.stroke),
    strokeWidth: style.strokeWidth ?? (level === 0 ? 2 : DEFAULT_NODE_STYLE.strokeWidth),
    shadowColor: style.shadowColor ?? DEFAULT_NODE_STYLE.shadowColor,
    shadowBlur: style.shadowBlur ?? DEFAULT_NODE_STYLE.shadowBlur,
    shadowOffsetX: style.shadowOffsetX ?? DEFAULT_NODE_STYLE.shadowOffsetX,
    shadowOffsetY: style.shadowOffsetY ?? DEFAULT_NODE_STYLE.shadowOffsetY,
  };

  const metrics = measureMindmapLabel(
    (element as any).text ?? (element as any).data?.text ?? MINDMAP_CONFIG.defaultText,
    hydratedStyle
  );
  const measuredWidth = Math.max(
    metrics.width + hydratedStyle.paddingX * 2,
    MINDMAP_CONFIG.minNodeWidth
  );
  const measuredHeight = Math.max(
    metrics.height + hydratedStyle.paddingY * 2,
    MINDMAP_CONFIG.minNodeHeight
  );

  return {
    id: element.id,
    type: "mindmap-node",
    x: element.x ?? 0,
    y: element.y ?? 0,
    width: measuredWidth,
    height: measuredHeight,
    text: (element as any).text ?? (element as any).data?.text ?? MINDMAP_CONFIG.defaultText,
    style: hydratedStyle,
    parentId: (element as any).parentId ?? (element as any).data?.parentId ?? null,
    textWidth: metrics.width,
    textHeight: metrics.height,
    level,
    color,
  };
}

function toMindmapEdge(element: CanvasElement): MindmapEdgeElement | null {
  if (element.type !== "mindmap-edge") return null;

  const rawStyle = mergeBranchStyle((element as any).style ?? (element as any).data?.style);
  const hydratedStyle: BranchStyle = {
    ...rawStyle,
    color: rawStyle.color ?? MINDMAP_THEME.branchColors[0],
  };
  return {
    id: element.id,
    type: "mindmap-edge",
    fromId: (element as any).fromId ?? (element as any).data?.fromId ?? "",
    toId: (element as any).toId ?? (element as any).data?.toId ?? "",
    style: hydratedStyle,
  };
}

export class MindmapRendererAdapter implements RendererModule {
  private renderer?: MindmapRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    // Create MindmapRenderer instance
    this.renderer = new MindmapRenderer(ctx.layers, ctx.store);

    // Subscribe to store changes - watch mindmap elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract mindmap nodes and edges
      (state) => {
        const nodes = new Map<Id, MindmapNodeElement>();
        const edges = new Map<Id, MindmapEdgeElement>();

        for (const [id, element] of state.elements.entries()) {
          const canvasElement = element as CanvasElement;
          const node = toMindmapNode(canvasElement);
          if (node) {
            nodes.set(id, node);
            continue;
          }

          const edge = toMindmapEdge(canvasElement);
          if (edge) {
            edges.set(id, edge);
          }
        }

        return { nodes, edges };
      },
      // Callback: reconcile changes
      (mindmapElements: MindmapElements) => {
        this.reconcile(mindmapElements);
      },
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialElements: MindmapElements = {
      nodes: new Map(),
      edges: new Map(),
    };

    for (const [id, element] of initialState.elements.entries()) {
      const canvasElement = element as CanvasElement;
      const node = toMindmapNode(canvasElement);
      if (node) {
        initialElements.nodes.set(id, node);
        continue;
      }

      const edge = toMindmapEdge(canvasElement);
      if (edge) {
        initialElements.edges.set(id, edge);
      }
    }

    this.reconcile(initialElements);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup mindmap elements manually
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer
        .find(".mindmap-node, .mindmap-edge")
        .forEach((node: Konva.Node) => node.destroy());
      layer.batchDraw();
    }
  }

  private reconcile(elements: MindmapElements) {
    if (!this.renderer) return;

    const seenNodes = new Set<Id>();
    const seenEdges = new Set<Id>();

    // Helper function to get node center for edge rendering
    const getNodePoint = (
      nodeId: string,
      side: 'left' | 'right'
    ): { x: number; y: number } | null => {
      const node = elements.nodes.get(nodeId);
      if (!node) return null;
      return getNodeConnectionPoint(node, side);
    };

    // Render edges first (so they appear behind nodes)
    for (const [id, edge] of elements.edges) {
      seenEdges.add(id);
      if (edge.fromId && edge.toId) {
        this.renderer.renderEdge(edge, getNodePoint);
      }
    }

    // Then render nodes on top
    for (const [id, node] of elements.nodes) {
      seenNodes.add(id);
      this.renderer.renderNode(node);
    }

    // Remove deleted elements manually
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find(".mindmap-node").forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seenNodes.has(nodeId)) {
          node.destroy();
        }
      });
      layer.find(".mindmap-edge").forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seenEdges.has(nodeId)) {
          node.destroy();
        }
      });
      layer.batchDraw();
    }
  }
}
