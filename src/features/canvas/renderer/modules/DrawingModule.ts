import Konva from "konva";
import { getWorldPointer } from "../../utils/pointer";
import { RafBatcher } from "../../utils/performance/RafBatcher";
import { ToolPreviewLayer } from "./ToolPreviewLayer";

export type DrawingSubtype = "pen" | "marker" | "highlighter" | "eraser";

interface DrawingModuleConfig {
  subtype: DrawingSubtype;
  color: () => string;
  width: () => number;
  opacity: () => number;
  multiplyBlend?: boolean;
  actionName?: string;
  interactiveAfterCommit?: boolean;
  idFactory?: () => string;
  rafBatcher?: RafBatcher;
}

interface StrokeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default class DrawingModule {
  private readonly stage: Konva.Stage;
  private readonly config: DrawingModuleConfig;
  private readonly rafBatcher: RafBatcher;
  private readonly ownsBatcher: boolean;

  private previewLayer: Konva.Layer | null = null;
  private line: Konva.Line | null = null;
  private isDrawing = false;
  private points: number[] = [];
  private lastPoint: { x: number; y: number } | null = null;
  private static readonly MIN_DISTANCE_SQ = 4;

  constructor(config: DrawingModuleConfig, stage: Konva.Stage) {
    this.config = config;
    this.stage = stage;
    this.ownsBatcher = !config.rafBatcher;
    this.rafBatcher = config.rafBatcher ?? new RafBatcher();
  }

  onPointerDown = () => {
    if (this.isDrawing) return;

    const previewLayer = ToolPreviewLayer.getPreviewLayer(this.stage);
    if (!previewLayer) return;

    const pointer = getWorldPointer(this.stage);
    if (!pointer) return;

    this.isDrawing = true;
    this.previewLayer = previewLayer;
    this.points = [pointer.x, pointer.y];
    this.lastPoint = { x: pointer.x, y: pointer.y };

    this.line = new Konva.Line({
      points: this.points,
      stroke: this.config.color(),
      strokeWidth: this.config.width(),
      opacity: this.config.opacity(),
      lineCap: "round",
      lineJoin: "round",
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
      globalCompositeOperation: this.getCompositeOperation(),
    });

    this.previewLayer.add(this.line);
    this.previewLayer.batchDraw();
  };

  onPointerMove = () => {
    if (!this.isDrawing || !this.line) return;

    const pointer = getWorldPointer(this.stage);
    if (!pointer) return;

    const didAdd = this.tryAddPoint(pointer.x, pointer.y);
    if (!didAdd) return;

    this.rafBatcher.schedule(() => {
      if (!this.line) return;
      this.line.points(this.points);
      this.previewLayer?.batchDraw();
    });
  };

  onPointerUp = () => {
    if (!this.isDrawing) return;
    const pointer = getWorldPointer(this.stage);
    if (pointer) {
      this.tryAddPoint(pointer.x, pointer.y, true);
    }
    this.commitStroke();
  };

  onPointerLeave = () => {
    if (!this.isDrawing) return;
    const pointer = getWorldPointer(this.stage);
    if (pointer) {
      this.tryAddPoint(pointer.x, pointer.y, true);
    }
    this.commitStroke();
  };

  dispose() {
    if (this.ownsBatcher) {
      this.rafBatcher.dispose();
    }
    if (this.line) {
      try {
        this.line.destroy();
      } catch {
        // ignore destroy errors during cleanup
      }
    }
    this.line = null;
    this.previewLayer = null;
    this.points = [];
    this.isDrawing = false;
    this.lastPoint = null;
  }

  private commitStroke() {
    if (!this.line) {
      this.reset();
      return;
    }

    const actionName = this.config.actionName ?? this.getDefaultActionName();
    const bounds = this.computeBounds();
    const elementId = this.config.idFactory
      ? this.config.idFactory()
      : `${this.config.subtype}-stroke-${Date.now()}`;

    ToolPreviewLayer.commitStroke(
      this.stage,
      this.line,
      {
        id: elementId,
        type: "drawing",
        subtype: this.config.subtype,
        points: [...this.points],
        bounds,
        style: {
          stroke: this.config.subtype === "eraser" ? "#FFFFFF" : this.config.color(),
          strokeWidth: this.config.width(),
          opacity: this.config.opacity(),
          lineCap: "round",
          lineJoin: "round",
          globalCompositeOperation: this.getCompositeOperation(),
        },
      },
      actionName,
      this.config.interactiveAfterCommit ?? this.config.subtype !== "eraser",
    );

    this.reset();
  }

  private reset() {
    this.line = null;
    this.previewLayer = null;
    this.points = [];
    this.isDrawing = false;
    this.lastPoint = null;
  }

  private computeBounds(): StrokeBounds {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < this.points.length; i += 2) {
      const x = this.points[i];
      const y = this.points[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    if (minX === Number.POSITIVE_INFINITY) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private getCompositeOperation(): GlobalCompositeOperation {
    if (this.config.subtype === "eraser") {
      return "destination-out";
    }
    if (this.config.multiplyBlend) {
      return "multiply";
    }
    return "source-over";
  }

  private getDefaultActionName() {
    switch (this.config.subtype) {
      case "pen":
        return "Draw with pen";
      case "marker":
        return "Draw with marker";
      case "highlighter":
        return "Draw with highlighter";
      case "eraser":
        return "Erase with eraser";
      default:
        return "Draw";
    }
  }

  private tryAddPoint(x: number, y: number, force = false): boolean {
    if (!this.line) return false;
    if (!this.lastPoint) {
      this.points.push(x, y);
      this.lastPoint = { x, y };
      return true;
    }

    const dx = x - this.lastPoint.x;
    const dy = y - this.lastPoint.y;
    if (!force && dx * dx + dy * dy <= DrawingModule.MIN_DISTANCE_SQ) {
      return false;
    }

    this.points.push(x, y);
    this.lastPoint = { x, y };
    return true;
  }
}
