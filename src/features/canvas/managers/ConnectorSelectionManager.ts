// ConnectorSelectionManager.ts
// Custom selection system for connector elements with endpoint dots only
// Parallel to the standard TransformerManager selection system

import Konva from "konva";
import type { CanvasElement } from "../../../../types";
import type { ConnectorElement } from "../types/connector";
import { StoreSelectors, StoreActions } from "../stores/facade";
import { getWorldPointer } from "../utils/pointer";

export interface ConnectorSelectionOptions {
  overlayLayer: Konva.Layer;
  endpointColor?: string;
  endpointRadius?: number;
  endpointStroke?: string;
  endpointStrokeWidth?: number;
  onEndpointDrag?: (connectorId: string, endpoint: 'from' | 'to', newPosition: { x: number; y: number }) => void;
}

export class ConnectorSelectionManager {
  private readonly stage: Konva.Stage;
  private readonly overlayLayer: Konva.Layer;
  // facade-based access
  private readonly options: Required<ConnectorSelectionOptions>;

  // Track selected connector and its endpoint dots
  private selectedConnectorId: string | null = null;
  private endpointGroup: Konva.Group | null = null;
  private fromDot: Konva.Circle | null = null;
  private toDot: Konva.Circle | null = null;
  private dragLine: Konva.Line | null = null;
  private dragBaseline: {
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null = null;

  private pointerMoveListener?: (evt: Konva.KonvaEventObject<PointerEvent>) => void;
  private pointerUpListener?: (evt: Konva.KonvaEventObject<PointerEvent>) => void;
  private pointerCancelListener?: (evt: Konva.KonvaEventObject<PointerEvent>) => void;
  private activeConnectorShape: Konva.Shape | null = null;

  // Drag state
  private dragState: {
    isDragging: boolean;
    endpoint: 'from' | 'to' | 'all' | null;
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
    this.dragLine = null;
    this.dragBaseline = null;
    if (this.pointerMoveListener) {
      this.stage.off('pointermove.connector-drag', this.pointerMoveListener);
      this.pointerMoveListener = undefined;
    }
    if (this.pointerUpListener) {
      this.stage.off('pointerup.connector-drag', this.pointerUpListener);
      this.pointerUpListener = undefined;
    }
    if (this.pointerCancelListener) {
      this.stage.off('pointercancel.connector-drag', this.pointerCancelListener);
      this.pointerCancelListener = undefined;
    }
    this.activeConnectorShape = null;
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
    const element = StoreSelectors.getElementById(connectorId);
    if (element?.type === 'connector') {
      return element as ConnectorElement;
    }
    return null;
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

    this.dragBaseline = {
      from: { x: fromPos.x, y: fromPos.y },
      to: { x: toPos.x, y: toPos.y },
    };

    const allowWholeDrag =
      connector.from.kind === 'point' && connector.to.kind === 'point';

    this.dragLine = new Konva.Line({
      points: [fromPos.x, fromPos.y, toPos.x, toPos.y],
      stroke: 'transparent',
      strokeWidth: Math.max(connector.style.strokeWidth, 2),
      hitStrokeWidth: Math.max(connector.style.strokeWidth, 24),
      listening: allowWholeDrag,
      name: 'connector-hit-line',
      perfectDrawEnabled: false,
    });
    if (allowWholeDrag) {
      this.setupWholeConnectorDragHandlers(this.dragLine);
    }
    this.endpointGroup.add(this.dragLine);
    this.dragLine.moveToBottom();

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

  private setupWholeConnectorDragHandlers(line: Konva.Line): void {
    line.on('pointerenter', () => {
      if (line.listening() && !this.dragState.isDragging) {
        this.stage.container().style.cursor = 'grab';
      }
    });

    line.on('pointerleave', () => {
      if (!this.dragState.isDragging) {
        this.stage.container().style.cursor = 'default';
      }
    });

    line.on('pointerdown', (evt) => {
      if (!line.listening()) return;
      if (!this.selectedConnectorId || !this.dragBaseline) return;

      evt.cancelBubble = true;
      const pointer = getWorldPointer(this.stage);
      if (!pointer) return;

      const connectorGroup = this.stage.findOne<Konva.Group>(`#${this.selectedConnectorId}`);
      const connectorShape = connectorGroup?.findOne<Konva.Shape>('.connector-shape');
      this.activeConnectorShape = connectorShape || null;

      this.dragState.isDragging = true;
      this.dragState.endpoint = 'all';
      this.dragState.startPos = { x: pointer.x, y: pointer.y };
      this.stage.container().style.cursor = 'grabbing';

      if (this.pointerMoveListener) {
        this.stage.off('pointermove.connector-drag', this.pointerMoveListener);
      }
      if (this.pointerUpListener) {
        this.stage.off('pointerup.connector-drag', this.pointerUpListener);
      }
      if (this.pointerCancelListener) {
        this.stage.off('pointercancel.connector-drag', this.pointerCancelListener);
      }

      this.pointerMoveListener = () => {
        if (!this.dragState.startPos) return;
        const current = getWorldPointer(this.stage);
        if (!current) return;
        const dx = current.x - this.dragState.startPos.x;
        const dy = current.y - this.dragState.startPos.y;
        this.applyWholeConnectorPreview(dx, dy);
      };

      this.pointerUpListener = () => {
        if (!this.dragState.startPos) {
          this.cleanupWholeDragListeners();
          return;
        }
        const current = getWorldPointer(this.stage);
        const dx = current ? current.x - this.dragState.startPos.x : 0;
        const dy = current ? current.y - this.dragState.startPos.y : 0;
        this.commitWholeConnectorDrag(dx, dy);
        this.cleanupWholeDragListeners();
      };

      this.pointerCancelListener = () => {
        this.applyWholeConnectorPreview(0, 0);
        this.cleanupWholeDragListeners();
      };

      this.stage.on('pointermove.connector-drag', this.pointerMoveListener);
      this.stage.on('pointerup.connector-drag', this.pointerUpListener);
      this.stage.on('pointercancel.connector-drag', this.pointerCancelListener);
    });
  }

  private cleanupWholeDragListeners(): void {
    if (this.pointerMoveListener) {
      this.stage.off('pointermove.connector-drag', this.pointerMoveListener);
      this.pointerMoveListener = undefined;
    }
    if (this.pointerUpListener) {
      this.stage.off('pointerup.connector-drag', this.pointerUpListener);
      this.pointerUpListener = undefined;
    }
    if (this.pointerCancelListener) {
      this.stage.off('pointercancel.connector-drag', this.pointerCancelListener);
      this.pointerCancelListener = undefined;
    }
    this.dragState = {
      isDragging: false,
      endpoint: null,
      startPos: null,
    };
    this.stage.container().style.cursor = 'default';
    this.activeConnectorShape = null;
  }

  private applyWholeConnectorPreview(dx: number, dy: number): void {
    if (!this.dragBaseline || !this.fromDot || !this.toDot || !this.dragLine) {
      return;
    }

    const from = {
      x: this.dragBaseline.from.x + dx,
      y: this.dragBaseline.from.y + dy,
    };
    const to = {
      x: this.dragBaseline.to.x + dx,
      y: this.dragBaseline.to.y + dy,
    };

    this.fromDot.position(from);
    this.toDot.position(to);
    this.dragLine.points([from.x, from.y, to.x, to.y]);
    if (this.activeConnectorShape) {
      const shape = this.activeConnectorShape;
      if (shape instanceof Konva.Line || shape instanceof Konva.Arrow) {
        shape.points([from.x, from.y, to.x, to.y]);
        shape.getLayer()?.batchDraw();
      }
    }
    this.overlayLayer.batchDraw();
  }

  private commitWholeConnectorDrag(dx: number, dy: number): void {
    if (!this.selectedConnectorId || !this.dragBaseline) {
      this.applyWholeConnectorPreview(0, 0);
      return;
    }

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      this.applyWholeConnectorPreview(0, 0);
      return;
    }

    const connector = this.getConnectorElement(this.selectedConnectorId);
    if (!connector) {
      this.applyWholeConnectorPreview(0, 0);
      return;
    }

    const fromEndpoint = {
      kind: 'point' as const,
      x: Math.round(this.dragBaseline.from.x + dx),
      y: Math.round(this.dragBaseline.from.y + dy),
    };
    const toEndpoint = {
      kind: 'point' as const,
      x: Math.round(this.dragBaseline.to.x + dx),
      y: Math.round(this.dragBaseline.to.y + dy),
    };

    this.updateConnectorEndpoints(this.selectedConnectorId, fromEndpoint, toEndpoint);

    this.dragBaseline = {
      from: { x: fromEndpoint.x, y: fromEndpoint.y },
      to: { x: toEndpoint.x, y: toEndpoint.y },
    };

    this.applyWholeConnectorPreview(0, 0);
  }

  private resolveEndpointPosition(endpoint: ConnectorElement['from']): { x: number; y: number } | null {
    if (endpoint.kind === "point") {
      return { x: endpoint.x, y: endpoint.y };
    }

    // Find the referenced element node
    const elementNode = this.findElementNode(endpoint.elementId);
    if (!elementNode) return null;

        const rect = elementNode.getClientRect({ skipStroke: true, skipShadow: true });
    const stageTransform = this.stage.getAbsoluteTransform().copy().invert();
    const topLeft = stageTransform.point({ x: rect.x, y: rect.y });
    const bottomRight = stageTransform.point({ x: rect.x + rect.width, y: rect.y + rect.height });

    const minX = Math.min(topLeft.x, bottomRight.x);
    const minY = Math.min(topLeft.y, bottomRight.y);
    const maxX = Math.max(topLeft.x, bottomRight.x);
    const maxY = Math.max(topLeft.y, bottomRight.y);

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    let x = cx;
    let y = cy;

    switch (endpoint.anchor) {
      case "left":
        x = minX;
        y = cy;
        break;
      case "right":
        x = maxX;
        y = cy;
        break;
      case "top":
        x = cx;
        y = minY;
        break;
      case "bottom":
        x = cx;
        y = maxY;
        break;
      case "center":
      default:
        x = cx;
        y = cy;
        break;
    }

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

    if (fromPos && toPos && this.dragLine) {
      this.dragLine.points([fromPos.x, fromPos.y, toPos.x, toPos.y]);
    }

    if (fromPos && toPos && this.dragBaseline) {
      this.dragBaseline = {
        from: { x: fromPos.x, y: fromPos.y },
        to: { x: toPos.x, y: toPos.y },
      };
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
        kind: 'point' as const,
        x: Math.round(newPosition.x),
        y: Math.round(newPosition.y),
      },
    };

    withUndo?.(`Move connector ${endpoint} endpoint`, () => {
      updateElement(connectorId, updates);
    });
  }

  private updateConnectorEndpoints(
    connectorId: string,
    from: ConnectorElement['from'],
    to: ConnectorElement['to'],
  ): void {
    const updateElement = StoreActions.updateElement;
    const withUndo = StoreActions.withUndo;

    if (!updateElement) {
      return;
    }

    const patch = { from, to } as unknown as Partial<CanvasElement>;

    if (withUndo) {
      withUndo('Move connector', () => {
        updateElement(connectorId, patch);
      });
    } else {
      updateElement(connectorId, patch);
    }
  }

  /**
   * Destroy the selection manager and clean up resources
   */
  destroy(): void {
    this.clearSelection();
  }
}
