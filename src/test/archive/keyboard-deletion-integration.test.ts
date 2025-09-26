// features/canvas/__tests__/e2e/keyboard-deletion-integration.test.ts

import { describe, expect, it, beforeEach } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { CanvasElement, ElementId } from '../../../../types/index';

describe('Keyboard Deletion Integration (E2E)', () => {
  beforeEach(() => {
    // Reset store to a clean state
    useUnifiedCanvasStore.setState((state) => ({
      elements: new Map<ElementId, CanvasElement>(),
      selectedElementIds: new Set<ElementId>(),
      elementOrder: [],
      ui: state.ui
        ? { ...state.ui, selectedTool: 'select' }
        : {
            selectedTool: 'select',
            strokeColor: '#000000',
            fillColor: '#ffffff',
            strokeWidth: 2,
            stickyNoteColor: '#FFF59D',
            setSelectedTool: () => {},
            setStrokeColor: () => {},
            setFillColor: () => {},
            setStrokeWidth: () => {},
            setStickyNoteColor: () => {},
          },
    }));
  });

  it('should complete full deletion workflow: create → select → delete → verify', async () => {
    // Step 1: Create elements
    const rectangleElement: CanvasElement = {
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      bounds: { width: 150, height: 100 },
      style: {
        fill: '#ff0000',
        stroke: '#000000',
        strokeWidth: 2,
      },
    };

    const circleElement: CanvasElement = {
      id: 'circle-1',
      type: 'circle',
      x: 300,
      y: 100,
      bounds: { width: 80, height: 80 },
      style: {
        fill: '#00ff00',
        stroke: '#000000',
        strokeWidth: 2,
      },
    };

    // Add elements to store
    const store = useUnifiedCanvasStore.getState();
    store.addElement(rectangleElement);
    store.addElement(circleElement);

    // Verify elements were added
    const storeAfterAdd = useUnifiedCanvasStore.getState();
    expect(storeAfterAdd.elements.size).toBe(2);
    expect(storeAfterAdd.elements.has('rect-1')).toBe(true);
    expect(storeAfterAdd.elements.has('circle-1')).toBe(true);

    // Step 2: Select elements
    storeAfterAdd.setSelection(['rect-1']);

    // Verify selection
    const storeAfterSelect = useUnifiedCanvasStore.getState();
    expect(storeAfterSelect.selectedElementIds.size).toBe(1);
    expect(storeAfterSelect.selectedElementIds.has('rect-1')).toBe(true);

    // Step 3: Use the keyboard deletion logic
    const storeForDelete = useUnifiedCanvasStore.getState();
    if (storeForDelete.selectedElementIds.size > 0 && storeForDelete.selection?.deleteSelected) {
      if (storeForDelete.withUndo) {
        storeForDelete.withUndo('Delete selected elements', () => {
          storeForDelete.selection?.deleteSelected();
        });
      }
    }

    // Step 4: Verify deletion
    const finalStore = useUnifiedCanvasStore.getState();
    expect(finalStore.elements.size).toBe(1);
    expect(finalStore.elements.has('rect-1')).toBe(false);
    expect(finalStore.elements.has('circle-1')).toBe(true);
    expect(finalStore.selectedElementIds.size).toBe(0);
  });

  it('should handle multiple element deletion correctly', async () => {
    // Create multiple elements
    const elements: CanvasElement[] = [
      {
        id: 'element-1',
        type: 'rectangle',
        x: 0,
        y: 0,
        bounds: { width: 50, height: 50 },
      },
      {
        id: 'element-2',
        type: 'circle',
        x: 100,
        y: 0,
        bounds: { width: 50, height: 50 },
      },
      {
        id: 'element-3',
        type: 'triangle',
        x: 200,
        y: 0,
        bounds: { width: 50, height: 50 },
      },
    ];

    // Add all elements
    const store = useUnifiedCanvasStore.getState();
    elements.forEach(el => store.addElement(el));

    const storeAfterAdd = useUnifiedCanvasStore.getState();
    expect(storeAfterAdd.elements.size).toBe(3);

    // Select first two elements
    storeAfterAdd.setSelection(['element-1', 'element-2']);

    const storeAfterSelect = useUnifiedCanvasStore.getState();
    expect(storeAfterSelect.selectedElementIds.size).toBe(2);

    // Delete selected elements
    const storeForDelete = useUnifiedCanvasStore.getState();
    if (storeForDelete.selectedElementIds.size > 0 && storeForDelete.selection?.deleteSelected) {
      if (storeForDelete.withUndo) {
        storeForDelete.withUndo('Delete selected elements', () => {
          storeForDelete.selection?.deleteSelected();
        });
      }
    }

    // Verify only element-3 remains
    const finalStore = useUnifiedCanvasStore.getState();
    expect(finalStore.elements.size).toBe(1);
    expect(finalStore.elements.has('element-3')).toBe(true);
    expect(finalStore.selectedElementIds.size).toBe(0);
  });

  it('should respect edge case: no deletion when nothing is selected', async () => {
    // Create an element
    const element: CanvasElement = {
      id: 'element-1',
      type: 'rectangle',
      x: 0,
      y: 0,
      bounds: { width: 50, height: 50 },
    };

    const store = useUnifiedCanvasStore.getState();
    store.addElement(element);

    const storeAfterAdd = useUnifiedCanvasStore.getState();
    expect(storeAfterAdd.elements.size).toBe(1);

    // Ensure nothing is selected
    storeAfterAdd.clearSelection();

    const storeAfterClear = useUnifiedCanvasStore.getState();
    expect(storeAfterClear.selectedElementIds.size).toBe(0);

    // Attempt deletion (this should not do anything)
    const storeForDelete = useUnifiedCanvasStore.getState();
    if (storeForDelete.selectedElementIds.size > 0 && storeForDelete.selection?.deleteSelected) {
      if (storeForDelete.withUndo) {
        storeForDelete.withUndo('Delete selected elements', () => {
          storeForDelete.selection?.deleteSelected();
        });
      }
    }

    // Verify element still exists
    const finalStore = useUnifiedCanvasStore.getState();
    expect(finalStore.elements.size).toBe(1);
    expect(finalStore.elements.has('element-1')).toBe(true);
  });

  it('should properly integrate with history system for undo/redo', async () => {
    // Create an element
    const element: CanvasElement = {
      id: 'element-1',
      type: 'rectangle',
      x: 0,
      y: 0,
      bounds: { width: 50, height: 50 },
    };

    // Add element with history
    const store = useUnifiedCanvasStore.getState();
    store.withUndo?.('Add element', () => {
      store.addElement(element);
    });

    const storeAfterAdd = useUnifiedCanvasStore.getState();
    expect(storeAfterAdd.elements.size).toBe(1);

    // Select and delete with history
    storeAfterAdd.setSelection(['element-1']);
    const storeForDelete = useUnifiedCanvasStore.getState();
    storeForDelete.withUndo?.('Delete selected elements', () => {
      storeForDelete.selection?.deleteSelected();
    });

    const storeAfterDelete = useUnifiedCanvasStore.getState();
    expect(storeAfterDelete.elements.size).toBe(0);

    // Test undo
    storeAfterDelete.undo?.();
    const storeAfterUndo = useUnifiedCanvasStore.getState();
    expect(storeAfterUndo.elements.size).toBe(1);
    expect(storeAfterUndo.elements.has('element-1')).toBe(true);

    // Test redo
    storeAfterUndo.redo?.();
    const storeAfterRedo = useUnifiedCanvasStore.getState();
    expect(storeAfterRedo.elements.size).toBe(0);
  });
});
