// features/canvas/renderer/modules/SelectionModule.ts
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { TransformerManager } from "../../managers/TransformerManager";
import { ConnectorSelectionManager } from "../../managers/ConnectorSelectionManager";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";
import type { TableElement } from "../../types/table";
import { applyTableScaleResize } from "./tableTransform";

// Element update interface
interface ElementUpdate {
  id: string;
  changes: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    colWidths?: number[];
    rowHeights?: number[];
  };
}

// Element changes interface
interface ElementChanges {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  colWidths?: number[];
  rowHeights?: number[];
}

export class SelectionModule implements RendererModule {
  private transformerManager?: TransformerManager;
  private connectorSelectionManager?: ConnectorSelectionManager;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;
  private unsubscribeVersion?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    this.storeCtx = ctx;

    // FIXED: Make module globally accessible for tool integration
    (window as { selectionModule?: SelectionModule }).selectionModule = this;

    // CRITICAL FIX: Create connector selection manager with proper error handling
    try {
      this.connectorSelectionManager = new ConnectorSelectionManager(
        ctx.stage,
        {
          overlayLayer: ctx.layers.overlay,
          onEndpointDrag: (
            connectorId: string,
            endpoint: "from" | "to",
            newPosition: { x: number; y: number },
          ) => {
            // Real-time connector endpoint update during drag
            this.handleConnectorEndpointDrag(
              connectorId,
              endpoint,
              newPosition,
            );
          },
        },
      );
      console.debug(
        "[SelectionModule] ConnectorSelectionManager created successfully",
      );
    } catch (error) {
      console.error(
        "[SelectionModule] Failed to create ConnectorSelectionManager:",
        error,
      );
    }

