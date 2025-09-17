import { describe, it, expect } from 'vitest';
import { computeShapeInnerBox, BaseShape } from '../../utils/text/computeShapeInnerBox';

function rect(id: string, x: number, y: number, w: number, h: number, pad = 8): BaseShape {
  return { id, type: 'rectangle', x, y, width: w, height: h, padding: pad };
}

function ellipse(id: string, x: number, y: number, w: number, h: number, pad = 8): BaseShape {
  return { id, type: 'ellipse', x, y, width: w, height: h, padding: pad };
}

function triangle(id: string, x: number, y: number, w: number, h: number, pad = 8): BaseShape {
  return { id, type: 'triangle', x, y, width: w, height: h, padding: pad };
}

describe('computeShapeInnerBox', () => {
  it('rectangle: applies padding and centers inner box', () => {
    const el = rect('r1', 100, 200, 300, 150, 10);
    const inner = computeShapeInnerBox(el, 10);

    expect(inner.x).toBe(110);
    expect(inner.y).toBe(210);
    expect(inner.width).toBe(280);
    expect(inner.height).toBe(130);
    expect(inner.width).toBeGreaterThanOrEqual(0);
    expect(inner.height).toBeGreaterThanOrEqual(0);
  });

  it('ellipse: uses W/√2 and H/√2 minus padding; centered', () => {
    const W = 200;
    const H = 140;
    const pad = 8;
    const el = ellipse('e1', 50, 60, W, H, pad);
    const inner = computeShapeInnerBox(el, pad);

    const expectedW = Math.SQRT1_2 * W - pad * 2;
    const expectedH = Math.SQRT1_2 * H - pad * 2;

    expect(inner.width).toBeCloseTo(Math.max(0, expectedW), 5);
    expect(inner.height).toBeCloseTo(Math.max(0, expectedH), 5);

    // centered
    const cx = 50 + W / 2;
    const cy = 60 + H / 2;
    expect(inner.x + inner.width / 2).toBeCloseTo(cx, 5);
    expect(inner.y + inner.height / 2).toBeCloseTo(cy, 5);
    expect(inner.width).toBeGreaterThanOrEqual(0);
    expect(inner.height).toBeGreaterThanOrEqual(0);
  });

  it('triangle: approximates inner box with tip avoidance and non-negative', () => {
    const el = triangle('t1', 0, 0, 120, 100, 12);
    const inner = computeShapeInnerBox(el, 12);

    expect(inner.x).toBe(12);
    expect(inner.y).toBeGreaterThanOrEqual(12); // lifted slightly
    expect(inner.width).toBe(96);
    expect(inner.height).toBeGreaterThanOrEqual(0);
  });

  it('clamps to non-negative even when padding exceeds dimensions', () => {
    const el1 = rect('r2', 0, 0, 10, 10, 20);
    const i1 = computeShapeInnerBox(el1, 20);
    expect(i1.width).toBe(0);
    expect(i1.height).toBe(0);

    const el2 = ellipse('e2', 0, 0, 10, 10, 20);
    const i2 = computeShapeInnerBox(el2, 20);
    expect(i2.width).toBe(0);
    expect(i2.height).toBe(0);
  });
});
