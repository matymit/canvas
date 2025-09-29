// Debug test for connector dragging issue
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import { CanvasElement } from '../types/elements';

// Mock the MarqueeSelectionTool to test connector dragging
describe('Connector Drag Debug', () => {
  let store: ReturnType<typeof createUnifiedCanvasStore>;

  beforeEach(() => {
    store = createUnifiedCanvasStore();
  });

  it('should correctly calculate connector positions during drag', () => {
    // Create test elements - a mindmap node and a connector
    const mindmapNode: CanvasElement = {
      id: 'mindmap-1',
      type: 'mindmap-node',
      x: 100,
      y: 100,
      width: 120,
      height: 40,
      text: 'Test Node',
      created: Date.now(),
      modified: Date.now(),
    };

    const connector: CanvasElement = {
      id: 'connector-1', 
      type: 'connector',
      x: 0, // Connectors typically have x:0, y:0 in store
      y: 0,
      created: Date.now(),
      modified: Date.now(),
      from: { kind: 'point', x: 50, y: 50 },
      to: { kind: 'point', x: 200, y: 200 },
    };

    // Add elements to store
    store.getState().element.upsert(mindmapNode);
    store.getState().element.upsert(connector);

    // Simulate the marquee selection base position calculation
    const connectorCenter = {
      x: (connector.from.x + connector.to.x) / 2, // Should be 125
      y: (connector.from.y + connector.to.y) / 2, // Should be 125
    };

    console.log('Connector center calculated:', connectorCenter);
    console.log('Expected center: {x: 125, y: 125}');

    // Test base position capture (what MarqueeSelectionTool does)
    const basePositions = new Map();
    basePositions.set('mindmap-1', { x: mindmapNode.x, y: mindmapNode.y });
    basePositions.set('connector-1', connectorCenter); // This is what the tool should capture

    // Simulate a drag delta
    const dragDelta = { dx: 50, dy: 30 };

    // Calculate final positions
    const mindmapFinalPos = {
      x: basePositions.get('mindmap-1').x + dragDelta.dx, // 150
      y: basePositions.get('mindmap-1').y + dragDelta.dy, // 130
    };

    const connectorFinalCenter = {
      x: basePositions.get('connector-1').x + dragDelta.dx, // 175
      y: basePositions.get('connector-1').y + dragDelta.dy, // 155
    };

    // For connectors, we need to apply the delta to both endpoints
    const expectedConnectorEndpoints = {
      from: {
        x: connector.from.x + dragDelta.dx, // 100
        y: connector.from.y + dragDelta.dy, // 80
      },
      to: {
        x: connector.to.x + dragDelta.dx, // 250
        y: connector.to.y + dragDelta.dy, // 230
      },
    };

    console.log('Base positions:', Object.fromEntries(basePositions));
    console.log('Drag delta:', dragDelta);
    console.log('Expected mindmap final position:', mindmapFinalPos);
    console.log('Expected connector final center:', connectorFinalCenter);
    console.log('Expected connector endpoints:', expectedConnectorEndpoints);

    // Verify calculations are correct
    expect(connectorCenter.x).toBe(125);
    expect(connectorCenter.y).toBe(125);
    expect(connectorFinalCenter.x).toBe(175);
    expect(connectorFinalCenter.y).toBe(155);
    expect(expectedConnectorEndpoints.from.x).toBe(100);
    expect(expectedConnectorEndpoints.to.x).toBe(250);
  });

  it('should debug why delta calculation shows {dx: 0, dy: 0}', () => {
    // This test specifically tries to reproduce the delta calculation issue
    const connector: CanvasElement = {
      id: 'connector-debug',
      type: 'connector',
      x: 0,
      y: 0,
      created: Date.now(),
      modified: Date.now(),
      from: { kind: 'point', x: 840, y: 319.5 },
      to: { kind: 'point', x: 925.5, y: 346.5 },
    };

    store.getState().element.upsert(connector);

    // Calculate center (what MarqueeSelectionTool calculates)
    const center = {
      x: (connector.from.x + connector.to.x) / 2,
      y: (connector.from.y + connector.to.y) / 2,
    };

    console.log('Debug connector center:', center);
    console.log('Should be approximately {x: 882.75, y: 333}');

    // Simulate what the code logs show - base position captured as center
    const basePosition = center;
    
    // Simulate drag to new position  
    const startPoint = { x: 100, y: 100 }; // Where drag started
    const endPoint = { x: 200, y: 150 }; // Where drag ended
    
    // This is what onPointerUp calculates as finalDelta
    const finalDelta = {
      dx: endPoint.x - startPoint.x, // 100
      dy: endPoint.y - startPoint.y, // 50
    };

    console.log('Start point:', startPoint);
    console.log('End point:', endPoint);
    console.log('Final delta:', finalDelta);

    // The issue might be in how we relate the drag start/end points 
    // to the connector's base position
    
    // Expected: connector should move by finalDelta
    const expectedNewCenter = {
      x: basePosition.x + finalDelta.dx,
      y: basePosition.y + finalDelta.dy,
    };

    console.log('Expected new center:', expectedNewCenter);

    expect(finalDelta.dx).toBe(100);
    expect(finalDelta.dy).toBe(50);
    expect(finalDelta.dx).not.toBe(0); // This should NOT be 0
    expect(finalDelta.dy).not.toBe(0); // This should NOT be 0
  });
});