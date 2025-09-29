// features/canvas/renderer/modules/SelectionModule.ts
import Konva from "konva";
import type { ModuleRendererCtx, RendererModule } from "../index";
import type {
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorEndpointPoint,
} from "../../types/connector";
import type { MindmapRenderer } from "./MindmapRenderer";
import type { MindmapNodeElement, MindmapEdgeElement } from "../../types/mindmap";
import { batchMindmapReroute } from "./mindmapWire";
import { TransformerManager } from "../../managers/TransformerManager";
import { ConnectorSelectionManager } from "../../managers/ConnectorSelectionManager";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";
import type { TableElement } from "../../types/table";
import type { ConnectorService } from "../../services/ConnectorService";
import { applyTableScaleResize } from "./tableTransform";
import { debug } from "@/utils/debug";
import {
  categorizeSelection,
  filterTransformableNodes,
  resolveElementsToNodes,
} from "./selection/SelectionResolver";
import { TransformController } from "./selection/controllers/TransformController";
import { transformStateManager, elementSynchronizer, connectorSelectionManager, mindmapSelectionManager, shapeTextSynchronizer } from "./selection/managers";
import { MindmapController } from "./selection/controllers/MindmapController";
import { TransformLifecycleCoordinator } from "./selection/controllers/TransformLifecycleCoordinator";
import { MarqueeSelectionController } from "./selection/controllers/MarqueeSelectionController";
import type { TransformSnapshot, ConnectorSnapshot } from "./selection/types";

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
  private transformController?: TransformController;
  private mindmapController?: MindmapController;
  private marqueeSelectionController?: MarqueeSelectionController;
  private connectorSelectionTimer: number | null = null;
  private transformLifecycle?: TransformLifecycleCoordinator;
  private transformActive = false;
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
      applyAnchoredOverride: (id, from, to) =>
        this.applyConnectorEndpointOverride(id, from, to),
      setConnectorRoutingEnabled: (enabled) => this.setLiveRoutingEnabled(enabled),
      setMindmapRoutingEnabled: (enabled) => this.setMindmapLiveRoutingEnabled(enabled),
      updateConnectorElement: (id, changes) =>
        this.updateConnectorElement(id, changes),
      rerouteAllConnectors: () => {
        const connectorService = this.getConnectorService();
        try {
          connectorService?.forceRerouteAll();
        } catch {
          // ignore reroute errors
        }
      },
      rerouteMindmapNodes: (ids) => {
        const renderer = this.getMindmapRenderer();
        if (!renderer) return;
        try {
          debug("Triggering mindmap reroute after transform", {
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

    this.mindmapController = new MindmapController({
      projectNode: (nodeId, baseline, delta) => {
        const state = this.storeCtx?.store.getState();
        if (!state) return null;
        const element =
          (state.elements.get(nodeId) || state.element?.getById?.(nodeId)) as
            | MindmapNodeElement
            | undefined;
        if (!element || element.type !== "mindmap-node") {
          return null;
        }
        const baseX = baseline?.x ?? element.x ?? 0;
        const baseY = baseline?.y ?? element.y ?? 0;
        return {
          ...element,
          x: baseX + delta.dx,
          y: baseY + delta.dy,
        };
      },
      renderEdge: (edge, getPoint) => {
        const renderer = this.getMindmapRenderer();
        if (!renderer) return;
        renderer.renderEdge(edge, getPoint);
      },
    });

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
        this.debugLog("MarqueeSelectionController: selection completed", selectedIds);
      },
      debug: (message, data) => this.debugLog(message, data),
    });

    this.transformLifecycle = new TransformLifecycleCoordinator(
      this.transformerManager,
      {
        onBegin: (nodes, source) => this.beginSelectionTransform(nodes, source),
        onProgress: (nodes, source) => this.progressSelectionTransform(nodes, source),
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
    this.clearConnectorSelectionTimer();
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
    this.mindmapController = undefined;
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
    if (!this.transformLifecycle || !this.storeCtx) {
      return;
    }

    this.debugLog("updateSelection", { ids: Array.from(selectedIds) });

    this.clearConnectorSelectionTimer();

    // CRITICAL FIX: Always clear both selection systems first to prevent conflicts
    this.transformLifecycle?.setKeepRatio(false);
    this.transformLifecycle?.detach();
    this.connectorSelectionManager?.clearSelection();

    if (selectedIds.size === 0) {
      return;
    }

    const state = this.storeCtx.store.getState();

    // CRITICAL FIX: Categorize selection with enhanced debugging
    const { connectorIds, mindmapEdgeIds, nonConnectorIds } =
      categorizeSelection({
        selectedIds,
        elements:
          (state.elements as Map<string, { type?: string }>) ?? new Map(),
        getElementById: state.element?.getById?.bind(state.element),
      });
    this.debugLog("Selection categorized", {
      connectors: connectorIds,
      mindmapEdges: mindmapEdgeIds,
      nonConnectorIds,
    });

    // CRITICAL FIX: Handle connector-only selection via connector manager
    if (
      (connectorIds.length >= 1 || mindmapEdgeIds.length >= 1) &&
      nonConnectorIds.length === 0
    ) {
      if (this.connectorSelectionManager && typeof window !== "undefined") {
        this.connectorSelectionTimer = window.setTimeout(() => {
          const nextState = this.storeCtx?.store.getState();
          const liveSelection = this.toStringSet(nextState?.selectedElementIds);

          const { connectorIds: currentConnectorIds, mindmapEdgeIds: currentEdgeIds, nonConnectorIds: currentNonConnectorIds } =
            categorizeSelection({
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
              this.connectorSelectionManager?.showSelection(id);
            }
          }

          this.connectorSelectionTimer = null;
        }, 100);
      }
      return;
    }

    this.connectorSelectionManager?.clearSelection();

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
        layers: this.getRelevantLayers(),
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
        const lockAspect = this.shouldLockAspectRatio(selectionSnapshot);
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
    if (typeof window === "undefined") return;
    const flag = (window as Window & { __selectionDebug?: boolean }).__selectionDebug;
    if (!flag) return;
    // eslint-disable-next-line no-console
    console.log("[SelectionModule]", message, data ?? "");
  }

  private clearConnectorSelectionTimer() {
    if (this.connectorSelectionTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.connectorSelectionTimer);
      this.connectorSelectionTimer = null;
    }
  }

  private toStringSet(value: unknown): Set<string> {
    if (value instanceof Set) {
      return new Set(
        Array.from(value).filter((id): id is string => typeof id === "string"),
      );
    }
    if (Array.isArray(value)) {
      return new Set(
        value.filter((id): id is string => typeof id === "string"),
      );
    }
    return new Set<string>();
  }

  private getStage(): Konva.Stage | null {
    if (this.storeCtx?.stage) {
      return this.storeCtx.stage;
    }

    if (typeof window === "undefined") {
      return null;
    }

    return (
      (window as Window & { konvaStage?: Konva.Stage }).konvaStage ?? null
    );
  }

  private getRelevantLayers(): Array<Konva.Container | null | undefined> {
    if (!this.storeCtx) {
      return [];
    }

    return [
      this.storeCtx.layers.main,
      this.storeCtx.layers.highlighter,
      this.storeCtx.layers.overlay,
      this.storeCtx.layers.preview,
    ];
  }

  private beginSelectionTransform(nodes: Konva.Node[], source: "drag" | "transform") {
    // Delegate to TransformStateManager
    transformStateManager.beginTransform(nodes, source);

    // Minimal orchestration to keep snapshot for visual updates
    const snapshot = this.captureTransformSnapshot(nodes);
    if (snapshot) {
      this.transformController?.start(snapshot);
    } else {
      this.transformController?.clearSnapshot();
    }
  }

  private progressSelectionTransform(
    nodes: Konva.Node[],
    source: "drag" | "transform",
  ) {
    // Delegate to TransformStateManager
    transformStateManager.progressTransform(nodes, source);

    // Live visual updates for connectors and mindmap edges using existing controller
    const delta = this.transformController?.computeDelta(nodes);
    if (!delta) return;

    this.updateConnectorVisuals(delta);
    this.updateMindmapEdgeVisuals(delta);
  }

  private endSelectionTransform(nodes: Konva.Node[], source: "drag" | "transform") {
    // Delegate to TransformStateManager
    transformStateManager.endTransform(nodes, source);

    // Commit final positions and clean up visuals
    if (nodes.length > 0) {
      this.updateElementsFromNodes(nodes, true);
      const delta = this.transformController?.computeDelta(nodes);
      if (delta) {
        connectorSelectionManager.commitTranslation(delta);
      }
    }

    this.finalizeTransform();
  }

  // Deprecated in favor of ElementSynchronizer
  // Kept as a shim for compatibility; will be removed in Phase 3 cleanup
  private updateElementsFromNodes(
    nodes: Konva.Node[],
    commitWithHistory: boolean,
  ) {
    // Delegate to ElementSynchronizer for store updates
    elementSynchronizer.updateElementsFromNodes(nodes, "transform", { pushHistory: commitWithHistory, batchUpdates: true });
    return;

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

  // FIXED: Public API for marquee selection to integrate with modular architecture
  selectElementsInBounds(
    stage: Konva.Stage,
    bounds: { x: number; y: number; width: number; height: number },
    options: { additive?: boolean } = {}
  ): string[] {
    if (!this.marqueeSelectionController) return [];
    return this.marqueeSelectionController.selectElementsInBounds(stage, bounds, options);
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
      const rawNodes = resolveElementsToNodes({
        stage: this.getStage(),
        layers: this.getRelevantLayers(),
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

  // Private method to refresh transformer for current selection (used when selection version changes)
  private refreshTransformerForSelection(selectedIds: Set<string>) {
    if (!this.transformLifecycle || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformLifecycle?.setKeepRatio(false);
      this.transformLifecycle?.detach();
      return;
    }

    const selectionSnapshot = new Set(selectedIds);

    // NEW: Respect connector selection here too – never attach transformer
    const state = this.storeCtx.store.getState();

    const { connectorIds, mindmapEdgeIds, nonConnectorIds } = categorizeSelection({
      selectedIds: selectionSnapshot,
      elements:
        (state.elements as Map<string, { type?: string }>) ?? new Map(),
      getElementById: state.element?.getById?.bind(state.element),
    });
    if (
      (connectorIds.length >= 1 || mindmapEdgeIds.length >= 1) &&
      nonConnectorIds.length === 0
    ) {
      // Ensure transformer is detached and show connector endpoint UI
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
      this.connectorSelectionManager?.clearSelection();
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          const nextState = this.storeCtx?.store.getState();
          const liveSelection = this.toStringSet(nextState?.selectedElementIds);
          const { connectorIds: liveConnectorIds, mindmapEdgeIds: liveEdgeIds, nonConnectorIds: liveNonConnectorIds } =
            categorizeSelection({
              selectedIds: liveSelection,
              elements:
                (nextState?.elements as Map<string, { type?: string }>) ??
                new Map(),
              getElementById: nextState?.element?.getById?.bind(
                nextState?.element,
              ),
            });
          if (
            liveNonConnectorIds.length === 0 &&
            (liveConnectorIds.length > 0 || liveEdgeIds.length > 0)
          ) {
            const id = liveConnectorIds[0] ?? liveEdgeIds[0];
            if (id) {
              this.connectorSelectionManager?.showSelection(id);
            }
          }
        }, 50);
      }
      return;
    }

    // Small delay to ensure elements are fully re-rendered after dimension changes
    setTimeout(() => {
      // Find Konva nodes for selected elements across all layers
      const rawNodes = resolveElementsToNodes({
        stage: this.getStage(),
        layers: this.getRelevantLayers(),
        elementIds: selectionSnapshot,
      });
      const nodes = filterTransformableNodes(rawNodes, (message, data) =>
        this.debugLog(message, data),
      );

      if (nodes.length > 0) {
        this.transformLifecycle?.detach();
        setTimeout(() => {
          this.transformLifecycle?.attach(nodes);
          const lockAspect = this.shouldLockAspectRatio(selectionSnapshot);
          this.transformLifecycle?.setKeepRatio(lockAspect);
          this.transformLifecycle?.show();
        }, 10);
      } else {
        this.transformLifecycle?.detach();
        this.transformLifecycle?.setKeepRatio(false);
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
    if (!this.transformLifecycle || !this.storeCtx) return;

    // Get current selection
    const currentState = this.storeCtx.store.getState();
    const selectedIds = this.toStringSet(currentState.selectedElementIds);

    if (selectedIds.size === 0) {
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
      this.connectorSelectionManager?.clearSelection();
      return;
    }

    // Check if selection contains connectors
    const { connectorIds, mindmapEdgeIds, nonConnectorIds } =
      categorizeSelection({
        selectedIds,
        elements:
          (currentState.elements as Map<string, { type?: string }>) ??
          new Map(),
        getElementById: currentState.element?.getById?.bind(
          currentState.element,
        ),
      });

    // Handle connector selection refresh
    if (
      connectorIds.length === 1 &&
      nonConnectorIds.length === 0 &&
      mindmapEdgeIds.length === 0
    ) {
      this.transformLifecycle?.detach();
      this.transformLifecycle?.setKeepRatio(false);
      this.connectorSelectionManager?.refreshSelection();
      return;
    }

    // Handle non-connector selection refresh
    if (nonConnectorIds.length > 0) {
      this.connectorSelectionManager?.clearSelection();

      // Find Konva nodes for selected elements
      const rawNodes = resolveElementsToNodes({
        stage: this.getStage(),
        layers: this.getRelevantLayers(),
        elementIds: new Set(nonConnectorIds),
      });
      const nodes = filterTransformableNodes(rawNodes, (message, data) =>
        this.debugLog(message, data),
      );
      this.debugLog("Refresh transformer nodes", {
        selection: Array.from(nonConnectorIds),
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
        this.transformLifecycle?.detach();
        this.transformLifecycle?.attach(nodes);
        const lockAspect = this.shouldLockAspectRatio(new Set(nonConnectorIds));
        this.transformLifecycle?.setKeepRatio(lockAspect);
        this.transformLifecycle?.show();
        // Force immediate update
        this.transformLifecycle?.refresh();
      } else {
        this.transformLifecycle?.detach();
        this.transformLifecycle?.setKeepRatio(false);
      }
    }
  }

  private scheduleConnectorRefresh(elementIds: Set<string>) {
    // Delegate to ConnectorSelectionManager
    connectorSelectionManager.scheduleRefresh(elementIds);
    return;
    if (elementIds.size === 0) return;

    if (this.transformController?.isActive()) {
      return;
    }

    if (typeof window === "undefined") {
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
    // Delegate to MindmapSelectionManager
    mindmapSelectionManager.scheduleReroute(nodeIds);
    return;
    if (nodeIds.size === 0) return;

    if (this.transformController?.isActive()) {
      return;
    }

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
    // Delegate to MindmapSelectionManager
    mindmapSelectionManager.performReroute(nodeIds);
    return;
    const renderer = this.getMindmapRenderer();
    if (!renderer || nodeIds.size === 0) return;
    try {
      batchMindmapReroute(renderer, Array.from(nodeIds));
    } catch {
      // Ignore reroute errors during live drag
    }
  }

  private refreshConnectedConnectors(elementIds: Set<string>) {
    // Delegate to ConnectorSelectionManager
    connectorSelectionManager.refreshConnectedConnectors(elementIds);
    return;
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

  private captureTransformSnapshot(initialNodes?: Konva.Node[]): TransformSnapshot | null {
    // Use module-local snapshot structure expected by TransformController
    if (!this.storeCtx) return null;

    const state = this.storeCtx.store.getState();
    const selectedIds = this.toStringSet(state.selectedElementIds);

    const snapshotNodes =
      initialNodes && initialNodes.length > 0
        ? initialNodes
        : filterTransformableNodes(
            resolveElementsToNodes({
              stage: this.getStage(),
              layers: this.getRelevantLayers(),
              elementIds: selectedIds,
            }),
            (message, data) => this.debugLog(message, data),
          );

    const basePositions = new Map<string, { x: number; y: number }>();
    const connectors = new Map<string, ConnectorSnapshot>();
    const mindmapEdges = new Map<string, MindmapEdgeElement>();
    const movedMindmapNodes = new Set<string>();

    const stage = this.getStage();
    const movingElementIds = new Set<string>();

    snapshotNodes.forEach((node) => {
      const elementId = node.getAttr("elementId") || node.id();
      if (!elementId) {
        return;
      }

      movingElementIds.add(elementId);

      const element = state.elements.get(elementId) || state.element?.getById?.(elementId);
      if (element && typeof element.x === "number" && typeof element.y === "number") {
        basePositions.set(elementId, {
          x: element.x,
          y: element.y,
        });
      } else {
        const pos = node.position();
        basePositions.set(elementId, { x: pos.x, y: pos.y });
      }

      if (element?.type === "mindmap-node") {
        movedMindmapNodes.add(elementId);
      }
    });

    const includeConnector = (connector: ConnectorElement, id: string) => {
      const shouldInclude =
        selectedIds.has(id) ||
        (connector.from.kind === "element" && movingElementIds.has(connector.from.elementId)) ||
        (connector.to.kind === "element" && movingElementIds.has(connector.to.elementId));

      if (!shouldInclude) {
        return;
      }

      let points = this.getConnectorAbsolutePoints(stage, id);
      let computedFromStore = false;
      if (!points) {
        const fallback = this.computeConnectorPointsFromStore(
          connector,
          basePositions,
        );
        if (!fallback) {
          this.debugLog("Snapshot connector missing points", { id });
          return;
        }
        points = fallback;
        computedFromStore = true;
      }

      const [fromPoint, toPoint] = points;

      const group = computedFromStore ? null : this.findConnectorGroup(stage, id);
      const shape = group?.findOne<Konva.Line | Konva.Arrow>(
        ".connector-shape",
      ) ?? null;
      const groupPosition = group
        ? (() => {
            try {
              const abs = group.getAbsolutePosition();
              return { x: abs.x, y: abs.y };
            } catch (error) {
              this.debugLog("Snapshot connector position error", { id, error });
              return undefined;
            }
          })()
        : undefined;

      connectors.set(id, {
        originalFrom: connector.from,
        originalTo: connector.to,
        startFrom: fromPoint,
        startTo: toPoint,
        wasAnchored:
          connector.from.kind !== "point" || connector.to.kind !== "point",
        shape,
        group,
        groupPosition,
      });

      this.debugLog("Snapshot connector", {
        id,
        wasAnchored:
          connector.from.kind !== "point" || connector.to.kind !== "point",
      });
    };

    const enumerateElements = (): Array<[string, unknown]> => {
      const result: Array<[string, unknown]> = [];
      const elements = state.elements;
      if (elements instanceof Map) {
        elements.forEach((value, key) => {
          result.push([key, value]);
        });
      } else if (elements && typeof elements === "object") {
        Object.entries(elements).forEach(([key, value]) => {
          result.push([key, value]);
        });
      }

      const allFromApi = state.element?.getAll?.();
      if (Array.isArray(allFromApi)) {
        for (const el of allFromApi) {
          if (el && typeof el === "object" && "id" in el) {
            const eid = (el as { id: string }).id;
            if (!result.some(([existingId]) => existingId === eid)) {
              result.push([eid, el]);
            }
          }
        }
      }

      return result;
    };

    const getElementById = (id: string): unknown => {
      return (
        state.elements.get?.(id) ??
        (state.elements instanceof Map ? undefined : (state.elements as Record<string, unknown> | undefined)?.[id]) ??
        state.element?.getById?.(id)
      );
    };

    for (const [id, element] of enumerateElements()) {
      if (typeof element !== "object" || !element) continue;
      const typed = element as { type?: string };
      if (typed.type === "connector") {
        includeConnector(element as ConnectorElement, id);
      } else if (typed.type === "mindmap-edge") {
        const edge = element as MindmapEdgeElement;
        if (
          selectedIds.has(id) ||
          movingElementIds.has(edge.fromId) ||
          movingElementIds.has(edge.toId)
        ) {
          mindmapEdges.set(id, edge);
        }
      }
    }

    // Ensure connectors explicitly selected are captured even if enumerateElements missed them
    selectedIds.forEach((id) => {
      if (connectors.has(id)) return;
      const element = getElementById(id);
      if (element && typeof element === "object" && (element as { type?: string }).type === "connector") {
        includeConnector(element as ConnectorElement, id);
      }
    });

    if (
      basePositions.size === 0 &&
      connectors.size === 0 &&
      mindmapEdges.size === 0
    ) {
      return null;
    }

    const transformerRect = this.transformLifecycle?.getTransformerRect();

    const snapshot: TransformSnapshot = {
      basePositions,
      connectors,
      mindmapEdges,
      movedMindmapNodes,
      transformerBox: transformerRect
        ? { x: transformerRect.x, y: transformerRect.y }
        : undefined,
    };

    this.debugLog("Transform snapshot initialized", {
      movingElements: basePositions.size,
      connectors: connectors.size,
      mindmapEdges: mindmapEdges.size,
      movedMindmapNodes: movedMindmapNodes.size,
      hasTransformerBox: Boolean(transformerRect),
    });

    return snapshot;
  }

  private finalizeTransform() {
    // Delegate common finalization to TransformStateManager
    transformStateManager.finalizeTransform();
    this.transformController?.release();

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

  private updateConnectorVisuals(delta: { dx: number; dy: number }) {
    const snapshot = this.transformController?.getSnapshot();
    if (!snapshot) return;

    this.transformController?.updateConnectorShapes(
      delta,
      (
        connectorId,
        shape,
        from: ConnectorEndpointPoint,
        to: ConnectorEndpointPoint,
      ) => this.updateConnectorShapeGeometry(connectorId, shape, from, to),
    );
  }

  private applyConnectorEndpointOverride(
    id: string,
    fromPoint: ConnectorEndpointPoint,
    toPoint: ConnectorEndpointPoint,
  ) {
    this.updateConnectorElement(id, {
      from: fromPoint,
      to: toPoint,
    });
  }

  private updateConnectorShapeGeometry(
    id: string,
    cachedShape: Konva.Line | Konva.Arrow | null | undefined,
    fromPoint: ConnectorEndpointPoint,
    toPoint: ConnectorEndpointPoint,
  ) {
    const stage =
      this.storeCtx?.stage ||
      (typeof window !== "undefined"
        ? ((window as Window & { konvaStage?: Konva.Stage }).konvaStage ?? null)
        : null);

    const shape = cachedShape
      ? cachedShape
      : stage
          ?.findOne<Konva.Group>(`#${id}`)
          ?.findOne<Konva.Line | Konva.Arrow>(".connector-shape") ?? null;

    if (!shape) {
      return;
    }

    const parent = shape.getParent();
    const inverse = parent
      ?.getAbsoluteTransform()
      .copy()
      .invert();

    const toLocal = (point: ConnectorEndpointPoint) => {
      if (inverse) {
        return inverse.point({ x: point.x, y: point.y });
      }
      return { x: point.x, y: point.y };
    };

    const localFrom = toLocal(fromPoint);
    const localTo = toLocal(toPoint);

    const line = shape as Konva.Line;
    if (typeof line.points === "function") {
      line.points([localFrom.x, localFrom.y, localTo.x, localTo.y]);
    }
    line.getLayer()?.batchDraw();
  }

  private updateMindmapEdgeVisuals(delta: { dx: number; dy: number }) {
    // Delegate to MindmapSelectionManager
    mindmapSelectionManager.updateEdgeVisuals(delta);
    return;
    const snapshot = this.transformController?.getSnapshot();
    if (!snapshot) return;

    this.mindmapController?.update(snapshot, delta);
  }

  private commitConnectorTranslation(delta: { dx: number; dy: number }) {
    // Delegate to ConnectorSelectionManager
    connectorSelectionManager.commitTranslation(delta);
    return;
    this.transformController?.commitConnectorTranslation(delta);
  }

  private getConnectorAbsolutePoints(
    stage: Konva.Stage | null | undefined,
    connectorId: string,
  ): [ConnectorEndpointPoint, ConnectorEndpointPoint] | null {
    if (!stage) return null;

    const group = this.findConnectorGroup(stage, connectorId);
    if (!group) return null;

    const shape = group.findOne<Konva.Line | Konva.Arrow>(".connector-shape");
    if (!shape || typeof (shape as Konva.Line).points !== "function") {
      this.debugLog("Connector shape missing", { connectorId });
      return null;
    }

    const points = (shape as Konva.Line).points();
    if (!points || points.length < 4) return null;

    const transform = shape.getAbsoluteTransform().copy();
    const from = transform.point({ x: points[0], y: points[1] });
    const to = transform.point({ x: points[2], y: points[3] });

    return [
      { kind: "point", x: from.x, y: from.y },
      { kind: "point", x: to.x, y: to.y },
    ];
  }

  private findConnectorGroup(
    stage: Konva.Stage | null | undefined,
    connectorId: string,
  ): Konva.Group | null {
    if (!stage) return null;

    const direct = stage.findOne(`#${connectorId}`) as Konva.Group | null;
    if (direct && direct.getClassName?.() === "Group") {
      return direct;
    }

    const attrSelector = `[elementId="${connectorId}"]`;
    const attrMatch = stage.findOne(attrSelector);
    if (attrMatch) {
      const group = attrMatch.findAncestor("Group") as Konva.Group | null;
      if (group) {
        return group;
      }
    }

    this.debugLog("Connector group not found", { connectorId });
    return null;
  }

  private computeConnectorPointsFromStore(
    connector: ConnectorElement,
    basePositions: Map<string, { x: number; y: number }>,
  ): [ConnectorEndpointPoint, ConnectorEndpointPoint] | null {
    const state = this.storeCtx?.store.getState();
    if (!state) return null;

    const resolve = (
      endpoint: ConnectorEndpoint,
    ): ConnectorEndpointPoint | null => {
      if (endpoint.kind === "point") {
        return {
          kind: "point",
          x: endpoint.x,
          y: endpoint.y,
        };
      }

      const elementId = endpoint.elementId;
      const element =
        state.elements.get(elementId) || state.element?.getById?.(elementId);
      if (!element) {
        return null;
      }

      const baseline = basePositions.get(elementId);
      const ex = baseline?.x ?? element.x ?? 0;
      const ey = baseline?.y ?? element.y ?? 0;
      const width = element.width ?? 0;
      const height = element.height ?? 0;
      const cx = ex + width / 2;
      const cy = ey + height / 2;

      let px = cx;
      let py = cy;

      switch (endpoint.anchor) {
        case "left":
          px = ex;
          py = cy;
          break;
        case "right":
          px = ex + width;
          py = cy;
          break;
        case "top":
          px = cx;
          py = ey;
          break;
        case "bottom":
          px = cx;
          py = ey + height;
          break;
        default:
          break;
      }

      if (endpoint.offset) {
        px += endpoint.offset.dx;
        py += endpoint.offset.dy;
      }

      return { kind: "point", x: px, y: py };
    };

    const fromPoint = resolve(connector.from);
    const toPoint = resolve(connector.to);

    if (!fromPoint || !toPoint) {
      return null;
    }

    return [fromPoint, toPoint];
  }

  private setLiveRoutingEnabled(enabled: boolean) {
    // Delegate to ConnectorSelectionManager
    connectorSelectionManager.setLiveRoutingEnabled(enabled);
    return;
    const service = this.getConnectorService();
    if (!service) return;

    try {
      if (enabled) {
        service.enableLiveRouting();
      } else {
        service.disableLiveRouting();
      }
    } catch {
      // Ignore enable/disable errors
    }
  }

  private setMindmapLiveRoutingEnabled(enabled: boolean) {
    // Delegate to MindmapSelectionManager
    mindmapSelectionManager.setLiveRoutingEnabled(enabled);
    return;
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
    // Delegate to ConnectorSelectionManager
    connectorSelectionManager.updateElement(id, changes);
    return;
    this.debugLog("updateConnectorElement", { id, changes });
    const state = this.storeCtx?.store.getState();
    if (!state) return;

    let performedUpdate = false;

    if (state.element?.update) {
      try {
        state.element.update(id, changes);
        performedUpdate = true;
      } catch {
        // ignore update errors
      }
    } else if (state.updateElement) {
      try {
        state.updateElement(id, changes, { pushHistory: false });
        performedUpdate = true;
      } catch {
        // ignore update errors
      }
    }

    if (!performedUpdate) {
      return;
    }

    const connectorService = this.getConnectorService();
    if (connectorService) {
      const nextState = this.storeCtx?.store.getState();
      const connector =
        nextState?.elements.get(id) ?? nextState?.element?.getById?.(id);
      if (connector && connector.type === "connector") {
        try {
          void connectorService.updateConnector(connector as ConnectorElement);
        } catch {
          // Ignore renderer sync errors during drag
        }
      }
    }
  }

  private getMindmapRenderer(): MindmapRenderer | null {
    // Delegate to MindmapSelectionManager
    return mindmapSelectionManager.getRenderer();
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
    // Delegate to ShapeTextSynchronizer
    shapeTextSynchronizer.syncTextDuringTransform(nodes);
    return;
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
