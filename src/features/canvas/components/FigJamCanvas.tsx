import React, { useEffect, useRef, useCallback } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import { setupRenderer } from "../renderer";
import CanvasToolbar from "../toolbar/CanvasToolbar";
import ZoomControls from "./ZoomControls";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import GridRenderer from "./GridRenderer";

// Import cell editor for table functionality
import "../utils/editors/openCellEditorWithTracking";

// Import table context menu manager
import { TableContextMenuManager } from "./table/TableContextMenuManager";

// Tool imports - all major tools
import StickyNoteTool from "./tools/creation/StickyNoteTool";
import ConnectorTool from "./tools/creation/ConnectorTool";
import TextTool, { TextCanvasTool } from "./tools/content/TextTool";
import ImageTool from "./tools/content/ImageTool";
import TableTool from "./tools/content/TableTool";
import MindmapTool from "./tools/content/MindmapTool";
import RectangleTool from "./tools/shapes/RectangleTool";
import CircleTool from "./tools/shapes/CircleTool";
import TriangleTool from "./tools/shapes/TriangleTool";
import ToolManager from "../managers/ToolManager";
// Note: Drawing tools (pen, marker, highlighter, eraser) would be in ./tools/drawing/

const FigJamCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<{
    background: Konva.Layer | null;
    main: Konva.Layer | null;
    highlighter: Konva.Layer | null;
    preview: Konva.Layer | null;
    overlay: Konva.Layer | null;
  }>({
    background: null,
    main: null,
    highlighter: null,
    preview: null,
    overlay: null,
  });
  const rendererDisposeRef = useRef<(() => void) | null>(null);
  const toolManagerRef = useRef<ToolManager | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);

  // Store subscriptions
  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  const selectedTool = useUnifiedCanvasStore((state) => state.selectedTool);
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const selectedElementIds = useUnifiedCanvasStore(
    (state) => state.selectedElementIds,
  );

  // Store methods
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const addToSelection = useUnifiedCanvasStore((state) => state.addToSelection);
  const clearSelection = useUnifiedCanvasStore((state) => state.clearSelection);
  const deleteSelected = useUnifiedCanvasStore(
    (state) => state.selection?.deleteSelected,
  );
  const withUndo = useUnifiedCanvasStore((state) => state.withUndo);
  const undo = useUnifiedCanvasStore((state) => state.undo);
  const redo = useUnifiedCanvasStore((state) => state.redo);
  const setSelectedTool = useUnifiedCanvasStore((state) => state.setSelectedTool);

  // Initialize stage and renderer system
  useEffect(() => {
    if (!containerRef.current) return;

    // Create Konva stage - THIS IS THE ONLY PLACE WHERE KONVA.STAGE SHOULD BE CREATED
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      draggable: false,
    });

    stageRef.current = stage;

    // Create the five-layer system
    const backgroundLayer = new Konva.Layer({ listening: false }); // Grid, non-interactive
    const mainLayer = new Konva.Layer({ listening: true }); // All committed elements
    const highlighterLayer = new Konva.Layer({ listening: false }); // Highlighter strokes (behind main)
    const previewLayer = new Konva.Layer({ listening: false }); // Tool previews, ephemeral
    const overlayLayer = new Konva.Layer({ listening: true }); // Selection handles, guides

    layersRef.current = {
      background: backgroundLayer,
      main: mainLayer,
      highlighter: highlighterLayer,
      preview: previewLayer,
      overlay: overlayLayer,
    };

    // Add layers to stage in correct order
    stage.add(backgroundLayer);
    stage.add(highlighterLayer); // Behind main for highlighter z-policy
    stage.add(mainLayer);
    stage.add(previewLayer);
    stage.add(overlayLayer); // Always on top

    // Setup FigJam-style grid on background layer
    // Match the CSS styling: radial-gradient(circle at 1px 1px, #d0d0d0 1px, transparent 1px)
    const gridRenderer = new GridRenderer(stage, backgroundLayer, {
      spacing: 20,           // 20px spacing to match CSS background-size
      dotRadius: 0.75,       // Slightly smaller than 1px for better visual match
      color: '#d0d0d0',      // Exact color from CSS
      opacity: 1,
      cacheLayer: true,      // Cache for performance
      recacheOnZoom: true,   // Recache on zoom for crisp dots
      hugeRectSize: 100000   // Large coverage area
    });

    gridRendererRef.current = gridRenderer;

    // Setup renderer system - this is the KEY integration
    const rendererDispose = setupRenderer(stage, {
      background: backgroundLayer,
      main: mainLayer,
      highlighter: highlighterLayer,
      preview: previewLayer,
      overlay: overlayLayer,
    });
    rendererDisposeRef.current = rendererDispose;

    // Setup ToolManager with proper lifecycle
    const toolManager = new ToolManager({
      stage,
      mainLayer,
      store: useUnifiedCanvasStore.getState(),
    });
    toolManagerRef.current = toolManager;

    // Register canvas tools that need direct Konva event binding
    const textCanvasTool = new TextCanvasTool();
    toolManager.registerCanvasTool('text', textCanvasTool);

    // Selection handling - click empty space clears, click elements selects
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Skip if not in select mode
      if (selectedTool !== "select") return;

      // If clicking on empty stage, clear selection
      if (e.target === stage) {
        clearSelection();
        return;
      }

      // If clicking on an element, select it (renderer modules should set element IDs on nodes)
      const clickedNode = e.target;
      let elementId = clickedNode.getAttr("elementId") || clickedNode.id();

      // If no elementId on the clicked node, check its parent (for clicking on child nodes like image bitmaps)
      if (!elementId && clickedNode.parent) {
        const parent = clickedNode.parent;
        elementId = parent.getAttr("elementId") || parent.id();
      }

      if (elementId && elements.has(elementId)) {
        if (e.evt.ctrlKey || e.evt.metaKey) {
          // Toggle selection with Ctrl/Cmd
          if (selectedElementIds.has(elementId)) {
            const newSelection = new Set(selectedElementIds);
            newSelection.delete(elementId);
            setSelection(newSelection);
          } else {
            addToSelection(elementId);
          }
        } else {
          // Single selection
          setSelection([elementId]);
        }
      }
    };

    stage.on("click", handleStageClick);

    // Mouse wheel zoom with viewport store integration
    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const deltaScale = e.evt.deltaY > 0 ? 0.9 : 1.1;
      viewport.zoomAt(pointer.x, pointer.y, deltaScale);

      // Update stage to match viewport store
      stage.scale({ x: viewport.scale, y: viewport.scale });
      stage.position({ x: viewport.x, y: viewport.y });

      // Redraw grid with proper GridRenderer
      if (gridRendererRef.current) {
        gridRendererRef.current.updateOptions({ dpr: window.devicePixelRatio });
      }
    };

    stage.on("wheel", handleWheel);

    // Add stage-level contextmenu handling
    const handleStageContextMenu = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Handle context menu events
    };

    stage.on("contextmenu", handleStageContextMenu);

    // Pan handling when pan tool is active
    let isPanning = false;
    const handleDragStart = () => {
      if (selectedTool === "pan") {
        isPanning = true;
        stage.draggable(true);
      }
    };

    const handleDragMove = () => {
      if (isPanning) {
        const pos = stage.position();
        viewport.setPan(pos.x, pos.y);
        // Grid updates automatically via GridRenderer zoom listeners
      }
    };

    const handleDragEnd = () => {
      if (isPanning) {
        isPanning = false;
        stage.draggable(false);
      }
    };

    stage.on("dragstart", handleDragStart);
    stage.on("dragmove", handleDragMove);
    stage.on("dragend", handleDragEnd);

    // Window resize handler
    const handleResize = () => {
      stage.width(window.innerWidth);
      stage.height(window.innerHeight);
      // Grid updates automatically via GridRenderer
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);

      // Clean up stage event handlers
      stage.off("contextmenu", handleStageContextMenu);

      // Destroy grid renderer
      if (gridRendererRef.current) {
        gridRendererRef.current.destroy();
        gridRendererRef.current = null;
      }

      // Destroy tool manager
      if (toolManagerRef.current) {
        toolManagerRef.current.destroy();
        toolManagerRef.current = null;
      }

      // Dispose renderer modules
      if (rendererDisposeRef.current) {
        rendererDisposeRef.current();
        rendererDisposeRef.current = null;
      }

      // Destroy stage
      stage.destroy();
      stageRef.current = null;
    };
  }, []); // Only run once on mount

  // Update viewport when store changes
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    stage.scale({ x: viewport.scale, y: viewport.scale });
    stage.position({ x: viewport.x, y: viewport.y });

    // Grid updates automatically via GridRenderer zoom listeners
  }, [viewport.scale, viewport.x, viewport.y]);

  // Update cursor and activate tools based on selected tool
  useEffect(() => {
    if (!containerRef.current) return;

    let cursor = "default";
    switch (selectedTool) {
      case "select":
        cursor = "default";
        break;
      case "pan":
        cursor = "grab";
        break;
      case "pen":
      case "marker":
      case "highlighter":
      case "eraser":
        cursor = "crosshair";
        break;
      case "text":
        cursor = "text";
        break;
      case "sticky-note":
      case "sticky":
        cursor = "crosshair";
        break;
      case "rectangle":
      case "ellipse":
      case "circle":
      case "triangle":
      case "line":
        cursor = "crosshair";
        break;
      case "connector":
      case "connector-line":
      case "connector-arrow":
        cursor = "crosshair";
        break;
      case "image":
      case "table":
      case "mindmap":
        cursor = "crosshair";
        break;
      default:
        cursor = "default";
    }

    containerRef.current.style.cursor = cursor;

    // Activate tool through ToolManager if it has a canvas tool implementation
    if (toolManagerRef.current) {
      if (selectedTool === 'text') {
        toolManagerRef.current.activateCanvasTool('text');
      } else {
        // Deactivate any active canvas tool when switching away
        const activeTool = toolManagerRef.current.getActiveCanvasTool();
        if (activeTool) {
          activeTool.detach();
        }
      }
    }
  }, [selectedTool]);

  // Force re-render when elements change (triggers renderer modules via subscription)
  useEffect(() => {
    // Renderer modules subscribe to store changes automatically
    // This effect ensures React stays in sync with store changes
  }, [elements]);

  // Keyboard shortcuts implementation
  useKeyboardShortcuts(
    {
      onDelete: () => {
        // Only delete if there are selected elements
        if (selectedElementIds.size === 0) {
          return;
        }

        // Use withUndo for proper history integration
        if (withUndo && deleteSelected) {
          withUndo("Delete selected elements", () => {
            deleteSelected();
          });
        } else {
          // Fallback: direct element deletion
          const store = useUnifiedCanvasStore.getState();

          // Try multiple deletion methods
          if (store.removeElements) {
            const selectedIds = Array.from(selectedElementIds);
            store.removeElements(selectedIds);
            store.clearSelection?.();
          } else if (store.element?.delete) {
            selectedElementIds.forEach(id => {
              store.element.delete(id);
            });
            store.clearSelection?.();
          } else {
            console.error('[FigJamCanvas] No deletion method available!');
          }
        }
      },
      onUndo: () => {
        undo?.();
      },
      onRedo: () => {
        redo?.();
      },
      onSelectAll: () => {
        // Select all elements
        const allIds = Array.from(elements.keys());
        setSelection(allIds);
      },
      onZoomIn: () => {
        viewport.zoomIn();
      },
      onZoomOut: () => {
        viewport.zoomOut();
      },
      onZoomReset: () => {
        viewport.reset();
      },
      onFitToContent: () => {
        viewport.fitToContent();
      },
      onTool: (toolId: string) => {
        // Switch to the specified tool
        const setSelectedTool =
          useUnifiedCanvasStore.getState().setSelectedTool;
        setSelectedTool(toolId);
      },
    },
    window, // Use window for global keyboard shortcuts instead of container
  );

  // Render tools based on active tool - these handle stage interactions
  const renderActiveTool = useCallback(() => {
    if (!stageRef.current) return null;

    const toolProps = { isActive: true, stageRef };

    // Normalize tool names (handle both old and new naming)
    const normalizedTool = selectedTool.toLowerCase();

    try {
      switch (normalizedTool) {
        // Content tools
        case "sticky-note":
        case "sticky":
          return <StickyNoteTool key="sticky-tool" {...toolProps} />;

        case "text":
          // Text tool now uses canvas tool for event handling, React component is inactive
          return <TextTool key="text-tool" {...toolProps} />;

        case "image":
          return <ImageTool key="image-tool" {...toolProps} />;

        case "table":
          return <TableTool key="table-tool" {...toolProps} />;

        case "mindmap":
          return <MindmapTool key="mindmap-tool" {...toolProps} />;

        // Shape tools
        case "rectangle":
          return (
            <RectangleTool
              key="rectangle-tool"
              {...toolProps}
              toolId={selectedTool}
            />
          );

        case "circle":
        case "ellipse":
          return (
            <CircleTool
              key="circle-tool"
              {...toolProps}
              toolId={selectedTool}
            />
          );

        case "triangle":
          return (
            <TriangleTool
              key="triangle-tool"
              {...toolProps}
              toolId={selectedTool}
            />
          );

        // Connector tools
        case "connector":
        case "connector-line":
        case "connector-arrow":
          return (
            <ConnectorTool
              key="connector-tool"
              {...toolProps}
              toolId={selectedTool as "connector-line" | "connector-arrow"}
            />
          );

        // Drawing tools would go here
        // case 'pen':
        //   return <PenTool key="pen-tool" {...toolProps} />;
        // case 'marker':
        //   return <MarkerTool key="marker-tool" {...toolProps} />;
        // case 'highlighter':
        //   return <HighlighterTool key="highlighter-tool" {...toolProps} />;
        // case 'eraser':
        //   return <EraserTool key="eraser-tool" {...toolProps} />;

        // No tool component needed for select/pan
        case "select":
        case "pan":
        default:
          return null;
      }
    } catch (error) {
      console.error(
        `[FigJamCanvas] Error rendering tool '${selectedTool}':`,
        error,
      );
      return null;
    }
  }, [selectedTool]);

  return (
    <div className="canvas-wrapper">
      <div className="toolbar-container">
        <CanvasToolbar
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          onUndo={undo}
          onRedo={redo}
        />
      </div>
      <div ref={containerRef} className="konva-stage-container" />
      <ZoomControls />

      {/* Render active tool components - these handle stage interactions */}
      {renderActiveTool()}

      {/* Table context menu system */}
      <TableContextMenuManager stageRef={stageRef} />
    </div>
  );
};

export default FigJamCanvas;
