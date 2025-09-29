// features/canvas/renderer/modules/SelectionModule.ts
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import type { ConnectorElement } from "../../types/connector";
import type { MindmapRenderer } from "./MindmapRenderer";
import { batchMindmapReroute } from "./mindmapWire";
import { TransformerManager } from "../../managers/TransformerManager";
import { ConnectorSelectionManager } from "../../managers/ConnectorSelectionManager";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";
import type { TableElement } from "../../types/table";
import type { ConnectorService } from "../../services/ConnectorService";
import { applyTableScaleResize } from "./tableTransform";
import { debug } from "@/utils/debug";

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
    from?: ConnectorEndpoint;
    to?: ConnectorEndpoint;
    points?: number[];
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
  from?: ConnectorEndpoint;
  to?: ConnectorEndpoint;
  points?: number[];
}

export class SelectionModule implements RendererModule {
  private transformerManager?: TransformerManager;
  private connectorSelectionManager?: ConnectorSelectionManager;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;
  private unsubscribeVersion?: () => void;
  private transformSnapshot?: {
    movedMindmapNodes: Set<string>;
  };
  private pendingConnectorRefresh: Set<string> | null = null;
  private connectorRefreshHandle: number | null = null;
  private pendingMindmapReroute: Set<string> | null = null;
  private mindmapRerouteHandle: number | null = null;

  mount(ctx: ModuleRendererCtx): () => void {
    this.storeCtx = ctx;

    // Create transformer manager on overlay layer with dynamic aspect ratio control
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
    } catch (error) {
      // Ignore error
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
        this.captureTransformSnapshot();
      },
      onTransform: (nodes) => {
        // Real-time updates during transform for smoother UX (all elements including tables)
        this.updateElementsFromNodes(nodes, false);

        // CRITICAL FIX: Synchronize shape text positioning during transform
        this.syncShapeTextDuringTransform(nodes);
      },
      onTransformEnd: (nodes) => {
        this.updateElementsFromNodes(nodes, true); // Commit with history

        this.releaseTransformSnapshot();

        // End transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.endTransform) {
          store.endTransform();
        }

        // Re-apply constraints to update the boundBoxFunc
        if (this.transformerManager) {
          const filteredNodes = this.filterTransformableNodes(nodes);
          this.transformerManager.detach();
          if (filteredNodes.length > 0) {
            this.transformerManager.attachToNodes(filteredNodes);
          }
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
    if (typeof window !== "undefined") {
      if (this.connectorRefreshHandle !== null) {
        window.cancelAnimationFrame(this.connectorRefreshHandle);
        this.connectorRefreshHandle = null;
      }
      if (this.mindmapRerouteHandle !== null) {
        window.cancelAnimationFrame(this.mindmapRerouteHandle);
        this.mindmapRerouteHandle = null;
      }
    }
    this.pendingConnectorRefresh = null;
    this.pendingMindmapReroute = null;
  }

