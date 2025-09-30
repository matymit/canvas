// ElementSynchronizer.ts
// Extracted from SelectionModule.ts lines 575-909
// Handles synchronization between Konva nodes and store elements

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import type { CanvasElement } from "../../../../../../../types/index";

export interface ElementSynchronizationOptions {
  skipConnectorScheduling?: boolean;
  pushHistory?: boolean;
  batchUpdates?: boolean;
}

export interface ElementSynchronizer {
  updateElementsFromNodes(
    nodes: Konva.Node[],
    source: "drag" | "transform",
    options?: ElementSynchronizationOptions
  ): void;
}

export class ElementSynchronizerImpl implements ElementSynchronizer {
  constructor() {
    this.updateElementsFromNodes = this.updateElementsFromNodes.bind(this);
  }

  // Extracted from SelectionModule.ts lines 575-909
  updateElementsFromNodes(
    nodes: Konva.Node[],
    source: "drag" | "transform",
    options: ElementSynchronizationOptions = {}
  ): void {
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements || nodes.length === 0) {
      console.warn("[ElementSynchronizer] Cannot sync - missing elements or nodes");
      return;
    }

    console.log("[ElementSynchronizer] Syncing elements from nodes", {
      nodeCount: nodes.length,
      source,
      options
    });

    const elementUpdates: Array<{ id: string; patch: Partial<CanvasElement> }> = [];
    const connectorIds = new Set<string>();
    const mindmapNodeIds = new Set<string>();

    // Process each node and prepare updates
    nodes.forEach((node, index) => {
      try {
        const elementId = node.getAttr("elementId") || node.id();
        const element = elements.get(elementId);
        
        if (!element) {
          console.warn(`[ElementSynchronizer] Element ${elementId} not found in store`);
          return;
        }

        const nodeType = node.getAttr("nodeType") || element.type;
        console.log(`[ElementSynchronizer] Processing node ${index}: ${elementId} (${nodeType})`);

        // Get current node properties
        const position = node.position();
        let size = node.size();
        const scale = node.scale();
        const rotation = node.rotation();
        const skew = node.skew();

        // Special handling for image groups - use Group size if set, fallback to element dimensions
        if (element.type === 'image') {
          // If Group size is zero (shouldn't happen after our fix, but safety check)
          if (size.width === 0 || size.height === 0) {
            console.log(`[ElementSynchronizer] Image node has zero size, using element dimensions as fallback`, {
              nodeSize: size,
              elementWidth: element.width,
              elementHeight: element.height
            });
            size = { width: element.width || 0, height: element.height || 0 };
          } else {
            console.log(`[ElementSynchronizer] Image node using Group size`, {
              nodeSize: size,
              scale
            });
          }
        }

        // Calculate effective dimensions
        const effectiveWidth = size.width * Math.abs(scale.x);
        const effectiveHeight = size.height * Math.abs(scale.y);

        // Base element patch
        const patch: Partial<CanvasElement> = {
          x: position.x,
          y: position.y,
          width: effectiveWidth,
          height: effectiveHeight,
        };

        // Add rotation if non-zero
        if (Math.abs(rotation) > 0.001) {
          patch.rotation = rotation;
        }

        // Add skew if non-zero
        if (Math.abs(skew.x) > 0.001 || Math.abs(skew.y) > 0.001) {
          (patch as any).skew = { x: skew.x, y: skew.y };
        }

        // Handle type-specific properties
        switch (element.type) {
          case "circle": {
            // For circles, maintain radius consistency
            const radius = Math.min(effectiveWidth, effectiveHeight) / 2;
            patch.width = radius * 2;
            patch.height = radius * 2;
            (patch as any).radius = radius;
            break;
          }

          case "image": {
            // Preserve aspect ratio for images if needed
            const imageElement = element as any;
            if (imageElement.preserveAspectRatio) {
              const aspectRatio = imageElement.naturalWidth / imageElement.naturalHeight;
              if (aspectRatio > 1) {
                // Wide image
                patch.height = effectiveWidth / aspectRatio;
              } else {
                // Tall image
                patch.width = effectiveHeight * aspectRatio;
              }
            }
            break;
          }

          case "connector": {
            // Special handling for connectors
            connectorIds.add(elementId);
            this.syncConnectorFromNode(node, element, patch);
            break;
          }

          case "mindmap-node": {
            // Track mindmap nodes for rerouting
            mindmapNodeIds.add(elementId);
            break;
          }

          case "text": {
            // Handle text-specific properties
            const textNode = node as any;
            if (textNode.fontSize) {
              (patch as any).fontSize = textNode.fontSize();
            }
            if (textNode.fontFamily) {
              (patch as any).fontFamily = textNode.fontFamily();
            }
            if (textNode.fill) {
              (patch as any).fill = textNode.fill();
            }
            break;
          }

          case "rectangle":
          case "ellipse": {
            // Handle shape-specific properties for basic shapes
            const shapeNode = node as any;
            if (shapeNode.fill) {
              (patch as any).fill = shapeNode.fill();
            }
            if (shapeNode.stroke) {
              (patch as any).stroke = shapeNode.stroke();
            }
            if (shapeNode.strokeWidth) {
              (patch as any).strokeWidth = shapeNode.strokeWidth();
            }
            break;
          }

          default:
            // Generic element handling
            break;
        }

        elementUpdates.push({ id: elementId, patch });

      } catch (error) {
        console.error(`[ElementSynchronizer] Error processing node ${index}:`, error);
      }
    });

