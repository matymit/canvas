// features/canvas/hooks/useKeyboardShortcuts.ts

import { useEffect, useMemo } from 'react';

export interface KeyboardShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitToContent?: () => void;
  onTool?: (toolId: string) => void; // e.g., 'select', 'pan', 'text', 'draw-rectangle', etc.
}

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  // userAgentData may not be available in all WebViews; fallback to platform testing
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '';
  const plat = (uaData || navigator.platform || '').toLowerCase();
  return plat.includes('mac') || plat.includes('iphone') || plat.includes('ipad');
}

export default function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, target: Window | Document | HTMLElement | null = window) {
  const isMac = useMemo(isMacPlatform, []);
  useEffect(() => {
    if (!target) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const meta = e.metaKey;
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;

      // Undo/redo
      if ((meta || ctrl) && key.toLowerCase() === 'z') {
        e.preventDefault();
        if (shift) handlers.onRedo?.();
        else handlers.onUndo?.();
        return;
      }
      if ((meta || ctrl) && key.toLowerCase() === 'y') {
        e.preventDefault();
        handlers.onRedo?.();
        return;
      }

      // Delete
      if (key === 'Delete' || key === 'Backspace') {
        if (document.activeElement && (document.activeElement as HTMLElement).isContentEditable) return;
        e.preventDefault();
        handlers.onDelete?.();
        return;
      }

      // Copy
      if ((meta || ctrl) && key.toLowerCase() === 'c') {
        e.preventDefault();
        handlers.onCopy?.();
        return;
      }

      // Paste
      if ((meta || ctrl) && key.toLowerCase() === 'v') {
        e.preventDefault();
        handlers.onPaste?.();
        return;
      }

      // Duplicate
      if ((meta || ctrl) && key.toLowerCase() === 'd') {
        e.preventDefault();
        handlers.onDuplicate?.();
        return;
      }

      // Select all
      if ((meta || ctrl) && key.toLowerCase() === 'a') {
        e.preventDefault();
        handlers.onSelectAll?.();
        return;
      }

      // Zoom
      if ((meta || ctrl) && (key === '=' || key === '+')) {
        e.preventDefault();
        handlers.onZoomIn?.();
        return;
      }
      if ((meta || ctrl) && key === '-') {
        e.preventDefault();
        handlers.onZoomOut?.();
        return;
      }
      if ((meta || ctrl) && key === '0') {
        e.preventDefault();
        handlers.onZoomReset?.();
        return;
      }

      // Fit
      if ((isMac ? meta : ctrl) && shift && key === '1') {
        e.preventDefault();
        handlers.onFitToContent?.();
        return;
      }

      // Tool shortcuts (example mapping)
      // Select: V, Pan/Hand: H, Text: T, Rectangle: R, Circle: O, Pen: P, Marker: M, Highlighter: Y, Sticky: S, Line: L, Arrow: A
      const lower = key.toLowerCase();
      const map: Record<string, string> = {
        v: 'select',
        h: 'pan',
        t: 'text',
        r: 'draw-rectangle',
        o: 'draw-circle',
        p: 'pen',
        m: 'marker',
        y: 'highlighter',
        s: 'sticky-note',
        l: 'connector-line',
        a: 'connector-arrow',
      };
      if (!meta && !ctrl && !shift && map[lower]) {
        e.preventDefault();
        handlers.onTool?.(map[lower]);
        return;
      }
    };

    const node = target as EventTarget;
    node.addEventListener('keydown', onKeyDown as EventListener);
    return () => {
      node.removeEventListener('keydown', onKeyDown as EventListener);
    };
  }, [handlers, target, isMac]);
}
