// src/test/setupTests.ts
// Global setup for Vitest unit tests

import { enableMapSet } from 'immer';
import { vi } from 'vitest';

// Ensure Immer can handle Map/Set in all produce() calls used by Zustand's immer middleware
enableMapSet();

// In jsdom, KeyboardEvent and document/window exist. If running without jsdom for any reason,
// provide very light fallbacks to avoid ReferenceErrors in logic-only tests.
interface MockKeyboardEventInit {
  bubbles?: boolean;
  cancelable?: boolean;
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

if (typeof (globalThis as Record<string, unknown>).KeyboardEvent === 'undefined') {
  (globalThis as Record<string, unknown>).KeyboardEvent = class {
    constructor(public type: string, public init?: MockKeyboardEventInit) {}
  };
}

// Mock node-canvas and skia-canvas so Konva's node build (if loaded) won't crash
vi.mock('canvas', () => ({
  DOMMatrix: class DOMMatrix {},
  Image: class Image {},
  createCanvas: (w: number, h: number) => ({
    width: w,
    height: h,
    getContext: (_: string) => ({
      fillRect: () => {},
      clearRect: () => {},
    }),
    toDataURL: () => 'data:image/png;base64,mock',
  }),
}));

vi.mock('skia-canvas', () => ({
  Canvas: function (this: { width: number; height: number; getContext: () => unknown; toDataURL: () => string }, w: number, h: number) {
    this.width = w; this.height = h;
    this.getContext = () => ({ fillRect: () => {}, clearRect: () => {} });
    this.toDataURL = () => 'data:image/png;base64,mock';
  },
}));

// Provide a comprehensive Konva mock globally to keep tests consistent across files
interface MockStage {
  add: (layer: MockLayer) => MockStage;
  getLayers: () => MockLayer[];
  getChildren: () => MockLayer[];
  getStage: () => MockStage;
  width: (n?: number) => number;
  height: (n?: number) => number;
  size: (s?: { width: number; height: number }) => { width: number; height: number };
  x: (n?: number) => number;
  y: (n?: number) => number;
  position: (p?: { x: number; y: number }) => { x: number; y: number };
  scale: (s?: { x: number; y: number }) => { x: number; y: number };
  scaleX: (n?: number) => number;
  scaleY: (n?: number) => number;
  draggable: (v?: boolean) => boolean;
  on: (evt: string, cb: () => unknown) => MockStage;
  off: (evt?: string, cb?: () => unknown) => MockStage;
  container: () => MockContainerElement | null;
  getPointerPosition: () => { x: number; y: number };
  batchDraw: () => void;
  toDataURL: (opts?: { mimeType?: string }) => string;
  destroy: () => void;
}

interface MockLayer {
  add: (node: MockNode) => void;
  getChildren: () => MockNode[];
  batchDraw: () => void;
  draw: () => void;
  listening: () => void;
  visible: () => void;
  zIndex: () => void;
  destroy: () => void;
  destroyChildren: () => void;
  getCanvas: () => { setPixelRatio: () => void };
  getLayer: () => MockLayer;
}

interface MockNode {
  getLayer?: () => MockLayer;
  getParent?: () => MockLayer | MockGroup;
  destroy: () => void;
  name?: () => string;
}

interface MockGroup extends MockNode {
  add: (node: MockNode) => void;
  getChildren: () => MockNode[];
  position: (p?: { x: number; y: number }) => { x: number; y: number } | undefined;
  rotation: (n?: number) => number | undefined;
  opacity: (n?: number) => number | undefined;
  setAttrs: (attrs: Record<string, unknown>) => void;
  name: () => string;
  id: () => string;
}

interface MockContainerElement {
  style: { cursor: string };
  setAttribute: () => void;
  getBoundingClientRect: () => {
    left: number;
    top: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
    x: number;
    y: number;
    toJSON: () => void;
  };
  addEventListener: () => void;
  removeEventListener: () => void;
}

function konvaFactory() {
  const STAGES: MockStage[] = [];

  const makeStage = (config: Record<string, unknown> = {}) => {
    let _width = typeof config.width === 'number' ? config.width : 800;
    let _height = typeof config.height === 'number' ? config.height : 600;
    let _x = 0;
    let _y = 0;
    let _scaleX = 1;
    let _scaleY = 1;
    let _draggable = false;

    const layers: MockLayer[] = [];
    const listeners = new Map<string, (() => unknown)[]>();

    const containerEl = {
      style: { cursor: 'default' as string },
      setAttribute: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: _width,
        height: _height,
        right: _width,
        bottom: _height,
        x: 0,
        y: 0,
        toJSON: () => {},
      })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as MockContainerElement;

    const stage: MockStage = {
      // hierarchy
      add: vi.fn((ly: MockLayer) => {
        layers.push(ly);
        if (!ly.getLayer) ly.getLayer = vi.fn(() => ly);
        if (!ly.getParent) ly.getParent = vi.fn(() => stage);
        return stage;
      }),
      getLayers: vi.fn(() => layers),
      getChildren: vi.fn(() => layers),
      getStage: vi.fn(() => stage),

      // geometry
      width: vi.fn((n?: number) => (typeof n === 'number' ? (_width = n) : _width)),
      height: vi.fn((n?: number) => (typeof n === 'number' ? (_height = n) : _height)),
      size: vi.fn((s?: { width: number; height: number }) => {
        if (s) { _width = s.width; _height = s.height; }
        return { width: _width, height: _height };
      }),
      x: vi.fn((n?: number) => (typeof n === 'number' ? (_x = n) : _x)),
      y: vi.fn((n?: number) => (typeof n === 'number' ? (_y = n) : _y)),
      position: vi.fn((p?: { x: number; y: number }) => {
        if (p) { _x = p.x; _y = p.y; }
        return { x: _x, y: _y };
      }),
      scale: vi.fn((s?: { x: number; y: number }) => {
        if (s) { _scaleX = s.x; _scaleY = s.y; }
        return { x: _scaleX, y: _scaleY };
      }),
      scaleX: vi.fn((n?: number) => (typeof n === 'number' ? (_scaleX = n) : _scaleX)),
      scaleY: vi.fn((n?: number) => (typeof n === 'number' ? (_scaleY = n) : _scaleY)),
      draggable: vi.fn((v?: boolean) => (typeof v === 'boolean' ? (_draggable = v) : _draggable)),

      // events
      on: vi.fn((evt: string, cb: () => unknown) => {
        const arr = listeners.get(evt) ?? [];
        arr.push(cb);
        listeners.set(evt, arr);
        return stage;
      }),
      off: vi.fn((evt?: string, cb?: () => unknown) => {
        if (!evt) { listeners.clear(); return stage; }
        if (!cb) { listeners.delete(evt); return stage; }
        const arr = listeners.get(evt) ?? [];
        listeners.set(evt, arr.filter((f) => f !== cb));
        return stage;
      }),

      // misc
      container: vi.fn(() => (config.container === null ? null : containerEl)),
      getPointerPosition: vi.fn(() => ({ x: _width / 2, y: _height / 2 })),
      batchDraw: vi.fn(),
      toDataURL: vi.fn((opts?: { mimeType?: string }) => `data:${opts?.mimeType ?? 'image/png'}`),
      destroy: vi.fn(),
    };

    STAGES.push(stage);
    return stage;
  };

