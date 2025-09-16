import Konva from 'konva';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  nodeId?: string;
  message: string;
  severity: ValidationSeverity;
  fix?: () => void;
}

export interface ValidationContext {
  stage?: Konva.Stage;
  // optional arbitrary app model if needed by app-specific validators
  model?: unknown;
  // extra options for built-ins
  options?: {
    enforceStageBounds?: boolean;
    boundsPadding?: number;
    autoFix?: boolean;
    maxAbsValue?: number; // sane numeric cap, defaults to 1e5
  };
}

export type Validator = (ctx: ValidationContext) => ValidationIssue[];

type Unlisten = () => void;

/**
 * ValidationManager
 * - Register/unregister validators
 * - Run validations immediately or debounced
 * - Emit issues to subscribers
 */
export class ValidationManager {
  private validators = new Map<string, Validator>();
  private subscribers = new Set<(issues: ValidationIssue[]) => void>();
  private rafId: number | null = null;
  private timer: number | null = null;
  private pendingCtx: ValidationContext | null = null;

  register(name: string, validator: Validator): void {
    this.validators.set(name, validator);
  }

  unregister(name: string): void {
    this.validators.delete(name);
  }

  onIssues(cb: (issues: ValidationIssue[]) => void): Unlisten {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  validateNow(ctx: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [, v] of this.validators) {
      try {
        const res = v(ctx) || [];
        issues.push(...res);
      } catch (e) {
        issues.push({
          id: `validator-error-${Math.random().toString(36).slice(2)}`,
          message: `Validator failed: ${(e as Error)?.message ?? e}`,
          severity: 'error',
        });
      }
    }
    // auto-fix pass
    const autoFix = !!ctx.options?.autoFix;
    if (autoFix) {
      for (const issue of issues) {
        try {
          issue.fix?.();
        } catch {
          // ignore fixer errors
        }
      }
    }
    // notify
    for (const cb of this.subscribers) cb(issues);
    return issues;
  }

  /**
   * Debounced validate on the next animation frame (and optional ms delay).
   * Useful to collapse many rapid changes into one pass.
   */
  validateDebounced(ctx: ValidationContext, delayMs = 0): void {
    this.pendingCtx = ctx;
    if (this.timer != null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    const schedule = () => {
      if (this.rafId != null) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => {
        if (!this.pendingCtx) return;
        const runCtx = this.pendingCtx;
        this.pendingCtx = null;
        this.validateNow(runCtx);
      });
    };
    if (delayMs > 0) {
      this.timer = window.setTimeout(schedule, delayMs) as unknown as number;
    } else {
      schedule();
    }
  }
}

/* ------------------------ Built-in validators ------------------------ */

function getAllNodes(stage?: Konva.Stage): Konva.Node[] {
  if (!stage) return [];
  // '*' selector returns all descendants
  return stage.find('*') as Konva.Node[];
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function isDrawableNode(node: Konva.Node) {
  const name = (node as any).getClassName?.();
  return name !== 'Stage' && name !== 'Layer' && name !== 'Transformer';
}

/**
 * Numeric sanity validator: ensures common numeric attrs are finite and within a sane cap.
 */
export const numericSanityValidator: Validator = ({ stage, options }) => {
  const issues: ValidationIssue[] = [];
  const cap = options?.maxAbsValue ?? 1e5;

  for (const node of getAllNodes(stage)) {
    const id = node.id?.() ?? undefined;
    const attrs = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'width', 'height'] as const;

    for (const key of attrs) {
      const val = (node as any)[key]?.();
      if (val === undefined) continue;
      if (!isFiniteNumber(val)) {
        issues.push({
          id: `num-nonfinite-${id ?? 'unknown'}-${key}`,
          nodeId: id,
          message: `Attribute ${key} is not a finite number`,
          severity: 'error',
          fix: () => {
            // reset to safe default
            if ((node as any)[key]) (node as any)[key](0);
            node.getLayer()?.batchDraw();
          },
        });
        continue;
      }
      if (Math.abs(val) > cap) {
        issues.push({
          id: `num-out-of-range-${id ?? 'unknown'}-${key}`,
          nodeId: id,
          message: `Attribute ${key}=${val} exceeds cap ${cap}`,
          severity: 'warning',
          fix: () => {
            if ((node as any)[key]) (node as any)[key](clamp(val, -cap, cap));
            node.getLayer()?.batchDraw();
          },
        });
      }
    }
  }
  return issues;
};

