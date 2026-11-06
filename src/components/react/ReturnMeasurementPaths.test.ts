import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateReturnMeasurement, ReturnMeasurementPaths } from '@/components/react/ReturnMeasurementPaths';

describe('cash-flow-aware two-year return measurement', () => {
  test('the contribution separates balance growth, linked performance and IRR', () => {
    const m = calculateReturnMeasurement(.5, -.5, 100);
    expect(m.beforeContribution).toBe(150); expect(m.afterContribution).toBe(250);
    expect(m.unitEnding).toBe(75); expect(m.accountEnding).toBe(125);
    expect(m.arithmetic).toBe(0); expect(m.geometric).toBeCloseTo(-.1339745962155614, 12);
    expect(m.moneyWeighted).toBeCloseTo(-.275255128608411, 12);
    expect(m.rawBalanceGrowth).toBeCloseTo(.118033988749895, 12);
    const factor = 1 + m.moneyWeighted;
    expect(100 * factor ** 2 + 100 * factor).toBeCloseTo(125, 12);
  });
  test('reversing returns leaves no-flow growth unchanged but changes the funded path', () => {
    const a = calculateReturnMeasurement(.5, -.5, 100), b = calculateReturnMeasurement(-.5, .5, 100);
    expect(a.unitEnding).toBe(b.unitEnding); expect(a.geometric).toBe(b.geometric);
    expect(b.accountEnding).toBe(225); expect(b.moneyWeighted).toBeCloseTo(.08113883008418976, 12);
    expect(a.accountEnding).not.toBe(b.accountEnding);
  });
  test('a single initial investment makes all compound measurement routes coincide', () => {
    for (const a of [-.8, -.5, -.1, 0, .3, .8]) for (const b of [-.8, -.2, 0, .5, .8]) {
      const m = calculateReturnMeasurement(a, b, 0);
      expect(m.accountEnding).toBe(m.unitEnding);
      expect(m.moneyWeighted).toBeCloseTo(m.geometric, 12);
      expect(m.rawBalanceGrowth).toBeCloseTo(m.geometric, 12);
      expect(100 * (1 + m.geometric) ** 2).toBeCloseTo(m.unitEnding, 10);
      expect(m.gap).toBeGreaterThanOrEqual(-1e-14);
    }
  });
  test('every supported funded path satisfies the dated cash-flow equation and scales', () => {
    for (const a of [-.8, -.2, 0, .5, .8]) for (const b of [-.8, -.1, 0, .3, .8]) for (const c of [0, 5, 100, 200]) {
      const m = calculateReturnMeasurement(a, b, c), scaled = calculateReturnMeasurement(a, b, c * 7, 700);
      const x = 1 + m.moneyWeighted;
      expect(x).toBeGreaterThan(0);
      expect(100 + c / x - m.accountEnding / x ** 2).toBeCloseTo(0, 8);
      expect(m.beforeContribution * (1 + b) + c * (1 + b)).toBeCloseTo(m.accountEnding, 10);
      expect(scaled.accountEnding).toBeCloseTo(7 * m.accountEnding, 9);
      expect(scaled.geometric).toBeCloseTo(m.geometric, 12);
      expect(scaled.moneyWeighted).toBeCloseTo(m.moneyWeighted, 12);
    }
  });
  test('constant returns give the same annual return even when money is added', () => {
    for (const r of [-.8, -.2, 0, .2, .8]) for (const c of [0, 100, 200]) {
      const m = calculateReturnMeasurement(r, r, c);
      expect(m.geometric).toBeCloseTo(r, 12); expect(m.moneyWeighted).toBeCloseTo(r, 12);
      expect(m.gap).toBeCloseTo(0, 12);
    }
  });
  test('matching mean and descriptive variance need not fix the exact geometric result', () => {
    const a = [-.3, 0, .3], z = Math.sqrt(.03), b = [-z, -z, 2 * z];
    const mean = (r: number[]) => r.reduce((s, v) => s + v, 0) / r.length;
    const variance = (r: number[]) => r.reduce((s, v) => s + (v - mean(r)) ** 2, 0) / r.length;
    const factor = (r: number[]) => r.reduce((s, v) => s * (1 + v), 1);
    expect(mean(a)).toBeCloseTo(mean(b), 14); expect(variance(a)).toBeCloseTo(variance(b), 14);
    expect(factor(a)).toBeCloseTo(.91, 14); expect(factor(b)).toBeCloseTo(.9203923048454133, 14);
    expect(Math.cbrt(factor(a)) - 1).toBeCloseTo(-.03094789165665, 12);
    expect(Math.cbrt(factor(b)) - 1).toBeCloseTo(-.02727295019836, 12);
  });
  test('dimensionless returns retain scale invariance at tiny and subnormal principals', () => {
    const regression = calculateReturnMeasurement(.5, -.5, 0, 1e-200);
    expect(Number.isFinite(regression.moneyWeighted)).toBe(true);
    expect(regression.moneyWeighted).toBeCloseTo(Math.sqrt(.75) - 1, 14);
    for (const principal of [1e-200, 1e-300, 1e-320, Number.MIN_VALUE, 1e9]) {
      for (const contributionRatio of [0, 1, 2]) {
        for (const [first, second] of [[.5, -.5], [-.8, -.8], [.8, .8], [-.5, .5]]) {
          const result = calculateReturnMeasurement(first!, second!, contributionRatio * principal, principal);
          const ordinary = calculateReturnMeasurement(first!, second!, contributionRatio * 100, 100);
          for (const key of ['geometric', 'totalReturn', 'moneyWeighted', 'rawBalanceGrowth'] as const) {
            expect(Number.isFinite(result[key])).toBe(true);
            expect(result[key]).toBeCloseTo(ordinary[key], 13);
          }
          const factor = 1 + result.moneyWeighted;
          expect(factor).toBeGreaterThan(0);
          expect(factor ** 2 + contributionRatio * factor).toBeCloseTo((1 + first! + contributionRatio) * (1 + second!), 12);
        }
      }
    }
  });
  test('invalid author data and labels fail before hook rendering', () => {
    for (const args of [[-1, 0, 0], [0, 1, 0], [0, 0, -1], [0, 0, 201], [NaN, 0, 0]]) expect(() => calculateReturnMeasurement(...args as [number, number, number])).toThrow('ReturnMeasurementPaths');
    expect(() => calculateReturnMeasurement(0, 0, 0, 0)).toThrow('principal');
    expect(() => renderToStaticMarkup(createElement(ReturnMeasurementPaths, { firstReturn: -1 }))).toThrow('annual returns');
    expect(() => renderToStaticMarkup(createElement(ReturnMeasurementPaths, { title: '' }))).toThrow('title');
  });
});