  const makeLayer = (_config?: Record<string, unknown>) => {
    const children: MockNode[] = [];
    const layer: MockLayer = {
      add: vi.fn((node: MockNode) => {
        children.push(node);
        if (!node.getLayer) node.getLayer = vi.fn(() => layer);
        if (!node.getParent) node.getParent = vi.fn(() => layer);
      }),
      getChildren: vi.fn(() => children),
      batchDraw: vi.fn(),
      draw: vi.fn(),
      listening: vi.fn(),
      visible: vi.fn(),
      zIndex: vi.fn(),
      destroy: vi.fn(),
      destroyChildren: vi.fn(() => { children.splice(0, children.length); }),
      getCanvas: vi.fn(() => ({ setPixelRatio: vi.fn() })),
      getLayer: vi.fn(() => layer),
    };
    return layer;
  };

  const makeGroup = () => {
    const children: MockNode[] = [];
    const group: MockGroup = {
      add: vi.fn((node: MockNode) => {
        children.push(node);
        if (!node.getParent) node.getParent = vi.fn(() => group);
        if (!node.getLayer) node.getLayer = vi.fn(() => group.getLayer?.());
      }),
      getChildren: vi.fn(() => children),
      position: vi.fn((p?: { x: number; y: number }) => p),
      rotation: vi.fn((n?: number) => n),
      opacity: vi.fn((n?: number) => n),
      setAttrs: vi.fn((_attrs: Record<string, unknown>) => {}),
      name: vi.fn(() => 'group'),
      id: vi.fn(() => ''),
      getLayer: vi.fn(),
      destroy: vi.fn(),
    };
    return group;
  };

  const makeTransformer = () => ({
    nodes: vi.fn(),
    visible: vi.fn(),
    keepRatio: vi.fn(),
    enabledAnchors: vi.fn(),
    rotateEnabled: vi.fn(),
    borderStroke: vi.fn(),
    borderStrokeWidth: vi.fn(),
    anchorSize: vi.fn(),
    anchorStroke: vi.fn(),
    anchorFill: vi.fn(),
    anchorCornerRadius: vi.fn(),
    on: vi.fn(),
    getLayer: vi.fn(() => ({ batchDraw: vi.fn() })),
    destroy: vi.fn(),
  });

