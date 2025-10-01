// ConnectorSelectionManager.ts
// Extracted from SelectionModule.ts lines 1129-1162, 1206-1261, 1484-1498, 1499-1509, 1510-1554, 1562-1565, 1566-1593, 1594-1617, 1618-1692, 1693-1707, 1723-1730, 1731-1775, 1787-1812
// Handles all connector selection and manipulation operations

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import type { ConnectorElement, ConnectorEndpoint } from "../../../../types/connector";
import type { ConnectorService } from "../../../../services/ConnectorService";

export interface ConnectorSelectionManager {
  scheduleRefresh(elementIds: Set<string>): void;
  refreshConnectedConnectors(elementIds: Set<string>): void;
  updateVisuals(delta: { dx: number; dy: number }): void;
  applyEndpointOverride(id: string, from?: ConnectorEndpoint, to?: ConnectorEndpoint): void;
  updateShapeGeometry(connectorId: string, node: Konva.Node): void;
  commitTranslation(delta: { dx: number; dy: number }): void;
  getAbsolutePoints(id: string): number[] | null;
  setLiveRoutingEnabled(enabled: boolean): void;
  updateElement(id: string, changes: Partial<ConnectorElement>): void;
  handleEndpointDrag(connectorId: string, endpoint: "from" | "to", position: {x: number; y: number}): void;
  // New method for handling direct connector movements
  moveSelectedConnectors(
    connectorIds: Set<string>,
    delta: { dx: number; dy: number },
    baselines?: Map<string, { position: { x: number; y: number }; from?: ConnectorEndpoint; to?: ConnectorEndpoint }>,
  ): void;
  // Add missing methods for compatibility with old interface
  destroy?(): void;
  clearSelection?(): void;
  refreshSelection?(): void;
}

export class ConnectorSelectionManagerImpl implements ConnectorSelectionManager {
  private refreshScheduled = false;
  private liveRoutingEnabled = true;
  private connectorService: ConnectorService | null = null;
  private moveSelectedConnectorsWasCalled = false; // Track if moveSelectedConnectors was called

  constructor() {
    // Bind methods to preserve context
    this.scheduleRefresh = this.scheduleRefresh.bind(this);
    this.refreshConnectedConnectors = this.refreshConnectedConnectors.bind(this);
    this.updateVisuals = this.updateVisuals.bind(this);
    this.applyEndpointOverride = this.applyEndpointOverride.bind(this);
    this.updateShapeGeometry = this.updateShapeGeometry.bind(this);
    this.commitTranslation = this.commitTranslation.bind(this);
    this.getAbsolutePoints = this.getAbsolutePoints.bind(this);
    this.setLiveRoutingEnabled = this.setLiveRoutingEnabled.bind(this);
    this.updateElement = this.updateElement.bind(this);
    this.handleEndpointDrag = this.handleEndpointDrag.bind(this);
    this.moveSelectedConnectors = this.moveSelectedConnectors.bind(this);
    this.destroy = this.destroy.bind(this);
    this.clearSelection = this.clearSelection.bind(this);
    this.refreshSelection = this.refreshSelection.bind(this);
  }

  // Compatibility methods for old interface
  destroy(): void {
    // Cleanup logic if needed
  }

  clearSelection(): void {
    // Clear selection logic if needed
  }

  refreshSelection(): void {
    // Refresh selection logic if needed
  }

  // Extracted from SelectionModule.ts lines 1129-1162
  scheduleRefresh(elementIds: Set<string>): void {
    if (this.refreshScheduled || elementIds.size === 0) {
      return;
    }

    console.log("[ConnectorSelectionManager] Scheduling connector refresh", {
      elementCount: elementIds.size,
      elementIds: Array.from(elementIds).slice(0, 5) // Show first 5 to avoid spam
    });

    this.refreshScheduled = true;

    // Use RAF to batch connector refreshes for performance
    window.requestAnimationFrame(() => {
      try {
        this.refreshConnectedConnectors(elementIds);
      } finally {
        this.refreshScheduled = false;
      }
    });
  }

