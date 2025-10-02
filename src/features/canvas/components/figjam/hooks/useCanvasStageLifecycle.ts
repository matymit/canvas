import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import Konva from "konva";

import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { setupRenderer } from "../../../renderer";
import GridRenderer from "../../GridRenderer";
import { RafBatcher } from "../../../utils/performance/RafBatcher";
import type { RafBatcherFlushStats } from "../../../utils/performance/RafBatcher";
import ToolManager from "../../../managers/ToolManager";
import { debug } from "../../../../../utils/debug";
import { TextCanvasTool } from "../../tools/content/TextTool";

const isDev = typeof process !== "undefined" ? process.env.NODE_ENV !== "production" : true;

type LayerRefs = {
  background: Konva.Layer | null;
  main: Konva.Layer | null;
  highlighter: Konva.Group | null;
  preview: Konva.Layer | null;
  overlay: Konva.Layer | null;
};

type ConnectorLayers = {
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
};

type StageLifecycleResult = {
  containerRef: RefObject<HTMLDivElement | null>;
  overlayRef: MutableRefObject<HTMLDivElement | null>;
  stageRef: MutableRefObject<Konva.Stage | null>;
  connectorLayersRef: MutableRefObject<ConnectorLayers | null>;
  rafBatcherRef: MutableRefObject<RafBatcher>;
  toolManagerRef: MutableRefObject<ToolManager | null>;
  gridRendererRef: MutableRefObject<GridRenderer | null>;
  updateOverlayTransform: () => void;
  viewportRefs: {
    x: MutableRefObject<number>;
    y: MutableRefObject<number>;
    scale: MutableRefObject<number>;
  };
};