    // Create transformer manager on overlay layer with dynamic aspect ratio control
    this.transformerManager = new TransformerManager(ctx.stage, {
      overlayLayer: ctx.layers.overlay,
      enabledAnchors: [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "middle-left",
        "middle-right",
        "top-center",
        "bottom-center",
      ],
      rotateEnabled: true,
      padding: 4,
      anchorSize: 8,
      borderStroke: "#4F46E5",
      borderStrokeWidth: 2,
      anchorStroke: "#FFFFFF",
      anchorFill: "#4F46E5",
      ignoreStroke: false,
      keepRatioKey: "Shift", // Hold Shift to maintain aspect ratio
      lockAspectRatio: false, // Default to free resize for tables and other elements
      rotationSnapDeg: 15,
      onTransformStart: (_nodes) => {
        // Begin transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.beginTransform) {
          store.beginTransform();
        }
      },
      onTransform: (nodes) => {
        // Real-time updates during transform for smoother UX (all elements including tables)
        this.updateElementsFromNodes(nodes, false);

        // CRITICAL FIX: Synchronize shape text positioning during transform
        this.syncShapeTextDuringTransform(nodes);
      },
      onTransformEnd: (nodes) => {
        this.updateElementsFromNodes(nodes, true); // Commit with history

        // End transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.endTransform) {
          store.endTransform();
        }

        // Re-apply constraints to update the boundBoxFunc
        if (this.transformerManager) {
          this.transformerManager.detach();
          this.transformerManager.attachToNodes(nodes);
        }
      },
    });

    // Subscribe to selection changes with proper fallbacks for different store structures
    this.unsubscribe = ctx.store.subscribe(
      // Selector: get selected element IDs
      (state) => {
        // Use the selectedElementIds from state
        const selection = state.selectedElementIds || new Set<string>();

        // Return as Set
        return selection instanceof Set ? selection : new Set<string>();
      },
      // Callback: update transformer
      (selectedIds) => this.updateSelection(selectedIds),
      // Fire immediately to handle initial selection
      { fireImmediately: true },
    );

    // Subscribe to selection version changes to refresh transformer when selected elements change dimensions
    this.unsubscribeVersion = ctx.store.subscribe(
      // Selector: get selection version
      (state) => state.selectionVersion || 0,
      // Callback: refresh transformer for current selection
      (_version) => {
        if (this.transformerManager && this.storeCtx) {
          // Get current selection and refresh transformer
          const currentState = this.storeCtx.store.getState();
          const selectedIds =
            currentState.selectedElementIds || new Set<string>();
          if (selectedIds.size > 0) {
            // Force refresh the transformer with current selection
            this.refreshTransformerForSelection(selectedIds);
          }
        }
      },
      // Don't fire immediately - only when version actually changes
      { fireImmediately: false },
    );

    return () => this.unmount();
  }

  private unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.unsubscribeVersion) {
      this.unsubscribeVersion();
      this.unsubscribeVersion = undefined;
    }
    if (this.transformerManager) {
      this.transformerManager.destroy();
      this.transformerManager = undefined;
    }
    if (this.connectorSelectionManager) {
      this.connectorSelectionManager.destroy();
      this.connectorSelectionManager = undefined;
    }

    // Clean up global reference
    const globalWindow = window as { selectionModule?: SelectionModule };
    if (globalWindow.selectionModule === this) {
      globalWindow.selectionModule = undefined;
    }
  }

  private updateSelection(selectedIds: Set<string>) {
    if (!this.transformerManager || !this.storeCtx) {
      console.warn(
        "[SelectionModule] Missing required managers for selection update",
      );
      return;
    }

    console.debug("[SelectionModule] Updating selection:", {
      selectedIds: Array.from(selectedIds),
      size: selectedIds.size,
    });

    // CRITICAL FIX: Always clear both selection systems first to prevent conflicts
    this.transformerManager.setKeepRatio(false);
    this.transformerManager.detach();

    if (this.connectorSelectionManager) {
      this.connectorSelectionManager.clearSelection();
    }

    if (selectedIds.size === 0) {
      console.debug(
        "[SelectionModule] No elements selected, clearing all selection",
      );
      return;
    }

    // CRITICAL FIX: Categorize selection with enhanced debugging
    const { connectorIds, nonConnectorIds } =
      this.categorizeSelection(selectedIds);

    console.debug("[SelectionModule] Selection categorized:", {
      connectorIds,
      nonConnectorIds,
      hasConnectorManager: !!this.connectorSelectionManager,
    });

    // CRITICAL FIX: Handle connector selection with proper integration
    // If ANY connector is selected, prefer connector mode and never attach a transformer
    if (connectorIds.length >= 1) {
      console.debug(
        "[SelectionModule] Single connector selected, using ConnectorSelectionManager",
      );

      if (this.connectorSelectionManager) {
        // Use longer delay to ensure connector is fully rendered
        setTimeout(() => {
          const id = connectorIds[0];
          console.debug(
            "[SelectionModule] Showing connector selection for:",
            id,
          );
          this.connectorSelectionManager?.showSelection(id);
        }, 100);
      } else {
        console.warn(
          "[SelectionModule] ConnectorSelectionManager not available for connector selection",
        );
      }
      return;
    }

    // CRITICAL FIX: Handle mixed or non-connector selection
    if (connectorIds.length > 1) {
      console.debug(
        "[SelectionModule] Multiple connectors selected, falling back to transformer",
      );
    }

    if (nonConnectorIds.length > 0) {
      console.debug(
        "[SelectionModule] Non-connector elements selected, using TransformerManager",
      );

      const selectionSnapshot = new Set(nonConnectorIds);

      // Enhanced delay to ensure elements are fully rendered
      setTimeout(() => {
        console.debug("[SelectionModule] Processing non-connector selection");

        // Find Konva nodes for selected elements across all layers
        const nodes = this.resolveElementsToNodes(selectionSnapshot)
          // Extra guard: filter out connector nodes if any slipped in
          .filter((n) => this.getElementTypeForNode?.(n) !== "connector");

        console.debug("[SelectionModule] Resolved nodes for selection:", {
          requestedIds: Array.from(selectionSnapshot),
          foundNodes: nodes.length,
          nodeDetails: nodes.map((n) => ({
            id: n.id(),
            name: n.name(),
            className: n.className,
          })),
        });

        if (nodes.length > 0) {
          console.debug("[SelectionModule] Attaching transformer to nodes");

          // FIXED: Detach first to prevent any lingering transformers, then attach
          this.transformerManager?.detach();
          this.transformerManager?.attachToNodes(nodes);
          const lockAspect = this.shouldLockAspectRatio(selectionSnapshot);
          this.transformerManager?.setKeepRatio(lockAspect);

          // CRITICAL FIX: Ensure transformer is shown and force a batch draw
          this.transformerManager?.show();

          // Additional safety check: force visibility and batch draw
          setTimeout(() => {
            if (this.transformerManager) {
              const transformer = (
                this.transformerManager as unknown as {
                  transformer: Konva.Transformer;
                }
              ).transformer;
              if (transformer && !transformer.visible()) {
                console.debug(
                  "[SelectionModule] Transformer was not visible, forcing visibility",
                );
                transformer.visible(true);
                transformer.getLayer()?.batchDraw();
              }
            }
          }, 10);
        } else {
          console.warn(
            "[SelectionModule] Could not find nodes for selected elements",
          );
          this.transformerManager?.detach();
          this.transformerManager?.setKeepRatio(false);
        }
      }, 75);
    }
  }

  // Helper to infer element type for a given node using attrs/names
  private getElementTypeForNode(node: import("konva/lib/Node").Node): string {
    const nodeType = (node as any).getAttr?.("nodeType");
    if (nodeType) return nodeType;
    const elementType = (node as any).getAttr?.("elementType");
    if (elementType) return elementType;
    const name = (node as any).name?.() || "";
    if (name.includes("connector")) return "connector";
    return "element";
  }

  private resolveElementsToNodes(
    elementIds: Set<string>,
  ): import("konva/lib/Node").Node[] {
    if (!this.storeCtx) return [];

    const nodes: import("konva/lib/Node").Node[] = [];

    // Collect all available layers and filter out undefined/null ones
    const allLayers = [
      { name: "main", layer: this.storeCtx.layers.main },
      { name: "highlighter", layer: this.storeCtx.layers.highlighter },
      { name: "overlay", layer: this.storeCtx.layers.overlay },
      { name: "preview", layer: this.storeCtx.layers.preview },
    ];

    const validLayers = allLayers
      .filter(({ layer }) => {
        if (!layer) {
          console.debug(
            "[SelectionModule] Layer is undefined, skipping search",
          );
          return false;
        }
        return true;
      })
      .map(({ layer }) => layer);

    if (validLayers.length === 0) {
      console.error(
        "[SelectionModule] No valid layers available for element resolution",
      );
      return [];
    }

    for (const elementId of elementIds) {
      let found = false;

      // Search in valid layers for nodes with elementId attribute or matching id
      for (const layer of validLayers) {
        // Additional safety check before calling find()
        if (!layer || typeof layer.find !== "function") {
          console.warn("[SelectionModule] Invalid layer encountered, skipping");
          continue;
        }

        const candidates = layer.find((node: import("konva/lib/Node").Node) => {
          const nodeElementId = node.getAttr("elementId") || node.id();
          return nodeElementId === elementId;
        });

        if (candidates.length > 0) {
          // Prefer groups over individual shapes for better transform experience
          // Check for various group types: Group, table-group, image-group, etc.
          const group = candidates.find(
            (n) =>
              n.className === "Group" ||
              n.className === "table-group" ||
              n.className === "image-group" ||
              n.name() === "table-group" ||
              n.name() === "image",
          );
          const selectedNode = group || candidates[0];

          // FIXED: Ensure only one node per element ID to prevent duplicate frames
          if (selectedNode) {
            nodes.push(selectedNode);
            found = true;
            console.debug("[SelectionModule] Found node for element:", {
              elementId,
              nodeId: selectedNode.id(),
              nodeName: selectedNode.name(),
              nodeClassName: selectedNode.className,
            });
          } else {
            console.warn(
              "[SelectionModule] Found candidates but selectedNode is null for element:",
              elementId,
            );
          }
          break;
        }
      }

      if (!found) {
        console.warn(
          "[SelectionModule] Could not find node for element:",
          elementId,
        );
      }
    }

    return nodes;
  }

  private updateElementsFromNodes(
    nodes: import("konva/lib/Node").Node[],
    commitWithHistory: boolean,
  ) {
    if (!this.storeCtx) return;

    const store = this.storeCtx.store.getState();
    const updateElement = store.element?.update;
    const withUndo = store.withUndo;

    if (!updateElement) {
      console.error("[SelectionModule] No element update method available");
      return;
    }

    const updates: ElementUpdate[] = [];

    for (const node of nodes) {
      const elementId = node.getAttr("elementId") || node.id();
      if (!elementId) continue;

      const pos = node.position();
      let size = node.size();
      const rotation = node.rotation();
      const scale = node.scale();
      const rawScaleX = scale?.x ?? 1;
      const rawScaleY = scale?.y ?? 1;

      // CRITICAL FIX: Check if this is a table element by looking at the actual element data
      const element =
        store?.elements?.get?.(elementId) ??
        store.element?.getById?.(elementId);
      const isTable = element?.type === "table";
      const isImage = element?.type === "image";

      if (isImage && node instanceof Konva.Group) {
        const imageNode = node.findOne("Image");
        if (imageNode) {
          size = imageNode.size();
        }
      }

      // Log for debugging
      if (elementId && (rawScaleX !== 1 || rawScaleY !== 1)) {
        console.debug(
          "[SelectionModule] Processing transform for element:",
          elementId,
        );
      }

      // CRITICAL FIX: Ensure dimensions never become 0 or negative
      // Use absolute values of scale to handle negative scaling (flipping)
      // and enforce minimum dimensions to prevent disappearing elements
      const MIN_WIDTH = 10; // Minimum width in pixels for generic elements
      const MIN_HEIGHT = 10; // Minimum height in pixels for generic elements

      const scaleX = Math.abs(rawScaleX);
      const scaleY = Math.abs(rawScaleY);

      const scaledWidth = size.width * scaleX;
      const scaledHeight = size.height * scaleY;

      const changes: ElementChanges = {
        x: Math.round(pos.x * 100) / 100, // Round to avoid precision issues
        y: Math.round(pos.y * 100) / 100,
        rotation: Math.round(rotation * 100) / 100,
      };

      let tableResizeResult: TableElement | null = null;
      let nextWidth = Math.max(MIN_WIDTH, Math.round(scaledWidth * 100) / 100);
      let nextHeight = Math.max(
        MIN_HEIGHT,
        Math.round(scaledHeight * 100) / 100,
      );
      const shouldCommitSizeNow = isTable || commitWithHistory;

      // CRITICAL FIX: Special handling for table elements - delegate to table transform helper
      if (isTable) {
        if (element && element.colWidths && element.rowHeights) {
          const tableElement = element as TableElement;
          const keyboardEvent = (
            typeof window !== "undefined" ? window.event : undefined
          ) as KeyboardEvent | undefined;
          const keepAspectRatio = keyboardEvent?.shiftKey ?? false;

          tableResizeResult = applyTableScaleResize(
            tableElement,
            rawScaleX,
            rawScaleY,
            { keepAspectRatio },
          );

          changes.width = Math.round(tableResizeResult.width * 100) / 100;
          changes.height = Math.round(tableResizeResult.height * 100) / 100;
          changes.colWidths = tableResizeResult.colWidths;
          changes.rowHeights = tableResizeResult.rowHeights;

          nextWidth = tableResizeResult.width;
          nextHeight = tableResizeResult.height;

          console.debug("[SelectionModule] Table dimensions scaled via helper");
        } else {
          console.warn(
            "[SelectionModule] Table element missing colWidths/rowHeights",
          );
        }
      }

      if (shouldCommitSizeNow) {
        changes.width = nextWidth;
        changes.height = nextHeight;

        updates.push({
          id: elementId,
          changes,
        });
      } else {
        // For non-table elements during live transform, defer size commit
        // to transform end to avoid jitter caused by double-normalization.
        continue;
      }

      // Live-move commits (position-only) during transform to keep dependent renders (connectors) in sync
      if (!shouldCommitSizeNow) {
        updates.push({
          id: elementId,
          changes: { x: changes.x, y: changes.y, rotation: changes.rotation },
        });
      }

      // Reset scale after applying to dimensions
      if (
        scale &&
        (rawScaleX !== 1 || rawScaleY !== 1) &&
        shouldCommitSizeNow
      ) {
        node.to({
          scaleX: 1,
          scaleY: 1,
          width: nextWidth,
          height: nextHeight,
          duration: 0,
        });
        if (tableResizeResult) {
          const minTableWidth =
            tableResizeResult.cols * DEFAULT_TABLE_CONFIG.minCellWidth;
          const minTableHeight =
            tableResizeResult.rows * DEFAULT_TABLE_CONFIG.minCellHeight;
          if (nextWidth < minTableWidth || nextHeight < minTableHeight) {
            console.warn(
              "[SelectionModule] Table size fell below minimums after transform reset",
            );
          }
        }
      }
    }

    // CRITICAL FIX: Apply updates correctly for history tracking
    if (commitWithHistory && withUndo && updates.length > 0) {
      const actionName =
        updates.length === 1
          ? "Transform element"
          : `Transform ${updates.length} elements`;

      // Use withUndo to wrap all updates in a single history entry
      withUndo(actionName, () => {
        for (const { id, changes } of updates) {
          try {
            // Use the store's updateElement directly without pushHistory since we're already in withUndo
            const storeState = this.storeCtx?.store?.getState();
            storeState?.updateElement?.(id, changes, { pushHistory: false });
          } catch (error) {
            console.error(
              "[SelectionModule] Failed to update element during transform:",
              error,
            );
          }
        }
      });
    } else {
      // For non-history updates (during transform), use updateElement directly
      for (const { id, changes } of updates) {
        try {
          const storeState = this.storeCtx.store.getState();
          storeState.updateElement(id, changes, { pushHistory: false });
        } catch (error) {
          console.error("[SelectionModule] Failed to update element:", error);
        }
      }
    }
  }

  // FIXED: Public API for other modules to trigger selection with proper store integration
  selectElement(elementId: string, options?: { additive?: boolean }) {
    if (!this.storeCtx) {
      console.error(
        "[SelectionModule] No store context available for selection",
      );
      return;
    }

    const store = this.storeCtx.store.getState();

    // Try different store selection methods with proper error handling
    try {
      if (store.setSelection) {
        if (options?.additive) {
          const cur = (
            store.selectedElementIds instanceof Set
              ? store.selectedElementIds
              : new Set<string>(store.selectedElementIds || [])
          ) as Set<string>;
          const next = new Set(cur);
          if (next.has(elementId)) next.delete(elementId);
          else next.add(elementId);
          store.setSelection(Array.from(next));
        } else {
          store.setSelection([elementId]);
        }
      } else if (store.selection?.set) {
        if (options?.additive && store.selectedElementIds instanceof Set) {
          const next = new Set(store.selectedElementIds);
          if (next.has(elementId)) next.delete(elementId);
          else next.add(elementId);
          store.selection.set(Array.from(next));
        } else {
          store.selection.set([elementId]);
        }
      } else if (store.selectedElementIds) {
        // Handle Set-based selection
        if (store.selectedElementIds instanceof Set) {
          if (options?.additive) {
            if (store.selectedElementIds.has(elementId))
              store.selectedElementIds.delete(elementId);
            else store.selectedElementIds.add(elementId);
          } else {
            store.selectedElementIds.clear();
            store.selectedElementIds.add(elementId);
          }
        } else if (Array.isArray(store.selectedElementIds)) {
          if (options?.additive) {
            const arr = store.selectedElementIds as string[];
            const idx = arr.indexOf(elementId);
            if (idx >= 0) arr.splice(idx, 1);
            else arr.push(elementId);
          } else {
            (store.selectedElementIds as string[]).length = 0;
            (store.selectedElementIds as string[]).push(elementId);
          }
        }
        // Trigger state update if using Zustand
        this.storeCtx.store.setState?.({
          selectedElementIds: store.selectedElementIds,
        });
      } else {
        console.error(
          "[SelectionModule] No valid selection method found in store",
        );
      }
    } catch (error) {
      console.error("[SelectionModule] Error during element selection:", error);
    }
  }

  // FIXED: Enhanced auto-select element with better timing and error recovery
  autoSelectElement(elementId: string) {
    // Immediate selection attempt
    this.selectElement(elementId);

    // Enhanced retry mechanism with exponential backoff for better reliability
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 25; // Start with shorter delay

    const attemptSelection = () => {
      attempts++;
      const delay = baseDelay * Math.pow(1.5, attempts - 1); // Exponential backoff

      setTimeout(() => {
        // Check if element is now available
        const nodes = this.resolveElementsToNodes(new Set([elementId]));

        if (nodes.length > 0) {
          // FIXED: Force clean transformer state and attach
          if (this.transformerManager) {
            this.transformerManager.detach();
            setTimeout(() => {
              this.transformerManager?.attachToNodes(nodes);
              this.transformerManager?.show();
            }, 10);
          }
          return; // Success, stop retrying
        }

        if (attempts < maxAttempts) {
          // Retry selection in store as element might not be rendered yet
          this.selectElement(elementId);
          attemptSelection(); // Recursive retry
        } else {
          console.warn(
            "[SelectionModule] Auto-selection failed after max attempts",
          );
        }
      }, delay);
    };

    // Start the retry mechanism
    attemptSelection();
  }

  // Public method to clear selection
  clearSelection() {
    if (!this.storeCtx) return;

    const store = this.storeCtx.store.getState();

    if (store.setSelection) {
      store.setSelection([]);
    } else if (store.selection?.clear) {
      store.selection.clear();
    } else if (store.selectedElementIds) {
      if (store.selectedElementIds instanceof Set) {
        store.selectedElementIds.clear();
      } else if (Array.isArray(store.selectedElementIds)) {
        (store.selectedElementIds as string[]).length = 0;
      }
      this.storeCtx.store.setState?.({
        selectedElementIds: store.selectedElementIds,
      });
    }
  }

  // Private method to refresh transformer for current selection (used when selection version changes)
  private refreshTransformerForSelection(selectedIds: Set<string>) {
    if (!this.transformerManager || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformerManager.setKeepRatio(false);
      this.transformerManager.detach();
      return;
    }

    const selectionSnapshot = new Set(selectedIds);

    // NEW: Respect connector selection here too – never attach transformer
    const { connectorIds } = this.categorizeSelection(selectionSnapshot);
    if (connectorIds.length >= 1) {
      // Ensure transformer is detached and show connector endpoint UI
      this.transformerManager.detach();
      this.connectorSelectionManager?.clearSelection();
      setTimeout(() => {
        const id = connectorIds[0];
        this.connectorSelectionManager?.showSelection(id);
      }, 50);
      return;
    }

    // Small delay to ensure elements are fully re-rendered after dimension changes
    setTimeout(() => {
      // Find Konva nodes for selected elements across all layers
      const nodes = this.resolveElementsToNodes(selectionSnapshot).filter(
        (n) => this.getElementTypeForNode?.(n) !== "connector",
      );

      if (nodes.length > 0) {
        // Force detach and reattach to recalculate bounds
        this.transformerManager?.detach();
        setTimeout(() => {
          this.transformerManager?.attachToNodes(nodes);
          const lockAspect = this.shouldLockAspectRatio(selectionSnapshot);
          this.transformerManager?.setKeepRatio(lockAspect);
          this.transformerManager?.show();
        }, 10);
      } else {
        console.warn("[SelectionModule] Could not find nodes for refresh");
        this.transformerManager?.detach();
        this.transformerManager?.setKeepRatio(false);
      }
    }, 50); // Slightly longer delay to ensure table rendering is complete
  }

  private shouldLockAspectRatio(selectedIds: Set<string>): boolean {
    if (!this.storeCtx || selectedIds.size === 0) {
      return false;
    }

    const state = this.storeCtx.store.getState();
    const elementsMap = state?.elements as
      | Map<
          string,
          {
            type?: string;
            keepAspectRatio?: boolean;
            data?: Record<string, unknown>;
          }
        >
      | undefined;

    if (!elementsMap || typeof elementsMap.get !== "function") {
      return false;
    }

    let lockableCount = 0;

    for (const id of selectedIds) {
      const element = elementsMap.get(id);
      if (!element) {
        return false;
      }

      if (element.type === "table") {
        return false;
      }

      const elementData = (element as { data?: Record<string, unknown> }).data;
      const hasImageData =
        element.type === "sticky-note" &&
        (typeof elementData?.image === "string" ||
          typeof elementData?.imageUrl === "string");

      const shouldKeepAspect =
        element.keepAspectRatio === true ||
        element.type === "image" ||
        element.type === "circle" ||
        hasImageData;

      if (!shouldKeepAspect) {
        return false;
      }

      lockableCount += 1;
    }

    return lockableCount > 0 && lockableCount === selectedIds.size;
  }

  /**
   * Force an immediate refresh of the transformer for the current selection.
   * This is useful when elements have changed dimensions and the transformer
   * needs to update immediately without waiting for async delays.
   */
  public forceRefresh(): void {
    if (!this.transformerManager || !this.storeCtx) return;

    // Get current selection
    const currentState = this.storeCtx.store.getState();
    const selectedIds = currentState.selectedElementIds || new Set<string>();

    if (selectedIds.size === 0) {
      this.transformerManager.detach();
      this.connectorSelectionManager?.clearSelection();
      return;
    }

    // Check if selection contains connectors
    const { connectorIds, nonConnectorIds } =
      this.categorizeSelection(selectedIds);

    // Handle connector selection refresh
    if (connectorIds.length === 1 && nonConnectorIds.length === 0) {
      this.transformerManager.detach();
      this.connectorSelectionManager?.refreshSelection();
      return;
    }

    // Handle non-connector selection refresh
    if (nonConnectorIds.length > 0) {
      this.connectorSelectionManager?.clearSelection();

      // Find Konva nodes for selected elements
      const nodes = this.resolveElementsToNodes(new Set(nonConnectorIds));

      if (nodes.length > 0) {
        // Detach and reattach to force bounds recalculation
        this.transformerManager.detach();
        this.transformerManager.attachToNodes(nodes);
        const lockAspect = this.shouldLockAspectRatio(new Set(nonConnectorIds));
        this.transformerManager.setKeepRatio(lockAspect);
        this.transformerManager.show();
        // Force immediate update
        this.transformerManager.refresh();
      } else {
        this.transformerManager.detach();
      }
    }
  }

  /**
   * CRITICAL FIX: Enhanced categorize selection with better element type detection
   */
  private categorizeSelection(selectedIds: Set<string>): {
    connectorIds: string[];
    nonConnectorIds: string[];
  } {
    if (!this.storeCtx) {
      console.warn("[SelectionModule] No store context for categorization");
      return { connectorIds: [], nonConnectorIds: Array.from(selectedIds) };
    }

    const state = this.storeCtx.store.getState();
    const elements = state.elements || new Map();

    const connectorIds: string[] = [];
    const nonConnectorIds: string[] = [];

    for (const id of selectedIds) {
      // CRITICAL FIX: Enhanced connector detection
      const element = elements.get?.(id) || state.element?.getById?.(id);

      console.debug("[SelectionModule] Categorizing element:", {
        id,
        element,
        elementType: element?.type,
      });

      if (element && element.type === "connector") {
        connectorIds.push(id);
        console.debug(
          "[SelectionModule] Element categorized as connector:",
          id,
        );
      } else {
        nonConnectorIds.push(id);
        console.debug(
          "[SelectionModule] Element categorized as non-connector:",
          id,
        );
      }
    }

    console.debug("[SelectionModule] Final categorization:", {
      connectorIds,
      nonConnectorIds,
    });

    return { connectorIds, nonConnectorIds };
  }

  /**
   * Handle real-time connector endpoint drag updates
   */
  private handleConnectorEndpointDrag(
    connectorId: string,
    _endpoint: "from" | "to",
    _newPosition: { x: number; y: number },
  ): void {
    // This is called during drag for real-time visual updates
    // The actual store update happens on drag end in ConnectorSelectionManager

    console.debug("[SelectionModule] Connector endpoint drag:", {
      connectorId,
      endpoint: _endpoint,
      position: _newPosition,
    });

    // Optionally trigger connector re-render for real-time feedback
    if (this.storeCtx) {
      const state = this.storeCtx.store.getState();
      const connector =
        state.elements?.get?.(connectorId) ||
        state.element?.getById?.(connectorId);

      if (connector && connector.type === "connector") {
        // We could trigger a temporary re-render here, but for now
        // the ConnectorSelectionManager handles the visual feedback with endpoint dots
        console.debug("[SelectionModule] Connector found for real-time update");
      }
    }
  }

  /**
   * CRITICAL FIX: Synchronize shape text positioning during transform operations
   * This method calls the ShapeRenderer to update text positions in real-time during resize
   */
  private syncShapeTextDuringTransform(nodes: Konva.Node[]) {
    try {
      // Get the global ShapeRenderer instance from the window
      const shapeRenderer = (window as any).shapeRenderer;
      if (
        !shapeRenderer ||
        typeof shapeRenderer.syncTextDuringTransform !== "function"
      ) {
        return; // ShapeRenderer not available or method not implemented
      }

      // For each node being transformed, sync its text if it's a shape
      for (const node of nodes) {
        const elementId = node.getAttr("elementId") || node.id();
        if (!elementId) continue;

        // Get the element type to check if it's a shape with text
        const store = this.storeCtx?.store.getState();
        if (!store) continue;

        const element =
          store.elements?.get?.(elementId) ??
          store.element?.getById?.(elementId);
        if (!element) continue;

        // Only sync text for shapes that can have text
        if (
          element.type === "rectangle" ||
          element.type === "circle" ||
          element.type === "triangle" ||
          element.type === "ellipse"
        ) {
          shapeRenderer.syncTextDuringTransform(elementId);
        }
      }
    } catch (error) {
      console.warn(
        "[SelectionModule] Failed to sync shape text during transform:",
        error,
      );
    }
  }
}
