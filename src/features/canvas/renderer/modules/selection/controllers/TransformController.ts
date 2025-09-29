import type Konva from "konva";
import type {
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorEndpointPoint,
} from "@features/canvas/types/connector";
import type { TransformSnapshot } from "../types";

interface TransformControllerDeps {
  getTransformer: () => Konva.Transformer | null;
  applyAnchoredOverride: (
    id: string,
    from: ConnectorEndpointPoint,
    to: ConnectorEndpointPoint,
  ) => void;
  setConnectorRoutingEnabled: (enabled: boolean) => void;
  setMindmapRoutingEnabled: (enabled: boolean) => void;
  updateConnectorElement: (id: string, changes: Partial<ConnectorElement>) => void;
  rerouteAllConnectors: () => void;
  rerouteMindmapNodes: (ids: string[]) => void;
  debug?: (message: string, data?: unknown) => void;
}

export class TransformController {
  private snapshot: TransformSnapshot | null = null;
  private readonly deps: TransformControllerDeps;

  constructor(deps: TransformControllerDeps) {
    this.deps = deps;
  }

  start(snapshot: TransformSnapshot) {
    this.snapshot = snapshot;

    if (snapshot.connectors.size > 0) {
      snapshot.connectors.forEach((connectorSnapshot, id) => {
        if (!connectorSnapshot.wasAnchored) return;
        this.deps.applyAnchoredOverride(
          id,
          connectorSnapshot.startFrom,
          connectorSnapshot.startTo,
        );
      });
      this.deps.setConnectorRoutingEnabled(false);
    }

    if (snapshot.movedMindmapNodes.size > 0) {
      this.deps.setMindmapRoutingEnabled(false);
    }
  }

  isActive(): boolean {
    return Boolean(this.snapshot);
  }

  getSnapshot(): TransformSnapshot | null {
    return this.snapshot;
  }

  clearSnapshot(): TransformSnapshot | null {
    const snapshot = this.snapshot;
    this.snapshot = null;
    return snapshot;
  }

  computeDelta(nodes: Konva.Node[]): { dx: number; dy: number } | null {
    if (!this.snapshot) {
      return null;
    }

    for (const node of nodes) {
      const elementId = node.getAttr<string | undefined>("elementId") || node.id();
      if (!elementId) continue;

      const baseline = this.snapshot.basePositions.get(elementId);
      if (!baseline) continue;

      const pos = node.position();
      const delta = { dx: pos.x - baseline.x, dy: pos.y - baseline.y };
      this.deps.debug?.("Computed transform delta", { elementId, delta });
      return delta;
    }

    if (this.snapshot.transformerBox) {
      const rect = this.deps.getTransformer()?.getClientRect();
      if (rect) {
        const delta = {
          dx: rect.x - this.snapshot.transformerBox.x,
          dy: rect.y - this.snapshot.transformerBox.y,
        };
        this.deps.debug?.("Computed transform delta from transformer", delta);
        return delta;
      }
    }

    this.deps.debug?.("Unable to compute transform delta");
    return null;
  }

  updateConnectorShapes(
    delta: { dx: number; dy: number },
    updateGeometry: (
      id: string,
      shape: Konva.Line | Konva.Arrow | null | undefined,
      from: ConnectorEndpointPoint,
      to: ConnectorEndpointPoint,
    ) => void,
  ) {
    if (!this.snapshot) return;

    this.snapshot.connectors.forEach((connectorSnapshot, id) => {
      const nextFrom = {
        kind: "point" as const,
        x: connectorSnapshot.startFrom.x + delta.dx,
        y: connectorSnapshot.startFrom.y + delta.dy,
      };
      const nextTo = {
        kind: "point" as const,
        x: connectorSnapshot.startTo.x + delta.dx,
        y: connectorSnapshot.startTo.y + delta.dy,
      };

      this.deps.debug?.("updateConnectorVisuals", { id, from: nextFrom, to: nextTo });
      if (connectorSnapshot.shape) {
        updateGeometry(id, connectorSnapshot.shape, nextFrom, nextTo);
      } else if (
        connectorSnapshot.group &&
        connectorSnapshot.groupPosition
      ) {
        const { x, y } = connectorSnapshot.groupPosition;
        try {
          connectorSnapshot.group.position({
            x: x + delta.dx,
            y: y + delta.dy,
          });
          connectorSnapshot.group.getLayer()?.batchDraw();
        } catch (error) {
          this.deps.debug?.("updateConnectorGroup failed", { id, error });
        }
      }
    });
  }

  commitConnectorTranslation(delta: { dx: number; dy: number }) {
    if (!this.snapshot) return;

    this.snapshot.connectors.forEach((connectorSnapshot, id) => {
      if (connectorSnapshot.wasAnchored) {
        return;
      }

      const nextFrom: ConnectorEndpoint = {
        kind: "point",
        x: connectorSnapshot.startFrom.x + delta.dx,
        y: connectorSnapshot.startFrom.y + delta.dy,
      };
      const nextTo: ConnectorEndpoint = {
        kind: "point",
        x: connectorSnapshot.startTo.x + delta.dx,
        y: connectorSnapshot.startTo.y + delta.dy,
      };

      this.deps.updateConnectorElement(id, {
        from: nextFrom,
        to: nextTo,
      });
    });
  }

  release(): TransformSnapshot | null {
    const snapshot = this.clearSnapshot();

    if (!snapshot) {
      this.deps.setMindmapRoutingEnabled(true);
      this.deps.setConnectorRoutingEnabled(true);
      return null;
    }

    snapshot.connectors.forEach((connectorSnapshot, id) => {
      if (!connectorSnapshot.wasAnchored) {
        return;
      }

      this.deps.updateConnectorElement(id, {
        from: connectorSnapshot.originalFrom,
        to: connectorSnapshot.originalTo,
      });
    });

    this.deps.setConnectorRoutingEnabled(true);
    this.deps.setMindmapRoutingEnabled(true);

    try {
      this.deps.rerouteAllConnectors();
    } catch {
      // ignore reroute errors
    }

    if (snapshot.movedMindmapNodes.size > 0) {
      try {
        this.deps.rerouteMindmapNodes(Array.from(snapshot.movedMindmapNodes));
      } catch {
        // ignore reroute errors
      }
    }

    return snapshot;
  }
}
