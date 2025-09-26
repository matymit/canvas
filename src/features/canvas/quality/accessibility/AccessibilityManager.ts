// features/canvas/quality/accessibility/AccessibilityManager.ts

import type Konva from 'konva';
import { ScreenReaderUtils } from './ScreenReaderUtils';

export type Politeness = 'polite' | 'assertive';

export interface AccessibleNodeMetadata {
  id: string;
  role?: string; // e.g., 'img', 'button', 'group', etc.
  name: string; // accessible name
  description?: string;
  posInSet?: number;
  setSize?: number;
  selectable?: boolean;
  tabbable?: boolean;
  // Provide a bbox for future enhancements (focus ring, etc.)
  bboxProvider?: () => { x: number; y: number; width: number; height: number } | null;
}

export interface AccessibilityManagerOptions {
  stage?: Konva.Stage | null;
  label?: string;
  role?: string; // default 'application'
  roledescription?: string; // default 'Canvas'
  useActivedescendant?: boolean; // default true
  liveRegionPoliteness?: Politeness; // default 'polite'
}

export class AccessibilityManager {
  // private _stage: Konva.Stage | null = null; // Removed unused
  private container: HTMLElement | null = null;

  // Virtual accessibility DOM
  private virtualRoot: HTMLElement | null = null;
  private readonly nodeMap = new Map<string, AccessibleNodeMetadata>();

  // Live regions
  private livePolite: { root: HTMLElement; announce: (msg: string) => void } | null = null;
  private liveAssertive: { root: HTMLElement; announce: (msg: string) => void } | null = null;

  private currentActiveId: string | null = null;
  private readonly opts: Required<Omit<AccessibilityManagerOptions, 'stage'>>;

  constructor(opts?: AccessibilityManagerOptions) {
    this.opts = {
      label: opts?.label ?? 'Canvas work area',
      role: opts?.role ?? 'application',
      roledescription: opts?.roledescription ?? 'Canvas',
      useActivedescendant: opts?.useActivedescendant ?? true,
      liveRegionPoliteness: opts?.liveRegionPoliteness ?? 'polite',
    };
    if (opts?.stage) this.attachStage(opts.stage);
  }

  attachStage(stage: Konva.Stage) {
    // this._stage = stage; // Removed unused
    this.container = stage.container();

    // Ensure container is focusable and described
    ScreenReaderUtils.applyCanvasAria(this.container, {
      role: this.opts.role,
      label: this.opts.label,
      roledescription: this.opts.roledescription,
    });

    // Create virtual list root used by aria-activedescendant
    this.virtualRoot = ScreenReaderUtils.ensureVirtualRoot(this.container);

    // Create live regions
    this.livePolite = ScreenReaderUtils.createLiveRegion({
      parent: this.container,
      politeness: 'polite',
      idPrefix: 'canvas-live-polite',
    });
    this.liveAssertive = ScreenReaderUtils.createLiveRegion({
      parent: this.container,
      politeness: 'assertive',
      idPrefix: 'canvas-live-assertive',
    });

    // Focusing behavior: focus container on pointerdown
    const focusOnPointerDown = () => {
      this.container?.focus();
    };
    this.container.addEventListener('pointerdown', focusOnPointerDown, { passive: true });

    // Store cleaner
    (this.container as HTMLElement & { __a11y_focus_listener__?: () => void }).__a11y_focus_listener__ = focusOnPointerDown;

    // Initial announcement to aid SR context
    this.announce(
      `${this.opts.roledescription} focused. ${this.nodeMap.size} items. Use Tab and Shift+Tab to navigate; Arrow keys to move selection.`,
      'polite'
    );
  }

  detach() {
    if (!this.container) return;
    const l = (this.container as HTMLElement & { __a11y_focus_listener__?: () => void }).__a11y_focus_listener__;
    if (l) this.container.removeEventListener('pointerdown', l);
  }

