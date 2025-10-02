import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import Konva from "konva";
import type { CanvasElement, ElementId } from "../../../../types";
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
  const viewportScale = useUnifiedCanvasStore((state) => state.viewport.scale);
  const currentTool = selectedTool ?? "select";

  const handleToolSelect = useMemo(() =>
    onSelectTool ||
    ((_toolId: string) => {
      // Tool selection handled
    }), [onSelectTool]);

  const handleUndo = onUndo || (() => store.undo?.());
  const handleRedo = onRedo || (() => store.redo?.());

  // Zoom control handlers
  const getViewportCenter = useCallback(() => {
    if (typeof window === "undefined") {
      return { x: 0, y: 0 };
    }

    const stage = (window as KonvaWindow).konvaStage;
    if (stage) {
      return { x: stage.width() / 2, y: stage.height() / 2 };
    }

    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, []);

  const handleZoomIn = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    const viewport = state.viewport;
    if (!viewport || typeof viewport.zoomIn !== "function") return;
    const center = getViewportCenter();
    viewport.zoomIn(center.x, center.y);
  }, [getViewportCenter]);

  const handleZoomOut = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    const viewport = state.viewport;
    if (!viewport || typeof viewport.zoomOut !== "function") return;
    const center = getViewportCenter();
    viewport.zoomOut(center.x, center.y);
  }, [getViewportCenter]);

  const handleZoomReset = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    // Reset to exactly 100% zoom and center viewport
    state.viewport?.reset?.();
  }, []);

  const performClearCanvas = useCallback(() => {
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

  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClearCanvas = useCallback(() => {
    if (typeof window === "undefined") {
      performClearCanvas();
      return;
    }
    setConfirmingClear(true);
  }, [performClearCanvas]);

  const confirmClearCanvas = useCallback(() => {
    performClearCanvas();
    setConfirmingClear(false);
  }, [performClearCanvas]);

  const cancelClearCanvas = useCallback(() => {
    setConfirmingClear(false);
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
      setConnectorsOpen(false);
      setStickyNoteColorsOpen(false);
    },
    [handleToolSelect],
  );

  const handleStickyClick = useCallback(() => {
    handleToolSelect("sticky-note");
    setShapesOpen(false);
    setConnectorsOpen(false);
    setStickyNoteColorsOpen((prev) => !prev);
  }, [handleToolSelect]);

  const toggleShapesDropdown = useCallback(() => {
    setStickyNoteColorsOpen(false);
    setConnectorsOpen(false);
    setShapesOpen((prev) => !prev);
  }, []);

  const toggleConnectorDropdown = useCallback(() => {
    setStickyNoteColorsOpen(false);
    setShapesOpen(false);
    setConnectorsOpen((prev) => !prev);
  }, []);

  const applyStickyColorToSelection = useCallback((color: string) => {
    const state = useUnifiedCanvasStore.getState();

    const collectSelectedIds = (): ElementId[] => {
      if (typeof state.getSelectedIds === "function") {
        return state.getSelectedIds().map((id) => id as ElementId);
      }

      const { selectedElementIds } = state as {
        selectedElementIds?: Set<ElementId> | ElementId[];
      };

      if (selectedElementIds instanceof Set) {
        return Array.from(selectedElementIds);
      }

      if (Array.isArray(selectedElementIds)) {
        return selectedElementIds as ElementId[];
      }

      return [];
    };

    const selectedIds = collectSelectedIds();
    if (selectedIds.length === 0) return;

    const getElement = (() => {
      if (typeof state.getElement === "function") return state.getElement.bind(state);
      if (state.element && typeof state.element.getById === "function") {
        return state.element.getById.bind(state.element) as (id: ElementId) => CanvasElement | undefined;
      }
      return null;
    })();

    if (!getElement) return;

    const patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }> = [];

    selectedIds.forEach((id) => {
      const element = getElement(id);
      if (!element || element.type !== "sticky-note") return;

      const nextStyle: CanvasElement["style"] = {
        ...(element.style ?? {}),
        fill: color,
      };

      patches.push({
        id,
        patch: {
          fill: color,
          style: nextStyle,
        },
      });
    });

    if (patches.length === 0) return;

    const applyUpdates = () => {
      if (typeof state.updateElements === "function") {
        state.updateElements(patches, { pushHistory: true });
        return;
      }

      if (state.element && typeof state.element.update === "function") {
        patches.forEach(({ id, patch }) => state.element.update(id, patch));
        return;
      }

      if (typeof state.updateElement === "function") {
        patches.forEach(({ id, patch }) => {
          state.updateElement(id, patch, { pushHistory: true });
        });
      }
    };

    if (typeof state.withUndo === "function") {
      state.withUndo("Change sticky note color", applyUpdates);
    } else {
      applyUpdates();
    }
  }, []);

  const handleSelectStickyColor = useCallback((color: string) => {
    applyStickyColorToSelection(color);

    // Update the default sticky note color for NEW sticky notes
    const state = useUnifiedCanvasStore.getState();
    const setUiStickyColor = state.ui?.setStickyNoteColor;
    const setLegacyStickyColor = state.setStickyNoteColor;

    if (typeof setUiStickyColor === "function") {
      setUiStickyColor(color);
    } else if (typeof setLegacyStickyColor === "function") {
      setLegacyStickyColor(color);
    }

    // Close portal, keep tool active for quick placement
    setStickyNoteColorsOpen(false);
  }, [applyStickyColorToSelection]);

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

  const connectorMenuStyle: React.CSSProperties = {
    position: "absolute" as const,
    bottom: "48px",
    left: 0,
    minWidth: 180,
    background: "var(--bg-panel, rgba(255,255,255,0.98))",
    color: "var(--text-primary, #1f2544)",
    border: "1px solid var(--border-subtle, rgba(82,88,126,0.16))",
    borderRadius: 14,
    padding: 8,
    boxShadow: "0 18px 36px rgba(24,25,32,0.18)",
    backdropFilter: "blur(12px) saturate(1.05)",
    WebkitBackdropFilter: "blur(12px) saturate(1.05)",
    zIndex: 60,
  };

  const connectorItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "inherit",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.2s ease, color 0.2s ease, transform 0.2s ease",
    outline: "none",
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
                store.ui?.stickyNoteColor || store.colors?.stickyNote || "#FDE68A",
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
          onClick={toggleShapesDropdown}
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
            onClick={toggleConnectorDropdown}
          >
            {getIcon("mindmap")}
          </button>
          {connectorsOpen && (
            <div
              role="menu"
              style={connectorMenuStyle}
            >
              <button
                type="button"
                style={connectorItemStyle}
                onClick={() => {
                  handleToolSelect("connector-line");
                  setConnectorsOpen(false);
                }}
                title="Connector (Line)"
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(93, 90, 255, 0.12)";
                  event.currentTarget.style.transform = "translateX(2px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.transform = "translateX(0)";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.background = "rgba(93, 90, 255, 0.12)";
                  event.currentTarget.style.transform = "translateX(2px)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.transform = "translateX(0)";
                }}
              >
                Line
              </button>
              <button
                type="button"
                style={connectorItemStyle}
                onClick={() => {
                  handleToolSelect("connector-arrow");
                  setConnectorsOpen(false);
                }}
                title="Connector (Arrow)"
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(93, 90, 255, 0.12)";
                  event.currentTarget.style.transform = "translateX(2px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.transform = "translateX(0)";
                }}
                onFocus={(event) => {
                  event.currentTarget.style.background = "rgba(93, 90, 255, 0.12)";
                  event.currentTarget.style.transform = "translateX(2px)";
                }}
                onBlur={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.transform = "translateX(0)";
                }}
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
          data-testid="zoom-in"
        >
          {getIcon("zoom-in")}
        </button>
        <button
          type="button"
          className="tool-button"
          title="Reset Zoom (100%)"
          onClick={handleZoomReset}
          aria-label="Reset Zoom"
          data-testid="zoom-reset"
          style={{ minWidth: 56 }}
        >
          {Math.round((viewportScale ?? 1) * 100)}%
        </button>
        <button
          type="button"
          className="tool-button"
          title="Zoom Out"
          onClick={handleZoomOut}
          data-testid="zoom-out"
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
        color={store.ui?.stickyNoteColor || store.colors?.stickyNote || "#FDE68A"}
      />
      {confirmingClear && typeof document !== "undefined"
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(22, 24, 35, 0.45)",
                display: "grid",
                placeItems: "center",
                padding: "32px",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: "var(--bg-panel, #ffffff)",
                  color: "var(--text-primary, #1f2544)",
                  padding: "24px",
                  borderRadius: "16px",
                  minWidth: "320px",
                  boxShadow: "0 26px 54px rgba(24,25,32,0.22)",
                  border: "1px solid var(--border-subtle, rgba(82,88,126,0.16))",
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: "18px" }}>Clear canvas?</h3>
                <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>
                  This removes every element from the canvas. You can undo afterwards if you change your mind.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={cancelClearCanvas}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle, rgba(82,88,126,0.16))",
                      background: "transparent",
                      color: "var(--text-secondary, #4c5570)",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmClearCanvas}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #ef4444, #f97316)",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 12px 28px rgba(239, 68, 68, 0.25)",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default CanvasToolbar;

// Legacy export aliases for backward compatibility
export { CanvasToolbar as ModernKonvaToolbar, CanvasToolbar as FigJamToolbar };
type KonvaWindow = Window & { konvaStage?: Konva.Stage };
