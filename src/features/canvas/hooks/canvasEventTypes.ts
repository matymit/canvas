/**
 * Canvas event types and interfaces
 */
import type React from 'react';
import type Konva from 'konva';

export type CanvasEventType =
  | 'pointerdown'
  | 'pointermove'
  | 'pointerup'
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'wheel'
  | 'keydown'
  | 'keyup'
  | 'dragstart'
  | 'dragmove'
  | 'dragend';

export type CanvasEventHandler<T = unknown> = (evt: T) => boolean | void;

export interface CanvasLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export interface CanvasEventContextValue {
  // Stable refs for orchestration
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  layersRef: React.MutableRefObject<CanvasLayers | null>;

  // Register Konva stage & layers after setup
  setStage(stage: Konva.Stage | null): void;
  setLayers(layers: CanvasLayers | null): void;

  // Lightweight event bus (for tools and cross-module comms)
  on(type: CanvasEventType, handler: CanvasEventHandler): () => void;
  off(type: CanvasEventType, handler: CanvasEventHandler): void;
  emit<T = unknown>(type: CanvasEventType, evt: T): boolean;

  // Tool-oriented helpers
  setActiveTool(toolId: string): void;
  getActiveTool(): string;
}