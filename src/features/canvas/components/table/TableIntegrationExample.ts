// Example integration showing how to use the fixed table components together
// This demonstrates the proper setup for tables with position jump prevention,
// aspect ratio resizing, and proper context menu handling

import type Konva from "konva";
import type {
  RendererLayers} from "../../renderer/modules/TableModule";
import {
  TableRenderer
} from "../../renderer/modules/TableModule";
import { TableTransformerController } from "../../renderer/modules/TableTransformerController";
import { TableContextMenuHelper } from "./TableContextMenuHelper";
import type { TableElement } from "../../types/table";
import type { ModuleRendererCtx } from "../../renderer/index";
import { handleTableTransform } from "../../renderer/modules/tableTransform";
import {
  addTableRow,
  addTableColumn,
  removeTableColumn,
  removeTableRow,
} from "../../renderer/modules/tableTransform";

/**
 * Example integration class showing how to properly set up tables
 * with all the fixes for position jumping, resizing, and context menus
 */
export class TableIntegrationExample {
  private readonly stage: Konva.Stage;
  private readonly layers: RendererLayers;
  private readonly tableRenderer: TableRenderer;
  private transformerController?: TableTransformerController;
  private contextMenuHelper?: TableContextMenuHelper;
  private readonly storeContext: {
    store: {
      getState: () => {
        element: {
          getById: (id: string) => TableElement | undefined;
          update: (id: string, element: TableElement, options?: { pushHistory?: boolean }) => void;
          delete: (id: string, options?: { pushHistory?: boolean }) => void;
        };
      };
    };
  };

  constructor(stage: Konva.Stage, layers: RendererLayers, storeContext: {
    store: {
      getState: () => {
        element: {
          getById: (id: string) => TableElement | undefined;
          update: (id: string, element: TableElement, options?: { pushHistory?: boolean }) => void;
          delete: (id: string, options?: { pushHistory?: boolean }) => void;
        };
      };
    };
  }) {
    this.stage = stage;
    this.layers = layers;
    this.storeContext = storeContext;

    // Initialize table renderer with position jump prevention
    this.tableRenderer = new TableRenderer(
      layers,
      {
        cacheAfterCommit: true, // Enable caching for performance
        usePooling: true, // Enable node pooling for large tables
      },
      {
        stage: this.stage,
        layers: {
          background: layers.background,
          main: layers.main,
          highlighter: layers.main, // Use main layer as highlighter fallback
          preview: layers.preview,
          overlay: layers.overlay
        },
        store: storeContext.store as ModuleRendererCtx['store'] // Cast to match ModuleRendererCtx type
      },
    );
  }

  /**
   * Render a table element with all fixes applied
   */
  renderTable(element: TableElement): void {

    // Render the table using the fixed renderer
    this.tableRenderer.render(element);

    // Get the table group for transformer and context menu setup
    const tableGroup = this.tableRenderer.getTableGroup(element.id);
    if (!tableGroup) {
      // Failed to get table group - silently return (TODO: implement proper error handling)
      return;
    }

    // Set up transformer controller for aspect ratio resizing
    this.setupTransformerController(element, tableGroup);

    // Set up context menu helper for position-safe right-click handling
    this.setupContextMenuHelper(element, tableGroup);
  }

  /**
   * Set up the transformer controller with aspect ratio support
   */
  private setupTransformerController(
    element: TableElement,
    tableGroup: Konva.Group,
  ) {
    // Clean up existing transformer
    if (this.transformerController) {
      this.transformerController.destroy();
    }

    // Create new transformer controller with table-specific settings
    this.transformerController = new TableTransformerController({
      stage: this.stage,
      layer: this.layers.overlay,
      element: element,

      // Handle table updates (both live and final transforms)
      onTableUpdate: (tableElement: TableElement, _resetAttrs?: { scaleX: number; scaleY: number; width: number; height: number; x: number; y: number }) => {
        this.handleTableTransform(tableElement, {
          x: tableElement.x,
          y: tableElement.y,
          width: tableElement.width,
          height: tableElement.height
        }, true);
      },
    });

    // Attach to the table group
    this.transformerController.attach([tableGroup]);
  }

  /**
   * Set up context menu helper for position-safe right-click handling
   */
  private setupContextMenuHelper(
    element: TableElement,
    tableGroup: Konva.Group,
  ) {
    // Clean up existing helper
    if (this.contextMenuHelper) {
      this.contextMenuHelper.destroy();
    }

    // Create new context menu helper
    this.contextMenuHelper = new TableContextMenuHelper(element, tableGroup, {
      onAddRow: (elementId, insertIndex) =>
        this.handleAddRow(elementId, insertIndex),
      onAddColumn: (elementId, insertIndex) =>
        this.handleAddColumn(elementId, insertIndex),
      onDeleteRow: (elementId, rowIndex) =>
        this.handleDeleteRow(elementId, rowIndex),
      onDeleteColumn: (elementId, columnIndex) =>
        this.handleDeleteColumn(elementId, columnIndex),
      onTableProperties: (elementId) => this.handleTableProperties(elementId),
      onDelete: (elementId) => this.handleDeleteTable(elementId),
    });
  }

