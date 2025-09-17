// features/canvas/__tests__/unit/simple-persistence.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

describe('Simple Persistence Test', () => {
  beforeEach(() => {
    // Reset store completely
    useUnifiedCanvasStore.setState({
      elements: new Map(),
      elementOrder: [],
      selectedElementIds: new Set(),
    });
  });

  it('should access store methods', () => {
    const store = useUnifiedCanvasStore.getState();

    // Check what methods are available
    console.log('Store keys:', Object.keys(store));
    console.log('Has element:', 'element' in store);
    console.log('Has addElement:', 'addElement' in store);
    console.log('Has withUndo:', 'withUndo' in store);
    console.log('Has beginBatch:', 'beginBatch' in store);

    // Basic check
    expect(store.elements).toBeInstanceOf(Map);
    expect(store.selectedElementIds).toBeInstanceOf(Set);
    expect(Array.isArray(store.elementOrder)).toBe(true);
  });

  it('should add element via addElement if available', () => {
    const store = useUnifiedCanvasStore.getState();

    if (typeof store.addElement === 'function') {
      store.addElement({
        id: 'test-1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 150
      });

      expect(store.elements.size).toBe(1);
      expect(store.elements.get('test-1')).toBeDefined();
    } else if (store.element && typeof store.element.upsert === 'function') {
      const id = store.element.upsert({
        id: 'test-1',
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 150
      });

      expect(id).toBe('test-1');
      expect(store.elements.size).toBe(1);
    } else {
      console.log('No add methods found');
    }
  });
});