// Table renderer module for main layer rendering with Konva groups
// Follows existing four-layer architecture and performance patterns

import Konva from "konva";
import type { TableElement } from "../../types/table";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";
import KonvaNodePool from "../../utils/KonvaNodePool";
import { openCellEditorWithTracking } from "../../utils/editors/openCellEditorWithTracking";

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
  private storeCtx?: any; // Store context for proper store access

  constructor(layers: RendererLayers, opts?: TableRendererOptions, storeCtx?: any) {
    this.layers = layers;
    this.opts = opts ?? {};
    this.storeCtx = storeCtx;
    
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
            fill: '', align: 'left', verticalAlign: 'top', lineHeight: 1.4
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

  private getStoreHook() {
    return this.storeCtx?.store;
  }

  private commitCellText(
    elementId: string,
    row: number,
    col: number,
    value: string,
  ) {
    const storeHook = this.getStoreHook();
    if (!storeHook) return;

    const runUpdate = () => {
      const state = storeHook.getState();
      const current = state.element.getById?.(elementId) as TableElement | undefined;
      if (!current || current.type !== 'table') return;

      const idx = row * current.cols + col;
      const cells = current.cells.slice();
      const existing = cells[idx] ?? { text: '' };
      if (existing.text === value) return;

      cells[idx] = { ...existing, text: value };

      state.element.update(elementId, {
        cells,
      } as Partial<TableElement>);
    };

    const state = storeHook.getState();
    const history = state.history;

    if (history?.withUndo) {
      history.withUndo('Edit table cell', () => {
        runUpdate();
      });
    } else {
      runUpdate();
    }
  }

  private handleCellAutoResize(
    payload: {
      elementId: string;
      row: number;
      col: number;
      requiredWidth: number;
      requiredHeight: number;
    },
  ) {
    const storeHook = this.getStoreHook();
    if (!storeHook) return;

    const { elementId, row, col, requiredWidth, requiredHeight } = payload;
    if (!Number.isFinite(requiredWidth) || !Number.isFinite(requiredHeight)) return;

    const state = storeHook.getState();
    const table = state.element.getById?.(elementId) as TableElement | undefined;
    if (!table || table.type !== 'table') return;

    const currentColWidths = table.colWidths.slice();
    const currentRowHeights = table.rowHeights.slice();

    const minWidth = DEFAULT_TABLE_CONFIG.minCellWidth;
    const minHeight = DEFAULT_TABLE_CONFIG.minCellHeight;

    const targetWidth = Math.max(currentColWidths[col] || 0, requiredWidth, minWidth);
    const targetHeight = Math.max(currentRowHeights[row] || 0, requiredHeight, minHeight);

    const widthChanged = targetWidth - (currentColWidths[col] || 0) > 0.5;
    const heightChanged = targetHeight - (currentRowHeights[row] || 0) > 0.5;

    if (!widthChanged && !heightChanged) return;

    const patch: Partial<TableElement> = {};

    if (widthChanged) {
      currentColWidths[col] = targetWidth;
      patch.colWidths = currentColWidths;
      patch.width = currentColWidths.reduce((sum, w) => sum + w, 0);
    }

    if (heightChanged) {
      currentRowHeights[row] = targetHeight;
      patch.rowHeights = currentRowHeights;
      patch.height = currentRowHeights.reduce((sum, h) => sum + h, 0);
    }

    state.element.update(elementId, patch as Partial<TableElement>);

    const bumpVersion = state.bumpSelectionVersion ?? state.selection?.bumpSelectionVersion;
    if (typeof bumpVersion === 'function') {
      bumpVersion();
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
        name: "table-group", // Clear name for SelectionModule recognition
        draggable: true, // MUST be true for SelectionModule transformer to work
        listening: true, // element-level selection
        x: el.x,
        y: el.y,
        width: el.width,  // Set explicit dimensions for transformer
        height: el.height,
      });

      // FIXED: Set elementId attribute for SelectionModule integration
      g.setAttr("elementId", el.id);

      // Add interaction handlers
      this.setupTableInteractions(g, el.id);
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
    const attrs = {
      x,
      y,
      width,
      height,
      text,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fill: style.textColor,
      align: 'left' as const,
      verticalAlign: 'top' as const,
      lineHeight: 1.4,
      listening: false,
      perfectDrawEnabled: false,
      name: 'cell-text',
    };

    if (this.pool) {
      const textNode = this.pool.acquire<Konva.Text>('table-cell-text');
      textNode.setAttrs(attrs);
      return textNode;
    }

    return new Konva.Text(attrs);
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

    // CRITICAL: Preserve position - only update x/y if they are defined and different
    // This prevents position jumping during structure changes
    const currentPos = g.position();
    const newX = el.x !== undefined ? el.x : currentPos.x;
    const newY = el.y !== undefined ? el.y : currentPos.y;

    // Position and size - force update with defensive position preservation
    g.setAttrs({
      x: newX,
      y: newY,
      width: el.width,
      height: el.height
    });

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

    // Add invisible cell click areas for double-click editing
    this.addCellClickAreas(g, el);

    // Resize the group hit rect to the element frame
    g.setAttrs({ width: el.width, height: el.height });

    // Ensure elementId attribute is maintained during updates
    g.setAttr("elementId", el.id);

    // Set additional attributes for better SelectionModule integration
    g.setAttr("elementType", "table");
    g.className = "table-group"; // Ensure className is set for SelectionModule detection

    // Log position for debugging table jumping issues
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TableModule] Rendered table ${el.id} at position (${newX}, ${newY}), size (${el.width}, ${el.height})`);
    }

    // Performance optimization: Apply HiDPI-aware caching for large tables
    const shouldCache = (rows * cols > 50) || this.opts.cacheAfterCommit;
    if (shouldCache) {
      const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      g.cache({
        pixelRatio: pixelRatio,
        imageSmoothingEnabled: true,
        width: el.width,
        height: el.height,
      });
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

  // Add invisible click areas for cell editing with precise detection
  private addCellClickAreas(group: Konva.Group, el: TableElement) {
    // Remove existing cell interaction areas
    group.find('.cell-clickable').forEach(node => node.destroy());

    const { rows, cols, colWidths, rowHeights } = el;

    let yPos = 0;
    for (let row = 0; row < rows; row++) {
      let xPos = 0;
      for (let col = 0; col < cols; col++) {
        const cellWidth = colWidths[col];
        const cellHeight = rowHeights[row];

        // Create invisible clickable area for each cell
        const clickArea = new Konva.Rect({
          x: xPos,
          y: yPos,
          width: cellWidth,
          height: cellHeight,
          fill: 'transparent',
          listening: true,
          name: 'cell-clickable',
          perfectDrawEnabled: false,
        });

        // CRITICAL FIX: Remove contextmenu handler from cell areas entirely
        // Let all contextmenu events bubble up to the table group and stage
        // This ensures the TableContextMenuManager receives the events properly

        // Double-click to edit using the tracked editor for live resize support
        clickArea.on('dblclick', (e) => {
          console.log(`[TableModule] Cell [${row}, ${col}] double-clicked`);
          e.cancelBubble = true; // Prevent stage events

          const stage = group.getStage();
          if (stage) {
            // Use the tracked version for live resize support
            openCellEditorWithTracking({
              stage,
              elementId: el.id,
              element: el,
              getElement: () => this.getStoreHook()?.getState().element.getById(el.id),
              row,
              col,
              onCommit: (value, tableId, commitRow, commitCol) =>
                this.commitCellText(tableId, commitRow, commitCol, value),
              onSizeChange: (payload) =>
                this.handleCellAutoResize(payload),
            });
          }
        });

        // Visual feedback for cell interaction - keep default cursor until double-click
        clickArea.on('mouseenter', () => {
          const stage = group.getStage();
          if (stage?.container()) {
            stage.container().style.cursor = 'default';
          }
        });

        clickArea.on('mouseleave', () => {
          const stage = group.getStage();
          if (stage?.container()) {
            stage.container().style.cursor = 'default';
          }
        });

        group.add(clickArea);
        xPos += cellWidth;
      }
      yPos += rowHeights[row];
    }
  }

  // Setup table interaction handlers
  private setupTableInteractions(group: Konva.Group, elementId: string) {
    // Get reference to SelectionModule for proper selection integration
    const getSelectionModule = () => (window as any).selectionModule;

    // CRITICAL: Add contextmenu handler to the table group for debugging
    group.on('contextmenu', (e) => {
      console.log('[TableModule] Table group contextmenu event:', {
        elementId,
        target: e.target,
        currentTarget: e.currentTarget,
        targetName: e.target?.name?.(),
        groupName: group.name(),
        groupId: group.id(),
        evt: e.evt
      });
      // Allow the event to continue bubbling to the stage
    });

    // FIXED: Simple click handler for selection - let SelectionModule handle drag/transform
    group.on("click tap", (e) => {
      // Don't cancel bubble if the click is on a transformer (resize handles)
      const isTransformerClick =
        e.target?.getParent()?.className === "Transformer" ||
        e.target?.className === "Transformer";
      if (!isTransformerClick) {
        e.cancelBubble = true; // Prevent stage click
      }

      const selectionModule = getSelectionModule();
      if (selectionModule) {
        // Use SelectionModule for consistent selection behavior
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
        if (isAdditive) {
          // For additive selection, we need to get current selection and toggle
          selectionModule.selectElement(elementId); // Simplified for now
        } else {
          selectionModule.selectElement(elementId);
        }
      } else {
        // Fallback to direct store integration
        if (!this.storeCtx) return;

        const store = this.storeCtx.store.getState();
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;

        if (store.setSelection) {
          if (isAdditive) {
            // Get current selection and toggle
            const current = store.selectedElementIds || new Set();
            const newSelection = new Set(current);
            if (newSelection.has(elementId)) {
              newSelection.delete(elementId);
            } else {
              newSelection.add(elementId);
            }
            store.setSelection(Array.from(newSelection));
          } else {
            store.setSelection([elementId]);
          }
        } else if (store.selection) {
          if (isAdditive) {
            store.selection.toggle?.(elementId);
          } else {
            store.selection.set?.([elementId]);
          }
        }
      }
    });

    // Transform handling is now managed by SelectionModule for consistent behavior
    // No need for custom transform handlers - SelectionModule handles position/size updates

    // Double-click handler removed - cell editing is handled by precise cell click areas only
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
