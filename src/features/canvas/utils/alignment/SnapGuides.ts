export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GuideLine {
  // Line in canvas coordinates for drawing
  x1: number; y1: number;
  x2: number; y2: number;
  axis: 'x' | 'y';
  kind: 'edge' | 'center';
}

export interface SnapOptions {
  pixelThreshold?: number;     // how close before snapping (default 6)
  gridSize?: number | null;    // optional grid snapping
  includeCenters?: boolean;    // default true
  includeEdges?: boolean;      // default true
  maxCandidates?: number;      // optional perf bound
}

export interface SnapResult {
  dx: number;  // delta to apply to moving.x to snap
  dy: number;  // delta to apply to moving.y to snap
  guides: GuideLine[];
}

function centers(b: Bounds) {
  return {
    cx: b.x + b.width / 2,
    cy: b.y + b.height / 2,
  };
}

function edges(b: Bounds) {
  return {
    left: b.x,
    right: b.x + b.width,
    top: b.y,
    bottom: b.y + b.height,
  };
}

function clampCandidates<T>(arr: T[], n?: number) {
  if (!n || arr.length <= n) return arr;
  return arr.slice(0, n);
}

export function computeSnapGuides(
  moving: Bounds,
  candidates: Bounds[],
  options?: SnapOptions
): SnapResult {
  const opts: Required<SnapOptions> = {
    pixelThreshold: options?.pixelThreshold ?? 6,
    gridSize: options?.gridSize ?? null,
    includeCenters: options?.includeCenters ?? true,
    includeEdges: options?.includeEdges ?? true,
    maxCandidates: options?.maxCandidates ?? 500,
  };

  let dx = 0;
  let dy = 0;
  const guides: GuideLine[] = [];

  // Apply optional grid snapping first (softly)
  if (opts.gridSize && opts.gridSize > 1) {
    const gx = Math.round(moving.x / opts.gridSize) * opts.gridSize;
    const gy = Math.round(moving.y / opts.gridSize) * opts.gridSize;
    if (Math.abs(gx - moving.x) <= opts.pixelThreshold) dx = gx - moving.x;
    if (Math.abs(gy - moving.y) <= opts.pixelThreshold) dy = gy - moving.y;
  }

  const mC = centers(moving);
  const mE = edges(moving);

  let bestX: { delta: number; guide: GuideLine } | null = null;
  let bestY: { delta: number; guide: GuideLine } | null = null;

  const limited = clampCandidates(candidates, opts.maxCandidates);
  for (const cand of limited) {
    const cC = centers(cand);
    const cE = edges(cand);

    if (opts.includeEdges) {
      // X-axis snaps: left/center/right aligned with candidate edges/center
      const xTargets = [
        { pos: cE.left, kind: 'edge' as const },
        { pos: cC.cx,   kind: 'center' as const },
        { pos: cE.right,kind: 'edge' as const },
      ];
      const myX = [
        { pos: mE.left,  kind: 'edge' as const },
        { pos: mC.cx,    kind: 'center' as const },
        { pos: mE.right, kind: 'edge' as const },
      ];

      for (const tx of myX) {
        for (const cxT of xTargets) {
          const delta = cxT.pos - tx.pos;
          if (Math.abs(delta) <= opts.pixelThreshold) {
            const g: GuideLine = {
              axis: 'x',
              kind: cxT.kind,
              x1: cxT.pos,
              y1: Math.min(mE.top, cE.top) - 10000, // long vertical guide
              x2: cxT.pos,
              y2: Math.max(mE.bottom, cE.bottom) + 10000,
            };
            if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
              bestX = { delta, guide: g };
            }
          }
        }
      }
    }

    if (opts.includeCenters) {
      // Y-axis snaps: top/center/bottom aligned with candidate edges/center
      const yTargets = [
        { pos: cE.top,    kind: 'edge' as const },
        { pos: cC.cy,     kind: 'center' as const },
        { pos: cE.bottom, kind: 'edge' as const },
      ];
      const myY = [
        { pos: mE.top,    kind: 'edge' as const },
        { pos: mC.cy,     kind: 'center' as const },
        { pos: mE.bottom, kind: 'edge' as const },
      ];

      for (const ty of myY) {
        for (const cyT of yTargets) {
          const delta = cyT.pos - ty.pos;
          if (Math.abs(delta) <= opts.pixelThreshold) {
            const g: GuideLine = {
              axis: 'y',
              kind: cyT.kind,
              x1: Math.min(mE.left, cE.left) - 10000,
              y1: cyT.pos,
              x2: Math.max(mE.right, cE.right) + 10000,
              y2: cyT.pos,
            };
            if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) {
              bestY = { delta, guide: g };
            }
          }
        }
      }
    }
  }

  if (bestX) {
    dx = bestX.delta || dx;
    guides.push(bestX.guide);
  }
  if (bestY) {
    dy = bestY.delta || dy;
    guides.push(bestY.guide);
  }

  return { dx, dy, guides };
}