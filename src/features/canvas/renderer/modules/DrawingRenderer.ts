// Drawing renderer module for rendering pen, marker, and highlighter paths
import Konva from 'konva';
import type { ModuleRendererCtx, RendererModule } from '../index';

type Id = string;

interface DrawingElement {
  id: Id;
  type: 'pen' | 'marker' | 'highlighter' | 'eraser';
  points: number[]; // Flattened array of [x1, y1, x2, y2, ...]
  style?: {
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  };
}

export class DrawingRenderer implements RendererModule {
  private drawingNodes = new Map<Id, Konva.Line>();
  private mainLayer?: Konva.Layer;
  private highlighterLayer?: Konva.Layer;
  private unsubscribe?: () => void;

  mount(ctx: ModuleRendererCtx): () => void {
    console.log('[DrawingRenderer] Mounting...');
    this.mainLayer = ctx.layers.main;
    this.highlighterLayer = ctx.layers.highlighter;

    // Subscribe to store changes - watch drawing elements
    this.unsubscribe = ctx.store.subscribe(
      // Selector: extract drawing elements
      (state) => {
        const drawings = new Map<Id, DrawingElement>();
        for (const [id, element] of state.elements.entries()) {
          if (element.type === 'pen' || element.type === 'marker' || element.type === 'highlighter' || element.type === 'eraser') {
            drawings.set(id, element as DrawingElement);
          }
        }
        return drawings;
      },
      // Callback: reconcile changes
      (drawings) => this.reconcile(drawings)
    );

    // Initial render
    const initialState = ctx.store.getState();
    const initialDrawings = new Map<Id, DrawingElement>();
    for (const [id, element] of initialState.elements.entries()) {
      if (element.type === 'pen' || element.type === 'marker' || element.type === 'highlighter' || element.type === 'eraser') {
        initialDrawings.set(id, element as DrawingElement);
      }
    }
    this.reconcile(initialDrawings);

    // Return cleanup function
    return () => this.unmount();
  }

  private unmount() {
    console.log('[DrawingRenderer] Unmounting...');
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    for (const node of this.drawingNodes.values()) {
      node.destroy();
    }
    this.drawingNodes.clear();
    if (this.mainLayer) {
      this.mainLayer.batchDraw();
    }
    if (this.highlighterLayer) {
      this.highlighterLayer.batchDraw();
    }
  }

  private reconcile(drawings: Map<Id, DrawingElement>) {
    console.log('[DrawingRenderer] Reconciling', drawings.size, 'drawing elements');

    if (!this.mainLayer || !this.highlighterLayer) return;

    const seen = new Set<Id>();

    // Add/update drawing elements
    for (const [id, drawing] of drawings) {
      seen.add(id);
      let node = this.drawingNodes.get(id);

      if (!node) {
        // Create new drawing node
        node = this.createDrawingNode(drawing);
        this.drawingNodes.set(id, node);
        // Add to appropriate layer based on type
        const targetLayer = drawing.type === 'highlighter' ? this.highlighterLayer : this.mainLayer;
        targetLayer.add(node);
      } else {
        // Update existing drawing node
        this.updateDrawingNode(node, drawing);
      }
    }

    // Remove deleted drawing elements
    for (const [id, node] of this.drawingNodes) {
      if (!seen.has(id)) {
        console.log('[DrawingRenderer] Removing drawing:', id);
        node.destroy();
        this.drawingNodes.delete(id);
      }
    }

    this.mainLayer.batchDraw();
    this.highlighterLayer.batchDraw();
  }

  private createDrawingNode(drawing: DrawingElement): Konva.Line {
    const isHighlighter = drawing.type === 'highlighter';
    const isEraser = drawing.type === 'eraser';

    return new Konva.Line({
      id: drawing.id,
      points: drawing.points,
      stroke: this.getStrokeColor(drawing),
      strokeWidth: this.getStrokeWidth(drawing),
      opacity: this.getOpacity(drawing),
      lineCap: 'round',
      lineJoin: 'round',
      listening: true,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      tension: 0,
      globalCompositeOperation: isEraser ? 'destination-out' : (isHighlighter ? 'multiply' : 'source-over'),
    });
  }

  private updateDrawingNode(node: Konva.Line, drawing: DrawingElement) {
    const isHighlighter = drawing.type === 'highlighter';
    const isEraser = drawing.type === 'eraser';

    node.setAttrs({
      points: drawing.points,
      stroke: this.getStrokeColor(drawing),
      strokeWidth: this.getStrokeWidth(drawing),
      opacity: this.getOpacity(drawing),
      globalCompositeOperation: isEraser ? 'destination-out' : (isHighlighter ? 'multiply' : 'source-over'),
    });
  }

  private getStrokeColor(drawing: DrawingElement): string {
    if (drawing.style?.stroke) return drawing.style.stroke;

    switch (drawing.type) {
      case 'pen':
        return '#000000';
      case 'marker':
        return '#EF4444';
      case 'highlighter':
        return '#FDE047';
      case 'eraser':
        return '#FFFFFF';  // Eraser uses white for destination-out
      default:
        return '#000000';
    }
  }

  private getStrokeWidth(drawing: DrawingElement): number {
    if (drawing.style?.strokeWidth) return drawing.style.strokeWidth;

    switch (drawing.type) {
      case 'pen':
        return 2;
      case 'marker':
        return 4;
      case 'highlighter':
        return 12;
      case 'eraser':
        return 20;
      default:
        return 2;
    }
  }

  private getOpacity(drawing: DrawingElement): number {
    if (drawing.style?.opacity !== undefined) return drawing.style.opacity;

    switch (drawing.type) {
      case 'pen':
        return 1;
      case 'marker':
        return 0.9;
      case 'highlighter':
        return 0.4;
      case 'eraser':
        return 1;  // Full opacity for eraser effect
      default:
        return 1;
    }
  }
}