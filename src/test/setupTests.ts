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

// Provide a minimal localStorage shim if env doesn’t expose one
if (typeof (globalThis as Record<string, unknown>).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}