import type Konva from 'konva';
import type { UnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { ConnectorRenderer } from '../../renderer/modules/ConnectorRenderer';
import type { ConnectorElement } from '../../types/connector';

export interface LiveRoutingDeps {
  store: UnifiedCanvasStore;
  renderer: ConnectorRenderer;
  stage: Konva.Stage;
}

export class LiveRoutingManager {
  private readonly deps: LiveRoutingDeps;
  private readonly connectorCache = new Map<string, ConnectorElement>();
  private isEnabled = true;
  private debounceTimer: number | null = null;

  constructor(deps: LiveRoutingDeps) {
    this.deps = deps;
    this.setupListeners();
    this.buildConnectorCache();
  }

  private setupListeners(): void {
    const stage = this.deps.stage;
    
    // Listen for transform events
    stage.on('dragmove.liverouting', this.onNodeMove);
    stage.on('transform.liverouting', this.onNodeTransform);
    stage.on('transformend.liverouting', this.onTransformEnd);
  }

  private buildConnectorCache(): void {
    this.connectorCache.clear();
    const elements = this.deps.store.element.getAll();
    
    for (const element of elements) {
      if (element.type === 'connector') {
        this.connectorCache.set(element.id, element as ConnectorElement);
      }
    }
  }

  private getConnectedConnectors(elementId: string): ConnectorElement[] {
    const connectors: ConnectorElement[] = [];
    
    for (const connector of this.connectorCache.values()) {
      const fromConnected = connector.from.kind === 'element' && connector.from.elementId === elementId;
      const toConnected = connector.to.kind === 'element' && connector.to.elementId === elementId;
      
      if (fromConnected || toConnected) {
        connectors.push(connector);
      }
    }
    
    return connectors;
  }

  private readonly rerouteConnectors = (elementId: string): void => {
    if (!this.isEnabled) return;

    const connectors = this.getConnectedConnectors(elementId);
    
    for (const connector of connectors) {
      // Re-render the connector to update its endpoints
      this.deps.renderer.rerouteConnector(connector.id, connector);
    }
  };

  private readonly debouncedReroute = (elementId: string): void => {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = window.setTimeout(() => {
      this.rerouteConnectors(elementId);
      this.debounceTimer = null;
    }, 16); // ~60fps
  };

  private readonly onNodeMove = (e: Konva.KonvaEventObject<DragEvent>): void => {
    const node = e.target;
    if (!node || !node.id()) return;
    
    // Don't reroute connectors themselves
    if (node.name() === 'connector') return;
    
    this.debouncedReroute(node.id());
  };

  private readonly onNodeTransform = (e: Konva.KonvaEventObject<Event>): void => {
    const target = e.target;
    if (target && 'nodes' in target && typeof (target as { nodes?: unknown }).nodes === 'function') {
      const transformer = target as unknown as Konva.Transformer;
      const nodes = transformer.nodes();
      
      for (const node of nodes) {
        if (!node.id() || node.name() === 'connector') continue;
        this.debouncedReroute(node.id());
      }
    }
  };

  private readonly onTransformEnd = (e: Konva.KonvaEventObject<Event>): void => {
    const target = e.target;
    if (target && 'nodes' in target && typeof (target as { nodes?: unknown }).nodes === 'function') {
      const transformer = target as unknown as Konva.Transformer;
      const nodes = transformer.nodes();
      
      // Force immediate re-route on transform end for final positioning
      for (const node of nodes) {
        if (!node.id() || node.name() === 'connector') continue;
        this.rerouteConnectors(node.id());
      }
    }
  };

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  forceRerouteAll(): void {
    for (const connector of this.connectorCache.values()) {
      this.deps.renderer.rerouteConnector(connector.id, connector);
    }
  }

  forceRerouteElement(elementId: string): void {
    this.rerouteConnectors(elementId);
  }

  addConnector(connector: ConnectorElement): void {
    this.connectorCache.set(connector.id, connector);
  }

  removeConnector(connectorId: string): void {
    this.connectorCache.delete(connectorId);
  }

  updateConnector(connector: ConnectorElement): void {
    this.connectorCache.set(connector.id, connector);
  }

  cleanup(): void {
    const stage = this.deps.stage;
    stage.off('dragmove.liverouting');
    stage.off('transform.liverouting');
    stage.off('transformend.liverouting');
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.connectorCache.clear();
  }
}