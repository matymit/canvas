// ConnectorSelectionManager.ts
// Custom selection system for connector elements with endpoint dots only
// Parallel to the standard TransformerManager selection system

import Konva from "konva";
import type { ConnectorElement } from "../types/connector";
import { StoreSelectors, StoreActions } from "../stores/facade";

export interface ConnectorSelectionOptions {
  overlayLayer: Konva.Layer;
  endpointColor?: string;
  endpointRadius?: number;
  endpointStroke?: string;
  endpointStrokeWidth?: number;
  onEndpointDrag?: (connectorId: string, endpoint: 'from' | 'to', newPosition: { x: number; y: number }) => void;
}

export class ConnectorSelectionManager {
  private stage: Konva.Stage;
  private overlayLayer: Konva.Layer;
  // facade-based access
  private options: Required<ConnectorSelectionOptions>;

  // Track selected connector and its endpoint dots
  private selectedConnectorId: string | null = null;
  private endpointGroup: Konva.Group | null = null;
  private fromDot: Konva.Circle | null = null;
  private toDot: Konva.Circle | null = null;

  // Drag state
  private dragState: {
    isDragging: boolean;
    endpoint: 'from' | 'to' | null;
    startPos: { x: number; y: number } | null;
  } = {
    isDragging: false,
    endpoint: null,
    startPos: null
  };

  constructor(
    stage: Konva.Stage,
    options: ConnectorSelectionOptions
  ) {
    this.stage = stage;
    this.overlayLayer = options.overlayLayer;

    // Set default options
    this.options = {
      overlayLayer: options.overlayLayer,
      endpointColor: options.endpointColor || "#4F46E5",
      endpointRadius: options.endpointRadius || 6,
      endpointStroke: options.endpointStroke || "#FFFFFF",
      endpointStrokeWidth: options.endpointStrokeWidth || 2,
      onEndpointDrag: options.onEndpointDrag || (() => {}),
    };
  }

  /**
   * Show selection for a specific connector element
   */
  showSelection(connectorId: string): void {
    // Clear any existing selection
    this.clearSelection();

    this.selectedConnectorId = connectorId;

    // Get connector element from store
    const connector = this.getConnectorElement(connectorId);
    if (!connector) return;

    // Create endpoint dots
    this.createEndpointDots(connector);
  }

  /**
   * Clear the current connector selection
   */
  clearSelection(): void {
    if (this.endpointGroup) {
      this.endpointGroup.destroy();
      this.endpointGroup = null;
    }

    this.fromDot = null;
    this.toDot = null;
    this.selectedConnectorId = null;
    this.dragState = {
      isDragging: false,
      endpoint: null,
      startPos: null
    };

    this.overlayLayer.batchDraw();
  }

  /**
   * Check if a connector is currently selected
   */
  isConnectorSelected(connectorId: string): boolean {
    return this.selectedConnectorId === connectorId;
  }

  /**
   * Get the currently selected connector ID
   */
  getSelectedConnectorId(): string | null {
    return this.selectedConnectorId;
  }

  /**
   * Refresh the selection if connector has moved/changed
   */
  refreshSelection(): void {
    if (!this.selectedConnectorId) return;

    const connector = this.getConnectorElement(this.selectedConnectorId);
    if (!connector) {
      this.clearSelection();
      return;
    }

    this.updateEndpointPositions(connector);
  }

  private getConnectorElement(connectorId: string): ConnectorElement | null {
    const el = StoreSelectors.getElementById(connectorId) as any;
    return el && el.type === 'connector' ? (el as ConnectorElement) : null;
  }

