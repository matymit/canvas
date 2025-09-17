// features/canvas/__tests__/unit/persistence-history.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { CanvasElement } from '../../../../../types/index';

describe('Persistence and History Integration', () => {
  beforeEach(() => {
    // Reset store to initial state
    useUnifiedCanvasStore.setState({
      elements: new Map(),
      elementOrder: [],
      selectedElementIds: new Set(),
      entries: [],
      index: -1
    });
  });

  describe('History System', () => {
    it('should track element additions with history', () => {
      const store = useUnifiedCanvasStore.getState();
      const testElement: CanvasElement = {
        id: 'test-1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        stroke: '#000000',
        fill: '#ffffff'
      };

      // Add element using the unified interface
      store.element.upsert(testElement);

      // Verify element was added
      expect(store.elements.size).toBe(1);
      expect(store.elements.get('test-1')).toEqual(testElement);

      // Verify history can undo
      expect(store.canUndo()).toBe(true);

      // Undo the addition
      store.undo();
      expect(store.elements.size).toBe(0);

      // Verify history can redo
      expect(store.canRedo()).toBe(true);

      // Redo the addition
      store.redo();
      expect(store.elements.size).toBe(1);
      expect(store.elements.get('test-1')).toEqual(testElement);
    });

    it('should track element updates with history', () => {
      const store = useUnifiedCanvasStore.getState();
      const testElement: CanvasElement = {
        id: 'test-2',
        type: 'circle',
        x: 50,
        y: 50,
        radius: 30,
        fill: '#ff0000'
      };

      // Add element
      store.element.upsert(testElement);

      // Update element
      store.element.update('test-2', { x: 150, y: 200, fill: '#00ff00' });

      // Verify update
      const updated = store.elements.get('test-2');
      expect(updated?.x).toBe(150);
      expect(updated?.y).toBe(200);
      expect(updated?.fill).toBe('#00ff00');

      // Undo the update (should restore original state)
      store.undo();
      const reverted = store.elements.get('test-2');
      expect(reverted?.x).toBe(50);
      expect(reverted?.y).toBe(50);
      expect(reverted?.fill).toBe('#ff0000');
    });

    it('should track element deletion with history', () => {
      const store = useUnifiedCanvasStore.getState();
      const testElement: CanvasElement = {
        id: 'test-3',
        type: 'text',
        x: 100,
        y: 100,
        text: 'Hello World',
        fontSize: 16
      };

      // Add element
      store.element.upsert(testElement);
      expect(store.elements.size).toBe(1);

      // Delete element
      store.element.delete('test-3');
      expect(store.elements.size).toBe(0);

      // Undo deletion (should restore element)
      store.undo();
      expect(store.elements.size).toBe(1);
      expect(store.elements.get('test-3')).toEqual(testElement);
    });

    it('should support withUndo for batch operations', () => {
      const store = useUnifiedCanvasStore.getState();

      // Perform batch operation with withUndo
      store.withUndo('Add multiple shapes', () => {
        store.element.upsert({
          id: 'shape-1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 100
        });
        store.element.upsert({
          id: 'shape-2',
          type: 'circle',
          x: 200,
          y: 0,
          radius: 50
        });
        store.element.upsert({
          id: 'shape-3',
          type: 'triangle',
          x: 400,
          y: 0,
          points: [0, 0, 100, 0, 50, 100]
        });
      });

      // Verify all elements were added
      expect(store.elements.size).toBe(3);

      // Undo should remove all three elements at once
      store.undo();
      expect(store.elements.size).toBe(0);

      // Redo should restore all three elements at once
      store.redo();
      expect(store.elements.size).toBe(3);
    });

    it('should track z-order changes with history', () => {
      const store = useUnifiedCanvasStore.getState();

      // Add multiple elements
      store.element.upsert({ id: 'el-1', type: 'rect', x: 0, y: 0 });
      store.element.upsert({ id: 'el-2', type: 'rect', x: 100, y: 0 });
      store.element.upsert({ id: 'el-3', type: 'rect', x: 200, y: 0 });

      const originalOrder = [...store.elementOrder];
      expect(originalOrder).toEqual(['el-1', 'el-2', 'el-3']);

      // Bring el-1 to front
      store.element.bringToFront('el-1');
      expect(store.elementOrder).toEqual(['el-2', 'el-3', 'el-1']);

      // Send el-3 to back
      store.element.sendToBack('el-3');
      expect(store.elementOrder).toEqual(['el-3', 'el-2', 'el-1']);

      // Undo sendToBack
      store.undo();
      expect(store.elementOrder).toEqual(['el-2', 'el-3', 'el-1']);

      // Undo bringToFront
      store.undo();
      expect(store.elementOrder).toEqual(['el-1', 'el-2', 'el-3']);
    });
  });

  describe('Persistence', () => {
    it('should serialize Map/Set collections for persistence', () => {
      const store = useUnifiedCanvasStore.getState();

      // Add elements
      store.element.upsert({ id: 'p1', type: 'rect', x: 0, y: 0 });
      store.element.upsert({ id: 'p2', type: 'circle', x: 100, y: 100 });

      // Select elements
      store.selection.set(['p1', 'p2']);

      // Get current state
      const elements = store.elements;
      const selectedIds = store.selectedElementIds;

      // Verify Map/Set structures
      expect(elements instanceof Map).toBe(true);
      expect(selectedIds instanceof Set).toBe(true);

      // Verify contents
      expect(Array.from(elements.keys())).toEqual(['p1', 'p2']);
      expect(Array.from(selectedIds)).toEqual(['p1', 'p2']);
    });

    it('should maintain viewport state', () => {
      const store = useUnifiedCanvasStore.getState();

      // Set viewport
      store.viewport.setPan(500, 300);
      store.viewport.setScale(1.5);

      // Verify viewport state
      expect(store.viewport.x).toBe(500);
      expect(store.viewport.y).toBe(300);
      expect(store.viewport.scale).toBe(1.5);

      // Reset viewport
      store.viewport.reset();
      expect(store.viewport.x).toBe(0);
      expect(store.viewport.y).toBe(0);
      expect(store.viewport.scale).toBe(1);
    });
  });

  describe('Element Operations with History', () => {
    it('should duplicate elements with history tracking', () => {
      const store = useUnifiedCanvasStore.getState();

      // Add original element
      store.element.upsert({
        id: 'original',
        type: 'sticky-note',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        text: 'Original Note',
        color: '#FFF59D'
      });

      // Duplicate element
      const newId = store.element.duplicate('original');
      expect(newId).toBeTruthy();

      // Verify duplicate exists with offset position
      const duplicate = store.elements.get(newId!);
      expect(duplicate).toBeTruthy();
      expect(duplicate?.x).toBe(112); // 100 + 12 offset
      expect(duplicate?.y).toBe(112); // 100 + 12 offset
      expect(duplicate?.text).toBe('Original Note');

      // Undo duplication
      store.undo();
      expect(store.elements.size).toBe(1);
      expect(store.elements.has(newId!)).toBe(false);
    });

    it('should handle complex drawing paths', () => {
      const store = useUnifiedCanvasStore.getState();

      const drawingPath = [10, 10, 20, 20, 30, 15, 40, 25, 50, 20];

      store.element.upsert({
        id: 'drawing-1',
        type: 'drawing',
        tool: 'pen',
        path: drawingPath,
        stroke: '#000000',
        strokeWidth: 2
      });

      const element = store.elements.get('drawing-1');
      expect(element?.path).toEqual(drawingPath);
      expect(element?.tool).toBe('pen');
    });
  });
});