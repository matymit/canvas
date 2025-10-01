import type { BranchStyle } from "@/features/canvas/types/mindmap";

type BranchStyleKey = keyof BranchStyle;

/**
 * Normalizes persisted or loosely typed branch style payloads into a safe Partial<BranchStyle>.
 * Accepts legacy records and filters out unexpected values while preserving valid overrides.
 */
export function normalizeBranchStyle(
  input?: unknown,
): Partial<BranchStyle> | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const style = input as Partial<Record<BranchStyleKey, unknown>>;
  const normalized: Partial<BranchStyle> = {};

  if (typeof style.color === "string") {
    normalized.color = style.color;
  }

  if (typeof style.widthStart === "number" && Number.isFinite(style.widthStart)) {
    normalized.widthStart = style.widthStart;
  }

  if (typeof style.widthEnd === "number" && Number.isFinite(style.widthEnd)) {
    normalized.widthEnd = style.widthEnd;
  }

  if (typeof style.curvature === "number" && Number.isFinite(style.curvature)) {
    normalized.curvature = style.curvature;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
