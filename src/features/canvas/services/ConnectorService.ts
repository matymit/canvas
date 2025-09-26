import type Konva from 'konva';
import type { UnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import { ConnectorRenderer, type RendererLayers } from '../renderer/modules/ConnectorRenderer';
import { LiveRoutingManager } from '../utils/connectors/LiveRouting';
import type { ConnectorElement } from '../types/connector';

export interface ConnectorServiceDeps {
  store: UnifiedCanvasStore;
  stage: Konva.Stage;
  layers: RendererLayers;
}

export class ConnectorService {
  private readonly store: UnifiedCanvasStore;
  private readonly renderer: ConnectorRenderer;
  private readonly liveRouting: LiveRoutingManager;
  private isInitialized = false;

  constructor({ store, stage, layers }: ConnectorServiceDeps) {
    this.store = store;

    // Initialize renderer
    this.renderer = new ConnectorRenderer(layers, {
      getNodeById: (id: string) => stage.findOne(`#${id}`) || null,
    });

    // Initialize live routing
    this.liveRouting = new LiveRoutingManager({
      store,
      renderer: this.renderer,
      stage,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Render all existing connectors
    await this.renderAllConnectors();

    // Set up store subscriptions for connector changes
    this.setupStoreSubscriptions();

    this.isInitialized = true;
  }

  private async renderAllConnectors(): Promise<void> {
    const elements = this.store.element.getAll();
    const connectors = elements.filter(el => el.type === 'connector') as ConnectorElement[];

    for (const connector of connectors) {
      await this.renderer.render(connector);
      this.liveRouting.addConnector(connector);
    }
  }

  private setupStoreSubscriptions(): void {
    // Since the store doesn't have direct subscription API, we'll use a different approach
    // For now, we'll let the components handle updates and call our methods
  }

  async addConnector(connector: ConnectorElement): Promise<void> {
    await this.renderer.render(connector);
    this.liveRouting.addConnector(connector);
  }

  async updateConnector(connector: ConnectorElement): Promise<void> {
    await this.renderer.render(connector);
    this.liveRouting.updateConnector(connector);
  }

  removeConnector(connectorId: string): void {
    this.renderer.destroy(connectorId);
    this.liveRouting.removeConnector(connectorId);
  }

  forceRerouteAll(): void {
    this.liveRouting.forceRerouteAll();
  }

  forceRerouteElement(elementId: string): void {
    this.liveRouting.forceRerouteElement(elementId);
  }

  enableLiveRouting(): void {
    this.liveRouting.enable();
  }

  disableLiveRouting(): void {
    this.liveRouting.disable();
  }

  cleanup(): void {
    this.renderer.cleanup();
    this.liveRouting.cleanup();
    this.isInitialized = false;
  }
}

// Global service instance for easy access
let globalConnectorService: ConnectorService | null = null;

export function initializeConnectorService(deps: ConnectorServiceDeps): ConnectorService {
  if (globalConnectorService) {
    globalConnectorService.cleanup();
  }
  
  globalConnectorService = new ConnectorService(deps);
  globalConnectorService.initialize();
  
  // Make available globally for tools
  (window as Window & { connectorService?: ConnectorService }).connectorService = globalConnectorService;
  
  return globalConnectorService;
}

export function getConnectorService(): ConnectorService | null {
  return globalConnectorService;
}