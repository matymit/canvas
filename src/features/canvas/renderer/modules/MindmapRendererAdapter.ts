// Adapter for MindmapRenderer to implement RendererModule interface
import type Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { MindmapRenderer } from "./MindmapRenderer";
import type {
  MindmapNodeElement,
  MindmapEdgeElement,
  MindmapNodeStyle,
  BranchStyle,
} from "../../types/mindmap";
import type { CanvasElement } from "../../../../../types";

// Extended interface for mindmap elements with additional properties
interface MindmapCanvasElement extends Omit<CanvasElement, 'style'> {
  level?: number;
  color?: string;
  style?: MindmapNodeStyle | BranchStyle;
  data?: {
    level?: number;
    color?: string;
    style?: MindmapNodeStyle | BranchStyle;
    text?: string;
    parentId?: string | null;
    textWidth?: number;
    textHeight?: number;
    width?: number;
    height?: number;
    fromId?: string;
    toId?: string;
  };
  text?: string;
  parentId?: string | null;
  textWidth?: number;
  textHeight?: number;
  fromId?: string;
  toId?: string;
}
import {
  DEFAULT_BRANCH_STYLE,
  DEFAULT_NODE_STYLE,
  MINDMAP_CONFIG,
  MINDMAP_THEME,
  getNodeConnectionPoint,
  measureMindmapLabel,
} from "@/features/canvas/types/mindmap";

const ROOT_FONT_SIZE = 18;
const CHILD_FONT_SIZE = 15;

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

  const mindmapElement = element as MindmapCanvasElement;
  const level =
    mindmapElement.level ??
    mindmapElement.data?.level ??
    ((mindmapElement.parentId ?? mindmapElement.data?.parentId) ? 1 : 0);
  const color =
    mindmapElement.color ??
    mindmapElement.data?.color ??
    MINDMAP_THEME.nodeColors[level % MINDMAP_THEME.nodeColors.length];

  const nodeStyle = mindmapElement.style ?? mindmapElement.data?.style;
  const style = mergeNodeStyle(
    (nodeStyle && 'fill' in nodeStyle) ? nodeStyle as MindmapNodeStyle : undefined,
  );
  const paletteIndex = level % MINDMAP_THEME.nodeColors.length;
  const borderPalette = MINDMAP_THEME.nodeBorderColors ?? [];
  const themeBorder = borderPalette[paletteIndex] ?? DEFAULT_NODE_STYLE.stroke;
  const hydratedStyle: MindmapNodeStyle = {
    ...style,
    fill: style.fill ?? color,
    textColor: style.textColor ?? MINDMAP_THEME.textColor,
    fontStyle: style.fontStyle ?? (level === 0 ? "bold" : "normal"),
  fontSize: style.fontSize ?? (level === 0 ? ROOT_FONT_SIZE : CHILD_FONT_SIZE),
    cornerRadius: style.cornerRadius ?? MINDMAP_THEME.nodeRadius,
    stroke: style.stroke ?? themeBorder,
    strokeWidth: style.strokeWidth ?? (level === 0 ? 2 : 1.5),
    shadowColor: style.shadowColor ?? MINDMAP_THEME.shadow.color,
    shadowBlur: style.shadowBlur ?? MINDMAP_THEME.shadow.blur,
    shadowOffsetX: style.shadowOffsetX ?? MINDMAP_THEME.shadow.offsetX,
    shadowOffsetY: style.shadowOffsetY ?? MINDMAP_THEME.shadow.offsetY,
  };

  // CRITICAL: Check if we already have stored textWidth/textHeight from editor
  const existingTextWidth =
    mindmapElement.textWidth ?? mindmapElement.data?.textWidth;
  const existingTextHeight =
    mindmapElement.textHeight ?? mindmapElement.data?.textHeight;
  const existingWidth = element.width ?? mindmapElement.data?.width;
  const existingHeight = element.height ?? mindmapElement.data?.height;

  let textWidth: number;
  let textHeight: number;
  let width: number;
  let height: number;

  if (existingTextWidth && existingTextHeight) {
    // Use the stored wrapped dimensions from the editor
    textWidth = existingTextWidth;
    textHeight = existingTextHeight;
    width =
      existingWidth ??
      Math.max(
        textWidth + hydratedStyle.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      );
    height =
      existingHeight ??
      Math.max(
        textHeight + hydratedStyle.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      );
  } else {
    // Fallback: measure text (but this won't handle wrapping properly)
    const metrics = measureMindmapLabel(
      mindmapElement.text ??
        mindmapElement.data?.text ??
        MINDMAP_CONFIG.defaultText,
      hydratedStyle,
    );
    textWidth = metrics.width;
    textHeight = metrics.height;
    width = Math.max(
      textWidth + hydratedStyle.paddingX * 2,
      MINDMAP_CONFIG.minNodeWidth,
    );
    height = Math.max(
      textHeight + hydratedStyle.paddingY * 2,
      MINDMAP_CONFIG.minNodeHeight,
    );
  }

  return {
    id: element.id,
    type: "mindmap-node",
    x: element.x ?? 0,
    y: element.y ?? 0,
    width,
    height,
    text:
      mindmapElement.text ??
      mindmapElement.data?.text ??
      MINDMAP_CONFIG.defaultText,
    style: hydratedStyle,
    parentId:
      mindmapElement.parentId ?? mindmapElement.data?.parentId ?? null,
    textWidth,
    textHeight,
    level,
    color,
  };
}

