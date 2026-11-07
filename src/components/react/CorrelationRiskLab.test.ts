import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CorrelationRiskLab, calculatePairedMoments, calculateWeightedMoments, calculateTwoAssetRisk, calculateFiniteJointLoss } from '@/components/react/CorrelationRiskLab';
const pairs = [{ x: 10, y: 4 }, { x: -2, y: 0 }, { x: 4, y: 2 }];
describe('Paired moment conventions, hedge weights and finite joint losses', () => {
  test('the original three observations have correlation one under both consistent conventions', () => {
    const p = calculatePairedMoments(pairs, 'population'), s = calculatePairedMoments(pairs, 'sample');
    expect(p.meanX).toBe(4); expect(p.meanY).toBe(2); expect(p.covariance).toBe(8);
    expect(p.varianceX).toBe(24); expect(p.varianceY).toBeCloseTo(8 / 3, 14);
    expect(s.covariance).toBe(12); expect(s.sdX).toBe(6); expect(s.sdY).toBe(2);
    expect(p.correlation).toBeCloseTo(1, 14); expect(s.correlation).toBeCloseTo(1, 14);
    expect(s.sumXX).toBe(72); expect(s.sumYY).toBe(8); expect(s.sumXY).toBe(24);
    // This intentionally mixed-convention result is the defect being corrected.
    expect(p.covariance / (s.sdX * s.sdY)).toBeCloseTo(2 / 3, 14);
    const extra = calculatePairedMoments([...pairs, { x: 10, y: 0 }]);
    expect(extra.meanX).toBe(5.5); expect(extra.meanY).toBe(1.5);
    expect(extra.sumXX).toBe(99); expect(extra.sumYY).toBe(11); expect(extra.sumXY).toBeCloseTo(15, 12);
    expect(extra.correlation).toBeCloseTo(5 / 11, 14);
  });
  test('units rescale covariance and SD but not correlation; a true constant gives no coefficient', () => {
    const base = calculatePairedMoments(pairs);
    for (const scale of [.01, 1e-100, 100]) {
      const s = calculatePairedMoments(pairs.map(p => ({ x: p.x * scale, y: p.y * scale })));
      expect(s.correlation).toBeCloseTo(1, 13);
      expect(s.covariance / (scale * scale)).toBeCloseTo(base.covariance, 11);
      expect(s.sdX / scale).toBeCloseTo(base.sdX, 12);
    }
    for (const value of [0, 4, 1e-200]) {
      const c = calculatePairedMoments(pairs.map(p => ({ x: value, y: p.y })));
      expect(c.covariance).toBe(0); expect(c.sdX).toBe(0); expect(c.correlation).toBeNull();
    }
    expect(calculatePairedMoments([{ x: 1, y: 2 }], 'population').correlation).toBeNull();
    expect(() => calculatePairedMoments([{ x: -1e-200, y: -1e-200 }, { x: 0, y: 0 }, { x: 1e-200, y: 1e-200 }])).toThrow('numerical scale');
  });
  test('unequal-volatility inverse returns need matched weighted exposures, not equal weights', () => {
    const equal = calculateTwoAssetRisk(.3, .2, -1, .5), hedge = calculateTwoAssetRisk(.3, .2, -1, .4);
    expect(equal.volatility).toBeCloseTo(.05, 14); expect(hedge.volatility).toBeCloseTo(0, 14);
    expect(hedge.minimumWeight).toBeCloseTo(.4, 14); expect(hedge.minimumVol).toBe(0);
    expect(calculateTwoAssetRisk(.3, .2, 0, .5).volatility).toBeCloseTo(Math.sqrt(.0325), 14);
    const uncorrelated = calculateTwoAssetRisk(.3, .2, 0, .8);
    expect(uncorrelated.volatility).toBeCloseTo(Math.sqrt(.0592), 14); expect(uncorrelated.volatility).toBeGreaterThan(.2);
    expect(uncorrelated.minimumWeight).toBeCloseTo(4 / 13, 14); expect(uncorrelated.minimumVol).toBeCloseTo(Math.sqrt(.0036 / .13), 14);
  });
  test('long-only bounds, minimum points and zero-variance states satisfy the declared model', () => {
    for (const a of [0, .1, .2, .3, .6]) for (const b of [0, .1, .2, .3, .6]) for (const rho of [-1, -.95, -.5, 0, .5, .95, 1]) {
      const initial = calculateTwoAssetRisk(a, b, rho, .5);
      for (let j = 0; j <= 40; j++) {
        const w = j / 40, r = calculateTwoAssetRisk(a, b, rho, w), direct = w * w * a * a + (1 - w) ** 2 * b * b + 2 * w * (1 - w) * a * b * rho;
        expect(r.variance).toBeCloseTo(direct, 13); expect(r.gapVol).toBeGreaterThanOrEqual(0);
        expect(r.volatility + r.gapVol).toBeCloseTo(r.referenceVol, 13);
        expect(initial.minimumVol).toBeLessThanOrEqual(r.volatility + 1e-13);
        expect(r.correlation === null).toBe(a === 0 || b === 0);
      }
      if (initial.minimumWeight !== null) expect(calculateTwoAssetRisk(a, b, rho, initial.minimumWeight).volatility).toBeCloseTo(initial.minimumVol, 13);
    }
    expect(calculateTwoAssetRisk(.2, .2, 1, .7).minimumWeight).toBeNull();
    expect(calculateTwoAssetRisk(0, 0, .5, .7).minimumWeight).toBeNull();
    expect(calculateTwoAssetRisk(0, .2, -.5, .5).minimumWeight).toBe(1);
    expect(() => calculateTwoAssetRisk(1e-200, 1e-200, .5, .5)).toThrow('numerical scale');
  });
  test('the joint-law mixture changes finite co-loss while preserving means, variances and correlation', () => {
    for (let j = 0; j <= 100; j++) {
      const t = j / 100, r = calculateFiniteJointLoss(t);
      expect(r.states.reduce((s, v) => s + v.probability, 0)).toBeCloseTo(1, 14);
      expect(r.meanX).toBeCloseTo(0, 14); expect(r.meanY).toBeCloseTo(0, 14);
      expect(r.varianceX).toBeCloseTo(.036, 14); expect(r.varianceY).toBeCloseTo(.036, 14);
      expect(r.equalWeightVolatility).toBeCloseTo(Math.sqrt(.018), 14);
      expect(r.covariance).toBeCloseTo(0, 14); expect(r.correlation).toBeCloseTo(0, 14);
      expect(r.tailX).toBeCloseTo(.1, 14); expect(r.tailY).toBeCloseTo(.1, 14);
      expect(r.joint).toBeCloseTo(.01 + .09 * t, 14); expect(r.conditional).toBeCloseTo(.1 + .9 * t, 14);
      expect(r.independentJoint).toBeCloseTo(.01, 14);
      expect(r.states.every(s => s.probability >= 0)).toBe(true);
    }
    expect(calculateFiniteJointLoss(1).states.filter(s => s.probability > 0)).toHaveLength(4);
    expect(calculateFiniteJointLoss(0).states.filter(s => s.probability > 0)).toHaveLength(16);
  });
  test('authored grids and numeric domains are guarded before hooks; legitimate constants remain renderable', () => {
    for (const props of [{ volA: .33 }, { correlation: .99 }, { weightA: .42 }, { mixture: .23 }, { convention: 'other' }, { unit: 'other' }, { constantA: 0 }]) expect(() => renderToString(createElement(CorrelationRiskLab, props as never))).toThrow('CorrelationRiskLab');
    for (const props of [{ constantA: true }, { view: 'portfolio', volA: 0 }, { view: 'portfolio', volA: 0, volB: 0 }, { view: 'portfolio', volA: .2, volB: .2, correlation: 1 }, { view: 'joint', mixture: 0 }, { view: 'joint', mixture: 1 }]) {
      const html = renderToString(createElement(CorrelationRiskLab, props as never)); expect(html).not.toMatch(/NaN|Infinity/); expect(html).toContain('tabindex="0"');
    }
    expect(() => calculateWeightedMoments([{ x: 1, y: 2, probability: .9 }])).toThrow('sum to one');
    expect(() => calculatePairedMoments([{ x: 1, y: 2 }])).toThrow('enough complete');
  });
});
