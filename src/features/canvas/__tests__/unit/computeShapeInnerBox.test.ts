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

function circle(id: string, x: number, y: number, radius: number, pad = 8): BaseShape {
  return {
    id,
    type: 'circle',
    x,
    y,
    width: radius * 2,
    height: radius * 2,
    padding: pad,
    data: { radius }
  };
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

  it('ellipse: fallback to triangle implementation (no longer has specific logic)', () => {
    const W = 200;
    const H = 140;
    const pad = 8;
    const el = ellipse('e1', 50, 60, W, H, pad);
    const inner = computeShapeInnerBox(el, pad);

    // Since ellipse has no specific case, it falls through to the fallback implementation
    // which treats it as a rectangle-like shape with padding
    const expectedW = W - pad * 2;
    const expectedH = H - pad * 2;

    expect(inner.width).toBe(Math.max(0, expectedW));
    expect(inner.height).toBe(Math.max(0, expectedH));
    expect(inner.x).toBe(50 + pad);
    expect(inner.y).toBe(60 + pad);
    expect(inner.width).toBeGreaterThanOrEqual(0);
    expect(inner.height).toBeGreaterThanOrEqual(0);
  });

  it('circle: uses mathematically correct inscribed square (radius * √2)', () => {
    const radius = 100;
    const pad = 8;
    const centerX = 200;
    const centerY = 150;
    const el = circle('c1', centerX, centerY, radius, pad);
    const inner = computeShapeInnerBox(el, pad);

    // Mathematical formula: inscribed square side = radius * √2
    const expectedSide = radius * Math.sqrt(2);
    const expectedPaddedSide = Math.max(20, expectedSide - (pad * 2));

    expect(inner.width).toBeCloseTo(expectedPaddedSide, 5);
    expect(inner.height).toBeCloseTo(expectedPaddedSide, 5);

    // Should be centered at the circle's center
    const calculatedCenterX = inner.x + inner.width / 2;
    const calculatedCenterY = inner.y + inner.height / 2;
    expect(calculatedCenterX).toBeCloseTo(centerX, 5);
    expect(calculatedCenterY).toBeCloseTo(centerY, 5);

    expect(inner.width).toBeGreaterThanOrEqual(20); // Minimum size enforced
    expect(inner.height).toBeGreaterThanOrEqual(20);
  });

  it('circle: handles radius from data property', () => {
    const radius = 50;
    const centerX = 100;
    const centerY = 100;
    const el = circle('c2', centerX, centerY, radius, 4);
    const inner = computeShapeInnerBox(el, 4);

    // Should use radius from data.radius
    const expectedSide = radius * Math.sqrt(2);
    const expectedPaddedSide = Math.max(20, expectedSide - 8); // 4px padding * 2

    expect(inner.width).toBeCloseTo(expectedPaddedSide, 5);
    expect(inner.height).toBeCloseTo(expectedPaddedSide, 5);
  });

  it('triangle: approximates inner box with tip avoidance and non-negative', () => {
    const el = triangle('t1', 0, 0, 120, 100, 12);
    const inner = computeShapeInnerBox(el, 12);

    // Triangle uses special positioning logic:
    // textAreaWidth = 0.7, textAreaTop = 0.4, textAreaHeight = 0.5
    const expectedWidth = 120 * 0.7; // 84
    const expectedHeight = 100 * 0.5; // 50
    const expectedX = 0 + (120 - expectedWidth) / 2; // (120-84)/2 = 18
    const expectedY = 0 + (100 * 0.4); // 40

    expect(inner.x).toBe(expectedX);
    expect(inner.y).toBe(expectedY);
    expect(inner.width).toBe(expectedWidth);
    expect(inner.height).toBe(expectedHeight);
    expect(inner.width).toBeGreaterThanOrEqual(0);
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

    // Circle with excessive padding should clamp to minimum 20px
    const el3 = circle('c3', 0, 0, 5, 50); // tiny radius, large padding
    const i3 = computeShapeInnerBox(el3, 50);
    expect(i3.width).toBe(20); // Minimum enforced
    expect(i3.height).toBe(20);
  });
});
