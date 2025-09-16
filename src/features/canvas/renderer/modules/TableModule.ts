// Table renderer module for main layer rendering with Konva groups
// Follows existing four-layer architecture and performance patterns

import Konva from "konva";
import type { TableElement } from "../../types/elements/table";
import KonvaNodePool from "../../utils/KonvaNodePool";

// Re-use existing RendererLayers interface from the codebase
export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export interface TableRendererOptions {
  // Allow enabling caching or node pooling in heavy scenes
  cacheAfterCommit?: boolean;
  usePooling?: boolean;
}

export class TableRenderer {
  private layers: RendererLayers;
  private groupById = new Map<string, Konva.Group>();
  private pool?: KonvaNodePool;
  private opts: TableRendererOptions;

  constructor(layers: RendererLayers, opts?: TableRendererOptions) {
    this.layers = layers;
    this.opts = opts ?? {};
    
    if (this.opts.usePooling) {
      this.pool = new KonvaNodePool();
      
      // Register pooled node types for table rendering
      this.pool.register('table-cell-rect', {
        create: () => new Konva.Rect({ listening: false, perfectDrawEnabled: false }),
        reset: (node: Konva.Rect) => {
          node.setAttrs({
            x: 0, y: 0, width: 0, height: 0,
            fill: '', stroke: '', strokeWidth: 0,
            cornerRadius: 0
          });
        }
      });
      
      this.pool.register('table-cell-text', {
        create: () => new Konva.Text({ listening: false, perfectDrawEnabled: false }),
        reset: (node: Konva.Text) => {
          node.setAttrs({
            x: 0, y: 0, width: 0, height: 0,
            text: '', fontFamily: '', fontSize: 12,
            fill: '', align: 'left', verticalAlign: 'top'
          });
        }
      });
      
      this.pool.register('table-grid', {
        create: () => new Konva.Shape({ listening: false, perfectDrawEnabled: false }),
        reset: (node: Konva.Shape) => {
          node.clearCache();
        }
      });
    }
  }

  // Ensure a root group for this table exists on main layer
  private ensureGroup(el: TableElement): Konva.Group {
    let g = this.groupById.get(el.id);
    if (g && g.getLayer() !== this.layers.main) {
      g.remove();
      this.groupById.delete(el.id);
      g = undefined as any;
    }
    if (!g) {
      g = new Konva.Group({
        id: el.id,
        name: "table",
        listening: true,     // element-level selection
        x: el.x,
        y: el.y,
      });
      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }
    return g;
  }

  // Create a cell background rectangle
  private createCellRect(x: number, y: number, width: number, height: number, style: TableElement['style']): Konva.Rect {
    if (this.pool) {
      const rect = this.pool.acquire<Konva.Rect>('table-cell-rect');
      rect.setAttrs({
        x, y, width, height,
        fill: style.cellFill,
        cornerRadius: style.cornerRadius ?? 0,
      });
      return rect;
    }
    
    return new Konva.Rect({
      x, y, width, height,
      fill: style.cellFill,
      cornerRadius: style.cornerRadius ?? 0,
      listening: false,
      perfectDrawEnabled: false,
      name: "cell-bg",
    });
  }

  // Create cell text node
  private createCellText(
    x: number, y: number, width: number, height: number, 
    text: string, style: TableElement['style']
  ): Konva.Text {
    if (this.pool) {
      const textNode = this.pool.acquire<Konva.Text>('table-cell-text');
      textNode.setAttrs({
        x, y, width, height, text,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fill: style.textColor,
        align: "left",
        verticalAlign: "top",
      });
      return textNode;
    }

    return new Konva.Text({
      x, y, width, height, text,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fill: style.textColor,
      align: "left",
      verticalAlign: "top",
      listening: false,
      perfectDrawEnabled: false,
      name: "cell-text",
    });
  }

  // Create grid lines using custom shape
  private createGrid(el: TableElement): Konva.Shape {
    const { rows, cols, colWidths, rowHeights, style, width, height } = el;

    if (this.pool) {
      const grid = this.pool.acquire<Konva.Shape>('table-grid');
      grid.sceneFunc((ctx, shape) => {
        this.drawGridLines(ctx, shape, { rows, cols, colWidths, rowHeights, style, width, height });
      });
      return grid;
    }

    return new Konva.Shape({
      sceneFunc: (ctx, shape) => {
        this.drawGridLines(ctx, shape, { rows, cols, colWidths, rowHeights, style, width, height });
      },
      listening: false,
      perfectDrawEnabled: false,
      name: "table-grid",
    });
  }

