/**
 * Unified Selection Manager
 * 
 * Orchestrates between TransformerManager and ConnectorSelectionManager
 * based on element types to provide appropriate selection UI
 * 
 * CRITICAL FIX for Phase 18: Connector elements get custom selection with endpoint dots
 */

import type Konva from "konva";
import { TransformerManager, type TransformerManagerOptions } from "./TransformerManager";
import { ConnectorSelectionManager, type ConnectorSelectionOptions } from "./ConnectorSelectionManager";
import { StoreSelectors, StoreActions } from "../stores/facade";

export interface SelectionManagerOptions {
  stage: Konva.Stage;
  overlayLayer: Konva.Layer;
  transformerOptions?: Partial<TransformerManagerOptions>;
  connectorOptions?: Partial<ConnectorSelectionOptions>;
  onTransformStart?: (nodes: Konva.Node[]) => void;
  onTransform?: (nodes: Konva.Node[]) => void;
  onTransformEnd?: (nodes: Konva.Node[]) => void;
  onConnectorEndpointDrag?: (connectorId: string, endpoint: 'from' | 'to', newPosition: { x: number; y: number }) => void;
}

/**
 * Unified selection manager that delegates to appropriate selection system
 * based on selected element types
 */
export class SelectionManager {
  private readonly stage: Konva.Stage;
  private readonly overlayLayer: Konva.Layer;
  private readonly transformerManager: TransformerManager;
  private readonly connectorSelectionManager: ConnectorSelectionManager;
  private readonly getElementById = StoreSelectors.getElementById;
  
  // Track current selection state
  private selectedElementIds: Set<string> = new Set();
  private activeSelectionType: 'transformer' | 'connector' | null = null;

  constructor(options: SelectionManagerOptions) {
    this.stage = options.stage;
    this.overlayLayer = options.overlayLayer;

    // Initialize TransformerManager for standard elements
    this.transformerManager = new TransformerManager(this.stage, {
      overlayLayer: this.overlayLayer,
      onTransformStart: options.onTransformStart,
      onTransform: options.onTransform,
      onTransformEnd: options.onTransformEnd,
      ...options.transformerOptions,
    });

    // Initialize ConnectorSelectionManager for connector elements
    this.connectorSelectionManager = new ConnectorSelectionManager(
      this.stage,
      {
        overlayLayer: this.overlayLayer,
        onEndpointDrag: options.onConnectorEndpointDrag || this.handleConnectorEndpointDrag.bind(this),
        ...options.connectorOptions,
      }
    );
  }

  /**
   * CRITICAL FIX: Select elements using appropriate selection system
   */
  selectElements(elementIds: string[]) {
    // Clear any existing selections first
    this.clearSelection();

    if (elementIds.length === 0) {
      return;
    }

    this.selectedElementIds = new Set(elementIds);

    // Determine selection type based on element types
    const selectionType = this.determineSelectionType(elementIds);

    if (selectionType === 'connector') {
      // CRITICAL FIX: Use ConnectorSelectionManager for connector elements
      if (elementIds.length === 1) {
        this.connectorSelectionManager.showSelection(elementIds[0]);
        this.activeSelectionType = 'connector';
      }
    } else {
      // Use TransformerManager for standard elements
      const nodes = this.findElementNodes(elementIds);
      if (nodes.length > 0) {
        this.transformerManager.attachToNodes(nodes);
        this.activeSelectionType = 'transformer';
      }
    }
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    this.transformerManager.detach();
    this.connectorSelectionManager.clearSelection();
    this.selectedElementIds.clear();
    this.activeSelectionType = null;
  }

  /**
   * Refresh current selection (e.g., after element updates)
   */
  refreshSelection() {
    if (this.activeSelectionType === 'connector') {
      this.connectorSelectionManager.refreshSelection();
    } else if (this.activeSelectionType === 'transformer') {
      this.transformerManager.refresh();
    }
  }

  /**
   * Check if any elements are currently selected
   */
  hasSelection(): boolean {
    return this.selectedElementIds.size > 0;
  }

  /**
   * Get currently selected element IDs
   */
  getSelectedElementIds(): string[] {
    return Array.from(this.selectedElementIds);
  }

  /**
   * Get the active selection type
   */
  getActiveSelectionType(): 'transformer' | 'connector' | null {
    return this.activeSelectionType;
  }

  /**
   * Show/hide selection UI
   */
  setVisible(visible: boolean) {
    if (visible) {
      if (this.activeSelectionType === 'transformer') {
        this.transformerManager.show();
      }
      // Connector selection is always visible when active
    } else {
      if (this.activeSelectionType === 'transformer') {
        this.transformerManager.hide();
      } else if (this.activeSelectionType === 'connector') {
        this.connectorSelectionManager.clearSelection();
      }
    }
  }

  /**
   * Determine which selection system to use based on element types
   */
  private determineSelectionType(elementIds: string[]): 'transformer' | 'connector' {
    for (const id of elementIds) {
      const element = this.getElementById(id);
      if (element && element.type === 'connector') {
        // If any element is a connector, use connector selection
        // Note: Mixed selections with connectors default to connector mode
        return 'connector';
      }
    }
    
    return 'transformer';
  }

  /**
   * Find Konva nodes for given element IDs
   */
  private findElementNodes(elementIds: string[]): Konva.Node[] {
    const nodes: Konva.Node[] = [];
    
    for (const id of elementIds) {
      // Search in main layer for the element
      const node = this.stage.findOne(`#${id}`);
      if (node) {
        nodes.push(node);
      } else {
        // Alternative search by elementId attribute
        const found = this.stage.find((n: Konva.Node) => {
          const elementId = n.getAttr('elementId') || n.id();
          return elementId === id;
        });
        if (found.length > 0) {
          nodes.push(found[0]);
        }
      }
    }
    
    return nodes;
  }

  /**
   * Handle connector endpoint drag events
   */
  private handleConnectorEndpointDrag(
    connectorId: string,
    endpoint: 'from' | 'to',
    newPosition: { x: number; y: number }
  ) {
    // Default implementation - update connector endpoint in store
    const updateElement = StoreActions.updateElement;
    const withUndo = StoreActions.withUndo;

    if (!updateElement || !withUndo) return;

    const updates = {
      [endpoint]: {
        kind: "point" as const,
        x: Math.round(newPosition.x),
        y: Math.round(newPosition.y),
      }
    };

    withUndo?.(`Move connector ${endpoint} endpoint`, () => {
      updateElement(connectorId, updates);
    });
  }

  /**
   * Destroy and cleanup all managers
   */
  destroy() {
    this.transformerManager.destroy();
    this.connectorSelectionManager.destroy();
    this.selectedElementIds.clear();
    this.activeSelectionType = null;
  }
}

export default SelectionManager;