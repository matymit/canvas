// useMarqueeState.ts
// Centralized state management for marquee selection tool

import { useRef } from "react";
import type Konva from "konva";
import type { ConnectorElement, ConnectorEndpoint } from "../../../../types/connector";

export type ConnectorDragBaseline = {
  position: { x: number; y: number };
  from?: ConnectorEndpoint;
  to?: ConnectorEndpoint;
};

export type MarqueeState = {
  isSelecting: boolean;
  isDragging: boolean;
  startPoint: { x: number; y: number } | null;
  selectionRect: Konva.Rect | null;
  selectedNodes: Konva.Node[];
  basePositions: Map<string, { x: number; y: number }>;
  persistentSelection: string[];
  originalDraggableStates: Map<string, boolean>;
  connectorBaselines: Map<string, ConnectorDragBaseline>;
  transformInitiated: boolean;
};

/**
 * Clone a connector endpoint for baseline capture
 */
export const cloneEndpoint = (
  endpoint?: ConnectorEndpoint,
): ConnectorEndpoint | undefined => {
  if (!endpoint) return undefined;
  if (endpoint.kind === "point") {
    return { ...endpoint };
  }
  return {
    ...endpoint,
    offset: endpoint.offset ? { ...endpoint.offset } : undefined,
  };
};

/**
 * Check if connector has at least one free (point-based) endpoint
 */
export const connectorHasFreeEndpoint = (connector?: ConnectorElement): boolean => {
  if (!connector) return false;
  return connector.from?.kind === "point" || connector.to?.kind === "point";
};

/**
 * Hook for managing marquee selection state
 * Provides centralized state management with type-safe access
 */
export const useMarqueeState = () => {
  const marqueeRef = useRef<MarqueeState>({
    isSelecting: false,
    isDragging: false,
    startPoint: null,
    selectionRect: null,
    selectedNodes: [],
    basePositions: new Map(),
    persistentSelection: [],
    originalDraggableStates: new Map(),
    connectorBaselines: new Map(),
    transformInitiated: false,
  });

  return {
    marqueeRef,
    // Expose utility functions as part of the hook
    cloneEndpoint,
    connectorHasFreeEndpoint,
  };
};
