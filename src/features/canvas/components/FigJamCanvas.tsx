import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import CanvasToolbar from '../toolbar/CanvasToolbar';
import ZoomControls from './ZoomControls';

const FigJamCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const layersRef = useRef<{
    grid: Konva.Layer | null;
    main: Konva.Layer | null;
    overlay: Konva.Layer | null;
  }>({ grid: null, main: null, overlay: null });

  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  const selectedTool = useUnifiedCanvasStore((state) => state.selectedTool);
  const strokeColor = useUnifiedCanvasStore((state) => state.strokeColor);
  const strokeWidth = useUnifiedCanvasStore((state) => state.strokeWidth);
  const fillColor = useUnifiedCanvasStore((state) => state.fillColor);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Konva stage
    const stage = new Konva.Stage({
      container: containerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      draggable: false,
    });

    stageRef.current = stage;

    // Create layers
    const gridLayer = new Konva.Layer();
    const mainLayer = new Konva.Layer();
    const overlayLayer = new Konva.Layer();

    layersRef.current = {
      grid: gridLayer,
      main: mainLayer,
      overlay: overlayLayer,
    };

    // Add grid pattern using a single cached shape for performance
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

    gridLayer.add(gridShape);

    const updateGrid = () => {
      if (!gridLayer) return;
      gridLayer.batchDraw();
    };
    stage.add(gridLayer);
    stage.add(mainLayer);
    stage.add(overlayLayer);

    updateGrid();

    // Mouse wheel zoom
    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();

      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1;

      stage.scale({ x: newScale, y: newScale });
      viewport.setScale(newScale);

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      stage.position(newPos);
      viewport.setPan(newPos.x, newPos.y);

      updateGrid();
    });

    // Drawing state management
    let isDrawing = false;
    let isPanning = false;
    let currentLine: Konva.Line | null = null;

    const handleMouseDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const tool = selectedTool;

      // Pan tool
      if (tool === 'pan') {
        isPanning = true;
        stage.draggable(true);
        return;
      }

      stage.draggable(false);

      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };

      // Drawing tools
      if (tool === 'pen' || tool === 'marker' || tool === 'highlighter' || tool === 'eraser') {
        isDrawing = true;

        const strokeWidth = tool === 'pen' ? 2 : tool === 'marker' ? 6 : tool === 'highlighter' ? 12 : 20;
        const opacity = tool === 'highlighter' ? 0.5 : 1;

        currentLine = new Konva.Line({
          points: [stagePos.x, stagePos.y],
          stroke: tool === 'eraser' ? '#f5f5f5' : (strokeColor || '#000000'),
          strokeWidth: strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
          opacity: opacity,
          globalCompositeOperation: tool === 'eraser' ? 'destination-out' : 'source-over',
        });

        mainLayer.add(currentLine);
        return;
      }

      // Shape tools
      switch (tool) {
        case 'rectangle':
          const rect = new Konva.Rect({
            x: stagePos.x - 50,
            y: stagePos.y - 30,
            width: 100,
            height: 60,
            fill: fillColor || '#5865f2',
            stroke: strokeColor || '#000000',
            strokeWidth: strokeWidth || 2,
            cornerRadius: 8,
            draggable: true,
          });
          mainLayer.add(rect);
          mainLayer.batchDraw();
          break;

        case 'ellipse':
          const ellipse = new Konva.Ellipse({
            x: stagePos.x,
            y: stagePos.y,
            radiusX: 50,
            radiusY: 30,
            fill: fillColor || '#9b59b6',
            stroke: strokeColor || '#000000',
            strokeWidth: strokeWidth || 2,
            draggable: true,
          });
          mainLayer.add(ellipse);
          mainLayer.batchDraw();
          break;

        case 'text':
          const text = new Konva.Text({
            x: stagePos.x,
            y: stagePos.y,
            text: 'Double-click to edit',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            fill: '#1a1a1a',
            draggable: true,
          });
          mainLayer.add(text);
          mainLayer.batchDraw();
          break;

        case 'sticky':
          const sticky = new Konva.Rect({
            x: stagePos.x - 100,
            y: stagePos.y - 100,
            width: 200,
            height: 200,
            fill: '#ffd93d',
            cornerRadius: 4,
            shadowColor: 'black',
            shadowBlur: 10,
            shadowOpacity: 0.2,
            draggable: true,
          });
          mainLayer.add(sticky);
          mainLayer.batchDraw();
          break;

        case 'triangle':
          const triangle = new Konva.RegularPolygon({
            x: stagePos.x,
            y: stagePos.y,
            sides: 3,
            radius: 50,
            fill: fillColor || '#a29bfe',
            stroke: strokeColor || '#000000',
            strokeWidth: strokeWidth || 2,
            draggable: true,
          });
          mainLayer.add(triangle);
          mainLayer.batchDraw();
          break;

        case 'line':
          const line = new Konva.Line({
            points: [stagePos.x - 50, stagePos.y, stagePos.x + 50, stagePos.y],
            stroke: strokeColor || '#000000',
            strokeWidth: strokeWidth || 2,
            draggable: true,
          });
          mainLayer.add(line);
          mainLayer.batchDraw();
          break;

        case 'connector':
          const connector = new Konva.Arrow({
            points: [stagePos.x - 50, stagePos.y, stagePos.x + 50, stagePos.y],
            stroke: strokeColor || '#000000',
            strokeWidth: 2,
            fill: strokeColor || '#000000',
            draggable: true,
            pointerLength: 10,
            pointerWidth: 10,
          });
          mainLayer.add(connector);
          mainLayer.batchDraw();
          break;
      }
    };

    const handleMouseMove = () => {
      if (!isDrawing || !currentLine) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const stagePos = {
        x: (pos.x - stage.x()) / stage.scaleX(),
        y: (pos.y - stage.y()) / stage.scaleY(),
      };

      const newPoints = currentLine.points().concat([stagePos.x, stagePos.y]);
      currentLine.points(newPoints);
      mainLayer.batchDraw();
    };

    const handleMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        stage.draggable(false);
      }

      if (isDrawing) {
        isDrawing = false;
        currentLine = null;
      }
    };

    // Set up all event listeners
    stage.on('mousedown', handleMouseDown);
    stage.on('mousemove', handleMouseMove);
    stage.on('mouseup', handleMouseUp);

    // Global mouseup to catch releases outside the stage
    const globalMouseUp = () => {
      if (isDrawing) {
        isDrawing = false;
        currentLine = null;
      }
      if (isPanning) {
        isPanning = false;
        stage.draggable(false);
      }
    };

    window.addEventListener('mouseup', globalMouseUp);

    // Pan mode drag events
    stage.on('dragmove', updateGrid);

    // Window resize
    const handleResize = () => {
      stage.width(window.innerWidth);
      stage.height(window.innerHeight);
      updateGrid();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mouseup', globalMouseUp);
      stage.destroy();
    };
  }, [selectedTool, strokeColor, strokeWidth, fillColor]);

  // Update cursor based on selected tool
  useEffect(() => {
    if (!containerRef.current) return;

    const tool = selectedTool;
    let cursor = 'default';

    switch (tool) {
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
      default:
        cursor = 'crosshair';
    }

    containerRef.current.style.cursor = cursor;
  }, [selectedTool]);

  return (
    <div className="canvas-wrapper">
      <CanvasToolbar />
      <div ref={containerRef} className="konva-stage-container" />
      <ZoomControls />
    </div>
  );
};

export default FigJamCanvas;