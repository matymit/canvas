// Connector tool with endpoint snapping, preview, and line/arrow variants
import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import type { AnchorSide } from "../../../types/connector";
import type { ConnectorElement } from "../../../types/connector";
import { findNearestAnchor } from "../../../utils/anchors/AnchorSnapping";
import { getWorldPointer } from "../../../utils/pointer";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface ConnectorToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string;
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
    // All interactive shapes/groups on main layer
    const layers = stage.getLayers();
    const main = layers[1] as Konva.Layer | undefined; // background(0), main(1), preview(2), overlay(3)
    if (!main) return [];
    return main.find<Konva.Node>("Group, Rect, Line, Image, Text"); // broad; filter as needed
  };

  // Helper to show connection ports on hover
  const showPortsForElement = (elementId: string, stage: Konva.Stage) => {
    const layers = stage.getLayers();
    const overlayLayer = layers[3] as Konva.Layer | undefined; // overlay layer
    if (!overlayLayer) return;

    // Find the element to get its bounds
    const candidates = getCandidates(stage);
    const element = candidates.find(node => node.id() === elementId);
    if (!element) return;

    // Clear existing port dots
    ref.current.portDots.forEach(dot => dot.destroy());
    ref.current.portDots = [];

    const rect = element.getClientRect({ skipStroke: true, skipShadow: true });
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    // Create port positions (left, right, top, bottom, center)
    const ports = [
      { x: rect.x, y: cy, side: 'left' },
      { x: rect.x + rect.width, y: cy, side: 'right' },
      { x: cx, y: rect.y, side: 'top' },
      { x: cx, y: rect.y + rect.height, side: 'bottom' },
      { x: cx, y: cy, side: 'center' }
    ];

    // Create visual port dots
    ports.forEach(port => {
      const dot = new Konva.Circle({
        x: port.x,
        y: port.y,
        radius: 4,
        fill: '#4F46E5',
        stroke: '#FFFFFF',
        strokeWidth: 2,
        opacity: 0.8,
        listening: false,
        perfectDrawEnabled: false,
        name: 'connector-port-dot'
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

    const layers = stage.getLayers();
    const overlayLayer = layers[3] as Konva.Layer | undefined;
    if (overlayLayer) {
      overlayLayer.batchDraw();
    }
  };

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    // Ref value will be captured in cleanup function

    const layers = stage.getLayers();
    const previewLayer = layers[layers.length - 2] as Konva.Layer | undefined; // preview
    if (!previewLayer) return;

    const isArrow = toolId === "connector-arrow";

    // FIXED: Add hover detection for port display
    const onPointerMove = () => {
      if (ref.current.start) {
        // Drawing mode - update preview line
        const start = ref.current.start;
        const ghost = ref.current.preview;
        if (!start || !ghost) return;

        const pos = getWorldPointer(stage);
        if (!pos) return;

        // Try snapping the "to" endpoint
        const candidates = getCandidates(stage);
        const snap = findNearestAnchor(pos, candidates, {
          pixelThreshold: 12,
          includeCenter: true,
        });
        const end = snap ? { x: snap.x, y: snap.y } : { x: pos.x, y: pos.y };

        if (ghost instanceof Konva.Arrow) {
          ghost.points([start.x, start.y, end.x, end.y]);
        } else if (ghost instanceof Konva.Line) {
          ghost.points([start.x, start.y, end.x, end.y]);
        }
        previewLayer.batchDraw();
      } else {
        // Hover mode - show ports on hovered elements
        const pos = getWorldPointer(stage);
        if (!pos) return;

        // Find element under cursor
        const candidates = getCandidates(stage);
        let hoveredElement: Konva.Node | null = null;

        for (const candidate of candidates) {
          const rect = candidate.getClientRect({ skipStroke: true, skipShadow: true });
          if (pos.x >= rect.x && pos.x <= rect.x + rect.width &&
              pos.y >= rect.y && pos.y <= rect.y + rect.height) {
            hoveredElement = candidate;
            break;
          }
        }

        const hoveredElementId = hoveredElement?.id() || null;

        // Update port display if hovered element changed
        if (hoveredElementId !== ref.current.hoveredElementId) {
          if (hoveredElementId) {
            showPortsForElement(hoveredElementId, stage);
          } else {
            hideAllPorts(stage);
          }
          ref.current.hoveredElementId = hoveredElementId;
        }
      }
    };

    const onPointerDown = () => {
      const pos = getWorldPointer(stage);
      if (!pos) return;

      // Hide ports when starting to draw
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
        ? {
            kind: "element",
            elementId: startSnap.elementId,
            anchor: startSnap.side,
          }
        : { kind: "point", x: startPoint.x, y: startPoint.y };

      const to: ConnectorElement["to"] = endSnap
        ? {
            kind: "element",
            elementId: endSnap.elementId,
            anchor: endSnap.side,
          }
        : { kind: "point", x: endPoint.x, y: endPoint.y };

      const variant = isArrow ? "arrow" : "line";

      begin?.("create-connector");

      const id =
        crypto?.randomUUID?.() ||
        `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const element: ConnectorElement = {
        id,
        type: "connector",
        variant,
        from,
        to,
        style: DEFAULT_STYLE,
        x: 0,
        y: 0,
        bounds: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      };

      // Add element using upsert
      let elementId: string | undefined = id;
      if (upsertElement) {
        elementId = upsertElement(element);
      }

      end?.(true);

      if ((elementId || id) && selectOnly) {
        selectOnly(elementId || id);
      }
      setTool?.("select");
    };

    const onPointerUp = () => {
      const start = ref.current.start;
      const startSnap = ref.current.startSnap;
      const ghost = ref.current.preview;
      const pos = getWorldPointer(stage);

      if (!pos || !start) {
        // cleanup and bail
        if (ghost) {
          try {
            ghost.destroy();
          } catch (error) {
            // Ignore cleanup errors
            // Ghost cleanup error
          }
          ref.current.preview = null;
          previewLayer.batchDraw();
        }
        ref.current.start = null;
        ref.current.startSnap = null;
        return;
      }

      // Snap to end anchor if available
      const candidates = getCandidates(stage);
      const snap = findNearestAnchor(pos, candidates, {
        pixelThreshold: 12,
        includeCenter: true,
      });
      const endPoint = snap ? { x: snap.x, y: snap.y } : { x: pos.x, y: pos.y };
      const endSnap = snap
        ? { elementId: snap.elementId, side: snap.side }
        : null;

      // cleanup preview before committing
      if (ghost) {
        try {
          ghost.destroy();
        } catch (error) {
          // Ignore cleanup errors
          // Debug: Ghost cleanup error
        }
        ref.current.preview = null;
        previewLayer.batchDraw();
      }

      // commit using captured start/startSnap
      commit(start, startSnap, endPoint, endSnap);

      // reset state
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
          } catch (error) {
            // Ignore cleanup errors
            // Escape cleanup error
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

      // Clean up port dots
      hideAllPorts(stage);

      // Capture ref values at cleanup time
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Ref value captured at cleanup time as recommended
      const currentRef = ref.current;
      const g = currentRef.preview;
      if (g) {
        try {
          g.destroy();
        } catch (error) {
          // Ignore cleanup errors
          // Cleanup error
        }
        currentRef.preview = null;
        previewLayer.batchDraw();
      }
      currentRef.start = null;
      currentRef.startSnap = null;
    };
  }, [
    isActive,
    selectedTool,
    toolId,
    stageRef,
    upsertElement,
    selectOnly,
    begin,
    end,
    setTool,
  ]);

  return null;
};

export default ConnectorTool;
