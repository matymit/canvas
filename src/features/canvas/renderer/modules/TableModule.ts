// Table renderer module for main layer rendering with Konva groups
// CORRECTED to properly handle scale→reset pattern and prevent child updates during transform
// Follows existing four-layer architecture and performance patterns

import Konva from "konva";
import type { TableElement } from "../../types/table";
import { DEFAULT_TABLE_CONFIG } from "../../types/table";
import KonvaNodePool from "../../utils/KonvaNodePool";
import { openCellEditorWithTracking } from "../../utils/editors/openCellEditorWithTracking";
import type { ModuleRendererCtx } from "../index";

// Extended window interface for type safety
interface ExtendedWindow extends Window {
  selectionModule?: {
    selectElement: (elementId: string) => void;
    toggleSelection?: (elementId: string) => void;
  };
}

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
  private storeCtx?: ModuleRendererCtx; // Store context for proper store access
  private isUpdatingTransformer = false; // Flag to prevent transformer loops

  constructor(
    layers: RendererLayers,
    opts?: TableRendererOptions,
    storeCtx?: ModuleRendererCtx,
  ) {
    this.layers = layers;
    this.opts = opts ?? {};
    this.storeCtx = storeCtx;

    if (this.opts.usePooling) {
      this.pool = new KonvaNodePool();

      // Register pooled node types for table rendering
      this.pool.register("table-cell-rect", {
        create: () =>
          new Konva.Rect({ listening: false, perfectDrawEnabled: false }),
        reset: (node: Konva.Rect) => {
          node.setAttrs({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            fill: "",
            stroke: "",
            strokeWidth: 0,
            cornerRadius: 0,
          });
        },
      });

      this.pool.register("table-cell-text", {
        create: () =>
          new Konva.Text({ listening: false, perfectDrawEnabled: false }),
        reset: (node: Konva.Text) => {
          node.setAttrs({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            text: "",
            fontFamily: "",
            fontSize: 16,
            fill: "",
            align: "left",
            verticalAlign: "top",
            lineHeight: 1.4,
          });
        },
      });

      this.pool.register("table-grid", {
        create: () =>
          new Konva.Shape({ listening: false, perfectDrawEnabled: false }),
        reset: (node: Konva.Shape) => {
          node.clearCache();
        },
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
      const current = state.element.getById?.(elementId) as
        | TableElement
        | undefined;
      if (!current || current.type !== "table") return;

      const idx = row * current.cols + col;
      const cells = current.cells.slice();
      const existing = cells[idx] ?? { text: "" };
      if (existing.text === value) return;

      cells[idx] = { ...existing, text: value };

      // CRITICAL FIX: Preserve position during cell text updates to prevent jumping
      state.element.update(elementId, {
        cells,
        // Explicitly preserve position to prevent jumping
        x: current.x,
        y: current.y,
      } as Partial<TableElement>);
    };

    const state = storeHook.getState();
    const history = state.history;

    if (history?.withUndo) {
      history.withUndo("Edit table cell", () => {
        runUpdate();
      });
    } else {
      runUpdate();
    }
  }

  private handleCellAutoResize(payload: {
    elementId: string;
    row: number;
    col: number;
    requiredWidth: number;
    requiredHeight: number;
  }) {
    const storeHook = this.getStoreHook();
    if (!storeHook) return;

    const { elementId, row, col, requiredWidth, requiredHeight } = payload;
    if (!Number.isFinite(requiredWidth) || !Number.isFinite(requiredHeight))
      return;

    const state = storeHook.getState();
    const table = state.element.getById?.(elementId) as
      | TableElement
      | undefined;
    if (!table || table.type !== "table") return;

    const currentColWidths = table.colWidths.slice();
    const currentRowHeights = table.rowHeights.slice();

    const minWidth = DEFAULT_TABLE_CONFIG.minCellWidth;
    const minHeight = DEFAULT_TABLE_CONFIG.minCellHeight;

    const targetWidth = Math.max(
      currentColWidths[col] || 0,
      requiredWidth,
      minWidth,
    );
    const targetHeight = Math.max(
      currentRowHeights[row] || 0,
      requiredHeight,
      minHeight,
    );

    const widthChanged = targetWidth - (currentColWidths[col] || 0) > 0.5;
    const heightChanged = targetHeight - (currentRowHeights[row] || 0) > 0.5;

    if (!widthChanged && !heightChanged) return;

    // CRITICAL FIX: Store exact current position BEFORE making any updates
    const preservedPosition = { x: table.x, y: table.y };

    const patch: Partial<TableElement> = {
      // ALWAYS preserve exact position during auto-resize
      x: preservedPosition.x,
      y: preservedPosition.y,
    };

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

    // Update with position preservation and no immediate transformer refresh
    state.element.update(elementId, patch as Partial<TableElement>);

    // Only refresh transformer if selected, with debouncing to prevent loops
    const selectedIds = state.selectedElementIds || new Set<string>();
    if (
      selectedIds.has &&
      selectedIds.has(elementId) &&
      !this.isUpdatingTransformer
    ) {
      this.isUpdatingTransformer = true;
      const bumpVersion = state.bumpSelectionVersion;
      if (typeof bumpVersion === "function") {
        // Debounced transformer refresh to prevent update loops
        setTimeout(() => {
          try {
            bumpVersion();
          } finally {
            this.isUpdatingTransformer = false;
          }
        }, 100);
      } else {
        this.isUpdatingTransformer = false;
      }
    }
  }

  // Ensure a root group for this table exists on main layer
  private ensureGroup(el: TableElement): Konva.Group {
    let g = this.groupById.get(el.id);
    if (g && g.getLayer() !== this.layers.main) {
      g.remove();
      this.groupById.delete(el.id);
      g = undefined;
    }
    if (!g) {
      g = new Konva.Group({
        id: el.id,
        name: "table-group", // Clear name for SelectionModule recognition
        draggable: true, // MUST be true for SelectionModule transformer to work
        listening: true, // element-level selection
        x: el.x,
        y: el.y,
        width: el.width, // Set explicit dimensions for transformer
        height: el.height,
        // CRITICAL: Ensure scale is always 1 for proper transformer handling
        scaleX: 1,
        scaleY: 1,
      });

      // Set required attributes for SelectionModule integration
      g.setAttr("elementId", el.id);
      g.setAttr("elementType", "table");

      // Add interaction handlers
      this.setupTableInteractions(g, el.id);
      this.layers.main.add(g);
      this.groupById.set(el.id, g);
    }
    return g;
  }

  // Create a cell background rectangle
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

  // Create cell text node
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
      align: "left" as const,
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

  // Create grid lines using custom shape
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

  // Draw grid lines implementation
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

  // Rebuild children when geometry or content changes
  // CRITICAL FIX: Only update children when NOT being transformed
  render(el: TableElement) {
    const g = this.ensureGroup(el);

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
      // Debug: [TableModule] Skipping child update during transform, scale: ${currentScale}
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
    this.addCellClickAreas(g, el);

    // Ensure attributes are maintained during updates
    g.setAttr("elementId", el.id);
    g.setAttr("elementType", "table");
    g.className = "table-group";

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

  remove(id: string) {
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

  // Update specific cell without full rebuild (optimization)
  updateCell(elementId: string, row: number, col: number, newText: string) {
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

  // Get table group by ID (useful for selection/transformer)
  getTableGroup(id: string): Konva.Group | undefined {
    return this.groupById.get(id);
  }

  // CRITICAL: Method to handle transform updates from TableTransformerController
  handleTransformUpdate(
    elementId: string,
    newElement: TableElement,
    resetAttrs?: Record<string, unknown>,
  ) {
    // Debug: [TableRenderer] Handling transform update: elementId=${elementId}, newElement=${JSON.stringify({ width: newElement.width, height: newElement.height })}, resetAttrs=${JSON.stringify(resetAttrs)}

    // Get the group and apply reset attributes if provided
    const group = this.groupById.get(elementId);
    if (group && resetAttrs) {
      group.setAttrs(resetAttrs);
      // Debug: [TableRenderer] Applied reset attrs to group: ${JSON.stringify(resetAttrs)}
    }

    // Update the store with the new element
    const storeHook = this.getStoreHook();
    if (storeHook) {
      const state = storeHook.getState();
      state.element.update(elementId, newElement);
      // Debug: [TableRenderer] Updated store with new element
    }
  }

  // Add invisible click areas for cell editing with precise detection
  private addCellClickAreas(group: Konva.Group, el: TableElement) {
    // Remove existing cell interaction areas
    group.find(".cell-clickable").forEach((node) => node.destroy());

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
          fill: "transparent",
          listening: true,
          name: "cell-clickable",
          perfectDrawEnabled: false,
        });

        // Context menu handling - let events bubble properly
        clickArea.on("contextmenu", (_e) => {
          // Debug: [TableModule] Cell [${row}, ${col}] contextmenu event
          // Don't cancel bubble - let it go to table group and then stage
        });

        // Double-click to edit using the tracked editor for live resize support
        clickArea.on("dblclick", (e) => {
          // Debug: [TableModule] Cell [${row}, ${col}] double-clicked
          e.cancelBubble = true; // Prevent stage events for editing

          const stage = group.getStage();
          if (stage) {
            openCellEditorWithTracking({
              stage,
              elementId: el.id,
              element: el,
              getElement: () =>
                this.getStoreHook()?.getState().element.getById(el.id) as TableElement,
              row,
              col,
              onCommit: (value, tableId, commitRow, commitCol) =>
                this.commitCellText(tableId, commitRow, commitCol, value),
              onSizeChange: (payload) => this.handleCellAutoResize(payload),
            });
          }
        });

        // Visual feedback for cell interaction
        clickArea.on("mouseenter", () => {
          const stage = group.getStage();
          if (stage?.container()) {
            stage.container().style.cursor = "text";
          }
        });

        clickArea.on("mouseleave", () => {
          const stage = group.getStage();
          if (stage?.container()) {
            stage.container().style.cursor = "default";
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
    const getSelectionModule = () => (window as ExtendedWindow).selectionModule;

    // Context menu handler for the table group
    group.on("contextmenu", (e) => {
      // Debug: [TableModule] Table group contextmenu event: elementId=${elementId}, target=${e.target}, currentTarget=${e.currentTarget}, targetName=${e.target?.name?.()}, groupName=${group.name()}, groupId=${group.id()}

      // Prevent position jumping during context menu
      e.evt.preventDefault();
      e.cancelBubble = false; // Allow bubbling to stage for context menu handling

      // Store the current position to prevent any updates during context menu
      const currentPos = group.position();
      group.setAttr("_contextMenuPosition", currentPos);
    });

    // Enhanced click handler for selection
    group.on("click tap", (e) => {
      // Don't interfere with transformer handle clicks
      const isTransformerClick =
        e.target?.getParent()?.className === "Transformer" ||
        e.target?.className === "Transformer";
      if (!isTransformerClick) {
        e.cancelBubble = true; // Prevent stage click
      }

      const selectionModule = getSelectionModule();
      if (selectionModule) {
        const isAdditive = e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey;
        if (isAdditive) {
          selectionModule.toggleSelection?.(elementId) ??
            selectionModule.selectElement(elementId);
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

    // Enhanced drag handling to prevent position drift
    group.on("dragend", () => {
      const newPos = group.position();
      const storeHook = this.getStoreHook();
      if (storeHook) {
        const state = storeHook.getState();
        // Update store with exact final position
        state.element.update(
          elementId,
          {
            x: newPos.x,
            y: newPos.y,
          } as Partial<TableElement>
        );
      }
    });
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
