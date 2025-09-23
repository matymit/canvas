// features/canvas/tauri/TauriCanvasOptimizations.ts

import Konva from 'konva';

export type LayersLike = Array<Konva.Layer> | { [k: string]: Konva.Layer | undefined };

export interface ApplyHiDPIOptions {
  // if true, also set global pixel ratio fallback for complex cases
  setGlobalPixelRatioFallback?: boolean;
}

// Apply device pixel ratio to every layer's scene and hit canvases
export function applyHiDPI(
  dpr: number,
  stage: Konva.Stage,
  layers?: LayersLike,
  opts: ApplyHiDPIOptions = {}
): void {
  if (opts.setGlobalPixelRatioFallback) {
    // Using Konva.pixelRatio as a coarse fallback on retina if needed
    // See Konva performance tips regarding retina performance vs. crispness
    // Note: setting this globally may impact quality; prefer per-layer pixel ratio when possible.
    (Konva as typeof Konva & { pixelRatio?: number }).pixelRatio = dpr; // runtime fallback only
  }

  const allLayers: Konva.Layer[] =
    Array.isArray(layers)
      ? layers.filter(Boolean) as Konva.Layer[]
      : layers
      ? Object.values(layers).filter(Boolean) as Konva.Layer[]
      : stage.getLayers();

  for (const ly of allLayers) {
    try {
      // Per-layer canvas pixel ratio for crisp rendering
      (ly.getCanvas() as { setPixelRatio?: (ratio: number) => void }).setPixelRatio?.(dpr);
      (ly.getHitCanvas() as { setPixelRatio?: (ratio: number) => void }).setPixelRatio?.(dpr);
      ly.batchDraw();
    } catch {
      // noop if unavailable in current Konva version
    }
  }
}

// Disable interaction costs for static or decorative layers (e.g., grid/guides)
export function configureStaticLayer(layer: Konva.Layer): void {
  // listening false removes event detection overhead
  layer.listening(false);
  // Do not use deprecated hitGraphEnabled; listening(false) is sufficient per Konva docs
  layer.batchDraw();
}

// Move a node to a dedicated drag layer during drag for smoother performance
export function enableDragLayerOptimization(
  node: Konva.Node,
  dragLayer: Konva.Layer,
  originLayer?: Konva.Layer
): void {
  let originalParent: Konva.Container | null = originLayer ?? node.getParent() ?? null;

  node.on('dragstart', () => {
    originalParent = node.getParent();
    node.moveTo(dragLayer);
    dragLayer.batchDraw();
  });

  node.on('dragend', () => {
    if (originalParent) {
      node.moveTo(originalParent);
      originalParent.getLayer()?.batchDraw();
    } else {
      dragLayer.batchDraw();
    }
  });
}

// Cache complex nodes and relax perfect drawing/shadow strokes for speed
export function cacheNodeIfComplex(node: Konva.Node, opts?: { pixelRatio?: number }): void {
  try {
    // Only shapes support perfectDrawEnabled/shadowForStrokeEnabled
    const nodeWithOptionalMethods = node as Konva.Node & {
      perfectDrawEnabled?: (enabled: boolean) => void;
      shadowForStrokeEnabled?: (enabled: boolean) => void;
    };
    if (typeof nodeWithOptionalMethods.perfectDrawEnabled === 'function') {
      nodeWithOptionalMethods.perfectDrawEnabled(false);
    }
    if (typeof nodeWithOptionalMethods.shadowForStrokeEnabled === 'function') {
      nodeWithOptionalMethods.shadowForStrokeEnabled(false);
    }
    if (typeof node.cache === 'function') {
      // Higher pixelRatio cache can improve quality if needed
      node.cache({ pixelRatio: opts?.pixelRatio ?? undefined });
    }
  } catch {
    // ignore
  }
}

// Throttled batchDraw using requestAnimationFrame
export function rafBatchDraw(layer: Konva.Layer): () => void {
  let raf = 0;
  return () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      layer.batchDraw();
    });
  };
}

// Apply conservative stage defaults for performance
export function applyStagePerfDefaults(stage: Konva.Stage): void {
  // No heavy defaults here; Konva defaults are reasonable.
  // Container-level CSS hints for smoother transforms can help.
  try {
    const container = stage.container();
    container.style.contain = 'layout paint size';
    container.style.willChange = 'transform';
  } catch {
    // ignore
  }
}

// Utility: pick four-layer convention by z-order
export function getFourLayersByIndex(stage: Konva.Stage): {
  background?: Konva.Layer;
  main?: Konva.Layer;
  preview?: Konva.Layer;
  overlay?: Konva.Layer;
} {
  const [background, main, preview, overlay] = stage.getLayers();
  return { background, main, preview, overlay };
}