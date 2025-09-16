// features/canvas/examples/spatialAndMonitoringIntegration.ts
//
// Example integration of spatial utilities and canvas monitoring
// with the existing four-layer Konva architecture and performance toolkit

import Konva from 'konva';
import { QuadTree, SimpleEraserIndex, CanvasMonitor } from '../utils/performance';
import { EmergencyRafBatcher } from '../utils/performance/emergencyRafBatcher';

/**
 * Example integration showing how spatial utilities and monitoring
 * work together with the existing Canvas architecture
 */
export class SpatialAndMonitoringExample {
  private stage: Konva.Stage;
  private layers: {
    background: Konva.Layer;
    main: Konva.Layer;
    preview: Konva.Layer;
    overlay: Konva.Layer;
  };

  // Spatial indexing
  private quadTree: QuadTree<Konva.Node>;
  private eraserIndex: SimpleEraserIndex;

  // Performance monitoring and batching
  private monitor: CanvasMonitor;
  private batcher: EmergencyRafBatcher;

  // Example canvas elements for demonstration
  private strokePaths = new Map<string, number[]>();
  private strokeWidths = new Map<string, number>();

  constructor(container: HTMLElement, width: number, height: number) {
    // Initialize Konva stage and four-layer architecture
    this.stage = new Konva.Stage({ container: container as HTMLDivElement, width, height });
    
    this.layers = {
      background: new Konva.Layer({ name: 'background' }),
      main: new Konva.Layer({ name: 'main' }),
      preview: new Konva.Layer({ name: 'preview' }),
      overlay: new Konva.Layer({ name: 'overlay' })
    };

    // Add layers to stage in correct order
    this.stage.add(this.layers.background);
    this.stage.add(this.layers.main);
    this.stage.add(this.layers.preview);
    this.stage.add(this.layers.overlay);

    // Quad tree for spatial indexing (correct API)
    this.quadTree = new QuadTree<Konva.Node>(
      { x: 0, y: 0, width, height },
      8, // maxElements
      6  // maxDepth
    );

    this.eraserIndex = new SimpleEraserIndex(64); // 64px cells

    // Initialize performance monitoring
    this.monitor = new CanvasMonitor({
      sampleIntervalMs: 250,
      smoothFactor: 0.15,
      instrumentLayerDraws: true,
      countNodes: true,
      collectMemory: true
    });

    this.monitor.attachStage(this.stage);
    this.monitor.attachLayers([
      this.layers.background,
      this.layers.main,
      this.layers.preview,
      this.layers.overlay
    ]);

    // Initialize RAF batching for performance
    this.batcher = new EmergencyRafBatcher({ maxLatencyMs: 32 });

    this.setupMonitoring();
    this.setupInteractions();
  }

  private setupMonitoring(): void {
    // Subscribe to performance metrics for debugging/optimization
    this.monitor.subscribe((metrics) => {
      // Log performance warnings based on project's optimization strategy
      if (metrics.fps < 55) {
        console.warn('FPS below target:', metrics.fps);
      }

      if (metrics.layers.some(l => l.lastDrawMs > 8)) {
        console.warn('Layer draw time excessive:', 
          metrics.layers.filter(l => l.lastDrawMs > 8));
      }

      // Example: Surface metrics to performance overlay
      this.surfaceMetricsToOverlay(metrics);
    });

    this.monitor.start();
  }

