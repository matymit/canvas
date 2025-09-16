import Konva from 'konva';
// Reuse existing caching helpers from the project
import {
  cacheLayerStatic,
  clearShapeCache,
} from '../../utils/ShapeCaching';

export interface GridOptions {
  spacing: number;           // world units between dots
  dotRadius: number;         // world units (before stage scale)
  color: string;             // CSS color for dots
  opacity?: number;          // 0..1
  dpr?: number;              // devicePixelRatio override; if omitted use window.devicePixelRatio
  cacheLayer?: boolean;      // cache the background layer
  recacheOnZoom?: boolean;   // re-cache layer on zoom to keep dots crisp
  hugeRectSize?: number;     // world size of the pattern rect
}

const DEFAULTS: Required<Omit<GridOptions, 'dpr'>> = {
  spacing: 24,
  dotRadius: 1.5,
  color: '#E5E7EB',
  opacity: 1,
  cacheLayer: true,
  recacheOnZoom: true,
  hugeRectSize: 100000,
};

export class GridRenderer {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private rect: Konva.Rect | null = null;
  private tile: HTMLCanvasElement | null = null;
  private options: GridOptions;
  private zoomListenerBound = false;
  private rafRecache: number | null = null;

  constructor(stage: Konva.Stage, backgroundLayer: Konva.Layer, options?: Partial<GridOptions>) {
    this.stage = stage;
    this.layer = backgroundLayer;
    this.layer.listening(false);
    this.options = { ...DEFAULTS, ...options };
    this.init();
  }

  private getDpr(): number {
    if (typeof this.options.dpr === 'number') return this.options.dpr;
    if (typeof window !== 'undefined') return window.devicePixelRatio || 1;
    return 1;
  }

  private makeTile() {
    const dpr = this.getDpr();
    const spacingPx = Math.max(1, Math.floor(this.options.spacing * dpr));
    const rPx = Math.max(1, Math.floor(this.options.dotRadius * dpr));

    const canvas = document.createElement('canvas');
    canvas.width = spacingPx;
    canvas.height = spacingPx;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = this.options.color;
    ctx.globalAlpha = this.options.opacity ?? 1;

    // Draw a dot at the origin so it wraps seamlessly across tile seams.
    ctx.beginPath();
    ctx.arc(0, 0, rPx, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  private ensureRect(): Konva.Rect {
    if (this.rect) return this.rect;

    const size = this.options.hugeRectSize ?? DEFAULTS.hugeRectSize;
    const half = size / 2;

    this.rect = new Konva.Rect({
      x: -half,
      y: -half,
      width: size,
      height: size,
      listening: false,
      shadowForStrokeEnabled: false,
      perfectDrawEnabled: false,
    });

    this.layer.add(this.rect);
    return this.rect;
  }

  private applyPattern() {
    if (!this.rect) return;
    if (!this.tile) return;

    this.rect.fillPatternImage(this.tile);
    this.rect.fillPatternRepeat('repeat');
    this.rect.opacity(this.options.opacity ?? 1);

    // Clear any previous cache on the rect; the layer will be cached below if requested.
    clearShapeCache(this.rect);
  }

  private recacheLayerSoon() {
    if (!this.options.cacheLayer) return;
    if (this.rafRecache != null) return;
    this.rafRecache = requestAnimationFrame(() => {
      this.rafRecache = null;
      try {
        // Re-cache the entire background layer for faster composite under pan/zoom.
        cacheLayerStatic(this.layer);
      } catch {
        // ignore cache failures
      } finally {
        this.layer.batchDraw();
      }
    });
  }

  private attachZoomListeners() {
    if (this.zoomListenerBound || !this.options.recacheOnZoom) return;
    this.zoomListenerBound = true;

    const reTileAndCache = () => {
      // Recreate tile at new DPR/scale feel; using DPR + layer cache keeps dots crisp.
      this.tile = this.makeTile();
      this.applyPattern();
      this.recacheLayerSoon();
    };

    // Attribute change events for Konva nodes fire on changes to scale/position.
    this.stage.on('scaleXChange scaleYChange', reTileAndCache);
    // Optional: respond to DPR changes if caller updates dpr externally via options setter
    // Caller can call updateOptions({ dpr: next }) to re-tile explicitly.
  }

  private init() {
    this.tile = this.makeTile();
    this.ensureRect();
    this.applyPattern();

    // Cache static background layer for performance, as recommended.
    if (this.options.cacheLayer) {
      try {
        cacheLayerStatic(this.layer);
      } catch {
        // ignore if unavailable
      }
    }

    this.layer.batchDraw();
    this.attachZoomListeners();
  }

  updateOptions(next: Partial<GridOptions>) {
    this.options = { ...this.options, ...next };
    const needsRetile =
      typeof next.spacing === 'number' ||
      typeof next.dotRadius === 'number' ||
      typeof next.color === 'string' ||
      typeof next.opacity === 'number' ||
      typeof next.dpr === 'number';

    if (needsRetile) {
      this.tile = this.makeTile();
      this.applyPattern();
    }

    if (next.cacheLayer !== undefined || needsRetile) {
      if (this.options.cacheLayer) this.recacheLayerSoon();
    }

    this.layer.batchDraw();
  }

  destroy() {
    if (this.rafRecache != null) {
      cancelAnimationFrame(this.rafRecache);
      this.rafRecache = null;
    }
    if (this.zoomListenerBound) {
      this.stage.off('scaleXChange');
      this.stage.off('scaleYChange');
      this.zoomListenerBound = false;
    }
    try {
      this.rect?.destroy();
    } catch {
      // ignore
    }
    this.rect = null;
    this.tile = null;
  }
}

export default GridRenderer;