    // Apply updates to store
    if (elementUpdates.length > 0) {
      console.log(`[ElementSynchronizer] Applying ${elementUpdates.length} element updates`);
      
      if (options.batchUpdates && store.updateElements) {
        // Batch update for better performance
        store.updateElements(elementUpdates, { 
          pushHistory: options.pushHistory ?? false 
        });
      } else if (store.updateElement) {
        // Individual updates
        elementUpdates.forEach(({ id, patch }) => {
          store.updateElement(id, patch, { 
            pushHistory: options.pushHistory ?? false 
          });
        });
      }
    }

    // Schedule connector refreshes if needed
    if (!options.skipConnectorScheduling && connectorIds.size > 0) {
      console.log(`[ElementSynchronizer] Scheduling connector refresh for ${connectorIds.size} connectors`);
      this.scheduleConnectorRefresh(connectorIds);
    }

    // Schedule mindmap rerouting if needed
    if (mindmapNodeIds.size > 0) {
      console.log(`[ElementSynchronizer] Scheduling mindmap reroute for ${mindmapNodeIds.size} nodes`);
      this.scheduleMindmapReroute(mindmapNodeIds);
    }

    console.log("[ElementSynchronizer] Element synchronization completed", {
      updatedElements: elementUpdates.length,
      connectorRefreshes: connectorIds.size,
      mindmapReroutes: mindmapNodeIds.size
    });
  }

  private syncConnectorFromNode(
    _node: Konva.Node,
    element: CanvasElement,
    patch: Partial<CanvasElement>
  ): void {
    // Special connector synchronization logic
    const connectorElement = element as any;
    
    if (connectorElement.from && connectorElement.to) {
      // Calculate center point from node position
      const centerX = patch.x || element.x;
      const centerY = patch.y || element.y;
      
      // Update connector endpoints relative to new center
      const fromDx = connectorElement.from.x - element.x;
      const fromDy = connectorElement.from.y - element.y;
      const toDx = connectorElement.to.x - element.x;
      const toDy = connectorElement.to.y - element.y;
      
      (patch as any).from = {
        ...connectorElement.from,
        x: centerX + fromDx,
        y: centerY + fromDy
      };
      
      (patch as any).to = {
        ...connectorElement.to,
        x: centerX + toDx,
        y: centerY + toDy
      };
    }
  }

  private scheduleConnectorRefresh(connectorIds: Set<string>): void {
    // Use RAF to batch connector refreshes
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const connectorSelectionManager = (window as any).connectorSelectionManager;
        if (connectorSelectionManager?.scheduleRefresh) {
          connectorSelectionManager.scheduleRefresh(connectorIds);
        }
      });
    }
  }

  private scheduleMindmapReroute(nodeIds: Set<string>): void {
    // Use RAF to batch mindmap rerouting
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const mindmapSelectionManager = (window as any).mindmapSelectionManager;
        if (mindmapSelectionManager?.scheduleReroute) {
          mindmapSelectionManager.scheduleReroute(nodeIds);
        }
      });
    }
  }
}

// Export singleton instance
export const elementSynchronizer = new ElementSynchronizerImpl();

// Register globally for cross-module access
if (typeof window !== "undefined") {
  (window as any).elementSynchronizer = elementSynchronizer;
}