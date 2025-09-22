// PortHoverModule.ts
// Handles rendering of connection ports when hovering over connectable elements

import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";

interface ConnectableElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Port {
  id: string;
  elementId: string;
  position: { x: number; y: number };
  anchor: 'top' | 'right' | 'bottom' | 'left' | 'center';
}

export class PortHoverModule implements RendererModule {
  private storeCtx?: ModuleRendererCtx;
  private portGroup?: Konva.Group;
  private currentHoveredElement?: string;
  private hoverTimeout?: number;
  private ports: Map<string, Konva.Circle[]> = new Map();
  
  // Port configuration
  private readonly PORT_RADIUS = 6;
  private readonly PORT_FILL = '#4F46E5';
  private readonly PORT_STROKE = '#FFFFFF';
  private readonly PORT_STROKE_WIDTH = 2;
  private readonly HOVER_DELAY = 100; // ms delay before showing ports
  private readonly HIDE_DELAY = 300; // ms delay before hiding ports

  mount(ctx: ModuleRendererCtx): () => void {
    this.storeCtx = ctx;

    // Create port group on overlay layer
    this.portGroup = new Konva.Group({
      name: 'port-hover-group',
      listening: false, // Ports should not interfere with element selection
      visible: false
    });

    ctx.layers.overlay.add(this.portGroup);

    // Set up hover detection on main layer
    this.setupHoverDetection();

    console.debug('[PortHoverModule] Mounted successfully');

    return () => this.unmount();
  }

  private unmount() {
    this.clearHoverTimeout();
    this.hideAllPorts();
    
    if (this.portGroup) {
      this.portGroup.destroy();
      this.portGroup = undefined;
    }

    // Remove event listeners
    if (this.storeCtx) {
      this.storeCtx.layers.main.off('mouseover.port-hover');
      this.storeCtx.layers.main.off('mouseout.port-hover');
      this.storeCtx.stage.off('mousemove.port-hover');
    }

    console.debug('[PortHoverModule] Unmounted successfully');
  }

