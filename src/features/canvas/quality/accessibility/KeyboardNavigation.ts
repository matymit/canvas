// features/canvas/quality/accessibility/KeyboardNavigation.ts

import type Konva from 'konva';
import type { AccessibilityManager } from './AccessibilityManager';

export interface KeyboardNavigationOptions {
  accessibility?: AccessibilityManager | null;
  getSelectableNodeIds: () => string[]; // must be stable or memoized by caller
  onSelect: (id: string | null, additive?: boolean) => void;
  onMoveSelected: (dx: number, dy: number) => void;
  onDeleteSelected: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  moveStep?: number;       // default 1 content unit
  moveStepLarge?: number;  // default 10 content units
  getActiveId?: () => string | null;
  setActiveId?: (id: string | null) => void;
}

export class KeyboardNavigation {
  private readonly stage: Konva.Stage;
  private readonly container: HTMLElement;
  private readonly opts: Required<Omit<KeyboardNavigationOptions, 'accessibility' | 'onUndo' | 'onRedo' | 'onZoomIn' | 'onZoomOut' | 'onZoomReset' | 'getActiveId' | 'setActiveId'>> & {
    accessibility?: AccessibilityManager | null;
    onUndo?: () => void;
    onRedo?: () => void;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onZoomReset?: () => void;
    getActiveId?: () => string | null;
    setActiveId?: (id: string | null) => void;
  };

  private readonly keydownHandler: (e: KeyboardEvent) => void;
  private readonly mousedownFocusHandler: () => void;

  constructor(stage: Konva.Stage, options: KeyboardNavigationOptions) {
    this.stage = stage;
    this.container = stage.container();
    this.opts = {
      accessibility: options.accessibility ?? null,
      getSelectableNodeIds: options.getSelectableNodeIds,
      onSelect: options.onSelect,
      onMoveSelected: options.onMoveSelected,
      onDeleteSelected: options.onDeleteSelected,
      onUndo: options.onUndo,
      onRedo: options.onRedo,
      onZoomIn: options.onZoomIn,
      onZoomOut: options.onZoomOut,
      onZoomReset: options.onZoomReset,
      moveStep: options.moveStep ?? 1,
      moveStepLarge: options.moveStepLarge ?? 10,
      getActiveId: options.getActiveId,
      setActiveId: options.setActiveId,
    };

    // Focus container on mousedown/pointerdown so it receives key events
    this.mousedownFocusHandler = () => this.container.focus();
    this.container.addEventListener('pointerdown', this.mousedownFocusHandler, { passive: true });

    // Make container focusable if needed
    if (this.container.tabIndex < 0) this.container.tabIndex = 0;

    // Attach keydown directly to container per Konva docs
    this.keydownHandler = (e) => this.onKeyDown(e);
    this.container.addEventListener('keydown', this.keydownHandler);
  }

  destroy() {
    this.container.removeEventListener('keydown', this.keydownHandler);
    this.container.removeEventListener('pointerdown', this.mousedownFocusHandler);
  }

  private onKeyDown(e: KeyboardEvent) {
    const key = e.key;
    const meta = e.metaKey;
    const ctrl = e.ctrlKey;
    const shift = e.shiftKey;

    // Undo/redo
    if ((meta || ctrl) && key.toLowerCase() === 'z') {
      e.preventDefault();
      if (shift) this.opts.onRedo?.();
      else this.opts.onUndo?.();
      return;
    }
    if ((meta || ctrl) && (key.toLowerCase() === 'y')) {
      e.preventDefault();
      this.opts.onRedo?.();
      return;
    }

    // Zoom
    if ((meta || ctrl) && (key === '=' || key === '+')) {
      e.preventDefault();
      this.opts.onZoomIn?.();
      return;
    }
    if ((meta || ctrl) && (key === '-' )) {
      e.preventDefault();
      this.opts.onZoomOut?.();
      return;
    }
    if ((meta || ctrl) && key === '0') {
      e.preventDefault();
      this.opts.onZoomReset?.();
      return;
    }

    // Delete
    if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      this.opts.onDeleteSelected();
      this.opts.accessibility?.announce('Deleted selection', 'assertive');
      return;
    }

    // Tab traversal (virtual roving via aria-activedescendant)
    if (key === 'Tab') {
      e.preventDefault();
      const ids = this.opts.getSelectableNodeIds();
      if (ids.length === 0) {
        this.opts.accessibility?.setActive(null);
        this.opts.setActiveId?.(null);
        return;
      }
      const active = this.opts.getActiveId?.() ?? null;
      const curIdx = active ? Math.max(0, ids.indexOf(active)) : -1;
      const nextIdx = shift ? (curIdx <= 0 ? ids.length - 1 : curIdx - 1) : (curIdx >= ids.length - 1 ? 0 : curIdx + 1);
      const nextId = ids[nextIdx];
      this.opts.onSelect(nextId, false);
      this.opts.setActiveId?.(nextId);
      this.opts.accessibility?.setActive(nextId);
      return;
    }

    // Movement with arrow keys; respect stage scale for content-space deltas
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault();
      const scaleX = this.stage.scaleX() || 1;
      const scaleY = this.stage.scaleY() || 1;
      const base = shift ? this.opts.moveStepLarge : this.opts.moveStep;
      const dx = key === 'ArrowLeft' ? -base / scaleX : key === 'ArrowRight' ? base / scaleX : 0;
      const dy = key === 'ArrowUp' ? -base / scaleY : key === 'ArrowDown' ? base / scaleY : 0;
      if (dx !== 0 || dy !== 0) {
        this.opts.onMoveSelected(dx, dy);
        const amount = Math.round(Math.hypot(dx, dy));
        this.opts.accessibility?.announce(`Moved ${amount} units`, 'polite');
      }
      return;
    }
  }
}