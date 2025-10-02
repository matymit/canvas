import Konva from 'konva';

export interface RendererLayers {
  background: Konva.Layer; // non-interactive grid/guides [listening=false]
  main: Konva.Layer; // primary content
  highlighter: Konva.Group; // non-interactive group nested inside main layer for highlight strokes
  preview: Konva.Layer; // tool previews/temporary
  overlay: Konva.Layer; // selection handles, UI overlays
}

/**
 * Options for creating and maintaining renderer layers.
 */
export interface CreateLayersOptions {
  dpr?: number; // device pixel ratio
  listeningBackground?: boolean; // default false
  listeningMain?: boolean; // default true
  listeningPreview?: boolean; // default false
  listeningOverlay?: boolean; // default true
}

/**
 * Create the four-layer pipeline (background -> main -> preview -> overlay) and
 * nest a non-interactive highlighter group inside the main layer to preserve
 * z-ordering while staying within the blueprint's layer budget.
 */
export function createRendererLayers(
  stage: Konva.Stage,
  opts: CreateLayersOptions = {}
): RendererLayers {
  const {
    dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    listeningBackground = false,
    listeningMain = true,
    listeningPreview = false, // Performance optimization: preview layer is non-interactive
    listeningOverlay = true,
  } = opts;

  const background = new Konva.Layer({ listening: listeningBackground });
  background.name('background-layer');

  const main = new Konva.Layer({ listening: listeningMain });
  main.name('main-layer');

  const highlighter = new Konva.Group({ listening: false });
  highlighter.name('main-highlighter');
  main.add(highlighter);
  const preview = new Konva.Layer({ listening: listeningPreview });
  preview.name('preview-layer');

  const overlay = new Konva.Layer({ listening: listeningOverlay });
  overlay.name('overlay-layer');

  stage.add(background);
  stage.add(main);
  stage.add(preview);
  stage.add(overlay);

  // Apply pixel ratio to keep HiDPI crispness
  [background, main, preview, overlay].forEach((ly) => {
    try {
      ly.getCanvas().setPixelRatio(dpr);
    } catch {
      // noop; method can vary per Konva version but is supported as setPixelRatio
    }
  });

  // Initial draws
  background.draw();
  main.draw();
  preview.draw();
  overlay.draw();

  return { background, main, highlighter, preview, overlay };
}

/**
 * Update pixel ratio on all layers and redraw them to avoid blurry output on HiDPI changes.
 */
export function setLayersPixelRatio(layers: RendererLayers, dpr: number) {
  [layers.background, layers.main, layers.preview, layers.overlay].forEach((ly) => {
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