  private setupHoverDetection() {
    if (!this.storeCtx) return;

    const mainLayer = this.storeCtx.layers.main;
    const stage = this.storeCtx.stage;

    // Handle element hover
    mainLayer.on('mouseover.port-hover', (e) => {
      const target = e.target;
      if (!target) return;

      const elementId = this.getElementIdFromNode(target);
      if (!elementId) return;

      const element = this.getElement(elementId);
      if (!element || !this.isConnectable(element)) return;

      this.handleElementHover(elementId);
    });

    // Handle element mouse out
    mainLayer.on('mouseout.port-hover', (e) => {
      const target = e.target;
      if (!target) return;

      const elementId = this.getElementIdFromNode(target);
      if (!elementId) return;

      this.handleElementMouseOut(elementId);
    });

    // Handle stage mouse move for proximity detection
    stage.on('mousemove.port-hover', (e) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Check if mouse is near any ports to keep them visible
      this.checkPortProximity(pointer);
    });
  }

  private handleElementHover(elementId: string) {
    console.debug('[PortHoverModule] Element hovered:', elementId);

    // Clear any pending hide timeout
    this.clearHoverTimeout();

    // If already showing ports for this element, do nothing
    if (this.currentHoveredElement === elementId) {
      return;
    }

    // Hide current ports if showing different element
    if (this.currentHoveredElement && this.currentHoveredElement !== elementId) {
      this.hidePortsForElement(this.currentHoveredElement);
    }

    // Set timeout to show ports
    this.hoverTimeout = window.setTimeout(() => {
      this.showPortsForElement(elementId);
      this.currentHoveredElement = elementId;
    }, this.HOVER_DELAY);
  }

  private handleElementMouseOut(elementId: string) {
    console.debug('[PortHoverModule] Element mouse out:', elementId);

    // Only handle mouse out for currently hovered element
    if (this.currentHoveredElement !== elementId) {
      return;
    }

    // Clear any pending show timeout
    this.clearHoverTimeout();

    // Set timeout to hide ports
    this.hoverTimeout = window.setTimeout(() => {
      if (this.currentHoveredElement === elementId) {
        this.hidePortsForElement(elementId);
        this.currentHoveredElement = undefined;
      }
    }, this.HIDE_DELAY);
  }

  private checkPortProximity(pointer: { x: number; y: number }) {
    if (!this.currentHoveredElement || !this.portGroup?.visible()) {
      return;
    }

    const ports = this.ports.get(this.currentHoveredElement);
    if (!ports) return;

    // Check if mouse is within reasonable distance of any port
    const PROXIMITY_THRESHOLD = 50;
    let isNearPort = false;

    for (const port of ports) {
      const portPos = port.getAbsolutePosition();
      const distance = Math.sqrt(
        Math.pow(pointer.x - portPos.x, 2) + Math.pow(pointer.y - portPos.y, 2)
      );

      if (distance <= PROXIMITY_THRESHOLD) {
        isNearPort = true;
        break;
      }
    }

    // If mouse is not near any port and we have a timeout set, let it proceed
    // If mouse is near a port, clear any pending hide timeout
    if (isNearPort) {
      this.clearHoverTimeout();
    }
  }

  private showPortsForElement(elementId: string) {
    if (!this.storeCtx || !this.portGroup) return;

    const element = this.getElement(elementId);
    if (!element) return;

    console.debug('[PortHoverModule] Showing ports for element:', elementId);

    // Calculate port positions
    const ports = this.calculatePortPositions(element);
    
    // Create port visual elements
    const portNodes: Konva.Circle[] = [];
    
    for (const port of ports) {
      const portNode = new Konva.Circle({
        x: port.position.x,
        y: port.position.y,
        radius: this.PORT_RADIUS,
        fill: this.PORT_FILL,
        stroke: this.PORT_STROKE,
        strokeWidth: this.PORT_STROKE_WIDTH,
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        name: `port-${port.anchor}`,
        opacity: 0 // Start invisible for animation
      });

      this.portGroup.add(portNode);
      portNodes.push(portNode);

      // Animate port appearance
      new Konva.Tween({
        node: portNode,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.15,
        easing: Konva.Easings.EaseOut
      }).play();
    }

    // Store ports for this element
    this.ports.set(elementId, portNodes);
    this.portGroup.visible(true);
    this.storeCtx.layers.overlay.batchDraw();
  }

  private hidePortsForElement(elementId: string) {
    const ports = this.ports.get(elementId);
    if (!ports) return;

    console.debug('[PortHoverModule] Hiding ports for element:', elementId);

    // Animate ports disappearance
    const animations = ports.map(port => {
      return new Promise<void>((resolve) => {
        new Konva.Tween({
          node: port,
          opacity: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 0.1,
          easing: Konva.Easings.EaseIn,
          onFinish: () => {
            port.destroy();
            resolve();
          }
        }).play();
      });
    });

    Promise.all(animations).then(() => {
      this.ports.delete(elementId);
      
      // Hide port group if no ports are visible
      if (this.ports.size === 0 && this.portGroup) {
        this.portGroup.visible(false);
      }
      
      if (this.storeCtx) {
        this.storeCtx.layers.overlay.batchDraw();
      }
    });
  }

  private hideAllPorts() {
    for (const elementId of this.ports.keys()) {
      this.hidePortsForElement(elementId);
    }
    this.currentHoveredElement = undefined;
  }

  private calculatePortPositions(element: ConnectableElement): Port[] {
    const ports: Port[] = [];
    const { x, y, width, height } = element;

    // Calculate port positions based on element bounds
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Define port positions
    const portPositions = [
      { anchor: 'top' as const, x: centerX, y: y },
      { anchor: 'right' as const, x: x + width, y: centerY },
      { anchor: 'bottom' as const, x: centerX, y: y + height },
      { anchor: 'left' as const, x: x, y: centerY }
    ];

    // Add center port for some element types
    if (this.shouldShowCenterPort(element.type)) {
      portPositions.push({
        anchor: 'center' as const,
        x: centerX,
        y: centerY
      });
    }

    for (const pos of portPositions) {
      ports.push({
        id: `${element.id}-port-${pos.anchor}`,
        elementId: element.id,
        position: { x: pos.x, y: pos.y },
        anchor: pos.anchor
      });
    }

    return ports;
  }

  private shouldShowCenterPort(elementType: string): boolean {
    // Show center port for circular elements
    return elementType === 'circle' || elementType === 'ellipse';
  }

  private isConnectable(element: any): boolean {
    if (!element || !element.type) return false;

    // Define which element types can have connectors
    const connectableTypes = [
      'sticky-note',
      'rectangle',
      'circle',
      'triangle',
      'shape',
      'text',
      'image',
      'table',
      'mindmap'
    ];

    return connectableTypes.includes(element.type);
  }

  private getElementIdFromNode(node: Konva.Node): string | null {
    // Try different methods to get element ID
    const elementId = node.getAttr('elementId') || node.id();
    if (elementId) return elementId;

    // Check parent nodes
    let parent = node.getParent();
    while (parent && parent !== this.storeCtx?.layers.main) {
      const parentElementId = parent.getAttr('elementId') || parent.id();
      if (parentElementId) return parentElementId;
      parent = parent.getParent();
    }

    return null;
  }

  private getElement(elementId: string): ConnectableElement | null {
    if (!this.storeCtx) return null;

    const state = this.storeCtx.store.getState();
    const element = state.elements?.get?.(elementId) || state.element?.getById?.(elementId);
    
    if (!element) return null;

    // Find the corresponding Konva node to get current position and size
    const nodes = this.storeCtx.layers.main.find((node: Konva.Node) => {
      const nodeElementId = node.getAttr('elementId') || node.id();
      return nodeElementId === elementId;
    });

    if (nodes.length === 0) return null;

    const node = nodes[0];
    const rect = node.getClientRect({ skipTransform: false });

    return {
      id: elementId,
      type: element.type,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  }

  private clearHoverTimeout() {
    if (this.hoverTimeout) {
      window.clearTimeout(this.hoverTimeout);
      this.hoverTimeout = undefined;
    }
  }

  /**
   * Public method to force hide all ports (useful when selection changes)
   */
  public forceHideAllPorts(): void {
    this.clearHoverTimeout();
    this.hideAllPorts();
  }

  /**
   * Public method to check if ports are currently visible
   */
  public arePortsVisible(): boolean {
    return this.portGroup?.visible() ?? false;
  }

  /**
   * Public method to get currently hovered element
   */
  public getCurrentHoveredElement(): string | undefined {
    return this.currentHoveredElement;
  }
}