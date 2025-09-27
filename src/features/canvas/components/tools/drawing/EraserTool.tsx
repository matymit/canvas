
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import { RafBatcher } from '../../../utils/performance/RafBatcher';
import { getWorldPointer } from '../../../utils/pointer';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import type { UnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import type { CanvasElement, ElementId } from '../../../../../../types/index';

const DEFAULT_SIZE = 20;
const ACTION_NAME = 'Erase with eraser';
const MIN_DISTANCE_SQ = 4;

export interface EraserToolProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  isActive: boolean;
  size?: number;
  opacity?: number;
  rafBatcher?: RafBatcher;
}

interface LiveEraserOptions {
  size: number;
  opacity: number;
  rafBatcher: RafBatcher;
  getStore: () => UnifiedCanvasStore;
}

class LiveEraserSession {
  private readonly stage: Konva.Stage;
  private readonly size: number;
  private readonly opacity: number;
  private readonly rafBatcher: RafBatcher;
  private readonly getStore: () => UnifiedCanvasStore;

  private isDrawing = false;
  private points: number[] = [];
  private lastPoint: { x: number; y: number } | null = null;
  private strokeId: ElementId | null = null;
  private pendingUpdate = false;
  private historyBatchActive = false;

  constructor(stage: Konva.Stage, options: LiveEraserOptions) {
    this.stage = stage;
    this.size = options.size;
    this.opacity = options.opacity;
    this.rafBatcher = options.rafBatcher;
    this.getStore = options.getStore;
  }

  onPointerDown() {
    if (this.isDrawing) return;
    const pointer = getWorldPointer(this.stage);
    if (!pointer) return;

    this.isDrawing = true;
    this.points = [pointer.x, pointer.y];
    this.lastPoint = { x: pointer.x, y: pointer.y };
    this.strokeId = this.generateStrokeId();

    const store = this.getStore();
    const style = this.buildStyle();
    const element: CanvasElement = {
      id: this.strokeId,
      type: 'drawing',
      subtype: 'eraser',
      points: [...this.points],
      x: pointer.x,
      y: pointer.y,
      width: 0,
      height: 0,
      style,
    };

    if (store.history?.beginBatch) {
      store.history.beginBatch(ACTION_NAME);
      this.historyBatchActive = true;
    }

    store.addElement?.(element, { pushHistory: false, select: false });
  }

  onPointerMove() {
    if (!this.isDrawing || !this.strokeId) return;
    const pointer = getWorldPointer(this.stage);
    if (!pointer) return;

    const didAdd = this.tryAddPoint(pointer.x, pointer.y);
    if (!didAdd) return;

    this.scheduleUpdate();
  }

  onPointerUp() {
    if (!this.isDrawing) return;
    const pointer = getWorldPointer(this.stage);
    if (pointer) {
      this.tryAddPoint(pointer.x, pointer.y, true);
    }

    this.flushUpdate();
    this.commitStroke();
  }

  onPointerLeave() {
    if (!this.isDrawing) return;
    this.flushUpdate();
    this.commitStroke();
  }

  dispose() {
    if (this.isDrawing) {
      this.cancelStroke();
    }
  }

  private scheduleUpdate() {
    if (this.pendingUpdate) return;
    this.pendingUpdate = true;
    this.rafBatcher.schedule(() => {
      this.pendingUpdate = false;
      this.pushUpdate();
    });
  }

  private flushUpdate() {
    if (this.pendingUpdate) {
      this.pendingUpdate = false;
      this.pushUpdate();
    } else {
      this.pushUpdate();
    }
  }

  private pushUpdate() {
    if (!this.strokeId) return;
    const store = this.getStore();
    if (typeof store.updateElement !== 'function') return;

    const bounds = this.computeBounds();
    store.updateElement(
      this.strokeId,
      {
        points: [...this.points],
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        style: this.buildStyle(),
      },
      { pushHistory: false },
    );
  }

  private commitStroke() {
    if (!this.strokeId) {
      this.reset();
      return;
    }

    const store = this.getStore();
    const getElement = store.getElement ?? store.element?.getById;
    const element = getElement ? getElement(this.strokeId) : undefined;

    if (!element) {
      if (this.historyBatchActive) {
        store.history?.endBatch?.(false);
      }
      this.reset();
      return;
    }

    const clone: CanvasElement = {
      ...element,
      points: Array.isArray(element.points) ? [...element.points] : [],
      style: element.style ? { ...element.style } : undefined,
    };

    store.history?.record?.({
      type: 'add',
      elements: [clone],
    });

    if (this.historyBatchActive) {
      store.history?.endBatch?.(true);
    }

    this.reset();
  }

  private cancelStroke() {
    const store = this.getStore();
    if (this.strokeId) {
      store.removeElement?.(this.strokeId, { pushHistory: false, deselect: false });
    }
    if (this.historyBatchActive) {
      store.history?.endBatch?.(false);
    }
    this.reset();
  }

  private reset() {
    this.isDrawing = false;
    this.points = [];
    this.lastPoint = null;
    this.strokeId = null;
    this.pendingUpdate = false;
    this.historyBatchActive = false;
  }

  private tryAddPoint(x: number, y: number, force = false): boolean {
    if (!this.lastPoint) {
      this.points.push(x, y);
      this.lastPoint = { x, y };
      return true;
    }

    const dx = x - this.lastPoint.x;
    const dy = y - this.lastPoint.y;
    if (!force && dx * dx + dy * dy <= MIN_DISTANCE_SQ) {
      return false;
    }

    this.points.push(x, y);
    this.lastPoint = { x, y };
    return true;
  }

  private computeBounds() {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < this.points.length; i += 2) {
      const px = this.points[i];
      const py = this.points[i + 1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    if (minX === Number.POSITIVE_INFINITY) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }

  private buildStyle(): CanvasElement['style'] {
    return {
      stroke: '#FFFFFF',
      strokeWidth: this.size,
      opacity: this.opacity,
      lineCap: 'round',
      lineJoin: 'round',
      globalCompositeOperation: 'destination-out',
    };
  }

  private generateStrokeId(): ElementId {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID() as ElementId;
    }
    return `eraser-stroke-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

const EraserTool: React.FC<EraserToolProps> = ({
  stageRef,
  isActive,
  size = DEFAULT_SIZE,
  opacity = 1,
  rafBatcher,
}) => {
  const fallbackBatcherRef = useRef<RafBatcher | null>(null);
  const batcher = useMemo(() => {
    if (rafBatcher) {
      return rafBatcher;
    }
    if (!fallbackBatcherRef.current) {
      fallbackBatcherRef.current = new RafBatcher();
    }
    return fallbackBatcherRef.current;
  }, [rafBatcher]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !isActive) return;

    const session = new LiveEraserSession(stage, {
      size,
      opacity,
      rafBatcher: batcher,
      getStore: () => useUnifiedCanvasStore.getState(),
    });

    const handlePointerDown = () => session.onPointerDown();
    const handlePointerMove = () => session.onPointerMove();
    const handlePointerUp = () => session.onPointerUp();
    const handlePointerLeave = () => session.onPointerLeave();

    stage.on('pointerdown.erasertool', handlePointerDown);
    stage.on('pointermove.erasertool', handlePointerMove);
    stage.on('pointerup.erasertool', handlePointerUp);
    stage.on('pointerleave.erasertool', handlePointerLeave);

    return () => {
      stage.off('.erasertool');
      session.dispose();
    };
  }, [stageRef, isActive, size, opacity, batcher]);

  return null;
};

export default EraserTool;
