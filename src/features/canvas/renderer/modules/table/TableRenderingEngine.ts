// Table rendering engine - manages Konva group creation and visual rendering
// Extracted from TableModule.ts for better testability and separation of concerns

import Konva from "konva";
import type { TableElement } from "../../../types/table";
import type KonvaNodePool from "../../../utils/KonvaNodePool";
import type { TableCellResolver } from "./TableCellResolver";
import type { TableEventHandlers } from "./TableEventHandlers";
import type { TableStoreHook } from "./tableTypes";

export interface RendererLayers {
  background: Konva.Layer;
  main: Konva.Layer;
  preview: Konva.Layer;
  overlay: Konva.Layer;
}

export interface RenderingCallbacks {
  getTableFromStore: (elementId: string) => TableElement | undefined;
  getStoreHook: () => TableStoreHook | undefined;
}

export interface RenderingOptions {
  cacheAfterCommit?: boolean;
}

/**
 * TableRenderingEngine handles all visual rendering of tables
 * Manages Konva groups, cell rendering, grid lines, and RAF batching
 */
export class TableRenderingEngine {
  private readonly layers: RendererLayers;
  private readonly pool: KonvaNodePool | undefined;
  private readonly groupById = new Map<string, Konva.Group>();
  private readonly cellResolver: TableCellResolver;
  private readonly eventHandlers: TableEventHandlers;
  private readonly callbacks: RenderingCallbacks;
  private readonly opts: RenderingOptions;

  constructor(
    layers: RendererLayers,
    pool: KonvaNodePool | undefined,
    cellResolver: TableCellResolver,
    eventHandlers: TableEventHandlers,
    callbacks: RenderingCallbacks,
    opts: RenderingOptions = {},
  ) {
    this.layers = layers;
    this.pool = pool;
    this.cellResolver = cellResolver;
    this.eventHandlers = eventHandlers;
    this.callbacks = callbacks;
    this.opts = opts;
  }

  /**
   * Ensure a root group for this table exists on main layer
   */
  private ensureGroup(el: TableElement): Konva.Group {
    let g = this.groupById.get(el.id);
    if (g && g.getLayer() !== this.layers.main) {
      g.remove();
      this.groupById.delete(el.id);
      g = undefined;
    }
    if (!g) {
      // Check if pan tool is active - if so, disable dragging on elements
      const storeState = this.callbacks.getStoreHook()?.getState();
      const isPanToolActive = storeState?.ui?.selectedTool === "pan";

      g = new Konva.Group({
        id: el.id,
        name: "table-group", // Clear name for SelectionModule recognition
        draggable: !isPanToolActive, // disable dragging when pan tool is active
        listening: true, // element-level selection
        x: el.x,
        y: el.y,
        width: el.width, // Set explicit dimensions for transformer
        height: el.height,
        // CRITICAL: Ensure scale is always 1 for proper transformer handling
        scaleX: 1,
        scaleY: 1,
      });

      // Add transparent hitbox for better interaction
      const hitbox = new Konva.Rect({
        x: 0,
        y: 0,
        width: el.width,
        height: el.height,
        fill: "transparent",
        listening: true,
        name: "table-hitbox",
        perfectDrawEnabled: false,
      });
      g.add(hitbox);
      hitbox.moveToBottom();

      // Set required attributes for SelectionModule integration
      g.setAttr("elementId", el.id);
      g.setAttr("elementType", "table");
      g.setAttr("keepAspectRatio", true);
      g.setAttr("rows", el.rows);
      g.setAttr("cols", el.cols);

      // Add interaction handlers
      this.eventHandlers.setupTableInteractions(g, el.id);
      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }
    return g;
  }

