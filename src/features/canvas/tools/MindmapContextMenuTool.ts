// Mindmap context menu tool for handling right-click operations
// Integrates with canvas event manager following established patterns

import Konva from "konva";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import { useMindmapOperations } from "../utils/mindmap/mindmapOperations";

export interface MindmapContextMenuHandler {
  onShowContextMenu?: (nodeId: string, x: number, y: number) => void;
}

export class MindmapContextMenuTool {
  private readonly stage: Konva.Stage;
  private readonly handler: MindmapContextMenuHandler;
  private readonly mindmapOps = useMindmapOperations();

  constructor(stage: Konva.Stage, handler: MindmapContextMenuHandler) {
    this.stage = stage;
    this.handler = handler;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Handle context menu on mindmap nodes
    this.stage.on("contextmenu", (evt: Konva.KonvaEventObject<MouseEvent>) => {
      evt.evt.preventDefault();

      const target = evt.target;
      if (!target) return;

      // Find the mindmap node group
      let nodeGroup: Konva.Group | null = null;
      let current: Konva.Node | null = target;

      while (current && !nodeGroup) {
        if (current instanceof Konva.Group && current.name() === "mindmap-node") {
          nodeGroup = current;
        }
        current = current.getParent();
      }

      if (!nodeGroup) return;

      const nodeId = nodeGroup.id();
      if (!nodeId) return;

      // Verify it's a mindmap node in the store
      const store = useUnifiedCanvasStore.getState();
      const getElement = store.getElement || store.element?.getById;
      const element = getElement?.(nodeId);

      if (!element || element.type !== "mindmap-node") return;

      // Get screen coordinates for context menu
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      // Convert stage coordinates to screen coordinates
      const stageContainer = this.stage.container();
      const rect = stageContainer.getBoundingClientRect();
      const screenX = rect.left + pointer.x;
      const screenY = rect.top + pointer.y;

      this.handler.onShowContextMenu?.(nodeId, screenX, screenY);
    });
  }

  /**
   * Handle keyboard shortcuts for mindmap operations
   */
  public handleKeyboardShortcut(event: KeyboardEvent, selectedNodeIds: string[]): boolean {
    if (selectedNodeIds.length !== 1) return false;

    const nodeId = selectedNodeIds[0];
    const store = useUnifiedCanvasStore.getState();
    const getElement = store.getElement || store.element?.getById;
    const element = getElement?.(nodeId);

    if (!element || element.type !== "mindmap-node") return false;

    const key = event.key.toLowerCase();
    const meta = event.metaKey || event.ctrlKey;
    const shift = event.shiftKey;

    // Enter: Create child node
    if (key === "enter" && !meta && !shift) {
      event.preventDefault();
      this.mindmapOps.createChildNode(nodeId);
      return true;
    }

    // Cmd/Ctrl + D: Duplicate node
    if (key === "d" && meta && !shift) {
      event.preventDefault();
      this.mindmapOps.duplicateNode(nodeId, { includeDescendants: false });
      return true;
    }

    // Cmd/Ctrl + Shift + D: Duplicate subtree
    if (key === "d" && meta && shift) {
      event.preventDefault();
      this.mindmapOps.duplicateNode(nodeId, { includeDescendants: true });
      return true;
    }

    // Delete/Backspace: Delete node and descendants
    if ((key === "delete" || key === "backspace") && !meta && !shift) {
      event.preventDefault();
      this.deleteNodeWithDescendants(nodeId);
      return true;
    }

    return false;
  }

  private deleteNodeWithDescendants(nodeId: string) {
    const store = useUnifiedCanvasStore.getState();
    const withUndo = store.history?.withUndo;
    const removeElementWithOptions = (
      id: string,
      options: { pushHistory: boolean; deselect: boolean },
    ) => {
      if (typeof store.removeElement === 'function') {
        store.removeElement(id, options);
        return;
      }
      store.element?.delete?.(id);
    };

    if (withUndo) {
      withUndo("Delete mindmap node", () => {
        // Get all descendants
        const descendants = this.mindmapOps.getNodeDescendants(nodeId);
        const allToDelete = [nodeId, ...descendants];

        // Remove all nodes and their edges
        allToDelete.forEach((id) => {
          removeElementWithOptions(id, { pushHistory: false, deselect: true });
        });
      });
    } else {
      // Fallback without undo
      const descendants = this.mindmapOps.getNodeDescendants(nodeId);
      [nodeId, ...descendants].forEach((id) => {
        removeElementWithOptions(id, { pushHistory: true, deselect: true });
      });
    }
  }

  public destroy() {
    this.stage.off("contextmenu");
  }
}