  // Draw grid lines implementation
  private drawGridLines(
    ctx: any, 
    shape: Konva.Shape,
    params: {
      rows: number; cols: number; colWidths: number[]; rowHeights: number[];
      style: TableElement['style']; width: number; height: number;
    }
  ) {
    const { rows, cols, colWidths, rowHeights, style, width, height } = params;
    
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = style.borderColor;
    ctx.lineWidth = style.borderWidth;
    
    // Outer border
    ctx.rect(0, 0, width, height);
    
    // Vertical lines
    let x = 0;
    for (let c = 1; c < cols; c++) {
      x += colWidths[c - 1];
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // Horizontal lines
    let y = 0;
    for (let r = 1; r < rows; r++) {
      y += rowHeights[r - 1];
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    ctx.stroke();
    ctx.restore();
    
    // Required by Konva custom shape
    ctx.fillStrokeShape(shape);
  }

  // Rebuild children when geometry or content changes
  render(el: TableElement) {
    const g = this.ensureGroup(el);
    
    // Position and size
    g.position({ x: el.x, y: el.y });

    // Release pooled nodes if using pooling
    if (this.pool) {
      const children = g.getChildren();
      children.forEach(child => {
        if (child instanceof Konva.Shape || child instanceof Konva.Rect || child instanceof Konva.Text) {
          this.pool!.release(child);
        }
      });
    }

    // Clear and rebuild (optimize later with keyed reuse)
    g.destroyChildren();

    const { rows, cols, colWidths, rowHeights, style } = el;

    // Create cell backgrounds and text
    let yAccum = 0;
    for (let r = 0; r < rows; r++) {
      let xAccum = 0;
      for (let c = 0; c < cols; c++) {
        const w = colWidths[c];
        const h = rowHeights[r];
        
        // Cell background
        const cellRect = this.createCellRect(xAccum, yAccum, w, h, style);
        g.add(cellRect);

        // Cell text (if any)
        const cellIndex = r * cols + c;
        const text = el.cells[cellIndex]?.text ?? "";
        if (text.length > 0) {
          const textNode = this.createCellText(
            xAccum + style.paddingX,
            yAccum + style.paddingY,
            Math.max(0, w - 2 * style.paddingX),
            Math.max(0, h - 2 * style.paddingY),
            text,
            style
          );
          g.add(textNode);
        }

        xAccum += w;
      }
      yAccum += rowHeights[r];
    }

    // Grid lines (stroke on top)
    const grid = this.createGrid(el);
    g.add(grid);

    // Resize the group hit rect to the element frame
    g.setAttrs({ width: el.width, height: el.height });

    // Optional caching after commit
    if (this.opts.cacheAfterCommit) {
      g.cache();
    }

    // Batch draw
    this.layers.main.batchDraw();
  }

  remove(id: string) {
    const g = this.groupById.get(id);
    if (!g) return;

    // Release pooled nodes if using pooling
    if (this.pool) {
      const children = g.getChildren();
      children.forEach(child => {
        if (child instanceof Konva.Shape || child instanceof Konva.Rect || child instanceof Konva.Text) {
          this.pool!.release(child);
        }
      });
    }

    g.destroy();
    this.layers.main.batchDraw();
    this.groupById.delete(id);
  }

  // Update specific cell without full rebuild (optimization)
  updateCell(elementId: string, row: number, col: number, newText: string) {
    const g = this.groupById.get(elementId);
    if (!g) return;

    // Find and update the text node for this cell
    const children = g.getChildren();
    const textNodes = children.filter(child => child.name() === 'cell-text') as Konva.Text[];
    
    // Calculate which text node corresponds to this cell
    // This is a simplified approach; a more robust implementation would use better indexing
    const targetIndex = row * (g.getAttr('cols') || 1) + col;
    if (textNodes[targetIndex]) {
      textNodes[targetIndex].text(newText);
      this.layers.main.batchDraw();
    }
  }

  // Get table group by ID (useful for selection/transformer)
  getTableGroup(id: string): Konva.Group | undefined {
    return this.groupById.get(id);
  }

  // Cleanup method
  destroy() {
    if (this.pool) {
      this.pool.clear(true);
    }
    
    for (const group of this.groupById.values()) {
      group.destroy();
    }
    
    this.groupById.clear();
  }
}