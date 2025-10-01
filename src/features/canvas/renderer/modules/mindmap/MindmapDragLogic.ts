// MindmapDragLogic - Subtree dragging with descendants
// Extracted from MindmapRenderer.ts as part of modularization

import type { CanvasElement } from "../../../../../../types";
import type { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";

// Store state interfaces
interface StoreState {
  elements?: Map<string, CanvasElement> | Record<string, CanvasElement>;
  element?: {
    all?: Map<string, CanvasElement> | Record<string, CanvasElement>;
    update?: (
      id: string,
      changes: Partial<CanvasElement>,
      options?: { pushHistory?: boolean },
    ) => void;
  };
  history?: {
    withUndo?: (description: string, fn: () => void) => void;
  };
  selection?: {
    selectOne?: (id: string, additive: boolean) => void;
    replaceSelectionWithSingle?: (id: string) => void;
  };
  updateElement?: (
    id: string,
    changes: Partial<CanvasElement>,
    options?: { pushHistory?: boolean },
  ) => void;
  replaceSelectionWithSingle?: (id: string) => void;
}

interface MindmapNodeData extends Record<string, unknown> {
  parentId?: string | null;
}

interface MindmapCanvasElement extends CanvasElement {
  data?: MindmapNodeData;
  parentId?: string | null;
}

export interface DraggedNodeData {
  nodeId: string;
  descendants: Set<string>;
  initialPositions: Map<string, { x: number; y: number }>;
}

export class MindmapDragLogic {
  private readonly store: typeof useUnifiedCanvasStore;
  draggedNodeData: DraggedNodeData | null = null;

  constructor(store: typeof useUnifiedCanvasStore) {
    this.store = store;
  }

  getAllDescendants(nodeId: string): Set<string> {
    const state = this.store.getState() as StoreState;
    const elements = state.elements ?? state.element?.all;
    if (!elements) return new Set();

    const elementsMap =
      elements instanceof Map ? elements : new Map(Object.entries(elements));
    const descendants = new Set<string>();

    const findDescendants = (parentId: string) => {
      elementsMap.forEach((element: CanvasElement) => {
        if (element.type === "mindmap-node") {
          const id = element.id;
          const mindmapElement = element as MindmapCanvasElement;
          const elementParentId =
            mindmapElement.parentId ??
            (mindmapElement.data as MindmapNodeData | undefined)?.parentId ??
            null;

          if (elementParentId === parentId) {
            descendants.add(id);
            // Recursively find descendants of this child
            findDescendants(id);
          }
        }
      });
    };

    findDescendants(nodeId);
    return descendants;
  }

  selectElement(elementId: string) {
    const state = this.store.getState() as StoreState;
    const replaceSelection =
      state.selection?.replaceSelectionWithSingle ??
      state.replaceSelectionWithSingle;
    replaceSelection?.(elementId);
  }

  updateNodePosition(elementId: string, x: number, y: number) {
    const state = this.store.getState() as StoreState;
    const update = state.element?.update ?? state.updateElement;
    const withUndo = state.history?.withUndo;

    if (withUndo) {
      withUndo("Move mindmap node", () => {
        update?.(elementId, { x, y }, { pushHistory: false });
      });
    } else {
      update?.(elementId, { x, y }, { pushHistory: true });
    }
  }

  updateMultipleNodePositions(
    updates: Map<string, { x: number; y: number }>,
  ) {
    const state = this.store.getState() as StoreState;
    const update = state.element?.update ?? state.updateElement;
    const withUndo = state.history?.withUndo;

    if (withUndo) {
      withUndo("Move mindmap subtree", () => {
        updates.forEach((pos, id) => {
          update?.(id, pos, { pushHistory: false });
        });
      });
    } else {
      updates.forEach((pos, id) => {
        update?.(id, pos, { pushHistory: true });
      });
    }
  }
}
