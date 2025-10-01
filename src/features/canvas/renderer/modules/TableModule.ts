// Table renderer module - coordinates table rendering subsystems
// Refactored to use extracted subsystems for better maintainability
// Follows existing four-layer architecture and performance patterns

import Konva from "konva";
import type { TableElement } from "../../types/table";
import KonvaNodePool from "../../utils/KonvaNodePool";
import type { ModuleRendererCtx } from "../index";
import { TableCellResolver } from "./table/TableCellResolver";
import { TableEditorManager } from "./table/TableEditorManager";
import { TableEventHandlers } from "./table/TableEventHandlers";
import { TableRenderingEngine } from "./table/TableRenderingEngine";
import type { TableStoreHook } from "./table/tableTypes";

// Re-use existing RendererLayers interface from the codebase
export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export interface TableRendererOptions {
  // Allow enabling caching or node pooling in heavy scenes
  cacheAfterCommit?: boolean;
  usePooling?: boolean;
}

/**
 * TableRenderer coordinates all table rendering subsystems
 * Delegates to specialized modules for cell resolution, event handling,
 * editor management, and rendering
 */
export class TableRenderer {
  private readonly layers: RendererLayers;
  private readonly pool?: KonvaNodePool;
  private readonly opts: TableRendererOptions;
  private readonly storeCtx?: ModuleRendererCtx;

  // Subsystems
  private readonly cellResolver: TableCellResolver;
  private readonly editorManager: TableEditorManager;
  private readonly eventHandlers: TableEventHandlers;
  private readonly renderingEngine: TableRenderingEngine;

  constructor(
    layers: RendererLayers,
    opts?: TableRendererOptions,
    storeCtx?: ModuleRendererCtx,
  ) {
    this.layers = layers;
    this.opts = opts ?? {};
    this.storeCtx = storeCtx;

    // Initialize node pool if enabled
    if (this.opts.usePooling) {
      this.pool = new KonvaNodePool();
      this.initializeNodePool(this.pool);
    }

    // Create shared callbacks for subsystems
    const callbacks = {
      getTableFromStore: (elementId: string) => this.getTableFromStore(elementId),
      getStoreHook: () => this.getStoreHook(),
    };

    // Initialize subsystems
    this.cellResolver = new TableCellResolver();
    this.editorManager = new TableEditorManager(callbacks);
    this.eventHandlers = new TableEventHandlers(
      this.cellResolver,
      this.editorManager,
      callbacks,
    );
    this.renderingEngine = new TableRenderingEngine(
      this.layers,
      this.pool,
      this.cellResolver,
      this.eventHandlers,
      callbacks,
      this.opts,
    );
  }

  /**
   * Initialize node pool with table-specific node types
   */
  private initializeNodePool(pool: KonvaNodePool): void {
    // Register pooled node types for table rendering
    pool.register("table-cell-rect", {
      create: () =>
        new Konva.Rect({ listening: false, perfectDrawEnabled: false }),
      reset: (node: Konva.Rect) => {
        node.setAttrs({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          fill: "",
          stroke: "",
          strokeWidth: 0,
          cornerRadius: 0,
        });
      },
    });

    pool.register("table-cell-text", {
      create: () =>
        new Konva.Text({ listening: false, perfectDrawEnabled: false }),
      reset: (node: Konva.Text) => {
        node.setAttrs({
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          text: "",
          fontFamily: "",
          fontSize: 16,
          fill: "",
          align: "center",
          verticalAlign: "top",
          lineHeight: 1.4,
        });
      },
    });

    pool.register("table-grid", {
      create: () =>
        new Konva.Shape({ listening: false, perfectDrawEnabled: false }),
      reset: (node: Konva.Shape) => {
        node.clearCache();
      },
    });
  }

  /**
   * Get store hook for accessing Zustand state
   */
  private getStoreHook(): TableStoreHook | undefined {
    return this.storeCtx?.store;
  }

  /**
   * Get table element from store by ID
   */
  private getTableFromStore(elementId: string): TableElement | undefined {
    const storeHook = this.getStoreHook();
    const state = storeHook?.getState();
    const element = state?.element.getById?.(elementId);
    if (element && (element as TableElement).type === "table") {
      return element as TableElement;
    }
    return undefined;
  }

  /**
   * Public API: Render a table element
   */
  render(el: TableElement): void {
    this.renderingEngine.render(el);
  }

  /**
   * Public API: Remove a table from rendering
   */
  remove(id: string): void {
    this.renderingEngine.remove(id);
  }

  /**
   * Public API: Update specific cell without full rebuild (optimization)
   */
  updateCell(elementId: string, row: number, col: number, newText: string): void {
    this.renderingEngine.updateCell(elementId, row, col, newText);
  }

  /**
   * Public API: Get table group by ID (useful for selection/transformer)
   */
  getTableGroup(id: string): Konva.Group | undefined {
    return this.renderingEngine.getTableGroup(id);
  }

  /**
   * Public API: Handle transform updates from TableTransformerController
   */
  handleTransformUpdate(
    elementId: string,
    newElement: TableElement,
    resetAttrs?: Record<string, unknown>,
  ): void {
    this.renderingEngine.handleTransformUpdate(elementId, newElement, resetAttrs);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    if (this.pool) {
      this.pool.clear(true);
    }
    this.renderingEngine.destroy();
  }
}
