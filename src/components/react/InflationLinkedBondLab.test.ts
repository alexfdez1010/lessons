import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { InflationLinkedBondLab, calculateIndexedPayment, calculateLaggedReference, calculateRealIndexedPrice, calculateInflationBreakeven, calculateInflationCompensation } from '@/components/react/InflationLinkedBondLab';

describe('Index-linked cash, real discounting and matched comparison', () => {
  test('a fixed annual rate scales each half-year coupon by the payment-date index', () => {
    const z = calculateIndexedPayment(1000, .02, 100, 103, true);
    expect(z.ratio).toBe(1.03); expect(z.adjustedPrincipal).toBe(1030); expect(z.coupon).toBe(10.3);
    expect(calculateIndexedPayment(1000, .02, 100, 101, true).coupon).toBe(10.1);
    for (const reference of [50, 95, 100, 103, 200]) for (const rate of [0, .00125, .02, .1]) {
      const x = calculateIndexedPayment(1000, rate, 100, reference, true), scaled = calculateIndexedPayment(3000, rate, 100, reference, true);
      expect(x.coupon).toBeCloseTo(x.adjustedPrincipal * rate / 2, 12); expect(scaled.coupon).toBeCloseTo(3 * x.coupon, 10); expect(scaled.redemption).toBeCloseTo(3 * x.redemption, 10);
    }
  });
  test('the original-face maturity floor does not floor coupon cash or reimburse premium purchase cash', () => {
    const floored = calculateIndexedPayment(1000, .02, 100, 95, true), unfloored = calculateIndexedPayment(1000, .02, 100, 95, false);
    expect(floored.adjustedPrincipal).toBe(950); expect(floored.redemption).toBe(1000); expect(floored.coupon).toBe(9.5); expect(floored.floorTopUp).toBe(50); expect(floored.finalReceipt).toBe(1009.5);
    expect(unfloored.redemption).toBe(950); expect(unfloored.coupon).toBe(floored.coupon); expect(floored.finalReceipt - 1000 * 1.1 * 1.02).toBeCloseTo(-112.5, 10);
    expect(calculateIndexedPayment(1000, .02, 100, 110, true).floorTopUp).toBe(0);
  });
  test('interpolation uses day minus one and keeps the next month anchor outside the current month', () => {
    expect(calculateLaggedReference(100, 102, 1, 30)).toEqual({ weight: 0, reference: 100 });
    expect(calculateLaggedReference(100, 102, 16, 30)).toEqual({ weight: .5, reference: 101 });
    expect(calculateLaggedReference(100, 102, 30, 30).reference).toBeCloseTo(101.9333333333333, 12);
    for (let days = 28; days <= 31; days++) for (let day = 1; day <= days; day++) for (const [a, b] of [[100, 102], [102, 100], [100, 100]]) {
      const z = calculateLaggedReference(a, b, day, days); expect(z.weight).toBeGreaterThanOrEqual(0); expect(z.weight).toBeLessThan(1); expect(z.reference).toBeGreaterThanOrEqual(Math.min(a, b)); expect(z.reference).toBeLessThanOrEqual(Math.max(a, b));
    }
    expect(() => calculateLaggedReference(100, 102, 30, 29)).toThrow('calendar-day');
  });
  test('real price uses half-year discount periods, zero yield has a direct sum, and the floor is absent by design', () => {
    const x = { face: 1000, couponRate: .02, periods: 2 };
    expect(calculateRealIndexedPrice({ ...x, yieldRate: .02 }).price).toBe(1000);
    expect(calculateRealIndexedPrice({ ...x, yieldRate: .04 }).price).toBeCloseTo(980.5843906189927, 10);
    expect(calculateRealIndexedPrice({ ...x, yieldRate: 0 }).price).toBe(1020);
    expect(calculateRealIndexedPrice({ ...x, yieldRate: -.01 }).price).toBeCloseTo(1030.2265094315798, 10);
    for (const periods of [1, 2, 10, 40, 120]) for (const couponRate of [0, .02, .1]) for (const yieldRate of [-.03, 0, .02, .04, .1]) {
      const a = calculateRealIndexedPrice({ face: 1000, couponRate, periods, yieldRate }), b = calculateRealIndexedPrice({ face: 3000, couponRate, periods, yieldRate }), higher = calculateRealIndexedPrice({ face: 1000, couponRate, periods, yieldRate: yieldRate + .001 });
      expect(a.rows).toHaveLength(periods); expect(a.rows[periods - 1].cash).toBe(1000 + 1000 * couponRate / 2); expect(a.price).toBeGreaterThan(higher.price); expect(b.price).toBeCloseTo(3 * a.price, 7); expect(a.price).toBeCloseTo(a.rows.reduce((s, row) => s + row.presentValue, 0), 10);
    }
  });
  test('ideal annual-effective breakeven equates factors rather than subtracting yields exactly', () => {
    const input = { wealth: 1000, nominalYield: .04, realYield: .01, inflation: .03, years: 1 }, z = calculateInflationBreakeven(input);
    expect(z.exactBreakeven).toBeCloseTo(3 / 101, 15); expect(z.yieldDifference).toBe(.03); expect(z.linkedAnnualNominal).toBe(.0403); expect(z.nominalTerminal).toBe(1040); expect(z.linkedTerminal).toBe(1040.3); expect(z.difference).toBeCloseTo(.3, 12);
    const atTie = calculateInflationBreakeven({ ...input, inflation: z.exactBreakeven, years: 30 }); expect(atTie.linkedTerminal).toBeCloseTo(atTie.nominalTerminal, 8);
    for (const nominalYield of [-.02, 0, .04, .12]) for (const realYield of [-.03, 0, .01, .1]) for (const years of [1, 5, 30]) {
      const q = calculateInflationBreakeven({ ...input, nominalYield, realYield, years }), tie = calculateInflationBreakeven({ ...input, nominalYield, realYield, years, inflation: q.exactBreakeven });
      expect((1 + realYield) * (1 + q.exactBreakeven)).toBeCloseTo(1 + nominalYield, 14); expect(tie.linkedTerminal / tie.nominalTerminal).toBeCloseTo(1, 13); expect(q.rows[0].linked).toBe(1000); expect(q.rows[years].linkedReal).toBeCloseTo(1000 * (1 + realYield) ** years, 7);
    }
  });
  test('legitimate zero, negative and extreme matched factors remain positive and finite', () => {
    for (const n of [-.5, 0, .5]) for (const r of [-.5, 0, .5]) for (const pi of [-.5, 0, .5]) for (const years of [1, 50]) {
      const z = calculateInflationBreakeven({ wealth: 1e-6, nominalYield: n, realYield: r, inflation: pi, years }); expect(z.nominalTerminal).toBeGreaterThan(0); expect(z.linkedTerminal).toBeGreaterThan(0); expect(Object.values(z).filter(x => typeof x === 'number').every(Number.isFinite)).toBe(true);
      expect(z.difference / Math.max(z.nominalTerminal, z.linkedTerminal)).toBeCloseTo((z.linkedTerminal - z.nominalTerminal) / Math.max(z.nominalTerminal, z.linkedTerminal), 13);
    }
  });
  test('the assumed risk and liquidity signs reproduce compensation without identifying them', () => {
    const first = calculateInflationCompensation(.013, .022, .005, .002), second = calculateInflationCompensation(.013, .022, .008, .005), liquidity = calculateInflationCompensation(.013, .022, .005, .005);
    expect(first.nominalYield).toBeCloseTo(.04, 15); expect(first.tipsYield).toBe(.015); expect(first.compensation).toBeCloseTo(.025, 15); expect(second.compensation).toBeCloseTo(first.compensation, 15); expect(liquidity.compensation).toBeCloseTo(.022, 15);
    for (const risk of [-.02, 0, .02]) for (const lp of [-.01, 0, .02]) { const z = calculateInflationCompensation(.013, .022, risk, lp); expect(z.nominalYield - z.tipsYield).toBeCloseTo(z.compensation, 15); }
  });
  test('every authored native-grid numeral renders, while near-zero off-grid values are rejected', () => {
    const grids: [string, number, number, number][] = [
      ['referenceIndex', 50, 200, 1], ['couponPct', 0, 10, .25], ['day', 1, 30, 1], ['firstAnchor', 50, 200, 1], ['nextAnchor', 50, 200, 1], ['purchaseRatioPct', 50, 200, 1], ['cleanQuote', 50, 150, 1], ['realYieldPct', -3, 10, .25], ['periods', 1, 40, 1], ['nominalYieldPct', -2, 12, .25], ['inflationPct', -5, 15, .25], ['years', 1, 30, 1], ['expectedPct', 0, 6, .1], ['riskPremiumPct', -2, 2, .1], ['liquidityPremiumPct', -1, 2, .1],
    ];
    for (const [key, min, max, step] of grids) {
      const digits = String(step).split('.')[1]?.length ?? 0;
      for (let index = 0; index <= Math.round((max - min) / step); index++) {
        const value = Number((min + index * step).toFixed(digits));
        expect(() => renderToString(createElement(InflationLinkedBondLab, { [key]: value }))).not.toThrow();
      }
    }
    for (const change of [{ couponPct: 1e-10 }, { couponPct: Number.MIN_VALUE }, { realYieldPct: 1e-10 }, { expectedPct: .30000000000000004 }]) expect(() => renderToString(createElement(InflationLinkedBondLab, change))).toThrow('native range and step');
    for (const change of [{ expectedPct: 2.2 }, { expectedPct: .3 }, { riskPremiumPct: .3 }, { liquidityPremiumPct: .3 }]) expect(() => renderToString(createElement(InflationLinkedBondLab, change))).not.toThrow();
  });
  test('author grids reject silent native snapping before hooks and supported edge states render', () => {
    for (const props of [{ couponPct: .125 }, { realYieldPct: .99 }, { referenceIndex: 103.5 }, { day: 31 }, { riskPremiumPct: .55 }, { years: 0 }, { maturityFloor: 1 }, { face: NaN }]) expect(() => renderToString(createElement(InflationLinkedBondLab, props as never))).toThrow('InflationLinkedBondLab');
    for (const props of [{ view: 'cash', couponPct: 0 }, { view: 'lag', day: 30, firstAnchor: 200, nextAnchor: 50 }, { view: 'floor', referenceIndex: 50, maturityFloor: false }, { view: 'price', realYieldPct: 0, periods: 40 }, { view: 'breakeven', realYieldPct: 0, nominalYieldPct: 0, inflationPct: 0 }, { view: 'premia', riskPremiumPct: -2, liquidityPremiumPct: 2 }]) {
      const html = renderToString(createElement(InflationLinkedBondLab, props as never)); expect(html).not.toMatch(/NaN|Infinity/); expect(html).toContain('tabindex="0"'); expect(html).toContain('block w-full max-w-full overflow-x-auto'); expect(html).toContain('aria-live="polite"');
    }
    expect(() => calculateIndexedPayment(1000, .02, 0, 100, true)).toThrow(); expect(() => calculateRealIndexedPrice({ face: 1000, couponRate: .02, yieldRate: -2, periods: 2 })).toThrow(); expect(() => calculateInflationBreakeven({ wealth: 1000, nominalYield: 0, realYield: -.999, inflation: 0, years: 1 })).toThrow();
  });
});
