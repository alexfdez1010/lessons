import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateEulerRisk, calculateEulerTransfer, EulerRiskContributions } from '@/components/react/EulerRiskContributions';
const base = { weights: [.8, .2] as const, volatilities: [.2, .1] as const, correlation: -.8 };
describe('Euler contributions and funded exposure changes', () => {
  test('worked signed allocation sums to volatility, not to variance or one', () => {
    const r = calculateEulerRisk(base);
    expect(r.variance).toBeCloseTo(.02088, 14);
    expect(r.covarianceWithPortfolio[0]).toBeCloseTo(.0288, 14);
    expect(r.covarianceWithPortfolio[1]).toBeCloseTo(-.0108, 14);
    expect(r.varianceContributions[0]).toBeCloseTo(.02304, 14);
    expect(r.varianceContributions[1]).toBeCloseTo(-.00216, 14);
    expect(r.components![0] + r.components![1]).toBeCloseTo(r.volatility, 14);
    expect(r.shares![0]).toBeCloseTo(1.103448275862069, 13);
    expect(r.shares![1]).toBeCloseTo(-.103448275862069, 13);
    expect(r.marginal![1]).toBeLessThan(0);
  });
  test('Euler identity and partial derivative hold across PSD correlations and weights', () => {
    for (const correlation of [-1, -.8, 0, .7, 1]) for (const w of [.05, .2, .35, .5, .8, .95]) {
      const i = { ...base, correlation, weights: [w, 1 - w] as const }, r = calculateEulerRisk(i);
      expect(r.components![0] + r.components![1]).toBeCloseTo(r.volatility, 12);
      expect(r.varianceContributions[0] + r.varianceContributions[1]).toBeCloseTo(r.variance, 14);
      expect(r.shares![0] + r.shares![1]).toBeCloseTo(1, 11);
      for (const j of [0, 1] as const) {
        const h = 1e-6, plus: [number, number] = [...i.weights], minus: [number, number] = [...i.weights];
        plus[j] += h; minus[j] -= h;
        const derivative = (calculateEulerRisk({ ...i, weights: plus }).volatility - calculateEulerRisk({ ...i, weights: minus }).volatility) / (2 * h);
        expect(derivative).toBeCloseTo(r.marginal![j], 8);
      }
    }
  });
  test('funded shift uses the difference of derivatives and exact repricing', () => {
    const r = calculateEulerTransfer(base, .05);
    expect(r.after.variance).toBeCloseTo(.017125, 14);
    expect(r.slope).toBeCloseTo(r.before.marginal![1] - r.before.marginal![0], 14);
    expect(r.linear).not.toBeCloseTo(r.before.volatility + .05 * r.before.marginal![1], 5);
    expect(r.after.volatility).toBeGreaterThan(r.linear!);
    const h = 1e-6;
    const numerical = (calculateEulerTransfer(base, h).after.volatility - calculateEulerTransfer(base, -h).after.volatility) / (2 * h);
    expect(numerical).toBeCloseTo(r.slope!, 9);
  });
  test('a positive component can still be the lower-risk destination of a funded trade', () => {
    const r = calculateEulerTransfer({ ...base, weights: [.35, .65] }, .01);
    expect(r.before.components![1]).toBeGreaterThan(0);
    expect(r.slope!).toBeLessThan(0);
    expect(r.exactChange).toBeLessThan(0);
  });
  test('scaling exposures preserves marginal derivatives but scales components and risk', () => {
    const a = calculateEulerRisk(base), b = calculateEulerRisk({ ...base, weights: [1.6, .4] });
    expect(b.volatility).toBeCloseTo(2 * a.volatility, 14);
    for (const j of [0, 1] as const) { expect(b.marginal![j]).toBeCloseTo(a.marginal![j], 14); expect(b.components![j]).toBeCloseTo(2 * a.components![j], 14); expect(b.shares![j]).toBeCloseTo(a.shares![j], 14); }
  });
  test('perfect negative correlation has a zero-risk kink with undefined allocation', () => {
    const i = { ...base, weights: [1 / 3, 2 / 3] as const, correlation: -1 }, r = calculateEulerRisk(i);
    expect(r.volatility).toBe(0); expect(r.marginal).toBeNull(); expect(r.components).toBeNull(); expect(r.shares).toBeNull();
    for (const delta of [-.1, -.001, .001, .1]) {
      const t = calculateEulerTransfer(i, delta);
      expect(t.after.volatility).toBeCloseTo(.3 * Math.abs(delta), 14); expect(t.linear).toBeNull(); expect(t.slope).toBeNull();
    }
    const near = calculateEulerRisk({ ...i, correlation: -1 + Number.EPSILON });
    expect(near.volatility).toBeGreaterThan(0); expect(near.marginal).not.toBeNull();
    expect(calculateEulerRisk({ ...i, weights: [0, 0] }).marginal).toBeNull();
  });
  test('zero boundaries and an overshooting local tangent remain finite', () => {
    const r = calculateEulerTransfer(base, .8);
    expect(r.after.volatility).toBeCloseTo(.1, 14); expect(r.linear!).toBeLessThan(0);
    for (const weights of [[1, 0], [0, 1]] as const) {
      const v = calculateEulerRisk({ ...base, weights }); expect(v.shares!.reduce((a, b) => a + b)).toBeCloseTo(1, 13);
    }
    const html = renderToStaticMarkup(createElement(EulerRiskContributions, { mode: 'transfer', weightA: 1 / 3, correlation: -1, transfer: 0 }));
    expect(html).toContain('undefined'); expect(html).not.toContain('NaN'); expect(html).not.toContain('Infinity');
  });
  test('invalid author inputs fail before hooks', () => {
    for (const change of [{ weights: [-.1, 1.1] }, { weights: [NaN, .2] }, { volatilities: [0, .1] }, { correlation: 1.01 }]) expect(() => calculateEulerRisk({ ...base, ...change } as typeof base)).toThrow('EulerRiskContributions');
    expect(() => calculateEulerTransfer(base, .81)).toThrow('transfer');
    expect(() => renderToStaticMarkup(createElement(EulerRiskContributions, { correlation: 1.01 }))).toThrow('correlation');
    expect(() => renderToStaticMarkup(createElement(EulerRiskContributions, { title: '' }))).toThrow('title');
  });
});
