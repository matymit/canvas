import React, { useCallback } from "react";

import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import { StoreActions } from "../stores/facade";
import CanvasToolbar from "../toolbar/CanvasToolbar";
import { useMindmapOperations } from "../utils/mindmap/mindmapOperations";

import "../utils/editors/openCellEditorWithTracking";

import MarqueeSelectionTool from "./tools/navigation/MarqueeSelectionTool";
import PanTool from "./tools/navigation/PanTool";
import { useCanvasStageLifecycle } from "./figjam/hooks/useCanvasStageLifecycle";
import { useCanvasViewportSync } from "./figjam/hooks/useCanvasViewportSync";
import { useCanvasEvents } from "./figjam/hooks/useCanvasEvents";
import { useCanvasTools } from "./figjam/hooks/useCanvasTools";
import { useCanvasShortcuts } from "./figjam/hooks/useCanvasShortcuts";
import { useCanvasServices } from "./figjam/hooks/useCanvasServices";

const FigJamCanvas: React.FC = () => {
  const {
    containerRef,
    stageRef,
    connectorLayersRef,
    rafBatcherRef,
    toolManagerRef,
    gridRendererRef,
    updateOverlayTransform,
    viewportRefs,
  } = useCanvasStageLifecycle();
  // imageDragHandlerRef removed - images now use standard SelectionModule transformer system

  // Store subscriptions - viewport object for toolbar/shortcut control
  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  const { canvasBackgroundStyle } = useCanvasViewportSync({
    stageRef,
    gridRendererRef,
    updateOverlayTransform,
    viewportRefs,
  });
  useCanvasEvents({ stageRef, gridRendererRef, rafBatcherRef });
  const selectedTool =
    useUnifiedCanvasStore((state) => state.ui?.selectedTool) ?? "select";
  const { activeToolNode } = useCanvasTools({
    containerRef,
    stageRef,
    toolManagerRef,
    connectorLayersRef,
    rafBatcherRef,
    selectedTool,
  });
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const selectedElementIds = useUnifiedCanvasStore(
    (state) => state.selectedElementIds,
  );

  // Store methods - use useCallback to stabilize references
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const deleteSelected = useUnifiedCanvasStore(
    (state) => state.selection?.deleteSelected,
  );
  const withUndo = useUnifiedCanvasStore((state) => state.withUndo);
  const undo = useUnifiedCanvasStore((state) => state.undo);
  const redo = useUnifiedCanvasStore((state) => state.redo);
  const setSelectedTool = useCallback((tool: string) => {
    // Only update if different to avoid render loops
    const cur = useUnifiedCanvasStore.getState().ui?.selectedTool;
    if (cur === tool) return;
    StoreActions.setSelectedTool?.(tool);
  }, []);

  // Mindmap operations for keyboard shortcuts
  const mindmapOps = useMindmapOperations();

  useCanvasShortcuts({
    selectedElementIds,
    elements,
    viewport,
    withUndo,
    deleteSelected,
    setSelection,
    undo,
    redo,
    setSelectedTool,
    mindmapOps,
  });

  const { serviceNodes } = useCanvasServices({ stageRef, elements });

  return (
    <div className="canvas-wrapper" data-testid="canvas-container" style={canvasBackgroundStyle}>
      <div className="toolbar-container">
        <CanvasToolbar
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          onUndo={undo}
          onRedo={redo}
        />
      </div>
      <div
        ref={containerRef}
        className="konva-stage-container"
        data-testid="konva-stage-container"
      />
      {/* Zoom controls removed - now only in toolbar */}

      {/* Render active tool components - these handle stage interactions */}
      {activeToolNode}

      {/* Marquee selection for select tool - always active when in select mode */}
      <MarqueeSelectionTool
        stageRef={stageRef}
        isActive={selectedTool === "select"}
      />

      {/* Pan tool for canvas navigation */}
      <PanTool
        stageRef={stageRef}
        isActive={selectedTool === "pan"}
        rafBatcher={rafBatcherRef.current}
      />

      {/* Context menu + service managers */}
      {serviceNodes}
    </div>
  );
};

export default FigJamCanvas;
