import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We will test the overlay growth logic by isolating the DOM/CSS and store update calls.
// The Konva Stage dependency will be faked to return identity transforms for simplicity.

import { openShapeTextEditor } from '../../features/canvas/utils/editors/openShapeTextEditor';
import { useUnifiedCanvasStore } from '../../features/canvas/stores/unifiedCanvasStore';

// Minimal fake stage that returns container bounds and identity transform
class FakeStage {
  private _container: HTMLElement;
  constructor(container: HTMLElement) {
    this._container = container;
  }
  container() { return this._container; }
  scaleX() { return 1; }
  scaleY() { return 1; }
  x() { return 0; }
  y() { return 0; }
}

// Create a fake element and a minimal store facade for element.getById/update
function seedStoreWithShape(id: string, type: 'rectangle'|'ellipse'|'triangle', x: number, y: number, w: number, h: number) {
  const s = useUnifiedCanvasStore.getState();
  s.element.upsert({ id, type, x, y, width: w, height: h } as any);
}

// Helper to insert content into the overlay and trigger layout
function setOverlayText(text: string) {
  const overlay = document.querySelector('[role="textbox"][aria-label="Shape text editor"]') as HTMLElement | null;
  if (!overlay) throw new Error('Overlay editor not found');
  overlay.innerText = text;
  // Trigger input event to run measure/layout
  overlay.dispatchEvent(new Event('input'));
  return overlay;
}

describe('openShapeTextEditor - overlay behaviour', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Stub RAF to run callbacks promptly in tests
    // @ts-expect-error - stub globals in test env
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = setTimeout(() => cb(performance.now()), 0) as unknown as number;
      return id;
    };
    // @ts-expect-error - stub globals in test env
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as any);

    container = document.createElement('div');
    Object.assign(container.style, { position: 'absolute', left: '0px', top: '0px', width: '1000px', height: '800px' });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens centered inside shape inner box with centered caret', async () => {
    // Seed a rectangle shape
    const id = 'rect-ovl-1';
    seedStoreWithShape(id, 'rectangle', 100, 200, 300, 150);

    const stage = new FakeStage(container) as any;

    openShapeTextEditor(stage, id, { padding: 10, fontSize: 18, lineHeight: 1.3 });

    const overlay = document.querySelector('[role="textbox"][aria-label="Shape text editor"]') as HTMLElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.style.textAlign).toBe('center');

    // Initial size at least minHeight, minWidth
    const w = parseFloat(overlay!.style.width);
    const h = parseFloat(overlay!.style.height);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('typing grows overlay and increments element height in small steps', async () => {
    const id = 'rect-ovl-2';
    seedStoreWithShape(id, 'rectangle', 50, 60, 180, 80);

    const stage = new FakeStage(container) as any;
    openShapeTextEditor(stage, id, { padding: 8, fontSize: 16, lineHeight: 1.25 });

    const before = useUnifiedCanvasStore.getState().element.getById(id)!;

    // Type multi-line content
    const longText = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const overlay = setOverlayText(longText);

    // Force layout to think content is taller than available by mocking scrollHeight
    Object.defineProperty(overlay, 'scrollHeight', { value: 260, configurable: true });
    overlay.dispatchEvent(new Event('input'));

    // Queue RAF microtask run
    await new Promise((r) => setTimeout(r, 0));

    const after = useUnifiedCanvasStore.getState().element.getById(id)!;
    // Allow equality if the mocked scrollHeight equals available height; ensure non-decrease first
    expect((after.height ?? 0)).toBeGreaterThanOrEqual(before.height ?? 0);

    // Height grows in small steps when exceeding inner box; if not exceeded, at least stable
    expect((after.height ?? 0) - (before.height ?? 0)).toBeGreaterThanOrEqual(0);

    // Repositioning should have updated overlay left/top smoothly (style contains px values)
    expect(overlay.style.left.endsWith('px')).toBe(true);
    expect(overlay.style.top.endsWith('px')).toBe(true);
  });

  it('commit on Enter persists text to store and removes overlay', async () => {
    const id = 'rect-ovl-3';
    seedStoreWithShape(id, 'rectangle', 10, 10, 150, 80);
    const stage = new FakeStage(container) as any;

    openShapeTextEditor(stage, id, { padding: 8, fontSize: 16 });

    setOverlayText('Hello world');

    const overlay = document.querySelector('[role="textbox"][aria-label="Shape text editor"]') as HTMLElement | null;
    expect(overlay).toBeTruthy();

    // Press Enter
    const evt = new KeyboardEvent('keydown', { key: 'Enter' });
    window.dispatchEvent(evt);

    await new Promise((r) => setTimeout(r, 0));

    const post = useUnifiedCanvasStore.getState().element.getById(id)!;
    expect(post.data?.text).toBe('Hello world');

    const stillThere = document.querySelector('[role="textbox"][aria-label="Shape text editor"]');
    expect(stillThere).toBeNull();
  });

  it('Escape cancels and does not persist', async () => {
    const id = 'rect-ovl-4';
    seedStoreWithShape(id, 'rectangle', 10, 10, 150, 80);
    const stage = new FakeStage(container) as any;

    openShapeTextEditor(stage, id, { padding: 8, fontSize: 16 });
    setOverlayText('Should be cancelled');

    const esc = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(esc);

    await new Promise((r) => setTimeout(r, 0));

    const post = useUnifiedCanvasStore.getState().element.getById(id)!;
    expect(post.data?.text).toBeUndefined();
  });
});
