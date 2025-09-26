import { fireEvent, render, waitFor } from '@testing-library/react';
import FigJamCanvas from '../components/FigJamCanvas';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import type { CanvasElement } from '../../../../types';

function getStageCanvas(container: HTMLElement) {
  return container.querySelector('canvas');
}

test('Selecting and transforming an element updates store and UI correctly', async () => {
  const { getByTestId } = render(<FigJamCanvas />);
  const stageContainer = getByTestId('konva-stage-container');

  await waitFor(() => {
    const canvas = getStageCanvas(stageContainer);
    expect(canvas).toBeTruthy();
  });

  const store = useUnifiedCanvasStore.getState();
  const shape: CanvasElement = {
    id: 'shape1',
    type: 'rectangle',
    x: 50,
    y: 50,
    width: 20,
    height: 20,
  };
  const elementId = store.element.upsert(shape);

  const canvas = getStageCanvas(stageContainer)!;
  fireEvent.pointerDown(canvas, { clientX: 55, clientY: 55 });
  fireEvent.pointerUp(canvas);

  expect(store.selectedElementIds.has(elementId)).toBe(true);

  store.selection.beginTransform();
  store.element.update(elementId, { width: 40, height: 40 });
  store.selection.endTransform();

  expect(store.elements.get(elementId)?.width).toBe(40);

  store.history.undo();
  expect(store.elements.get(elementId)?.width).toBe(20);
});
