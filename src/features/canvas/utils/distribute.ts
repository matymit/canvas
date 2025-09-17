// features/canvas/utils/distribute.ts
export type Elem = { id: string; x: number; y: number; w: number; h: number };

export function distributeHorizontally(elems: Elem[], mode: 'centers' | 'gaps' = 'gaps') {
  if (elems.length < 3) return elems;
  const sorted = [...elems].sort((a, b) => a.x - b.x);
  const left = sorted[0];
  const right = sorted[sorted.length - 1];
  const span = (right.x + right.w) - left.x;
  if (span <= 0) return elems;

  if (mode === 'centers') {
    // Distribute by equal center spacing between first and last centers
    const firstCenter = left.x + left.w / 2;
    const lastCenter = right.x + right.w / 2;
    const step = (sorted.length > 1) ? (lastCenter - firstCenter) / (sorted.length - 1) : 0;
    return sorted.map((el, i) => {
      const cx = firstCenter + i * step;
      return { ...el, x: Math.round(cx - el.w / 2) };
    });
  } else {
    // equal gaps
    const widths = sorted.reduce((s, e) => s + e.w, 0);
    const gap = (span - widths) / (sorted.length - 1);
    let cursor = left.x;
    return sorted.map((el) => {
      const next = { ...el, x: Math.round(cursor) };
      cursor += el.w + gap;
      return next;
    });
  }
}

export function distributeVertically(elems: Elem[], mode: 'centers' | 'gaps' = 'gaps') {
  if (elems.length < 3) return elems;
  const sorted = [...elems].sort((a, b) => a.y - b.y);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const span = (bottom.y + bottom.h) - top.y;
  if (span <= 0) return elems;

  if (mode === 'centers') {
    const step = (sorted.length > 1) ? span / (sorted.length - 1) : 0;
    return sorted.map((el, i) => {
      const cy = top.y + (el.h / 2) + i * step;
      return { ...el, y: Math.round(cy - el.h / 2) };
    });
  } else {
    const heights = sorted.reduce((s, e) => s + e.h, 0);
    const gap = (span - heights) / (sorted.length - 1);
    let cursor = top.y;
    return sorted.map((el) => {
      const next = { ...el, y: Math.round(cursor) };
      cursor += el.h + gap;
      return next;
    });
  }
}