function toMindmapEdge(element: CanvasElement): MindmapEdgeElement | null {
  if (element.type !== "mindmap-edge") return null;

  const mindmapElement = element as MindmapCanvasElement;
  const branchStyle = mindmapElement.style ?? mindmapElement.data?.style;
  const rawStyle = mergeBranchStyle(
    (branchStyle && 'color' in branchStyle) ? branchStyle as BranchStyle : undefined,
  );
  const hydratedStyle: BranchStyle = {
    ...rawStyle,
    color: rawStyle.color ?? MINDMAP_THEME.branchColors[0],
  };
  return {
    id: element.id,
    type: "mindmap-edge",
    x: 0,
    y: 0,
    fromId: mindmapElement.fromId ?? mindmapElement.data?.fromId ?? "",
    toId: mindmapElement.toId ?? mindmapElement.data?.toId ?? "",
    style: hydratedStyle,
  };
}

export class MindmapRendererAdapter implements RendererModule {
  private renderer?: MindmapRenderer;
  private unsubscribe?: () => void;
  private readonly previousNodeHeights = new Map<string, number>();

  mount(ctx: ModuleRendererCtx): () => void {
    // Create MindmapRenderer instance
    this.renderer = new MindmapRenderer(ctx.layers, ctx.store);
    if (typeof window !== "undefined") {
      (window as Window & { mindmapRenderer?: MindmapRenderer }).mindmapRenderer =
        this.renderer;
    }

    // Subscribe to store changes - watch mindmap elements AND selectedTool
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract mindmap nodes, edges, AND selectedTool (for draggable state)
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

        // CRITICAL FIX: Include selectedTool so draggable state updates when tool changes
        return { nodes, edges, selectedTool: state.ui?.selectedTool };
      },
      // Callback: reconcile changes (ignore selectedTool in callback, it's just for triggering updates)
      ({ nodes, edges }: { nodes: Map<Id, MindmapNodeElement>; edges: Map<Id, MindmapEdgeElement>; selectedTool?: string }) => {
        this.reconcile({ nodes, edges });
      },
      // Options: prevent unnecessary reconciliation with equality check
      {
        fireImmediately: true,
        equalityFn: (a, b) => {
          // CRITICAL: Compare selectedTool, nodes, and edges
          if (a.selectedTool !== b.selectedTool) return false;
          if (a.nodes.size !== b.nodes.size || a.edges.size !== b.edges.size) return false;
          
          // Check if any node changed (position, text, style, dimensions)
          for (const [id, aNode] of a.nodes) {
            const bNode = b.nodes.get(id);
            if (!bNode) return false;
            if (aNode.x !== bNode.x || aNode.y !== bNode.y ||
                aNode.text !== bNode.text ||
                aNode.width !== bNode.width || aNode.height !== bNode.height ||
                aNode.textWidth !== bNode.textWidth || aNode.textHeight !== bNode.textHeight ||
                JSON.stringify(aNode.style) !== JSON.stringify(bNode.style)) {
              return false;
            }
          }

          // Check if any edge changed
          for (const [id, aEdge] of a.edges) {
            const bEdge = b.edges.get(id);
            if (!bEdge) return false;
            if (aEdge.fromId !== bEdge.fromId || aEdge.toId !== bEdge.toId ||
                JSON.stringify(aEdge.style) !== JSON.stringify(bEdge.style)) {
              return false;
            }
          }

          return true;
        },
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
    if (typeof window !== "undefined") {
      delete (window as Window & { mindmapRenderer?: MindmapRenderer })
        .mindmapRenderer;
    }
    // Cleanup mindmap elements manually
    const layer = (this.renderer as unknown as { layers: { main: Konva.Layer } }).layers.main;
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

    // Check for height changes and reposition siblings if needed
    this.repositionSiblingsIfNeeded(elements);

    // Helper function to get node center for edge rendering
    const getNodePoint = (
      nodeId: string,
      side: "left" | "right",
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
      // Track current height for future comparisons
      this.previousNodeHeights.set(id, node.height);
    }

    // Remove deleted elements manually
    const layer = (this.renderer as unknown as { layers: { main: Konva.Layer } }).layers.main;
    if (layer) {
      layer.find(".mindmap-node").forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seenNodes.has(nodeId)) {
          node.destroy();
          this.previousNodeHeights.delete(nodeId);
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

  /**
   * Repositions sibling nodes when any node's height changes to prevent overlap
   */
  private repositionSiblingsIfNeeded(elements: MindmapElements) {
    const store = (this.renderer as unknown as { store: { getState: () => unknown } }).store;
    if (!store) return;

    // Group nodes by parent
    const nodesByParent = new Map<
      string | null | undefined,
      MindmapNodeElement[]
    >();
    for (const [, node] of elements.nodes) {
      const parentId = node.parentId;
      if (!nodesByParent.has(parentId)) {
        nodesByParent.set(parentId, []);
      }
      nodesByParent.get(parentId)?.push(node);
    }

    // Process each parent's children
    for (const [, siblings] of nodesByParent) {
      if (siblings.length <= 1) continue; // No siblings to reposition

      // Check if any sibling has changed height
      let hasHeightChange = false;
      for (const sibling of siblings) {
        const prevHeight = this.previousNodeHeights.get(sibling.id);
        if (prevHeight !== undefined && prevHeight !== sibling.height) {
          hasHeightChange = true;
          break;
        }
      }

      if (!hasHeightChange) continue;

      // Sort siblings by current Y position
      siblings.sort((a, b) => a.y - b.y);

      // Calculate new positions with proper spacing
      const SIBLING_SPACING = 20; // Vertical spacing between siblings
      let currentY = siblings[0].y; // Start from the topmost sibling's current position

      const updates: Array<{ id: string; y: number }> = [];
      let needsUpdate = false;

      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];

        if (i > 0) {
          // Calculate minimum Y position based on previous sibling
          const prevSibling = siblings[i - 1];
          const minY = currentY + prevSibling.height + SIBLING_SPACING;

          if (sibling.y < minY) {
            // This sibling needs to be moved down
            updates.push({ id: sibling.id, y: minY });
            currentY = minY;
            needsUpdate = true;
          } else {
            // Keep current position
            currentY = sibling.y;
          }
        }
      }

      // Apply updates if needed
      if (needsUpdate) {
        const state = store.getState() as { updateElement?: (id: string, data: { y: number }, options?: { pushHistory: boolean }) => void; element?: { update?: (id: string, data: { y: number }, options?: { pushHistory: boolean }) => void } };
        const update = state.updateElement ?? state.element?.update;

        if (typeof update === "function") {
          // Update positions without history (this is an automatic adjustment)
          for (const { id, y } of updates) {
            update(id, { y }, { pushHistory: false });
            // Also update the element in our local map
            const node = elements.nodes.get(id);
            if (node) {
              node.y = y;
            }
          }
        }
      }
    }
  }
}
