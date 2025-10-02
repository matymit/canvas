// Mindmap operations for duplication and child creation
// Follows store-driven architecture and withUndo patterns

import { nanoid } from "nanoid";
import type {
  MindmapNodeElement,
  MindmapEdgeElement,
  MindmapNodeOptions,
} from "../../types/mindmap";
import {
  createMindmapNode,
  createMindmapEdge,
  calculateChildPosition,
  measureMindmapLabel,
  DEFAULT_BRANCH_STYLE,
  MINDMAP_CONFIG,
  MINDMAP_THEME,
} from "../../types/mindmap";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";

export interface MindmapOperationsAPI {
  duplicateNode: (
    nodeId: string,
    options?: { includeDescendants?: boolean; offset?: { x: number; y: number } },
  ) => string | null;
  createChildNode: (parentId: string, text?: string) => string | null;
  duplicateSubtree: (rootId: string, offset?: { x: number; y: number }) => string | null;
  getNodeDescendants: (nodeId: string) => string[];
  getNodeChildren: (nodeId: string) => string[];
}

/**
 * Creates mindmap-specific operations that work with the unified canvas store
 */
export function createMindmapOperations(): MindmapOperationsAPI {
  const store = useUnifiedCanvasStore.getState();

  const addElementToStore = (
    element: MindmapNodeElement | MindmapEdgeElement,
    options?: { pushHistory?: boolean; select?: boolean },
  ) => {
    if (store.addElement) {
      store.addElement(element, options);
      return;
    }
    const upsert = store.element?.upsert;
    if (upsert) {
      const resultingId = upsert(element);
      if (options?.select && store.selection?.set) {
        const targetId = typeof resultingId === 'string' ? resultingId : element.id;
        store.selection.set([targetId]);
      }
    }
  };

  /**
   * Get all direct children of a node
   */
  function getNodeChildren(nodeId: string): string[] {
    const children: string[] = [];
    const elements = store.elements;

    if (!elements) return children;

    const elementsMap = elements instanceof Map ? elements : new Map(Object.entries(elements));

    elementsMap.forEach((element, id) => {
      if (element && typeof element === 'object' && 'type' in element && element.type === "mindmap-node") {
        const mindmapElement = element as MindmapNodeElement;
        if (mindmapElement.parentId === nodeId) {
          children.push(id);
        }
      }
    });

    return children;
  }

  /**
   * Get all descendants of a node (recursive)
   */
  function getNodeDescendants(nodeId: string): string[] {
    const descendants: string[] = [];
    const visited = new Set<string>();

    function findDescendants(parentId: string) {
      if (visited.has(parentId)) return; // Prevent infinite loops
      visited.add(parentId);

      const children = getNodeChildren(parentId);
      children.forEach(childId => {
        descendants.push(childId);
        findDescendants(childId);
      });
    }

    findDescendants(nodeId);
    return descendants;
  }

  /**
   * Create a child node for the given parent
   */
  function createChildNode(parentId: string, text?: string): string | null {
    const getElement = store.getElement || store.element?.getById;
    const parent = getElement?.(parentId) as MindmapNodeElement | undefined;

    if (!parent || parent.type !== "mindmap-node") {
      return null;
    }

    // Get existing children to position new child properly
    const existingChildren = getNodeChildren(parentId);
    const position = calculateChildPosition(parent, existingChildren.length);

    const childId = crypto?.randomUUID?.() ?? nanoid();
    const level = (parent.level ?? 0) + 1;

    const paletteIndex = level % MINDMAP_THEME.nodeColors.length;
    const branchPalette = MINDMAP_THEME.branchColors ?? [];

    const baseChild = createMindmapNode(
      position.x,
      position.y,
      text || MINDMAP_CONFIG.childText,
      {
        parentId,
        level,
      } as MindmapNodeOptions,
    );

    const child: MindmapNodeElement = {
      id: childId,
      ...baseChild,
    };

    // Measure text dimensions
    const childMetrics = measureMindmapLabel(child.text, child.style);
    child.textWidth = childMetrics.width;
    child.textHeight = childMetrics.height;
    child.width = Math.max(
      childMetrics.width + child.style.paddingX * 2,
      MINDMAP_CONFIG.minNodeWidth,
    );
    child.height = Math.max(
      childMetrics.height + child.style.paddingY * 2,
      MINDMAP_CONFIG.minNodeHeight,
    );

    // Create edge from parent to child
    const edgeId = crypto?.randomUUID?.() ?? nanoid();
    const defaultBranchColor =
      branchPalette.length > 0
        ? branchPalette[paletteIndex % branchPalette.length]
        : DEFAULT_BRANCH_STYLE.color;
    const edge: MindmapEdgeElement = {
      id: edgeId,
      ...createMindmapEdge(parentId, childId, {
        color: defaultBranchColor,
      }),
    };

    // Use withUndo to make the operation undoable
    const withUndo = store.history?.withUndo;
    if (withUndo) {
      withUndo("Create mindmap child", () => {
        addElementToStore(child, { pushHistory: false, select: true });
        addElementToStore(edge, { pushHistory: false });

        // Update selection to new child
        const setSelection = store.setSelection || store.selection?.set;
        setSelection?.([childId]);
      });
    } else {
      // Fallback without undo
      addElementToStore(child, { pushHistory: true, select: true });
      addElementToStore(edge, { pushHistory: true });
    }

    return childId;
  }

  /**
   * Duplicate a single mindmap node
   */
  function duplicateNode(
    nodeId: string,
    options: { includeDescendants?: boolean; offset?: { x: number; y: number } } = {},
  ): string | null {
    const { includeDescendants = false, offset = { x: 20, y: 20 } } = options;

    if (includeDescendants) {
      return duplicateSubtree(nodeId, offset);
    }

    const getElement = store.getElement || store.element?.getById;
    const original = getElement?.(nodeId) as MindmapNodeElement | undefined;

    if (!original || original.type !== "mindmap-node") {
      return null;
    }

    const newId = crypto?.randomUUID?.() ?? nanoid();
    const duplicate: MindmapNodeElement = {
      ...original,
      id: newId,
      x: original.x + offset.x,
      y: original.y + offset.y,
    };

    // Use withUndo to make the operation undoable
    const withUndo = store.history?.withUndo;
    if (withUndo) {
      withUndo("Duplicate mindmap node", () => {
        addElementToStore(duplicate, { pushHistory: false, select: true });

        // Update selection to new duplicate
        const setSelection = store.setSelection || store.selection?.set;
        setSelection?.([newId]);
      });
    } else {
      // Fallback without undo
      addElementToStore(duplicate, { pushHistory: true, select: true });
    }

    return newId;
  }

  /**
   * Duplicate an entire mindmap subtree (node and all descendants)
   */
  function duplicateSubtree(rootId: string, offset: { x: number; y: number } = { x: 20, y: 20 }): string | null {
    const getElement = store.getElement || store.element?.getById;
    const rootNode = getElement?.(rootId) as MindmapNodeElement | undefined;

    if (!rootNode || rootNode.type !== "mindmap-node") {
      return null;
    }

    // Get all descendants
    const descendants = getNodeDescendants(rootId);
    const allNodeIds = [rootId, ...descendants];

    // Collect all nodes and edges to duplicate
    const nodesToDuplicate: MindmapNodeElement[] = [];
    const edgesToDuplicate: MindmapEdgeElement[] = [];

    // Collect all elements
    const elements = store.elements;
    if (!elements) return null;

    const elementsMap = elements instanceof Map ? elements : new Map(Object.entries(elements));

    // Collect nodes
    allNodeIds.forEach(nodeId => {
      const node = elementsMap.get(nodeId);
      if (node && typeof node === 'object' && 'type' in node && node.type === "mindmap-node") {
        nodesToDuplicate.push(node as MindmapNodeElement);
      }
    });

    // Collect edges between nodes in the subtree
    elementsMap.forEach((element) => {
      if (element && typeof element === 'object' && 'type' in element && element.type === "mindmap-edge") {
        const edge = element as MindmapEdgeElement;
        if (allNodeIds.includes(edge.fromId) && allNodeIds.includes(edge.toId)) {
          edgesToDuplicate.push(edge);
        }
      }
    });

    // Create mapping from old IDs to new IDs
    const idMapping = new Map<string, string>();
    allNodeIds.forEach(oldId => {
      idMapping.set(oldId, crypto?.randomUUID?.() ?? nanoid());
    });

    const newRootId = idMapping.get(rootId);
    if (!newRootId) return null;

    // Create duplicated nodes with new IDs and positions
    const duplicatedNodes: MindmapNodeElement[] = [];
    for (const node of nodesToDuplicate) {
      const mappedId = idMapping.get(node.id);
      if (!mappedId) continue;
      const parentMappedId = node.parentId ? idMapping.get(node.parentId) ?? null : null;
      duplicatedNodes.push({
        ...node,
        id: mappedId,
        x: node.x + offset.x,
        y: node.y + offset.y,
        parentId: parentMappedId,
      });
    }

    // Create duplicated edges with new IDs
    const duplicatedEdges: MindmapEdgeElement[] = [];
    for (const edge of edgesToDuplicate) {
      const fromId = idMapping.get(edge.fromId);
      const toId = idMapping.get(edge.toId);
      if (!fromId || !toId) continue;
      duplicatedEdges.push({
        ...edge,
        id: crypto?.randomUUID?.() ?? nanoid(),
        fromId,
        toId,
      });
    }

    // Use withUndo to make the operation undoable
    const withUndo = store.history?.withUndo;
    if (withUndo) {
      withUndo("Duplicate mindmap subtree", () => {
        duplicatedNodes.forEach((node) => addElementToStore(node, { pushHistory: false }));
        duplicatedEdges.forEach((edge) => addElementToStore(edge, { pushHistory: false }));

        // Update selection to new root
        const setSelection = store.setSelection || store.selection?.set;
        setSelection?.([newRootId]);
      });
    } else {
      // Fallback without undo
      [...duplicatedNodes, ...duplicatedEdges].forEach((element) => {
        addElementToStore(element, { pushHistory: true });
      });
    }

    return newRootId;
  }

  return {
    duplicateNode,
    createChildNode,
    duplicateSubtree,
    getNodeDescendants,
    getNodeChildren,
  };
}

/**
 * Hook for accessing mindmap operations
 */
export function useMindmapOperations(): MindmapOperationsAPI {
  return createMindmapOperations();
}
