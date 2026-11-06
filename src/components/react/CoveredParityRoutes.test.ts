import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateCoveredParity, CoveredParityRoutes } from '@/components/react/CoveredParityRoutes';
const base = { amount: 1000000, spot: 1.2, domesticRate: .05, foreignRate: .03,
  spotBid: 1.199, spotAsk: 1.201, domesticDepositRate: .04, domesticBorrowRate: .06,
  foreignDepositRate: .02, foreignBorrowRate: .04, forwardBid: 1.23, forwardSpread: .002 };
describe('matched currency cash flows and executable CIP bounds', () => {
  test('the ideal routes equalize domestic maturity wealth using the entire foreign proceeds', () => {
    const r = calculateCoveredParity({ ...base, amount: 1200 });
    expect(r.parityForward).toBeCloseTo(1.2233009708737863, 12);
    expect(r.foreignInitial).toBe(1000); expect(r.foreignEnding).toBe(1030);
    expect(r.domesticEnding).toBe(1260); expect(r.coveredEnding).toBeCloseTo(1260, 10);
  });
  test('the executable quote can differ from a midpoint benchmark while both routes lose', () => {
    const r = calculateCoveredParity(base);
    expect(r.lowerBound).toBeCloseTo(1.199, 12); expect(r.upperBound).toBeCloseTo(1.2480980392156864, 12);
    expect(r.forwardAsk).toBeCloseTo(1.232, 12); expect(base.forwardBid).toBeGreaterThan(r.parityForward);
    expect(r.domesticFundedProfit).toBeCloseTo(-15370.524562864362, 7);
    expect(r.foreignFundedProfit).toBeCloseTo(-28623.85321100902, 7);
    expect(r.domesticFundedForeignInitial).toBeCloseTo(832639.467110741, 7);
    expect(r.domesticFundedForeignEnding).toBeCloseTo(849292.256452956, 7);
    expect(r.foreignFundedBorrowing).toBeCloseTo(834028.3569641367, 7);
    expect(r.foreignFundedRepayment).toBeCloseTo(867389.4912427022, 7);
  });
  test('rich and cheap forward sides select opposite listed funding directions', () => {
    const high = calculateCoveredParity({ ...base, forwardBid: 1.26 }), low = calculateCoveredParity({ ...base, forwardBid: 1.18 });
    expect(high.domesticFundedProfit).toBeCloseTo(10108.243130724448, 7);
    expect(high.foreignFundedProfit).toBeLessThan(0);
    expect(low.foreignFundedProfit).toBeCloseTo(14745.621351126114, 7);
    expect(low.domesticFundedProfit).toBeLessThan(0);
  });
  test('zero spreads and single financing rates collapse the band to ideal parity', () => {
    for (const domesticRate of [-.01, 0, .05, .2]) for (const foreignRate of [-.01, 0, .03, .2]) {
      const F = base.spot * (1 + domesticRate) / (1 + foreignRate);
      const r = calculateCoveredParity({ ...base, domesticRate, foreignRate, spotBid: base.spot, spotAsk: base.spot,
        domesticDepositRate: domesticRate, domesticBorrowRate: domesticRate, foreignDepositRate: foreignRate, foreignBorrowRate: foreignRate, forwardBid: F, forwardSpread: 0 });
      expect(r.lowerBound).toBeCloseTo(F, 12); expect(r.upperBound).toBeCloseTo(F, 12);
      expect(r.domesticFundedProfit).toBeCloseTo(0, 7); expect(r.foreignFundedProfit).toBeCloseTo(0, 7);
      expect(r.coveredEnding).toBeCloseTo(r.domesticEnding, 7);
    }
  });
  test('funded bounds, cash-flow normalization and sign inequalities hold across funding states', () => {
    for (const S of [.8, 1.2, 1.8]) for (const d of [-.01, .04, .1]) for (const f of [-.01, .02, .1]) {
      const inputs = { ...base, spotBid: S * .999, spotAsk: S * 1.001, domesticDepositRate: d, domesticBorrowRate: d + .02, foreignDepositRate: f, foreignBorrowRate: f + .02 };
      const r = calculateCoveredParity(inputs);
      expect(r.lowerBound).toBeLessThanOrEqual(r.upperBound);
      expect(r.foreignFundedBorrowing * inputs.spotBid).toBeCloseTo(base.amount, 7);
      expect(r.domesticFundedForeignInitial * inputs.spotAsk).toBeCloseTo(base.amount, 7);
      const atUpper = calculateCoveredParity({ ...inputs, forwardBid: r.upperBound, forwardSpread: 0 });
      const atLower = calculateCoveredParity({ ...inputs, forwardBid: r.lowerBound, forwardSpread: 0 });
      expect(atUpper.domesticFundedProfit).toBeCloseTo(0, 7);
      expect(atLower.foreignFundedProfit).toBeCloseTo(0, 7);
      expect(calculateCoveredParity({ ...inputs, forwardBid: r.upperBound + .001 }).domesticFundedProfit).toBeGreaterThan(0);
      expect(calculateCoveredParity({ ...inputs, forwardBid: r.lowerBound - .003, forwardSpread: .002 }).foreignFundedProfit).toBeGreaterThan(0);
    }
  });
  test('reciprocal quotation reverses the currency roles and inverts the two bounds', () => {
    const r = calculateCoveredParity(base);
    const reverse = calculateCoveredParity({ ...base, spot: 1 / base.spot, domesticRate: base.foreignRate, foreignRate: base.domesticRate,
      spotBid: 1 / base.spotAsk, spotAsk: 1 / base.spotBid,
      domesticDepositRate: base.foreignDepositRate, domesticBorrowRate: base.foreignBorrowRate,
      foreignDepositRate: base.domesticDepositRate, foreignBorrowRate: base.domesticBorrowRate,
      forwardBid: 1 / r.forwardAsk, forwardSpread: 1 / base.forwardBid - 1 / r.forwardAsk });
    expect(reverse.parityForward).toBeCloseTo(1 / r.parityForward, 12);
    expect(reverse.lowerBound).toBeCloseTo(1 / r.upperBound, 12);
    expect(reverse.upperBound).toBeCloseTo(1 / r.lowerBound, 12);
  });
  test('cash-flow amounts scale while rates and bounds stay unchanged', () => {
    const a = calculateCoveredParity(base), b = calculateCoveredParity({ ...base, amount: base.amount * 7 });
    expect(b.parityForward).toBe(a.parityForward); expect(b.lowerBound).toBe(a.lowerBound); expect(b.upperBound).toBe(a.upperBound);
    for (const key of ['domesticFundedProfit','foreignFundedProfit','foreignFundedRepayment','domesticFundedProceeds'] as const) expect(b[key]).toBeCloseTo(7 * a[key], 6);
  });
  test('the declared basis leg changes both sign and magnitude', () => {
    const bf = 1.2 * 1.05 / 1.23 - 1.03, bd = 1.23 / 1.2 * 1.03 - 1.05;
    expect(bf * 10000).toBeCloseTo(-56.09756097560953, 9); expect(bd * 10000).toBeCloseTo(57.5, 9);
    expect(1.2 * 1.05 / (1.03 + bf)).toBeCloseTo(1.23, 12);
    expect(1.2 * (1.05 + bd) / 1.03).toBeCloseTo(1.23, 12);
  });
  test('invalid author quotes, funding assumptions and labels fail before hooks', () => {
    for (const change of [{ amount: 0 }, { spot: 0 }, { spotBid: 1.3 }, { foreignDepositRate: .05 }, { domesticBorrowRate: .01 }, { forwardSpread: -.01 }, { forwardBid: NaN }]) expect(() => calculateCoveredParity({ ...base, ...change })).toThrow('CoveredParityRoutes');
    expect(() => renderToStaticMarkup(createElement(CoveredParityRoutes, { spotBid: 1.3 }))).toThrow('spotBid');
    expect(() => renderToStaticMarkup(createElement(CoveredParityRoutes, { title: '' }))).toThrow('title');
    expect(() => renderToStaticMarkup(createElement(CoveredParityRoutes, { domesticCurrency: 'EUR' }))).toThrow('currency codes');
  });
});
