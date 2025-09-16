import React, { useState, useRef, useMemo, useCallback } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import ShapesDropdown from '@features/canvas/toolbar/ShapesDropdown';
import { 
  MousePointer, Hand, Type as TypeIcon, StickyNote as StickyNoteLucide, Table as TableLucide,
  Shapes as ShapesLucide, ArrowRight, PenLine, Brush, Highlighter as HighlighterLucide,
  Eraser as EraserLucide, MessageSquare, Undo2, Redo2, GitBranch, Image as ImageIcon, Trash2
} from 'lucide-react';

type ToolbarProps = {
  selectedTool?: string;
  onSelectTool?: (toolId: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitToContent?: () => void;
  onTogglePerf?: () => void;
  stroke?: string;
  fill?: string;
  onChangeStroke?: (color: string) => void;
  onChangeFill?: (color: string) => void;
  variant?: 'modern' | 'figma';
};

// Modern SVG Icon Components with professional styling
const SelectIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 3L11 12L7 13L2 3Z" fill="currentColor"/>
    <path d="M13 7L14.5 5.5L18.5 9.5L17 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const HandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 12V6.5C9 5.67157 9.67157 5 10.5 5S12 5.67157 12 6.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 9V6.5C12 5.67157 12.6716 5 13.5 5S15 5.67157 15 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M15 9.5V7C15 6.17157 15.6716 5.5 16.5 5.5S18 6.17157 18 7V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 12V14.5C9 16.433 10.567 18 12.5 18H15.5C17.433 18 19 16.433 19 14.5V12C19 10.8954 18.1046 10 17 10H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9 12H8C6.89543 12 6 11.1046 6 10V8.5C6 7.67157 6.67157 7 7.5 7S9 7.67157 9 8.5V12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const TextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4H20V8H16V20H8V8H4V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8 8H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 20H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const StickyNoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V16C21 16.5523 20.5523 17 20 17H7L3 21V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 8H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7 12H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const PenIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.232 5.232L18.768 8.768M15.232 5.232L19.5 1.5L22.5 4.5L18.768 8.768M15.232 5.232L5.5 14.964L3 21L9.036 18.5L18.768 8.768" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 8L16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const MarkerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.5 19.5L14.5 9.5L18.5 13.5L8.5 23.5L4.5 21.5V19.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 9.5L17.5 6.5L21.5 10.5L18.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4.5 19.5L6.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const HighlighterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 17L16 7L19 10L9 20L3 21L6 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13 10L16 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="2" y="19" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3"/>
  </svg>
);

const EraserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.5 17H18M7.5 17L2.5 12L10 4.5L19.5 14L14.5 19L7.5 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 14.5L12 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ShapesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="17" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M7 13L10.5 18H3.5L7 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
  </svg>
);

const TableIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 14H21" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 4V20" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M15 4V20" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ConnectorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7 12H17M17 12L14 9M17 12L14 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="19" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const CommentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V14C21 14.5523 20.5523 15 20 15H7L3 19V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 8H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M7 11H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const UndoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 8H14C15.6569 8 17 9.34315 17 11C17 12.6569 15.6569 14 14 14H10M4 8L7 5M4 8L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const RedoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 8H6C4.34315 8 3 9.34315 3 11C3 12.6569 4.34315 14 6 14H10M16 8L13 5M16 8L13 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const getIcon = (toolId: string) => {
  const iconProps = { size: 22, strokeWidth: 2.4 } as const;
  switch(toolId) {
    case 'select': return <MousePointer {...iconProps} />;
    case 'pan': return <Hand {...iconProps} />;
    case 'text': return <TypeIcon {...iconProps} />;
    case 'sticky-note': return <StickyNoteLucide {...iconProps} />;
    case 'table': return <TableLucide {...iconProps} />;
    case 'mindmap': return <GitBranch {...iconProps} />;
    case 'image': return <ImageIcon {...iconProps} />;
    case 'shapes': return <ShapesLucide {...iconProps} />;
    case 'connector-line': return <ArrowRight {...iconProps} />;
    case 'pen': return <PenLine {...iconProps} />;
    case 'marker': return <Brush {...iconProps} />;
    case 'highlighter': return <HighlighterLucide {...iconProps} />;
    case 'eraser': return <EraserLucide {...iconProps} />;
    case 'comment': return <MessageSquare {...iconProps} />;
    case 'undo': return <Undo2 {...iconProps} />;
    case 'redo': return <Redo2 {...iconProps} />;
    case 'clear': return <Trash2 {...iconProps} />;
    default: return null;
  }
};

const CanvasToolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  onSelectTool,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onFitToContent,
  onTogglePerf,
}) => {
  const store = useUnifiedCanvasStore();
  const currentTool = selectedTool ?? 'select';

  const handleToolSelect = onSelectTool || ((toolId: string) => {
    console.log('Tool selected:', toolId);
  });

  const handleUndo = onUndo || (() => store.undo?.());
  const handleRedo = onRedo || (() => store.redo?.());

  const handleClearCanvas = useCallback(() => {
    const ok = typeof window !== 'undefined' ? window.confirm('Clear all items from the canvas? This cannot be undone.') : true;
    if (!ok) return;
    const s: any = useUnifiedCanvasStore.getState();
    const begin = s.history?.beginBatch;
    const end = s.history?.endBatch;
    begin?.('clear-canvas');
    const order: any[] = (s.elementOrder && Array.isArray(s.elementOrder)) ? [...s.elementOrder] : [];
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
      const stages = (Konva as any).stages as Konva.Stage[] | undefined;
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
    } catch {}

    // Force a render by nudging selection version if present
    const set = s as any;
    if (typeof set.bumpSelectionVersion === 'function') set.bumpSelectionVersion();
  }, []);

  const [shapesOpen, setShapesOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const shapesBtnRef = useRef<HTMLButtonElement | null>(null);

  const shapeAnchorRect = useMemo(
    () => shapesBtnRef.current?.getBoundingClientRect() ?? null,
    [shapesOpen]
  );

  const selectAndCloseShapes = useCallback(
    (toolId: string) => {
      handleToolSelect(toolId);
      setShapesOpen(false);
    },
    [handleToolSelect]
  );

  const buttonStyle = (isActive: boolean) => ({
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isActive ? 'rgba(139, 92, 246, 1)' : 'transparent',
    border: 'none',
    borderRadius: '10px',
    color: isActive ? '#ffffff' : '#cbd5e1',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const toolBtn = (id: string, title: string) => (
    <button
      key={id}
      type="button"
      style={buttonStyle(currentTool === id)}
      aria-pressed={currentTool === id}
      aria-label={title}
      title={title}
      data-testid={`tool-${id === 'draw-rectangle' ? 'rectangle' : id}`}
      onClick={() => handleToolSelect(id)}
      onMouseEnter={(e) => {
        if (currentTool !== id) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
        }
      }}
      onMouseLeave={(e) => {
        if (currentTool !== id) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {getIcon(id)}
    </button>
  );

  const itemBtnStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '6px 8px',
    border: 'none',
    background: 'transparent',
    color: '#e5e7eb',
    borderRadius: 6,
    cursor: 'pointer',
  };

  const dividerStyle = {
    width: '1px',
    height: '24px',
    backgroundColor: 'rgba(226, 232, 240, 0.15)',
    margin: '0 6px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {/* Core tools */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {toolBtn('select', 'Select')}
        {toolBtn('pan', 'Pan')}
      </div>

      <div style={dividerStyle} />

      {/* Content tools */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {toolBtn('sticky-note', 'Sticky Note')}
        {toolBtn('text', 'Text')}
        {toolBtn('table', 'Table')}
        {toolBtn('image', 'Image')}
        {toolBtn('draw-rectangle', 'Rectangle')}

        {/* Shapes dropdown */}
        <button
          type="button"
          ref={shapesBtnRef}
          style={buttonStyle(false)}
          aria-expanded={shapesOpen}
          aria-haspopup="menu"
          aria-label="Shapes"
          title="Shapes"
          onClick={() => setShapesOpen((v) => !v)}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}


        >
          {getIcon('shapes')}
        </button>

        {/* Connector dropdown */}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            style={buttonStyle(currentTool === 'connector-line' || currentTool === 'connector-arrow')}
            aria-haspopup="menu"
            aria-label="Connector"
            title="Connector"
            onClick={() => setConnectorsOpen((v) => !v)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = (currentTool === 'connector-line' || currentTool === 'connector-arrow') ? 'rgba(139, 92, 246, 1)' : 'transparent'}
          >
            {getIcon('mindmap')}
          </button>
          {connectorsOpen && (
            <div role="menu" style={{ position: 'absolute', bottom: '48px', left: 0, background: '#111827', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 6, boxShadow: '0 6px 22px rgba(0,0,0,0.35)' }}>
              <button type="button" style={itemBtnStyle} onClick={() => { handleToolSelect('connector-line'); setConnectorsOpen(false); }} title="Connector (Line)">Line</button>
              <button type="button" style={itemBtnStyle} onClick={() => { handleToolSelect('connector-arrow'); setConnectorsOpen(false); }} title="Connector (Arrow)">Arrow</button>
            </div>
          )}
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Drawing tools */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {toolBtn('pen', 'Pen')}
        {toolBtn('marker', 'Marker')}
        {toolBtn('highlighter', 'Highlighter')}
        {toolBtn('eraser', 'Eraser')}
      </div>

      <div style={dividerStyle} />

      {/* Comments */}
      {toolBtn('comment', 'Comment')}

      <div style={dividerStyle} />

      {/* Undo/Redo/Clear */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <button
          type="button"
          style={buttonStyle(false)}
          title="Undo"
          onClick={handleUndo}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {getIcon('undo')}
        </button>
        <button
          type="button"
          style={buttonStyle(false)}
          title="Redo"
          onClick={handleRedo}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {getIcon('redo')}
        </button>
        <button
          type="button"
          style={buttonStyle(false)}
          title="Clear Canvas"
          onClick={handleClearCanvas}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {getIcon('clear')}
        </button>
      </div>

      {/* Popovers/Portals */}
      <ShapesDropdown
        open={shapesOpen}
        anchorRect={shapeAnchorRect}
        onClose={() => setShapesOpen(false)}
        onSelectShape={selectAndCloseShapes}
      />
    </div>
  );
};

export default CanvasToolbar;

// Legacy export aliases for backward compatibility
export { CanvasToolbar as ModernKonvaToolbar, CanvasToolbar as FigJamToolbar };