// features/canvas/utils/spatial/spatialQuadTree.ts

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GetBounds<T> = (item: T) => Bounds;
export type Equals<T> = (a: T, b: T) => boolean;

function intersects(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function center(bounds: Bounds) {
  return { cx: bounds.x + bounds.width / 2, cy: bounds.y + bounds.height / 2 };
}

function makeQuadrantBounds(parent: Bounds, index: number): Bounds {
  const { x, y, width, height } = parent;
  const hw = width / 2;
  const hh = height / 2;
  switch (index) {
    case 0: // top-left
      return { x, y, width: hw, height: hh };
    case 1: // top-right
      return { x: x + hw, y, width: hw, height: hh };
    case 2: // bottom-left
      return { x, y: y + hh, width: hw, height: hh };
    case 3: // bottom-right
      return { x: x + hw, y: y + hh, width: hw, height: hh };
    default:
      return parent;
  }
}

class QuadNode<T> {
  items: T[] = [];
  children: QuadNode<T>[] | null = null;
  constructor(
    public readonly bounds: Bounds,
    public readonly depth: number,
  ) {}
}

export interface QuadTreeOptions<T> {
  maxElements?: number; // node capacity before split
  maxDepth?: number; // 0-based; node at this depth will not split further
  getBounds?: GetBounds<T>;
  equals?: Equals<T>;
}

/**
 * Generic rectangle Quadtree for spatial queries (range/point), collision prefiltering and viewport culling.
 */
export class QuadTree<T> {
  private root: QuadNode<T>;
  private readonly maxElements: number;
  private readonly maxDepth: number;
  private readonly getBounds: GetBounds<T>;
  private readonly equals: Equals<T>;
  private _size = 0;

  constructor(bounds: Bounds, opts?: QuadTreeOptions<T>) {
    this.root = new QuadNode<T>(bounds, 0);
    this.maxElements = opts?.maxElements ?? 8;
    this.maxDepth = opts?.maxDepth ?? 8;
    this.getBounds = opts?.getBounds ?? ((v: T) => (v as Record<string, unknown>)?.bounds as Bounds);
    this.equals =
      opts?.equals ??
      ((a, b) => {
        return a === b;
      });
  }

  clear(): void {
    this.root = new QuadNode<T>(this.root.bounds, 0);
    this._size = 0;
  }

  size(): number {
    return this._size;
  }

  insert(item: T): boolean {
    const ib = this.getBounds(item);
    if (!intersects(this.root.bounds, ib)) return false;
    const inserted = this.insertIntoNode(this.root, item, ib);
    if (inserted) this._size++;
    return inserted;
  }

  remove(item: T): boolean {
    const removed = this.removeFromNode(this.root, item);
    if (removed) this._size--;
    return removed;
  }

  update(item: T): boolean {
    // Simple, safe path: remove+insert; avoids path tracking complexity.
    const was = this.remove(item);
    const now = this.insert(item);
    return was || now;
  }

  queryRange(range: Bounds): T[] {
    const out: T[] = [];
    this.queryNode(this.root, range, out);
    return out;
  }

  queryPoint(x: number, y: number): T[] {
    return this.queryRange({ x, y, width: 1e-9, height: 1e-9 });
  }

  // Internal

  private insertIntoNode(node: QuadNode<T>, item: T, ib: Bounds): boolean {
    // If this is a leaf and capacity allows, store here.
    if (!node.children && (node.items.length < this.maxElements || node.depth >= this.maxDepth)) {
      node.items.push(item);
      return true;
    }

    // Ensure split if needed.
    if (!node.children) this.split(node);

    // Try to insert into a single child that fully contains the item.
    const childIdx = this.childIndexFor(node, ib);
    if (childIdx !== -1 && node.children) {
      return this.insertIntoNode(node.children[childIdx], item, ib);
    }

    // Otherwise keep at current node (spans multiple quadrants).
    node.items.push(item);
    return true;
  }

  private split(node: QuadNode<T>): void {
    if (node.children) return;
    node.children = new Array(4)
      .fill(0)
      .map((_, i) => new QuadNode<T>(makeQuadrantBounds(node.bounds, i), node.depth + 1));

    // Re-distribute items into children when fully contained.
    const kept: T[] = [];
    for (const it of node.items) {
      const ib = this.getBounds(it);
      const idx = this.childIndexFor(node, ib);
      if (idx !== -1 && node.children) {
        this.insertIntoNode(node.children[idx], it, ib);
      } else {
        kept.push(it);
      }
    }
    node.items = kept;
  }

  private childIndexFor(node: QuadNode<T>, ib: Bounds): number {
    // Return child index [0..3] if the item is fully contained by that child; else -1.
    const { cx, cy } = center(node.bounds);
    const fitsLeft = ib.x + ib.width <= cx;
    const fitsRight = ib.x >= cx;
    const fitsTop = ib.y + ib.height <= cy;
    const fitsBottom = ib.y >= cy;

    if (fitsLeft) {
      if (fitsTop) return 0;
      if (fitsBottom) return 2;
    } else if (fitsRight) {
      if (fitsTop) return 1;
      if (fitsBottom) return 3;
    }
    return -1;
  }

  private queryNode(node: QuadNode<T>, range: Bounds, out: T[]): void {
    if (!intersects(node.bounds, range)) return;

    // Items in this node
    for (const it of node.items) {
      if (intersects(this.getBounds(it), range)) out.push(it);
    }

    // Recurse into children
    if (!node.children) return;
    for (let i = 0; i < 4; i++) {
      this.queryNode(node.children[i], range, out);
    }
  }

  private removeFromNode(node: QuadNode<T>, item: T): boolean {
    // Try remove from this node first
    const idx = node.items.findIndex((it) => this.equals(it, item));
    if (idx !== -1) {
      node.items.splice(idx, 1);
      return true;
    }
    // Recurse into children
    if (!node.children) return false;
    for (let i = 0; i < 4; i++) {
      if (this.removeFromNode(node.children[i], item)) return true;
    }
    return false;
  }
}