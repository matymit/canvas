import Konva from 'konva';

export interface AppearOptions {
  fromOpacity?: number;   // default 0.0
  fromScale?: number;     // default 0.92
  duration?: number;      // seconds, default 0.18
  easing?: (t: number) => number; // Konva.Easings wrapper
  layer?: Konva.Layer | null;
}

export interface TransformOptions {
  to: Partial<{
    x: number; y: number;
    scaleX: number; scaleY: number;
    rotation: number;
    opacity: number;
    width: number; height: number;
  }>;
  duration?: number; // seconds
  easing?: (t: number) => number;
  layer?: Konva.Layer | null;
}

export interface PulseOptions {
  scale?: number;     // default 1.05
  duration?: number;  // seconds, default 0.15
  easing?: (t: number) => number;
  layer?: Konva.Layer | null;
}

const E = Konva.Easings || {
  EaseOut: (t: number) => t,
  StrongEaseOut: (t: number) => t,
  BackEaseOut: (t: number) => t,
};

const TWEEN_KEY = '__activeTweens';

function getTweens(node: Konva.Node): Map<string, Konva.Tween> {
  const nodeWithTweens = node as Konva.Node & { [TWEEN_KEY]?: Map<string, Konva.Tween> };
  if (!nodeWithTweens[TWEEN_KEY]) nodeWithTweens[TWEEN_KEY] = new Map<string, Konva.Tween>();
  return nodeWithTweens[TWEEN_KEY] as Map<string, Konva.Tween>;
}

function stopTween(node: Konva.Node, key: string) {
  const map = getTweens(node);
  const tw = map.get(key);
  if (tw) {
    try { tw.pause(); tw.destroy(); } catch (error) {
      // Ignore cleanup errors
    }
    map.delete(key);
  }
}

function setTween(node: Konva.Node, key: string, tween: Konva.Tween) {
  const map = getTweens(node);
  stopTween(node, key);
  map.set(key, tween);
}

function batchDraw(layer?: Konva.Layer | null) {
  try { layer?.batchDraw(); } catch (error) {
    // Ignore cleanup errors
  }
}

export function animateAppear(node: Konva.Node, opts?: AppearOptions): Konva.Tween {
  const layer = opts?.layer ?? node.getLayer();
  const fromOpacity = opts?.fromOpacity ?? 0.0;
  const fromScale = opts?.fromScale ?? 0.92;
  const duration = opts?.duration ?? 0.18;
  const easing = opts?.easing ?? E.BackEaseOut;

  // Capture current attributes
  const toOpacity = node.opacity();
  const toScaleX = node.scaleX();
  const toScaleY = node.scaleY();

  node.opacity(fromOpacity);
  node.scale({ x: fromScale * toScaleX, y: fromScale * toScaleY });
  batchDraw(layer);

  const tween = new Konva.Tween({
    node,
    duration,
    easing,
    opacity: toOpacity,
    scaleX: toScaleX,
    scaleY: toScaleY,
    onFinish: () => batchDraw(layer),
  });

  setTween(node, 'appear', tween);
  tween.play();
  return tween;
}

export function animateTransform(node: Konva.Node, options: TransformOptions): Konva.Tween {
  const layer = options.layer ?? node.getLayer();
  const duration = options.duration ?? 0.2;
  const easing = options.easing ?? E.StrongEaseOut;
  const attrs = { ...options.to };

  const tween = new Konva.Tween({
    node,
    duration,
    easing,
    ...attrs,
    onFinish: () => batchDraw(layer),
  });

  setTween(node, 'transform', tween);
  tween.play();
  return tween;
}

export function animatePulse(node: Konva.Node, options?: PulseOptions): Promise<void> {
  const layer = options?.layer ?? node.getLayer();
  const scale = options?.scale ?? 1.05;
  const duration = options?.duration ?? 0.15;
  const easing = options?.easing ?? E.EaseOut;

  return new Promise<void>((resolve) => {
    const sx0 = node.scaleX();
    const sy0 = node.scaleY();

    const up = new Konva.Tween({
      node,
      duration,
      easing,
      scaleX: sx0 * scale,
      scaleY: sy0 * scale,
      onFinish: () => {
        const down = new Konva.Tween({
          node,
          duration,
          easing,
          scaleX: sx0,
          scaleY: sy0,
          onFinish: () => {
            batchDraw(layer);
            resolve();
          },
        });
        setTween(node, 'pulse-down', down);
        down.play();
      },
    });
    setTween(node, 'pulse-up', up);
    up.play();
  });
}

export function stopAllAnimations(node: Konva.Node) {
  const map = getTweens(node);
  for (const [k, t] of map) {
    try { t.pause(); t.destroy(); } catch (error) {
      // Ignore cleanup errors
    }
    map.delete(k);
  }
}

export default {
  animateAppear,
  animateTransform,
  animatePulse,
  stopAllAnimations,
};