  /**
   * Handle table transform with proper aspect ratio and cell preservation
   */
  private handleTableTransform(
    element: TableElement,
    newBounds: { x: number; y: number; width: number; height: number },
    isCommit: boolean,
  ) {

    // Get keyboard state for aspect ratio locking
    const event = window.event as KeyboardEvent | undefined;
    const shiftKey = event?.shiftKey ?? false;

    // Apply table-specific transform logic
    const transformedElement = handleTableTransform(element, newBounds, {
      shiftKey,
      altKey: event?.altKey ?? false,
      ctrlKey: event?.ctrlKey ?? false,
    });

    // Update the store with the transformed element
    if (this.storeContext?.store) {
      const state = this.storeContext.store.getState();
      state.element.update(element.id, transformedElement, {
        pushHistory: isCommit, // Only push to history on final commit
      });
    }

    // Update transformer controller with new element
    if (this.transformerController) {
      this.transformerController.updateElement(transformedElement);
    }

    // Update context menu helper with new element
    if (this.contextMenuHelper) {
      this.contextMenuHelper.updateElement(transformedElement);
    }
  }

  /**
   * Handle adding a row to the table
   */
  private handleAddRow(elementId: string, insertIndex?: number) {

    if (!this.storeContext?.store) return;

    const state = this.storeContext.store.getState();
    const element = state.element.getById(elementId) as TableElement;
    if (!element || element.type !== "table") return;

    // Use the tableTransform utility to add a row
    const updatedElement = addTableRow(element, insertIndex);

    // Update store with history
    state.element.update(elementId, updatedElement, { pushHistory: true });
  }

  /**
   * Handle adding a column to the table
   */
  private handleAddColumn(elementId: string, insertIndex?: number) {

    if (!this.storeContext?.store) return;

    const state = this.storeContext.store.getState();
    const element = state.element.getById(elementId) as TableElement;
    if (!element || element.type !== "table") return;

    // Use the tableTransform utility to add a column
    const updatedElement = addTableColumn(element, insertIndex);

    // Update store with history
    state.element.update(elementId, updatedElement, { pushHistory: true });
  }

  /**
   * Handle deleting a row from the table
   */
  private handleDeleteRow(elementId: string, rowIndex: number) {

    if (!this.storeContext?.store) return;

    const state = this.storeContext.store.getState();
    const element = state.element.getById(elementId) as TableElement;
    if (!element || element.type !== "table" || element.rows <= 1) return;

    // Use the tableTransform utility to remove a row
    const updatedElement = removeTableRow(element, rowIndex);

    // Update store with history
    state.element.update(elementId, updatedElement, { pushHistory: true });
  }

  /**
   * Handle deleting a column from the table
   */
  private handleDeleteColumn(elementId: string, columnIndex: number) {

    if (!this.storeContext?.store) return;

    const state = this.storeContext.store.getState();
    const element = state.element.getById(elementId) as TableElement;
    if (!element || element.type !== "table" || element.cols <= 1) return;

    // Use the tableTransform utility to remove a column
    const updatedElement = removeTableColumn(element, columnIndex);

    // Update store with history
    state.element.update(elementId, updatedElement, { pushHistory: true });
  }

  /**
   * Handle table properties dialog
   */
  private handleTableProperties(_elementId: string) {
    // TODO: Open table properties dialog
  }

  /**
   * Handle deleting the entire table
   */
  private handleDeleteTable(elementId: string) {

    if (!this.storeContext?.store) return;

    const state = this.storeContext.store.getState();
    state.element.delete(elementId, { pushHistory: true });
  }

  /**
   * Update table selection (call when selection changes)
   */
  updateSelection(selectedElementIds: string[]) {
    if (!this.transformerController) return;

    // Find selected table groups
    const selectedTableGroups = selectedElementIds
      .map((id) => this.tableRenderer.getTableGroup(id))
      .filter((group) => group !== undefined) as Konva.Group[];

    if (selectedTableGroups.length > 0) {
      // Attach transformer to selected tables
      this.transformerController.attach(selectedTableGroups);
    } else {
      // Detach transformer if no tables selected
      this.transformerController.detach();
    }
  }

  /**
   * Remove a table from rendering
   */
  removeTable(elementId: string) {
    this.tableRenderer.remove(elementId);
  }

  /**
   * Clean up all resources
   */
  destroy() {
    if (this.transformerController) {
      this.transformerController.destroy();
    }
    if (this.contextMenuHelper) {
      this.contextMenuHelper.destroy();
    }
    this.tableRenderer.destroy();
  }
}

/**
 * Factory function to create a complete table integration
 */
export function createTableIntegration(
  stage: Konva.Stage,
  layers: RendererLayers,
  storeContext: {
    store: {
      getState: () => {
        element: {
          getById: (id: string) => TableElement | undefined;
          update: (id: string, element: TableElement, options?: { pushHistory?: boolean }) => void;
          delete: (id: string, options?: { pushHistory?: boolean }) => void;
        };
      };
    };
  },
): TableIntegrationExample {
  return new TableIntegrationExample(stage, layers, storeContext);
}

/**
 * Example usage in your main canvas component:
 *
 * ```typescript
 * // In your canvas setup
 * const tableIntegration = createTableIntegration(stage, layers, storeContext);
 *
 * // When rendering a table
 * tableIntegration.renderTable(tableElement);
 *
 * // When selection changes
 * tableIntegration.updateSelection(selectedElementIds);
 *
 * // Clean up when component unmounts
 * tableIntegration.destroy();
 * ```
 */
