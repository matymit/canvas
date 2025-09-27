import React, { useEffect, useRef, useCallback, useMemo } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import { StoreActions } from "../stores/facade";
import { setupRenderer } from "../renderer";
import CanvasToolbar from "../toolbar/CanvasToolbar";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import GridRenderer from "./GridRenderer";
import { debug, error as logError } from "../../../utils/debug";
import { RafBatcher } from "../utils/performance/RafBatcher";
import { clipboard } from "../utils/clipboard";
import { useMindmapOperations } from "../utils/mindmap/mindmapOperations";

// Import cell editor for table functionality
import "../utils/editors/openCellEditorWithTracking";

// Import table context menu manager
import { TableContextMenuManager } from "./table/TableContextMenuManager";
import { MindmapContextMenuManager } from "./menus/MindmapContextMenuManager";

// Import general canvas context menu manager
import { CanvasContextMenuManager } from "./CanvasContextMenuManager";

// Import ImageDragHandler for image drag functionality
import ImageDragHandler from "./tools/selection/ImageDragHandler";
import { useShallow } from "zustand/react/shallow";

// Tool imports - all major tools
import StickyNoteTool from "./tools/creation/StickyNoteTool";
import ConnectorTool from "./tools/creation/ConnectorTool";
import TextTool, { TextCanvasTool } from "./tools/content/TextTool";
import ImageTool from "./tools/content/ImageTool";
import TableTool from "./tools/content/TableTool";
import MindmapTool from "./tools/content/MindmapTool";
import CircleTool from "./tools/shapes/CircleTool";
// Rectangle and Triangle tools have been archived as they are no longer used
import ToolManager from "../managers/ToolManager";
// Drawing tools
import { PenTool } from "./tools/drawing/PenTool";
import MarkerTool from "./tools/drawing/MarkerTool";
import HighlighterTool from "./tools/drawing/HighlighterTool";
import EraserTool from "./tools/drawing/EraserTool";
// Navigation tools
import MarqueeSelectionTool from "./tools/navigation/MarqueeSelectionTool";
import PanTool from "./tools/navigation/PanTool";

const FigJamCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafBatcherRef = useRef(new RafBatcher());
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<{
    background: Konva.Layer | null;
    main: Konva.Layer | null;
    highlighter: Konva.Group | null;
    preview: Konva.Layer | null;
    overlay: Konva.Layer | null;
  }>({
    background: null,
    main: null,
    highlighter: null,
    preview: null,
    overlay: null,
  });
  // Stable connector layers object to avoid re-creating on each render
  const connectorLayersRef = useRef<{
    main: Konva.Layer;
    preview: Konva.Layer;
    overlay: Konva.Layer;
  } | null>(null);
  const rendererDisposeRef = useRef<(() => void) | null>(null);
  const toolManagerRef = useRef<ToolManager | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const imageDragHandlerRef = useRef<ImageDragHandler | null>(null);

  // Store subscriptions - subscribe to viewport with custom comparison to detect nested changes
  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  const { viewportX, viewportY, viewportScale } = useUnifiedCanvasStore(
    useShallow((state) => ({
      viewportX: state.viewport.x,
      viewportY: state.viewport.y,
      viewportScale: state.viewport.scale,
    })),
  );
  const canvasBackgroundStyle = useMemo(() => {
    const spacing = 20 * viewportScale;
    return {
      backgroundPosition: `${-viewportX}px ${-viewportY}px`,
      backgroundSize: `${spacing}px ${spacing}px`,
    } as React.CSSProperties;
  }, [viewportX, viewportY, viewportScale]);
  const selectedTool = useUnifiedCanvasStore((state) => state.ui?.selectedTool);
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

  // FIXED: Initialize stage and renderer system ONLY ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    debug("Initializing stage and renderer - ONE TIME ONLY", {
      category: "FigJamCanvas",
    });

    // Create Konva stage - THIS IS THE ONLY PLACE WHERE KONVA.STAGE SHOULD BE CREATED
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      draggable: false,
    });

    stageRef.current = stage;

    // Expose stage globally for E2E testing
    (window as unknown as Record<string, unknown>).konvaStage = stage;

    // Create the five-layer system
    const backgroundLayer = new Konva.Layer({ listening: false }); // Grid, non-interactive
    const mainLayer = new Konva.Layer({ listening: true }); // All committed elements
    const highlighterGroup = new Konva.Group({ listening: false }); // Highlighter strokes (behind committed elements)
    mainLayer.add(highlighterGroup);
    const previewLayer = new Konva.Layer({ listening: false }); // Tool previews, ephemeral
    const overlayLayer = new Konva.Layer({ listening: true }); // Selection handles, guides

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

    // Add layers to stage in correct order
    stage.add(backgroundLayer);
    stage.add(mainLayer);
    stage.add(previewLayer);
    stage.add(overlayLayer); // Always on top

    // Setup FigJam-style grid on background layer
    // Match the CSS styling: radial-gradient(circle at 1px 1px, #d0d0d0 1px, transparent 1px)
    const gridRenderer = new GridRenderer(stage, backgroundLayer, {
      spacing: 20, // 20px spacing to match CSS background-size
      dotRadius: 0.75, // Slightly smaller than 1px for better visual match
      color: "#d0d0d0", // Exact color from CSS
      opacity: 1,
      cacheLayer: true, // Cache for performance
      recacheOnZoom: true, // Recache on zoom for crisp dots
      hugeRectSize: 100000, // Large coverage area
    });

    gridRendererRef.current = gridRenderer;

    // Setup renderer system - this is the KEY integration
    const rendererDispose = setupRenderer(stage, {
      background: backgroundLayer,
      main: mainLayer,
      highlighter: highlighterGroup,
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
    toolManager.registerCanvasTool("text", textCanvasTool);

    // Setup ImageDragHandler for image drag functionality
    const imageDragHandler = new ImageDragHandler(stage);
    imageDragHandlerRef.current = imageDragHandler;

    // Window resize handler: resize stage only, preserve user's zoom level
    const handleResize = () => {
      const state = useUnifiedCanvasStore.getState();
      const viewportState = state.viewport;
      let worldCenter: { x: number; y: number } | null = null;

      if (typeof viewportState?.stageToWorld === 'function') {
        const currentWidth = stage.width();
        const currentHeight = stage.height();
        worldCenter = viewportState.stageToWorld(currentWidth / 2, currentHeight / 2);
      }

      stage.width(window.innerWidth);
      stage.height(window.innerHeight);

      if (
        worldCenter &&
        typeof viewportState?.setPan === 'function' &&
        typeof viewportState.scale === 'number'
      ) {
        const newPanX = window.innerWidth / 2 - worldCenter.x * viewportState.scale;
        const newPanY = window.innerHeight / 2 - worldCenter.y * viewportState.scale;
        viewportState.setPan(newPanX, newPanY);
      }

      // FIXED: Do not call fitToContent - preserve user's manual zoom settings
      // Only update grid DPR for crisp rendering on new window size
      gridRenderer.updateOptions({ dpr: window.devicePixelRatio });
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      debug("Cleaning up stage and renderer", { category: "FigJamCanvas" });
      window.removeEventListener("resize", handleResize);

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

      // Clean up image drag handler
      if (imageDragHandlerRef.current) {
        imageDragHandlerRef.current.cleanup();
        imageDragHandlerRef.current = null;
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
  }, []); // FIXED: Empty dependency array - initialize only once

  // FIXED: Attach stage event handlers once; read store/state at call time to avoid rebind thrash
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    debug("Setting up stage event handlers", { category: "FigJamCanvas" });

    // Selection handling - click empty space clears, click elements selects
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      const tool = useUnifiedCanvasStore.getState().ui?.selectedTool as
        | string
        | undefined;

      // If clicking on empty stage, ALWAYS clear selection regardless of current tool
      if (e.target === stage) {
        StoreActions.clearSelection?.();
        return;
      }

      // Skip element selection if not in select mode
      if (tool !== "select") return;

      // If clicking on an element, select it (renderer modules should set element IDs on nodes)
      const clickedNode = e.target;
      let elementId = clickedNode.getAttr("elementId") || clickedNode.id();

      // If no elementId on the clicked node, check its parent (for clicking on child nodes like image bitmaps)
      if (!elementId && clickedNode.parent) {
        const parent = clickedNode.parent;
        elementId = parent.getAttr("elementId") || parent.id();
      }

      const s = useUnifiedCanvasStore.getState();
      const els = s.elements as Map<string, unknown>;
      if (elementId && els?.has?.(elementId)) {
        if (e.evt.ctrlKey || e.evt.metaKey) {
          const selectedIds = s.selectedElementIds as
            | Set<string>
            | string[]
            | undefined;
          const isSelected =
            selectedIds instanceof Set
              ? selectedIds.has(elementId)
              : Array.isArray(selectedIds)
                ? selectedIds.includes(elementId)
                : false;
          if (isSelected) {
            // remove
            const next =
              selectedIds instanceof Set
                ? new Set(selectedIds)
                : new Set<string>(selectedIds as string[]);
            next.delete(elementId);
            (s.setSelection || s.selection?.set)?.(Array.from(next));
          } else {
            (s.addToSelection || s.selection?.toggle || s.selection?.set)?.(
              elementId,
            );
          }
        } else {
          (s.setSelection || s.selection?.set)?.([elementId]);
        }
      }
    };

    // Mouse wheel zoom with viewport store integration
    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const deltaScale = e.evt.deltaY > 0 ? 0.9 : 1.1;
      const vp = useUnifiedCanvasStore.getState().viewport;
      vp?.zoomAt?.(pointer.x, pointer.y, deltaScale);

      // Let viewport sync useEffect handle stage updates for consistency

      // Redraw grid with proper GridRenderer
      if (gridRendererRef.current) {
        gridRendererRef.current.updateOptions({ dpr: window.devicePixelRatio });
      }
    };

    // Add stage-level contextmenu handling
    const handleStageContextMenu = (_e: Konva.KonvaEventObject<MouseEvent>) => {
      // Handle context menu events
    };

    // Pan handling is now managed by PanTool component
    // Removed the buggy drag-based implementation

    stage.on("click", handleStageClick);
    stage.on("wheel", handleWheel);
    stage.on("contextmenu", handleStageContextMenu);
    // Pan tool drag events are handled by PanTool component

    // Cleanup event handlers
    return () => {
      debug("Cleaning up stage event handlers", { category: "FigJamCanvas" });
      stage.off("click", handleStageClick);
      stage.off("wheel", handleWheel);
      stage.off("contextmenu", handleStageContextMenu);
      // Pan tool drag cleanup is handled by PanTool component
    };
  }, [selectedTool]); // FIXED: Only depend on selectedTool; read store values at call time to prevent infinite loops

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
      case "draw-rectangle":
      case "ellipse":
      case "circle":
      case "draw-circle":
      case "triangle":
      case "draw-triangle":
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
      if (selectedTool === "text") {
        toolManagerRef.current.activateCanvasTool("text");
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

  // Custom keyboard handler for mindmap-specific shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Enter key for mindmap child creation
      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        // Check if exactly one mindmap node is selected
        if (selectedElementIds.size === 1) {
          const nodeId = Array.from(selectedElementIds)[0];
          const store = useUnifiedCanvasStore.getState();
          const getElement = store.getElement || store.element?.getById;
          const element = getElement?.(nodeId);

          if (element && element.type === "mindmap-node") {
            // Prevent default behavior and create child node
            event.preventDefault();
            mindmapOps.createChildNode(nodeId);
            return;
          }
        }
      }

      // Handle Cmd/Ctrl + Shift + D for subtree duplication
      if (event.key === "d" || event.key === "D") {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
          if (selectedElementIds.size === 1) {
            const nodeId = Array.from(selectedElementIds)[0];
            const store = useUnifiedCanvasStore.getState();
            const getElement = store.getElement || store.element?.getById;
            const element = getElement?.(nodeId);

            if (element && element.type === "mindmap-node") {
              event.preventDefault();
              mindmapOps.duplicateNode(nodeId, { includeDescendants: true });
              return;
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElementIds, mindmapOps]);

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
            selectedElementIds.forEach((id) => {
              store.element.delete(id);
            });
            store.clearSelection?.();
          } else {
            // Error: No deletion method available
          }
        }
      },
      onCopy: () => {
        // Copy selected elements to clipboard
        if (selectedElementIds.size > 0) {
          const elements = Array.from(selectedElementIds)
            .map(id => {
              const store = useUnifiedCanvasStore.getState();
              return store.element?.getById ? store.element.getById(id) : store.elements?.get(id);
            })
            .filter(el => el !== undefined);
          if (elements.length > 0) {
            clipboard.copy(elements);
          }
        }
      },
      onPaste: () => {
        // Paste elements from clipboard
        if (clipboard.hasContent()) {
          const store = useUnifiedCanvasStore.getState();
          const addElement = store.addElement;
          const setSelection = store.selection?.set || store.setSelection;

          if (withUndo && addElement) {
            withUndo("Paste elements", () => {
              const newIds: string[] = [];
              const elementsToCreate = clipboard.paste();
              elementsToCreate.forEach((element, index) => {
                const clone = { ...element };
                const newId = crypto?.randomUUID?.() ?? `${element.id}-paste-${Date.now()}-${index}`;
                clone.id = newId;

                // Apply offset so pasted elements don't overlap originals
                const offset = 20 + (index * 5);
                if (typeof clone.x === 'number') clone.x += offset;
                if (typeof clone.y === 'number') clone.y += offset;

                // Handle points array for paths/lines
                if (Array.isArray(clone.points) && clone.points.length >= 2) {
                  const shifted: number[] = [];
                  for (let i = 0; i < clone.points.length; i += 2) {
                    shifted.push(clone.points[i] + offset, clone.points[i + 1] + offset);
                  }
                  clone.points = shifted;
                }

                addElement(clone, { select: true });
                newIds.push(newId);
              });

              // Select the newly pasted elements
              if (setSelection && newIds.length > 0) {
                setSelection(newIds);
              }
            });
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
          useUnifiedCanvasStore.getState().ui?.setSelectedTool;
        setSelectedTool?.(toolId);
      },
      onDuplicate: () => {
        // Handle duplication - check if selected elements are mindmap nodes
        if (selectedElementIds.size === 1) {
          const nodeId = Array.from(selectedElementIds)[0];
          const store = useUnifiedCanvasStore.getState();
          const getElement = store.getElement || store.element?.getById;
          const element = getElement?.(nodeId);

          if (element && element.type === "mindmap-node") {
            mindmapOps.duplicateNode(nodeId, { includeDescendants: false });
            return;
          }
        }

        // Fallback to regular duplication for non-mindmap elements
        if (selectedElementIds.size > 0) {
          const store = useUnifiedCanvasStore.getState();
          const duplicateElement = store.duplicateElement || store.element?.duplicate;

          if (withUndo && duplicateElement) {
            withUndo("Duplicate elements", () => {
              selectedElementIds.forEach(id => {
                duplicateElement(id);
              });
            });
          }
        }
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

    // debug("Rendering tool", { category: 'FigJamCanvas', data: { selectedTool, normalizedTool } });

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
        case "circle":
        case "ellipse":
        case "draw-circle":
          return (
            <CircleTool
              key="circle-tool"
              {...toolProps}
              toolId={selectedTool}
            />
          );

        // Rectangle and Triangle tools have been archived as they are no longer used
        case "rectangle":
        case "draw-rectangle":
        case "triangle":
        case "draw-triangle":
          return null; // These tools are no longer available

        // Connector tools
        case "connector":
        case "connector-line":
        case "connector-arrow": {
          const lyr = connectorLayersRef.current;
          if (!stageRef.current || !lyr) return null;
          return (
            <ConnectorTool
              key="connector-tool"
              {...toolProps}
              toolId={selectedTool as "connector-line" | "connector-arrow"}
              layers={lyr}
            />
          );
        }

        // Drawing tools
        case "pen":
          return (
            <PenTool
              key="pen-tool"
              {...toolProps}
              rafBatcher={rafBatcherRef.current}
            />
          );
        case "marker":
          return (
            <MarkerTool
              key="marker-tool"
              {...toolProps}
              rafBatcher={rafBatcherRef.current}
            />
          );
        case "highlighter":
          return (
            <HighlighterTool
              key="highlighter-tool"
              {...toolProps}
              rafBatcher={rafBatcherRef.current}
            />
          );
        case "eraser":
          return (
            <EraserTool
              key="eraser-tool"
              {...toolProps}
              rafBatcher={rafBatcherRef.current}
            />
          );

        // No tool component needed for select
        case "select":
        default:
          return null;
      }
    } catch (error) {
      logError("Failed to render tool", {
        category: "FigJamCanvas",
        data: { selectedTool, error },
      });
      return null;
    }
  }, [selectedTool]);

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
      {renderActiveTool()}

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

      {/* Table context menu system */}
      <TableContextMenuManager stageRef={stageRef} />

      {/* Mindmap context menu system */}
      <MindmapContextMenuManager stageRef={stageRef} />

      {/* General canvas context menu system */}
      <CanvasContextMenuManager stageRef={stageRef} />
    </div>
  );
};

export default FigJamCanvas;
