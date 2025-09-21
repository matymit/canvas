// features/canvas/quality/accessibility/ScreenReaderUtils.ts

export type Politeness = 'polite' | 'assertive';

const visuallyHiddenStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  border: '0',
  padding: '0',
  clip: 'rect(0 0 1px 1px)',
  clipPath: 'inset(50%)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

export const ScreenReaderUtils = {
  // Apply ARIA semantics to the canvas container
  applyCanvasAria(
    container: HTMLElement,
    opts: { role?: string; label?: string; roledescription?: string; labelledbyId?: string; describedbyId?: string } = {}
  ) {
    const role = opts.role ?? 'application';
    container.setAttribute('role', role);
    if (opts.label) container.setAttribute('aria-label', opts.label);
    if (opts.roledescription) container.setAttribute('aria-roledescription', opts.roledescription);
    if (opts.labelledbyId) container.setAttribute('aria-labelledby', opts.labelledbyId);
    if (opts.describedbyId) container.setAttribute('aria-describedby', opts.describedbyId);
    if (container.tabIndex < 0) container.tabIndex = 0;
  },

  // Ensure a visually-hidden, but accessibility-visible root for aria-activedescendant children
  ensureVirtualRoot(parent: HTMLElement): HTMLElement {
    const id = 'canvas-virtual-root';
    let root = parent.querySelector<HTMLElement>(`#${id}`);
    if (!root) {
      root = document.createElement('div');
      root.id = id;
      Object.assign(root.style, visuallyHiddenStyle);
      // Important: do NOT set aria-hidden, because aria-activedescendant needs AT visibility
      root.setAttribute('role', 'list');
      parent.appendChild(root);
    }
    return root;
  },

  // Create a live region under a given parent
  createLiveRegion(args: { parent?: HTMLElement; politeness?: Politeness; idPrefix?: string }) {
    const parent = args.parent ?? document.body;
    const politeness = args.politeness ?? 'polite';
    const id = `${args.idPrefix ?? 'live-region'}-${politeness}`;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.setAttribute('aria-live', politeness);
      el.setAttribute('role', 'status');
      el.setAttribute('aria-atomic', 'true');
      Object.assign(el.style, visuallyHiddenStyle);
      parent.appendChild(el);
    }
    // Utility to force announcement by clearing then setting text
    const announce = (msg: string) => {
      if (el) {
        el.textContent = ''; // reset
        // small timeout to ensure screen readers detect change
        setTimeout(() => {
          if (el) {
            el.textContent = msg;
          }
        }, 10);
      }
    };
    return { root: el, announce };
  },
};