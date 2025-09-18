import type { CanvasElement } from '../../../../types';

export type ElementId = string;

export type ConnectorType = 'line' | 'arrow';
export type AnchorSide = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface ConnectorEndpointPoint {
  kind: 'point';
  x: number;
  y: number;
}

export interface ConnectorEndpointElement {
  kind: 'element';
  elementId: ElementId;
  anchor: AnchorSide;
  offset?: { dx: number; dy: number };
}

export type ConnectorEndpoint = ConnectorEndpointPoint | ConnectorEndpointElement;

export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  rounded?: boolean;
  arrowSize?: number; // px
  opacity?: number;
}

export interface ConnectorElement extends CanvasElement {
  id: ElementId;
  type: 'connector';
  variant: ConnectorType; // 'line' | 'arrow'
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  style: ConnectorStyle;
  // Optionally cache last computed points
  points?: number[];
}

export default ConnectorElement;