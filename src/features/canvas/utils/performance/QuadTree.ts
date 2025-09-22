// features/canvas/utils/performance/QuadTree.ts

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rect = {
  contains(outer: Rect, inner: Rect): boolean {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  },
  intersects(a: Rect, b: Rect): boolean {
    return !(
      a.x + a.width < b.x ||
      a.x > b.x + b.width ||
      a.y + a.height < b.y ||
      a.y > b.y + b.height
    );
  },
};

interface Entry<T> {
  r: Rect;
  d: T;
}

export class QuadTree<T> {
  readonly bounds: Rect;
  readonly maxElements: number;
  readonly maxDepth: number;
  private readonly depth: number;

  private items: Entry<T>[] = [];
  private children: [QuadTree<T>, QuadTree<T>, QuadTree<T>, QuadTree<T>] | null = null;

  constructor(bounds: Rect, maxElements = 8, maxDepth = 8, depth = 0) {
    this.bounds = bounds;
    this.maxElements = Math.max(1, maxElements | 0);
    this.maxDepth = Math.max(0, maxDepth | 0);
    this.depth = Math.max(0, depth | 0);
  }

  clear(): void {
    this.items = [];
    if (this.children) {
      for (const c of this.children) c.clear();
      this.children = null;
    }
  }

  insert(data: T, r: Rect): boolean {
    if (!rect.intersects(this.bounds, r)) return false;

    if (this.children) {
      const idx = this.childIndex(r);
      if (idx !== -1) return this.children[idx].insert(data, r);
    }

    this.items.push({ d: data, r });

    // Split if needed
    if (!this.children && this.items.length > this.maxElements && this.depth < this.maxDepth) {
      this.subdivide();
      // Re-distribute items
      const kept: Entry<T>[] = [];
      for (const e of this.items) {
        const idx = this.childIndex(e.r);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (idx !== -1) this.children![idx].insert(e.d, e.r);
        else kept.push(e);
      }
      this.items = kept;
    }

    return true;
    }

  // Remove by data and optional rect (for faster narrowing)
  remove(data: T, rHint?: Rect): boolean {
    if (rHint && !rect.intersects(this.bounds, rHint)) return false;

    // Try to remove from current node
    const idx = this.items.findIndex((e) => e.d === data && (!rHint || e.r === rHint || rect.intersects(e.r, rHint)));
    if (idx !== -1) {
      this.items.splice(idx, 1);
      return true;
    }

    if (this.children) {
      // If we know the rect, use childIndex; otherwise scan all children
      if (rHint) {
        const ci = this.childIndex(rHint);
        if (ci !== -1) return this.children[ci].remove(data, rHint);
      }
      for (const c of this.children) {
        if (c.remove(data, rHint)) return true;
      }
    }
    return false;
  }

  // Update an item's bounds by remove+insert
  update(data: T, oldRect: Rect, newRect: Rect): boolean {
    const removed = this.remove(data, oldRect);
    const inserted = this.insert(data, newRect);
    return removed && inserted;
  }

  // Query all items that intersect the range
  query(range: Rect, predicate?: (data: T, r: Rect) => boolean): T[] {
    const out: T[] = [];
    this.queryInto(range, out, predicate);
    return out;
  }

  // Count all items in subtree
  count(): number {
    let total = this.items.length;
    if (this.children) {
      for (const c of this.children) total += c.count();
    }
    return total;
  }

  // Iterate all items in subtree
  forEach(fn: (data: T, r: Rect) => void): void {
    for (const e of this.items) fn(e.d, e.r);
    if (this.children) for (const c of this.children) c.forEach(fn);
  }

  private queryInto(range: Rect, out: T[], predicate?: (data: T, r: Rect) => boolean): void {
    if (!rect.intersects(this.bounds, range)) return;

    for (const e of this.items) {
      if (rect.intersects(e.r, range) && (!predicate || predicate(e.d, e.r))) {
        out.push(e.d);
      }
    }
    if (this.children) {
      for (const c of this.children) c.queryInto(range, out, predicate);
    }
  }

  private childIndex(r: Rect): number {
    // Return quadrant index (0..3) if r fully fits; otherwise -1 to keep at current node.
    const midX = this.bounds.x + this.bounds.width / 2;
    const midY = this.bounds.y + this.bounds.height / 2;

    const fitsTop = r.y + r.height <= midY;
    const fitsBot = r.y >= midY;
    const fitsLeft = r.x + r.width <= midX;
    const fitsRight = r.x >= midX;

    if (fitsTop) {
      if (fitsLeft) return 0;     // NW
      if (fitsRight) return 1;    // NE
    } else if (fitsBot) {
      if (fitsLeft) return 2;     // SW
      if (fitsRight) return 3;    // SE
    }
    return -1;
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const hw = width / 2;
    const hh = height / 2;
    this.children = [
      new QuadTree<T>({ x, y, width: hw, height: hh }, this.maxElements, this.maxDepth, this.depth + 1),             // NW
      new QuadTree<T>({ x: x + hw, y, width: hw, height: hh }, this.maxElements, this.maxDepth, this.depth + 1),     // NE
      new QuadTree<T>({ x, y: y + hh, width: hw, height: hh }, this.maxElements, this.maxDepth, this.depth + 1),     // SW
      new QuadTree<T>({ x: x + hw, y: y + hh, width: hw, height: hh }, this.maxElements, this.maxDepth, this.depth + 1), // SE
    ];
  }
}

export default QuadTree;