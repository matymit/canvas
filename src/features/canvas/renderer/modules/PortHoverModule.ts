// PortHoverModule.ts
// Handles rendering of connection ports when hovering over connectable elements

import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import type {
  ConnectorPort,
  ConnectorToolHandle,
} from "../../types/connectorTool";

interface ConnectableElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PortHoverModule implements RendererModule {
  private storeCtx?: ModuleRendererCtx;
  private portGroup?: Konva.Group;
  private currentHoveredElement?: string;
  private hoverTimeout?: number;
  private readonly ports: Map<string, Konva.Circle[]> = new Map();
  private storeUnsubscribe?: () => void;

  // Port configuration
  private readonly PORT_RADIUS = 6;
  private readonly PORT_FILL = "#4F46E5";
  private readonly PORT_STROKE = "#FFFFFF";
  private readonly PORT_STROKE_WIDTH = 2;
  private readonly HOVER_DELAY = 100; // ms delay before showing ports
  private readonly HIDE_DELAY = 300; // ms delay before hiding ports
  // CRITICAL FIX: Enhanced hit radius for better circle precision
  private readonly PORT_HIT_RADIUS_CIRCLE = 18; // Larger radius for trigonometric precision on circles
  private readonly PORT_HIT_RADIUS_RECT = 12; // Standard radius for rectangles

  mount(ctx: ModuleRendererCtx): () => void {
    this.storeCtx = ctx;

    // Create port group on overlay layer
    this.portGroup = new Konva.Group({
      name: "port-hover-group",
      listening: true, // CRITICAL FIX: Enable port interaction
      visible: false,
    });

    ctx.layers.overlay.add(this.portGroup);

    // Set up hover detection on main layer
    this.setupHoverDetection();

    // CRITICAL FIX: Subscribe to element updates to refresh port positions
    this.setupStoreSubscriptions();

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
      this.storeCtx.layers.main.off("mouseover.port-hover");
      this.storeCtx.layers.main.off("mouseout.port-hover");
      this.storeCtx.stage.off("mousemove.port-hover");
    }

