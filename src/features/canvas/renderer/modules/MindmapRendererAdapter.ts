// Adapter for MindmapRenderer to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { MindmapRenderer } from "./MindmapRenderer";
import type {
  MindmapNodeElement,
  MindmapEdgeElement,
} from "../../types/elements/mindmap";

type Id = string;

interface MindmapElements {
  nodes: Map<Id, MindmapNodeElement>;
  edges: Map<Id, MindmapEdgeElement>;
}

export class MindmapRendererAdapter implements RendererModule {
  private renderer?: MindmapRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log("[MindmapRendererAdapter] Mounting...");

    // Create MindmapRenderer instance
    this.renderer = new MindmapRenderer(ctx.layers);

    // Subscribe to store changes - watch mindmap elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract mindmap nodes and edges
      (state) => {
        const nodes = new Map<Id, MindmapNodeElement>();
        const edges = new Map<Id, MindmapEdgeElement>();

        for (const [id, element] of state.elements.entries()) {
          if (element.type === "mindmap-node") {
            nodes.set(id, element as MindmapNodeElement);
          } else if (element.type === "mindmap-edge") {
            edges.set(id, element as unknown as MindmapEdgeElement);
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
      if (element.type === "mindmap-node") {
        initialElements.nodes.set(id, element as MindmapNodeElement);
      } else if (element.type === "mindmap-edge") {
        initialElements.edges.set(id, element as unknown as MindmapEdgeElement);
      }
    }

    this.reconcile(initialElements);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log("[MindmapRendererAdapter] Unmounting...");
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
    console.log(
      "[MindmapRendererAdapter] Reconciling",
      elements.nodes.size,
      "nodes and",
      elements.edges.size,
      "edges",
    );

    if (!this.renderer) return;

    const seenNodes = new Set<Id>();
    const seenEdges = new Set<Id>();

    // Helper function to get node center for edge rendering
    const getNodeCenter = (nodeId: string): { x: number; y: number } | null => {
      const node = elements.nodes.get(nodeId);
      if (!node) return null;
      return {
        x: node.x + node.width / 2,
        y: node.y + node.height / 2,
      };
    };

    // Render edges first (so they appear behind nodes)
    for (const [id, edge] of elements.edges) {
      seenEdges.add(id);
      this.renderer.renderEdge(edge, getNodeCenter);
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
