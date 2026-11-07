import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MultiAssetKellyLab, calculateMultiKelly, calculateConstrainedMultiKelly, calculateMultiBudget, calculateMultiRay, type Pair } from '@/components/react/MultiAssetKellyLab';
const initial = { excess: [.08, .04] as Pair, volatility: [.2, .1] as Pair, correlation: .3 };
describe('Multi-asset diffusion Kelly and explicitly funded alternatives', () => {
  test('solve the covariance system without normalizing away cash or debt', () => {
    const r = calculateMultiKelly(initial); expect(r.status).toBe('unique'); expect(r.solution![0]).toBeCloseTo(20 / 13, 12); expect(r.solution![1]).toBeCloseTo(40 / 13, 12); expect(1 - r.solution![0] - r.solution![1]).toBeCloseTo(-47 / 13, 12); expect(r.q!).toBeCloseTo(16 / 65, 13); expect(r.maximumExcess!).toBeCloseTo(8 / 65, 13);
    for (const delta of [[.1, -.1], [-1, .5], [0, 0], [1, 1]] as Pair[]) { const f: Pair = [r.solution![0] + delta[0], r.solution![1] + delta[1]]; expect(r.growthAt(f)).toBeCloseTo(r.maximumExcess! - r.varianceAt(delta) / 2, 12); }
  });
  test('the symmetric comparative static does not apply to every asymmetric exposure', () => {
    const symmetric = { excess: [.08, .08] as Pair, volatility: [.2, .2] as Pair };
    for (const rho of [-.5, 0, .8]) { const r = calculateMultiKelly({ ...symmetric, correlation: rho }); expect(r.solution![0]).toBeCloseTo(.08 / (.04 * (1 + rho)), 12); expect(r.solution![1]).toBeCloseTo(r.solution![0], 12); }
    const asymmetric = calculateMultiKelly({ ...initial, excess: [.08, .02], correlation: .8 }); expect(asymmetric.solution![0]).toBeCloseTo(10 / 3, 12); expect(asymmetric.solution![1]).toBeCloseTo(-10 / 3, 12);
  });
  test('singular compatible inputs have a solution family, incompatible inputs no finite optimum', () => {
    const clone = calculateMultiKelly({ excess: [.08, .08], volatility: [.2, .2], correlation: 1 }); expect(clone.status).toBe('nonunique'); expect(clone.solution![0]).toBeCloseTo(1, 13); expect(clone.solution![1]).toBeCloseTo(1, 13); expect(clone.maximumExcess!).toBeCloseTo(.08, 13); expect(clone.growthAt([2, 0])).toBeCloseTo(clone.maximumExcess!, 13);
    expect(calculateMultiKelly({ excess: [.08, .04], volatility: [.2, .2], correlation: 1 }).status).toBe('unbounded'); expect(calculateMultiKelly({ excess: [.08, .08], volatility: [.2, .2], correlation: -1 }).solution).toBeNull();
    const opposite = calculateMultiKelly({ excess: [.08, -.04], volatility: [.2, .1], correlation: -1 }); expect(opposite.status).toBe('nonunique'); expect(opposite.maximumExcess!).toBeCloseTo(.08, 13);
    expect(calculateMultiKelly({ ...initial, excess: [0, 0] }).q).toBe(0);
  });
  test('exact polygon candidates optimize long-only caps and the borrowing kink, including PSD states', () => {
    const cap = calculateConstrainedMultiKelly(initial, 1); expect(cap.solution[0]).toBeCloseTo(1, 13); expect(cap.solution[1]).toBe(0); expect(cap.excessLogGrowth).toBeCloseTo(.06, 13);
    const symmetric = { excess: [.08, .08] as Pair, volatility: [.2, .2] as Pair, correlation: .8 }, funding = calculateConstrainedMultiKelly(symmetric, 4, .04); expect(funding.solution[0]).toBeCloseTo(5 / 9, 12); expect(funding.solution[1]).toBeCloseTo(5 / 9, 12); expect(funding.excessLogGrowth).toBeCloseTo(14 / 225, 12); expect(calculateConstrainedMultiKelly(symmetric, 4, .06).solution[0]).toBeCloseTo(.5, 12);
    for (const rho of [-1, -.9, 0, .8, 1]) for (const excess of [[-.1, -.1], [-.02, .08], [0, 0], [.08, .08], [.08, .04]] as Pair[]) for (const cap of [.5, 1, 2, 4]) for (const spread of [0, .04, .08]) {
      const r = calculateConstrainedMultiKelly({ ...initial, excess, correlation: rho }, cap, spread); expect(r.solution[0]).toBeGreaterThanOrEqual(0); expect(r.solution[1]).toBeGreaterThanOrEqual(0); expect(r.solution[0] + r.solution[1]).toBeLessThanOrEqual(cap + 1e-12);
      for (let j = 0; j <= 20; j++) for (let k = 0; k <= 20 - j; k++) expect(r.excessLogGrowth + 1e-12).toBeGreaterThanOrEqual(r.objectiveAt([cap * j / 20, cap * k / 20]));
    }
  });
  test('gross, net and cash differ when short proceeds are reusable', () => {
    const b = calculateMultiBudget([1.2, -.4]); expect(b.gross).toBeCloseTo(1.6, 13); expect(b.net).toBeCloseTo(.8, 13); expect(b.cash).toBeCloseTo(.2, 13); expect(b.debt).toBe(0); expect(b.final).toBe(100);
    const c = calculateMultiBudget([.8, .8]); expect(c.gross).toBeCloseTo(1.6, 13); expect(c.cash).toBeCloseTo(-.6, 13); expect(c.debt).toBeCloseTo(.6, 13);
  });
  test('a static joint jump can leave a liability outside the positive-wealth logarithm', () => {
    const r = calculateMultiBudget([2, 1], [-.5, -.2]); expect(r.after[0]).toBe(100); expect(r.after[1]).toBe(80); expect(r.initial[2]).toBe(-200); expect(r.final).toBeCloseTo(-20, 12); expect(r.logFactor).toBeNull();
    expect(calculateMultiBudget([2, 0], [-.5, 0]).factor).toBe(0);
    for (const a of [-4, -.5, 0, .5, 4]) for (const b of [-4, -.5, 0, .5, 4]) for (const ra of [-1, -.2, 0, .5]) for (const rb of [-1, -.2, 0, .5]) { const r = calculateMultiBudget([a, b], [ra, rb]); expect(r.after[0] + r.after[1] + 100 * r.cash).toBeCloseTo(r.final, 11); expect(r.factor).toBeCloseTo(r.final / 100, 12); }
  });
  test('changing scale cannot generally correct an incorrect vector direction', () => {
    const full = calculateMultiRay(initial, 1, .02, [.02, .04])!, half = calculateMultiRay(initial, .5, .02, [.02, .04])!;
    expect(full.actualGrowth).toBeCloseTo(2 / 65, 13); expect(half.actualGrowth).toBeCloseTo(3 / 65, 13); expect(full.bestNonnegativeScale).toBeCloseTo(.625, 13); expect(full.trueMaximum!).toBeGreaterThan(calculateMultiRay(initial, .625, .02, [.02, .04])!.actualGrowth);
    expect(calculateMultiRay(initial, .5, .02, [0, 0])!.actualGrowth).toBeLessThan(0);
  });
  test('twice-the-optimum boundary belongs to excess growth, not every absolute or finite outcome', () => {
    const input = { ...initial, excess: [.02, .01] as Pair };
    for (const k of [0, .5, 1, 1.5, 2, 2.4, 3]) { const r = calculateMultiRay(input, k, .02)!; expect(r.actualGrowth).toBeCloseTo(k * (2 - k) * calculateMultiKelly(input).maximumExcess!, 13); expect(r.absoluteGrowth).toBeCloseTo(.02 + r.actualGrowth, 13); }
    const over = calculateMultiRay(input, 2.4, .02)!; expect(over.actualGrowth).toBeLessThan(0); expect(over.absoluteGrowth).toBeGreaterThan(0); expect(over.floorProbability).toBe(1);
    expect(calculateMultiRay(input, 1, .02)!.floorProbability).toBeCloseTo(.5, 13); expect(calculateMultiRay(input, .5, .02)!.floorProbability).toBeCloseTo(.125, 13); expect(calculateMultiRay(input, 0, .02)!.floorProbability).toBe(0);
    expect(calculateMultiRay({ ...initial, excess: [0, 0] }, 1, .02)!.floorProbability).toBe(0);
  });
  test('invalid authors fail before hooks and valid singular/zero-growth/floor states render finite', () => {
    expect(() => renderToString(createElement(MultiAssetKellyLab, { correlation: 1.1 }))).toThrow('correlation');
    expect(() => renderToString(createElement(MultiAssetKellyLab, { correlation: .99 }))).toThrow('native control step');
    expect(() => renderToString(createElement(MultiAssetKellyLab, { excess: [.0792, .04] }))).toThrow('native control step');
    for (const props of [{ view: 'constraints' as const, cap: .33 }, { view: 'constraints' as const, borrowingSpread: .033 }, { view: 'budget' as const, fractions: [1.25, -.4] as Pair }, { view: 'jump' as const, shocks: [-.52, -.2] as Pair }, { view: 'scale' as const, multiple: .123 }, { view: 'floor' as const, floor: .333 }]) expect(() => renderToString(createElement(MultiAssetKellyLab, props))).toThrow('native control step');
    const unavailable = renderToString(createElement(MultiAssetKellyLab, { view: 'scale', correlation: -1 }));
    expect((unavailable.match(/<th scope="col"/g) || []).length).toBe(2);
    expect(renderToString(createElement(MultiAssetKellyLab, { view: 'scale', correlation: .99, excess: [.0792, .04] }))).not.toMatch(/NaN|Infinity/); expect(() => renderToString(createElement(MultiAssetKellyLab, { multiple: 1e-200 }))).toThrow('0.000001'); expect(() => renderToString(createElement(MultiAssetKellyLab, { excess: [1e-200, 0] }))).toThrow('0.000001');
    for (const props of [{ correlation: 1 }, { correlation: -1 }, { correlation: 1, excess: [.08, .08] as Pair, volatility: [.2, .2] as Pair }, { view: 'scale' as const, excess: [0, 0] as Pair }, { view: 'floor' as const, multiple: .01, floor: .1 }, { view: 'jump' as const, fractions: [2, 1] as Pair }]) expect(renderToString(createElement(MultiAssetKellyLab, props))).not.toMatch(/NaN|Infinity/);
  });
});
