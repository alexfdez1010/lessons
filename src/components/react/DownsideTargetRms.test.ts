import { describe, expect, test } from 'bun:test';
import { calculateDownsideRms } from '@/components/react/DownsideTargetRms';
const returns = [-0.02, 0.01, 0.03, 0.06];
describe('all-observation downside RMS', () => {
  test('includes every observation rather than only the shortfall count', () => {
    const value = calculateDownsideRms(returns, 0);
    expect(value.count).toBe(4);
    expect(value.mean).toBeCloseTo(0.02, 12);
    expect(value.shortfalls).toEqual([0.02, 0, 0, 0]);
    expect(value.downside).toBeCloseTo(0.01, 12);
    expect(value.sortino).toBeCloseTo(2, 12);
  });
  test('changes both numerator and denominator when the target changes', () => {
    const value = calculateDownsideRms(returns, 0.01);
    expect(value.numerator).toBeCloseTo(0.01, 12);
    expect(value.downside).toBeCloseTo(0.015, 12);
    expect(value.sortino).toBeCloseTo(2 / 3, 12);
    expect(calculateDownsideRms(returns, 0.03).sortino).toBeLessThan(0);
  });
  test('reports an undefined finite ratio when observed downside is zero', () => {
    const value = calculateDownsideRms([0.01, 0.02, 0.03], 0);
    expect(value.downside).toBe(0);
    expect(value.sortino).toBeNull();
  });
  test('rejects malformed data and unsupported author inputs', () => {
    for (const values of [[], [0.1], [0.1, NaN], [-1.1, 0.2]]) {
      expect(() => calculateDownsideRms(values, 0)).toThrow('DownsideTargetRms requires');
    }
    expect(() => calculateDownsideRms(returns, NaN)).toThrow('DownsideTargetRms requires');
  });
});
