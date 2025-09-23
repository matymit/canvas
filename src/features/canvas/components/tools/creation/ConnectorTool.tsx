// Connector tool with endpoint snapping, preview, and line/arrow variants
import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import type { AnchorSide } from "../../../types/connector";
import type { ConnectorElement } from "../../../types/connector";
import { findNearestAnchor } from "../../../utils/anchors/AnchorSnapping";

export interface ConnectorToolLayers {
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

type StageRef = React.RefObject<Konva.Stage | null>;

export interface ConnectorToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string;
  layers?: ConnectorToolLayers;
}

const DEFAULT_STYLE = {
  stroke: "#111827",
  strokeWidth: 2,
  rounded: true,
  arrowSize: 10,
  opacity: 1,
};

export const ConnectorTool: React.FC<ConnectorToolProps> = ({
  isActive,
  stageRef,
  toolId = "connector-line",
  layers,
}) => {
  const selectedTool = useUnifiedCanvasStore(
    (s) => s.selectedTool ?? s.ui?.selectedTool,
  );
  const setTool = useUnifiedCanvasStore(
    (s) => s.setSelectedTool ?? s.ui?.setSelectedTool,
  );
  const upsertElement = useUnifiedCanvasStore((s) => s.element?.upsert);
  const selectOnly = useUnifiedCanvasStore((s) => s.selection?.selectOne);
  const begin = useUnifiedCanvasStore((s) => s.history?.beginBatch);
  const end = useUnifiedCanvasStore((s) => s.history?.endBatch);

  const ref = useRef<{
    start: { x: number; y: number } | null;
    startSnap: { elementId: string; side: AnchorSide } | null;
    preview: Konva.Shape | null;
    toolInstance: any; // Store tool instance for global access
  }>({ start: null, startSnap: null, preview: null, toolInstance: null });

  // Helper to list candidate nodes (main-layer nodes) for snapping
  const getCandidates = (stage: Konva.Stage): Konva.Node[] => {
    const mainLayer = layers?.main ?? (stage.getLayers()[2] as Konva.Layer | undefined);
    if (!mainLayer) return [];
    // Include ellipse/circle nodes so connectors attach to circles
    return mainLayer.find<Konva.Node>("Group, Rect, Ellipse, Circle, Image, Text");
  };

  // REMOVED: getPortsByAbsoluteTransform - now using unified PortHoverModule system

  // REMOVED: showPortsForElement - now using unified PortHoverModule system

  // REMOVED: hideAllPorts - now using unified PortHoverModule system

  useEffect(() => {
    try {
      const stage = stageRef.current;
      const active = isActive && selectedTool === toolId;
      if (!stage || !active) return;
      if (!layers?.main || !layers?.preview || !layers?.overlay) return;

      // Deselect all elements when connector tool activates
      try {
        const s = useUnifiedCanvasStore.getState();
        if (s.setSelection) s.setSelection([]);
        else if (s.selection?.clear) s.selection.clear();
      } catch {
        // Ignore errors during selection clearing
      }

      const previewLayer = layers.preview;
      const isArrow = toolId === "connector-arrow";

      // CRITICAL FIX: Handle port clicks from PortHoverModule
      const handlePortClick = (port: any, _e: any) => {
        console.debug('[ConnectorTool] Port clicked:', port);

        // Initialize drawing from this port
        ref.current.start = { x: port.position.x, y: port.position.y };
        ref.current.startSnap = { elementId: port.elementId, side: port.anchor };

        const isArrow = toolId === 'connector-arrow';
        const s = ref.current.start!;
        const shape = isArrow
          ? new Konva.Arrow({
              points: [s.x, s.y, s.x, s.y],
              stroke: DEFAULT_STYLE.stroke,
              strokeWidth: DEFAULT_STYLE.strokeWidth,
              pointerLength: DEFAULT_STYLE.arrowSize,
              pointerWidth: DEFAULT_STYLE.arrowSize * 0.7,
              lineCap: DEFAULT_STYLE.rounded ? 'round' : 'butt',
              lineJoin: DEFAULT_STYLE.rounded ? 'round' : 'miter',
              opacity: DEFAULT_STYLE.opacity,
              listening: false,
              perfectDrawEnabled: false,
              shadowForStrokeEnabled: false,
              name: 'connector-preview',
            })
          : new Konva.Line({
              points: [s.x, s.y, s.x, s.y],
              stroke: DEFAULT_STYLE.stroke,
              strokeWidth: DEFAULT_STYLE.strokeWidth,
              lineCap: DEFAULT_STYLE.rounded ? 'round' : 'butt',
              lineJoin: DEFAULT_STYLE.rounded ? 'round' : 'miter',
              opacity: DEFAULT_STYLE.opacity,
              listening: false,
              perfectDrawEnabled: false,
              shadowForStrokeEnabled: false,
              name: 'connector-preview',
            });
        ref.current.preview = shape;
        previewLayer.add(shape);
        previewLayer.batchDraw();
      };

      // Register this tool instance globally for PortHoverModule integration
      (window as any).activeConnectorTool = {
        handlePortClick: handlePortClick
      };
      ref.current.toolInstance = (window as any).activeConnectorTool;

      // Force crosshair cursor while tool is active
      try {
        stage.container().style.cursor = 'crosshair';
      } catch {
        // Ignore cursor setting errors
      }

    const onPointerMove = () => {
      if (ref.current.start) {
        const start = ref.current.start;
        const ghost = ref.current.preview;
        if (!start || !ghost) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        const end = { x: pos.x, y: pos.y };
        if (ghost instanceof Konva.Arrow) {
          ghost.points([start.x, start.y, end.x, end.y]);
        } else if (ghost instanceof Konva.Line) {
          ghost.points([start.x, start.y, end.x, end.y]);
        }
        previewLayer.batchDraw();
      }
      // REMOVED: Port hover handling - now managed by PortHoverModule
    };

    const onPointerDown = (evt: Konva.KonvaEventObject<PointerEvent>) => {
      // If pointer down originated from a port hit area, do not start new connector
      const targetName = evt?.target?.name?.() || '';
      if (targetName.startsWith('port-hit-') || evt?.target?.getParent?.()?.name?.() === 'connector-endpoints') {
        return;
      }

      const pos = stage.getPointerPosition();
      if (!pos) return;
      // REMOVED: hideAllPorts(stage) - managed by PortHoverModule

      const candidates = getCandidates(stage);
      const snap = findNearestAnchor(pos, candidates, {
        pixelThreshold: 12,
        includeCenter: true,
      });

      const start = snap ? { x: snap.x, y: snap.y } : { x: pos.x, y: pos.y };
      ref.current.start = start;
      ref.current.startSnap = snap
        ? { elementId: snap.elementId, side: snap.side }
        : null;

      const shape = isArrow
        ? new Konva.Arrow({
            points: [start.x, start.y, start.x, start.y],
            stroke: DEFAULT_STYLE.stroke,
            strokeWidth: DEFAULT_STYLE.strokeWidth,
            pointerLength: DEFAULT_STYLE.arrowSize,
            pointerWidth: DEFAULT_STYLE.arrowSize * 0.7,
            lineCap: DEFAULT_STYLE.rounded ? "round" : "butt",
            lineJoin: DEFAULT_STYLE.rounded ? "round" : "miter",
            opacity: DEFAULT_STYLE.opacity,
            listening: false,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            name: "connector-preview",
          })
        : new Konva.Line({
            points: [start.x, start.y, start.x, start.y],
            stroke: DEFAULT_STYLE.stroke,
            strokeWidth: DEFAULT_STYLE.strokeWidth,
            lineCap: DEFAULT_STYLE.rounded ? "round" : "butt",
            lineJoin: DEFAULT_STYLE.rounded ? "round" : "miter",
            opacity: DEFAULT_STYLE.opacity,
            listening: false,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            name: "connector-preview",
          });

      ref.current.preview = shape;
      previewLayer.add(shape);
      previewLayer.batchDraw();
    };

    const commit = (
      startPoint: { x: number; y: number },
      startSnap: { elementId: string; side: AnchorSide } | null,
      endPoint: { x: number; y: number },
      endSnap: { elementId: string; side: AnchorSide } | null,
    ) => {
      // CRITICAL FIX: Always try to attach to elements to prevent zoom coordinate corruption
      const candidates = getCandidates(stage);

      // For start point: use explicit snap if available, otherwise try aggressive search
      let fromEndpoint: ConnectorElement["from"];
      if (startSnap) {
        fromEndpoint = { kind: "element", elementId: startSnap.elementId, anchor: startSnap.side };
      } else {
        // Try aggressive search with larger threshold to find any nearby element
        const aggressiveStartSnap = findNearestAnchor(startPoint, candidates, {
          pixelThreshold: 50, // Much larger threshold for fallback attachment
          includeCenter: true,
        });
        fromEndpoint = aggressiveStartSnap
          ? { kind: "element", elementId: aggressiveStartSnap.elementId, anchor: aggressiveStartSnap.side }
          : { kind: "point", x: startPoint.x, y: startPoint.y }; // Only as last resort
      }

      // For end point: use explicit snap if available, otherwise try aggressive search
      let toEndpoint: ConnectorElement["to"];
      if (endSnap) {
        toEndpoint = { kind: "element", elementId: endSnap.elementId, anchor: endSnap.side };
      } else {
        // Try aggressive search with larger threshold to find any nearby element
        const aggressiveEndSnap = findNearestAnchor(endPoint, candidates, {
          pixelThreshold: 50, // Much larger threshold for fallback attachment
          includeCenter: true,
        });
        toEndpoint = aggressiveEndSnap
          ? { kind: "element", elementId: aggressiveEndSnap.elementId, anchor: aggressiveEndSnap.side }
          : { kind: "point", x: endPoint.x, y: endPoint.y }; // Only as last resort
      }

      const from = fromEndpoint;
      const to = toEndpoint;

      const variant = isArrow ? "arrow" : "line";
      begin?.("create-connector");

      const id = crypto?.randomUUID?.() || `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const element: ConnectorElement = {
        id,
        type: "connector",
        variant,
        from,
        to,
        style: DEFAULT_STYLE,
        x: 0,
        y: 0,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
      };

      let elementId: string | undefined = id;
      if (upsertElement) elementId = upsertElement(element);
      end?.(true);

      if ((elementId || id) && selectOnly) selectOnly(elementId || id);
      setTool?.("select");

      // Hide any hover ports after successful connection
      try {
        const portHoverModule = (window as any).portHoverModule;
        if (portHoverModule?.hideNow) {
          portHoverModule.hideNow();
        }
      } catch {
        // Ignore errors during port module cleanup
      }
    };

    const onPointerUp = () => {
      const start = ref.current.start;
      const startSnap = ref.current.startSnap;
      const ghost = ref.current.preview;
      const pos = stage.getPointerPosition();

      if (!pos || !start) {
        if (ghost) {
          try { ghost.destroy(); } catch {}
          ref.current.preview = null;
          previewLayer.batchDraw();
        }
        ref.current.start = null;
        ref.current.startSnap = null;
        return;
      }

      const candidates = getCandidates(stage);
      const snap = findNearestAnchor(pos, candidates, { pixelThreshold: 12, includeCenter: true });
      const endPoint = snap ? { x: snap.x, y: snap.y } : { x: pos.x, y: pos.y };
      const endSnap = snap ? { elementId: snap.elementId, side: snap.side } : null;

      if (ghost) {
        try { ghost.destroy(); } catch {}
        ref.current.preview = null;
        previewLayer.batchDraw();
      }

      commit(start, startSnap, endPoint, endSnap);
      ref.current.start = null;
      ref.current.startSnap = null;
    };

      stage.on("pointerdown.connector", onPointerDown);
      stage.on("pointermove.connector", onPointerMove);
      stage.on("pointerup.connector", onPointerUp);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const g = ref.current.preview;
        if (g) {
          try {
            g.destroy();
          } catch {
            // Ignore preview destruction errors
          }
          ref.current.preview = null;
          previewLayer.batchDraw();
        }
        ref.current.start = null;
        ref.current.startSnap = null;
        setTool?.("select");
      }
    };
      window.addEventListener("keydown", onKeyDown);

      return () => {
        stage.off("pointerdown.connector", onPointerDown);
        stage.off("pointermove.connector", onPointerMove);
        stage.off("pointerup.connector", onPointerUp);
        window.removeEventListener("keydown", onKeyDown);

        // Clean up global registration
        if ((window as any).activeConnectorTool === ref.current.toolInstance) {
          (window as any).activeConnectorTool = null;
        }

        const g = ref.current.preview;
        if (g) {
          try {
            g.destroy();
          } catch {
            // Ignore preview destruction errors
          }
          ref.current.preview = null;
          previewLayer.batchDraw();
        }
        ref.current.start = null;
        ref.current.startSnap = null;
        try {
          stage.container().style.cursor = '';
        } catch {
          // Ignore cursor cleanup errors
        }
      };
    } catch (e) {
      console.error('[ConnectorTool] Fatal error during activation', e);
      return;
    }
  }, [isActive, selectedTool, toolId, stageRef, upsertElement, selectOnly, begin, end, setTool, layers]);

  return null;
};

export default ConnectorTool;
