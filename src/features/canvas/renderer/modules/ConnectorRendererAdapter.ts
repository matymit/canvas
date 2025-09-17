// Adapter for ConnectorRenderer to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { ConnectorRenderer } from "./ConnectorRenderer";
import type { ConnectorElement } from "../../types/elements/connector";

type Id = string;

export class ConnectorRendererAdapter implements RendererModule {
  private renderer?: ConnectorRenderer;
  private unsubscribe?: () => void;
  private elementNodes = new Map<Id, Konva.Group>();

  mount(ctx: ModuleRendererCtx): () => void {
    console.log("[ConnectorRendererAdapter] Mounting...");

    // Create renderer with node resolver
    this.renderer = new ConnectorRenderer(ctx.layers, {
      getNodeById: (id: string) => {
        // Find the node in the main layer
        const node = ctx.layers.main.findOne(`#${id}`);
        if (node) return node;

        // Fallback to cached nodes
        return this.elementNodes.get(id) || null;
      },
    });

    // Subscribe to store changes - watch connector elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract connectors and cache element positions
      (state) => {
        const connectors = new Map<Id, ConnectorElement>();
        const elements = new Map<Id, any>();

        for (const [id, element] of state.elements.entries()) {
          if (element.type === "connector") {
            connectors.set(id, element as ConnectorElement);
          } else {
            // Cache other elements for endpoint resolution
            elements.set(id, element);
          }
        }

        return { connectors, elements };
      },
      // Callback: reconcile changes
      ({ connectors, elements }) => {
        this.reconcile(connectors, elements);
      },
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialConnectors = new Map<Id, ConnectorElement>();
    const initialElements = new Map<Id, any>();

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
    console.log("[ConnectorRendererAdapter] Unmounting...");
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.renderer) {
      // Manually clear connectors since ConnectorRenderer doesn't have a clear method
      const layer = (this.renderer as any).layers?.main;
      if (layer) {
        layer.find(".connector").forEach((node: Konva.Node) => node.destroy());
        layer.batchDraw();
      }
    }
    this.elementNodes.clear();
  }

  private reconcile(
    connectors: Map<Id, ConnectorElement>,
    elements: Map<Id, any>,
  ) {
    // Only log when there are actual connectors to reconcile (reduce console spam)
    if (connectors.size > 0) {
      console.log(
        "[ConnectorRendererAdapter] Reconciling",
        connectors.size,
        "connectors",
      );
    }

    if (!this.renderer) return;

    // Update element node cache for endpoint resolution
    this.elementNodes.clear();
    for (const [id, element] of elements) {
      // Create a temporary group representing the element bounds
      const group = new Konva.Group({
        id,
        x: element.x,
        y: element.y,
        width: element.width || 100,
        height: element.height || 100,
      });
      this.elementNodes.set(id, group);
    }

    const seen = new Set<Id>();
    const renderedIds = new Set<Id>();

    // Render/update connectors
    for (const [id, connector] of connectors) {
      seen.add(id);
      renderedIds.add(id);
      this.renderer.render(connector).catch((err) => {
        console.error(
          "[ConnectorRendererAdapter] Failed to render connector:",
          id,
          err,
        );
      });
    }

    // Remove deleted connectors (manually since ConnectorRenderer doesn't have removeNotIn)
    const layer = (this.renderer as any).layers?.main;
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