export const useCanvasStageLifecycle = (): StageLifecycleResult => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportXRef = useRef<number>(0);
  const viewportYRef = useRef<number>(0);
  const viewportScaleRef = useRef<number>(1);
  const viewportRefs = useMemo(
    () => ({
      x: viewportXRef,
      y: viewportYRef,
      scale: viewportScaleRef,
    }),
    [viewportXRef, viewportYRef, viewportScaleRef],
  );
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<LayerRefs>({
    background: null,
    main: null,
    highlighter: null,
    preview: null,
    overlay: null,
  });
  const connectorLayersRef = useRef<ConnectorLayers | null>(null);
  const rendererDisposeRef = useRef<(() => void) | null>(null);
  const toolManagerRef = useRef<ToolManager | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const rafBatcherRef = useRef(new RafBatcher());

  useEffect(() => {
    if (!isDev) {
      return;
    }

    const batcher = rafBatcherRef.current;
    if (!batcher) {
      return;
    }

    type InstrumentedWindow = typeof window & {
      canvasRafBatcherStats?: {
        cycles: number;
        totals: RafBatcherFlushStats;
        last: RafBatcherFlushStats;
      };
    };

    const totals: RafBatcherFlushStats = {
      readCount: 0,
      writeCount: 0,
      drawCount: 0,
    };

    let cycles = 0;

    const updateStats = (stats: RafBatcherFlushStats) => {
      totals.readCount += stats.readCount;
      totals.writeCount += stats.writeCount;
      totals.drawCount += stats.drawCount;

      cycles += 1;
      const instrumentedWindow = window as InstrumentedWindow;

      instrumentedWindow.canvasRafBatcherStats = {
        cycles,
        totals: { ...totals },
        last: { ...stats },
      };
    };

    batcher.setOnFlush(updateStats);

    const instrumentedWindow = window as InstrumentedWindow;
    instrumentedWindow.canvasRafBatcherStats = {
      cycles: 0,
      totals: { ...totals },
      last: { ...totals },
    };

    return () => {
      batcher.setOnFlush(undefined);
      const instrumentedWindow = window as InstrumentedWindow;
      delete instrumentedWindow.canvasRafBatcherStats;
    };
  }, []);

  const updateOverlayTransform = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.style.transform = "translate3d(0, 0, 0)";
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    debug("Initializing stage and renderer - ONE TIME ONLY", {
      category: "FigJamCanvas",
    });

    const stage = new Konva.Stage({
      container,
      width: window.innerWidth,
      height: window.innerHeight,
      draggable: false,
    });

    stageRef.current = stage;

    (window as unknown as Record<string, unknown>).konvaStage = stage;
    (window as unknown as Record<string, unknown>).canvasRafBatcher = rafBatcherRef.current;

    const backgroundLayer = new Konva.Layer({ listening: false });
    const mainLayer = new Konva.Layer({ listening: true });
    const highlighterGroup = new Konva.Group({ listening: false });
    mainLayer.add(highlighterGroup);
    const previewLayer = new Konva.Layer({ listening: false });
    const overlayLayer = new Konva.Layer({ listening: true });

    layersRef.current = {
      background: backgroundLayer,
      main: mainLayer,
      highlighter: highlighterGroup,
      preview: previewLayer,
      overlay: overlayLayer,
    };

    connectorLayersRef.current = {
      main: mainLayer,
      preview: previewLayer,
      overlay: overlayLayer,
    };

    stage.add(backgroundLayer);
    stage.add(mainLayer);
    stage.add(previewLayer);
    stage.add(overlayLayer);

    stage.on(
      "xChange.overlayTransform yChange.overlayTransform scaleXChange.overlayTransform scaleYChange.overlayTransform",
      updateOverlayTransform,
    );

    const gridRenderer = new GridRenderer(stage, backgroundLayer, {
      spacing: 20,
      dotRadius: 0.75,
      color: "#d0d0d0",
      opacity: 1,
      cacheLayer: true,
      recacheOnZoom: true,
      hugeRectSize: 100000,
    });

    gridRendererRef.current = gridRenderer;

    let overlayContainer = overlayRef.current;
    if (!overlayContainer) {
      overlayContainer = document.createElement("div");
      overlayContainer.style.position = "absolute";
      overlayContainer.style.top = "0";
      overlayContainer.style.left = "0";
      overlayContainer.style.width = "100%";
      overlayContainer.style.height = "100%";
      overlayContainer.style.pointerEvents = "none";
      overlayContainer.style.transformOrigin = "0 0";
      overlayContainer.className = "canvas-dom-overlay";
      container.appendChild(overlayContainer);
      overlayRef.current = overlayContainer;
    }

    if (overlayRef.current) {
      overlayRef.current.style.transformOrigin = "0 0";
    }

    updateOverlayTransform();

    const storeState = useUnifiedCanvasStore.getState();
    const applyViewportToStage = (reason: string) => {
      viewportXRef.current = storeState.viewport.x;
      viewportYRef.current = storeState.viewport.y;
      viewportScaleRef.current = storeState.viewport.scale;
      stage.position({ x: viewportXRef.current, y: viewportYRef.current });
      stage.scale({ x: viewportScaleRef.current, y: viewportScaleRef.current });
      updateOverlayTransform();
      if (isDev) {
        debug("viewport:init-apply", {
          category: "FigJamCanvas",
          data: {
            reason,
            viewport: { ...storeState.viewport },
            stagePos: stage.position(),
            stageScale: stage.scaleX(),
          },
        });
      }
    };

    if (storeState.elements.size === 0) {
      if (isDev) {
        debug("viewport:init-reset", {
          category: "FigJamCanvas",
          data: { reason: "empty-canvas", viewport: { ...storeState.viewport } },
        });
      }
      storeState.viewport.reset?.();
      applyViewportToStage("reset");
    } else {
      applyViewportToStage("persisted-state");
    }

    const rendererDispose = setupRenderer(stage, {
      background: backgroundLayer,
      main: mainLayer,
      highlighter: highlighterGroup,
      preview: previewLayer,
      overlay: overlayLayer,
    });
    rendererDisposeRef.current = rendererDispose;

    const toolManager = new ToolManager({
      stage,
      mainLayer,
      store: useUnifiedCanvasStore.getState(),
    });
    toolManagerRef.current = toolManager;

    const textCanvasTool = new TextCanvasTool();
    toolManager.registerCanvasTool("text", textCanvasTool);

    const handleResize = () => {
      const state = useUnifiedCanvasStore.getState();
      const viewportState = state.viewport;
      const stageBefore = {
        position: stage.position(),
        scale: stage.scaleX(),
        width: stage.width(),
        height: stage.height(),
      };
      let worldCenter: { x: number; y: number } | null = null;

      if (typeof viewportState?.stageToWorld === "function") {
        const currentWidth = stage.width();
        const currentHeight = stage.height();
        worldCenter = viewportState.stageToWorld(currentWidth / 2, currentHeight / 2);
      }

      stage.width(window.innerWidth);
      stage.height(window.innerHeight);

      if (
        worldCenter &&
        typeof viewportState?.setPan === "function" &&
        typeof viewportState.scale === "number"
      ) {
        const newPanX = window.innerWidth / 2 - worldCenter.x * viewportState.scale;
        const newPanY = window.innerHeight / 2 - worldCenter.y * viewportState.scale;
        viewportState.setPan(newPanX, newPanY);
      }

      gridRenderer.updateOptions({ dpr: window.devicePixelRatio });

      if (isDev) {
        debug("viewport:handle-resize", {
          category: "FigJamCanvas",
          data: {
            stageBefore,
            stageAfter: {
              position: stage.position(),
              scale: stage.scaleX(),
              width: stage.width(),
              height: stage.height(),
            },
            worldCenter,
            viewport: { ...viewportState },
          },
        });
      }

      updateOverlayTransform();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      debug("Cleaning up stage and renderer", { category: "FigJamCanvas" });
      window.removeEventListener("resize", handleResize);

      if (gridRendererRef.current) {
        gridRendererRef.current.destroy();
        gridRendererRef.current = null;
      }

      if (toolManagerRef.current) {
        toolManagerRef.current.destroy();
        toolManagerRef.current = null;
      }

      if (rendererDisposeRef.current) {
        rendererDisposeRef.current();
        rendererDisposeRef.current = null;
      }

      stage.off(".overlayTransform");

      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }

      stage.destroy();
      stageRef.current = null;

      delete (window as unknown as Record<string, unknown>).konvaStage;
      delete (window as unknown as Record<string, unknown>).canvasRafBatcher;
    };
  }, [updateOverlayTransform]);

  return {
    containerRef,
    overlayRef,
    stageRef,
    connectorLayersRef,
    rafBatcherRef,
    toolManagerRef,
    gridRendererRef,
    updateOverlayTransform,
    viewportRefs,
  };
};
