// MarqueeSelectionTool.tsx
// Marquee selection for drag-to-select multiple elements

import type React from "react";
import { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { StoreActions } from "../../../stores/facade";

export interface MarqueeSelectionToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
}

export const MarqueeSelectionTool: React.FC<MarqueeSelectionToolProps> = ({
  stageRef,
  isActive,
}) => {
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const beginTransform = useUnifiedCanvasStore((state) => state.selection?.beginTransform);
  const endTransform = useUnifiedCanvasStore((state) => state.selection?.endTransform);
  const selectionRef = useRef<string[]>([]);
  const selectedTool = useUnifiedCanvasStore((state) => state.ui?.selectedTool);

  // Track marquee state
  const marqueeRef = useRef<{
    isSelecting: boolean;
    startPoint: { x: number; y: number } | null;
    selectionRect: Konva.Rect | null;
  }>({
    isSelecting: false,
    startPoint: null,
    selectionRect: null,
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive || selectedTool !== "select") return;

    const layers = stage.getLayers();
    const overlayLayer = layers[layers.length - 1] as Konva.Layer; // Overlay layer

    const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      // Only start marquee if clicking on empty stage
      if (e.target !== stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      marqueeRef.current.isSelecting = true;
      marqueeRef.current.startPoint = { x: pos.x, y: pos.y };

      // Create selection rectangle
      const selectionRect = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        fill: "rgba(79, 70, 229, 0.1)", // Light blue fill
        stroke: "#4F46E5", // Blue border
        strokeWidth: 1,
        dash: [5, 5],
        listening: false,
        perfectDrawEnabled: false,
        shadowForStrokeEnabled: false,
        name: "marquee-selection",
      });

      marqueeRef.current.selectionRect = selectionRect;
      overlayLayer.add(selectionRect);
      overlayLayer.batchDraw();
    };

    const onPointerMove = (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!marqueeRef.current.isSelecting || !marqueeRef.current.startPoint || !marqueeRef.current.selectionRect) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const startPoint = marqueeRef.current.startPoint;
      const rect = marqueeRef.current.selectionRect;

      // Calculate rectangle bounds
      const x1 = Math.min(startPoint.x, pos.x);
      const y1 = Math.min(startPoint.y, pos.y);
      const x2 = Math.max(startPoint.x, pos.x);
      const y2 = Math.max(startPoint.y, pos.y);

      rect.x(x1);
      rect.y(y1);
      rect.width(x2 - x1);
      rect.height(y2 - y1);

      overlayLayer.batchDraw();
    };

    const onPointerUp = () => {
      if (!marqueeRef.current.isSelecting || !marqueeRef.current.startPoint || !marqueeRef.current.selectionRect) return;

      const pos = stage.getPointerPosition();
      if (!pos) {
        // Cleanup if no position
        cleanup();
        return;
      }

      const startPoint = marqueeRef.current.startPoint;

      // Calculate selection rectangle bounds
      const x1 = Math.min(startPoint.x, pos.x);
      const y1 = Math.min(startPoint.y, pos.y);
      const x2 = Math.max(startPoint.x, pos.x);
      const y2 = Math.max(startPoint.y, pos.y);

      const selectionBounds = {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      };

      // Only perform selection if the marquee has meaningful size
      if (selectionBounds.width > 5 && selectionBounds.height > 5) {
        selectElementsInBounds(selectionBounds);
      }

      cleanup();
    };

    const cleanup = () => {
      if (marqueeRef.current.selectionRect) {
        marqueeRef.current.selectionRect.destroy();
        overlayLayer.batchDraw();
      }

      marqueeRef.current.isSelecting = false;
      marqueeRef.current.startPoint = null;
      marqueeRef.current.selectionRect = null;
      selectionRef.current = [];
    };

    const selectElementsInBounds = (bounds: { x: number; y: number; width: number; height: number }) => {
      const stage = stageRef.current;
      if (!stage) return;

      const selectedIdSet = new Set<string>();
      const elementMetadata = new Map<string, { isConnector: boolean }>();

      const candidateNodes = stage.find<Konva.Node>((node: Konva.Node) => {
        if (typeof node.getAttr !== "function") return false;
        return Boolean(node.getAttr("elementId"));
      });

      for (const node of candidateNodes) {
        const elementId = node.getAttr("elementId") || node.id();
        if (!elementId || !elements.has(elementId)) continue;

        const nodeRect = node.getClientRect({
          skipStroke: false,
          skipShadow: true,
        });

        const intersects = !(
          nodeRect.x > bounds.x + bounds.width ||
          nodeRect.x + nodeRect.width < bounds.x ||
          nodeRect.y > bounds.y + bounds.height ||
          nodeRect.y + nodeRect.height < bounds.y
        );

        if (intersects) {
          selectedIdSet.add(elementId);
          const isConnector =
            node.getAttr("nodeType") === "connector" ||
            node.getAttr("elementType") === "connector";
          elementMetadata.set(elementId, { isConnector });
        }
      }

      const selectedIds = Array.from(selectedIdSet);
      if (selectedIds.length > 0 && setSelection) {
        const connectors: string[] = [];
        const nonConnectors: string[] = [];
        for (const id of selectedIds) {
          if (elementMetadata.get(id)?.isConnector) {
            connectors.push(id);
          } else {
            nonConnectors.push(id);
          }
        }

        const finalSelection =
          nonConnectors.length > 0 && connectors.length > 0
            ? nonConnectors
            : selectedIds;

        setSelection(finalSelection);
        selectionRef.current = finalSelection;

        // Notify selection module so it can refresh transformer state / connector overlays
        StoreActions.bumpSelectionVersion?.();
      }
    };

    const onPointerDownSelectionMove = () => {
      if (selectionRef.current.length === 0) {
        return;
      }
      const start = marqueeRef.current.startPoint;
      if (start) {
        return;
      }
      beginTransform?.();
    };

    // Register event handlers
    stage.on("pointerdown.marquee", onPointerDown);
    stage.on("pointermove.marquee", onPointerMove);
    stage.on("pointerup.marquee", onPointerUp);
    stage.on("dragstart.marquee", onPointerDownSelectionMove);
    stage.on("dragend.marquee", () => {
      if (selectionRef.current.length > 0) {
        endTransform?.();
      }
    });

    // Handle escape key to cancel marquee
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && marqueeRef.current.isSelecting) {
        cleanup();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      stage.off("pointerdown.marquee", onPointerDown);
      stage.off("pointermove.marquee", onPointerMove);
      stage.off("pointerup.marquee", onPointerUp);
      stage.off("dragstart.marquee", onPointerDownSelectionMove);
      stage.off("dragend.marquee");
      window.removeEventListener("keydown", onKeyDown);

      // Cleanup any ongoing marquee
      cleanup();
    };
  }, [isActive, selectedTool, stageRef, elements, setSelection]);

  return null;
};

export default MarqueeSelectionTool;
