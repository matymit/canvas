// Mindmap-specific context menu with duplication and child creation options
// Follows existing canvas menu patterns

import React, { useCallback, useEffect, useMemo } from "react";
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

  const closeOnEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeOnEscape, visible]);

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

  const element = getElement?.(nodeId);

  const hasChildren = useMemo(() => {
    if (!visible) {
      return false;
    }
    if (!element || element.type !== "mindmap-node") {
      return false;
    }
    return mindmapOps.getNodeChildren(nodeId).length > 0;
  }, [element, mindmapOps, nodeId, visible]);

  const menuItems = useMemo(() => {
    if (!visible || !element || element.type !== "mindmap-node") {
      return [] as Array<
        | {
            type: "action";
            id: string;
            label: string;
            icon: string;
            destructive?: boolean;
            onSelect: () => void;
          }
        | { type: "separator"; id: string }
      >;
    }

    const items: Array<
      | {
          type: "action";
          id: string;
          label: string;
          icon: string;
          destructive?: boolean;
          onSelect: () => void;
        }
      | { type: "separator"; id: string }
    > = [
      {
        type: "action",
        id: "add-child",
        label: "Add child node",
        icon: "＋",
        onSelect: handleCreateChild,
      },
      { type: "separator", id: "divider-1" },
      {
        type: "action",
        id: "duplicate-node",
        label: "Duplicate node",
        icon: "⧉",
        onSelect: handleDuplicateNode,
      },
    ];

    if (hasChildren) {
      items.push({
        type: "action",
        id: "duplicate-subtree",
        label: "Duplicate subtree",
        icon: "⤴",
        onSelect: handleDuplicateSubtree,
      });
    }

    items.push({ type: "separator", id: "divider-2" });
    items.push({
      type: "action",
      id: "delete-node",
      label: `Delete node${hasChildren ? " & children" : ""}`,
      icon: "⌫",
      destructive: true,
      onSelect: handleDeleteNode,
    });

    return items;
  }, [element, handleCreateChild, handleDeleteNode, handleDuplicateNode, handleDuplicateSubtree, hasChildren, visible]);

  const estimatedHeight = useMemo(() => {
    if (!menuItems.length) {
      return 0;
    }
    const base = 4; // top & bottom padding
    return menuItems.reduce((height, item) => {
      if (item.type === "separator") {
        return height + 8;
      }
      return height + 40;
    }, base);
  }, [menuItems]);

  const menuPosition = useMemo(() => {
    if (!visible) {
      return { left: x, top: y };
    }
    if (typeof window === "undefined") {
      return { left: x, top: y };
    }

    const viewportPadding = 12;
    const menuWidth = 208;
    const clampedLeft = Math.min(
      Math.max(x, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const clampedTop = Math.min(
      Math.max(y, viewportPadding),
      window.innerHeight - estimatedHeight - viewportPadding,
    );

    return { left: clampedLeft, top: clampedTop };
  }, [estimatedHeight, visible, x, y]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLButtonElement>, destructive?: boolean) => {
    event.currentTarget.style.backgroundColor = destructive ? "#FFEAEA" : "#F1F5F9";
  }, []);

  const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.backgroundColor = "transparent";
  }, []);

  if (!visible) return null;

  if (!element || element.type !== "mindmap-node") return null;

  if (!menuItems.length) {
    return null;
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "transparent",
        }}
        onMouseDown={handleBackdropClick}
      />

      <div
        role="menu"
        aria-hidden={!visible}
        style={{
          position: "fixed",
          left: menuPosition.left,
          top: menuPosition.top,
          zIndex: 9999,
          minWidth: 208,
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          boxShadow: "0 16px 32px rgba(15, 23, 42, 0.15)",
          padding: "6px 0",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
        }}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {menuItems.map((item) => {
          if (item.type === "separator") {
            return (
              <div
                key={item.id}
                style={{
                  height: 1,
                  backgroundColor: "#e2e8f0",
                  margin: "6px 0",
                }}
              />
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={item.onSelect}
              onMouseEnter={(event) => handleMouseEnter(event, item.destructive)}
              onMouseLeave={handleMouseLeave}
              style={{
                width: "100%",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                color: item.destructive ? "#dc2626" : "#0f172a",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                borderRadius: 6,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default MindmapContextMenu;
