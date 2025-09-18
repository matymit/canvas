// Adapter for TableModule to implement RendererModule interface
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { TableRenderer } from "./TableModule";
import type { TableElement } from "../../types/table";

type Id = string;

export class TableModuleAdapter implements RendererModule {
  private renderer?: TableRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log("[TableModuleAdapter] Mounting...");

    // Create TableRenderer instance with store context
    this.renderer = new TableRenderer(ctx.layers, {}, ctx);

    // Subscribe to store changes - watch table elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract table elements
      (state) => {
        const tables = new Map<Id, TableElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "table") {
            tables.set(id, element as TableElement);
          }
        }
        return tables;
      },
      // Callback: reconcile changes
      (tables) => {
        this.reconcile(tables);
      },
      // Options: prevent unnecessary reconciliation with equality check
      {
        fireImmediately: true,
        equalityFn: (a, b) => {
          if (a.size !== b.size) return false;
          for (const [id, element] of a) {
            const other = b.get(id);
            if (!other ||
                other.x !== element.x ||
                other.y !== element.y ||
                other.width !== element.width ||
                other.height !== element.height ||
                JSON.stringify(other.cells) !== JSON.stringify(element.cells)) {
              return false;
            }
          }
          return true;
        }
      }
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialTables = new Map<Id, TableElement>();
    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === "table") {
        initialTables.set(id, element as TableElement);
      }
    }
    this.reconcile(initialTables);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log("[TableModuleAdapter] Unmounting...");
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup tables manually using correct name
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find(".table-group").forEach((node: Konva.Node) => node.destroy());
      layer.batchDraw();
    }
  }

  private reconcile(tables: Map<Id, TableElement>) {
    // Only log when there are actual tables to reconcile (reduce console spam)
    if (tables.size > 0) {
      console.log("[TableModuleAdapter] Reconciling", tables.size, "tables");
    }

    if (!this.renderer) return;

    const seen = new Set<Id>();

    // Render/update tables
    for (const [id, table] of tables) {
      seen.add(id);
      this.renderer.render(table);
    }

    // Remove deleted tables manually using correct name
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find(".table-group").forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seen.has(nodeId)) {
          node.destroy();
        }
      });
      layer.batchDraw();
    }
  }
}
