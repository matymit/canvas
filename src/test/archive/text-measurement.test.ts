import { describe, it, expect } from 'vitest';
import { measureText } from '../../utils/text/TextMeasurement';

describe('TextMeasurement - single line hug width', () => {
  const fontFamily = 'Inter, system-ui, sans-serif';
  const fontSize = 18;

  it('returns consistent single-line height across content', () => {
    const a = measureText({ text: '', fontFamily, fontSize });
    const b = measureText({ text: 'Hello', fontFamily, fontSize });
    const c = measureText({ text: 'Hello World!', fontFamily, fontSize });

    expect(a.height).toBeGreaterThan(0);
    expect(a.height).toBe(b.height);
    expect(b.height).toBe(c.height);
  });

  it('width grows with additional characters and shrinks when removed', () => {
    const a = measureText({ text: 'A', fontFamily, fontSize });
    const b = measureText({ text: 'AA', fontFamily, fontSize });
    const c = measureText({ text: 'A', fontFamily, fontSize });

    expect(b.width).toBeGreaterThan(a.width);
    expect(c.width).toBeCloseTo(a.width);
  });
});