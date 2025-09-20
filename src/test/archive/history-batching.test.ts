import { describe, it, expect, beforeEach } from 'vitest';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

// Unit tests focusing on history batching/coalescing and atomic grouping of operations

describe('History batching and coalescing', () => {
  beforeEach(() => {
    // Clear state and history before each test
    const s = useUnifiedCanvasStore.getState();
    s.history.clear();
    // Also clear elements
    useUnifiedCanvasStore.setState({ elements: new Map(), elementOrder: [] }, false);
  });

  it('withUndo groups preview→commit→auto-select in one entry', () => {
    const s = useUnifiedCanvasStore.getState();

    s.history.withUndo('draw rectangle', () => {
      // preview add then final commit (simulate tool behavior)
      const id = 'rect-1';
      s.element.upsert({ id, type: 'rectangle', x: 10, y: 10, width: 50, height: 40 } as any);
      // auto-select
      s.selection.set([id]);
    });

    const root = useUnifiedCanvasStore.getState() as any;
    expect(root.entries.length).toBe(1);
    expect(root.index).toBe(0);
  });

  it('begin/end batch collects multiple ops then coalesces with merge window', () => {
    const s = useUnifiedCanvasStore.getState();
    (s as any).setMergeWindow(500);

    s.history.beginBatch('typing', 'text:rect-2');
    const id = 'rect-2';
    s.element.upsert({ id, type: 'rectangle', x: 0, y: 0, width: 100, height: 60 } as any);
    // simulate multiple update ops as if user typed
    s.element.update(id, { data: { text: 'H' } } as any);
    s.element.update(id, { data: { text: 'He' } } as any);
    s.element.update(id, { data: { text: 'Hel' } } as any);
    s.history.endBatch(true);

    const root = useUnifiedCanvasStore.getState() as any;
    expect(root.entries.length).toBe(1);
    expect(root.entries[0].label).toBe('typing');
  });

  it('push outside batch merges into previous entry within window when label+mergeKey match', async () => {
    const s = useUnifiedCanvasStore.getState() as any;
    s.setMergeWindow(1000);

    // Create an initial entry with a mergeKey using explicit batch
    s.beginBatch('typing', 'typing:rect-3');
    const id = 'rect-3';
    s.element.upsert({ id, type: 'rectangle', x: 0, y: 0, width: 100, height: 60 } as any);
    s.endBatch(true);

    // Push further updates with same semantic key so they coalesce
    const mergeKey = 'typing:rect-3';
    s.push({ type: 'update', before: [], after: [] } as any, 'typing', mergeKey);
    s.push({ type: 'update', before: [], after: [] } as any, 'typing', mergeKey);

    const root = useUnifiedCanvasStore.getState() as any;
    expect(root.entries.length).toBe(1);
    expect(root.index).toBe(0);
    expect(root.entries[0].ops.length).toBeGreaterThanOrEqual(1);
  });

  it('undo/redo apply operations and maintain index', () => {
    const s = useUnifiedCanvasStore.getState();

    s.history.withUndo('add rect', () => {
      s.element.upsert({ id: 'r', type: 'rectangle', x: 5, y: 5, width: 20, height: 10 } as any);
    });

    // After add
    expect((useUnifiedCanvasStore.getState() as any).elements.has('r')).toBe(true);
    expect((useUnifiedCanvasStore.getState() as any).elementOrder.includes('r')).toBe(true);
    expect((useUnifiedCanvasStore.getState() as any).index).toBe(0);

    // Undo
    s.history.undo();
    const s1 = useUnifiedCanvasStore.getState() as any;
    expect(s1.elements.has('r')).toBe(false);
    expect(s1.index).toBe(-1);

    // Redo
    s1.history.redo();
    const s2 = useUnifiedCanvasStore.getState() as any;
    expect(s2.elements.has('r')).toBe(true);
    expect(s2.index).toBe(0);
  });
});
