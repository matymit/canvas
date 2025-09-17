import React, { useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import { setupRenderer } from '../renderer';
import CanvasToolbar from '../toolbar/CanvasToolbar';
import ZoomControls from './ZoomControls';

// Tool imports
import StickyNoteTool from './tools/creation/StickyNoteTool';
import ConnectorTool from './tools/creation/ConnectorTool';
// Add other tool imports as needed

const FigJamCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<{
    background: Konva.Layer | null;
    main: Konva.Layer | null;
    highlighter: Konva.Layer | null;
    preview: Konva.Layer | null;
    overlay: Konva.Layer | null;
  }>({ background: null, main: null, highlighter: null, preview: null, overlay: null });
  const rendererDisposeRef = useRef<(() => void) | null>(null);
  const toolsRef = useRef<{ [key: string]: React.ReactElement | null }>({});

  // Store subscriptions
  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  const selectedTool = useUnifiedCanvasStore((state) => state.selectedTool);
  const elements = useUnifiedCanvasStore((state) => state.elements);
  const selectedElementIds = useUnifiedCanvasStore((state) => state.selectedElementIds);
  
  // Store methods
  const setSelection = useUnifiedCanvasStore((state) => state.setSelection);
  const addToSelection = useUnifiedCanvasStore((state) => state.addToSelection);
  const clearSelection = useUnifiedCanvasStore((state) => state.clearSelection);

  // Initialize stage and renderer system
  useEffect(() => {
    if (!containerRef.current) return;

    console.log('[FigJamCanvas] Initializing stage and renderer system');

    // Create Konva stage
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

    // Setup grid on background layer
    const gridSize = 20;
    const dotRadius = 1;
    const dotColor = '#c0c0c0';

    const gridShape = new Konva.Shape({
      listening: false,
      sceneFunc: (context, shape) => {
        const stage = shape.getStage();
        if (!stage) return;

        const width = stage.width();
        const height = stage.height();
        const scale = stage.scaleX();
        const x = stage.x();
        const y = stage.y();

        const scaledGridSize = gridSize * scale;
        if (scaledGridSize < 5) return; // Don't render if dots are too close

        context.fillStyle = dotColor;

        const startX = Math.floor(-x / scaledGridSize) * scaledGridSize;
        const endX = startX + width + scaledGridSize;
        const startY = Math.floor(-y / scaledGridSize) * scaledGridSize;
        const endY = startY + height + scaledGridSize;

        for (let i = startX; i < endX; i += scaledGridSize) {
          for (let j = startY; j < endY; j += scaledGridSize) {
            context.beginPath();
            context.arc(i, j, dotRadius, 0, 2 * Math.PI);
            context.fill();
          }
        }
      },
    });

    backgroundLayer.add(gridShape);
    backgroundLayer.batchDraw();

    // Setup renderer system - this is the KEY integration
    console.log('[FigJamCanvas] Setting up renderer modules');
    const rendererDispose = setupRenderer(stage, {
      background: backgroundLayer,
      main: mainLayer,
      highlighter: highlighterLayer,
      preview: previewLayer,
      overlay: overlayLayer,
    });
    rendererDisposeRef.current = rendererDispose;

    // Selection handling - click empty space clears, click elements selects
    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // If clicking on empty stage, clear selection
      if (e.target === stage) {
        clearSelection();
        return;
      }

      // If clicking on an element, select it (renderer modules should set element IDs on nodes)
      const clickedNode = e.target;
      const elementId = clickedNode.getAttr('elementId') || clickedNode.id();
      
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

    stage.on('click', handleStageClick);

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
      
      // Redraw grid
      backgroundLayer.batchDraw();
    };

    stage.on('wheel', handleWheel);

    // Pan handling when pan tool is active
    let isPanning = false;
    const handleDragStart = () => {
      if (selectedTool === 'pan') {
        isPanning = true;
        stage.draggable(true);
      }
    };

    const handleDragMove = () => {
      if (isPanning) {
        const pos = stage.position();
        viewport.setPan(pos.x, pos.y);
        backgroundLayer.batchDraw();
      }
    };

    const handleDragEnd = () => {
      if (isPanning) {
        isPanning = false;
        stage.draggable(false);
      }
    };

    stage.on('dragstart', handleDragStart);
    stage.on('dragmove', handleDragMove);
    stage.on('dragend', handleDragEnd);

    // Window resize handler
    const handleResize = () => {
      stage.width(window.innerWidth);
      stage.height(window.innerHeight);
      backgroundLayer.batchDraw();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      console.log('[FigJamCanvas] Cleaning up stage and renderer');
      window.removeEventListener('resize', handleResize);
      
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
    
    // Redraw background for grid updates
    layersRef.current.background?.batchDraw();
  }, [viewport.scale, viewport.x, viewport.y]);

  // Update cursor based on selected tool
  useEffect(() => {
    if (!containerRef.current) return;

    let cursor = 'default';
    switch (selectedTool) {
      case 'select':
        cursor = 'default';
        break;
      case 'pan':
        cursor = 'grab';
        break;
      case 'pen':
      case 'marker':
      case 'highlighter':
      case 'eraser':
        cursor = 'crosshair';
        break;
      case 'text':
        cursor = 'text';
        break;
      case 'sticky-note':
        cursor = 'crosshair';
        break;
      case 'rectangle':
      case 'ellipse':
      case 'triangle':
      case 'line':
      case 'connector':
        cursor = 'crosshair';
        break;
      default:
        cursor = 'crosshair';
    }

    containerRef.current.style.cursor = cursor;
  }, [selectedTool]);

  // Force re-render when elements change (triggers renderer modules via subscription)
  useEffect(() => {
    // Renderer modules subscribe to store changes automatically
    // This effect ensures React stays in sync with store changes
    console.log(`[FigJamCanvas] Elements changed: ${elements.size} total`);
  }, [elements]);

  // Render tools based on active tool - these handle stage interactions
  const renderActiveTool = useCallback(() => {
    if (!stageRef.current) return null;

    switch (selectedTool) {
      case 'sticky-note':
        return (
          <StickyNoteTool
            key="sticky-note-tool"
            isActive={true}
            stageRef={stageRef}
          />
        );
      case 'connector':
      case 'connector-line':
      case 'connector-arrow':
        return (
          <ConnectorTool
            key="connector-tool"
            isActive={true}
            stageRef={stageRef}
            toolId={selectedTool}
          />
        );
      // Add other tools as needed
      default:
        return null;
    }
  }, [selectedTool]);

  return (
    <div className="canvas-wrapper">
      <CanvasToolbar />
      <div ref={containerRef} className="konva-stage-container" />
      <ZoomControls />
      
      {/* Render active tool components - these handle stage interactions */}
      {renderActiveTool()}
    </div>
  );
};

export default FigJamCanvas;