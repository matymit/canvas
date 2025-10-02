// ElementSynchronizer.ts
// Extracted from SelectionModule.ts lines 575-909
// Handles synchronization between Konva nodes and store elements

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import { debug, error, warn } from "../../../../../../utils/debug";
import type { CanvasElement } from "../../../../../../../types/index";
import type {
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorEndpointPoint,
} from "../../../../types/connector";
import type { ImageElement } from "../../../../types/image";
import type {
  ConnectorSelectionManager,
} from "./ConnectorSelectionManager";
import type {
  MindmapSelectionManager,
} from "./MindmapSelectionManager";

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

type ElementPatchExtras = {
  skew?: { x: number; y: number };
  radius?: number;
  fontSize?: number;
  fontFamily?: string;
  stroke?: string;
  strokeWidth?: number;
  from?: ConnectorEndpoint;
  to?: ConnectorEndpoint;
};

type ElementPatch = Partial<CanvasElement> & ElementPatchExtras;

interface ElementUpdate {
  id: string;
  patch: ElementPatch;
}

type KonvaNodeWithSize = Konva.Node & {
  size?: () => { width: number; height: number };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getNodeSize = (
  node: Konva.Node,
  element: CanvasElement
): { width: number; height: number } => {
  const sizedNode = node as KonvaNodeWithSize;
  if (typeof sizedNode.size === "function") {
    const size = sizedNode.size();
    if (size && isFiniteNumber(size.width) && isFiniteNumber(size.height)) {
      return size;
    }
  }

  const rawWidth = node.getAttr("width");
  const rawHeight = node.getAttr("height");
  const fallbackWidth = isFiniteNumber(element.width) ? element.width : 0;
  const fallbackHeight = isFiniteNumber(element.height) ? element.height : 0;

  return {
    width: isFiniteNumber(rawWidth) ? rawWidth : fallbackWidth,
    height: isFiniteNumber(rawHeight) ? rawHeight : fallbackHeight,
  };
};

const getNodeNumberAttr = (node: Konva.Node, key: string): number | undefined => {
  const value = node.getAttr(key);
  return isFiniteNumber(value) ? value : undefined;
};

const getNodeStringAttr = (node: Konva.Node, key: string): string | undefined => {
  const value = node.getAttr(key);
  return typeof value === "string" ? value : undefined;
};

const isImageElement = (element: CanvasElement): element is ImageElement =>
  element.type === "image";

const isConnectorElementType = (
  element: CanvasElement
): element is ConnectorElement => element.type === "connector";

const hasCoordinates = (
  endpoint: ConnectorEndpoint | undefined
): endpoint is ConnectorEndpointPoint => endpoint?.kind === "point";

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
    const category = "selection/element-sync";
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements || nodes.length === 0) {
      warn("ElementSynchronizer: cannot sync - missing elements or nodes", {
        category,
        data: {
          hasElements: Boolean(elements),
          nodeCount: nodes.length,
          source,
        },
      });
      return;
    }

    debug("ElementSynchronizer: syncing elements from nodes", {
      category,
      data: {
        nodeCount: nodes.length,
        source,
        options,
      },
    });

    const elementUpdates: ElementUpdate[] = [];
    const connectorIds = new Set<string>();
    const mindmapNodeIds = new Set<string>();

    // Process each node and prepare updates
    nodes.forEach((node, index) => {
      try {
        const elementId = node.getAttr("elementId") || node.id();
        const element = elements.get(elementId);
        
        if (!element) {
          warn("ElementSynchronizer: element not found in store", {
            category,
            data: { elementId },
          });
          return;
        }

        const nodeType = (node.getAttr("nodeType") as string | undefined) || element.type;
        debug("ElementSynchronizer: processing node", {
          category,
          data: { index, elementId, nodeType },
        });

        // Get current node properties
        const position = node.position();
        let size = getNodeSize(node, element);
        const scale = node.scale();
        const rotation = node.rotation();
        const skew = node.skew();
        const scaleX = isFiniteNumber(scale.x) ? scale.x : 1;
        const scaleY = isFiniteNumber(scale.y) ? scale.y : 1;
        const skewX = isFiniteNumber(skew.x) ? skew.x : 0;
        const skewY = isFiniteNumber(skew.y) ? skew.y : 0;

        // Special handling for image groups - use Group size if set, fallback to element dimensions
        if (isImageElement(element)) {
          // If Group size is zero (shouldn't happen after our fix, but safety check)
          if (size.width === 0 || size.height === 0) {
            debug("ElementSynchronizer: image node zero size fallback", {
              category,
              data: {
                nodeSize: size,
                elementWidth: element.width,
                elementHeight: element.height,
              },
            });
            size = {
              width: isFiniteNumber(element.width) ? element.width : 0,
              height: isFiniteNumber(element.height) ? element.height : 0,
            };
          } else {
            debug("ElementSynchronizer: image node using group size", {
              category,
              data: { nodeSize: size, scale },
            });
          }
        }

        // Calculate effective dimensions
        const effectiveWidth = size.width * Math.abs(scaleX);
        const effectiveHeight = size.height * Math.abs(scaleY);

        // Base element patch
        const patch: ElementPatch = {
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
        if (Math.abs(skewX) > 0.001 || Math.abs(skewY) > 0.001) {
          patch.skew = { x: skewX, y: skewY };
        }

        // Handle type-specific properties
        switch (element.type) {
          case "circle": {
            // For circles, maintain radius consistency
            const radius = Math.min(effectiveWidth, effectiveHeight) / 2;
            patch.width = radius * 2;
            patch.height = radius * 2;
            patch.radius = radius;
            break;
          }

          case "image": {
            // Preserve aspect ratio for images if needed
            if (isImageElement(element) && element.keepAspectRatio) {
              const naturalWidth = element.naturalWidth;
              const naturalHeight = element.naturalHeight;
              const aspectRatio = naturalHeight !== 0 ? naturalWidth / naturalHeight : NaN;
              if (isFiniteNumber(aspectRatio) && aspectRatio > 0) {
                if (aspectRatio > 1) {
                  // Wide image
                  patch.height = effectiveWidth / aspectRatio;
                } else {
                  // Tall image
                  patch.width = effectiveHeight * aspectRatio;
                }
              }
            }
            break;
          }

          case "connector": {
            // Special handling for connectors
            connectorIds.add(elementId);
            if (isConnectorElementType(element)) {
              this.syncConnectorFromNode(node, element, patch);
            }
            break;
          }

          case "mindmap-node": {
            // Track mindmap nodes for rerouting
            mindmapNodeIds.add(elementId);
            break;
          }

          case "text": {
            // Handle text-specific properties
            const fontSize = getNodeNumberAttr(node, "fontSize");
            if (fontSize !== undefined) {
              patch.fontSize = fontSize;
            }
            const fontFamily = getNodeStringAttr(node, "fontFamily");
            if (fontFamily) {
              patch.fontFamily = fontFamily;
            }
            const fill = getNodeStringAttr(node, "fill");
            if (fill) {
              patch.fill = fill;
            }
            break;
          }

          case "rectangle":
          case "ellipse": {
            // Handle shape-specific properties for basic shapes
            const fill = getNodeStringAttr(node, "fill");
            if (fill) {
              patch.fill = fill;
            }
            const stroke = getNodeStringAttr(node, "stroke");
            if (stroke) {
              patch.stroke = stroke;
            }
            const strokeWidth = getNodeNumberAttr(node, "strokeWidth");
            if (strokeWidth !== undefined) {
              patch.strokeWidth = strokeWidth;
            }
            break;
          }

          default:
            // Generic element handling
            break;
        }

        elementUpdates.push({ id: elementId, patch });

      } catch (caughtError) {
        error("ElementSynchronizer: error processing node", {
          category,
          data: { nodeIndex: index, error: caughtError },
        });
      }
    });

    // Apply updates to store
    if (elementUpdates.length > 0) {
      debug("ElementSynchronizer: applying element updates", {
        category,
        data: { updateCount: elementUpdates.length, batch: options.batchUpdates },
      });
      
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
      debug("ElementSynchronizer: scheduling connector refresh", {
        category,
        data: { connectorCount: connectorIds.size },
      });
      this.scheduleConnectorRefresh(connectorIds);
    }

    // Schedule mindmap rerouting if needed
    if (mindmapNodeIds.size > 0) {
      debug("ElementSynchronizer: scheduling mindmap reroute", {
        category,
        data: { nodeCount: mindmapNodeIds.size },
      });
      this.scheduleMindmapReroute(mindmapNodeIds);
    }

    debug("ElementSynchronizer: synchronization completed", {
      category,
      data: {
        updatedElements: elementUpdates.length,
        connectorRefreshes: connectorIds.size,
        mindmapReroutes: mindmapNodeIds.size,
      },
    });
  }

  private syncConnectorFromNode(
    _node: Konva.Node,
    element: ConnectorElement,
    patch: ElementPatch
  ): void {
    const centerX = patch.x ?? element.x;
    const centerY = patch.y ?? element.y;

    const { from, to } = element;

    if (hasCoordinates(from)) {
      const fromDx = from.x - element.x;
      const fromDy = from.y - element.y;
      patch.from = {
        ...from,
        x: centerX + fromDx,
        y: centerY + fromDy,
      };
    }

    if (hasCoordinates(to)) {
      const toDx = to.x - element.x;
      const toDy = to.y - element.y;
      patch.to = {
        ...to,
        x: centerX + toDx,
        y: centerY + toDy,
      };
    }
  }

  private scheduleConnectorRefresh(connectorIds: Set<string>): void {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.connectorSelectionManager?.scheduleRefresh(connectorIds);
    });
  }

  private scheduleMindmapReroute(nodeIds: Set<string>): void {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.mindmapSelectionManager?.scheduleReroute(nodeIds);
    });
  }
}

// Export singleton instance
export const elementSynchronizer = new ElementSynchronizerImpl();

declare global {
  interface Window {
    elementSynchronizer?: ElementSynchronizer;
    connectorSelectionManager?: ConnectorSelectionManager;
    mindmapSelectionManager?: MindmapSelectionManager;
  }
}

// Register globally for cross-module access
if (typeof window !== "undefined") {
  window.elementSynchronizer = elementSynchronizer;
}