  private setupInteractions(): void {
    // Example: Drawing tool integration with spatial indexing
    let isDrawing = false;
    let currentStroke: Konva.Line | null = null;
    let currentPoints: number[] = [];

    this.stage.on('pointerdown', (_e) => {
      isDrawing = true;
      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      currentPoints = [pos.x, pos.y];
      
      // Create preview stroke on preview layer (aligned with tool architecture)
      currentStroke = new Konva.Line({
        points: currentPoints,
        stroke: '#000',
        strokeWidth: 3,
        globalCompositeOperation: 'source-over',
        lineCap: 'round',
        lineJoin: 'round',
        // Performance optimizations from project memory
        listening: false,
        perfectDrawEnabled: false
      });

      this.layers.preview.add(currentStroke);
      
      // Batch the draw operation
      this.batcher.requestLayerDraw(this.layers.preview);
    });

    this.stage.on('pointermove', (_e) => {
      if (!isDrawing || !currentStroke) return;
      
      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      // Batch point updates for 60fps performance (per project strategy)
      this.batcher.enqueueWrite(() => {
        currentPoints.push(pos.x, pos.y);
        currentStroke!.points(currentPoints);
      });
      
      this.batcher.requestLayerDraw(this.layers.preview);
    });

    this.stage.on('pointerup', () => {
      if (!isDrawing || !currentStroke) return;
      
      isDrawing = false;
      const strokeId = `stroke_${Date.now()}`;

      // Move from preview to main layer (commit pattern)
      this.layers.preview.removeChildren();
      
      const finalStroke = currentStroke.clone();
      finalStroke.listening(true); // Re-enable for selection
      this.layers.main.add(finalStroke);

      // Add to spatial indexes
      this.quadTree.insert(finalStroke, {
        x: finalStroke.x(),
        y: finalStroke.y(),
        width: finalStroke.width(),
        height: finalStroke.height(),
      });
      
      // Store for eraser index
      this.strokePaths.set(strokeId, currentPoints.slice());
      this.strokeWidths.set(strokeId, 3);
      
      this.eraserIndex.addStroke({
        strokeId,
        points: currentPoints,
        strokeWidth: 3
      });

      // Batch final draws
      this.batcher.requestLayerDraw(this.layers.preview);
      this.batcher.requestLayerDraw(this.layers.main);

      currentStroke = null;
      currentPoints = [];
    });
  }

  // Example eraser tool integration
  eraseAtPoint(x: number, y: number, radius: number): void {
    // Use spatial index for fast candidate retrieval
    const affectedStrokeIds = this.eraserIndex.queryCircleStrokeIds(x, y, radius);
    
    // Remove affected strokes from all indexes
    for (const strokeId of affectedStrokeIds) {
      // Remove from eraser index
      this.eraserIndex.removeStroke(strokeId);
      
      // Find and remove from QuadTree and layer - use correct API
      const strokesInArea = this.quadTree.query({ x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 });
      for (const stroke of strokesInArea) {
        if ((stroke as any).id?.() === strokeId) {
          this.quadTree.remove(stroke);
          stroke.remove();
          break;
        }
      }
      
      // Clean up maps
      this.strokePaths.delete(strokeId);
      this.strokeWidths.delete(strokeId);
    }

    // Batch the layer redraw
    this.batcher.requestLayerDraw(this.layers.main);
  }

  // Example viewport culling for performance
  performViewportCulling(): void {
    const viewBox = {
      x: -this.stage.x() / this.stage.scaleX(),
      y: -this.stage.y() / this.stage.scaleY(),
      width: this.stage.width() / this.stage.scaleX(),
      height: this.stage.height() / this.stage.scaleY()
    };

    // Query visible nodes via spatial index - use correct API
    const visibleNodes = this.quadTree.query(viewBox);
    
    // Hide/show nodes based on visibility (performance optimization)
    this.layers.main.getChildren().forEach(node => {
      const isVisible = visibleNodes.includes(node);
      node.visible(isVisible);
    });

    this.batcher.requestLayerDraw(this.layers.main);
  }

  // Example performance metrics overlay integration
  private surfaceMetricsToOverlay(metrics: any): void {
    // Clear previous overlay content
    this.layers.overlay.removeChildren();

    // Create performance display (aligned with PerformanceOverlayHUD pattern)
    const perfText = new Konva.Text({
      x: 10,
      y: 10,
      text: `FPS: ${metrics.fps} | Frame: ${metrics.frameMs.toFixed(1)}ms`,
      fontSize: 12,
      fill: '#00ff00',
      fontFamily: 'monospace'
    });

    this.layers.overlay.add(perfText);
    this.batcher.requestLayerDraw(this.layers.overlay);
  }

  // Cleanup method
  destroy(): void {
    this.monitor.stop();
    this.batcher.dispose();
    this.quadTree.clear();
    this.eraserIndex.clear();
    this.stage.destroy();
  }
}