  const makeLine = () => {
    let pts: number[] = [];
    return {
      points: vi.fn((arr?: number[]) => (Array.isArray(arr) ? (pts = arr, undefined) : pts)),
      stroke: vi.fn(),
      strokeWidth: vi.fn(),
      lineCap: vi.fn(),
      lineJoin: vi.fn(),
      opacity: vi.fn(),
      tension: vi.fn(),
      globalCompositeOperation: vi.fn(),
      listening: vi.fn(),
      perfectDrawEnabled: vi.fn(),
      shadowForStrokeEnabled: vi.fn(),
      hitStrokeWidth: vi.fn(),
      remove: vi.fn(),
      destroy: vi.fn(),
      moveTo: vi.fn(),
      dash: vi.fn(),
      size: vi.fn(),
    } as MockNode;
  };

  const makeShape = (config?: Record<string, unknown>) => {
    const shape = {
      _attrs: { ...(config || {}) },
      setAttrs: vi.fn((attrs: Record<string, unknown>) => Object.assign(shape._attrs, attrs)),
      name: vi.fn(() => shape._attrs?.name),
      sceneFunc: vi.fn((fn?: () => unknown) => { if (typeof fn === 'function') shape._sceneFunc = fn; return shape; }),
      clearCache: vi.fn(),
      destroy: vi.fn(),
    };
    return shape;
  };

  const makeText = (config?: Record<string, unknown>) => {
    let _x = config?.x ?? 0;
    let _y = config?.y ?? 0;
    let _width = config?.width ?? 0;
    let _height = config?.height ?? 0;
    let _text = config?.text ?? '';
    const _fontFamily = config?.fontFamily ?? 'sans-serif';
    const _fontSize = config?.fontSize ?? 12;
    const _fill = config?.fill ?? '#000';
    const _align = config?.align ?? 'left';
    const node = {
      setAttrs: vi.fn((attrs: Record<string, unknown>) => {
        Object.assign(node, attrs);
        if (typeof attrs.x === 'number') _x = attrs.x;
        if (typeof attrs.y === 'number') _y = attrs.y;
        if (typeof attrs.width === 'number') _width = attrs.width;
        if (typeof attrs.height === 'number') _height = attrs.height;
        if (typeof attrs.text === 'string') _text = attrs.text;
      }),
      x: vi.fn(() => _x),
      y: vi.fn(() => _y),
      width: vi.fn(() => _width),
      height: vi.fn(() => _height),
      text: vi.fn((t?: string) => (typeof t === 'string' ? (_text = t) : _text)),
      fontFamily: vi.fn(() => _fontFamily),
      fontSize: vi.fn(() => _fontSize),
      fill: vi.fn(() => _fill),
      align: vi.fn(() => _align),
      listening: true,
      perfectDrawEnabled: false,
      destroy: vi.fn(),
      name: vi.fn(() => 'text'),
    };
    return node;
  };

  const makeImage = (config?: Record<string, unknown>) => {
    let _img: HTMLImageElement | undefined = undefined;
    let _src: string | undefined = undefined;
    let _width = config?.width ?? 0;
    let _height = config?.height ?? 0;
    const node = {
      image: vi.fn((img?: HTMLImageElement) => (img !== undefined ? (_img = img) : _img)),
      setAttr: vi.fn((k: string, v: unknown) => { if (k === 'src') _src = v as string; (node as Record<string, unknown>)[k] = v; }),
      getAttr: vi.fn((k: string) => (k === 'src' ? _src : (node as Record<string, unknown>)[k])),
      size: vi.fn((wh?: { width: number; height: number }) => {
        if (wh) { _width = wh.width; _height = wh.height; }
        return { width: _width, height: _height };
      }),
      destroy: vi.fn(),
      name: vi.fn(() => 'image'),
    };
    return node;
  };

  const baseNode = (name: string) => ({
    name: vi.fn(() => name),
    destroy: vi.fn(),
    moveTo: vi.fn(),
  });

  return {
    default: {
      stages: STAGES,
      Stage: vi.fn().mockImplementation(makeStage),
      Layer: vi.fn().mockImplementation(makeLayer),
      Group: vi.fn().mockImplementation(makeGroup),
      Transformer: vi.fn().mockImplementation(makeTransformer),
      Line: vi.fn().mockImplementation(makeLine),
      Rect: vi.fn().mockImplementation(makeShape),
      Circle: vi.fn().mockImplementation(makeShape),
      Shape: vi.fn().mockImplementation(makeShape),
      Text: vi.fn().mockImplementation(makeText),
      Image: vi.fn().mockImplementation(makeImage),
      Ellipse: vi.fn().mockImplementation(() => baseNode('ellipse')),
      RegularPolygon: vi.fn().mockImplementation(() => baseNode('regular-polygon')),
      Arrow: vi.fn().mockImplementation(() => baseNode('arrow')),
      Node: vi.fn(),
    },
  };
}

vi.mock('konva', konvaFactory);
vi.mock('konva/lib/index.js', konvaFactory);

// Provide a minimal localStorage shim if env doesn’t expose one
if (typeof (globalThis as Record<string, unknown>).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}