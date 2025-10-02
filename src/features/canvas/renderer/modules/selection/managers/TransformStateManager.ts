// TransformStateManager.ts
// Extracted from SelectionModule.ts lines 485-574, 993-1046, 1262-1483
// Handles transform lifecycle and state management

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import { debug, error, warn } from "../../../../../../utils/debug";
import type { CanvasElement } from "../../../../../../../types/index";
import type { ConnectorElement, ConnectorEndpoint } from "../../../../types/connector";

const LOG_CATEGORY = "selection/transform";

type ConnectorLike = CanvasElement &
  Pick<ConnectorElement, "from" | "to">;

interface MindmapNodeLike extends CanvasElement {
  children?: string[];
}

const isConnectorLike = (element: CanvasElement): element is ConnectorLike =>
  element.type === "connector" && "from" in element && "to" in element;

const isMindmapNodeLike = (
  element: CanvasElement,
): element is MindmapNodeLike => element.type === "mindmap-node";

const cloneConnectorEndpoint = (
  endpoint: ConnectorEndpoint,
): ConnectorEndpoint => {
  if (endpoint.kind === "point") {
    return { ...endpoint };
  }

  return {
    ...endpoint,
    offset: endpoint.offset ? { ...endpoint.offset } : undefined,
  };
};

export interface TransformSnapshot {
  initialNodes: Konva.Node[];
  initialStoreState: Map<string, CanvasElement>;
  transformStartTime: number;
  source: "drag" | "transform";
}

export interface TransformStateManager {
  beginTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
  progressTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
  endTransform(nodes: Konva.Node[], source: "drag" | "transform"): void;
  shouldLockAspectRatio(selectedIds: Set<string>): boolean;
  captureSnapshot(initialNodes?: Konva.Node[]): TransformSnapshot | null;
  finalizeTransform(): void;
}

export class TransformStateManagerImpl implements TransformStateManager {
  private currentSnapshot: TransformSnapshot | null = null;
  private transformInProgress = false;

  constructor() {
    // Bind methods to preserve context
    this.beginTransform = this.beginTransform.bind(this);
    this.progressTransform = this.progressTransform.bind(this);
    this.endTransform = this.endTransform.bind(this);
    this.shouldLockAspectRatio = this.shouldLockAspectRatio.bind(this);
    this.captureSnapshot = this.captureSnapshot.bind(this);
    this.finalizeTransform = this.finalizeTransform.bind(this);
  }

  // Extracted from SelectionModule.ts lines 485-508
  beginTransform(nodes: Konva.Node[], _source: "drag" | "transform"): void {
    if (this.transformInProgress) {
      warn("TransformStateManager: transform already in progress", {
        category: LOG_CATEGORY,
      });
      return;
    }

    /* console.debug("[TransformStateManager] Beginning transform", {
      nodeCount: nodes.length,
      source,
      nodeTypes: nodes.map(n => n.getAttr("nodeType") || n.constructor.name)
    }); */

    // Capture initial state
    this.currentSnapshot = this.captureSnapshot(nodes);
    if (!this.currentSnapshot) {
      error("TransformStateManager: failed to capture snapshot", {
        category: LOG_CATEGORY,
      });
      return;
    }

    this.transformInProgress = true;

    // Transform state is managed locally
    // Store doesn't have setTransformInProgress method
  }

  // Extracted from SelectionModule.ts lines 509-529
  progressTransform(_nodes: Konva.Node[], _source: "drag" | "transform"): void {
    if (!this.transformInProgress || !this.currentSnapshot) {
      return;
    }

    // console.debug can be re-enabled when needed
    /* console.debug("[TransformStateManager] Progress transform", {
      nodeCount: nodes.length,
      source,
      elapsed: Date.now() - this.currentSnapshot.transformStartTime
    }); */

    // Transform progress is tracked locally
    // Store doesn't have updateTransformProgress method
  }

