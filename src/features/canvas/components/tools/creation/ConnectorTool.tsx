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
    portDots: Konva.Circle[];
    hoveredElementId: string | null;
  }>({ start: null, startSnap: null, preview: null, portDots: [], hoveredElementId: null });

  // Helper to list candidate nodes (main-layer nodes) for snapping
  const getCandidates = (stage: Konva.Stage): Konva.Node[] => {
    const mainLayer = layers?.main ?? (stage.getLayers()[2] as Konva.Layer | undefined);
    if (!mainLayer) return [];
    return mainLayer.find<Konva.Node>("Group, Rect, Line, Image, Text");
  };

  // Compute anchor ports by mapping local anchors through absolute transform
  const getPortsByAbsoluteTransform = (node: Konva.Node): Array<{ x: number; y: number; side: AnchorSide }> => {
    // Try to infer local width/height
    const localRect = node.getClientRect({ skipTransform: true });
    const w = localRect.width || (node as any).width?.() || 0;
    const h = localRect.height || (node as any).height?.() || 0;
    const localAnchors: Array<{ x: number; y: number; side: AnchorSide }> = [
      { x: 0, y: h / 2, side: 'left' },
      { x: w, y: h / 2, side: 'right' },
      { x: w / 2, y: 0, side: 'top' },
      { x: w / 2, y: h, side: 'bottom' },
      { x: w / 2, y: h / 2, side: 'center' },
    ];
    const abs = node.getAbsoluteTransform();
    return localAnchors.map(a => {
      const p = abs.point({ x: a.x + localRect.x, y: a.y + localRect.y });
      return { x: p.x, y: p.y, side: a.side };
    });
  };

  // Helper to show connection ports on hover
  const showPortsForElement = (elementId: string, stage: Konva.Stage) => {
    const overlayLayer = layers?.overlay ?? (stage.getLayers()[4] as Konva.Layer | undefined);
    if (!overlayLayer) return;

    // Find the element node
    const candidates = getCandidates(stage);
    const element = candidates.find(node => node.id() === elementId);
    if (!element) return;

    // Clear existing port dots
    ref.current.portDots.forEach(dot => dot.destroy());
    ref.current.portDots = [];

    // Compute transform-aware ports
    const ports = getPortsByAbsoluteTransform(element);

    ports.forEach(port => {
      const dot = new Konva.Circle({
        x: port.x,
        y: port.y,
        radius: 4,
        fill: '#4F46E5',
        stroke: '#FFFFFF',
        strokeWidth: 2,
        opacity: 0.9,
        listening: true,
        perfectDrawEnabled: false,
        name: 'connector-port-dot'
      });

      dot.on('pointerdown', (e) => {
        e.cancelBubble = true;
        // initialize drawing from this port
        ref.current.start = { x: port.x, y: port.y };
        ref.current.startSnap = { elementId, side: port.side } as any;
        const previewLayer = layers?.preview ?? (stage.getLayers()[3] as Konva.Layer | undefined);
        if (!previewLayer) return;
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
      });

      ref.current.portDots.push(dot);
      overlayLayer.add(dot);
    });

    overlayLayer.batchDraw();
  };

  // Helper to hide all port dots
  const hideAllPorts = (stage: Konva.Stage) => {
    ref.current.portDots.forEach(dot => dot.destroy());
    ref.current.portDots = [];
    ref.current.hoveredElementId = null;
    const overlayLayer = layers?.overlay ?? (stage.getLayers()[4] as Konva.Layer | undefined);
    overlayLayer?.batchDraw();
  };

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    // Deselect all elements when connector tool activates
    try {
      const s = useUnifiedCanvasStore.getState();
      if (s.setSelection) s.setSelection([]);
      else if (s.selection?.clear) s.selection.clear();
    } catch {}

    const previewLayer = layers?.preview ?? (stage.getLayers()[3] as Konva.Layer | undefined);
    if (!previewLayer) return;

    const isArrow = toolId === "connector-arrow";

    // Cache candidate nodes once on activation to avoid per-move queries
    const cachedCandidates = getCandidates(stage);

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
      } else {
        const pos = stage.getPointerPosition();
        if (!pos) return;

        // Prefer Konva hit graph for fast lookup
        let hit: Konva.Node | null = stage.getIntersection(pos) as Konva.Node | null;
        while (hit && hit.className !== 'Group') hit = hit.getParent();
        let hoveredId = hit?.id() || null;

        // Fallback: scan cached groups if no hit
        if (!hoveredId) {
          for (const candidate of cachedCandidates) {
            const rect = candidate.getClientRect({ skipStroke: true, skipShadow: true, relativeTo: stage });
            if (pos.x >= rect.x && pos.x <= rect.x + rect.width && pos.y >= rect.y && pos.y <= rect.y + rect.height) {
              hoveredId = candidate.id();
              break;
            }
          }
        }
        if (hoveredId !== ref.current.hoveredElementId) {
          if (hoveredId) showPortsForElement(hoveredId, stage);
          else hideAllPorts(stage);
          ref.current.hoveredElementId = hoveredId;
        }
      }
    };

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;
      hideAllPorts(stage);

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
      const from: ConnectorElement["from"] = startSnap
        ? { kind: "element", elementId: startSnap.elementId, anchor: startSnap.side }
        : { kind: "point", x: startPoint.x, y: startPoint.y };
      const to: ConnectorElement["to"] = endSnap
        ? { kind: "element", elementId: endSnap.elementId, anchor: endSnap.side }
        : { kind: "point", x: endPoint.x, y: endPoint.y };

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
          try { g.destroy(); } catch {}
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
      hideAllPorts(stage);
      const g = ref.current.preview;
      if (g) {
        try { g.destroy(); } catch {}
        ref.current.preview = null;
        previewLayer.batchDraw();
      }
      ref.current.start = null;
      ref.current.startSnap = null;
    };
  }, [isActive, selectedTool, toolId, stageRef, upsertElement, selectOnly, begin, end, setTool, layers]);

  return null;
};

export default ConnectorTool;
