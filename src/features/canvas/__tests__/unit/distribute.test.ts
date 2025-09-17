import { describe, it, expect } from 'vitest';
import { distributeHorizontally, distributeVertically, Elem } from '../../utils/distribute';

describe('distribute utilities', () => {
  const elems: Elem[] = [
    { id: 'a', x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', x: 30, y: 0, w: 10, h: 10 },
    { id: 'c', x: 70, y: 0, w: 20, h: 10 },
  ];

  it('distributeHorizontally (gaps) produces equal gaps and stable rounding', () => {
    const out = distributeHorizontally(elems, 'gaps');
    expect(out).toHaveLength(3);
    // Span is (c.x + c.w) - a.x = (70+20) - 0 = 90
    // widths sum = 10 + 10 + 20 = 40 -> gaps total = 50 -> gap = 25
    expect(out[0].x).toBe(0);
    expect(out[1].x).toBe(10 + 25); // 35
    expect(out[2].x).toBe(10 + 25 + 10 + 25); // 70
  });

  it('distributeHorizontally (centers) spaces centers evenly', () => {
    const out = distributeHorizontally(elems, 'centers');
    expect(out).toHaveLength(3);
    // step = span / (n-1) = 90 / 2 = 45
    // center positions: a.cx = 5, then 5+45=50 -> b should be centered at 50, so x = 50 - 5 = 45
    // next center 95 -> c width 20 => x = 95 - 10 = 85
    expect(out[0].x).toBe(0);
    expect(out[1].x).toBe(45);
    expect(out[2].x).toBe(85);
  });

  it('distributeVertically (gaps) produces equal gaps', () => {
    const elemsV: Elem[] = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 0, y: 40, w: 10, h: 10 },
      { id: 'c', x: 0, y: 80, w: 10, h: 20 },
    ];
    const out = distributeVertically(elemsV, 'gaps');
    // Span = (c.y + c.h) - a.y = 100
    // heights sum = 10 + 10 + 20 = 40 -> gap = 30
    expect(out[0].y).toBe(0);
    expect(out[1].y).toBe(10 + 30); // 40
    expect(out[2].y).toBe(10 + 30 + 10 + 30); // 80
  });
});