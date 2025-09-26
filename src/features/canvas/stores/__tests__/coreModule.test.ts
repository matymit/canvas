import { create } from 'zustand';
import { createCoreModule } from '../modules/coreModule';
import { createHistoryModule } from '../modules/historyModule';
import { createInteractionModule } from '../modules/interactionModule';
import type { CanvasElement } from '../../../../../types';

describe('UnifiedCanvasStore CoreModule', () => {
  let useStore: ReturnType<typeof create>;

  beforeEach(() => {
    useStore = create((set, get) => ({
      ...createHistoryModule(set, get),
      ...createCoreModule(set, get),
      ...createInteractionModule(set, get),
    }));
  });

  test('adds and retrieves an element', () => {
    const element: CanvasElement = {
      id: 'test1',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    const id = useStore.getState().element.upsert(element);
    const el = useStore.getState().element.getById(id);
    expect(el).toBeDefined();
    expect(el?.id).toBe('test1');
    expect(el?.type).toBe('rectangle');
    expect(useStore.getState().elements.has(id)).toBe(true);
  });

  test('deleteSelected removes all selected elements', () => {
    const elementA: CanvasElement = {
      id: 'test2',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    const elementB: CanvasElement = {
      id: 'test3',
      type: 'ellipse',
      x: 5,
      y: 5,
      width: 8,
      height: 12,
    };
    useStore.getState().element.upsert(elementA);
    useStore.getState().element.upsert(elementB);
    useStore.getState().selection.set(['test2', 'test3']);
    useStore.getState().selection.deleteSelected();
    expect(useStore.getState().elements.size).toBe(0);
    expect(useStore.getState().selectedElementIds.size).toBe(0);

    useStore.getState().history.undo();
    expect(useStore.getState().elements.size).toBe(2);
    expect(useStore.getState().elements.get('test2')).toBeDefined();
    expect(useStore.getState().elements.get('test3')).toBeDefined();
  });

  // Additional tests can be added here for duplicate, ordering, etc.
});
