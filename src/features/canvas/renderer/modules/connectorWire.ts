// Live rerouting integration for connector drag/transform events
import type Konva from 'konva';
import type ConnectorElement from '../../types/connector';
import type { ConnectorRenderer } from './ConnectorRenderer';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';

export interface StoreFacade {
  // Return all connector elements
  getAllConnectors: () => ConnectorElement[];
}

/**
 * Wire connector live routing to stage events for automatic rerouting
 * when connected elements move or transform
 */
export function wireConnectorLiveRouting(
  stage: Konva.Stage,
  renderer: ConnectorRenderer,
  store?: StoreFacade
) {
  const rerouteForNode = (nodeId: string) => {
    let conns: ConnectorElement[] = [];
    
    if (store) {
      conns = store.getAllConnectors();
    } else {
      // Fallback to unified store
      const state = useUnifiedCanvasStore.getState();
      const allElements = state.element?.getAll?.() || Array.from(state.elements?.values?.() || []);
      conns = allElements
        .filter(el => el?.type === 'connector')
        .map(el => ({
          ...el,
          variant: el.data?.variant || 'line',
          from: el.data?.from || { kind: 'point', x: 0, y: 0 },
          to: el.data?.to || { kind: 'point', x: 0, y: 0 },
          style: el.data?.style || { stroke: '#000', strokeWidth: 2 },
        } as unknown as ConnectorElement));
    }
    
    for (const c of conns) {
      const a = c.from.kind === 'element' ? c.from.elementId : null;
      const b = c.to.kind === 'element' ? c.to.elementId : null;
      if (a === nodeId || b === nodeId) {
        renderer.render(c);
      }
    }
  };

  const onNodeDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    const target = e.target as Konva.Node;
    rerouteForNode(target.id());
  };
  
  const onNodeTransform = (e: Konva.KonvaEventObject<Event>) => {
    const target = e.target as Konva.Node;
    rerouteForNode(target.id());
  };

  // Listen to drag and transform events
  stage.on('dragmove.connector-route', onNodeDrag);
  stage.on('transform.connector-route', onNodeTransform);
  stage.on('transformend.connector-route', onNodeTransform);

  // Return cleanup function
  return () => {
    stage.off('dragmove.connector-route', onNodeDrag);
    stage.off('transform.connector-route', onNodeTransform);
    stage.off('transformend.connector-route', onNodeTransform);
  };
}

/**
 * Reroute specific connectors by ID
 */
export function rerouteConnectorsByIds(
  renderer: ConnectorRenderer,
  connectorIds: string[],
  store?: StoreFacade
) {
  let conns: ConnectorElement[] = [];
  
  if (store) {
    conns = store.getAllConnectors();
  } else {
    // Fallback to unified store
    const state = useUnifiedCanvasStore.getState();
    const allElements = state.element?.getAll?.() || Array.from(state.elements?.values?.() || []);
    conns = allElements
      .filter(el => el?.type === 'connector')
      .map(el => ({
        ...el,
        variant: el.data?.variant || 'line',
        from: el.data?.from || { kind: 'point', x: 0, y: 0 },
        to: el.data?.to || { kind: 'point', x: 0, y: 0 },
        style: el.data?.style || { stroke: '#000', strokeWidth: 2 },
      }) as unknown as ConnectorElement);
  }
  
  const targetIds = new Set(connectorIds);
  const targetConnectors = conns.filter(c => targetIds.has(c.id));
  
  targetConnectors.forEach(c => {
    renderer.render(c);
  });
}

/**
 * Reroute all connectors connected to specific node IDs
 */
export function rerouteConnectorsForNodes(
  renderer: ConnectorRenderer,
  nodeIds: string[],
  store?: StoreFacade
) {
  const nodeIdSet = new Set(nodeIds);
  let conns: ConnectorElement[] = [];
  
  if (store) {
    conns = store.getAllConnectors();
  } else {
    // Fallback to unified store
    const state = useUnifiedCanvasStore.getState();
    const allElements = state.element?.getAll?.() || Array.from(state.elements?.values?.() || []);
    conns = allElements
      .filter(el => el?.type === 'connector')
      .map(el => ({
        ...el,
        variant: el.data?.variant || 'line',
        from: el.data?.from || { kind: 'point', x: 0, y: 0 },
        to: el.data?.to || { kind: 'point', x: 0, y: 0 },
        style: el.data?.style || { stroke: '#000', strokeWidth: 2 },
      }) as unknown as ConnectorElement);
  }
  
  const affectedConnectors = conns.filter(c => {
    const fromNode = c.from.kind === 'element' ? c.from.elementId : null;
    const toNode = c.to.kind === 'element' ? c.to.elementId : null;
    return (fromNode && nodeIdSet.has(fromNode)) || (toNode && nodeIdSet.has(toNode));
  });
  
  affectedConnectors.forEach(c => {
    renderer.render(c);
  });
}