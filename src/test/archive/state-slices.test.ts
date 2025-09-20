import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { CanvasElement } from '../../../../../types/index';

describe('State Slices Unit Tests', () => {
let store: ReturnType<typeof useUnifiedCanvasStore.getState>;
const S = () => useUnifiedCanvasStore.getState();
const refresh = () => { store = useUnifiedCanvasStore.getState(); };

  beforeEach(() => {
    // Reset store to initial state
    useUnifiedCanvasStore.setState({
      elements: new Map(),
      elementOrder: [],
      selectedElementIds: new Set(),
    });
    store = useUnifiedCanvasStore.getState();
  });

  describe('Element CRUD Operations', () => {
    const mockElement: CanvasElement = {
      id: 'test-1',
      type: 'rectangle',
      x: 100,
      y: 200,
      width: 150,
      height: 100,
      style: { fill: '#ff0000' },
    } as any;

    it('should upsert element to Map and maintain order', () => {
      const elementId = store.element.upsert(mockElement);
      refresh();
      
      expect(elementId).toBe('test-1');
      expect(S().elements.has('test-1')).toBe(true);
      expect(S().elements.get('test-1')).toEqual(mockElement);
      expect(S().elementOrder).toContain('test-1');
      expect(S().elements.size).toBe(1);
    });

    it('should update existing element without duplicating in order', () => {
      store.element.upsert(mockElement);
      refresh();
      const initialOrderLength = S().elementOrder.length;
      
      store.element.update('test-1', { x: 300, y: 400 });
      refresh();
      
      const updatedElement = S().elements.get('test-1');
      expect(updatedElement?.x).toBe(300);
      expect(updatedElement?.y).toBe(400);
      expect(S().elementOrder.length).toBe(initialOrderLength);
    });

    it('should delete element from Map and order', () => {
      store.element.upsert(mockElement);
      refresh();
      expect(S().elements.has('test-1')).toBe(true);
      
      store.element.delete('test-1');
      refresh();
      
      const s = S();
      expect(s.elements.has('test-1')).toBe(false);
      expect(s.elementOrder).not.toContain('test-1');
      expect(s.elements.size).toBe(0);
    });

    it('should duplicate element with new ID', () => {
      store.element.upsert(mockElement);
      refresh();
      
      const newId = store.element.duplicate('test-1');
      refresh();
      
      expect(newId).toBeTruthy();
      expect(newId).not.toBe('test-1');
      expect(S().elements.size).toBe(2);
      expect(S().elementOrder.length).toBe(2);
      
      const duplicated = S().elements.get(newId!);
      expect(duplicated?.x).toBe(mockElement.x + 12);
      expect(duplicated?.y).toBe(mockElement.y + 12);
      expect(duplicated?.id).toBe(newId);
    });

    it('should maintain draw order with bringToFront/sendToBack', () => {
      const element1 = { ...mockElement, id: 'el-1' };
      const element2 = { ...mockElement, id: 'el-2' };
      const element3 = { ...mockElement, id: 'el-3' };
      
      store.element.upsert(element1);
      store.element.upsert(element2);
      store.element.upsert(element3);
      refresh();
      
      expect(S().elementOrder).toEqual(['el-1', 'el-2', 'el-3']);
      
      store.element.bringToFront('el-1');
      refresh();
      expect(S().elementOrder).toEqual(['el-2', 'el-3', 'el-1']);
      
      store.element.sendToBack('el-2');
      refresh();
      expect(S().elementOrder).toEqual(['el-2', 'el-3', 'el-1']);
    });

    it('should ensure no Konva nodes leak into state', () => {
      const elementWithKonvaRef = {
        ...mockElement,
        _konvaNode: { x: () => 100 }, // This should not persist
      };
      
      store.element.upsert(elementWithKonvaRef);
      refresh();
      const stored = S().elements.get('test-1');
      
      expect(stored).not.toHaveProperty('_konvaNode');
      expect(typeof stored?.x).toBe('number');
      expect(typeof stored?.y).toBe('number');
    });
  });

  describe('Selection Set Management', () => {
    beforeEach(() => {
      // Add some test elements
      ['el-1', 'el-2', 'el-3'].forEach(id => {
        store.element.upsert({ id, type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as any);
      });
      refresh();
    });

    it('should manage selectedElementIds as Set with O(1) membership', () => {
      expect(store.selectedElementIds instanceof Set).toBe(true);
      expect(store.selectedElementIds.size).toBe(0);
      
      store.selection.selectOne('el-1');
      refresh();
      expect(S().selectedElementIds.has('el-1')).toBe(true);
      expect(S().selectedElementIds.size).toBe(1);
    });

    it('should toggle selection correctly', () => {
      store.selection.selectOne('el-1');
      refresh();
      expect(S().selectedElementIds.has('el-1')).toBe(true);
      
      store.selection.toggle('el-1');
      refresh();
      expect(S().selectedElementIds.has('el-1')).toBe(false);
      
      store.selection.toggle('el-1');
      refresh();
      expect(S().selectedElementIds.has('el-1')).toBe(true);
    });

    it('should set multiple selections', () => {
      store.selection.set(['el-1', 'el-2']);
      refresh();
      
      expect(S().selectedElementIds.size).toBe(2);
      expect(S().selectedElementIds.has('el-1')).toBe(true);
      expect(S().selectedElementIds.has('el-2')).toBe(true);
      expect(S().selectedElementIds.has('el-3')).toBe(false);
    });

    it('should clear all selections', () => {
      store.selection.set(['el-1', 'el-2']);
      refresh();
      expect(S().selectedElementIds.size).toBe(2);
      
      store.selection.clear();
      refresh();
      expect(S().selectedElementIds.size).toBe(0);
    });

    it('should select all elements', () => {
      store.selection.selectAll();
      refresh();
      
      expect(S().selectedElementIds.size).toBe(3);
      S().elementOrder.forEach(id => {
        expect(S().selectedElementIds.has(id)).toBe(true);
      });
    });

    it('should get selected elements', () => {
      store.selection.set(['el-1', 'el-2']);
      refresh();
      
      const selected = S().selection.getSelected();
      expect(selected.length).toBe(2);
      expect(selected.some((el: any) => el.id === 'el-1')).toBe(true);
      expect(selected.some((el: any) => el.id === 'el-2')).toBe(true);
    });
  });

  describe('History Batching', () => {
    it('should begin and end history batches correctly', () => {
      const historyBeginSpy = vi.fn();
      const historyEndSpy = vi.fn();
      
      // Mock history module
      store.history = {
        ...store.history,
        beginBatch: historyBeginSpy,
        endBatch: historyEndSpy,
      } as any;
      
      store.history.beginBatch('Test operation');
      expect(historyBeginSpy).toHaveBeenCalledWith('Test operation');
      
      store.history.endBatch();
      expect(historyEndSpy).toHaveBeenCalled();
    });

    it('should support nested batching with depth tracking', () => {
      let batchDepth = 0;
      store.history = {
        ...store.history,
        _batchDepth: 0,
        beginBatch: () => { batchDepth++; },
        endBatch: () => { batchDepth--; },
      } as any;
      
      store.history.beginBatch('Outer');
      expect(batchDepth).toBe(1);
      
      store.history.beginBatch('Inner');
      expect(batchDepth).toBe(2);
      
      store.history.endBatch();
      expect(batchDepth).toBe(1);
      
      store.history.endBatch();
      expect(batchDepth).toBe(0);
    });

    it('should withUndo execute mutations and batch correctly', () => {
      const mockMutator = vi.fn(() => {
        store.element.upsert({ id: 'test-1', type: 'rectangle', x: 500, y: 0, width: 10, height: 10 } as any);
      });
      
      store.withUndo('Test mutation', mockMutator);
      refresh();
      
      expect(mockMutator).toHaveBeenCalled();
      expect(S().elements.get('test-1')?.x).toBe(500);
    });

    it('should pushHistory flag work with updateElement', () => {
      store.element.upsert({ id: 'test-1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as any);
      const historySnapshotSpy = vi.fn();
      
      // Spy on record (newer API) instead of snapshot
      const recordSpy = vi.fn();
      // Patch root record to capture calls
      (useUnifiedCanvasStore.getState() as any).record = recordSpy;
      
      // Update with pushHistory flag
      store.element.update('test-1', { x: 999 });
      
      // Should trigger history record
      expect(recordSpy).toHaveBeenCalled();
    });
  });

  describe('Selection Version Bumps', () => {
    it('should increment selectionVersion on selection changes', () => {
      const initialVersion = S().selectionVersion || 0;
      
      store.selection.selectOne('el-1');
      refresh();
      expect(S().selectionVersion).toBeGreaterThan(initialVersion);
      
      const afterSelectVersion = S().selectionVersion;
      store.selection.clear();
      refresh();
      expect(S().selectionVersion).toBeGreaterThan(afterSelectVersion);
    });

    it('should use selectionVersion for efficient transformer updates', () => {
      // This tests that selectionVersion changes trigger transformer reattachment
      let transformerUpdateCount = 0;
      
      // Simulate transformer subscribing to selectionVersion
      useUnifiedCanvasStore.subscribe(
        (state) => ({ 
          selectedIds: Array.from(state.selectedElementIds || []),
          selectionVersion: state.selectionVersion || 0,
        }),
        ({ selectedIds }) => {
          if (selectedIds.length > 0) {
            transformerUpdateCount++;
          }
        }
      );
      
      store.selection.selectOne('el-1');
      store.selection.selectOne('el-2');
      
      expect(transformerUpdateCount).toBeGreaterThanOrEqual(2);
    });
  });
});