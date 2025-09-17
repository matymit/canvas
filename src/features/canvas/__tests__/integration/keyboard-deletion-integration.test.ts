// features/canvas/__tests__/e2e/keyboard-deletion-integration.test.ts

import { describe, expect, it, beforeEach } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { CanvasElement, ElementId } from '../../../../types/index';

describe('Keyboard Deletion Integration (E2E)', () => {
  beforeEach(() => {
    // Reset store to a clean state
    useUnifiedCanvasStore.setState({
      elements: new Map<ElementId, CanvasElement>(),
      selectedElementIds: new Set<ElementId>(),
      elementOrder: [],
      selectedTool: 'select',
    });
  });

  it('should complete full deletion workflow: create → select → delete → verify', async () => {
    const store = useUnifiedCanvasStore.getState();

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
    store.addElement(rectangleElement);
    store.addElement(circleElement);

    // Verify elements were added
    expect(store.elements.size).toBe(2);
    expect(store.elements.has('rect-1')).toBe(true);
    expect(store.elements.has('circle-1')).toBe(true);

    // Step 2: Select elements
    store.setSelection(['rect-1']);

    // Verify selection
    expect(store.selectedElementIds.size).toBe(1);
    expect(store.selectedElementIds.has('rect-1')).toBe(true);

    // Step 3: Use the keyboard deletion logic
    if (store.selectedElementIds.size > 0 && store.selection?.deleteSelected) {
      if (store.withUndo) {
        store.withUndo('Delete selected elements', () => {
          store.selection?.deleteSelected();
        });
      }
    }

    // Step 4: Verify deletion
    expect(store.elements.size).toBe(1);
    expect(store.elements.has('rect-1')).toBe(false);
    expect(store.elements.has('circle-1')).toBe(true);
    expect(store.selectedElementIds.size).toBe(0);
  });

  it('should handle multiple element deletion correctly', async () => {
    const store = useUnifiedCanvasStore.getState();

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
    elements.forEach(el => store.addElement(el));
    expect(store.elements.size).toBe(3);

    // Select first two elements
    store.setSelection(['element-1', 'element-2']);
    expect(store.selectedElementIds.size).toBe(2);

    // Delete selected elements
    if (store.selectedElementIds.size > 0 && store.selection?.deleteSelected) {
      if (store.withUndo) {
        store.withUndo('Delete selected elements', () => {
          store.selection?.deleteSelected();
        });
      }
    }

    // Verify only element-3 remains
    expect(store.elements.size).toBe(1);
    expect(store.elements.has('element-3')).toBe(true);
    expect(store.selectedElementIds.size).toBe(0);
  });

  it('should respect edge case: no deletion when nothing is selected', async () => {
    const store = useUnifiedCanvasStore.getState();

    // Create an element
    const element: CanvasElement = {
      id: 'element-1',
      type: 'rectangle',
      x: 0,
      y: 0,
      bounds: { width: 50, height: 50 },
    };

    store.addElement(element);
    expect(store.elements.size).toBe(1);

    // Ensure nothing is selected
    store.clearSelection();
    expect(store.selectedElementIds.size).toBe(0);

    // Attempt deletion (this should not do anything)
    if (store.selectedElementIds.size > 0 && store.selection?.deleteSelected) {
      if (store.withUndo) {
        store.withUndo('Delete selected elements', () => {
          store.selection?.deleteSelected();
        });
      }
    }

    // Verify element still exists
    expect(store.elements.size).toBe(1);
    expect(store.elements.has('element-1')).toBe(true);
  });

  it('should properly integrate with history system for undo/redo', async () => {
    const store = useUnifiedCanvasStore.getState();

    // Create an element
    const element: CanvasElement = {
      id: 'element-1',
      type: 'rectangle',
      x: 0,
      y: 0,
      bounds: { width: 50, height: 50 },
    };

    // Add element with history
    store.withUndo?.('Add element', () => {
      store.addElement(element);
    });

    expect(store.elements.size).toBe(1);

    // Select and delete with history
    store.setSelection(['element-1']);
    store.withUndo?.('Delete selected elements', () => {
      store.selection?.deleteSelected();
    });

    expect(store.elements.size).toBe(0);

    // Test undo
    store.undo?.();
    expect(store.elements.size).toBe(1);
    expect(store.elements.has('element-1')).toBe(true);

    // Test redo
    store.redo?.();
    expect(store.elements.size).toBe(0);
  });
});