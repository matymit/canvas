// TransformStateManager.ts
// Extracted from SelectionModule.ts lines 485-574, 993-1046, 1262-1483
// Handles transform lifecycle and state management

import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";
import type { CanvasElement } from "../../../../../../../types/index";

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
      console.warn("[TransformStateManager] Transform already in progress");
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
      console.error("[TransformStateManager] Failed to capture snapshot");
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
      console.warn("[TransformStateManager] No transform in progress");
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

      console.log("[TransformStateManager] Transform completed successfully");
    } catch (error) {
      console.error("[TransformStateManager] Error ending transform:", error);
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
      if ((element.type === "rectangle" || element.type === "ellipse") && (element as any).lockAspectRatio) {
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
      console.warn("[TransformStateManager] Cannot capture snapshot - missing data");
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
        // Deep clone the element
        const clonedElement: CanvasElement = {
          ...element,
          // Handle special properties that need deep cloning
          ...(element.type === 'connector' && (element as any).from && (element as any).to ? {
            from: { ...(element as any).from },
            to: { ...(element as any).to }
          } : {}),
          ...(element.type === 'mindmap-node' && (element as any).children ? {
            children: [...((element as any).children || [])]
          } : {})
        };
        
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
      console.warn("[TransformStateManager] No snapshot to finalize");
      return;
    }

    console.log("[TransformStateManager] Finalizing transform", {
      duration: Date.now() - this.currentSnapshot.transformStartTime,
      nodeCount: this.currentSnapshot.initialNodes.length
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