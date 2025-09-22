// Connector tool with endpoint snapping, preview, and line/arrow variants
import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import type { AnchorSide } from "../../../types/connector";
import type { ConnectorElement } from "../../../types/connector";
import { findNearestAnchor } from "../../../utils/anchors/AnchorSnapping";

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
  }>({ start: null, startSnap: null, preview: null });

  // Helper to list candidate nodes (main-layer nodes) for snapping
  const getCandidates = (stage: Konva.Stage): Konva.Node[] => {
    // All interactive shapes/groups on main layer
    const layers = stage.getLayers();
    const main = layers[1] as Konva.Layer | undefined; // background(0), main(1), preview(2), overlay(3)
    if (!main) return [];
    return main.find<Konva.Node>("Group, Rect, Line, Image, Text"); // broad; filter as needed
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

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

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

    const onPointerMove = () => {
      const start = ref.current.start;
      const ghost = ref.current.preview;
      if (!start || !ghost) return;

      const pos = stage.getPointerPosition();
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
      const pos = stage.getPointerPosition();

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
