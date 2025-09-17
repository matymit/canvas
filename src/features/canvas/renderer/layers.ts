import Konva from 'konva';

export interface RendererLayers {
  background: Konva.Layer; // non-interactive grid/guides [listening=false]
  main: Konva.Layer;       // primary content
  highlighter: Konva.Layer; // highlighter strokes (above main, below preview) [listening=false]
  preview: Konva.Layer;    // tool previews/temporary
  overlay: Konva.Layer;    // selection handles, UI overlays
}

/**
 * Options for creating and maintaining renderer layers.
 */
export interface CreateLayersOptions {
  dpr?: number;            // device pixel ratio
  listeningBackground?: boolean; // default false
  listeningMain?: boolean;       // default true
  listeningHighlighter?: boolean; // default false
  listeningPreview?: boolean;    // default false
  listeningOverlay?: boolean;    // default true
}

/**
 * Create the five-layer pipeline and add them to the stage in z-order:
 * background -> main -> highlighter -> preview -> overlay.
 */
export function createRendererLayers(
  stage: Konva.Stage,
  opts: CreateLayersOptions = {}
): RendererLayers {
  const {
    dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    listeningBackground = false,
    listeningMain = true,
    listeningHighlighter = false,  // Performance optimization: highlighter layer is non-interactive
    listeningPreview = false,  // Performance optimization: preview layer is non-interactive
    listeningOverlay = true,
  } = opts;

  const background = new Konva.Layer({ listening: listeningBackground });
  const main = new Konva.Layer({ listening: listeningMain });
  const highlighter = new Konva.Layer({ listening: listeningHighlighter });
  const preview = new Konva.Layer({ listening: listeningPreview });
  const overlay = new Konva.Layer({ listening: listeningOverlay });

  stage.add(background);
  stage.add(main);
  stage.add(highlighter);
  stage.add(preview);
  stage.add(overlay);

  // Apply pixel ratio to keep HiDPI crispness
  [background, main, highlighter, preview, overlay].forEach((ly) => {
    try {
      ly.getCanvas().setPixelRatio(dpr);
    } catch {
      // noop; method can vary per Konva version but is supported as setPixelRatio
    }
  });

  // Initial draws
  background.draw();
  main.draw();
  highlighter.draw();
  preview.draw();
  overlay.draw();

  return { background, main, highlighter, preview, overlay };
}

/**
 * Update pixel ratio on all layers and redraw them to avoid blurry output on HiDPI changes.
 */
export function setLayersPixelRatio(layers: RendererLayers, dpr: number) {
  [layers.background, layers.main, layers.highlighter, layers.preview, layers.overlay].forEach((ly) => {
    try {
      ly.getCanvas().setPixelRatio(dpr);
    } catch {
      // noop
    }
    ly.batchDraw();
  });
}

/**
 * Resize stage and implicitly all layers; also re-apply dpr for crispness.
 */
export function resizeRenderer(
  stage: Konva.Stage,
  layers: RendererLayers,
  width: number,
  height: number,
  dpr?: number
) {
  stage.size({ width: Math.floor(width), height: Math.floor(height) });

  if (typeof dpr === 'number') {
    setLayersPixelRatio(layers, dpr);
  }

  // Minimal redraw to reflect size changes
  layers.background.batchDraw();
  layers.main.batchDraw();
  layers.highlighter.batchDraw();
  layers.preview.batchDraw();
  layers.overlay.batchDraw();
}

/**
 * Move overlay to the top when needed (e.g., after adding new layers externally).
 */
export function ensureOverlayOnTop(layers: RendererLayers) {
  layers.overlay.moveToTop();
  layers.overlay.getStage()?.batchDraw();
}

/**
 * Cleanly destroy layers to avoid memory leaks.
 */
export function destroyLayers(layers: RendererLayers) {
  // Destroy in reverse z-order is generally safe
  layers.overlay.destroy();
  layers.preview.destroy();
  layers.highlighter.destroy();
  layers.main.destroy();
  layers.background.destroy();
}