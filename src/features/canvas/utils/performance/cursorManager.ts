// features/canvas/utils/performance/cursorManager.ts
//
// Robust cursor manager for Vanilla Konva: manipulates Stage container style.cursor,
// offers a stack-based API, and convenience binding to shapes for hover cursors.

import type Konva from 'konva';

type Cursor = CSSStyleDeclaration['cursor'];

export interface CursorBindingOptions {
  cursor?: Cursor; // default 'pointer'
  onEnter?: (evt: Konva.KonvaEventObject<MouseEvent | PointerEvent>) => void;
  onLeave?: (evt: Konva.KonvaEventObject<MouseEvent | PointerEvent>) => void;
}

export class CursorManager {
  private readonly stage: Konva.Stage;
  private stack: Cursor[] = [];
  private readonly defaultCursor: Cursor;

  constructor(stage: Konva.Stage, defaultCursor: Cursor = 'default') {
    this.stage = stage;
    this.defaultCursor = defaultCursor;
    this.set(defaultCursor);
  }

  set(cursor: Cursor) {
    const c = this.stage.container();
    c.style.cursor = cursor;
  }

  push(cursor: Cursor) {
    const current = this.stage.container().style.cursor || this.defaultCursor;
    this.stack.push(current);
    this.set(cursor);
  }

  pop() {
    const prev = this.stack.pop();
    this.set(prev ?? this.defaultCursor);
  }

  reset() {
    this.stack = [];
    this.set(this.defaultCursor);
  }

  // Bind hover cursor to any Konva.Node, restoring on leave automatically.
  bindHover(node: Konva.Node, opts: CursorBindingOptions = {}) {
    const cursor = opts.cursor ?? 'pointer';
    const enter = (e: Konva.KonvaEventObject<MouseEvent>) => {
      this.push(cursor);
      opts.onEnter?.(e);
    };
    const leave = (e: Konva.KonvaEventObject<MouseEvent>) => {
      this.pop();
      opts.onLeave?.(e);
    };
    node.on('mouseenter', enter);
    node.on('mouseleave', leave);
    // Return unbind function.
    return () => {
      node.off('mouseenter', enter);
      node.off('mouseleave', leave);
    };
  }
}