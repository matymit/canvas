// Connector element types with endpoint snapping and line/arrow variants
export type ElementId = string;

export type ConnectorType = 'line' | 'arrow';
export type AnchorSide = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface ConnectorEndpoint {
  kind: 'point' | 'element';
  // For free points
  x?: number;
  y?: number;
  // For element-anchored endpoints
  elementId?: ElementId;
  anchor?: AnchorSide;
  // Optional pixel offset from the anchor point (screen-space, stage coords)
  offset?: { dx: number; dy: number };
}

export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  rounded?: boolean;        // lineCap round, lineJoin round
  arrowSize?: number;       // px, for 'arrow' variant
  opacity?: number;
}

export interface ConnectorElement {
  id: ElementId;
  type: 'connector';
  variant: ConnectorType;   // 'line' | 'arrow'
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  style: ConnectorStyle;
  // Optional future routing (e.g., elbow), not used in this initial straight-line version
  points?: number[];
}

export default ConnectorElement;