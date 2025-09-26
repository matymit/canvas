import type Konva from 'konva';
import type { ToolEventHandler } from '../hooks/useCanvasEventManager';
import type { CanvasElement } from '../../../../types';

/**
 * Canvas Context Menu Tool - handles right-click events for all canvas elements
 * Integrates with the unified event manager to provide general context menu support
 */
export class CanvasContextMenuTool implements ToolEventHandler {
  priority = 5; // Medium priority for general context menu handling (lower than table-specific)

  private readonly showContextMenu?: (x: number, y: number, clickedElementId?: string) => void;
  private readonly getElement?: (id: string) => CanvasElement | undefined;

  constructor(
    showContextMenuCallback?: (x: number, y: number, clickedElementId?: string) => void,
    getElementCallback?: (id: string) => CanvasElement | undefined
  ) {
    this.showContextMenu = showContextMenuCallback;
    this.getElement = getElementCallback;
  }

  canHandle(e: Konva.KonvaEventObject<Event> | KeyboardEvent): boolean {
    // Only handle right-click events, not keyboard events
    if (e instanceof KeyboardEvent) return false;
    if (e.type !== 'contextmenu') return false;

    const target = e.target;
    if (!target) return false;

    // Check if this is a table element - if so, let TableContextMenuTool handle it
    let node: Konva.Node | null = target;
    let searchDepth = 0;

    while (node && searchDepth < 10) {
      if (node.hasName && node.hasName('table-group')) {
        return false; // Let table context menu handle this
      }
      if (node.name && node.name() === 'table-group') {
        return false; // Let table context menu handle this
      }
      node = node.getParent();
      searchDepth++;
    }

    // Handle all other context menu events
    return true;
  }

  onContextMenu = (e: Konva.KonvaEventObject<Event>): boolean => {
    if (!this.canHandle(e)) return false;

    // Prevent browser context menu
    e.evt?.preventDefault?.();

    const target = e.target;
    if (!target) return false;

    // Get stage and pointer position
    const stage = target.getStage();
    if (!stage) return false;

    const pointerPos = stage.getPointerPosition() ?? {
      x: (e.evt as MouseEvent)?.offsetX ?? (e.evt as MouseEvent)?.layerX ?? 0,
      y: (e.evt as MouseEvent)?.offsetY ?? (e.evt as MouseEvent)?.layerY ?? 0,
    };

    // Convert stage coordinates to screen coordinates
    const container = stage.container();
    const rect = container.getBoundingClientRect();
    const screenX = rect.left + pointerPos.x;
    const screenY = rect.top + pointerPos.y;

    // Try to determine which element was clicked
    let clickedElementId: string | undefined;

    if (target !== stage) {
      // Try to find the element ID from the Konva node
      let node: Konva.Node | null = target;
      let searchDepth = 0;

      while (node && node !== stage && searchDepth < 10) {
        const id = node.id();
        if (id && this.getElement && this.getElement(id)) {
          clickedElementId = id;
          break;
        }
        node = node.getParent();
        searchDepth++;
      }
    }

    // Show context menu if callback is provided
    if (this.showContextMenu) {
      this.showContextMenu(screenX, screenY, clickedElementId);
      return true; // Event consumed
    }

    return false;
  };
}