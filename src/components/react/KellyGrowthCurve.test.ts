import { describe, expect, test } from 'bun:test';
import { binaryKellyLogGrowth, calculateBinaryKelly } from '@/components/react/KellyGrowthCurve';

describe('exact binary Kelly growth', () => {
  test('separates expected log units from the geometric-equivalent return', () => {
    const model = calculateBinaryKelly(0.6, 1);
    expect(model.fStar).toBeCloseTo(0.2, 12);
    expect(model.maxLogGrowth).toBeCloseTo(0.020135513550688863, 12);
    expect(model.geometricGrowth).toBeCloseTo(0.020339600500632656, 12);
    expect(model.geometricGrowth).not.toBe(model.maxLogGrowth);
  });
  test('solves the true second zero rather than forcing twice Kelly', () => {
    const even = calculateBinaryKelly(0.6, 1);
    expect(even.zeroCrossing).toBeCloseTo(0.38939068333493365, 12);
    expect(binaryKellyLogGrowth(0.6, 1, 0.4)).toBeCloseTo(-0.002446907533668552, 12);
    expect(binaryKellyLogGrowth(0.6, 1, even.zeroCrossing!)).toBeCloseTo(0, 12);
    const uneven = calculateBinaryKelly(0.4, 3);
    expect(uneven.fStar).toBeCloseTo(0.2, 12);
    expect(uneven.zeroCrossing).toBeCloseTo(0.4186241898610462, 12);
    expect(binaryKellyLogGrowth(0.4, 3, 0.4)).toBeGreaterThan(0);
  });
  test('does not clip the true root to the plotted domain', () => {
    const model = calculateBinaryKelly(0.8, 3);
    expect(model.zeroCrossing).toBeGreaterThan(0.99);
    expect(model.zeroCrossing).toBeCloseTo(0.9960470813530429, 12);
    expect(binaryKellyLogGrowth(0.8, 3, model.zeroCrossing!)).toBeCloseTo(0, 11);
  });
  test('returns zero constrained stake for a fair or unfavorable bet', () => {
    for (const [p, b] of [[0.5, 1], [0.4, 1.5], [0.3, 0.5]]) {
      const model = calculateBinaryKelly(p, b);
      expect(model.fStar).toBe(0);
      expect(model.maxLogGrowth).toBe(0);
      expect(model.zeroCrossing).toBeNull();
      expect(binaryKellyLogGrowth(p, b, 0.1)).toBeLessThan(0);
    }
  });
  test('rejects invalid authored chart inputs and log-domain violations', () => {
    for (const [p, b] of [[NaN, 1], [0.2, 1], [0.9, 1], [0.6, 0], [0.6, 4]]) {
      expect(() => calculateBinaryKelly(p, b)).toThrow('KellyGrowthCurve requires');
    }
    expect(() => binaryKellyLogGrowth(0.6, 1, 1)).toThrow('KellyGrowthCurve requires');
    expect(() => binaryKellyLogGrowth(1, 1, 0.2)).toThrow('KellyGrowthCurve requires');
  });
});
