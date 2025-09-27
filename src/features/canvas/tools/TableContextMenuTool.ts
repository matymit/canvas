import type Konva from 'konva';
import type { ToolEventHandler } from '../hooks/useCanvasEventManager';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import type { TableElement } from '../types/table';

/**
 * Table Context Menu Tool - handles right-click events for table elements
 * Integrates with the unified event manager to provide proper context menu support
 */
export class TableContextMenuTool implements ToolEventHandler {
  priority = 10; // High priority for context menu handling

  private readonly showContextMenu?: (x: number, y: number, tableId: string, row: number, col: number) => void;

  constructor(showContextMenuCallback?: (x: number, y: number, tableId: string, row: number, col: number) => void) {
    this.showContextMenu = showContextMenuCallback;
  }

  canHandle(e: Konva.KonvaEventObject<Event> | KeyboardEvent): boolean {
    // Only handle right-click events on table elements, not keyboard events
    if (e instanceof KeyboardEvent) return false;
    if (e.type !== 'contextmenu') return false;

    const target = e.target;
    if (!target) return false;

    // Check if we clicked on a table element or its children
    let node: Konva.Node | null = target;
    let searchDepth = 0;

    while (node && searchDepth < 10) {
      if (node.hasName && node.hasName('table-group')) {
        return true;
      }
      if (node.name && node.name() === 'table-group') {
        return true;
      }
      node = node.getParent();
      searchDepth++;
    }

    return false;
  }

  onContextMenu = (e: Konva.KonvaEventObject<Event>): boolean => {
    if (!this.canHandle(e)) return false;

    // Prevent browser context menu
    e.evt?.preventDefault?.();

    const target = e.target;
    if (!target) return false;

    // Find the table group
    let tableGroup: Konva.Node | null = target;
    let searchDepth = 0;

    const hasTableName = (node: Konva.Node | null) => {
      if (!node) return false;
      if (typeof node.hasName === 'function') return node.hasName('table-group');
      return node.name?.() === 'table-group';
    };

    while (tableGroup && !hasTableName(tableGroup) && searchDepth < 10) {
      tableGroup = tableGroup.getParent();
      searchDepth++;
    }

    if (!tableGroup || !hasTableName(tableGroup)) return false;

    // Get stage and pointer position
    const stage = tableGroup.getStage();
    if (!stage) return false;

    const tableId = tableGroup.id();
    stage.setPointersPositions(e.evt as MouseEvent);
    const pointerPos = stage.getPointerPosition() ?? {
      x: (e.evt as MouseEvent)?.offsetX ?? (e.evt as MouseEvent)?.layerX ?? 0,
      y: (e.evt as MouseEvent)?.offsetY ?? (e.evt as MouseEvent)?.layerY ?? 0,
    };

    // Get table element to calculate cell position
    const store = useUnifiedCanvasStore.getState();
    const tableElement = store.element.getById(tableId);
    if (!tableElement || tableElement.type !== 'table') return false;

    // Calculate which cell was clicked
    const tableTransform = tableGroup.getAbsoluteTransform();
    const localPos = tableTransform.copy().invert().point(pointerPos);

    const table = tableElement as TableElement;

    let computedCol = -1;
    let cumulativeX = 0;
    for (let c = 0; c < table.cols; c++) {
      const width = table.colWidths[c] ?? table.width / table.cols;
      if (localPos.x >= cumulativeX && localPos.x <= cumulativeX + width) {
        computedCol = c;
        break;
      }
      cumulativeX += width;
    }

    let computedRow = -1;
    let cumulativeY = 0;
    for (let r = 0; r < table.rows; r++) {
      const height = table.rowHeights[r] ?? table.height / table.rows;
      if (localPos.y >= cumulativeY && localPos.y <= cumulativeY + height) {
        computedRow = r;
        break;
      }
      cumulativeY += height;
    }

    if (computedRow === -1 || computedCol === -1) {
      return false;
    }

    const nativeEvent = e.evt as MouseEvent;
    const screenX = nativeEvent.clientX;
    const screenY = nativeEvent.clientY;

    if (this.showContextMenu) {
      this.showContextMenu(screenX, screenY, tableId, computedRow, computedCol);
      return true;
    }

    return false;
  };
}