  destroy() {
    this.detach();
    if (this.virtualRoot?.parentElement) this.virtualRoot.parentElement.removeChild(this.virtualRoot);
    if (this.livePolite?.root.parentElement) this.livePolite.root.parentElement.removeChild(this.livePolite.root);
    if (this.liveAssertive?.root.parentElement) this.liveAssertive.root.parentElement.removeChild(this.liveAssertive.root);
    this.nodeMap.clear();
    this.virtualRoot = null;
    this.livePolite = null;
    this.liveAssertive = null;
    // this._stage = null; // Removed unused
    this.container = null;
    this.currentActiveId = null;
  }

  registerNode(meta: AccessibleNodeMetadata) {
    this.nodeMap.set(meta.id, meta);
    this.upsertVirtualNode(meta);
    this.refreshSetPositions();
  }

  updateNode(meta: AccessibleNodeMetadata) {
    if (!this.nodeMap.has(meta.id)) {
      this.registerNode(meta);
      return;
    }
    this.nodeMap.set(meta.id, meta);
    this.upsertVirtualNode(meta);
  }

  unregisterNode(id: string) {
    this.nodeMap.delete(id);
    const el = this.getVirtualNodeEl(id);
    if (el?.parentElement) el.parentElement.removeChild(el);
    if (this.currentActiveId === id) {
      this.currentActiveId = null;
      if (this.opts.useActivedescendant && this.container) {
        this.container.removeAttribute('aria-activedescendant');
      }
    }
    this.refreshSetPositions();
  }

  setActive(id: string | null, announce = true) {
    if (!this.opts.useActivedescendant || !this.container) return;
    this.currentActiveId = id;
    if (id == null) {
      this.container.removeAttribute('aria-activedescendant');
      return;
    }
    const target = this.getVirtualNodeEl(id);
    if (target) {
      this.container.setAttribute('aria-activedescendant', target.id);
      if (announce) {
        const meta = this.nodeMap.get(id);
        if (meta) {
          const parts = [
            meta.name,
            meta.description ? meta.description : undefined,
            meta.posInSet != null && meta.setSize != null ? `Item ${meta.posInSet} of ${meta.setSize}` : undefined,
          ].filter(Boolean);
          this.announce(parts.join('. '), 'polite');
        }
      }
    }
  }

  announce(message: string, politeness: Politeness = this.opts.liveRegionPoliteness) {
    if (politeness === 'assertive') {
      this.liveAssertive?.announce(message);
    } else {
      this.livePolite?.announce(message);
    }
  }

  getNodeIds(): string[] {
    return Array.from(this.nodeMap.keys());
  }

  hasNode(id: string): boolean {
    return this.nodeMap.has(id);
  }

  private upsertVirtualNode(meta: AccessibleNodeMetadata) {
    if (!this.virtualRoot) return;
    const id = this.virtualNodeId(meta.id);
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      this.virtualRoot.appendChild(el);
    }
    // Assign ARIA
    el.setAttribute('role', meta.role ?? 'img');
    el.setAttribute('aria-label', meta.name);
    if (meta.description) {
      el.setAttribute('aria-description', meta.description);
    } else {
      el.removeAttribute('aria-description');
    }
    if (meta.posInSet != null) el.setAttribute('aria-posinset', String(meta.posInSet));
    else el.removeAttribute('aria-posinset');
    if (meta.setSize != null) el.setAttribute('aria-setsize', String(meta.setSize));
    else el.removeAttribute('aria-setsize');

    // Make it not tabbable directly; focus is on container
    el.setAttribute('tabindex', '-1');
  }

  private refreshSetPositions() {
    if (!this.virtualRoot) return;
    const ids = Array.from(this.nodeMap.keys());
    const size = ids.length;
    ids.forEach((id, i) => {
      const meta = this.nodeMap.get(id);
      if (!meta) return;
      const el = this.getVirtualNodeEl(id);
      if (!el) return;
      const pos = meta.posInSet ?? i + 1;
      el.setAttribute('aria-posinset', String(pos));
      el.setAttribute('aria-setsize', String(meta.setSize ?? size));
    });
  }

  private getVirtualNodeEl(id: string) {
    return document.getElementById(this.virtualNodeId(id));
  }

  private virtualNodeId(id: string) {
    return `acc-node-${id}`;
  }
}