  /**
   * Create a cell background rectangle
   */
  private createCellRect(
    x: number,
    y: number,
    width: number,
    height: number,
    style: TableElement["style"],
  ): Konva.Rect {
    if (this.pool) {
      const rect = this.pool.acquire<Konva.Rect>("table-cell-rect");
      rect.setAttrs({
        x,
        y,
        width,
        height,
        fill: style.cellFill,
        cornerRadius: style.cornerRadius ?? 0,
      });
      return rect;
    }

    return new Konva.Rect({
      x,
      y,
      width,
      height,
      fill: style.cellFill,
      cornerRadius: style.cornerRadius ?? 0,
      listening: false,
      perfectDrawEnabled: false,
      name: "cell-bg",
    });
  }

  /**
   * Create cell text node
   */
  private createCellText(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    style: TableElement["style"],
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
      align: "center" as const,
      verticalAlign: "top" as const,
      lineHeight: 1.4,
      listening: false,
      perfectDrawEnabled: false,
      name: "cell-text",
    };

    if (this.pool) {
      const textNode = this.pool.acquire<Konva.Text>("table-cell-text");
      textNode.setAttrs(attrs);
      return textNode;
    }

    return new Konva.Text(attrs);
  }

  /**
   * Create grid lines using custom shape
   */
  private createGrid(el: TableElement): Konva.Shape {
    const { rows, cols, colWidths, rowHeights, style, width, height } = el;

    if (this.pool) {
      const grid = this.pool.acquire<Konva.Shape>("table-grid");
      grid.sceneFunc((ctx, shape) => {
        this.drawGridLines(ctx, shape, {
          rows,
          cols,
          colWidths,
          rowHeights,
          style,
          width,
          height,
        });
      });
      return grid;
    }

    return new Konva.Shape({
      sceneFunc: (ctx, shape) => {
        this.drawGridLines(ctx, shape, {
          rows,
          cols,
          colWidths,
          rowHeights,
          style,
          width,
          height,
        });
      },
      listening: false,
      perfectDrawEnabled: false,
      name: "table-grid",
    });
  }

  /**
   * Draw grid lines implementation
   */
  private drawGridLines(
    ctx: Konva.Context,
    shape: Konva.Shape,
    params: {
      rows: number;
      cols: number;
      colWidths: number[];
      rowHeights: number[];
      style: TableElement["style"];
      width: number;
      height: number;
    },
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

  /**
   * Main render method - rebuilds table visualization
   * CRITICAL FIX: Only update children when NOT being transformed
   */
  render(el: TableElement): void {
    const g = this.ensureGroup(el);

    // Check if pan tool is active and update draggable state
    const storeState = this.callbacks.getStoreHook()?.getState();
    const isPanToolActive = storeState?.ui?.selectedTool === "pan";
    g.draggable(!isPanToolActive);

    // CRITICAL FIX: Always ensure proper scale and dimensions from the store
    // But don't modify if currently being transformed (scale might be temporarily != 1)
    const currentScale = { x: g.scaleX(), y: g.scaleY() };
    const isBeingTransformed =
      Math.abs(currentScale.x - 1) > 0.01 ||
      Math.abs(currentScale.y - 1) > 0.01;

    if (!isBeingTransformed) {
      g.setAttrs({
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        // CRITICAL: Only reset scale if not currently transforming
        scaleX: 1,
        scaleY: 1,
      });
    } else {
      // During transform, only update position but leave scale/size alone
      g.setAttrs({
        x: el.x,
        y: el.y,
      });
      // CRITICAL FIX: Update width and height during transform to maintain proper sizing
      g.width(el.width);
      g.height(el.height);
      return; // Don't rebuild children during transform
    }

    // Release pooled nodes if using pooling
    if (this.pool) {
      const children = g.getChildren();
      children.forEach((child) => {
        if (
          child instanceof Konva.Shape ||
          child instanceof Konva.Rect ||
          child instanceof Konva.Text
        ) {
          this.pool?.release(child);
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
            style,
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
    this.eventHandlers.addCellClickAreas(g, el);

    // Ensure attributes are maintained during updates
    g.setAttr("elementId", el.id);
    g.setAttr("elementType", "table");
    g.setAttr("keepAspectRatio", true);
    g.setAttr("rows", rows);
    g.setAttr("cols", cols);
    g.className = "table-group";

    // Add or update transparent hitbox for better interaction
    let hitbox = g.findOne(".table-hitbox") as Konva.Rect;
    if (!hitbox) {
      hitbox = new Konva.Rect({
        x: 0,
        y: 0,
        width: el.width,
        height: el.height,
        fill: "transparent",
        listening: true,
        name: "table-hitbox",
        perfectDrawEnabled: false,
      });
      hitbox.on("contextmenu", (evt) => {
        evt.evt.preventDefault();
        const mouseEvt = evt.evt as MouseEvent;

        const stage = hitbox.getStage();
        const table = this.callbacks.getTableFromStore(el.id) ?? el;
        if (stage) {
          stage.setPointersPositions(mouseEvt);
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const local = hitbox
              .getAbsoluteTransform()
              .copy()
              .invert()
              .point(pointer);
            const coords = this.cellResolver.resolveCellFromLocal(
              table,
              local.x,
              local.y,
            );
            const handled = this.eventHandlers.tryShowContextMenu(
              el.id,
              coords.row,
              coords.col,
              mouseEvt,
            );
            if (handled) {
              evt.cancelBubble = true;
              return;
            }
          }
        }

        evt.cancelBubble = false;
      });
      g.add(hitbox);
    } else {
      hitbox.setAttrs({
        width: el.width,
        height: el.height,
      });
    }

    // Always keep the hitbox underneath interactive cell overlays
    hitbox.moveToBottom();

    // Performance optimization: Apply HiDPI-aware caching for large tables
    const shouldCache = rows * cols > 50 || this.opts.cacheAfterCommit;
    if (shouldCache) {
      const pixelRatio =
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
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

  /**
   * Remove table from rendering
   */
  remove(id: string): void {
    const g = this.groupById.get(id);
    if (!g) return;

    // Release pooled nodes if using pooling
    if (this.pool) {
      const children = g.getChildren();
      children.forEach((child) => {
        if (
          child instanceof Konva.Shape ||
          child instanceof Konva.Rect ||
          child instanceof Konva.Text
        ) {
          this.pool?.release(child);
        }
      });
    }

    g.destroy();
    this.layers.main.batchDraw();
    this.groupById.delete(id);
  }

  /**
   * Update specific cell without full rebuild (optimization)
   */
  updateCell(elementId: string, row: number, col: number, newText: string): void {
    const g = this.groupById.get(elementId);
    if (!g) return;

    // Find and update the text node for this cell
    const children = g.getChildren();
    const textNodes = children.filter(
      (child) => child.name() === "cell-text",
    ) as Konva.Text[];

    // Calculate which text node corresponds to this cell
    const targetIndex = row * (g.getAttr("cols") || 1) + col;
    if (textNodes[targetIndex]) {
      textNodes[targetIndex].text(newText);
      this.layers.main.batchDraw();
    }
  }

  /**
   * Get table group by ID (useful for selection/transformer)
   */
  getTableGroup(id: string): Konva.Group | undefined {
    return this.groupById.get(id);
  }

  /**
   * CRITICAL: Handle transform updates from TableTransformerController
   */
  handleTransformUpdate(
    elementId: string,
    newElement: TableElement,
    resetAttrs?: Record<string, unknown>,
  ): void {
    // Get the group and apply reset attributes if provided
    const group = this.groupById.get(elementId);
    if (group && resetAttrs) {
      group.setAttrs(resetAttrs);
    }

    // Update the store with the new element
    const storeHook = this.callbacks.getStoreHook();
    if (storeHook) {
      const state = storeHook.getState();
      state.element.update(elementId, newElement);
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    for (const group of this.groupById.values()) {
      group.destroy();
    }
    this.groupById.clear();
  }
}
