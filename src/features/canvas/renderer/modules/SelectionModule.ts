// features/canvas/renderer/modules/SelectionModule.ts
import type Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import { batchMindmapReroute } from "./mindmapWire";
import { TransformerManager } from "../../managers/TransformerManager";
import { ConnectorSelectionManager } from "../../managers/ConnectorSelectionManager";
import {
  categorizeSelection,
  filterTransformableNodes,
  resolveElementsToNodes,
} from "./selection/SelectionResolver";
import { TransformController } from "./selection/controllers/TransformController";
import { ConnectorTransformFinalizer } from "./selection/controllers/ConnectorTransformFinalizer";
import {
  transformStateManager,
  elementSynchronizer,
  connectorSelectionManager,
  mindmapSelectionManager,
  isMindmapRenderer,
} from "./selection/managers";
import { TransformLifecycleCoordinator } from "./selection/controllers/TransformLifecycleCoordinator";
import { MarqueeSelectionController } from "./selection/controllers/MarqueeSelectionController";
import { SelectionDebouncer } from "./selection/utils/SelectionDebouncer";
import { debug } from "../../../../utils/debug";

const LOG_CATEGORY = "selection/module";

export class SelectionModule implements RendererModule {
  private transformerManager?: TransformerManager;
  private connectorSelectionManager?: ConnectorSelectionManager;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;
  private unsubscribeVersion?: () => void;
  private transformController?: TransformController;
  private marqueeSelectionController?: MarqueeSelectionController;
  private readonly selectionDebouncer = new SelectionDebouncer();
  private transformLifecycle?: TransformLifecycleCoordinator;
  private connectorTransformFinalizer?: ConnectorTransformFinalizer;
  private readonly mindmapDescendantInitialPositions = new Map<string, { x: number; y: number }>();

