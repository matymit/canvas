// Image drag handler that prevents snap-back and integrates with store
import type Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';

export class ImageDragHandler {
  private readonly stage: Konva.Stage;
  private isDragging = false;
  private dragStartPos: { x: number; y: number } | null = null;
  private draggedElementId: string | null = null;

  constructor(stage: Konva.Stage) {
    this.stage = stage;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.stage.on('dragstart', this.handleDragStart.bind(this));
    this.stage.on('dragmove', this.handleDragMove.bind(this));
    this.stage.on('dragend', this.handleDragEnd.bind(this));
  }

  private handleDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    const target = e.target;

    // Only handle image groups
    if (target.name() !== 'image' && target.getParent()?.name() !== 'image') {
      return;
    }

    const group = target.name() === 'image' ? target : target.getParent();
    if (!group) return;

    const elementId = group.getAttr('elementId') || group.id();
    if (!elementId) return;

    this.isDragging = true;
    this.draggedElementId = elementId;
    this.dragStartPos = { x: group.x(), y: group.y() };

    // Enable dragging on the group
    group.draggable(true);
  }

  private handleDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    if (!this.isDragging || !this.draggedElementId) return;

    const target = e.target;
    const group = target.name() === 'image' ? target : target.getParent();
    if (!group) return;

    // Update is handled by Konva's drag system
    // We don't need to manually update positions during drag
  }

  private handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    if (!this.isDragging || !this.draggedElementId) return;

    const target = e.target;
    const group = target.name() === 'image' ? target : target.getParent();
    if (!group) return;

    const elementId = this.draggedElementId;
    const newPos = { x: group.x(), y: group.y() };

    // Disable dragging
    group.draggable(false);

    // Only commit to store if position actually changed
    if (this.dragStartPos &&
        (Math.abs(newPos.x - this.dragStartPos.x) > 1 ||
         Math.abs(newPos.y - this.dragStartPos.y) > 1)) {

      const store = useUnifiedCanvasStore.getState();

      // Update element position in store
      if (store.element?.update) {
        store.withUndo('Move image', () => {
          store.element.update(elementId, {
            x: newPos.x,
            y: newPos.y,
          });
        });
      } else if (store.updateElement) {
        store.withUndo('Move image', () => {
          store.updateElement(elementId, {
            x: newPos.x,
            y: newPos.y,
          });
        });
      }
    }

    // Reset drag state
    this.isDragging = false;
    this.draggedElementId = null;
    this.dragStartPos = null;
  }

  public cleanup() {
    this.stage.off('dragstart', this.handleDragStart);
    this.stage.off('dragmove', this.handleDragMove);
    this.stage.off('dragend', this.handleDragEnd);
  }
}

export default ImageDragHandler;