/* @vitest-environment jsdom */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// We will use the real Konva browser build by unmocking the global test mock.
// To ensure this file uses real Konva, we dynamically unmock and import.
let Konva: any;
let ShapeTextRenderer: any;

beforeAll(async () => {
  vi.resetModules();
  vi.doUnmock('konva');
  vi.doUnmock('konva/lib/index.js');
  Konva = (await import('konva')).default;
  ({ ShapeTextRenderer } = await import('../../renderer/modules/ShapeTextRenderer'));
});

// Minimal fake store with subscribe(selector, listener)
function createFakeStore() {
  let state = { elements: new Map<string, any>() };
  let listener: ((current: any, prev: any) => void) | null = null;
  let selector: ((s: any) => any) | null = null;
  return {
    subscribe(sel: any, fn: any) {
      selector = sel; listener = fn; return () => { listener = null; selector = null; };
    },
    emit(nextElements: Map<string, any>) {
      const prev = { ...state };
      state = { elements: nextElements } as any;
      listener?.(selector?.(state), selector?.(prev));
    },
    getState() { return state; }
  };
}

// Build renderer layers using real Konva (no Stage needed for these logic tests)
function createLayers() {
  return {
    background: new Konva.Layer(),
    main: new Konva.Layer(),
    highlighter: new Konva.Layer(),
    preview: new Konva.Layer(),
    overlay: new Konva.Layer(),
  } as const;
}

describe('ShapeTextRenderer', () => {
  let layers: any;
  let store: any;
  let renderer: any;

  beforeEach(() => {
    layers = createLayers();
    store = createFakeStore();
    renderer = new ShapeTextRenderer();
    renderer.mount({ stage: {} as any, layers, store } as any);
  });

  it('creates a Konva.Text inside a root group and batchDraws main on new text', () => {
    // Arrange: a root group on main with id 'el-1'
    const root = new Konva.Group({ id: 'el-1', name: 'shape-root' });
    layers.main.add(root);

    // Spy and neutralize batchDraw to avoid scheduling animations
    const batchSpy = vi.spyOn(layers.main, 'batchDraw').mockImplementation(() => {});

    // Emit element with text
    const elements = new Map<string, any>();
    elements.set('el-1', { id: 'el-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, data: { text: 'Hello', padding: 10 }, style: {} });
    store.emit(elements);

    // Assert: a Text child added with expected dimensions
    const textNode: any = root.findOne('.shape-text');
    expect(textNode).toBeTruthy();
    expect(textNode.text()).toBe('Hello');
    // width/height reflect padding
    expect(textNode.width()).toBe(100 - 20);
    expect(textNode.height()).toBe(50 - 20);

    // trigger another render update
    const elements2 = new Map<string, any>();
    elements2.set('el-1', { id: 'el-1', type: 'rectangle', x: 0, y: 0, width: 120, height: 60, data: { text: 'Hi', padding: 12 }, style: {} });
    store.emit(elements2);
    expect(batchSpy).toHaveBeenCalled();
  });

  it('updates existing Text on element change and removes when text cleared', () => {
    const root = new Konva.Group({ id: 'el-2' });
    layers.main.add(root);

    // Neutralize batchDraw
    vi.spyOn(layers.main, 'batchDraw').mockImplementation(() => {});

    // Initial emit with text
    const e1 = new Map<string, any>();
    e1.set('el-2', { id: 'el-2', type: 'rectangle', x: 0, y: 0, width: 120, height: 60, data: { text: 'Hi', padding: 8 }, style: { fontSize: 18 } });
    store.emit(e1);
    const textNode1: any = root.findOne('.shape-text');
    expect(textNode1).toBeTruthy();

    // Update padding and text content
    const e2 = new Map<string, any>();
    e2.set('el-2', { id: 'el-2', type: 'rectangle', x: 0, y: 0, width: 120, height: 60, data: { text: 'Hello!', padding: 12 }, style: { fontSize: 24, textColor: '#222' } });
    store.emit(e2);
    const textNode2: any = root.findOne('.shape-text');
    expect(textNode2).toBe(textNode1); // updated in place
    expect(textNode2.text()).toBe('Hello!');
    expect(textNode2.width()).toBe(120 - 24);
    expect(textNode2.height()).toBe(60 - 24);

    // Clear text -> remove text node
    const e3 = new Map<string, any>();
    e3.set('el-2', { id: 'el-2', type: 'rectangle', x: 0, y: 0, width: 120, height: 60, data: { text: '' , padding: 12 }, style: {} });
    store.emit(e3);
    const textNode3 = root.findOne('.shape-text');
    expect(textNode3 == null).toBe(true);
  });

  it('wraps non-group root by creating new Group and moving node under it', () => {
    // Start with a Rect node as root
    const rect = new Konva.Rect({ id: 'el-3' });
    layers.main.add(rect);

    // Neutralize batchDraw
    vi.spyOn(layers.main, 'batchDraw').mockImplementation(() => {});

    const e1 = new Map<string, any>();
    e1.set('el-3', { id: 'el-3', type: 'rectangle', x: 0, y: 0, width: 90, height: 40, data: { text: 'Box', padding: 5 }, style: {} });
    store.emit(e1);

    // After render, group named 'shape' should exist and contain both rect and text
    const group: any = layers.main.findOne(`#el-3`) || layers.main.findOne('.shape');
    expect(group).toBeTruthy();
    const textNode = group.findOne('.shape-text');
    // Konva's Group.getChildren() returns a Collection; use .toArray only if available
    const children = (typeof group.getChildren().toArray === 'function') ? group.getChildren().toArray() : group.getChildren();
    const rectUnderGroup = (Array.isArray(children) ? children : Array.from(children)).find((c: any) => c === rect);
    expect(textNode).toBeTruthy();
    expect(rectUnderGroup).toBeTruthy();
  });
});
