// features/canvas/stores/modules/edgeModule.ts
import { nanoid } from 'nanoid';
import type { StoreSlice } from './types';
import type { ElementId } from '../../../../../types/index';

export type ConnectorId = string;

export interface ConnectorEndpoint {
  elementId?: ElementId;
  x: number;
  y: number;
  anchorType?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

export interface ConnectorElement {
  id: ConnectorId;
  type: 'connector';
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    dash?: number[];
  };
}

export interface EdgeModule {
  addEdge: (
    edge: Omit<ConnectorElement, 'id'> & Partial<Pick<ConnectorElement, 'id'>>
  ) => ConnectorId;
  updateEdge: (
    id: ConnectorId,
    patch:
      | Partial<ConnectorElement>
      | ((current: ConnectorElement) => ConnectorElement)
  ) => void;
  removeEdge: (id: ConnectorId) => void;
  setEdgeEndpoint: (
    id: ConnectorId,
    which: 'start' | 'end',
    endpoint: ConnectorEndpoint
  ) => void;
  getEdgesForElement: (elementId: ElementId) => ConnectorElement[];
}

export const createEdgeModule: StoreSlice<EdgeModule> = (set, get) => ({
  addEdge: (edgeInput: Omit<ConnectorElement, 'id'> & Partial<Pick<ConnectorElement, 'id'>>) => {
    const id = (edgeInput as any).id ?? (nanoid() as unknown as ConnectorId);
    const edge = { ...edgeInput, id } as ConnectorElement;

    set((state) => {
      const current = state as any;
      const nextEdges = new Map<ConnectorId, ConnectorElement>(
        current.edges ?? []
      );
      nextEdges.set(id, edge);
      current.edges = nextEdges;
    });
    return id;
  },

  updateEdge: (id: ConnectorId, patch: Partial<ConnectorElement> | ((current: ConnectorElement) => ConnectorElement)) => {
    set((state) => {
      const current = state as any;
      const edges = current.edges as Map<ConnectorId, ConnectorElement> | undefined;
      if (!edges || !edges.has(id)) return;

      const prev = edges.get(id)!;
      const next =
        typeof patch === 'function' ? (patch as any)(prev) : { ...prev, ...patch };

      const nextEdges = new Map(edges);
      nextEdges.set(id, next);
      current.edges = nextEdges;
    });
  },

  removeEdge: (id: ConnectorId) => {
    set((state) => {
      const current = state as any;
      const edges = current.edges as Map<ConnectorId, ConnectorElement> | undefined;
      if (!edges || !edges.has(id)) return;

      const nextEdges = new Map(edges);
      nextEdges.delete(id);
      current.edges = nextEdges;
    });
  },

  setEdgeEndpoint: (id: ConnectorId, which: 'start' | 'end', endpoint: ConnectorEndpoint) => {
    set((state) => {
      const current = state as any;
      const edges = current.edges as Map<ConnectorId, ConnectorElement> | undefined;
      if (!edges || !edges.has(id)) return;

      const prev = edges.get(id)!;
      const next =
        which === 'start'
          ? ({ ...prev, start: endpoint } as ConnectorElement)
          : ({ ...prev, end: endpoint } as ConnectorElement);

      const nextEdges = new Map(edges);
      nextEdges.set(id, next);
      current.edges = nextEdges;
    });
  },

  getEdgesForElement: (elementId: ElementId) => {
    const current = get() as any;
    const edges = current.edges as Map<ConnectorId, ConnectorElement> | undefined;
    if (!edges) return [];
    const result: ConnectorElement[] = [];
    edges.forEach((edge) => {
      const startEl = (edge as any)?.start?.elementId as ElementId | undefined;
      const endEl = (edge as any)?.end?.elementId as ElementId | undefined;
      if (startEl === elementId || endEl === elementId) result.push(edge);
    });
    return result;
  },
});