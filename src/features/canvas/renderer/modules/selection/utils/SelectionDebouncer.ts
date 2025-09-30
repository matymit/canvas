// features/canvas/renderer/modules/selection/utils/SelectionDebouncer.ts
import type { ModuleRendererCtx } from "../../../types";
import type { ConnectorSelectionManager } from "../../../../managers/ConnectorSelectionManager";
import { categorizeSelection } from "../SelectionResolver";

export class SelectionDebouncer {
  private timerId: number | null = null;

  /**
   * Schedule connector-only selection with debouncing
   * Returns true if connector-only selection was handled, false otherwise
   */
  scheduleConnectorSelection(
    selectedIds: Set<string>,
    storeCtx: ModuleRendererCtx,
    connectorSelectionManager: ConnectorSelectionManager | undefined,
    debugLog?: (message: string, data?: unknown) => void,
  ): boolean {
    // Clear any existing timer
    this.cancel();

    if (selectedIds.size === 0) {
      return false;
    }

    const state = storeCtx.store.getState();

    // Categorize selection with enhanced debugging
    const { connectorIds, mindmapEdgeIds, nonConnectorIds } =
      categorizeSelection({
        selectedIds,
        elements:
          (state.elements as Map<string, { type?: string }>) ?? new Map(),
        getElementById: state.element?.getById?.bind(state.element),
      });

    debugLog?.("Selection categorized", {
      connectors: connectorIds,
      mindmapEdges: mindmapEdgeIds,
      nonConnectorIds,
    });

    // Handle connector-only selection via connector manager
    if (
      (connectorIds.length >= 1 || mindmapEdgeIds.length >= 1) &&
      nonConnectorIds.length === 0
    ) {
      if (connectorSelectionManager && typeof window !== "undefined") {
        this.timerId = window.setTimeout(() => {
          const nextState = storeCtx.store.getState();
          const liveSelection = this.getCurrentSelection(nextState);

          const {
            connectorIds: currentConnectorIds,
            mindmapEdgeIds: currentEdgeIds,
            nonConnectorIds: currentNonConnectorIds,
          } = categorizeSelection({
            selectedIds: liveSelection,
            elements:
              (nextState?.elements as Map<string, { type?: string }>) ??
              new Map(),
            getElementById: nextState?.element?.getById?.bind(
              nextState?.element,
            ),
          });

          if (
            currentNonConnectorIds.length === 0 &&
            (currentConnectorIds.length > 0 || currentEdgeIds.length > 0)
          ) {
            const id = currentConnectorIds[0] ?? currentEdgeIds[0];
            if (id) {
              connectorSelectionManager?.showSelection(id);
            }
          }

          this.timerId = null;
        }, 100);
      }
      return true;
    }

    return false;
  }

  /**
   * Handle immediate connector-only selection without debouncing
   * Used for refresh operations where immediate response is needed
   * Returns true if connector-only selection was handled, false otherwise
   */
  handleImmediateConnectorSelection(
    selectedIds: Set<string>,
    storeCtx: ModuleRendererCtx,
    connectorSelectionManager: ConnectorSelectionManager | undefined,
    debugLog?: (message: string, data?: unknown) => void,
  ): boolean {
    if (selectedIds.size === 0) {
      return false;
    }

    const state = storeCtx.store.getState();
    const { connectorIds, mindmapEdgeIds, nonConnectorIds } =
      categorizeSelection({
        selectedIds,
        elements:
          (state.elements as Map<string, { type?: string }>) ?? new Map(),
        getElementById: state.element?.getById?.bind(state.element),
      });

    debugLog?.("Immediate selection categorized", {
      connectors: connectorIds,
      mindmapEdges: mindmapEdgeIds,
      nonConnectorIds,
    });

    if (
      (connectorIds.length >= 1 || mindmapEdgeIds.length >= 1) &&
      nonConnectorIds.length === 0
    ) {
      if (connectorSelectionManager && typeof window !== "undefined") {
        window.setTimeout(() => {
          const nextState = storeCtx.store.getState();
          const liveSelection = this.getCurrentSelection(nextState);
          const {
            connectorIds: currentConnectorIds,
            mindmapEdgeIds: currentEdgeIds,
            nonConnectorIds: currentNonConnectorIds,
          } = categorizeSelection({
            selectedIds: liveSelection,
            elements:
              (nextState?.elements as Map<string, { type?: string }>) ??
              new Map(),
            getElementById: nextState?.element?.getById?.bind(
              nextState?.element,
            ),
          });

          if (
            currentNonConnectorIds.length === 0 &&
            (currentConnectorIds.length > 0 || currentEdgeIds.length > 0)
          ) {
            const id = currentConnectorIds[0] ?? currentEdgeIds[0];
            if (id) {
              connectorSelectionManager?.showSelection(id);
            }
          }
        }, 50);
      }
      return true;
    }

    return false;
  }

  /**
   * Cancel any pending connector selection
   */
  cancel(): void {
    if (this.timerId !== null && typeof window !== "undefined") {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Helper method to get current selection with proper type checking
   */
  private getCurrentSelection(state: unknown): Set<string> {
    const value = (state as { selectedElementIds?: unknown })
      ?.selectedElementIds;

    if (value instanceof Set) {
      return new Set(
        Array.from(value).filter((id): id is string => typeof id === "string"),
      );
    }
    if (Array.isArray(value)) {
      return new Set(
        (value as unknown[]).filter(
          (id): id is string => typeof id === "string",
        ),
      );
    }
    return new Set<string>();
  }
}
