import { MutableRefObject, useEffect } from "react";
import Konva from "konva";

import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { StoreActions } from "../../../stores/facade";
import GridRenderer from "../../GridRenderer";
import { debug } from "../../../../../utils/debug";

type UseCanvasEventsArgs = {
  stageRef: MutableRefObject<Konva.Stage | null>;
  gridRendererRef: MutableRefObject<GridRenderer | null>;
};

type UseCanvasEventsResult = void;

const getSelectedTool = () => useUnifiedCanvasStore.getState().ui?.selectedTool as string | undefined;

export const useCanvasEvents = ({
  stageRef,
  gridRendererRef,
}: UseCanvasEventsArgs): UseCanvasEventsResult => {
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    debug("Setting up stage event handlers", { category: "FigJamCanvas" });

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      const tool = getSelectedTool();

      if (e.target === stage) {
        StoreActions.clearSelection?.();
        return;
      }

      if (tool !== "select") return;

      const clickedNode = e.target;
      let elementId = clickedNode.getAttr("elementId") || clickedNode.id();

      if (!elementId && clickedNode.parent) {
        const parent = clickedNode.parent;
        elementId = parent.getAttr("elementId") || parent.id();
      }

      const store = useUnifiedCanvasStore.getState();
      const elements = store.elements as Map<string, unknown>;
      if (elementId && elements?.has?.(elementId)) {
        const selectedIds = store.selectedElementIds as Set<string> | string[] | undefined;
        const isSelected = selectedIds instanceof Set
          ? selectedIds.has(elementId)
          : Array.isArray(selectedIds)
            ? selectedIds.includes(elementId)
            : false;

        if (e.evt.ctrlKey || e.evt.metaKey) {
          if (isSelected) {
            const next = selectedIds instanceof Set
              ? new Set(selectedIds)
              : new Set<string>(selectedIds as string[]);
            next.delete(elementId);
            (store.setSelection || store.selection?.set)?.(Array.from(next));
          } else {
            (store.addToSelection || store.selection?.toggle || store.selection?.set)?.(elementId);
          }
        } else {
          (store.setSelection || store.selection?.set)?.([elementId]);
        }
      }
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const deltaScale = e.evt.deltaY > 0 ? 0.9 : 1.1;
      const viewport = useUnifiedCanvasStore.getState().viewport;
      viewport?.zoomAt?.(pointer.x, pointer.y, deltaScale);

      if (gridRendererRef.current) {
        gridRendererRef.current.updateOptions({ dpr: window.devicePixelRatio });
      }
    };

    const handleStageContextMenu = (_e: Konva.KonvaEventObject<MouseEvent>) => {
      // Intentionally left blank for now; context menus handled via services hook
    };

    stage.on("click", handleStageClick);
    stage.on("wheel", handleWheel);
    stage.on("contextmenu", handleStageContextMenu);

    return () => {
      debug("Cleaning up stage event handlers", { category: "FigJamCanvas" });
      stage.off("click", handleStageClick);
      stage.off("wheel", handleWheel);
      stage.off("contextmenu", handleStageContextMenu);
    };
  }, [stageRef, gridRendererRef]);
};

export default useCanvasEvents;
