// Adapter for TableModule to implement RendererModule interface
import type Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { TableRenderer, type RendererLayers } from "./TableModule";
import type { TableElement } from "../../types/table";

type Id = string;

export class TableModuleAdapter implements RendererModule {
  private renderer?: TableRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    // Mounting TableModuleAdapter

    // Create TableRenderer instance with store context
    this.renderer = new TableRenderer(ctx.layers, {}, ctx);

    // Subscribe to store changes - watch table elements AND selectedTool
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract table elements AND selectedTool (for draggable state)
      (state) => {
        const tables = new Map<Id, TableElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === "table") {
            tables.set(id, element as TableElement);
          }
        }
        // CRITICAL FIX: Include selectedTool so draggable state updates when tool changes
        return { tables, selectedTool: state.ui?.selectedTool };
      },
      // Callback: reconcile changes (extract tables from returned object)
      ({ tables }) => {
        this.reconcile(tables);
      },
      // Options: prevent unnecessary reconciliation with equality check
      {
        fireImmediately: true,
        equalityFn: (a, b) => {
          // CRITICAL: Compare both tables AND selectedTool
          if (a.selectedTool !== b.selectedTool) return false;
          if (a.tables.size !== b.tables.size) return false;
          for (const [id, element] of a.tables) {
            const other = b.tables.get(id);
            if (!other ||
                other.x !== element.x ||
                other.y !== element.y ||
                other.width !== element.width ||
                other.height !== element.height) {
              return false;
            }

            const colsA = (element.colWidths ?? []) as number[];
            const colsB = (other.colWidths ?? []) as number[];
            if (colsA.length !== colsB.length) return false;
            for (let i = 0; i < colsA.length; i++) {
              if (Math.abs(colsA[i] - colsB[i]) > 0.25) return false;
            }

            const rowsA = (element.rowHeights ?? []) as number[];
            const rowsB = (other.rowHeights ?? []) as number[];
            if (rowsA.length !== rowsB.length) return false;
            for (let i = 0; i < rowsA.length; i++) {
              if (Math.abs(rowsA[i] - rowsB[i]) > 0.25) return false;
            }

            if (JSON.stringify(other.cells) !== JSON.stringify(element.cells)) {
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
    // Unmounting TableModuleAdapter
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup tables manually using correct name
    const layer = (this.renderer as unknown as { layers: RendererLayers }).layers.main;
    if (layer) {
      layer.find(".table-group").forEach((node: Konva.Node) => node.destroy());
      layer.batchDraw();
    }
  }

  private reconcile(tables: Map<Id, TableElement>) {
    // Only log when there are actual tables to reconcile (reduce console spam)
    if (tables.size > 0) {
      // Reconciling tables
    }

    if (!this.renderer) return;

    const seen = new Set<Id>();

    // Render/update tables
    for (const [id, table] of tables) {
      seen.add(id);
      this.renderer.render(table);
    }

    // Remove deleted tables manually using correct name
    const layer = (this.renderer as unknown as { layers: RendererLayers }).layers.main;
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
