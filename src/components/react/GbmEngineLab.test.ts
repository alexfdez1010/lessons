import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { GbmEngineLab, gbmExactStep, gbmMoments, gbmCoupledSteps, simulateGbmPaths, gbmMeasureComparison, gbmCalibration, gbmDriftStandardError } from '@/components/react/GbmEngineLab';
const x = { initialPrice: 100, mu: .1, sigma: .2, time: 1 };
describe('Constant-coefficient GBM laws and numerical schemes', () => {
  test('price drift, log drift and finite simple return retain different definitions', () => {
    const daily = gbmExactStep({ ...x, time: 1 / 252, z: 1 });
    expect(daily.logDrift).toBe(.08); expect(daily.driftPart).toBeCloseTo(.08 / 252, 15); expect(daily.diffusionPart).toBeCloseTo(.2 * Math.sqrt(1 / 252), 15); expect(daily.price).toBeCloseTo(101.3000051478522, 11); expect(daily.simpleReturn).toBeCloseTo(daily.price / 100 - 1, 14);
    expect(gbmExactStep({ ...x, time: 1 / 252, z: -1 }).price).toBeCloseTo(98.77937526056564, 11);
    expect(gbmExactStep({ ...x, z: 0 }).price).toBeCloseTo(108.32870676749586, 11);
    for (const z of [-12, -1, 0, 1, 12]) for (const time of [0, 1 / 252, 1, 10]) { const a = gbmExactStep({ ...x, time, z }), b = gbmExactStep({ ...x, initialPrice: 300, time, z }); expect(a.price).toBeGreaterThan(0); expect(b.price).toBeCloseTo(3 * a.price, 7); expect(a.factor).toBeCloseTo(Math.exp(a.logReturn), 14); }
  });
  test('analytical terminal summaries use the lognormal law with valid deterministic boundaries', () => {
    const a = gbmMoments(x); expect(a.mean).toBeCloseTo(110.51709180756477, 11); expect(a.median).toBeCloseTo(108.32870676749586, 11); expect(a.mode).toBeCloseTo(104.08107741923882, 11); expect(a.sd).toBeCloseTo(22.326305597038413, 11); expect(a.expectedSimpleReturn).toBeCloseTo(Math.expm1(.1), 15);
    const more = gbmMoments({ ...x, sigma: .4 }); expect(more.mean).toBe(a.mean); expect(more.median).toBeLessThan(a.median); expect(more.variance).toBeGreaterThan(a.variance);
    for (const mu of [-.1, 0, .1, .3]) for (const sigma of [0, .2, .8]) for (const time of [0, .25, 1, 10]) {
      const z = gbmMoments({ ...x, mu, sigma, time }); expect(z.mean).toBeGreaterThanOrEqual(z.median - 1e-10); expect(z.median).toBeGreaterThanOrEqual(z.mode - 1e-10); expect(z.variance).toBeGreaterThanOrEqual(0);
      if (sigma === 0 || time === 0) { expect(z.mean).toBe(z.median); expect(z.median).toBe(z.mode); expect(z.variance).toBe(0); }
    }
  });
  test('exact coarse and fine endpoints share one Brownian increment while Euler can lose positivity', () => {
    const balanced = gbmCoupledSteps({ ...x, z: 0, bridge: 1 }); expect(balanced.z1).toBe(1); expect(balanced.z2).toBe(-1); expect(balanced.dw1 + balanced.dw2).toBe(0); expect(balanced.exactTerminal).toBeCloseTo(108.32870676749586, 11); expect(balanced.eulerTerminal).toBe(108.25); expect(balanced.coarseEuler).toBeCloseTo(110, 12);
    const down = gbmCoupledSteps({ ...x, z: -6, bridge: 0 }); expect(down.exactTerminal).toBeCloseTo(32.62797946230395, 11); expect(down.coarseEuler).toBeCloseTo(-10, 12); expect(down.eulerTerminal).toBeCloseTo(20.25, 12); expect(down.coarseInvalid).toBe(true); expect(down.fineInvalid).toBe(false);
    for (const z of [-6, -1, 0, 1, 6]) for (const bridge of [-3, 0, 1, 3]) for (const time of [0, .25, 1, 10]) {
      const v = gbmCoupledSteps({ ...x, z, bridge, time }), m = x.mu - x.sigma ** 2 / 2;
      expect(v.dw1 + v.dw2).toBeCloseTo(v.totalDw, 13); expect(v.exactTerminal).toBeCloseTo(x.initialPrice * Math.exp(m * time + x.sigma * (v.dw1 + v.dw2)), 8); expect(v.eulerTerminal).toBeCloseTo(x.initialPrice * v.factor1 * v.factor2, 10); expect(v.fineInvalid).toBe(v.eulerFirst <= 0 || v.eulerTerminal <= 0);
    }
  });
  test('seeded paths are reproducible, positive and distinct from a complete law', () => {
    const a = simulateGbmPaths({ ...x, seed: 0 }), b = simulateGbmPaths({ ...x, seed: 0 }), c = simulateGbmPaths({ ...x, seed: 1 }); expect(a).toEqual(b); expect(a.values).not.toEqual(c.values); expect(a.values).toHaveLength(8); expect(a.values.every(row => row.length === 9 && row.every(v => Number.isFinite(v) && v > 0))).toBe(true);
    expect(a.sampleMean).toBeCloseTo(a.terminal.reduce((n, v) => n + v, 0) / 8, 12); const sorted = [...a.terminal].sort((m, n) => m - n); expect(a.sampleMedian).toBe((sorted[3] + sorted[4]) / 2);
    const flat = simulateGbmPaths({ ...x, sigma: 0, seed: 5 }); expect(flat.values.every(row => row.every((v, j) => v === 100 * Math.exp(.1 * j / 8)))).toBe(true);
    const instant = simulateGbmPaths({ ...x, time: 0, seed: 5 }); expect(instant.values.flat().every(v => v === 100)).toBe(true);
    for (let seed = 0; seed < 20; seed++) for (const sigma of [0, .8]) for (const time of [0, 10]) { const z = simulateGbmPaths({ ...x, mu: .3, sigma, time, seed }); expect(z.values.flat().every(v => Number.isFinite(v) && v > 0)).toBe(true); }
  });
  test('Q ex-dividend drift and dividend value reconcile under the declared constant-rate model', () => {
    const a = gbmMeasureComparison({ ...x, mu: .08, rate: .03, dividendYield: .02 }); expect(a.qMu).toBeCloseTo(.01, 15); expect(a.pricing.logDrift).toBeCloseTo(-.01, 15); expect(a.qDiscountedSpot).toBeCloseTo(98.01986733067552, 11); expect(a.qDividendPV).toBeCloseTo(1.9801326693244699, 13); expect(a.qDiscountedTotal).toBe(100); expect(a.physicalDiscountedTotal).toBeCloseTo(107.25081812542166, 11);
    for (const rate of [-.02, 0, .03, .1]) for (const dividendYield of [0, .02, .1]) for (const time of [0, 1, 10]) {
      const z = gbmMeasureComparison({ ...x, rate, dividendYield, time }); expect(z.pricing.mean * Math.exp(-rate * time)).toBeCloseTo(z.qDiscountedSpot, 10); expect(z.qDiscountedTotal).toBeCloseTo(100, 12);
    }
    const incompatible = renderToString(createElement(GbmEngineLab, { view: 'measure', sigmaPct: 0, muPct: 8 })), compatible = renderToString(createElement(GbmEngineLab, { view: 'measure', sigmaPct: 0, muPct: 1, ratePct: 3, dividendPct: 2 })); expect(incompatible).toContain('two incompatible deterministic models'); expect(compatible).not.toContain('two incompatible deterministic models');
  });
  test('MLE log moments recover level drift and horizon information without a second correction', () => {
    const f = gbmCalibration([-.04, .02, .08, .1], .25); expect(f.meanLog).toBe(.04); expect(f.centeredSquares).toBeCloseTo(.012, 15); expect(f.mHat).toBe(.16); expect(f.varianceHat).toBeCloseTo(.012, 15); expect(f.sigmaHat).toBeCloseTo(Math.sqrt(.012), 15); expect(f.muHat).toBe(.166); expect(f.observationYears).toBe(1); expect(f.muHat - .5 * f.varianceHat).toBeCloseTo(f.mHat, 15);
    expect(gbmDriftStandardError(.2, 1)).toBe(.2); expect(gbmDriftStandardError(.2, 25)).toBe(.04); expect(gbmDriftStandardError(0, 1)).toBe(0);
    expect(gbmCalibration([.04, .04, .04, .04], .25).varianceHat).toBe(0);
    for (const logs of [[-.04, .02, .08, .1], [-.1, .1], [0, 0]]) for (const interval of [.25, 1]) { const z = gbmCalibration(logs, interval); expect(z.mHat).toBeCloseTo(logs.reduce((a, b) => a + b, 0) / z.observationYears, 14); }
  });
  test('numeric underflow is rejected rather than reported as a deterministic positive-variance state', () => {
    expect(() => gbmExactStep({ ...x, sigma: Number.MIN_VALUE, time: .01, z: 1 })).toThrow('underflows'); expect(() => gbmMoments({ ...x, sigma: 1e-200 })).toThrow('underflows'); expect(() => gbmCalibration([-1e-200, 1e-200], .25)).toThrow('underflows'); expect(() => gbmCalibration([-1e-161, 1e-161], 50)).toThrow('underflows'); expect(() => gbmDriftStandardError(Number.MIN_VALUE, 1e6)).toThrow('underflows');
    expect(() => gbmMoments({ ...x, sigma: 0 })).not.toThrow(); expect(() => gbmMoments({ ...x, time: 0 })).not.toThrow();
  });
  test('all exact integer/quarter native numerals render and off-grid near-zero values fail before hooks', () => {
    const grids: [string, number, number, number][] = [['muPct', -10, 30, 1], ['sigmaPct', 0, 80, 1], ['time', 0, 10, .25], ['z', -6, 6, .25], ['bridge', -3, 3, .25], ['ratePct', -2, 10, .25], ['dividendPct', 0, 10, .25], ['observationYears', 1, 30, 1], ['knownSigmaPct', 0, 80, 1]];
    for (const [key, min, max, step] of grids) for (let index = 0; index <= (max - min) / step; index++) expect(() => renderToString(createElement(GbmEngineLab, { [key]: min + index * step }))).not.toThrow();
    for (const props of [{ sigmaPct: 1e-10 }, { sigmaPct: Number.MIN_VALUE }, { time: .25000000000000006 }, { muPct: 10.000000000000002 }, { ratePct: .99 }, { seed: .5 }]) expect(() => renderToString(createElement(GbmEngineLab, props))).toThrow('GbmEngineLab');
    for (const props of [{ view: 'moments', time: 0 }, { view: 'fan', sigmaPct: 0 }, { view: 'coupled', z: -6, bridge: 0 }, { view: 'measure', sigmaPct: 0 }, { view: 'calibration', knownSigmaPct: 0 }]) { const html = renderToString(createElement(GbmEngineLab, props as never)); expect(html).not.toMatch(/NaN|Infinity/); expect(html).toContain('tabindex="0"'); expect(html).toContain('block w-full max-w-full overflow-x-auto'); expect(html).toContain('aria-live="polite"'); }
  });
});