    // Unsubscribe from store updates
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = undefined;
    }
  }

  private setupHoverDetection() {
    if (!this.storeCtx) return;

    const mainLayer = this.storeCtx.layers.main;
    const stage = this.storeCtx.stage;

    // Handle element hover
    mainLayer.on("mouseover.port-hover", (e) => {
      const target = e.target;
      if (!target) return;

      const elementId = this.getElementIdFromNode(target);
      if (!elementId) return;

      const element = this.getElement(elementId);
      if (!element || !this.isConnectable(element)) return;

      this.handleElementHover(elementId);
    });

    // Handle element mouse out
    mainLayer.on("mouseout.port-hover", (e) => {
      const target = e.target;
      if (!target) return;

      const elementId = this.getElementIdFromNode(target);
      if (!elementId) return;

      this.handleElementMouseOut(elementId);
    });

    // Handle stage mouse move for proximity detection
    stage.on("mousemove.port-hover", () => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // If hovering a connector, hide all ports immediately
      const hit = stage.getIntersection(pointer) as Konva.Node | null;
      if (hit) {
        const isConnector =
          hit.name?.() === "connector" ||
          hit.getAttr?.("elementType") === "connector" ||
          hit.getAttr?.("nodeType") === "connector" ||
          hit.getParent?.()?.name?.() === "connector";
        if (isConnector) {
          this.hideAllPorts();
          return;
        }
      }

      // Check if mouse is near any ports to keep them visible
      this.checkPortProximity(pointer);
    });
  }

  private handleElementHover(elementId: string) {
    // CRITICAL FIX: Only show ports when connector tools are active
    if (!this.shouldShowPorts()) {
      return;
    }

    // Clear any pending hide timeout
    this.clearHoverTimeout();

    // If already showing ports for this element, do nothing
    if (this.currentHoveredElement === elementId) {
      return;
    }

    // Hide current ports if showing different element
    if (
      this.currentHoveredElement &&
      this.currentHoveredElement !== elementId
    ) {
      this.hidePortsForElement(this.currentHoveredElement);
    }

    // Set timeout to show ports
    this.hoverTimeout = window.setTimeout(() => {
      this.showPortsForElement(elementId);
      this.currentHoveredElement = elementId;
    }, this.HOVER_DELAY);
  }

  private handleElementMouseOut(elementId: string) {
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
        Math.pow(pointer.x - portPos.x, 2) + Math.pow(pointer.y - portPos.y, 2),
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

    // Calculate port positions
    const ports = this.calculatePortPositions(element);

    // Create port visual elements
    const portNodes: Konva.Circle[] = [];

    for (const port of ports) {
      // Create visual port dot
      const portNode = new Konva.Circle({
        x: port.position.x,
        y: port.position.y,
        radius: this.PORT_RADIUS,
        fill: this.PORT_FILL,
        stroke: this.PORT_STROKE,
        strokeWidth: this.PORT_STROKE_WIDTH,
        listening: false, // Visual only
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        name: `port-${port.anchor}`,
        opacity: 0, // Start invisible for animation
      });

      // CRITICAL FIX: Use appropriate hit radius based on element type for better precision
      const element = this.getElement(port.elementId);
      const isCircular = element ? this.isElementCircular(element) : false;
      const hitRadius = isCircular
        ? this.PORT_HIT_RADIUS_CIRCLE
        : this.PORT_HIT_RADIUS_RECT;

      // Create larger invisible hit area for reliable clicking
      const hitArea = new Konva.Circle({
        x: port.position.x,
        y: port.position.y,
        radius: hitRadius,
        fill: "transparent",
        listening: true, // CRITICAL FIX: Enable click detection
        perfectDrawEnabled: false,
        name: `port-hit-${port.anchor}`,
        opacity: 0, // Invisible
        // Store port data for event handling
        elementId: port.elementId,
        anchor: port.anchor,
        portData: port,
      });

      // Add click handler to hit area
      hitArea.on("pointerdown", (e) => {
        e.cancelBubble = true;
        this.handlePortClick(port, e);
      });

      this.portGroup.add(portNode);
      this.portGroup.add(hitArea);
      portNodes.push(portNode);

      // Animate port appearance
      new Konva.Tween({
        node: portNode,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 0.15,
        easing: Konva.Easings.EaseOut,
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

    // Animate ports disappearance
    const animations = ports.map((port) => {
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
          },
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

  /**
   * Public method: hide ports immediately (no animations) – used after committing a connector
   */
  public hideNow(): void {
    if (!this.portGroup) return;
    for (const elementId of Array.from(this.ports.keys())) {
      const circles = this.ports.get(elementId) || [];
      circles.forEach((c) => c.destroy());
      this.ports.delete(elementId);
    }
    this.portGroup.visible(false);
    if (this.storeCtx) this.storeCtx.layers.overlay.batchDraw();
    this.currentHoveredElement = undefined;
  }

  private calculatePortPositions(element: ConnectableElement): ConnectorPort[] {
    const ports: ConnectorPort[] = [];
    const { x, y, width, height } = element;

    // CRITICAL FIX: Use same comprehensive circle detection as AnchorSnapping.ts and ConnectorRenderer.ts
    // This ensures consistent circle detection across all modules
    const isCircular = this.isElementCircular(element);

    if (isCircular) {
      // For circles/ellipses, use center + radius with trigonometric positioning
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const radiusX = width / 2; // For ellipses, this is the horizontal radius
      const radiusY = height / 2; // For ellipses, this is the vertical radius

      // Calculate port positions on the circle/ellipse perimeter using trigonometry
      // Use standard angles: 0° (right), 90° (bottom), 180° (left), 270° (top)
      const portPositions: Array<{
        anchor: ConnectorPort["anchor"];
        x: number;
        y: number;
      }> = [
        {
          anchor: "right" as const,
          x: centerX + radiusX * Math.cos(0), // 0 radians = rightmost point
          y: centerY + radiusY * Math.sin(0),
        },
        {
          anchor: "bottom" as const,
          x: centerX + radiusX * Math.cos(Math.PI / 2), // π/2 radians = bottommost point
          y: centerY + radiusY * Math.sin(Math.PI / 2),
        },
        {
          anchor: "left" as const,
          x: centerX + radiusX * Math.cos(Math.PI), // π radians = leftmost point
          y: centerY + radiusY * Math.sin(Math.PI),
        },
        {
          anchor: "top" as const,
          x: centerX + radiusX * Math.cos((3 * Math.PI) / 2), // 3π/2 radians = topmost point
          y: centerY + radiusY * Math.sin((3 * Math.PI) / 2),
        },
      ];

      // Always add center port for circular elements
      portPositions.push({
        anchor: "center" as const,
        x: centerX,
        y: centerY,
      });

      for (const pos of portPositions) {
        ports.push({
          id: `${element.id}-port-${pos.anchor}`,
          elementId: element.id,
          position: { x: pos.x, y: pos.y },
          anchor: pos.anchor,
        });
      }
    } else {
      // For rectangular elements, use existing logic
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      // Define port positions using same logic as AnchorSnapping for consistency
      const portPositions: Array<{
        anchor: ConnectorPort["anchor"];
        x: number;
        y: number;
      }> = [
        { anchor: "left" as const, x: x, y: centerY },
        { anchor: "right" as const, x: x + width, y: centerY },
        { anchor: "top" as const, x: centerX, y: y },
        { anchor: "bottom" as const, x: centerX, y: y + height },
      ];

      // Add center port for some element types
      if (this.shouldShowCenterPort(element.type)) {
        portPositions.push({
          anchor: "center" as const,
          x: centerX,
          y: centerY,
        });
      }

      for (const pos of portPositions) {
        ports.push({
          id: `${element.id}-port-${pos.anchor}`,
          elementId: element.id,
          position: { x: pos.x, y: pos.y },
          anchor: pos.anchor,
        });
      }
    }

    return ports;
  }

  private shouldShowCenterPort(elementType: string): boolean {
    // Show center port for circular elements
    return elementType === "circle" || elementType === "ellipse";
  }

  /**
   * CRITICAL FIX: Comprehensive circle detection matching AnchorSnapping.ts and ConnectorRenderer.ts
   * This ensures consistent circle detection across all modules to prevent coordinate system mismatches
   */
  private isElementCircular(element: ConnectableElement): boolean {
    if (!element || !element.type) return false;

    // First check element.type for backward compatibility
    if (element.type === "circle" || element.type === "ellipse") {
      return true;
    }

    // For more robust detection, try to find the Konva node and check its attributes
    // This matches the detection logic used in AnchorSnapping.ts and ConnectorRenderer.ts
    if (this.storeCtx) {
      const nodes = this.storeCtx.layers.main.find((node: Konva.Node) => {
        const nodeElementId = node.getAttr("elementId") || node.id();
        return nodeElementId === element.id;
      });

      if (nodes.length > 0) {
        const node = nodes[0];
        const elementType = node.getAttr("elementType") || node.name() || "";
        const isCircularByType =
          elementType.includes("circle") || elementType.includes("ellipse");
        const isCircularByShape =
          node.getAttr("shapeType") === "circle" ||
          node.getAttr("shapeType") === "ellipse";

        return isCircularByType || isCircularByShape;
      }
    }

    // Fallback: check if element type contains circle/ellipse keywords
    const elementTypeStr = element.type?.toLowerCase() || "";
    return (
      elementTypeStr.includes("circle") || elementTypeStr.includes("ellipse")
    );
  }

  private isConnectable(element: ConnectableElement): boolean {
    if (!element || !element.type) return false;

    // Define which element types can have connectors
    const connectableTypes = [
      "sticky-note",
      "rectangle",
      "circle",
      "triangle",
      "shape",
      "text",
      "image",
      "table",
      "mindmap",
    ];

    return connectableTypes.includes(element.type);
  }

  private getElementIdFromNode(node: Konva.Node): string | null {
    // Try different methods to get element ID
    const elementId = node.getAttr("elementId") || node.id();
    if (elementId) return elementId;

    // Check parent nodes
    let parent = node.getParent();
    while (parent && parent !== this.storeCtx?.layers.main) {
      const parentElementId = parent.getAttr("elementId") || parent.id();
      if (parentElementId) return parentElementId;
      parent = parent.getParent();
    }

    return null;
  }

  private getElement(elementId: string): ConnectableElement | null {
    if (!this.storeCtx) return null;

    const state = this.storeCtx.store.getState();
    const element =
      state.elements.get(elementId) ?? state.element?.getById?.(elementId);

    if (!element) return null;

    // Find the corresponding Konva node to get current position and size
    const nodes = this.storeCtx.layers.main.find((node: Konva.Node) => {
      const nodeElementId = node.getAttr("elementId") || node.id();
      return nodeElementId === elementId;
    });

    if (nodes.length === 0) return null;

    const node = nodes[0];
    // CRITICAL FIX: Use same coordinate calculation as AnchorSnapping for consistency
    // Skip stroke and shadow for perfect seam, use stage coordinates
    const rect = node.getClientRect({
      skipTransform: false,
      skipStroke: true,
      skipShadow: true,
      relativeTo: this.storeCtx.stage, // Ensure stage coordinates for consistency
    });

    return {
      id: elementId,
      type: element.type,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
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

  /**
   * Handle port click events - integrate with ConnectorTool
   */
  private handlePortClick(port: ConnectorPort, e: Konva.KonvaEventObject<PointerEvent>) {
    // Get ConnectorTool instance from global registry or window
    const connectorTool = this.getActiveConnectorTool();
    if (connectorTool) {
      // Delegate port click to ConnectorTool
      connectorTool.handlePortClick(port, e);
    } else {
      // Ignore error
    }
  }

  /**
   * Get active ConnectorTool instance for delegation
   */
  private getActiveConnectorTool(): ConnectorToolHandle | null {
    // Try to get ConnectorTool from global registry
    try {
      if (typeof window === "undefined") return null;
      return window.activeConnectorTool ?? null;
    } catch {
      return null;
    }
  }

  /**
   * CRITICAL FIX: Subscribe to store changes to update port positions when elements move
   */
  private setupStoreSubscriptions() {
    if (!this.storeCtx) return;

    // Simple subscription to refresh ports when anything changes
    // This ensures ports update when elements move/transform
    this.storeUnsubscribe = this.storeCtx.store.subscribe(() => {
      // Only refresh if we have ports currently visible
      if (this.currentHoveredElement && this.portGroup?.visible()) {
        // Use requestAnimationFrame to batch updates
        requestAnimationFrame(() => {
          this.refreshCurrentPorts();
        });
      }
    });
  }

  /**
   * Refresh port positions for currently hovered element
   */
  private refreshCurrentPorts() {
    if (!this.currentHoveredElement || !this.portGroup?.visible()) {
      return;
    }

    // Get fresh element data to check if ports need updating
    const element = this.getElement(this.currentHoveredElement);
    if (!element || !this.shouldShowPorts()) {
      return;
    }

    // Calculate new port positions
    const newPorts = this.calculatePortPositions(element);
    const existingPorts = this.ports.get(this.currentHoveredElement);

    if (!existingPorts || existingPorts.length === 0) {
      return;
    }

    // Update existing port positions without animation for performance
    for (let i = 0; i < Math.min(newPorts.length, existingPorts.length); i++) {
      const port = newPorts[i];
      const existingPort = existingPorts[i];

      if (existingPort && port) {
        existingPort.x(port.position.x);
        existingPort.y(port.position.y);

        // Update corresponding hit area if it exists
        const hitAreaName = `port-hit-${port.anchor}`;
        const hitArea = this.portGroup?.findOne(`.${hitAreaName}`);
        if (hitArea) {
          hitArea.x(port.position.x);
          hitArea.y(port.position.y);
        }
      }
    }

    // Batch draw to update positions
    if (this.storeCtx) {
      this.storeCtx.layers.overlay.batchDraw();
    }
  }

  /**
   * CRITICAL FIX: Check if ports should be shown based on current tool
   * Ports should ONLY show when connector tools are active AND no text editing is happening
   */
  private shouldShowPorts(): boolean {
    if (!this.storeCtx) return false;

    const store = this.storeCtx.store.getState();
    const currentTool =
      store.ui?.selectedTool || "select";

    // Define connector tools that should show ports
    const connectorTools = [
      "connector",
      "connector-line",
      "connector-arrow",
      // 'mindmap' removed - mindmap tool should not show ports
    ];

    // Never show ports when hovering connector elements themselves
    const hit = this.storeCtx.stage.getIntersection(
      this.storeCtx.stage.getPointerPosition() || { x: -99999, y: -99999 },
    ) as Konva.Node | null;
    if (hit) {
      const isConnector =
        hit.name?.() === "connector" ||
        hit.getAttr?.("elementType") === "connector" ||
        hit.getAttr?.("nodeType") === "connector" ||
        hit.getParent?.()?.name?.() === "connector";
      if (isConnector) return false;
    }

    // CRITICAL FIX: Never show ports when any text editor is active
    // This prevents inappropriate ports during mindmap/shape text editing
    if (this.isTextEditorActive()) {
      return false;
    }

    return connectorTools.includes(currentTool);
  }

  /**
   * Check if any text editor (mindmap, shape, table) is currently active in the DOM
   */
  private isTextEditorActive(): boolean {
    // Check for mindmap text editors
    if (document.querySelector('[contenteditable="true"]')) {
      return true;
    }

    // Check for shape text editors
    if (document.querySelector("[data-shape-text-editor]")) {
      return true;
    }

    // Check for table text editors
    if (document.querySelector("[data-table-text-editor]")) {
      return true;
    }

    // Check for any focused input/textarea elements that might be editors
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.getAttribute("contenteditable") === "true")
    ) {
      return true;
    }

    return false;
  }
}
