import { describe, it, expect, beforeEach } from 'vitest';
import Konva from 'konva';
import { setupRenderer } from '../../renderer';
import { createRendererLayers } from '../../renderer/layers';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

function nextTick() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('Renderer Registry - mounts modules and reconciles nodes', () => {
  let container: HTMLDivElement;
  let stage: Konva.Stage;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '600px';
    container.style.height = '400px';
    document.body.appendChild(container);

    stage = new Konva.Stage({
      container,
      width: 600,
      height: 400,
      listening: true,
    });
  });

  it.skip('mounts all modules and renders text, then removes it; disposer detaches', async () => {
    const layers = createRendererLayers(stage, { listeningPreview: false });

    const dispose = setupRenderer(stage, layers);

    const store = useUnifiedCanvasStore.getState();

    // Upsert a text element
    const t1 = {
      id: 't1',
      type: 'text',
      x: 100,
      y: 120,
      width: 10,
      height: 24,
      text: 'Hello',
      style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18, fill: '#111827' },
    } as any;

    store.element.upsert(t1);
    await nextTick();

    // Should create a Konva.Text with id=t1
    const n = layers.main.findOne(`#t1`);
    expect(n).toBeTruthy();

    // Delete the element, node should be removed
    store.element.delete('t1');
    await nextTick();
    const n2 = layers.main.findOne(`#t1`);
    expect(n2).toBeNull();

    // Dispose registry; further store changes should not render new nodes
    dispose();

    const t2 = { ...t1, id: 't2' };
    store.element.upsert(t2);
    await nextTick();

    const n3 = layers.main.findOne(`#t2`);
    expect(n3).toBeNull();
  });
});