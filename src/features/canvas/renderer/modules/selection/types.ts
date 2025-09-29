import type Konva from "konva";
import type {
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorEndpointPoint,
} from "@features/canvas/types/connector";
import type {
  MindmapEdgeElement,
  MindmapNodeElement,
} from "@features/canvas/types/mindmap";

export interface ConnectorSnapshot {
  originalFrom: ConnectorEndpoint;
  originalTo: ConnectorEndpoint;
  startFrom: ConnectorEndpointPoint;
  startTo: ConnectorEndpointPoint;
  wasAnchored: boolean;
  shape?: Konva.Line | Konva.Arrow | null;
  group?: Konva.Group | null;
  groupPosition?: { x: number; y: number };
}

export interface TransformSnapshot {
  basePositions: Map<string, { x: number; y: number }>;
  connectors: Map<string, ConnectorSnapshot>;
  mindmapEdges: Map<string, MindmapEdgeElement>;
  movedMindmapNodes: Set<string>;
  transformerBox?: { x: number; y: number };
}

export type SnapshotBuilder = () => TransformSnapshot | null;

export type ConnectorUpdater = (id: string, changes: Partial<ConnectorElement>) => void;

export type MindmapEdgeRenderer = (
  edge: MindmapEdgeElement,
  getPoint: (id: string, side: "left" | "right") => { x: number; y: number } | null,
) => void;

export type MindmapNodeProjector = (
  nodeId: string,
  baseline: { x: number; y: number } | undefined,
  delta: { dx: number; dy: number },
) => MindmapNodeElement | null;

export interface MindmapSnapshot {
  edges: Map<string, MindmapEdgeElement>;
  mindmapNodes: Set<string>;
}
