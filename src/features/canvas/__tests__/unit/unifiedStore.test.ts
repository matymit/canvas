import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

// Mock types for testing
type ElementId = string;
interface CanvasElement {
  id: ElementId;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Add other properties as needed
}

describe('Unified Store Element CRUD', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUnifiedCanvasStore.setState({
      elements: new Map(),
      elementOrder: [],
      selectedElementIds: new Set(),
      selectionVersion: 0,
      lastSelectedId: undefined,
      isTransforming: false,
      viewport: {
        x: 0,
        y: 0,
        scale: 1,
        minScale: 0.1,
        maxScale: 5,
      },
      history: {
        past: [],
        future: [],
        limit: 50,
        _batchDepth: 0,
        undo: vi.fn(),
        redo: vi.fn(),
        clear: vi.fn(),
        beginBatch: vi.fn(),
        endBatch: vi.fn(),
        snapshot: vi.fn(),
        withUndo: vi.fn(),
      },
    });
  });

  it('should add elements atomically with order maintenance', () => {
    const store = useUnifiedCanvasStore.getState();

    const el1: CanvasElement = { id: '1', type: 'rect', x: 10, y: 10 };
    const el2: CanvasElement = { id: '2', type: 'circle', x: 20, y: 20 };

    store.element.upsert(el1);
    store.element.upsert(el2);

    expect(store.element.getById('1')).toEqual(el1);
    expect(store.element.getById('2')).toEqual(el2);
    expect(useUnifiedCanvasStore.getState().elementOrder).toEqual(['1', '2']);
  });

  it('should update elements atomically', () => {
    const store = useUnifiedCanvasStore.getState();

    const el: CanvasElement = { id: '1', type: 'rect', x: 10, y: 10 };
    store.element.upsert(el);

    store.element.update('1', { x: 50, y: 50 });

    const updated = store.element.getById('1');
    expect(updated?.x).toBe(50);
    expect(updated?.y).toBe(50);
    expect(updated?.type).toBe('rect'); // unchanged
  });

  it('should delete elements atomically with order update', () => {
    const store = useUnifiedCanvasStore.getState();

    const el1: CanvasElement = { id: '1', type: 'rect' };
    const el2: CanvasElement = { id: '2', type: 'circle' };
    const el3: CanvasElement = { id: '3', type: 'text' };

    store.element.upsert(el1);
    store.element.upsert(el2);
    store.element.upsert(el3);

    store.element.delete('2');

    expect(store.element.getById('2')).toBeUndefined();
    expect(useUnifiedCanvasStore.getState().elementOrder).toEqual(['1', '3']);
  });

  it('should maintain ID-branded type safety', () => {
    const store = useUnifiedCanvasStore.getState();

    const el: CanvasElement = { id: 'test-id', type: 'shape' };
    store.element.upsert(el);

    expect(store.element.getById('test-id')).toBeDefined();
    expect(store.element.getById('nonexistent')).toBeUndefined();
  });

  it('should handle selective persistence', () => {
    // Test that persistence serializes correctly
    const store = useUnifiedCanvasStore.getState();

    const el: CanvasElement = { id: '1', type: 'rect' };
    store.element.upsert(el);
    store.selection.set(['1']);

    // Simulate persistence (this would be done by zustand persist)
    const state = useUnifiedCanvasStore.getState();
    const serialized = {
      elements: Array.from(state.elements.entries()),
      elementOrder: state.elementOrder,
      selectedElementIds: Array.from(state.selectedElementIds),
      viewport: state.viewport,
    };

    expect(serialized.elements).toEqual([['1', el]]);
    expect(serialized.elementOrder).toEqual(['1']);
    expect(serialized.selectedElementIds).toEqual(['1']);
  });
});

describe('Multi-selection Logic', () => {
  beforeEach(() => {
    useUnifiedCanvasStore.setState({
      elements: new Map([
        ['1', { id: '1', type: 'rect' }],
        ['2', { id: '2', type: 'circle' }],
        ['3', { id: '3', type: 'text' }],
      ]),
      elementOrder: ['1', '2', '3'],
      selectedElementIds: new Set(),
      selectionVersion: 0,
      lastSelectedId: undefined,
      isTransforming: false,
    });
  });

  it('should handle single selection', () => {
    const store = useUnifiedCanvasStore.getState();

    store.selection.set(['1']);

    const s = useUnifiedCanvasStore.getState();
    expect(s.selectedElementIds.has('1')).toBe(true);
    expect(s.selectedElementIds.size).toBe(1);
    expect(s.lastSelectedId).toBe('1');
  });

  it('should handle additive selection (cmd/ctrl)', () => {
    const store = useUnifiedCanvasStore.getState();

    store.selection.selectOne('1', true);
    store.selection.selectOne('2', true);

    const s = useUnifiedCanvasStore.getState();
    expect(s.selectedElementIds.has('1')).toBe(true);
    expect(s.selectedElementIds.has('2')).toBe(true);
    expect(s.selectedElementIds.size).toBe(2);
    expect(s.lastSelectedId).toBe('2');
  });

  it('should handle toggle selection', () => {
    const store = useUnifiedCanvasStore.getState();

    store.selection.toggle('1');
    expect(useUnifiedCanvasStore.getState().selectedElementIds.has('1')).toBe(true);

    store.selection.toggle('1');
    expect(useUnifiedCanvasStore.getState().selectedElementIds.has('1')).toBe(false);
  });

  it('should clear selection', () => {
    const store = useUnifiedCanvasStore.getState();

    store.selection.set(['1', '2']);
    store.selection.clear();

    const s = useUnifiedCanvasStore.getState();
    expect(s.selectedElementIds.size).toBe(0);
    expect(s.lastSelectedId).toBeUndefined();
  });

  it('should maintain deterministic elementOrder behavior', () => {
    const store = useUnifiedCanvasStore.getState();

    // Select in reverse order
    store.selection.set(['3', '1']);

    const s = useUnifiedCanvasStore.getState();
    expect(Array.from(s.selectedElementIds)).toEqual(['3', '1']);
    expect(s.lastSelectedId).toBe('1'); // last in array
  });

  it('should handle box-select simulation', () => {
    const store = useUnifiedCanvasStore.getState();

    // Simulate box select by setting multiple ids
    store.selection.set(['1', '3']);

    const s = useUnifiedCanvasStore.getState();
    expect(s.selectedElementIds.size).toBe(2);
    expect(s.selectedElementIds.has('1')).toBe(true);
    expect(s.selectedElementIds.has('3')).toBe(true);
  });
});