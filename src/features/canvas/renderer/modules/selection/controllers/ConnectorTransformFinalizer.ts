// ConnectorTransformFinalizer.ts
// Extracted from SelectionModule.ts endSelectionTransform method (lines 463-537)
// Handles connector-specific transform finalization logic

import type Konva from "konva";
import type { ModuleRendererCtx } from "../../../types";
import type { TransformController } from "./TransformController";
import type { ConnectorElement } from "../../../../types/connector";
import { connectorSelectionManager } from "../managers";
import { debug } from "../../../../../../utils/debug";

const LOG_CATEGORY = "selection/connector-transform";

export class ConnectorTransformFinalizer {
  constructor(
    private readonly storeCtx: ModuleRendererCtx,
    private readonly transformController: TransformController,
  ) {}

  /**
   * Finalizes connector-specific transform operations
   * Handles directly selected connectors before standard commit
   */
  finalizeConnectorTransform(nodes: Konva.Node[]): void {
    // Detect and handle directly selected connectors
    const connectorNodes = this.detectConnectorNodes();

    if (connectorNodes.length > 0) {
      debug("ConnectorTransformFinalizer: connectors selected for commit", {
        category: LOG_CATEGORY,
        data: {
          connectorCount: connectorNodes.length,
          standardNodes: nodes.length,
        },
      });

      const connectorIds = this.filterMovableConnectors(connectorNodes);

      if (connectorIds.size > 0) {
        const delta = this.computeConnectorDelta();
        debug("ConnectorTransformFinalizer: moving directly selected connectors", {
          category: LOG_CATEGORY,
          data: {
            connectorIds: Array.from(connectorIds),
            delta,
          },
        });

        this.moveConnectors(connectorIds, delta);
      }
    }

    // Commit translation for connected connectors when connectors are directly selected
    if (nodes.length > 0) {
      const delta = this.transformController?.computeDelta(nodes);
      if (delta) {
        const hasConnectors = connectorNodes.length > 0;
        if (hasConnectors) {
          this.commitConnectorTranslation(delta);
        }
      }
    }
  }

  /**
   * Detects all selected connector nodes from the stage
   */
  private detectConnectorNodes(): Konva.Node[] {
    const stage =
      this.storeCtx?.stage ??
      (typeof window !== "undefined"
        ? ((window as Window & { konvaStage?: Konva.Stage }).konvaStage ?? null)
        : null);

    if (!stage) return [];

    const state = this.storeCtx?.store.getState();
    if (!state) return [];

    const selection = state.selectedElementIds || new Set<string>();
    const selectedElementIds =
      selection instanceof Set ? selection : new Set<string>();
    if (selectedElementIds.size === 0) return [];

    const allSelectedNodes = stage.find<Konva.Node>((node: Konva.Node) => {
      const elementId = node.getAttr("elementId") || node.id();
      return elementId && selectedElementIds.has(elementId);
    });

    return allSelectedNodes.filter((node: Konva.Node) => {
      const elementType = node.getAttr("elementType");
      return elementType === "connector";
    });
  }

  /**
   * Filters out anchored connectors and returns only movable connector IDs
   */
  private filterMovableConnectors(connectorNodes: Konva.Node[]): Set<string> {
    const state = this.storeCtx?.store.getState();
    const elements = state?.elements;
    const connectorIds = new Set<string>();

    connectorNodes.forEach((node: Konva.Node) => {
      const elementId = node.getAttr("elementId") || node.id();
      if (!elementId) {
        return;
      }

      const connector = elements?.get(elementId);
      if (
        (connector?.type === "connector" &&
          (connector as ConnectorElement)?.from?.kind === "point") ||
        (connector as ConnectorElement)?.to?.kind === "point"
      ) {
        connectorIds.add(elementId);
      } else {
        debug("ConnectorTransformFinalizer: skipping anchored connector during commit", {
          category: LOG_CATEGORY,
          data: { elementId },
        });
      }
    });

    return connectorIds;
  }

  /**
   * Computes delta for connector movement
   */
  private computeConnectorDelta(): {
    dx: number;
    dy: number;
  } {
    const stage =
      this.storeCtx?.stage ??
      (typeof window !== "undefined"
        ? ((window as Window & { konvaStage?: Konva.Stage }).konvaStage ?? null)
        : null);

    if (!stage) return { dx: 0, dy: 0 };

    const state = this.storeCtx?.store.getState();
    if (!state) return { dx: 0, dy: 0 };

    const selection = state.selectedElementIds || new Set<string>();
    const selectedElementIds =
      selection instanceof Set ? selection : new Set<string>();
    if (selectedElementIds.size === 0) return { dx: 0, dy: 0 };

    const allSelectedNodes = stage.find<Konva.Node>((node: Konva.Node) => {
      const elementId = node.getAttr("elementId") || node.id();
      return elementId && selectedElementIds.has(elementId);
    });

    return (
      this.transformController?.computeDelta(allSelectedNodes) || {
        dx: 0,
        dy: 0,
      }
    );
  }

  /**
   * Executes connector movement through the connector selection manager
   */
  private moveConnectors(
    connectorIds: Set<string>,
    delta: { dx: number; dy: number },
  ): void {
    connectorSelectionManager.moveSelectedConnectors(connectorIds, delta);
  }

  /**
   * Commits connector translation through the connector selection manager
   */
  private commitConnectorTranslation(delta: { dx: number; dy: number }): void {
    connectorSelectionManager.commitTranslation(delta);
  }
}
