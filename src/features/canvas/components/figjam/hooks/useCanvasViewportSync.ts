import { useEffect, useMemo } from "react";
import type { CSSProperties, MutableRefObject } from "react";
import type Konva from "konva";

import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import type GridRenderer from "../../GridRenderer";
import { useShallow } from "zustand/react/shallow";

type ViewportSyncArgs = {
  stageRef: MutableRefObject<Konva.Stage | null>;
  gridRendererRef: MutableRefObject<GridRenderer | null>;
  updateOverlayTransform: () => void;
  viewportRefs: {
    x: MutableRefObject<number>;
    y: MutableRefObject<number>;
    scale: MutableRefObject<number>;
  };
};

type ViewportSyncResult = {
  canvasBackgroundStyle: CSSProperties;
};

export const useCanvasViewportSync = ({
  stageRef,
  gridRendererRef,
  updateOverlayTransform,
  viewportRefs,
}: ViewportSyncArgs): ViewportSyncResult => {
  const { viewportX, viewportY, viewportScale } = useUnifiedCanvasStore(
    useShallow((state) => ({
      viewportX: state.viewport.x,
      viewportY: state.viewport.y,
      viewportScale: state.viewport.scale,
    })),
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.position({ x: viewportX, y: viewportY });
    stage.scale({ x: viewportScale, y: viewportScale });

    updateOverlayTransform();

    if (gridRendererRef.current) {
      gridRendererRef.current.updateOptions({ dpr: window.devicePixelRatio });
    }

    stage.batchDraw();
    viewportRefs.x.current = viewportX;
    viewportRefs.y.current = viewportY;
    viewportRefs.scale.current = viewportScale;
  }, [viewportX, viewportY, viewportScale, stageRef, gridRendererRef, updateOverlayTransform, viewportRefs]);

  const canvasBackgroundStyle = useMemo(() => {
    const spacing = 20 * viewportScale;
    return {
      backgroundPosition: `${-viewportX}px ${-viewportY}px`,
      backgroundSize: `${spacing}px ${spacing}px`,
    } as CSSProperties;
  }, [viewportX, viewportY, viewportScale]);

  return {
    canvasBackgroundStyle,
  };
};

export default useCanvasViewportSync;