  private updateSelection(selectedIds: Set<string>) {
    if (!this.transformerManager || !this.storeCtx) {
      return;
    }

    // CRITICAL FIX: Always clear both selection systems first to prevent conflicts
    this.transformerManager.setKeepRatio(false);
    this.transformerManager.detach();

    if (this.connectorSelectionManager) {
      this.connectorSelectionManager.clearSelection();
    }

    if (selectedIds.size === 0) {
      return;
    }

    // CRITICAL FIX: Categorize selection with enhanced debugging
    const { connectorIds, mindmapEdgeIds, nonConnectorIds } =
      this.categorizeSelection(selectedIds);

    // CRITICAL FIX: Handle connector selection with proper integration
    // If ONLY connectors are selected, use connector selection manager
    if (
      connectorIds.length >= 1 &&
      nonConnectorIds.length === 0 &&
      mindmapEdgeIds.length === 0
    ) {
      if (this.connectorSelectionManager) {
        setTimeout(() => {
          const id = connectorIds[0];
          this.connectorSelectionManager?.showSelection(id);
        }, 100);
      }
    } else {
      this.connectorSelectionManager?.clearSelection();
    }

    // CRITICAL FIX: Handle mixed or non-connector selection
    if (nonConnectorIds.length > 0) {
      const selectionSnapshot = new Set(nonConnectorIds);

      // Enhanced delay to ensure elements are fully rendered
      setTimeout(() => {
        // Find Konva nodes for selected elements across all layers
        const nodes = this.filterTransformableNodes(
          this.resolveElementsToNodes(selectionSnapshot),
        );

        if (nodes.length > 0) {
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
                transformer.visible(true);
                transformer.getLayer()?.batchDraw();
              }
            }
          }, 10);
        } else {
          this.transformerManager?.detach();
          this.transformerManager?.setKeepRatio(false);
        }
      }, 75);
    }
  }

  // Helper to infer element type for a given node using attrs/names
  private getElementTypeForNode(node: Konva.Node): string {
    const nodeType = node.getAttr<string | undefined>("nodeType");
    if (nodeType) return nodeType;
    const elementType = node.getAttr<string | undefined>("elementType");
    if (elementType) return elementType;
    const name = typeof node.name === "function" ? node.name() : "";
    if (name.includes("connector")) return "connector";
    return "element";
  }

  private filterTransformableNodes(nodes: Konva.Node[]): Konva.Node[] {
    return nodes.filter((node) => {
      const type = this.getElementTypeForNode(node);
      return type !== "connector" && type !== "mindmap-edge";
    });
  }

  private debugLog(message: string, data?: unknown) {
    if (typeof window === "undefined") return;
    const flag = (window as Window & { __selectionDebug?: boolean }).__selectionDebug;
    if (!flag) return;
    // eslint-disable-next-line no-console
    console.log("[SelectionModule]", message, data ?? "");
  }

  private resolveElementsToNodes(
    elementIds: Set<string>,
  ): Konva.Node[] {
    if (!this.storeCtx) return [];

    const nodes: Konva.Node[] = [];

    // Collect all available layers and filter out undefined/null ones
    const allLayers: Array<{
      name: string;
      layer: Konva.Container | null;
    }> = [
      { name: "main", layer: this.storeCtx.layers.main },
      { name: "highlighter", layer: this.storeCtx.layers.highlighter },
      { name: "overlay", layer: this.storeCtx.layers.overlay },
      { name: "preview", layer: this.storeCtx.layers.preview },
    ];

    const validLayers = allLayers
      .filter(({ layer }) => {
        if (!layer) {
          return false;
        }
        return true;
      })
      .map(({ layer }) => layer);

    if (validLayers.length === 0) {
      return [];
    }

    for (const elementId of elementIds) {
      let found = false;

      // Search in valid layers for nodes with elementId attribute or matching id
      for (const layer of validLayers) {
        // Additional safety check before calling find()
        if (!layer || typeof layer.find !== "function") {
          continue;
        }

        const candidatesRaw = layer.find((node: Konva.Node) => {
          const nodeElementId =
            node.getAttr<string | undefined>("elementId") || node.id();
          return nodeElementId === elementId;
        });

        const candidates = Array.isArray(candidatesRaw)
          ? (candidatesRaw as Konva.Node[])
          : typeof (candidatesRaw as { toArray?: () => Konva.Node[] }).toArray ===
              "function"
            ? (candidatesRaw as { toArray: () => Konva.Node[] }).toArray()
            : [];

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
          } else {
            // Ignore error
          }
          break;
        }
      }

      if (!found) {
        // Ignore error
      }
    }

    return nodes;
  }

  private updateElementsFromNodes(
    nodes: Konva.Node[],
    commitWithHistory: boolean,
  ) {
    if (!this.storeCtx) return;

    const store = this.storeCtx.store.getState();
    const updateElement = store.element?.update;
    const withUndo = store.withUndo;

    const applyUpdate = (
      id: string,
      changes: ElementChanges,
      options?: { pushHistory?: boolean },
    ) => {
      try {
        if (updateElement) {
          updateElement(id, changes);
        } else {
          this.storeCtx?.store
            ?.getState()
            ?.updateElement?.(id, changes, options);
        }
      } catch (error) {
        // Ignore error
      }
    };

    const updates: ElementUpdate[] = [];
    const movedElementIds = new Set<string>();
    const movedMindmapNodeIds = new Set<string>();

    for (const node of nodes) {
      const elementId = node.getAttr("elementId") || node.id();
      if (!elementId) continue;
      movedElementIds.add(elementId);

      const pos = node.position();
      let size = node.size();
      const rotation = node.rotation();
      const scale = node.scale();
      const rawScaleX = scale?.x ?? 1;
      const rawScaleY = scale?.y ?? 1;

      // CRITICAL FIX: Check if this is a table element by looking at the actual element data
      const element =
        store.elements.get(elementId) ??
        store.element?.getById?.(elementId);
      const isTable = element?.type === "table";
      const isImage = element?.type === "image";
      if (element?.type === "mindmap-node") {
        movedMindmapNodeIds.add(elementId);
      }

      if (isImage && node instanceof Konva.Group) {
        const imageNode = node.findOne("Image");
        if (imageNode) {
          size = imageNode.size();
        }
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

          nextWidth = tableResizeResult.width;
          nextHeight = tableResizeResult.height;
          changes.width = Math.round(tableResizeResult.width * 100) / 100;
          changes.height = Math.round(tableResizeResult.height * 100) / 100;
          changes.colWidths = tableResizeResult.colWidths;
          changes.rowHeights = tableResizeResult.rowHeights;
        } else {
          // Ignore error
        }
      }

      if (shouldCommitSizeNow) {
        changes.width = Math.round(nextWidth * 100) / 100;
        changes.height = Math.round(nextHeight * 100) / 100;
      }

      // Always enqueue an update so connected visuals (connectors, mindmap branches) can respond
      updates.push({
        id: elementId,
        changes: { ...changes },
      });

      // Reset scale after applying to dimensions when width/height have been normalized
      if (
        shouldCommitSizeNow &&
        scale &&
        (rawScaleX !== 1 || rawScaleY !== 1)
      ) {
        if (isImage && node instanceof Konva.Group) {
          const imageChild = node.findOne<Konva.Image>('Image');
          if (imageChild) {
            imageChild.size({ width: nextWidth, height: nextHeight });
          }
        }
        node.setAttrs({
          scaleX: 1,
          scaleY: 1,
          width: nextWidth,
          height: nextHeight,
        });
        if (tableResizeResult) {
          const minTableWidth =
            tableResizeResult.cols * DEFAULT_TABLE_CONFIG.minCellWidth;
          const minTableHeight =
            tableResizeResult.rows * DEFAULT_TABLE_CONFIG.minCellHeight;
          if (nextWidth < minTableWidth || nextHeight < minTableHeight) {
            // Ignore error
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
          applyUpdate(id, changes, { pushHistory: false });
        }
      });
    } else if (updates.length > 0) {
      // For non-history updates (during transform), use updateElement directly
      for (const { id, changes } of updates) {
        applyUpdate(id, changes, { pushHistory: false });
      }
    }

    if (movedElementIds.size > 0) {
      this.scheduleConnectorRefresh(movedElementIds);
    }

    if (movedMindmapNodeIds.size > 0) {
      this.scheduleMindmapReroute(movedMindmapNodeIds);
    }
  }

  // FIXED: Public API for other modules to trigger selection with proper store integration
  selectElement(elementId: string, options?: { additive?: boolean }) {
    if (!this.storeCtx) {
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
        // Ignore error
      }
    } catch (error) {
      // Ignore error
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
        const nodes = this.filterTransformableNodes(
          this.resolveElementsToNodes(new Set([elementId])),
        );

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
          // Ignore error
        }
      }, delay);
    };

    // Start the retry mechanism
    attemptSelection();
  }

  // Public method to clear selection
  clearSelection() {
    if (!this.storeCtx || this.transformSnapshot) return;

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
      const nodes = this.filterTransformableNodes(
        this.resolveElementsToNodes(selectionSnapshot),
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
    const lockableTypes = new Set([
      "sticky-note",
      "image",
      "circle",
      "table",
    ]);

    for (const id of selectedIds) {
      const element = elementsMap.get(id);
      if (!element) {
        return false;
      }

      const shouldKeepAspect =
        element.keepAspectRatio === true ||
        (element.type ? lockableTypes.has(element.type) : false);

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
    const { connectorIds, mindmapEdgeIds, nonConnectorIds } =
      this.categorizeSelection(selectedIds);

    // Handle connector selection refresh
    if (
      connectorIds.length === 1 &&
      nonConnectorIds.length === 0 &&
      mindmapEdgeIds.length === 0
    ) {
      this.transformerManager.detach();
      this.connectorSelectionManager?.refreshSelection();
      return;
    }

    // Handle non-connector selection refresh
    if (nonConnectorIds.length > 0) {
      this.connectorSelectionManager?.clearSelection();

      // Find Konva nodes for selected elements
      const nodes = this.filterTransformableNodes(
        this.resolveElementsToNodes(new Set(nonConnectorIds)),
      );

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
    mindmapEdgeIds: string[];
    nonConnectorIds: string[];
  } {
    if (!this.storeCtx) {
      return {
        connectorIds: [],
        mindmapEdgeIds: [],
        nonConnectorIds: Array.from(selectedIds),
      };
    }

    const state = this.storeCtx.store.getState();
    const elements = state.elements || new Map();

    const connectorIds: string[] = [];
    const mindmapEdgeIds: string[] = [];
    const nonConnectorIds: string[] = [];

    for (const id of selectedIds) {
      const element = elements.get(id) || state.element?.getById?.(id);

      if (!element) {
        nonConnectorIds.push(id);
        continue;
      }

      if (element.type === "connector") {
        connectorIds.push(id);
      } else if (element.type === "mindmap-edge") {
        mindmapEdgeIds.push(id);
      } else {
        nonConnectorIds.push(id);
      }
    }

    return { connectorIds, mindmapEdgeIds, nonConnectorIds };
  }

  private scheduleConnectorRefresh(elementIds: Set<string>) {
    if (elementIds.size === 0) return;

    // If we are not in an active transform snapshot, refresh immediately
    if (!this.transformSnapshot || typeof window === "undefined") {
      this.refreshConnectedConnectors(elementIds);
      return;
    }

    if (!this.pendingConnectorRefresh) {
      this.pendingConnectorRefresh = new Set();
    }

    elementIds.forEach((id) => this.pendingConnectorRefresh?.add(id));

    if (this.connectorRefreshHandle !== null) {
      return;
    }

    this.connectorRefreshHandle = window.requestAnimationFrame(() => {
      const ids = this.pendingConnectorRefresh;
      this.pendingConnectorRefresh = null;
      this.connectorRefreshHandle = null;
      if (!ids || ids.size === 0) {
        return;
      }
      this.debugLog("RAF connector refresh", { ids: Array.from(ids) });
      this.refreshConnectedConnectors(ids);
    });
  }

  private scheduleMindmapReroute(nodeIds: Set<string>) {
    if (nodeIds.size === 0) return;

    if (typeof window === "undefined") {
      this.performMindmapReroute(nodeIds);
      return;
    }

    if (!this.pendingMindmapReroute) {
      this.pendingMindmapReroute = new Set();
    }
    nodeIds.forEach((id) => this.pendingMindmapReroute?.add(id));

    if (this.mindmapRerouteHandle !== null) {
      return;
    }

    this.mindmapRerouteHandle = window.requestAnimationFrame(() => {
      const ids = this.pendingMindmapReroute;
      this.pendingMindmapReroute = null;
      this.mindmapRerouteHandle = null;
      if (!ids || ids.size === 0) {
        return;
      }
      this.debugLog("RAF mindmap reroute", { ids: Array.from(ids) });
      this.performMindmapReroute(ids);
    });
  }

  private performMindmapReroute(nodeIds: Set<string>) {
    const renderer = this.getMindmapRenderer();
    if (!renderer || nodeIds.size === 0) return;
    try {
      batchMindmapReroute(renderer, Array.from(nodeIds));
    } catch {
      // Ignore reroute errors during live drag
    }
  }

  private refreshConnectedConnectors(elementIds: Set<string>) {
    if (!this.storeCtx) return;
    const state = this.storeCtx.store.getState();
    const affectedConnectorIds: string[] = [];

    for (const [id, element] of state.elements.entries()) {
      if (element.type !== "connector") continue;
      const connector = element as ConnectorElement;
      const fromElement =
        connector.from.kind === "element" ? connector.from.elementId : null;
      const toElement =
        connector.to.kind === "element" ? connector.to.elementId : null;
      if (
        (fromElement && elementIds.has(fromElement)) ||
        (toElement && elementIds.has(toElement))
      ) {
        affectedConnectorIds.push(id);
      }
    }

    affectedConnectorIds.forEach((connectorId) => {
      try {
        state.updateElement?.(
          connectorId,
          (existing) => ({ ...existing }),
          { pushHistory: false },
        );
      } catch {
        // ignore connector refresh errors
      }
    });

    if (affectedConnectorIds.length > 0) {
      this.connectorSelectionManager?.refreshSelection();
    }

    const connectorService =
      typeof window !== "undefined"
        ? (window as Window & {
            connectorService?: {
              forceRerouteElement: (id: string) => void;
            };
          }).connectorService
        : undefined;

    if (connectorService) {
      elementIds.forEach((elementId) => {
        try {
          connectorService.forceRerouteElement(elementId);
        } catch {
          // Ignore routing errors during live drag
        }
      });
    }
  }

  private captureTransformSnapshot() {
    if (!this.storeCtx) return;

    const state = this.storeCtx.store.getState();
    const selectedIds = state.selectedElementIds || new Set<string>();
    if (selectedIds.size === 0) {
      this.transformSnapshot = undefined;
      return;
    }

    const movedMindmapNodes = new Set<string>();

    for (const id of selectedIds) {
      const element = state.elements.get(id) || state.element?.getById?.(id);
      if (!element) continue;

      if (element.type === "mindmap-node") {
        movedMindmapNodes.add(id);
      }
    }

    this.transformSnapshot = {
      movedMindmapNodes,
    };

    this.debugLog("Transform snapshot initialized", {
      movedMindmapNodes: movedMindmapNodes.size,
    });

    if (movedMindmapNodes.size > 0) {
      this.setMindmapLiveRoutingEnabled(false);
    }
  }


  private releaseTransformSnapshot() {
    if (!this.transformSnapshot) {
      this.setMindmapLiveRoutingEnabled(true);
      return;
    }

    const snapshot = this.transformSnapshot;
    this.transformSnapshot = undefined;

    if (typeof window !== "undefined") {
      if (this.connectorRefreshHandle !== null) {
        window.cancelAnimationFrame(this.connectorRefreshHandle);
        this.connectorRefreshHandle = null;
      }
      if (this.mindmapRerouteHandle !== null) {
        window.cancelAnimationFrame(this.mindmapRerouteHandle);
        this.mindmapRerouteHandle = null;
      }
    }
    this.pendingConnectorRefresh = null;
    this.pendingMindmapReroute = null;

    this.setMindmapLiveRoutingEnabled(true);

    const connectorService = this.getConnectorService();
    try {
      connectorService?.forceRerouteAll();
    } catch {
      // Ignore reroute errors
    }

    const movedMindmapNodes = Array.from(snapshot.movedMindmapNodes);
    if (movedMindmapNodes.length > 0) {
      const mindmapRenderer = this.getMindmapRenderer();
      if (mindmapRenderer) {
        try {
          debug("Triggering mindmap reroute after transform", {
            category: "selection/transform",
            data: { nodes: movedMindmapNodes },
          });
          batchMindmapReroute(mindmapRenderer, movedMindmapNodes);
        } catch {
          // Ignore reroute errors
        }
      }
    }
  }

  private setMindmapLiveRoutingEnabled(enabled: boolean) {
    const renderer = this.getMindmapRenderer();
    if (!renderer) return;

    try {
      if (enabled) {
        renderer.resumeLiveRouting();
      } else {
        renderer.pauseLiveRouting();
      }
    } catch {
      // Ignore enable/disable errors
    }
  }

  private getConnectorService(): ConnectorService | null {
    if (typeof window === "undefined") return null;
    return (
      (window as Window & { connectorService?: ConnectorService }).connectorService ||
      null
    );
  }

  private updateConnectorElement(
    id: string,
    changes: Partial<ConnectorElement>,
  ) {
    const state = this.storeCtx?.store.getState();
    if (!state) return;

    if (state.element?.update) {
      try {
        state.element.update(id, changes);
      } catch {
        // ignore update errors
      }
      return;
    }

    if (state.updateElement) {
      try {
        state.updateElement(id, changes, { pushHistory: false });
      } catch {
        // ignore update errors
      }
    }
  }

  private getMindmapRenderer(): MindmapRenderer | null {
    if (typeof window === "undefined") return null;
    return (
      (window as Window & { mindmapRenderer?: MindmapRenderer }).mindmapRenderer ||
      null
    );
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

    // Optionally trigger connector re-render for real-time feedback
    if (this.storeCtx) {
      const state = this.storeCtx.store.getState();
      const connector =
        state.elements.get(connectorId) ||
        state.element?.getById?.(connectorId);

      if (connector && connector.type === "connector") {
        // We could trigger a temporary re-render here, but for now
        // the ConnectorSelectionManager handles the visual feedback with endpoint dots
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
      const shapeRenderer = typeof window !== "undefined" ? window.shapeRenderer : undefined;
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
          store.elements.get(elementId) ??
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
      // Ignore error
    }
  }
}
