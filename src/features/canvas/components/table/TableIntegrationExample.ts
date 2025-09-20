// Example integration showing how to use the fixed table components together
// This demonstrates the proper setup for tables with position jump prevention,
// aspect ratio resizing, and proper context menu handling

import Konva from "konva";
import {
  TableRenderer,
  RendererLayers,
} from "../../renderer/modules/TableModule";
import { TableTransformerController } from "../../renderer/modules/TableTransformerController";
import { TableContextMenuHelper } from "./TableContextMenuHelper";
import type { TableElement } from "../../types/table";
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
  private stage: Konva.Stage;
  private layers: RendererLayers;
  private tableRenderer: TableRenderer;
  private transformerController?: TableTransformerController;
  private contextMenuHelper?: TableContextMenuHelper;
  private storeContext: any;

  constructor(stage: Konva.Stage, layers: RendererLayers, storeContext: any) {
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
      storeContext, // Pass store context for proper position preservation
    );
  }

  /**
   * Render a table element with all fixes applied
   */
  renderTable(element: TableElement) {
    console.log("[TableIntegration] Rendering table with fixes:", element.id);

    // Render the table using the fixed renderer
    this.tableRenderer.render(element);

    // Get the table group for transformer and context menu setup
    const tableGroup = this.tableRenderer.getTableGroup(element.id);
    if (!tableGroup) {
      console.error(
        "[TableIntegration] Failed to get table group for:",
        element.id,
      );
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
      onTableUpdate: (tableElement: any, _resetAttrs?: any) => {
        this.handleTableTransform(tableElement, tableElement, true);
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
    console.log("[TableIntegration] Handling table transform:", {
      elementId: element.id,
      newBounds,
      isCommit,
    });

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
    console.log("[TableIntegration] Adding row:", { elementId, insertIndex });

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
    console.log("[TableIntegration] Adding column:", {
      elementId,
      insertIndex,
    });

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
    console.log("[TableIntegration] Deleting row:", { elementId, rowIndex });

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
    console.log("[TableIntegration] Deleting column:", {
      elementId,
      columnIndex,
    });

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
  private handleTableProperties(elementId: string) {
    console.log("[TableIntegration] Opening table properties:", { elementId });
    // TODO: Open table properties dialog
  }

  /**
   * Handle deleting the entire table
   */
  private handleDeleteTable(elementId: string) {
    console.log("[TableIntegration] Deleting table:", { elementId });

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
  storeContext: any,
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
