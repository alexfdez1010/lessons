import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { EstimationSensitivityLab, calculateInputSensitivity, calculateMeanInformation, calculateSampleInformation, calculateFrozenHoldout, rankExampleRows } from '@/components/react/EstimationSensitivityLab';
const initial = { correlation: .99, gap: .0008, shrinkage: .2, riskAversion: 1, volatility: .2 };
describe('Estimation sensitivity under stated objectives and observation units', () => {
  test('annualized mean uncertainty matches annual and monthly observations, not a frequency illusion', () => {
    const three = calculateMeanInformation(36);
    expect(three.annualMeanSE).toBeCloseTo(.2 / Math.sqrt(3), 14);
    expect(three.monthlyMeanSE * 12).toBeCloseTo(three.annualMeanSE, 14);
    expect(three.monthsForOnePointSE).toBe(4800);
    expect(calculateMeanInformation(4800).annualMeanSE).toBeCloseTo(.01, 14);
    expect(calculateMeanInformation(144).annualMeanSE).toBeCloseTo(three.annualMeanSE / 2, 14);
  });
  test('centered rank and exact covariance account for complete aligned observations', () => {
    const three = calculateSampleInformation(rankExampleRows.slice(0, 3));
    expect(three.rank).toBe(2); expect(three.maximumRank).toBe(2);
    const expected = [[.01, -.005, .005], [-.005, .01, .005], [.005, .005, .01]];
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) expect(three.covariance[j][k]).toBeCloseTo(expected[j][k], 14);
    expect(calculateSampleInformation(rankExampleRows).rank).toBe(3);
    expect(calculateSampleInformation([[0, 0], [0, 0], [0, 0], [0, 0]]).rank).toBe(0);
    expect(calculateSampleInformation([[.1, .1], [.2, .2], [-.1, -.1], [0, 0]]).rank).toBe(1);
  });
  test('the fully invested optimum is derived from its own budget and risk aversion', () => {
    const r = calculateInputSensitivity(initial);
    expect(r.rawWeight).toBeCloseTo(1.5, 12); expect(r.longOnlyWeight).toBe(1);
    expect(r.shrunkWeight).toBeCloseTo(.548076923076923, 13);
    expect(r.raw.minimumEigenvalue).toBeCloseTo(.0004, 14); expect(r.raw.maximumEigenvalue).toBeCloseTo(.0796, 14); expect(r.raw.condition).toBeCloseTo(199, 11);
    expect(r.effectiveCorrelation).toBeCloseTo(.792, 14); expect(r.shrunk.minimumEigenvalue).toBeCloseTo(.00832, 14); expect(r.shrunk.condition).toBeCloseTo(8.615384615384615, 12);
    expect(calculateInputSensitivity({ ...initial, gap: -.0008 }).rawWeight).toBeCloseTo(-.5, 12);
  });
  test('raw and shrunk optima maximize their respective quadratic objectives, not necessarily the true one', () => {
    for (const rho of [0, .5, .9, .99, .999]) for (const gap of [-.002, -.0008, 0, .0008, .002]) for (const lambda of [0, .2, 1]) {
      const r = calculateInputSensitivity({ ...initial, correlation: rho, gap, shrinkage: lambda });
      for (const [w, modelRho] of [[r.rawWeight!, rho], [r.shrunkWeight!, r.effectiveCorrelation]]) for (const change of [-2, -.01, 0, .01, 2]) expect(r.objectiveAt(w, modelRho) + 1e-14).toBeGreaterThanOrEqual(r.objectiveAt(w + change, modelRho));
      for (let j = 0; j <= 100; j++) expect(r.objectiveAt(r.longOnlyWeight) + 1e-14).toBeGreaterThanOrEqual(r.objectiveAt(j / 100));
      expect(r.raw.condition! + 1e-12).toBeGreaterThanOrEqual(r.shrunk.condition!);
      if (lambda > 0 && rho > 0 && gap !== 0) expect(r.objectiveAt(r.rawWeight!)).toBeGreaterThan(r.objectiveAt(r.shrunkWeight!));
    }
  });
  test('singular cases distinguish flat/unbounded raw objectives from feasible constrained optima', () => {
    const zero = calculateInputSensitivity({ ...initial, correlation: 1, gap: 0 });
    expect(zero.status).toBe('flat'); expect(zero.rawWeight).toBeNull(); expect(zero.raw.condition).toBeNull(); expect(zero.longOnlyWeight).toBe(.5); expect(zero.shrunkWeight).toBe(.5);
    const plus = calculateInputSensitivity({ ...initial, correlation: 1 }); expect(plus.status).toBe('unbounded'); expect(plus.longOnlyWeight).toBe(1); expect(plus.shrunkWeight).toBeCloseTo(.55, 13);
    expect(calculateInputSensitivity({ ...initial, correlation: 1, gap: -.0008 }).longOnlyWeight).toBe(0);
    expect(calculateInputSensitivity({ ...initial, correlation: 1, shrinkage: 0 }).shrunkWeight).toBeNull();
  });
  test('fixed holdout scenarios can reverse rankings without implying empirical dominance', () => {
    const loss = calculateFrozenHoldout(1.5, 'reversal'), equalLoss = calculateFrozenHoldout(.5, 'reversal');
    expect(loss.returns[0]).toBeCloseTo(-.11, 14); expect(loss.returns[1]).toBeCloseTo(.055, 14); expect(loss.terminal).toBeCloseTo(93.895, 12); expect(equalLoss.terminal).toBeCloseTo(95.095, 12); expect(loss.terminal).toBeLessThan(equalLoss.terminal);
    expect(calculateFrozenHoldout(1.5, 'continuation').terminal).toBeCloseTo(117.105, 12); expect(calculateFrozenHoldout(.5, 'continuation').terminal).toBeCloseTo(113.905, 12);
    for (let w = -5; w <= 5; w += .25) for (const scenario of ['reversal', 'continuation'] as const) { const r = calculateFrozenHoldout(w, scenario); expect(r.terminal).toBeCloseTo(100 * (1 + r.returns[0]) * (1 + r.returns[1]), 12); expect(r.wealth.every(v => v > 0)).toBe(true); }
  });
  test('author guards run before hooks while singular learner states remain meaningful', () => {
    expect(() => renderToString(createElement(EstimationSensitivityLab, { correlation: 1.01 }))).toThrow('correlation');
    expect(() => renderToString(createElement(EstimationSensitivityLab, { correlation: .9999 }))).toThrow('bounded viewer');
    expect(() => renderToString(createElement(EstimationSensitivityLab, { months: 0 }))).toThrow('months');
    expect(() => calculateSampleInformation([[.1, .2], [.1]] )).toThrow('complete rows');
    expect(() => calculateSampleInformation([[1e-200], [0]])).toThrow('0.000001');
    expect(() => renderToString(createElement(EstimationSensitivityLab, { view: 'holdout', correlation: 1 }))).toThrow('unique finite');
    for (const gap of [-.0008, 0, .0008]) for (const shrinkage of [0, .2]) { const html = renderToString(createElement(EstimationSensitivityLab, { correlation: 1, gap, shrinkage })); expect(html).not.toMatch(/NaN|Infinity/); expect(html).toMatch(/No (unique|finite) raw optimum/); }
  });
});
