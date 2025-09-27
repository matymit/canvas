// Mindmap-specific context menu with duplication and child creation options
// Follows existing canvas menu patterns

import React, { useCallback } from "react";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";
import { useMindmapOperations } from "../../utils/mindmap/mindmapOperations";

export interface MindmapContextMenuProps {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
  visible: boolean;
}

export const MindmapContextMenu: React.FC<MindmapContextMenuProps> = ({
  nodeId,
  x,
  y,
  onClose,
  visible,
}) => {
  const getElement = useUnifiedCanvasStore((state) => state.getElement || state.element?.getById);
  const mindmapOps = useMindmapOperations();

  const handleCreateChild = useCallback(() => {
    mindmapOps.createChildNode(nodeId);
    onClose();
  }, [nodeId, mindmapOps, onClose]);

  const handleDuplicateNode = useCallback(() => {
    mindmapOps.duplicateNode(nodeId, { includeDescendants: false });
    onClose();
  }, [nodeId, mindmapOps, onClose]);

  const handleDuplicateSubtree = useCallback(() => {
    mindmapOps.duplicateNode(nodeId, { includeDescendants: true });
    onClose();
  }, [nodeId, mindmapOps, onClose]);

  const handleDeleteNode = useCallback(() => {
    const store = useUnifiedCanvasStore.getState();
    const withUndo = store.history?.withUndo;
    const removeElementWithOptions = (
      id: string,
      options: { pushHistory: boolean; deselect: boolean },
    ) => {
      if (typeof store.removeElement === "function") {
        store.removeElement(id, options);
        return;
      }
      store.element?.delete?.(id);
    };

    if (withUndo) {
      withUndo("Delete mindmap node", () => {
        // Get all descendants
        const descendants = mindmapOps.getNodeDescendants(nodeId);
        const allToDelete = [nodeId, ...descendants];

        // Remove all nodes and their edges
        allToDelete.forEach((id) => {
          removeElementWithOptions(id, { pushHistory: false, deselect: true });
        });
      });
    } else {
      // Fallback without undo
      const descendants = mindmapOps.getNodeDescendants(nodeId);
      [nodeId, ...descendants].forEach((id) => {
        removeElementWithOptions(id, { pushHistory: true, deselect: true });
      });
    }
    onClose();
  }, [nodeId, mindmapOps, onClose]);

  if (!visible) return null;

  // Check if node exists and is a mindmap node
  const element = getElement?.(nodeId);
  if (!element || element.type !== "mindmap-node") return null;

  const hasChildren = mindmapOps.getNodeChildren(nodeId).length > 0;

  return (
    <div
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-48"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
      }}
      onMouseLeave={onClose}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
        onClick={handleCreateChild}
      >
        <span className="w-4 h-4 flex items-center justify-center">+</span>
        Add child node
      </button>

      <div className="border-t border-gray-100" />

      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
        onClick={handleDuplicateNode}
      >
        <span className="w-4 h-4 flex items-center justify-center">⧉</span>
        Duplicate node
      </button>

      {hasChildren && (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={handleDuplicateSubtree}
        >
          <span className="w-4 h-4 flex items-center justify-center">⧈</span>
          Duplicate subtree
        </button>
      )}

      <div className="border-t border-gray-100" />

      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
        onClick={handleDeleteNode}
      >
        <span className="w-4 h-4 flex items-center justify-center">×</span>
        Delete node{hasChildren ? " & children" : ""}
      </button>
    </div>
  );
};

export default MindmapContextMenu;