  // Extracted from SelectionModule.ts lines 1206-1261
  refreshConnectedConnectors(elementIds: Set<string>): void {
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements) {
      console.warn("[ConnectorSelectionManager] No elements available for connector refresh");
      return;
    }

    console.log("[ConnectorSelectionManager] Refreshing connected connectors", {
      elementCount: elementIds.size
    });

    const connectorsToUpdate = new Set<string>();

    // Find all connectors connected to the given elements
    elements.forEach((element, elementId) => {
      if (element.type === 'connector') {
        const connector = element as ConnectorElement;
        
        // Check if connector is connected to any of the moved elements
        if (connector.from?.kind === 'element' && elementIds.has(connector.from.elementId)) {
          connectorsToUpdate.add(elementId);
        }
        if (connector.to?.kind === 'element' && elementIds.has(connector.to.elementId)) {
          connectorsToUpdate.add(elementId);
        }
      }
    });

    console.log(`[ConnectorSelectionManager] Found ${connectorsToUpdate.size} connectors to update`);

    // Update each connector
    connectorsToUpdate.forEach(connectorId => {
      try {
        this.updateConnectorRouting(connectorId);
      } catch (error) {
        console.error(`[ConnectorSelectionManager] Error updating connector ${connectorId}:`, error);
      }
    });
  }

  // Extracted from SelectionModule.ts lines 1484-1498
  updateVisuals(delta: { dx: number; dy: number }): void {
    void delta;
    const store = useUnifiedCanvasStore.getState();
    const selected = store.selectedElementIds;

    // Normalize selected IDs into a Set<string>
    const selectedIds = new Set<string>(
      Array.isArray(selected) ? selected : (selected instanceof Set ? Array.from(selected) : [])
    );

    // console.debug("[ConnectorSelectionManager] Updating connector visuals", {
    //   delta,
    //   selectedCount: selectedIds.size
    // });

    // Find connectors connected to selected elements and request routing update
    if (store.elements) {
      store.elements.forEach((el, id) => {
        if (el?.type === 'connector') {
          const c = el as ConnectorElement;
          const fromEl = c.from?.kind === 'element' ? c.from.elementId : null;
          const toEl = c.to?.kind === 'element' ? c.to.elementId : null;
          if ((fromEl && selectedIds.has(fromEl)) || (toEl && selectedIds.has(toEl))) {
            try {
              this.updateConnectorRouting(id);
            } catch (e) {
              // ignore routing errors during live drag
            }
          }
        }
      });
    }
  }

  // Extracted from SelectionModule.ts lines 1499-1509
  applyEndpointOverride(id: string, from?: ConnectorEndpoint, to?: ConnectorEndpoint): void {
    const store = useUnifiedCanvasStore.getState();
    const element = store.elements?.get(id);
    
    if (!element || element.type !== 'connector') {
      console.warn(`[ConnectorSelectionManager] Cannot apply endpoint override to non-connector ${id}`);
      return;
    }

    console.log("[ConnectorSelectionManager] Applying endpoint override", { id, from, to });

    const patch: Partial<ConnectorElement> = {};
    if (from) patch.from = from;
    if (to) patch.to = to;

    if (store.updateElement) {
      store.updateElement(id, patch, { pushHistory: false });
    }
  }

  // Extracted from SelectionModule.ts lines 1510-1554
  updateShapeGeometry(connectorId: string, node: Konva.Node): void {
    const store = useUnifiedCanvasStore.getState();
    const connector = store.elements?.get(connectorId);
    
    if (!connector || connector.type !== 'connector') {
      return;
    }

    console.log("[ConnectorSelectionManager] Updating connector shape geometry", {
      connectorId,
      nodeType: node.constructor.name
    });

    const position = node.position();
    const size = node.size();
    const scale = node.scale();

    // Calculate effective dimensions
    const effectiveWidth = size.width * Math.abs(scale.x);
    const effectiveHeight = size.height * Math.abs(scale.y);

    // Update connector geometry based on node changes
    const geometryPatch = {
      x: position.x,
      y: position.y,
      width: effectiveWidth,
      height: effectiveHeight
    };

    if (store.updateElement) {
      store.updateElement(connectorId, geometryPatch, { pushHistory: false });
    }

    // Trigger routing update if live routing is enabled
    if (this.liveRoutingEnabled) {
      this.updateConnectorRouting(connectorId);
    }
  }

  // Extracted from SelectionModule.ts lines 1562-1565
  commitTranslation(delta: { dx: number; dy: number }): void {
    console.log("[ConnectorSelectionManager] Committing connector translation", { 
      delta, 
      moveSelectedConnectorsWasCalled: this.moveSelectedConnectorsWasCalled 
    });
    
    // Skip if moveSelectedConnectors was already called - prevents double processing
    if (this.moveSelectedConnectorsWasCalled) {
      console.log("[ConnectorSelectionManager] Skipping commitTranslation - connectors already moved by moveSelectedConnectors");
      this.moveSelectedConnectorsWasCalled = false; // Reset flag
      return;
    }
    
    // This would be called at the end of a transform to finalize connector positions
    // The actual translation work is done by updateVisuals during the transform
  }

  // Extracted from SelectionModule.ts lines 1566-1593
  getAbsolutePoints(id: string): number[] | null {
    const store = useUnifiedCanvasStore.getState();
    const connector = store.elements?.get(id);
    
    if (!connector || connector.type !== 'connector') {
      return null;
    }

    const connectorElement = connector as ConnectorElement;
    
    if (!connectorElement.from || !connectorElement.to) {
      return null;
    }

    // Return absolute points for the connector only if endpoints are points
    if (connectorElement.from.kind === 'point' && connectorElement.to.kind === 'point') {
      return [
        connectorElement.from.x,
        connectorElement.from.y,
        connectorElement.to.x,
        connectorElement.to.y
      ];
    }
    return null;
  }

  // Extracted from SelectionModule.ts lines 1693-1707
  setLiveRoutingEnabled(enabled: boolean): void {
    console.log("[ConnectorSelectionManager] Setting live routing enabled:", enabled);
    this.liveRoutingEnabled = enabled;
  }

  // Extracted from SelectionModule.ts lines 1731-1775
  updateElement(id: string, changes: Partial<ConnectorElement>): void {
    const store = useUnifiedCanvasStore.getState();
    
    console.log("[ConnectorSelectionManager] Updating connector element", { id, changes });

    if (store.updateElement) {
      store.updateElement(id, changes, { pushHistory: false });
    }

    // Update routing if live routing is enabled
    if (this.liveRoutingEnabled) {
      this.updateConnectorRouting(id);
    }
  }

  // Extracted from SelectionModule.ts lines 1787-1812
  handleEndpointDrag(connectorId: string, endpoint: "from" | "to", position: {x: number; y: number}): void {
    const store = useUnifiedCanvasStore.getState();
    const connector = store.elements?.get(connectorId);
    
    if (!connector || connector.type !== 'connector') {
      return;
    }

    console.log("[ConnectorSelectionManager] Handling endpoint drag", {
      connectorId,
      endpoint,
      position
    });

    const connectorElement = connector as ConnectorElement;
    const endpointPatch = {
      [endpoint]: {
        ...connectorElement[endpoint],
        x: position.x,
        y: position.y
      }
    };

    if (store.updateElement) {
      store.updateElement(connectorId, endpointPatch, { pushHistory: false });
    }

    // Update routing
    if (this.liveRoutingEnabled) {
      this.updateConnectorRouting(connectorId);
    }
  }

  // Helper methods

  private updateConnectorRouting(connectorId: string): void {
    // Try connector service first
    const connectorService = this.getConnectorService();
    try {
      const legacyService = connectorService as ConnectorService & {
        updateRouting?: (id: string) => void;
      } | null;

      if (legacyService?.updateRouting) {
        legacyService.updateRouting(connectorId);
        return;
      }

      if (connectorService?.forceRerouteElement) {
        connectorService.forceRerouteElement(connectorId);
        return;
      }
    } catch {
      // ignore service errors
    }

    // Fallback: force a no-op update to trigger re-render
    const store = useUnifiedCanvasStore.getState();
    try {
      store.updateElement?.(connectorId, {}, { pushHistory: false });
    } catch {
      // ignore
    }
  }

  // Extracted from SelectionModule.ts lines 1723-1730
  private getConnectorService(): ConnectorService | null {
    if (!this.connectorService && typeof window !== "undefined") {
      // Initialize connector service on demand
      this.connectorService = window.connectorService ?? null;
    }
    return this.connectorService;
  }

  // New method for handling direct connector movements in marquee selection
  moveSelectedConnectors(
    connectorIds: Set<string>,
    delta: { dx: number; dy: number },
    baselines?: Map<string, { position: { x: number; y: number }; from?: ConnectorEndpoint; to?: ConnectorEndpoint }>,
  ): void {
    console.log("[ConnectorSelectionManager] Moving selected connectors", {
      connectorCount: connectorIds.size,
      delta,
      connectorIds: Array.from(connectorIds).slice(0, 5)
    });

    // Set flag to prevent double processing in commitTranslation
    this.moveSelectedConnectorsWasCalled = true;

    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements || !store.updateElement) {
      console.warn("[ConnectorSelectionManager] Store not available for connector movement");
      return;
    }

    // Update each selected connector
    connectorIds.forEach(connectorId => {
      const element = elements.get(connectorId);
      if (!element || element.type !== 'connector') {
        console.warn(`[ConnectorSelectionManager] Element ${connectorId} is not a connector`);
        return;
      }

      const connector = element as ConnectorElement;
      const baseline = baselines?.get(connectorId);
      const basePosition = baseline?.position ?? {
        x: typeof connector.x === "number" ? connector.x : 0,
        y: typeof connector.y === "number" ? connector.y : 0,
      };

      const baselineFrom = baseline?.from ?? connector.from;
      const baselineTo = baseline?.to ?? connector.to;
      const fromIsPoint = baselineFrom?.kind === "point";
      const toIsPoint = baselineTo?.kind === "point";

      if (!fromIsPoint && !toIsPoint) {
        console.log(`[ConnectorSelectionManager] Skipping anchored connector ${connectorId} — no movable endpoints`);
        return;
      }

      const connectorPatch: Partial<ConnectorElement> = {};

      if (!Number.isNaN(basePosition.x) && !Number.isNaN(basePosition.y)) {
        connectorPatch.x = basePosition.x + delta.dx;
        connectorPatch.y = basePosition.y + delta.dy;
      }

      if (fromIsPoint && baselineFrom?.kind === "point") {
        connectorPatch.from = {
          ...baselineFrom,
          x: baselineFrom.x + delta.dx,
          y: baselineFrom.y + delta.dy,
        };
      }

      if (toIsPoint && baselineTo?.kind === "point") {
        connectorPatch.to = {
          ...baselineTo,
          x: baselineTo.x + delta.dx,
          y: baselineTo.y + delta.dy,
        };
      }

      if (Object.keys(connectorPatch).length === 0) {
        console.log(`[ConnectorSelectionManager] Skipping connector ${connectorId} — no changes computed`);
        return;
      }

      console.log(`[ConnectorSelectionManager] Updating connector ${connectorId}`, connectorPatch);
      
      // CRITICAL FIX: Don't push history during drag completion to prevent visual jumping
      // Store updates with history trigger re-renders that reset visual positions
      // This matches the pattern in useMarqueeDrag.ts lines 337-345
      store.updateElement(connectorId, connectorPatch, { pushHistory: false });
      
      // Trigger visual update if live routing is enabled
      if (this.liveRoutingEnabled) {
        this.updateConnectorRouting(connectorId);
      }
    });
  }
}

// Export singleton instance and register globally
export const connectorSelectionManager = new ConnectorSelectionManagerImpl();

// Register globally for cross-module access
if (typeof window !== "undefined") {
  window.connectorSelectionManager = connectorSelectionManager;
}

declare global {
  interface Window {
    connectorSelectionManager?: ConnectorSelectionManager;
    connectorService?: ConnectorService;
  }
}