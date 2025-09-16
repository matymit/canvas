import { useCallback, useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
// import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';

export interface ViewportState {
  scale: number;
  x: number;
  y: number;
}
export interface UseViewportControlsOptions {
  minScale?: number;
  maxScale?: number;
  scaleBy?: number;
  enableWheelZoom?: boolean;
  enablePinchZoom?: boolean;
  enableDragPan?: boolean;
  panKey?: 'Space' | null;
}
export interface UseViewportControls {
  getViewport: () => ViewportState;
  setViewport: (v: Partial<ViewportState>) => void;
  zoomIn: (center?: { x: number; y: number }) => void;
  zoomOut: (center?: { x: number; y: number }) => void;
  resetZoom: () => void;
  fitToContent: (bounds: { x: number; y: number; width: number; height: number }, padding?: number) => void;
}

export default function useViewportControls(
  stageRef: React.MutableRefObject<Konva.Stage | null>,
  opts: UseViewportControlsOptions = {}
): UseViewportControls {
  const {
    minScale = 0.2,
    maxScale = 8,
    scaleBy = 1.05,
    enableWheelZoom = true,
    enablePinchZoom = true,
    enableDragPan = true,
    panKey = 'Space',
  } = opts;

  const pinchRef = useRef<{ lastDist: number | null; center: { x: number; y: number } | null }>({
    lastDist: null,
    center: null,
  });
  const panActiveRef = useRef<boolean>(false);
  const spaceHeldRef = useRef<boolean>(false);
  const middlePanRef = useRef<boolean>(false);

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale]
  );

  const getViewport = useCallback<UseViewportControls['getViewport']>(() => {
    const stage = stageRef.current;
    if (!stage) return { scale: 1, x: 0, y: 0 };
    return { scale: stage.scaleX(), x: stage.x(), y: stage.y() };
  }, [stageRef]);

  const setViewport = useCallback<UseViewportControls['setViewport']>(
    (v) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (v.scale != null) {
        const s = clampScale(v.scale);
        stage.scale({ x: s, y: s });
      }
      if (v.x != null || v.y != null) {
        stage.position({ x: v.x ?? stage.x(), y: v.y ?? stage.y() });
      }
      stage.batchDraw();
    },
    [clampScale, stageRef]
  );

  const zoomAtPoint = useCallback(
    (direction: 1 | -1, point: { x: number; y: number }) => {
      const stage = stageRef.current;
      if (!stage) return;
      const oldScale = stage.scaleX();
      const mousePointTo = {
        x: (point.x - stage.x()) / oldScale,
        y: (point.y - stage.y()) / oldScale,
      };
      const newScale = clampScale(direction > 0 ? oldScale * scaleBy : oldScale / scaleBy);
      stage.scale({ x: newScale, y: newScale });
      const newPos = {
        x: point.x - mousePointTo.x * newScale,
        y: point.y - mousePointTo.y * newScale,
      };
      stage.position(newPos);
      stage.batchDraw();
    },
    [clampScale, scaleBy, stageRef]
  );

  const zoomIn = useCallback<UseViewportControls['zoomIn']>(
    (center) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pt = center ?? stage.getPointerPosition() ?? { x: stage.width() / 2, y: stage.height() / 2 };
      zoomAtPoint(1, pt);
    },
    [stageRef, zoomAtPoint]
  );

  const zoomOut = useCallback<UseViewportControls['zoomOut']>(
    (center) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pt = center ?? stage.getPointerPosition() ?? { x: stage.width() / 2, y: stage.height() / 2 };
      zoomAtPoint(-1, pt);
    },
    [stageRef, zoomAtPoint]
  );

  const resetZoom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
  }, [stageRef]);

  const fitToContent = useCallback<UseViewportControls['fitToContent']>(
    (bounds, padding = 24) => {
      const stage = stageRef.current;
      if (!stage) return;
      const viewW = stage.width();
      const viewH = stage.height();
      const scaleX = (viewW - padding * 2) / bounds.width;
      const scaleY = (viewH - padding * 2) / bounds.height;
      const scale = clampScale(Math.min(scaleX, scaleY));
      stage.scale({ x: scale, y: scale });
      const x = -bounds.x * scale + (viewW - bounds.width * scale) / 2;
      const y = -bounds.y * scale + (viewH - bounds.height * scale) / 2;
      stage.position({ x, y });
      stage.batchDraw();
    },
    [clampScale, stageRef]
  );

  // Wheel zoom at pointer
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !enableWheelZoom) return;
    const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const dir = e.evt.deltaY > 0 ? -1 : 1;
      // natural zoom for pinch
      const direction = e.evt.ctrlKey ? -dir : dir;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      zoomAtPoint(direction > 0 ? 1 : -1, pointer);
    };
    stage.on('wheel', onWheel);
    return () => {
      stage.off('wheel', onWheel);
    };
  }, [enableWheelZoom, stageRef, zoomAtPoint]);

  // Drag to pan with Space or middle mouse, with refined cursor feedback
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !enableDragPan) return;

    const container = stage.container();

    const setCursor = (v: string) => {
      container.style.cursor = v;
    };

    const enableDrag = () => {
      stage.draggable(true);
      panActiveRef.current = true;
      setCursor('grabbing');
    };

    const disableDrag = () => {
      stage.draggable(false);
      panActiveRef.current = false;
      setCursor('default');
    };

    // Cursor idle feedback for pan-available state
    const onMouseEnter = () => {
      if (!panActiveRef.current && (spaceHeldRef.current || enableDragPan)) {
        setCursor(spaceHeldRef.current ? 'grab' : container.style.cursor);
      }
    };
    const onMouseLeave = () => {
      if (!panActiveRef.current) setCursor('default');
    };

    // Space-to-pan
    const onKeyDown = (e: KeyboardEvent) => {
      if (panKey === 'Space' && e.code === 'Space' && !spaceHeldRef.current) {
        spaceHeldRef.current = true;
        if (!panActiveRef.current) {
          setCursor('grab');
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (panKey === 'Space' && e.code === 'Space') {
        spaceHeldRef.current = false;
        if (!panActiveRef.current) {
          setCursor('default');
        }
      }
    };
    const onBlur = () => {
      spaceHeldRef.current = false;
      if (!panActiveRef.current) setCursor('default');
    };

    // Stage drag start/end to flip grabbing cursor
    const onDragStart = () => setCursor('grabbing');
    const onDragEnd = () => {
      setCursor(spaceHeldRef.current ? 'grab' : 'default');
      // If drag was enabled via middle mouse, disable
      if (middlePanRef.current) {
        middlePanRef.current = false;
        disableDrag();
      }
    };

    // Mouse buttons: middle mouse triggers temporary pan
    const onMouseDown = (e: MouseEvent) => {
      // middle button (button === 1)
      if (e.button === 1) {
        middlePanRef.current = true;
        enableDrag();
      } else if (spaceHeldRef.current && e.button === 0) {
        enableDrag();
      }
    };
    const onMouseUp = (_e: MouseEvent) => {
      if (panActiveRef.current && !middlePanRef.current) {
        // end space-pan when button released
        disableDrag();
      }
    };

    // Attach
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    stage.on('dragstart', onDragStart);
    stage.on('dragend', onDragEnd);

    return () => {
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      stage.off('dragstart', onDragStart);
      stage.off('dragend', onDragEnd);
      disableDrag();
    };
  }, [stageRef, enableDragPan, panKey]);

  // Pinch zoom for touch
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !enablePinchZoom) return;

    const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
      Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => ({
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    });

    const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
      const t1 = e.evt.touches[0];
      const t2 = e.evt.touches[1];
      if (t1 && t2) {
        e.evt.preventDefault();
        const p1 = { x: t1.clientX, y: t1.clientY };
        const p2 = { x: t2.clientX, y: t2.clientY };
        const dist = getDistance(p1, p2);
        const center = getCenter(p1, p2);
        if (!pinchRef.current.lastDist) {
          pinchRef.current.lastDist = dist;
          pinchRef.current.center = center;
          return;
        }
        const scale = stage.scaleX();
        const pointTo = {
          x: (center.x - stage.x()) / scale,
          y: (center.y - stage.y()) / scale,
        };
        const ratio = dist / (pinchRef.current.lastDist ?? dist);
        const newScale = clampScale(scale * ratio);
        stage.scale({ x: newScale, y: newScale });
        const newPos = {
          x: center.x - pointTo.x * newScale,
          y: center.y - pointTo.y * newScale,
        };
        stage.position(newPos);
        stage.batchDraw();
        pinchRef.current.lastDist = dist;
        pinchRef.current.center = center;
      }
    };
    const onTouchEnd = () => {
      pinchRef.current.lastDist = null;
      pinchRef.current.center = null;
    };

    stage.on('touchmove', onTouchMove);
    stage.on('touchend', onTouchEnd);
    stage.on('touchcancel', onTouchEnd);

    return () => {
      stage.off('touchmove', onTouchMove);
      stage.off('touchend', onTouchEnd);
      stage.off('touchcancel', onTouchEnd);
    };
  }, [stageRef, enablePinchZoom, clampScale]);

  // Optional: sync viewport changes with store for persistence
  /*
  const updateStoreViewport = useCallback((viewport: ViewportState) => {
    // If unified store has viewport management, sync it here
    // This allows viewport state to be persisted and shared
  }, []);
  */

  return useMemo(
    () => ({
      getViewport,
      setViewport,
      zoomIn,
      zoomOut,
      resetZoom,
      fitToContent,
    }),
    [getViewport, setViewport, zoomIn, zoomOut, resetZoom, fitToContent]
  );
}