// Adapter for ConnectorRenderer to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../types";
import { ConnectorRenderer, type RendererLayers } from "./ConnectorRenderer";
import type { ConnectorElement } from "../../types/connector";
import type { CanvasElement } from "../../../../../types";

type Id = string;

export class ConnectorRendererAdapter implements RendererModule {
  private renderer?: ConnectorRenderer;
  private unsubscribe?: () => void;
  private readonly elementNodes = new Map<Id, Konva.Group>();

  mount(ctx: ModuleRendererCtx): () => void {
    // Create renderer with node resolver
    this.renderer = new ConnectorRenderer(ctx.layers as RendererLayers, {
      getNodeById: (id: string) => {
        // Find the node in the main layer
        const node = ctx.layers.main.findOne(`#${id}`);
        if (node) return node;

        // Fallback to cached nodes
        return this.elementNodes.get(id) || null;
      },
    });

    // Subscribe to store changes - watch connector elements AND viewport changes
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract connectors, elements, and viewport state
      (state) => {
        const connectors = new Map<Id, ConnectorElement>();
        const elements = new Map<Id, CanvasElement>();

        for (const [id, element] of state.elements.entries()) {
          if (element.type === "connector") {
            connectors.set(id, element as ConnectorElement);
          } else {
            // Cache other elements for endpoint resolution
            elements.set(id, element);
          }
        }

        // CRITICAL FIX: Include viewport state to detect zoom/pan changes
        const viewport = {
          x: state.viewport.x,
          y: state.viewport.y,
          scale: state.viewport.scale,
        };

        return { connectors, elements, viewport };
      },
      // Callback: reconcile changes when elements OR viewport changes
      ({ connectors, elements }) => {
        this.reconcile(connectors, elements);
      },
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialConnectors = new Map<Id, ConnectorElement>();
    const initialElements = new Map<Id, CanvasElement>();

    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === "connector") {
        initialConnectors.set(id, element as ConnectorElement);
      } else {
        initialElements.set(id, element);
      }
    }

    this.reconcile(initialConnectors, initialElements);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.renderer) {
      // Manually clear connectors since ConnectorRenderer doesn't have a clear method
      const layer = (this.renderer as unknown as { layers: RendererLayers })
        .layers.main;
      if (layer) {
        layer.find(".connector").forEach((node: Konva.Node) => node.destroy());
        layer.batchDraw();
      }
    }
    this.elementNodes.clear();
  }

  private reconcile(
    connectors: Map<Id, ConnectorElement>,
    elements: Map<Id, CanvasElement>,
  ) {
    // Only log when there are actual connectors to reconcile (reduce console spam)

    if (!this.renderer) return;

    // Update element node cache for endpoint resolution with accurate rect alignment
    this.elementNodes.clear();
    for (const [id, element] of elements) {
      // Create a temporary group representing the element bounds
      const group = new Konva.Group({
        id,
        x: typeof element.x === "number" ? element.x : 0,
        y: typeof element.y === "number" ? element.y : 0,
        width: typeof element.width === "number" ? element.width : 100,
        height: typeof element.height === "number" ? element.height : 100,
      });
      // Mark as element container for consistent rect calculations downstream
      group.setAttr("elementId", id);
      this.elementNodes.set(id, group);
    }

    const seen = new Set<Id>();
    const renderedIds = new Set<Id>();

    // Render/update connectors
    for (const [id, connector] of connectors) {
      seen.add(id);
      renderedIds.add(id);
      this.renderer.render(connector).catch((_err) => {
        // Error: [ConnectorRendererAdapter] Failed to render connector: ${id}
      });
    }

    // Remove deleted connectors (manually since ConnectorRenderer doesn't have removeNotIn)
    const layer = (this.renderer as unknown as { layers: RendererLayers })
      .layers.main;
    if (layer) {
      layer.find(".connector").forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seen.has(nodeId)) {
          node.destroy();
        }
      });
      layer.batchDraw();
    }
  }
}
