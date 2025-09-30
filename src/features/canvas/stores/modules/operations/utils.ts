// features/canvas/stores/modules/operations/utils.ts

export function deepClone<T>(v: T): T {
  if (v === null || v === undefined) return v;

  try {
    // For basic primitives, return as-is
    if (typeof v !== "object") return v;

    // Try JSON serialization first (simplest approach)
    return JSON.parse(JSON.stringify(v));
  } catch {
    try {
      // Fallback: shallow clone for objects/arrays
      if (Array.isArray(v)) return v.slice() as unknown as T;
      if (v && typeof v === "object") {
        const copy = {} as T;
        for (const key in v) {
          if (Object.prototype.hasOwnProperty.call(v, key)) {
            (copy as Record<string, unknown>)[key] = (
              v as Record<string, unknown>
            )[key];
          }
        }
        return copy;
      }
      return v;
    } catch {
      // Last resort: return original value
      return v;
    }
  }
}
