import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CreditRiskLab, calculateCreditCashflows, calculateCreditDependence, calculateCreditIntensity, calculateCreditRegimes } from '@/components/react/CreditRiskLab';
const base = { physicalPD: .02, pricingPD: .04, recovery: .4, riskFree: .04 };
describe('Credit cash flows, probability measures and loss aggregation', () => {
  test('promised, expected and realized returns use the same purchase price', () => {
    const z = calculateCreditCashflows(base);
    expect(z.sameSupport).toBe(true); expect(calculateCreditCashflows({ ...base, pricingPD: 0 }).sameSupport).toBe(false); expect(calculateCreditCashflows({ ...base, physicalPD: 0 }).sameSupport).toBe(false); expect(calculateCreditCashflows({ ...base, physicalPD: 0, pricingPD: 0 }).sameSupport).toBe(true);
    expect(z.price).toBeCloseTo(1220 / 13, 12); expect(z.promisedYield).toBeCloseTo(4 / 61, 14);
    expect(z.expectedReturn).toBeCloseTo(161 / 3050, 14); expect(z.expectedExcess).toBeCloseTo(39 / 3050, 14);
    expect(z.spread).toBeCloseTo(39 / 1525, 14); expect(z.physicalLoss).toBeCloseTo(1.2, 14);
    expect(z.expectedPhysicalCash).toBeCloseTo(98.8, 13); expect(z.expectedPricingCash).toBeCloseTo(97.6, 13);
    const equal = calculateCreditCashflows({ ...base, pricingPD: .02 });
    expect(equal.price).toBeCloseTo(95, 13); expect(equal.expectedReturn).toBeCloseTo(.04, 14);
    expect(equal.defaultReturn).toBeCloseTo(-11 / 19, 14); expect(equal.promisedYield).toBeCloseTo(1 / 19, 14);
  });
  test('cash-flow state budgets and exact yield spread survive all supported combinations', () => {
    for (const p of [0, .02, .2, 1]) for (const q of [0, .04, .2, 1]) for (const recovery of [0, .4, .7, 1]) for (const r of [0, .04, .2]) {
      const z = calculateCreditCashflows({ physicalPD: p, pricingPD: q, recovery, riskFree: r });
      expect(z.expectedPhysicalCash).toBeCloseTo((1 - p) * 100 + p * recovery * 100, 12);
      expect(z.price * (1 + r)).toBeCloseTo((1 - q) * 100 + q * recovery * 100, 12);
      if (z.price === 0) { expect(z.promisedYield).toBeNull(); expect(z.expectedReturn).toBeNull(); expect(z.defaultReturn).toBeNull(); }
      else {
        expect(z.spread!).toBeCloseTo((1 + r) * q * (1 - recovery) / (1 - q * (1 - recovery)), 12);
        expect(z.expectedReturn!).toBeCloseTo((1 - p) * z.promisedYield! + p * z.defaultReturn!, 12);
        expect(z.promisedYield! - z.expectedReturn!).toBeCloseTo(z.physicalLoss / z.price, 12);
      }
    }
  });
  test('conditional LGD handles association rather than multiplying unrelated averages', () => {
    const z = calculateCreditRegimes(.2);
    expect(z.pd).toBeCloseTo(.028, 15); expect(z.averageLGD).toBeCloseTo(.48, 15);
    expect(z.expectedLoss).toBeCloseTo(.0192, 15); expect(z.naiveProduct).toBeCloseTo(.01344, 15);
    expect(z.conditionalLGD).toBeCloseTo(24 / 35, 15); expect(z.gap).toBeCloseTo(.00576, 15);
    for (let i = 0; i <= 100; i++) { const w = i / 100, r = calculateCreditRegimes(w); expect(r.pd * r.conditionalLGD).toBeCloseTo(r.expectedLoss, 15); expect(r.gap).toBeCloseTo(w * (1 - w) * (.1 - .01) * (.8 - .4), 15); }
    expect(calculateCreditRegimes(0).gap).toBeCloseTo(0, 15); expect(calculateCreditRegimes(1).gap).toBeCloseTo(0, 15);
  });
  test('dependence changes joint tails while preserving marginal PDs and total expected loss', () => {
    for (const p of [0, .000001, .02, .5, 1]) for (const lgd of [0, .6, 1]) for (let i = 0; i <= 100; i++) {
      const t = i / 100, z = calculateCreditDependence(t, p, lgd);
      expect(z.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
      expect(z.both + z.onlyOne / 2).toBeCloseTo(p, 14);
      expect(z.probabilities.every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
      expect(z.losses.reduce((sum, loss, k) => sum + loss * z.probabilities[k], 0)).toBeCloseTo(z.expectedLoss, 12);
    }
    const a = calculateCreditDependence(0), b = calculateCreditDependence(1);
    for (const [i, expected] of [.9604, .0392, .0004].entries()) expect(a.probabilities[i]).toBeCloseTo(expected, 15);
    expect(b.probabilities).toEqual([.98, 0, .02]); expect(a.expectedLoss).toBe(2.4); expect(b.expectedLoss).toBe(2.4);
  });
  test('intensity has time units and exponentiates survival, including small and zero products', () => {
    expect(calculateCreditIntensity(.02, 1).cumulativePD).toBeCloseTo(.0198013266932447, 15);
    expect(calculateCreditIntensity(.02, 5).cumulativePD).toBeCloseTo(.09516258196404043, 15);
    expect(calculateCreditIntensity(1e-200, 1).cumulativePD).toBe(1e-200);
    for (const intensity of [0, .02, .1, 1]) for (const time of [0, 1, 5, 10, 100]) { const z = calculateCreditIntensity(intensity, time); expect(z.survival + z.cumulativePD).toBeCloseTo(1, 15); expect(z.cumulativePD).toBeLessThanOrEqual(intensity * time); }
  });
  test('author guards run before hooks and supported native endpoints are finite', () => {
    for (const props of [{ physicalPD: .023 }, { pricingPD: .205 }, { recovery: .42 }, { riskFree: -.01 }, { stressWeight: .23 }, { coupling: 1.1 }, { intensity: .0123 }, { view: 'other' }]) expect(() => renderToString(createElement(CreditRiskLab, props as never))).toThrow('CreditRiskLab');
    for (const view of ['cash', 'regimes', 'joint', 'intensity'] as const) for (const endpoint of [0, 1]) { const html = renderToString(createElement(CreditRiskLab, { view, recovery: endpoint, stressWeight: endpoint, coupling: endpoint, intensity: endpoint * .1 })); expect(html).not.toMatch(/NaN|Infinity|undefined/); expect(html).toContain('tabindex="0"'); }
    const tinyRecovery = calculateCreditCashflows({ ...base, pricingPD: 1, recovery: 1e-200 });
    expect(tinyRecovery.price).toBeGreaterThan(0); expect(Number.isFinite(tinyRecovery.promisedYield)).toBe(true);
    expect(tinyRecovery.recoveryCash / tinyRecovery.price - 1).toBeCloseTo(.04, 14);
    expect(() => calculateCreditCashflows({ ...base, pricingPD: 1, recovery: 1e-320 })).toThrow('finite supported');
    expect(() => calculateCreditCashflows({ ...base, physicalPD: NaN })).toThrow('probability');
    expect(() => calculateCreditIntensity(-.1, 1)).toThrow('intensity');
  });
});
