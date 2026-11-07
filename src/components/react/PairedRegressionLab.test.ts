import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { fitPairedOLS, evaluatePairedOLS, scorePairedPredictions, PairedRegressionLab } from '@/components/react/PairedRegressionLab';
const pairs = [{ x: 2, y: 1 }, { x: -1, y: -2 }, { x: 3, y: 4 }, { x: -4, y: -3 }];
describe('Paired OLS arithmetic, identification and evaluation', () => {
  test('the original data give the exact centered-sum slope and complete residual decomposition', () => {
    const z = fitPairedOLS(pairs);
    expect(z.meanX).toBe(0); expect(z.meanY).toBe(0);
    expect(z.slope).toBeCloseTo(14 / 15, 14); expect(z.intercept).toBe(0);
    expect(z.sse).toBeCloseTo(58 / 15, 14); expect(z.sst).toBe(30);
    expect(z.rSquared).toBeCloseTo(196 / 225, 14);
    expect(z.rSquared).toBeCloseTo(z.correlation! ** 2, 14);
    expect(z.residuals.reduce((a, b) => a + b)).toBeCloseTo(0, 14);
    expect(z.rows.reduce((a, p) => a + p.x * p.residual, 0)).toBeCloseTo(0, 14);
    expect(scorePairedPredictions(pairs.map(p => p.y), pairs.map(() => 0)).sse).toBe(30);
    expect(scorePairedPredictions(pairs.map(p => p.y), pairs.map(p => p.x)).sse).toBe(4);
    expect(fitPairedOLS(pairs.map(p => ({ x: p.y, y: p.x }))).slope).toBeCloseTo(14 / 15, 14);
  });
  test('common unit changes preserve slope and coefficient; shifting the response moves the intercept', () => {
    const original = fitPairedOLS(pairs);
    for (const scale of [.01, .1, 1, 10, 100]) for (const shift of [-2, -.25, 0, .25, 2]) {
      const z = fitPairedOLS(pairs.map(p => ({ x: scale * p.x, y: scale * (p.y + shift) })));
      expect(z.slope).toBeCloseTo(original.slope!, 12); expect(z.intercept).toBeCloseTo(scale * shift, 12);
      expect(z.rSquared).toBeCloseTo(original.rSquared!, 12); expect(z.correlation).toBeCloseTo(original.correlation!, 12);
      expect(z.sse).toBeCloseTo(original.sse * scale * scale, 8);
    }
    const finance = [{ x: -.3, y: -.2 }, { x: .2, y: .25 }, { x: .7, y: 1.4 }, { x: 1.2, y: 1.75 }, { x: 1.7, y: 2.8 }], raw = fitPairedOLS(finance), excess = fitPairedOLS(finance.map(p => ({ x: p.x - .5, y: p.y - .5 })));
    expect(raw.meanX).toBeCloseTo(.7, 14); expect(raw.meanY).toBeCloseTo(1.2, 14);
    expect(raw.slope).toBeCloseTo(1.5, 14); expect(raw.intercept).toBeCloseTo(.15, 14);
    expect(excess.slope).toBeCloseTo(1.5, 14); expect(excess.intercept).toBeCloseTo(.4, 14);
  });
  test('constant predictors give a coefficient family; a constant target leaves centered R-squared undefined', () => {
    const xConstant = fitPairedOLS(pairs.map(p => ({ x: 2, y: p.y })));
    expect(xConstant.identified).toBe(false); expect(xConstant.slope).toBeNull(); expect(xConstant.intercept).toBeNull();
    expect(xConstant.fitted.every(v => v === 0)).toBe(true); expect(xConstant.rSquared).toBe(0); expect(xConstant.correlation).toBeNull();
    expect(evaluatePairedOLS(xConstant, [{ x: 2, y: 1 }, { x: 2, y: 2 }]).supported).toBe(true);
    expect(evaluatePairedOLS(xConstant, [{ x: 1, y: 1 }, { x: 2, y: 2 }]).supported).toBe(false);
    const zeroX = fitPairedOLS(pairs.map(p => ({ x: 0, y: p.y + 1 })));
    expect(zeroX.intercept).toBe(1); expect(zeroX.slope).toBeNull();
    const yConstant = fitPairedOLS(pairs.map(p => ({ x: p.x, y: 1 })));
    expect(yConstant.identified).toBe(true); expect(yConstant.slope).toBe(0); expect(yConstant.intercept).toBe(1); expect(yConstant.rSquared).toBeNull(); expect(yConstant.correlation).toBeNull();
    const both = fitPairedOLS(pairs.map(() => ({ x: 2, y: 1 })));
    expect(both.identified).toBe(false); expect(both.rSquared).toBeNull();
    expect(scorePairedPredictions([1, 1], [0, 0]).rSquared).toBeNull();
  });
  test('the centered score without an intercept need not equal squared Pearson correlation', () => {
    const data = [{ x: -1, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 4 }], z = fitPairedOLS(data, false);
    expect(z.slope).toBe(1); expect(z.intercept).toBe(0); expect(z.sse).toBe(27); expect(z.sst).toBe(2);
    expect(z.rSquared).toBe(-12.5); expect(z.correlation).toBe(1);
    const constantNonzero = fitPairedOLS([{ x: 2, y: 1 }, { x: 2, y: 3 }], false);
    expect(constantNonzero.identified).toBe(true); expect(constantNonzero.slope).toBe(1); expect(constantNonzero.fitted).toEqual([2, 2]);
    expect(fitPairedOLS([{ x: 0, y: 1 }, { x: 0, y: 3 }], false).slope).toBeNull();
  });
  test('a nonlinear deterministic law can have zero linear fit, while a fixed earlier fit can score negatively later', () => {
    const curved = [-2, -1, 0, 1, 2].map(x => ({ x, y: x * x })), linear = fitPairedOLS(curved), squared = fitPairedOLS(curved.map(p => ({ x: p.x * p.x, y: p.y })));
    expect(linear.slope).toBe(0); expect(linear.intercept).toBe(2); expect(linear.correlation).toBe(0); expect(linear.sse).toBe(14); expect(linear.rSquared).toBe(0);
    expect(squared.slope).toBe(1); expect(squared.intercept).toBe(0); expect(squared.rSquared).toBe(1);
    const frozen = fitPairedOLS(pairs), later = [-2, -1, 1, 2].map(x => ({ x, y: -x })), result = evaluatePairedOLS(frozen, later);
    expect(result.supported).toBe(true); expect(result.score!.sse).toBeCloseTo(1682 / 45, 12); expect(result.score!.sst).toBe(10); expect(result.score!.rSquared).toBeCloseTo(-616 / 225, 12);
    expect(frozen.slope).toBeCloseTo(14 / 15, 14);
  });
  test('normal equations and variance identity hold across varied deterministic samples', () => {
    let seed = 81; const next = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let k = 0; k < 500; k++) {
      const sample = Array.from({ length: 3 + Math.floor(next() * 18) }, () => ({ x: (Math.floor(next() * 101) - 50) / 10, y: (Math.floor(next() * 101) - 50) / 10 })), z = fitPairedOLS(sample);
      if (!z.identified || z.sst === 0) continue;
      expect(z.residuals.reduce((a, b) => a + b)).toBeCloseTo(0, 10);
      expect(z.rows.reduce((a, p) => a + p.x * p.residual, 0)).toBeCloseTo(0, 10);
      expect(z.rSquared).toBeCloseTo(z.correlation! ** 2, 10);
      expect(z.sse).toBeGreaterThanOrEqual(0); expect(z.rSquared!).toBeGreaterThanOrEqual(-1e-12); expect(z.rSquared!).toBeLessThanOrEqual(1 + 1e-12);
      const candidate = scorePairedPredictions(sample.map(p => p.y), sample.map(p => .75 + 1.25 * p.x));
      expect(z.sse).toBeLessThanOrEqual(candidate.sse + 1e-10);
    }
  });
  test('author guards reject snapped ranges and nonrepresentable scales; valid constant states render', () => {
    for (const props of [{ responseShift: .1 }, { riskFreePp: .55 }, { unit: 'other' }, { candidate: 'other' }, { pairs: [{ x: 11, y: 0 }, { x: 0, y: 0 }] }, { pairs: [{ x: -1e-100, y: -1 }, { x: 1e-100, y: 1 }] }]) expect(() => renderToString(createElement(PairedRegressionLab, props as never))).toThrow('PairedRegressionLab');
    for (const domainCase of ['variable', 'constantX', 'constantY', 'constantBoth']) {
      const html = renderToString(createElement(PairedRegressionLab, { view: 'domain', domainCase } as never));
      expect(html).not.toMatch(/NaN|Infinity/); expect(html).toContain('tabindex="0"');
    }
    expect(() => fitPairedOLS([{ x: -1e-200, y: -1 }, { x: 1e-200, y: 1 }])).toThrow('numerical scale');
    expect(() => scorePairedPredictions([1e-200, -1e-200], [0, 0])).toThrow('numerical scale');
    expect(() => scorePairedPredictions([1, 2], [1])).toThrow('matching');
    expect(() => fitPairedOLS([{ x: 1, y: 1 }])).toThrow('two to 1000');
  });
});