/**
 * Unique ID validator: no duplicate Konva.Node IDs.
 */
export const uniqueIdValidator: Validator = ({ stage }) => {
  const issues: ValidationIssue[] = [];
  const map = new Map<string, Konva.Node[]>();
  for (const node of getAllNodes(stage)) {
    const id = node.id?.();
    if (!id) continue;
    const arr = map.get(id) ?? [];
    arr.push(node);
    map.set(id, arr);
  }
  for (const [id, nodes] of map) {
    if (nodes.length > 1) {
      issues.push({
        id: `duplicate-id-${id}`,
        nodeId: id,
        message: `Duplicate node id "${id}" (${nodes.length} nodes)`,
        severity: 'error',
        fix: () => {
          // leave the first; reassign others
          for (let i = 1; i < nodes.length; i++) {
            nodes[i].id(`${id}__${i + 1}`);
          }
          nodes[0].getLayer()?.batchDraw();
        },
      });
    }
  }
  return issues;
};

/**
 * Stage-bounds validator: ensures drawable nodes' client rect fits within stage, with optional padding.
 * Attempts to clamp by offsetting x/y when fix is applied.
 */
export const stageBoundsValidator: Validator = ({ stage, options }) => {
  const issues: ValidationIssue[] = [];
  if (!stage || !options?.enforceStageBounds) return issues;

  const padding = options.boundsPadding ?? 0;
  const sw = stage.width();
  const sh = stage.height();

  for (const node of getAllNodes(stage)) {
    if (!isDrawableNode(node)) continue;
    const id = node.id?.() ?? undefined;
    const rect = node.getClientRect({ skipShadow: true });

    const overLeft = rect.x < padding;
    const overTop = rect.y < padding;
    const overRight = rect.x + rect.width > sw - padding;
    const overBottom = rect.y + rect.height > sh - padding;

    if (overLeft || overTop || overRight || overBottom) {
      issues.push({
        id: `out-of-bounds-${id ?? 'unknown'}`,
        nodeId: id,
        message: `Node outside stage bounds (padding=${padding})`,
        severity: 'warning',
        fix: () => {
          // Compute minimal delta to clamp inside bounds, by adjusting node position
          const nx = node.x();
          const ny = node.y();
          const dx =
            overLeft ? padding - rect.x :
            overRight ? (sw - padding) - (rect.x + rect.width) : 0;
          const dy =
            overTop ? padding - rect.y :
            overBottom ? (sh - padding) - (rect.y + rect.height) : 0;

          if (dx || dy) {
            node.x(nx + dx);
            node.y(ny + dy);
          }
          node.getLayer()?.batchDraw();
        },
      });
    }
  }
  return issues;
};

/**
 * Helper: attach clamp guards to a node during drag/transform to keep it inside stage bounds.
 */
export function attachBoundsGuards(node: Konva.Node, stage: Konva.Stage, padding = 0): Unlisten {
  const handler = () => {
    const rect = node.getClientRect({ skipShadow: true });
    const sw = stage.width();
    const sh = stage.height();
    let dx = 0;
    let dy = 0;

    if (rect.x < padding) dx = padding - rect.x;
    else if (rect.x + rect.width > sw - padding) dx = (sw - padding) - (rect.x + rect.width);

    if (rect.y < padding) dy = padding - rect.y;
    else if (rect.y + rect.height > sh - padding) dy = (sh - padding) - (rect.y + rect.height);

    if (dx || dy) {
      node.x(node.x() + dx);
      node.y(node.y() + dy);
      node.getLayer()?.batchDraw();
    }
  };

  node.on('dragmove.transform', handler);
  node.on('transform.transform', handler);
  const un = () => node.off('.transform');
  return un;
}

/**
 * Convenience: create a ValidationManager with sensible built-ins.
 */
export function createDefaultValidationManager(): ValidationManager {
  const vm = new ValidationManager();
  vm.register('numeric-sanity', numericSanityValidator);
  vm.register('unique-id', uniqueIdValidator);
  vm.register('stage-bounds', stageBoundsValidator);
  return vm;
}