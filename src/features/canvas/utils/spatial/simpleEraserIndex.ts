// features/canvas/utils/spatial/simpleEraserIndex.ts

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Segment {
  id: string;           // unique per segment
  strokeId: string;     // owning stroke
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  halfWidth: number;    // strokeWidth / 2 for hit inflation
  bbox: Bounds;         // inflated bounding box for hashing
}

export interface StrokeInput {
  strokeId: string;
  points: number[];     // [x1,y1,x2,y2,...] world coords
  strokeWidth: number;
}

function rectIntersects(a: Bounds, b: Bounds): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

function circleRectIntersects(cx: number, cy: number, r: number, b: Bounds): boolean {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.width));
  const ny = Math.max(b.y, Math.min(cy, b.y + b.height));
  const dx = nx - cx;
  const dy = ny - cy;
  return dx * dx + dy * dy <= r * r;
}

function segmentPointDistSq(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return (px - x2) * (px - x2) + (py - y2) * (py - y2);
  const t = c1 / c2;
  const projx = x1 + t * vx;
  const projy = y1 + t * vy;
  const dx = px - projx;
  const dy = py - projy;
  return dx * dx + dy * dy;
}

function makeInflatedBBox(x1: number, y1: number, x2: number, y2: number, halfWidth: number): Bounds {
  const minX = Math.min(x1, x2) - halfWidth;
  const minY = Math.min(y1, y2) - halfWidth;
  const maxX = Math.max(x1, x2) + halfWidth;
  const maxY = Math.max(y1, y2) + halfWidth;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

class SpatialHash {
  private readonly map = new Map<string, Set<string>>();
  constructor(private readonly cellSize: number) {}

  private key(ix: number, iy: number): string {
    return `${ix}:${iy}`;
  }

  private span(b: Bounds): { ix0: number; iy0: number; ix1: number; iy1: number } {
    const ix0 = Math.floor(b.x / this.cellSize);
    const iy0 = Math.floor(b.y / this.cellSize);
    const ix1 = Math.floor((b.x + b.width) / this.cellSize);
    const iy1 = Math.floor((b.y + b.height) / this.cellSize);
    return { ix0, iy0, ix1, iy1 };
  }

  insert(b: Bounds, id: string): void {
    const { ix0, iy0, ix1, iy1 } = this.span(b);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const k = this.key(ix, iy);
        let bucket = this.map.get(k);
        if (!bucket) {
          bucket = new Set();
          this.map.set(k, bucket);
        }
        bucket.add(id);
      }
    }
  }

  remove(b: Bounds, id: string): void {
    const { ix0, iy0, ix1, iy1 } = this.span(b);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const k = this.key(ix, iy);
        const bucket = this.map.get(k);
        if (bucket) {
          bucket.delete(id);
          if (bucket.size === 0) this.map.delete(k);
        }
      }
    }
  }

  query(b: Bounds): Set<string> {
    const out = new Set<string>();
    const { ix0, iy0, ix1, iy1 } = this.span(b);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const k = this.key(ix, iy);
        const bucket = this.map.get(k);
        if (bucket) {
          bucket.forEach((id) => out.add(id));
        }
      }
    }
    return out;
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Simple eraser-oriented spatial index.
 * - Grid-hashes inflated segment AABBs for O(1) binning.
 * - Fast candidate lookup for circle/rect erasers, then precise tests.
 */
export class SimpleEraserIndex {
  private readonly grid: SpatialHash;
  private readonly segments = new Map<string, Segment>(); // segmentId -> segment
  private readonly strokeToSegments = new Map<string, string[]>(); // strokeId -> segmentIds

  constructor(cellSize = 64) {
    this.grid = new SpatialHash(cellSize);
  }

  clear(): void {
    this.grid.clear();
    this.segments.clear();
    this.strokeToSegments.clear();
  }

  addStroke(input: StrokeInput): void {
    const { strokeId, points, strokeWidth } = input;
    const ids: string[] = [];
    const halfWidth = Math.max(0, strokeWidth) / 2;

    for (let i = 2; i < points.length; i += 2) {
      const x1 = points[i - 2];
      const y1 = points[i - 1];
      const x2 = points[i];
      const y2 = points[i + 1];
      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;

      const segId = `${strokeId}:${i >> 1}`;
      const bbox = makeInflatedBBox(x1, y1, x2, y2, halfWidth);
      const seg: Segment = {
        id: segId,
        strokeId,
        p1: { x: x1, y: y1 },
        p2: { x: x2, y: y2 },
        halfWidth,
        bbox,
      };
      this.segments.set(segId, seg);
      ids.push(segId);
      this.grid.insert(bbox, segId);
    }

    this.strokeToSegments.set(strokeId, ids);
  }

  updateStroke(input: StrokeInput): void {
    this.removeStroke(input.strokeId);
    this.addStroke(input);
  }

  removeStroke(strokeId: string): void {
    const ids = this.strokeToSegments.get(strokeId);
    if (!ids) return;
    for (const segId of ids) {
      const seg = this.segments.get(segId);
      if (seg) {
        this.grid.remove(seg.bbox, segId);
        this.segments.delete(segId);
      }
    }
    this.strokeToSegments.delete(strokeId);
  }

  queryCircle(cx: number, cy: number, radius: number): Segment[] {
    const r = Math.max(0, radius);
    const bb: Bounds = { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
    const candidates = this.grid.query(bb);
    const out: Segment[] = [];

    for (const id of candidates) {
      const seg = this.segments.get(id);
      if (!seg) continue;
      // Broad-phase reject if bbox doesn't overlap eraser circle AABB
      if (!circleRectIntersects(cx, cy, r, seg.bbox)) continue;
      // Narrow-phase: segment distance to eraser center within radius + halfWidth
      const d2 = segmentPointDistSq(seg.p1.x, seg.p1.y, seg.p2.x, seg.p2.y, cx, cy);
      const thresh = r + seg.halfWidth;
      if (d2 <= thresh * thresh) out.push(seg);
    }
    return out;
  }

  queryRect(range: Bounds): Segment[] {
    const candidates = this.grid.query(range);
    const out: Segment[] = [];
    for (const id of candidates) {
      const seg = this.segments.get(id);
      if (!seg) continue;
      if (!rectIntersects(seg.bbox, range)) continue;
      out.push(seg);
    }
    return out;
  }

  queryCircleStrokeIds(cx: number, cy: number, radius: number): Set<string> {
    const segs = this.queryCircle(cx, cy, radius);
    const ids = new Set<string>();
    for (const s of segs) ids.add(s.strokeId);
    return ids;
  }

  queryRectStrokeIds(range: Bounds): Set<string> {
    const segs = this.queryRect(range);
    const ids = new Set<string>();
    for (const s of segs) ids.add(s.strokeId);
    return ids;
  }
}