  mount(ctx: ModuleRendererCtx): () => void {
    this.storeCtx = ctx;

    // Create transformer manager on overlay layer with dynamic aspect ratio control
    try {
      this.connectorSelectionManager = new ConnectorSelectionManager(
        ctx.stage,
        {
          overlayLayer: ctx.layers.overlay,
          // Real-time connector endpoint update during drag
          // The actual store update happens on drag end in ConnectorSelectionManager
          onEndpointDrag: () => {
            // Placeholder for real-time visual updates
            // ConnectorSelectionManager handles visual feedback with endpoint dots
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
      onTransformStart: (nodes) => {
        this.beginSelectionTransform(nodes, "transform");
      },
      onTransform: (nodes) => {
        this.progressSelectionTransform(nodes, "transform");
      },
      onTransformEnd: (nodes) => {
        this.endSelectionTransform(nodes, "transform");
      },
    });

    this.transformController = new TransformController({
      getTransformer: () => this.transformLifecycle?.getTransformer() ?? null,
      applyAnchoredOverride: (id, from, to) => {
        connectorSelectionManager.updateElement(id, { from, to });
      },
      setConnectorRoutingEnabled: (enabled) =>
        connectorSelectionManager.setLiveRoutingEnabled(enabled),
      setMindmapRoutingEnabled: (enabled) =>
        mindmapSelectionManager.setLiveRoutingEnabled(enabled),
      updateConnectorElement: (id, changes) =>
        connectorSelectionManager.updateElement(id, changes),
      rerouteAllConnectors: () => {
        const connectorService =
          typeof window !== "undefined"
            ? window.connectorService ?? null
            : null;
        try {
          connectorService?.forceRerouteAll();
        } catch {
          // ignore reroute errors
        }
      },
      rerouteMindmapNodes: (ids) => {
        const renderer = mindmapSelectionManager.getRenderer();
        if (!isMindmapRenderer(renderer)) return;
        try {
          this.debugLog("Triggering mindmap reroute after transform", {
            category: "selection/transform",
            data: { nodes: ids },
          });
          batchMindmapReroute(renderer, ids);
        } catch {
          // ignore reroute errors
        }
      },
      debug: (message, data) => this.debugLog(message, data),
    });

    // Create connector transform finalizer
    this.connectorTransformFinalizer = new ConnectorTransformFinalizer(
      ctx,
      this.transformController,
    );

    // Initialize MarqueeSelectionController
    this.marqueeSelectionController = new MarqueeSelectionController({
      elements: () => {
        const state = this.storeCtx?.store.getState();
        return state?.elements || new Map();
      },
      setSelection: (ids) => {
        const state = this.storeCtx?.store.getState();
        if (state?.setSelection) {
          state.setSelection(ids);
        }
      },
      onSelectionComplete: (selectedIds) => {
        this.debugLog(
          "MarqueeSelectionController: selection completed",
          selectedIds,
        );
      },
      debug: (message, data) => this.debugLog(message, data),
    });

    if (typeof window !== "undefined") {
      window.marqueeSelectionController = this.marqueeSelectionController;
    }

    this.transformLifecycle = new TransformLifecycleCoordinator(
      this.transformerManager,
      {
        onBegin: (nodes, source) => this.beginSelectionTransform(nodes, source),
        onProgress: (nodes, source) =>
          this.progressSelectionTransform(nodes, source),
        onEnd: (nodes, source) => this.endSelectionTransform(nodes, source),
      },
      (message, data) => this.debugLog(message, data),
    );

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
        if (this.transformLifecycle && this.storeCtx) {
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
    this.selectionDebouncer.cancel();
    this.transformLifecycle?.detach();

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
    this.transformLifecycle = undefined;
    this.transformController = undefined;
    this.marqueeSelectionController = undefined;
    if (typeof window !== "undefined") {
      delete window.marqueeSelectionController;
    }
  }
  private updateSelection(selectedIds: Set<string>) {
    if (!this.transformLifecycle || !this.storeCtx) {
      return;
    }

    this.debugLog("updateSelection", { ids: Array.from(selectedIds) });

    // CRITICAL FIX: Always clear both selection systems first to prevent conflicts
    this.transformLifecycle?.setKeepRatio(false);
    this.transformLifecycle?.detach();
    this.connectorSelectionManager?.clearSelection();

    if (selectedIds.size === 0) {
      return;
    }

    // Handle connector-only selection via debouncer
    if (
      this.selectionDebouncer.scheduleConnectorSelection(
        selectedIds,
        this.storeCtx,
        this.connectorSelectionManager,
        (message, data) => this.debugLog(message, data),
      )
    ) {
      return;
    }

    // Handle non-connector selection
    const state = this.storeCtx.store.getState();
    const { nonConnectorIds } = categorizeSelection({
      selectedIds,
      elements: (state.elements as Map<string, { type?: string }>) ?? new Map(),
      getElementById: state.element?.getById?.bind(state.element),
    });

    if (nonConnectorIds.length === 0) {
      return;
    }

    // CRITICAL FIX: Handle mixed or non-connector selection
    const selectionSnapshot = new Set(nonConnectorIds);

    // Enhanced delay to ensure elements are fully rendered
    setTimeout(() => {
      // Find Konva nodes for selected elements across all layers
      const rawNodes = resolveElementsToNodes({
        stage: this.getStage(),
        layers: this.getLayers(),
        elementIds: selectionSnapshot,
      });
      const nodes = filterTransformableNodes(rawNodes, (message, data) =>
        this.debugLog(message, data),
      );
      this.debugLog("Resolved nodes for transformer", {
        requestedIds: Array.from(selectionSnapshot),
        raw: rawNodes.map((n) => ({
          id: n.getAttr("elementId") || n.id(),
          name: n.name(),
          nodeType: n.getAttr("nodeType"),
          elementType: n.getAttr("elementType"),
        })),
        filtered: nodes.map((n) => ({
          id: n.getAttr("elementId") || n.id(),
          name: n.name(),
          nodeType: n.getAttr("nodeType"),
          elementType: n.getAttr("elementType"),
        })),
      });

      if (nodes.length > 0) {
        this.transformLifecycle?.attach(nodes);
        const lockAspect =
          transformStateManager.shouldLockAspectRatio(selectionSnapshot);
        this.transformLifecycle?.setKeepRatio(lockAspect);

        // CRITICAL FIX: Ensure transformer is shown and force a batch draw
        this.transformLifecycle?.show();

        // Additional safety check: force visibility and batch draw
        setTimeout(() => {
          this.transformLifecycle?.ensureVisible();
        }, 10);
      } else {
        this.transformLifecycle?.detach();
        this.transformLifecycle?.setKeepRatio(false);
      }
    }, 75);
  }

  private debugLog(message: string, data?: unknown) {
    const forceLogging =
      typeof window !== "undefined" &&
      Boolean((window as Window & { __selectionDebug?: boolean }).__selectionDebug);

    debug(`SelectionModule: ${message}`, {
      category: LOG_CATEGORY,
      data,
      force: forceLogging,
    });
  }

  private getStage(): Konva.Stage | null {
    return (
      this.storeCtx?.stage ??
      (typeof window !== "undefined"
        ? ((window as Window & { konvaStage?: Konva.Stage }).konvaStage ?? null)
        : null)
    );
  }

  private getLayers(): Array<Konva.Container | null | undefined> {
    return this.storeCtx
      ? [
          this.storeCtx.layers.main,
          this.storeCtx.layers.highlighter,
          this.storeCtx.layers.overlay,
          this.storeCtx.layers.preview,
        ]
      : [];
  }

  private beginSelectionTransform(
    nodes: Konva.Node[],
    source: "drag" | "transform",
  ) {
    debug("SelectionModule: beginSelectionTransform", {
      category: LOG_CATEGORY,
      data: {
        source,
        nodeCount: nodes.length,
        nodeIds: nodes.map((node) => node.id()),
      },
    });
    
    // Delegate to TransformStateManager
    transformStateManager.beginTransform(nodes, source);

    // TransformStateManager handles snapshots internally
    this.transformController?.clearSnapshot();

    // Store initial positions of mindmap descendants when dragging
    if (source === "drag" && this.storeCtx) {
      this.mindmapDescendantInitialPositions.clear();
      const state = this.storeCtx.store.getState();
      const renderer = mindmapSelectionManager.getRenderer();

      if (renderer) {
        nodes.forEach(node => {
          const id = node.id();
          const element = state.elements?.get(id);
          
          if (element?.type === 'mindmap-node') {
            const descendants = renderer.getAllDescendants?.(id);
            if (descendants) {
              descendants.forEach((descendantId: string) => {
                const descendantGroup = renderer.getNodeGroup?.(descendantId);
                if (descendantGroup) {
                  this.mindmapDescendantInitialPositions.set(descendantId, {
                    x: descendantGroup.x(),
                    y: descendantGroup.y(),
                  });
                }
              });
            }
          }
        });
      }
    }
  }

  private progressSelectionTransform(
    nodes: Konva.Node[],
    source: "drag" | "transform",
  ) {
    debug("SelectionModule: progressSelectionTransform", {
      category: LOG_CATEGORY,
      data: {
        source,
        nodeCount: nodes.length,
      },
    });
    
    // Delegate to TransformStateManager
    transformStateManager.progressTransform(nodes, source);

    // Live visual updates for connectors and mindmap edges using existing controller
    const delta = this.transformController?.computeDelta(nodes);
    if (!delta) return;

    // Update visuals directly through transform controller
    const snapshot = this.transformController?.getSnapshot();
    if (snapshot) {
      this.transformController?.updateConnectorShapes(
        delta,
        (connectorId, shape) => {
          if (shape) {
            connectorSelectionManager.updateShapeGeometry(connectorId, shape);
          }
        },
      );
    }
    mindmapSelectionManager.updateEdgeVisuals(delta);

    // Move mindmap descendants when dragging mindmap nodes
    if (source === "drag" && this.storeCtx) {
      const state = this.storeCtx.store.getState();
      const mindmapNodeIds = nodes
        .filter(node => {
          const id = node.id();
          const element = state.elements?.get(id);
          return element?.type === 'mindmap-node';
        })
        .map(node => node.id());
      
      if (mindmapNodeIds.length > 0) {
        mindmapSelectionManager.moveMindmapDescendants(
          mindmapNodeIds,
          delta,
          this.mindmapDescendantInitialPositions
        );
      }
    }
  }

  private endSelectionTransform(
    nodes: Konva.Node[],
    source: "drag" | "transform",
  ) {
    // Delegate to TransformStateManager
    transformStateManager.endTransform(nodes, source);

    // Delegate connector-specific transform finalization to dedicated class
    this.connectorTransformFinalizer?.finalizeConnectorTransform(nodes);

    // Filter out connector nodes to prevent double-processing with pushHistory: true
    // ConnectorTransformFinalizer already handled connectors with pushHistory: false
    const nonConnectorNodes = nodes.filter(node => {
      const elementType = node.getAttr("elementType");
      return elementType !== "connector";
    });

    // Commit final positions and clean up visuals (excluding connectors)
    if (nonConnectorNodes.length > 0) {
      // Handle mindmap descendants when dragging mindmap nodes
      if (source === "drag" && this.storeCtx) {
        const state = this.storeCtx.store.getState();
        const mindmapNodes = nonConnectorNodes.filter(node => {
          const id = node.id();
          const element = state.elements?.get(id);
          return element?.type === 'mindmap-node';
        });

        if (mindmapNodes.length > 0) {
          // Gather all nodes that need position updates (dragged nodes + descendants)
          const allNodesToUpdate = new Set<Konva.Node>(nodes);
          const renderer = mindmapSelectionManager.getRenderer();
          
          if (renderer) {
            mindmapNodes.forEach(node => {
              const descendants = renderer.getAllDescendants?.(node.id());
              if (descendants) {
                descendants.forEach((descendantId: string) => {
                  const descendantGroup = renderer.getNodeGroup?.(descendantId);
                  if (descendantGroup) {
                    allNodesToUpdate.add(descendantGroup);
                  }
                });
              }
            });
          }

          // Update all nodes (dragged + descendants) in one transaction
          elementSynchronizer.updateElementsFromNodes(
            Array.from(allNodesToUpdate),
            "transform",
            {
              pushHistory: true,
              batchUpdates: true,
            }
          );
        } else {
          // No mindmap nodes, use normal update
          elementSynchronizer.updateElementsFromNodes(nonConnectorNodes, "transform", {
            pushHistory: true,
            batchUpdates: true,
          });
        }
      } else {
        // Not a drag operation or no store context, use normal update
        elementSynchronizer.updateElementsFromNodes(nonConnectorNodes, "transform", {
          pushHistory: true,
          batchUpdates: true,
        });
      }
    }

    // Direct call to TransformStateManager (Phase 3: shim removal)
    transformStateManager.finalizeTransform();
    this.transformController?.release();
  }

  // FIXED: Enhanced auto-select element with better timing and error recovery
  autoSelectElement(elementId: string) {
    // Immediate selection attempt
    const storeCtx = this.storeCtx;
    if (storeCtx) {
      const store = storeCtx.store;
      const state = store.getState();

      if (typeof state.setSelection === "function") {
        state.setSelection([elementId]);
      } else {
        // Some store variants expose a selection controller object
        const selectionController = state.selection as
          | { set?: (ids: string[]) => void; replace?: (ids: string[]) => void }
          | undefined;

        if (selectionController?.set) {
          selectionController.set([elementId]);
        } else if (selectionController?.replace) {
          selectionController.replace([elementId]);
        } else {
          const selected = state.selectedElementIds;

          if (selected instanceof Set || Array.isArray(selected)) {
            const next = new Set<string>([elementId]);
            store.setState?.({ selectedElementIds: next });
          } else {
            store.setState?.({ selectedElementIds: new Set([elementId]) });
          }
        }
      }
    }

    // Enhanced retry mechanism with exponential backoff for better reliability
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 25; // Start with shorter delay

    const attemptSelection = () => {
      attempts += 1;
      const delay = baseDelay * Math.pow(1.5, attempts - 1); // Exponential backoff

      setTimeout(() => {
        const rawNodes = resolveElementsToNodes({
          stage:
            this.storeCtx?.stage ??
            (typeof window !== "undefined"
              ? ((window as Window & { konvaStage?: Konva.Stage }).konvaStage ??
                null)
              : null),
          layers: this.storeCtx
            ? [
                this.storeCtx.layers.main,
                this.storeCtx.layers.highlighter,
                this.storeCtx.layers.overlay,
                this.storeCtx.layers.preview,
              ]
            : [],
          elementIds: new Set([elementId]),
        });

        const nodes = filterTransformableNodes(rawNodes, (message, data) =>
          this.debugLog(message, data),
        );

        if (nodes.length > 0) {
          this.transformLifecycle?.detach();
          setTimeout(() => {
            this.transformLifecycle?.attach(nodes);
            this.transformLifecycle?.show();
          }, 10);
          return; // Success, stop retrying
        }

        if (attempts < maxAttempts) {
          // Re-set selection for retry
          if (storeCtx) {
            const store = storeCtx.store;
            const state = store.getState();
            if (typeof state.setSelection === "function") {
              state.setSelection([elementId]);
            }
          }
          attemptSelection(); // Recursive retry
        }
      }, delay);
    };

    attemptSelection();
  }

  // Public method to clear selection
  clearSelection() {
    if (!this.storeCtx || this.transformController?.isActive()) return;

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

    this.transformLifecycle?.detach();
    this.transformLifecycle?.setKeepRatio(false);
  }

  // Helper method to attach transformer to nodes
  private attachTransformerToNodes(
    selectedIds: Set<string>,
    delay: number = 50,
  ) {
    if (!this.transformLifecycle) return;

    setTimeout(() => {
      const rawNodes = resolveElementsToNodes({
        stage: this.getStage(),
        layers: this.getLayers(),
        elementIds: selectedIds,
      });
      const nodes = filterTransformableNodes(rawNodes, (message, data) =>
        this.debugLog(message, data),
      );

      if (nodes.length > 0) {
        this.transformLifecycle?.detach();
        setTimeout(() => {
          this.transformLifecycle?.attach(nodes);
          const lockAspect =
            transformStateManager.shouldLockAspectRatio(selectedIds);
          this.transformLifecycle?.setKeepRatio(lockAspect);
          this.transformLifecycle?.show();
        }, 10);
      } else {
        this.transformLifecycle?.detach();
        this.transformLifecycle?.setKeepRatio(false);
      }
    }, delay);
  }

  // Private method to refresh transformer for current selection (used when selection version changes)
  private refreshTransformerForSelection(selectedIds: Set<string>) {
    if (!this.transformLifecycle || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformLifecycle.setKeepRatio(false);
      this.transformLifecycle.detach();
      return;
    }

    const selectionSnapshot = new Set(selectedIds);

    // Handle connector-only selection via debouncer
    if (
      this.selectionDebouncer.handleImmediateConnectorSelection(
        selectionSnapshot,
        this.storeCtx,
        this.connectorSelectionManager,
        (message, data) => this.debugLog(message, data),
      )
    ) {
      // Ensure transformer is detached when handling connector-only selection
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
      this.connectorSelectionManager?.clearSelection();
      return;
    }

    // Handle non-connector selection with transformer
    this.attachTransformerToNodes(selectionSnapshot, 50);
  }

  /**
   * Force an immediate refresh of the transformer for the current selection.
   * This is useful when elements have changed dimensions and the transformer
   * needs to update immediately without waiting for async delays.
   */
  public forceRefresh(): void {
    if (!this.transformLifecycle || !this.storeCtx) return;

    // Get current selection from store
    const currentState = this.storeCtx.store.getState();
    const selectedIds = (() => {
      const value = currentState.selectedElementIds;
      if (value instanceof Set) {
        return new Set(
          Array.from(value).filter(
            (id): id is string => typeof id === "string",
          ),
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
    })();

    // Delegate to immediate connector selection handler
    if (
      this.selectionDebouncer.handleImmediateConnectorSelection(
        selectedIds,
        this.storeCtx,
        this.connectorSelectionManager,
        (message, data) => this.debugLog(message, data),
      )
    ) {
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
      this.connectorSelectionManager?.refreshSelection();
      return;
    }

    // Handle non-connector selection with immediate attachment (no delay)
    if (selectedIds.size === 0) {
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
      return;
    }

    // Resolve nodes and attach transformer immediately
    const rawNodes = resolveElementsToNodes({
      stage: this.getStage(),
      layers: this.getLayers(),
      elementIds: selectedIds,
    });
    const nodes = filterTransformableNodes(rawNodes, (message, data) =>
      this.debugLog(message, data),
    );

    if (nodes.length > 0) {
      this.transformLifecycle?.detach();
      this.transformLifecycle?.attach(nodes);
      const lockAspect =
        transformStateManager.shouldLockAspectRatio(selectedIds);
      this.transformLifecycle?.setKeepRatio(lockAspect);
      this.transformLifecycle?.show();
      // Force immediate update for dimension changes
      this.transformLifecycle?.refresh();
    } else {
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
    }
  }
}

declare global {
  interface Window {
    marqueeSelectionController?: MarqueeSelectionController;
  }
}