  private createEndpointDots(connector: ConnectorElement): void {
    // Create group for endpoint dots
    this.endpointGroup = new Konva.Group({
      name: "connector-endpoints",
      listening: true,
    });

    // Resolve endpoint positions
    const fromPos = this.resolveEndpointPosition(connector.from);
    const toPos = this.resolveEndpointPosition(connector.to);

    if (!fromPos || !toPos) return;

    // Create "from" endpoint dot
    this.fromDot = new Konva.Circle({
      x: fromPos.x,
      y: fromPos.y,
      radius: this.options.endpointRadius,
      fill: this.options.endpointColor,
      stroke: this.options.endpointStroke,
      strokeWidth: this.options.endpointStrokeWidth,
      draggable: true,
      name: "from-endpoint",
      listening: true,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Create "to" endpoint dot
    this.toDot = new Konva.Circle({
      x: toPos.x,
      y: toPos.y,
      radius: this.options.endpointRadius,
      fill: this.options.endpointColor,
      stroke: this.options.endpointStroke,
      strokeWidth: this.options.endpointStrokeWidth,
      draggable: true,
      name: "to-endpoint",
      listening: true,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    });

    // Add drag handlers
    this.setupEndpointDragHandlers(this.fromDot, 'from');
    this.setupEndpointDragHandlers(this.toDot, 'to');

    // Add dots to group
    this.endpointGroup.add(this.fromDot);
    this.endpointGroup.add(this.toDot);

    // Add group to overlay layer
    this.overlayLayer.add(this.endpointGroup);
    this.overlayLayer.batchDraw();
  }

  private setupEndpointDragHandlers(dot: Konva.Circle, endpoint: 'from' | 'to'): void {
    dot.on('dragstart', () => {
      this.dragState.isDragging = true;
      this.dragState.endpoint = endpoint;
      this.dragState.startPos = { x: dot.x(), y: dot.y() };

      // Change cursor to grabbing
      this.stage.container().style.cursor = 'grabbing';
    });

    dot.on('dragmove', () => {
      if (!this.selectedConnectorId || !this.dragState.isDragging) return;

      const newPos = { x: dot.x(), y: dot.y() };

      // Call drag callback for real-time updates
      this.options.onEndpointDrag(this.selectedConnectorId, endpoint, newPos);
    });

    dot.on('dragend', () => {
      if (!this.selectedConnectorId || !this.dragState.isDragging) return;

      const newPos = { x: dot.x(), y: dot.y() };

      // Update connector endpoint in store
      this.updateConnectorEndpoint(this.selectedConnectorId, endpoint, newPos);

      // Reset drag state
      this.dragState = {
        isDragging: false,
        endpoint: null,
        startPos: null
      };

      // Reset cursor
      this.stage.container().style.cursor = 'default';
    });

    // Hover effects
    dot.on('mouseenter', () => {
      this.stage.container().style.cursor = 'grab';
      dot.strokeWidth(this.options.endpointStrokeWidth + 1);
      this.overlayLayer.batchDraw();
    });

    dot.on('mouseleave', () => {
      if (!this.dragState.isDragging) {
        this.stage.container().style.cursor = 'default';
      }
      dot.strokeWidth(this.options.endpointStrokeWidth);
      this.overlayLayer.batchDraw();
    });
  }

  private resolveEndpointPosition(endpoint: ConnectorElement['from']): { x: number; y: number } | null {
    if (endpoint.kind === "point") {
      return { x: endpoint.x, y: endpoint.y };
    }

    // Find the referenced element node
    const elementNode = this.findElementNode(endpoint.elementId);
    if (!elementNode) return null;

    const rect = elementNode.getClientRect({ skipStroke: true, skipShadow: true });
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    let x = cx;
    let y = cy;

    // Calculate anchor position
    switch (endpoint.anchor) {
      case "left":
        x = rect.x;
        y = cy;
        break;
      case "right":
        x = rect.x + rect.width;
        y = cy;
        break;
      case "top":
        x = cx;
        y = rect.y;
        break;
      case "bottom":
        x = cx;
        y = rect.y + rect.height;
        break;
      case "center":
      default:
        x = cx;
        y = cy;
        break;
    }

    // Apply offset if present
    if (endpoint.offset) {
      x += endpoint.offset.dx;
      y += endpoint.offset.dy;
    }

    return { x, y };
  }

  private findElementNode(elementId: string): Konva.Node | null {
    // Search in main layer for the element
    const layers = this.stage.getLayers();
    const mainLayer = layers[1]; // Assuming four-layer pipeline: [background, main, preview, overlay]

    if (!mainLayer) return null;

    // Find node with matching elementId attribute or id
    const candidates = mainLayer.find((node: Konva.Node) => {
      const nodeElementId = node.getAttr("elementId") || node.id();
      return nodeElementId === elementId;
    });

    if (candidates.length > 0) {
      // Prefer groups over individual shapes
      const group = candidates.find(
        (n) => n.className === "Group" || n.name().includes("group")
      );
      return group || candidates[0];
    }

    return null;
  }

  private updateEndpointPositions(connector: ConnectorElement): void {
    if (!this.fromDot || !this.toDot) return;

    const fromPos = this.resolveEndpointPosition(connector.from);
    const toPos = this.resolveEndpointPosition(connector.to);

    if (fromPos) {
      this.fromDot.position(fromPos);
    }

    if (toPos) {
      this.toDot.position(toPos);
    }

    this.overlayLayer.batchDraw();
  }

  private updateConnectorEndpoint(
    connectorId: string,
    endpoint: 'from' | 'to',
    newPosition: { x: number; y: number }
  ): void {
    const updateElement = StoreActions.updateElement;
    const withUndo = StoreActions.withUndo;

    // Update the connector endpoint to be a point
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
   * Destroy the selection manager and clean up resources
   */
  destroy(): void {
    this.clearSelection();
  }
}