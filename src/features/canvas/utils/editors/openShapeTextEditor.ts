// Opens a DOM overlay editor centered inside a shape, auto-resizes smoothly,
// and writes back text + shape height growth to the store.

import Konva from 'konva';
import { computeShapeInnerBox } from '../text/computeShapeInnerBox';
import { useUnifiedCanvasStore } from '../../stores/unifiedCanvasStore';
import type { ElementId, CanvasElement } from '../../../../types';

// Shape type with text properties
type ShapeElement = CanvasElement & {
  type: 'rectangle' | 'circle' | 'ellipse' | 'triangle';
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
};

function worldToPage(stage: Konva.Stage, wx: number, wy: number) {
  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;
  const sx = stage.x() || 0;
  const sy = stage.y() || 0;
  const containerRect = stage.container().getBoundingClientRect();
  const px = containerRect.left + sx + wx * scaleX;
  const py = containerRect.top + sy + wy * scaleY;
  return { px, py, scaleX, scaleY };
}

function css(el: HTMLElement, props: Partial<CSSStyleDeclaration>) {
  Object.assign(el.style, props);
}

export interface OpenShapeTextEditorOptions {
  padding?: number;
  minWidth?: number;
  minHeight?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number; // CSS number (like 1.3)
  onCommitted?: (id: ElementId, text: string) => void;
}

/**
 * Centered caret: use a contentEditable DIV with text-align:center.
 * Smooth growth: CSS transitions for overlay size; vertical auto-grow by updating element height.
 */
export function openShapeTextEditor(
  stage: Konva.Stage,
  elementId: ElementId,
  opts: OpenShapeTextEditorOptions = {}
) {
  const store = useUnifiedCanvasStore.getState();
  const element = store.element?.getById(elementId) as ShapeElement | undefined;
  
  if (!element || !store.element?.update) return;

  // Defaults from UI/text tool norms
  const padding = opts.padding ?? (element.data?.padding) ?? 8;
  const fontFamily = opts.fontFamily ?? element.style?.fontFamily ?? 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial';
  const fontSize = opts.fontSize ?? element.style?.fontSize ?? 18;
  const lineHeight = opts.lineHeight ?? 1.3;
  const color = opts.color ?? element.style?.textColor ?? '#111827';
  const minW = opts.minWidth ?? 80;
  const minH = opts.minHeight ?? Math.ceil(fontSize * lineHeight);

  const inner = computeShapeInnerBox(
    {
      id: element.id,
      type: element.type as any,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      radius: (element.data as any)?.radius,
      padding: padding,
    },
    padding
  );

  const startWorld = { x: inner.x, y: inner.y, w: Math.max(minW, inner.width), h: Math.max(minH, inner.height) };
  const { px: left0, py: top0, scaleX, scaleY } = worldToPage(stage, startWorld.x, startWorld.y);

  const overlay = document.createElement('div');
  overlay.contentEditable = 'true';
  overlay.setAttribute('role', 'textbox');
  overlay.setAttribute('aria-label', 'Shape text editor');
  css(overlay, {
    position: 'absolute',
    left: `${left0}px`,
    top: `${top0}px`,
    width: `${startWorld.w * scaleX}px`,
    height: `${startWorld.h * scaleY}px`,
    padding: '0px',
    margin: '0px',
    outline: 'none',
    border: 'none',
    background: 'transparent',
    color,
    fontFamily,
    fontSize: `${fontSize * scaleY}px`,
    lineHeight: `${lineHeight}`,
    textAlign: 'center',
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    zIndex: '1000',
    transition: 'width 120ms ease, height 120ms ease, left 120ms ease, top 120ms ease',
    userSelect: 'text',
    webkitUserSelect: 'text',
  });

  // Initialize with existing text if present.
  const existingText = (element.data as any)?.text || '';
  if (existingText.length) {
    overlay.innerText = existingText;
  } else {
    overlay.innerText = '';
  }

  document.body.appendChild(overlay);

  // Place caret and focus
  const range = document.createRange();
  range.selectNodeContents(overlay);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  overlay.focus();

  // Live reflow
  let raf: number | null = null;
  const measureAndLayout = () => {
    raf && cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      // Compute desired content size (approx) from scroll dimensions
      const desiredW = Math.min(startWorld.w * scaleX, Math.max(minW * scaleX, overlay.scrollWidth));
      const desiredH = Math.min(startWorld.h * scaleY, Math.max(minH * scaleY, overlay.scrollHeight));

      // Apply CSS transition-resized overlay
      css(overlay, {
        width: `${desiredW}px`,
        height: `${desiredH}px`,
      });

      // If content exceeds available inner height, grow element height smoothly
      const availHWorld = startWorld.h;
      const desiredHWorld = desiredH / scaleY;

      if (desiredHWorld > availHWorld + 0.5) {
        const delta = desiredHWorld - availHWorld;
        // Step growth by small increments to look smooth
        const step = Math.max(2, Math.round(delta / 4));

        store.element!.update(elementId, {
          height: Math.max((element.height ?? availHWorld) + step, desiredHWorld + padding * 2),
        });

        // Recompute world->page coordinates for overlay after growth
        const updated = store.element!.getById(elementId)!;
        const grownInner = computeShapeInnerBox(
          {
            id: updated.id,
            type: updated.type as any,
            x: updated.x,
            y: updated.y,
            width: updated.width,
            height: updated.height,
            radius: (updated.data as any)?.radius,
            padding: padding,
          },
          padding
        );

        const { px, py } = worldToPage(stage, grownInner.x, grownInner.y);
        css(overlay, {
          left: `${px}px`,
          top: `${py}px`,
        });
      }
    });
  };

  const onInput = () => measureAndLayout();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      commit(true);
    }
  };
  const onBlur = () => commit(false);

  overlay.addEventListener('input', onInput);
  overlay.addEventListener('blur', onBlur, { once: true });
  window.addEventListener('keydown', onKey, { capture: true });

  // Initial layout
  measureAndLayout();

  function cleanup() {
    overlay.removeEventListener('input', onInput);
    window.removeEventListener('keydown', onKey, { capture: true } as any);
    if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    if (raf) cancelAnimationFrame(raf);
  }

  function commit(cancel: boolean) {
    const txt = overlay.innerText.trim();
    cleanup();
    if (cancel || txt.length === 0) return;

    // Persist text and text style into the shape element
    store.element!.update(elementId, {
      data: {
        ...(element?.data || {}),
        text: txt,
        padding,
      },
      style: {
        ...(element?.style || {}),
        fontFamily,
        fontSize,
        fill: color,
        textAlign: 'center',
      }
    });

    opts.onCommitted?.(elementId, txt);
  }
}