  // Extracted from SelectionModule.ts lines 530-574
  endTransform(_nodes: Konva.Node[], _source: "drag" | "transform"): void {
    if (!this.transformInProgress) {
      warn("TransformStateManager: no transform in progress", {
        category: LOG_CATEGORY,
      });
      return;
    }

    /* console.debug("[TransformStateManager] Ending transform", {
      nodeCount: nodes.length,
      source,
      duration: this.currentSnapshot ? Date.now() - this.currentSnapshot.transformStartTime : 0
    }); */

    try {
      // Finalize the transform
      this.finalizeTransform();

      // Clear transform state
      this.transformInProgress = false;
      this.currentSnapshot = null;

      // Transform completed - state managed locally

      debug("TransformStateManager: transform completed successfully", {
        category: LOG_CATEGORY,
      });
    } catch (caughtError) {
      error("TransformStateManager: error ending transform", {
        category: LOG_CATEGORY,
        data: { error: caughtError },
      });
      // Reset state on error
      this.transformInProgress = false;
      this.currentSnapshot = null;
    }
  }

  // Extracted from SelectionModule.ts lines 993-1046
  shouldLockAspectRatio(selectedIds: Set<string>): boolean {
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements || selectedIds.size === 0) {
      return false;
    }

    // Check if all selected elements support aspect ratio locking
    let hasAspectRatioElements = false;
    
    for (const elementId of selectedIds) {
      const element = elements.get(elementId);
      if (!element) continue;

      // Circle elements should lock aspect ratio
      if (element.type === "circle") {
        hasAspectRatioElements = true;
        continue;
      }

      // Image elements should lock aspect ratio by default
      if (element.type === "image") {
        hasAspectRatioElements = true;
        continue;
      }

      // Rectangle/ellipse elements with explicit aspect ratio lock
      if (
        (element.type === "rectangle" || element.type === "ellipse") &&
        Boolean(element.lockAspectRatio)
      ) {
        hasAspectRatioElements = true;
        continue;
      }

      // For mixed selections, only lock if ALL elements support it
      if (element.type === "rectangle" || element.type === "text" || element.type === "connector") {
        // These don't require aspect ratio locking
        continue;
      }
    }

    // Lock aspect ratio if we have elements that require it
    // and no conflicting elements
    return hasAspectRatioElements;
  }

  // Extracted from SelectionModule.ts lines 1262-1466
  captureSnapshot(initialNodes?: Konva.Node[]): TransformSnapshot | null {
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements || !initialNodes || initialNodes.length === 0) {
      warn("TransformStateManager: cannot capture snapshot - missing data", {
        category: LOG_CATEGORY,
      });
      return null;
    }

    /* console.debug("[TransformStateManager] Capturing transform snapshot", {
      nodeCount: initialNodes.length,
      timestamp: Date.now()
    }); */

    // Create deep copy of initial store state for affected elements
    const initialStoreState = new Map<string, CanvasElement>();
    
    initialNodes.forEach(node => {
      const elementId = node.getAttr("elementId") || node.id();
      const element = elements.get(elementId);
      
      if (element) {
        const clonedElement: CanvasElement = { ...element };

        if (isConnectorLike(element)) {
          const connectorClone = clonedElement as ConnectorLike;
          connectorClone.from = cloneConnectorEndpoint(element.from);
          connectorClone.to = cloneConnectorEndpoint(element.to);
        }

        if (isMindmapNodeLike(element) && element.children) {
          const mindmapClone = clonedElement as MindmapNodeLike;
          mindmapClone.children = [...element.children];
        }

        initialStoreState.set(elementId, clonedElement);
      }
    });

    return {
      initialNodes: [...initialNodes], // Shallow copy is sufficient for node references
      initialStoreState,
      transformStartTime: Date.now(),
      source: "transform" // Default source, will be updated by caller
    };
  }

  // Extracted from SelectionModule.ts lines 1467-1483
  finalizeTransform(): void {
    if (!this.currentSnapshot) {
      warn("TransformStateManager: no snapshot to finalize", {
        category: LOG_CATEGORY,
      });
      return;
    }

    debug("TransformStateManager: finalizing transform", {
      category: LOG_CATEGORY,
      data: {
        duration: Date.now() - this.currentSnapshot.transformStartTime,
        nodeCount: this.currentSnapshot.initialNodes.length,
      },
    });

    // The actual finalization logic would be handled by the calling SelectionModule
    // This is just the state management portion
    
    // Clear the snapshot
    this.currentSnapshot = null;
  }

  // Public getter for current transform state
  public get isTransformInProgress(): boolean {
    return this.transformInProgress;
  }

  // Public getter for current snapshot
  public get currentTransformSnapshot(): TransformSnapshot | null {
    return this.currentSnapshot;
  }
}

// Export singleton instance
export const transformStateManager = new TransformStateManagerImpl();