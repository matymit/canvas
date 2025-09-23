import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../stores/unifiedCanvasStore";
import { StoreActions } from "../stores/facade";
import ShapesDropdown from "@features/canvas/toolbar/ShapesDropdown";
import UnifiedColorPicker from "@features/canvas/components/UnifiedColorPicker";
import {
  MousePointer,
  Hand,
  Type as TypeIcon,
  StickyNote as StickyNoteLucide,
  Table as TableLucide,
  Shapes as ShapesLucide,
  ArrowRight,
  PenLine,
  Brush,
  Highlighter as HighlighterLucide,
  Eraser as EraserLucide,
  Undo2,
  Redo2,
  GitBranch,
  Image as ImageIcon,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type ToolbarProps = {
  selectedTool?: string;
  onSelectTool?: (toolId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onTogglePerf?: () => void;
  stroke?: string;
  fill?: string;
  onChangeStroke?: (color: string) => void;
  onChangeFill?: (color: string) => void;
  variant?: "modern" | "figma";
};

const getIcon = (toolId: string) => {
  const iconProps = { size: 22, strokeWidth: 2.4 } as const;
  switch (toolId) {
    case "select":
      return <MousePointer {...iconProps} />;
    case "pan":
      return <Hand {...iconProps} />;
    case "text":
      return <TypeIcon {...iconProps} />;
    case "sticky-note":
      return <StickyNoteLucide {...iconProps} />;
    case "table":
      return <TableLucide {...iconProps} />;
    case "mindmap":
      return <GitBranch {...iconProps} />;
    case "image":
      return <ImageIcon {...iconProps} />;
    case "shapes":
      return <ShapesLucide {...iconProps} />;
    case "connector-line":
      return <ArrowRight {...iconProps} />;
    case "pen":
      return <PenLine {...iconProps} />;
    case "marker":
      return <Brush {...iconProps} />;
    case "highlighter":
      return <HighlighterLucide {...iconProps} />;
    case "eraser":
      return <EraserLucide {...iconProps} />;
    case "undo":
      return <Undo2 {...iconProps} />;
    case "redo":
      return <Redo2 {...iconProps} />;
    case "clear":
      return <Trash2 {...iconProps} />;
    case "zoom-in":
      return <ZoomIn {...iconProps} />;
    case "zoom-out":
      return <ZoomOut {...iconProps} />;
    default:
      return null;
  }
};

const CanvasToolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onSelectTool,
  onUndo,
  onRedo,
}) => {
  const store = useUnifiedCanvasStore();
  const currentTool = selectedTool ?? "select";

  const handleToolSelect = useMemo(() =>
    onSelectTool ||
    ((_toolId: string) => {
      // Tool selection handled
    }), [onSelectTool]);

  const handleUndo = onUndo || (() => store.undo?.());
  const handleRedo = onRedo || (() => store.redo?.());

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    state.viewport?.zoomIn?.();
  }, []);

  const handleZoomOut = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    state.viewport?.zoomOut?.();
  }, []);

  const handleZoomReset = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    // Reset to 100%
    state.viewport?.setScale?.(1);
    // Fit to content neatly with padding
    state.viewport?.fitToContent?.(40);
  }, []);

  const handleClearCanvas = useCallback(() => {
    const ok =
      typeof window !== "undefined"
        ? window.confirm(
            "Clear all items from the canvas? This cannot be undone.",
          )
        : true;
    if (!ok) return;
    const s = useUnifiedCanvasStore.getState();
    const begin = s.history?.beginBatch;
    const end = s.history?.endBatch;
    begin?.("clear-canvas");
    const order: string[] =
      s.elementOrder && Array.isArray(s.elementOrder)
        ? [...s.elementOrder]
        : [];
    if (order.length > 0 && s.removeElements) {
      s.removeElements(order, { pushHistory: true, deselect: true });
    } else {
      const ids = order.length ? order : Array.from(s.elements?.keys?.() || []);
      const del = s.element?.delete || s.removeElement || s.elements?.delete;
      ids.forEach((id) => del?.(id));
    }
    (s.selection?.clear || s.clearSelection)?.();
    end?.(true);

    // Clear Konva main/preview/overlay layers immediately (keep background)
    try {
      const stages = (Konva as { stages?: Konva.Stage[] }).stages;
      const stage = stages && stages.length > 0 ? stages[0] : undefined;
      if (stage) {
        const layers = stage.getLayers();
        // Start from index 1 to keep background grid (index 0)
        for (let i = 1; i < layers.length; i++) {
          const ly = layers[i];
          ly.destroyChildren();
          ly.batchDraw();
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Force a render by nudging selection version if present
    StoreActions.bumpSelectionVersion?.();
  }, []);

  const [shapesOpen, setShapesOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [stickyNoteColorsOpen, setStickyNoteColorsOpen] = useState(false);
  const [shapeAnchorRect, setShapeAnchorRect] = useState<DOMRect | null>(null);
  const [stickyNoteAnchorRect, setStickyNoteAnchorRect] =
    useState<DOMRect | null>(null);
  const shapesBtnRef = useRef<HTMLButtonElement | null>(null);
  const stickyNoteBtnRef = useRef<HTMLButtonElement | null>(null);

  const updateShapeAnchorRect = useCallback(() => {
    if (!shapesBtnRef.current) return;
    const nextRect = shapesBtnRef.current.getBoundingClientRect();
    setShapeAnchorRect((current) => {
      if (!current) return nextRect;
      if (
        current.top !== nextRect.top ||
        current.left !== nextRect.left ||
        current.width !== nextRect.width ||
        current.height !== nextRect.height
      ) {
        return nextRect;
      }
      return current;
    });
  }, []);

  const updateStickyNoteAnchorRect = useCallback(() => {
    if (!stickyNoteBtnRef.current) return;
    const nextRect = stickyNoteBtnRef.current.getBoundingClientRect();
    setStickyNoteAnchorRect((current) => {
      if (!current) return nextRect;
      if (
        current.top !== nextRect.top ||
        current.left !== nextRect.left ||
        current.width !== nextRect.width ||
        current.height !== nextRect.height
      ) {
        return nextRect;
      }
      return current;
    });
  }, []);

  useLayoutEffect(() => {
    updateShapeAnchorRect();
    if (!shapesOpen) return;

    const handleWindowChange = () => updateShapeAnchorRect();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleWindowChange);
      window.addEventListener("scroll", handleWindowChange, true);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleWindowChange);
        window.removeEventListener("scroll", handleWindowChange, true);
      }
    };
  }, [shapesOpen, updateShapeAnchorRect]);

  useLayoutEffect(() => {
    updateStickyNoteAnchorRect();
    if (!stickyNoteColorsOpen) return;

    const handleWindowChange = () => updateStickyNoteAnchorRect();

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleWindowChange);
      window.addEventListener("scroll", handleWindowChange, true);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleWindowChange);
        window.removeEventListener("scroll", handleWindowChange, true);
      }
    };
  }, [stickyNoteColorsOpen, updateStickyNoteAnchorRect]);

  const selectAndCloseShapes = useCallback(
    (toolId: string) => {
      handleToolSelect(toolId);
      setShapesOpen(false);
    },
    [handleToolSelect],
  );

  const handleStickyClick = useCallback(() => {
    handleToolSelect("sticky-note");
    setStickyNoteColorsOpen(true);
  }, [handleToolSelect]);

  const handleSelectStickyColor = useCallback((color: string) => {

    // For now, skip updating existing elements since they're not in the store
    // applyStickyColorToSelection(color);

    // Update the default sticky note color for NEW sticky notes
    const state = useUnifiedCanvasStore.getState();
    if (state.setStickyNoteColor) {
      state.setStickyNoteColor(color);
      // Updated default sticky note color
    }

    // Close portal, keep tool active for quick placement
    setStickyNoteColorsOpen(false);
  }, []);

  // Removed buttonStyle - now using CSS classes

  const toolBtn = (id: string, title: string) => (
    <button
      key={id}
      type="button"
      className={`tool-button ${currentTool === id ? "active" : ""}`}
      aria-pressed={currentTool === id}
      aria-label={title}
      title={title}
      data-testid={`tool-${id === "draw-rectangle" ? "rectangle" : id}`}
      onClick={() => handleToolSelect(id)}
    >
      {getIcon(id)}
    </button>
  );

  const itemBtnStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    border: "none",
    background: "transparent",
    color: "#e5e7eb",
    borderRadius: 6,
    cursor: "pointer",
  };

  return (
    <>
      {/* Core tools */}
      <div className="toolbar-group">
        {toolBtn("select", "Select")}
        {toolBtn("pan", "Pan")}
      </div>

      {/* Content tools */}
      <div className="toolbar-group">
        {/* Sticky Note with color dropdown */}
        <button
          type="button"
          ref={stickyNoteBtnRef}
          className={`tool-button ${currentTool === "sticky-note" ? "active" : ""}`}
          aria-expanded={stickyNoteColorsOpen}
          aria-haspopup="menu"
          aria-label="Sticky Note Colors"
          title="Sticky Note"
          data-testid="tool-sticky-note"
          onClick={handleStickyClick}
        >
          {getIcon("sticky-note")}
          <div
            style={{
              position: "absolute" as const,
              bottom: "2px",
              right: "2px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor:
                store.stickyNoteColor || store.colors?.stickyNote || "#FDE68A",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
          />
        </button>
        {toolBtn("text", "Text")}
        {toolBtn("table", "Table")}
        {toolBtn("image", "Image")}

        {/* Shapes dropdown */}
        <button
          type="button"
          ref={shapesBtnRef}
          className="tool-button"
          aria-expanded={shapesOpen}
          aria-haspopup="menu"
          aria-label="Shapes"
          title="Shapes"
          onClick={() => setShapesOpen((v) => !v)}
        >
          {getIcon("shapes")}
        </button>

        {/* Connector dropdown */}
        <div style={{ position: "relative" as const, display: "inline-flex" }}>
          <button
            type="button"
            className={`tool-button ${
              currentTool === "connector-line" ||
              currentTool === "connector-arrow"
                ? "active"
                : ""
            }`}
            aria-haspopup="menu"
            aria-label="Connector"
            title="Connector"
            onClick={() => setConnectorsOpen((v) => !v)}
          >
            {getIcon("mindmap")}
          </button>
          {connectorsOpen && (
            <div
              role="menu"
              style={{
                position: "absolute" as const,
                bottom: "48px",
                left: 0,
                background: "#111827",
                color: "#e5e7eb",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 6,
                boxShadow: "0 6px 22px rgba(0,0,0,0.35)",
              }}
            >
              <button
                type="button"
                style={itemBtnStyle}
                onClick={() => {
                  handleToolSelect("connector-line");
                  setConnectorsOpen(false);
                }}
                title="Connector (Line)"
              >
                Line
              </button>
              <button
                type="button"
                style={itemBtnStyle}
                onClick={() => {
                  handleToolSelect("connector-arrow");
                  setConnectorsOpen(false);
                }}
                title="Connector (Arrow)"
              >
                Arrow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawing tools */}
      <div className="toolbar-group">
        {toolBtn("pen", "Pen")}
        {toolBtn("marker", "Marker")}
        {toolBtn("highlighter", "Highlighter")}
        {toolBtn("eraser", "Eraser")}
      </div>

      {/* Undo/Redo/Clear */}
      <div className="toolbar-group">
        <button
          type="button"
          className="tool-button"
          title="Undo"
          onClick={handleUndo}
        >
          {getIcon("undo")}
        </button>
        <button
          type="button"
          className="tool-button"
          title="Redo"
          onClick={handleRedo}
        >
          {getIcon("redo")}
        </button>
        <button
          type="button"
          className="tool-button"
          title="Clear Canvas"
          onClick={handleClearCanvas}
        >
          {getIcon("clear")}
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="toolbar-group">
        <button
          type="button"
          className="tool-button"
          title="Zoom In"
          onClick={handleZoomIn}
          data-testid="toolbar-zoom-in"
        >
          {getIcon("zoom-in")}
        </button>
        <button
          type="button"
          className="tool-button"
          title="Reset Zoom (100%)"
          onClick={handleZoomReset}
          aria-label="Reset Zoom"
          data-testid="toolbar-zoom-indicator"
          style={{ minWidth: 56 }}
        >
          {Math.round(((useUnifiedCanvasStore.getState().viewport?.scale) ?? 1) * 100)}%
        </button>
        <button
          type="button"
          className="tool-button"
          title="Zoom Out"
          onClick={handleZoomOut}
          data-testid="toolbar-zoom-out"
        >
          {getIcon("zoom-out")}
        </button>
      </div>

      {/* Popovers/Portals */}
      <ShapesDropdown
        open={shapesOpen}
        anchorRect={shapeAnchorRect}
        onClose={() => setShapesOpen(false)}
        onSelectShape={selectAndCloseShapes}
      />
      <UnifiedColorPicker
        open={stickyNoteColorsOpen}
        mode="figma-horizontal"
        anchorRect={stickyNoteAnchorRect}
        onClose={() => setStickyNoteColorsOpen(false)}
        onChange={handleSelectStickyColor}
        color={store.stickyNoteColor || store.colors?.stickyNote || "#FDE68A"}
      />
    </>
  );
};

export default CanvasToolbar;

// Legacy export aliases for backward compatibility
export { CanvasToolbar as ModernKonvaToolbar, CanvasToolbar as FigJamToolbar };
