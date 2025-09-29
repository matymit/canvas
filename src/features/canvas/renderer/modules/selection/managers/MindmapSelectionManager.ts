// MindmapSelectionManager.ts
// Extracted from SelectionModule.ts lines 1163-1195, 1196-1205, 1555-1561, 1708-1722, 1776-1786
// Handles mindmap-specific selection operations

import { useUnifiedCanvasStore } from "../../../../stores/unifiedCanvasStore";

export interface MindmapSelectionManager {
  scheduleReroute(nodeIds: Set<string>): void;
  performReroute(nodeIds: Set<string>): void;
  updateEdgeVisuals(delta: { dx: number; dy: number }): void;
  setLiveRoutingEnabled(enabled: boolean): void;
  getRenderer(): any | null;
}

export class MindmapSelectionManagerImpl implements MindmapSelectionManager {
  private rerouteScheduled = false;
  private liveRoutingEnabled = true;
  private mindmapRenderer: any = null;

  constructor() {
    // Bind methods to preserve context
    this.scheduleReroute = this.scheduleReroute.bind(this);
    this.performReroute = this.performReroute.bind(this);
    this.updateEdgeVisuals = this.updateEdgeVisuals.bind(this);
    this.setLiveRoutingEnabled = this.setLiveRoutingEnabled.bind(this);
    this.getRenderer = this.getRenderer.bind(this);
  }

  // Extracted from SelectionModule.ts lines 1163-1195
  scheduleReroute(nodeIds: Set<string>): void {
    if (this.rerouteScheduled || nodeIds.size === 0) {
      return;
    }

    console.log("[MindmapSelectionManager] Scheduling mindmap reroute", {
      nodeCount: nodeIds.size,
      nodeIds: Array.from(nodeIds).slice(0, 5) // Show first 5 to avoid spam
    });

    this.rerouteScheduled = true;

    // Use RAF to batch mindmap rerouting for performance
    window.requestAnimationFrame(() => {
      try {
        this.performReroute(nodeIds);
      } finally {
        this.rerouteScheduled = false;
      }
    });
  }

  // Extracted from SelectionModule.ts lines 1196-1205
  performReroute(nodeIds: Set<string>): void {
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements) {
      console.warn("[MindmapSelectionManager] No elements available for mindmap reroute");
      return;
    }

    console.log("[MindmapSelectionManager] Performing mindmap reroute", {
      nodeCount: nodeIds.size
    });

    const mindmapNodesToUpdate = new Set<string>();

    // Find all mindmap nodes that need rerouting
    nodeIds.forEach(nodeId => {
      const element = elements.get(nodeId);
      if (element?.type === 'mindmap-node') {
        mindmapNodesToUpdate.add(nodeId);
        
        // Also check for connected mindmap nodes
        this.findConnectedMindmapNodes(nodeId, mindmapNodesToUpdate);
      }
    });

    console.log(`[MindmapSelectionManager] Found ${mindmapNodesToUpdate.size} mindmap nodes to reroute`);

    // Perform rerouting using mindmap renderer
    const renderer = this.getRenderer();
    if (renderer?.rerouteNodes) {
      renderer.rerouteNodes(Array.from(mindmapNodesToUpdate));
    }
  }

  // Extracted from SelectionModule.ts lines 1555-1561
  updateEdgeVisuals(delta: { dx: number; dy: number }): void {
    const store = useUnifiedCanvasStore.getState();
    const selectedElementIds = store.selectedElementIds;
    
    if (!selectedElementIds || (Array.isArray(selectedElementIds) ? selectedElementIds.length === 0 : (selectedElementIds instanceof Set ? selectedElementIds.size === 0 : true))) {
      return;
    }

    const selectedCount = Array.isArray(selectedElementIds)
      ? selectedElementIds.length
      : (selectedElementIds instanceof Set ? selectedElementIds.size : 0);

    // console.debug("[MindmapSelectionManager] Updating mindmap edge visuals", {
    //   delta,
    //   selectedCount
    // });

    // Update visual representation of mindmap edges during live transforms
    selectedElementIds.forEach(elementId => {
      const element = store.elements?.get(elementId);
      if (element?.type === 'mindmap-node') {
        this.updateMindmapEdgePosition(elementId, delta);
      }
    });
  }

  // Extracted from SelectionModule.ts lines 1708-1722
  setLiveRoutingEnabled(enabled: boolean): void {
    console.log("[MindmapSelectionManager] Setting mindmap live routing enabled:", {
      prev: this.liveRoutingEnabled,
      next: enabled
    });
    this.liveRoutingEnabled = enabled;
  }

  // Extracted from SelectionModule.ts lines 1776-1786
  getRenderer(): any | null {
    if (!this.mindmapRenderer) {
      // Get mindmap renderer from global registry
      this.mindmapRenderer = (window as any).mindmapRenderer;
    }
    return this.mindmapRenderer;
  }

  // Helper methods

  private findConnectedMindmapNodes(nodeId: string, resultSet: Set<string>): void {
    const store = useUnifiedCanvasStore.getState();
    const elements = store.elements;
    
    if (!elements) return;

    const element = elements.get(nodeId);
    if (!element || element.type !== 'mindmap-node') return;

    const mindmapElement = element as any;
    
    // Add parent node
    if (mindmapElement.parentId && !resultSet.has(mindmapElement.parentId)) {
      const parentElement = elements.get(mindmapElement.parentId);
      if (parentElement?.type === 'mindmap-node') {
        resultSet.add(mindmapElement.parentId);
      }
    }

    // Add child nodes
    if (mindmapElement.children) {
      mindmapElement.children.forEach((childId: string) => {
        if (!resultSet.has(childId)) {
          const childElement = elements.get(childId);
          if (childElement?.type === 'mindmap-node') {
            resultSet.add(childId);
          }
        }
      });
    }
  }

  private updateMindmapEdgePosition(nodeId: string, delta: { dx: number; dy: number }): void {
    // Update visual position of mindmap edges without committing to store
    const renderer = this.getRenderer();
    if (renderer?.updateEdgeVisuals) {
      renderer.updateEdgeVisuals(nodeId, delta);
    }
  }
}

// Export singleton instance and register globally
export const mindmapSelectionManager = new MindmapSelectionManagerImpl();

// Register globally for cross-module access
if (typeof window !== "undefined") {
  (window as any).mindmapSelectionManager = mindmapSelectionManager;
}