// features/canvas/renderer/modules/SelectionModule.ts
import type { ModuleRendererCtx, RendererModule } from "../index";
import { TransformerManager } from "../../managers/TransformerManager";

export class SelectionModule implements RendererModule {
  private transformerManager?: TransformerManager;
  private storeCtx?: ModuleRendererCtx;
  private unsubscribe?: () => void;
  private unsubscribeVersion?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log("[SelectionModule] Mounting...");
    this.storeCtx = ctx;

    // FIXED: Make module globally accessible for tool integration
    (window as any).selectionModule = this;
    console.log("[SelectionModule] Module registered globally");

    // Create transformer manager on overlay layer with aspect ratio locking
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
      keepRatioKey: "Shift", // FIXED: Enable aspect ratio locking with Shift key
      rotationSnapDeg: 15,
      onTransformStart: (nodes) => {
        console.log(
          "[SelectionModule] Transform start:",
          nodes.length,
          "nodes",
        );
        // Begin transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.beginTransform) {
          store.beginTransform();
        }
      },
      onTransform: (nodes) => {
        // Real-time updates during transform for smoother UX (all elements including tables)
        this.updateElementsFromNodes(nodes, false);
      },
      onTransformEnd: (nodes) => {
        console.log("[SelectionModule] Transform end, committing changes for", nodes.length, "nodes");

        // DEBUG: Log node positions before update
        nodes.forEach((node, i) => {
          const pos = node.position();
          const elementId = node.getAttr("elementId") || node.id();
          console.log(`[SelectionModule] Node ${i} (${elementId}) final position: (${pos.x}, ${pos.y})`);
        });

        this.updateElementsFromNodes(nodes, true); // Commit with history

        // End transform in store if available
        const store = this.storeCtx?.store.getState();
        if (store?.endTransform) {
          store.endTransform();
        }

        // FIXED: Force a clean refresh after transform to prevent duplicate frames
        setTimeout(() => {
          if (this.transformerManager) {
            this.transformerManager.refresh();
            console.log(
              "[SelectionModule] Transformer refreshed after transform end",
            );
          }
        }, 10);
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
      (version) => {
        console.log("[SelectionModule] Selection version changed to:", version, "- refreshing transformer");
        if (this.transformerManager && this.storeCtx) {
          // Get current selection and refresh transformer
          const currentState = this.storeCtx.store.getState();
          const selectedIds = currentState.selectedElementIds || new Set<string>();
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
    console.log("[SelectionModule] Unmounting...");
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

    // Clean up global reference
    if ((window as any).selectionModule === this) {
      (window as any).selectionModule = null;
    }
  }

  private updateSelection(selectedIds: Set<string>) {
    console.log(
      "[SelectionModule] Selection updated:",
      selectedIds.size,
      "elements",
      Array.from(selectedIds),
    );

    if (!this.transformerManager || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformerManager.detach();
      return;
    }

    // FIXED: Slightly longer delay to ensure elements are fully rendered and avoid double frames
    setTimeout(() => {
      // Find Konva nodes for selected elements across all layers
      const nodes = this.resolveElementsToNodes(selectedIds);

      if (nodes.length > 0) {
        console.log(
          "[SelectionModule] Attaching transformer to",
          nodes.length,
          "nodes",
        );

        // Debug: Log node properties to ensure they're transformable
        nodes.forEach((node, index) => {
          const size = node.size();
          const pos = node.position();
          console.log(`[SelectionModule] Node ${index}:`, {
            id: node.id() || node.getAttr("elementId"),
            className: node.className,
            size: size,
            position: pos,
            visible: node.visible(),
            listening: node.listening(),
            draggable: node.draggable(),
          });
        });

        // FIXED: Detach first to prevent any lingering transformers, then attach
        this.transformerManager?.detach();
        this.transformerManager?.attachToNodes(nodes);
        this.transformerManager?.show();
      } else {
        console.warn(
          "[SelectionModule] Could not find nodes for selected elements:",
          Array.from(selectedIds),
        );
        this.transformerManager?.detach();
      }
    }, 75); // Slightly longer delay
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
    ];

    const validLayers = allLayers
      .filter(({ name, layer }) => {
        if (!layer) {
          console.warn(
            `[SelectionModule] Layer '${name}' is undefined, skipping search`,
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
          const group = candidates.find((n) =>
            n.className === "Group" ||
            n.className === "table-group" ||
            n.className === "image-group" ||
            n.name() === "table-group" ||
            n.name() === "image"
          );
          const selectedNode = group || candidates[0];

          // FIXED: Ensure only one node per element ID to prevent duplicate frames
          if (selectedNode) {
            nodes.push(selectedNode);
            found = true;
            console.log(
              "[SelectionModule] Found node for element",
              elementId,
              ":",
              group ? "Group" : selectedNode.className || "Unknown",
            );
          } else {
            console.warn(
              "[SelectionModule] Found candidates but selectedNode is null for element:",
              elementId,
              "candidates:",
              candidates.length,
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

    const updates: Array<{ id: string; changes: any }> = [];

    for (const node of nodes) {
      const elementId = node.getAttr("elementId") || node.id();
      if (!elementId) continue;

      const pos = node.position();
      const size = node.size();
      const rotation = node.rotation();
      const scale = node.scale();

      // Check if this is a table element for special cell dimension scaling
      const isTable = node.className === 'table-group';

      // CRITICAL FIX: Ensure dimensions never become 0 or negative
      // Use absolute values of scale to handle negative scaling (flipping)
      // and enforce minimum dimensions to prevent disappearing elements
      const MIN_WIDTH = 10;  // Minimum width in pixels
      const MIN_HEIGHT = 10; // Minimum height in pixels

      const scaledWidth = size.width * Math.abs(scale?.x || 1);
      const scaledHeight = size.height * Math.abs(scale?.y || 1);

      let changes: any = {
        x: Math.round(pos.x * 100) / 100, // Round to avoid precision issues
        y: Math.round(pos.y * 100) / 100,
        // Apply scale to width/height with minimum bounds
        width: Math.max(MIN_WIDTH, Math.round(scaledWidth * 100) / 100),
        height: Math.max(MIN_HEIGHT, Math.round(scaledHeight * 100) / 100),
        rotation: Math.round(rotation * 100) / 100,
      };

      // Special handling for table elements - scale cell dimensions proportionally
      if (isTable && scale && (scale.x !== 1 || scale.y !== 1)) {
        const element = store?.elements?.get?.(elementId);
        if (element && element.colWidths && element.rowHeights) {
          // Use absolute values of scale to handle negative scaling properly
          changes.colWidths = element.colWidths.map((w: number) =>
            Math.max(20, Math.round(w * Math.abs(scale.x) * 100) / 100)
          );
          changes.rowHeights = element.rowHeights.map((h: number) =>
            Math.max(16, Math.round(h * Math.abs(scale.y) * 100) / 100)
          );
        }
      }

      updates.push({
        id: elementId,
        changes,
      });

      // Reset scale after applying to dimensions
      if (scale && (scale.x !== 1 || scale.y !== 1)) {
        node.scale({ x: 1, y: 1 });
        node.size({
          width: size.width * scale.x,
          height: size.height * scale.y,
        });
      }
    }

    // CRITICAL FIX: Apply updates correctly for history tracking
    if (commitWithHistory && withUndo && updates.length > 0) {
      const actionName =
        updates.length === 1
          ? "Transform element"
          : `Transform ${updates.length} elements`;

      console.log(`[SelectionModule] Committing ${updates.length} updates with history:`, updates.map(u => ({ id: u.id, x: u.changes.x, y: u.changes.y })));

      // Use withUndo to wrap all updates in a single history entry
      withUndo(actionName, () => {
        for (const { id, changes } of updates) {
          try {
            // DEBUG: Log store state before update
            const storeState = this.storeCtx!.store.getState();
            const elementBefore = storeState.elements?.get?.(id) || storeState.element?.getById?.(id);
            console.log(`[SelectionModule] BEFORE UPDATE - Element ${id}:`, {
              current: elementBefore ? { x: elementBefore.x, y: elementBefore.y } : 'not found',
              newChanges: { x: changes.x, y: changes.y }
            });

            // Use the store's updateElement directly without pushHistory since we're already in withUndo
            storeState.updateElement(id, changes, { pushHistory: false });

            // DEBUG: Verify store state after update
            const elementAfter = storeState.elements?.get?.(id) || storeState.element?.getById?.(id);
            console.log(`[SelectionModule] AFTER UPDATE - Element ${id}:`, {
              stored: elementAfter ? { x: elementAfter.x, y: elementAfter.y } : 'not found',
              expected: { x: changes.x, y: changes.y },
              match: elementAfter && Math.abs(elementAfter.x - changes.x) < 0.01 && Math.abs(elementAfter.y - changes.y) < 0.01
            });

          } catch (error) {
            console.error(
              "[SelectionModule] Failed to update element",
              id,
              ":",
              error,
            );
          }
        }
      });
    } else {
      // For non-history updates (during transform), use updateElement directly
      console.log(`[SelectionModule] Real-time updates (no history) for ${updates.length} elements`);
      for (const { id, changes } of updates) {
        try {
          const storeState = this.storeCtx!.store.getState();
          storeState.updateElement(id, changes, { pushHistory: false });
          if (commitWithHistory === false) {
            console.log(`[SelectionModule] Real-time update for element ${id} to position (${changes.x}, ${changes.y})`);
          }
        } catch (error) {
          console.error(
            "[SelectionModule] Failed to update element",
            id,
            ":",
            error,
          );
        }
      }
    }
  }

  // FIXED: Public API for other modules to trigger selection with proper store integration
  selectElement(elementId: string) {
    if (!this.storeCtx) {
      console.error(
        "[SelectionModule] No store context available for selection",
      );
      return;
    }

    const store = this.storeCtx.store.getState();
    console.log("[SelectionModule] Selecting element via store:", elementId);

    // Try different store selection methods with proper error handling
    try {
      if (store.setSelection) {
        store.setSelection([elementId]);
        console.log("[SelectionModule] Selection set via setSelection method");
      } else if (store.selection?.set) {
        store.selection.set([elementId]);
        console.log("[SelectionModule] Selection set via selection.set method");
      } else if (store.selectedElementIds) {
        // Handle Set-based selection
        if (store.selectedElementIds instanceof Set) {
          store.selectedElementIds.clear();
          store.selectedElementIds.add(elementId);
          console.log("[SelectionModule] Selection set via Set manipulation");
        } else if (Array.isArray(store.selectedElementIds)) {
          (store.selectedElementIds as string[]).length = 0;
          (store.selectedElementIds as string[]).push(elementId);
          console.log("[SelectionModule] Selection set via Array manipulation");
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
    console.log("[SelectionModule] Auto-selecting element:", elementId);

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
          console.log(
            `[SelectionModule] Element found on attempt ${attempts}, selection successful`,
          );
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
          console.log(
            `[SelectionModule] Attempt ${attempts} failed, retrying in ${delay}ms...`,
          );
          // Retry selection in store as element might not be rendered yet
          this.selectElement(elementId);
          attemptSelection(); // Recursive retry
        } else {
          console.warn(
            `[SelectionModule] Auto-selection failed after ${maxAttempts} attempts for element:`,
            elementId,
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
    console.log(
      "[SelectionModule] Refreshing transformer for selection:",
      selectedIds.size,
      "elements",
      Array.from(selectedIds),
    );

    if (!this.transformerManager || !this.storeCtx) return;

    if (selectedIds.size === 0) {
      this.transformerManager.detach();
      return;
    }

    // Small delay to ensure elements are fully re-rendered after dimension changes
    setTimeout(() => {
      // Find Konva nodes for selected elements across all layers
      const nodes = this.resolveElementsToNodes(selectedIds);

      if (nodes.length > 0) {
        console.log(
          "[SelectionModule] Refreshing transformer with",
          nodes.length,
          "nodes after version bump",
        );

        // Force detach and reattach to recalculate bounds
        this.transformerManager?.detach();
        setTimeout(() => {
          this.transformerManager?.attachToNodes(nodes);
          this.transformerManager?.show();
          console.log("[SelectionModule] Transformer refreshed and bounds recalculated");
        }, 10);
      } else {
        console.warn(
          "[SelectionModule] Could not find nodes for refresh:",
          Array.from(selectedIds),
        );
        this.transformerManager?.detach();
      }
    }, 50); // Slightly longer delay to ensure table rendering is complete
  }
}
