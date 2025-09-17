// Adapter for TableModule to implement RendererModule interface
import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';
import { TableRenderer } from './TableModule';
import type { TableElement } from '../../types/elements/table';

type Id = string;

export class TableModuleAdapter implements RendererModule {
  private renderer?: TableRenderer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[TableModuleAdapter] Mounting...');

    // Create TableRenderer instance
    this.renderer = new TableRenderer(ctx.layers);

    // Subscribe to store changes - watch table elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract table elements
      (state) => {
        const tables = new Map<Id, TableElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === 'table') {
            tables.set(id, element as TableElement);
          }
        }
        return tables;
      },
      // Callback: reconcile changes
      (tables) => {
        this.reconcile(tables);
      }
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialTables = new Map<Id, TableElement>();
    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === 'table') {
        initialTables.set(id, element as TableElement);
      }
    }
    this.reconcile(initialTables);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log('[TableModuleAdapter] Unmounting...');
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    // Cleanup tables manually
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find('.table').forEach((node: Konva.Node) => node.destroy());
      layer.batchDraw();
    }
  }

  private reconcile(tables: Map<Id, TableElement>) {
    console.log('[TableModuleAdapter] Reconciling', tables.size, 'tables');

    if (!this.renderer) return;

    const seen = new Set<Id>();

    // Render/update tables
    for (const [id, table] of tables) {
      seen.add(id);
      this.renderer.render(table);
    }

    // Remove deleted tables manually
    const layer = (this.renderer as any)?.layers?.main;
    if (layer) {
      layer.find('.table').forEach((node: Konva.Node) => {
        const nodeId = node.id();
        if (nodeId && !seen.has(nodeId)) {
          node.destroy();
        }
      });
      layer.batchDraw();
    }
  }
}