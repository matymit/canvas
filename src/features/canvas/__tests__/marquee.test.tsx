import { render, fireEvent } from '@testing-library/react';
import FigJamCanvas from '../components/FigJamCanvas';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';

describe('Marquee Selection', () => {
  it('should drag connectors and mindmap nodes with marquee selection', async () => {
    const { getByTestId } = render(<FigJamCanvas />);
    const stage = getByTestId('konva-stage');

    // 1. Add a connector and a mindmap node to the store
    const store = useUnifiedCanvasStore.getState();
    const connectorId = store.element.upsert({
      id: 'connector1',
      type: 'connector',
      from: { kind: 'point', x: 100, y: 100 },
      to: { kind: 'point', x: 200, y: 200 },
    });
    const mindmapNodeId = store.element.upsert({
      id: 'mindmap-node1',
      type: 'mindmap-node',
      x: 300,
      y: 300,
      width: 100,
      height: 50,
      text: 'Mindmap Node',
    });

    // 2. Simulate marquee selection
    fireEvent.mouseDown(stage, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(stage, { clientX: 400, clientY: 400 });
    fireEvent.mouseUp(stage);

    // 3. Assert that the connector and mindmap node are selected
    const { selectedElementIds } = useUnifiedCanvasStore.getState();
    expect(selectedElementIds.has(connectorId)).toBe(true);
    expect(selectedElementIds.has(mindmapNodeId)).toBe(true);

    // 4. Simulate drag
    fireEvent.dragStart(stage, { clientX: 350, clientY: 350 });
    fireEvent.drag(stage, { clientX: 450, clientY: 450 });
    fireEvent.dragEnd(stage);

    // 5. Assert that the connector and mindmap node have moved
    const movedConnector = store.elements.get(connectorId);
    const movedMindmapNode = store.elements.get(mindmapNodeId);

    expect(movedConnector.from.x).toBe(200);
    expect(movedConnector.from.y).toBe(200);
    expect(movedConnector.to.x).toBe(300);
    expect(movedConnector.to.y).toBe(300);

    expect(movedMindmapNode.x).toBe(400);
    expect(movedMindmapNode.y).toBe(400);
  });
});
