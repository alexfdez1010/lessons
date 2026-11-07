import { describe, test, expect } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { calculateCdsQuote, calculateCashCarry, calculateCreditRecovery, calculateBasisExit, CdsQuoteBridge, CashCdsCarry, CreditRecoveryBridge, BasisExitApproximation } from '@/components/react/CashCreditBasis';

const carry = { notional: 1e6, referenceRate: .03, cashSpreadBp: 200, cdsSpreadBp: 150, fundingPremiumBp: 30, haircut: 0, equityHurdle: .06 };
const recovery = { notional: 1e6, bondRecovery: .35, auctionRecovery: .4, premiumBp: 150, premiumAccrualDays: 30, settlementDelayDays: 30, fundingRate: .033 };
const exit = { cashCs01: 400, cdsCs01: 400, residualRateDv01: 400, cashSpreadChangeBp: 100, cdsSpreadChangeBp: 60, rateChangeBp: 0, earnedCarry: 2000, exitCosts: 2000 };
describe('Declared cash credit and CDS conventions', () => {
  test('clean upfront closes the PV difference and coupon does not replace par spread in the basis', () => {
    const q = { notional: 1e6, parSpreadBp: 150, couponBp: 100, riskyAnnuity: 4, cashSpreadBp: 200 }, a = calculateCdsQuote(q), b = calculateCdsQuote({ ...q, couponBp: 500 });
    expect(a.basisBp).toBe(-50); expect(a.upfront).toBe(20000); expect(a.annualCoupon).toBe(10000); expect(a.premiumPv + a.upfront).toBe(a.protectionPv); expect(b.upfront).toBe(-140000); expect(b.basisBp).toBe(-50); expect(b.premiumPv + b.upfront).toBe(b.protectionPv);
  });
  test('fully financed floating reference cancels only under the stated matching assumptions', () => {
    const a = calculateCashCarry(carry), b = calculateCashCarry({ ...carry, referenceRate: .08 });
    expect(a.coupon).toBe(50000); expect(a.financing).toBe(33000); expect(a.premium).toBe(15000); expect(a.cashCarry).toBe(2000); expect(a.basisBp).toBe(-50); expect(b.cashCarry).toBeCloseTo(a.cashCarry, 8); expect(a.equity).toBe(0);
  });
  test('negative quoted basis can coexist with negative financed carry', () => {
    const r = calculateCashCarry({ ...carry, fundingPremiumBp: 80 }); expect(r.basisBp).toBe(-50); expect(r.financing).toBe(38000); expect(r.cashCarry).toBe(-3000);
  });
  test('haircut needs equity and separates cash carry from an opportunity comparison', () => {
    const r = calculateCashCarry({ ...carry, haircut: .1 }); expect(r.debt).toBe(900000); expect(r.equity).toBe(100000); expect(r.cashCarry).toBe(5300); expect(r.opportunityCost).toBe(6000); expect(r.economicCarry).toBe(-700); expect(r.debt + r.equity).toBe(carry.notional);
  });
  test('matched recovery offsets principal at every recovery endpoint, before separate costs', () => {
    for (const fraction of [0, .4, 1]) { const r = calculateCreditRecovery({ ...recovery, bondRecovery: fraction, auctionRecovery: fraction, premiumAccrualDays: 0, settlementDelayDays: 0 }); expect(r.principalGap).toBeCloseTo(0, 8); expect(r.bond + r.protection).toBeCloseTo(1e6, 8); expect(r.partialResult).toBeCloseTo(0, 8); }
  });
  test('mismatched bond proceeds, premium accrual and delay are separate deductions', () => {
    const r = calculateCreditRecovery(recovery); expect(r.bond).toBe(350000); expect(r.protection).toBe(600000); expect(r.principalGap).toBe(-50000); expect(r.accruedPremium).toBe(1250); expect(r.delayFunding).toBeCloseTo(2712.3287671232874, 8); expect(r.partialResult).toBeCloseTo(-53962.32876712329, 8);
  });
  test('spread widening, rates and unequal sensitivities do not cancel by a basis label', () => {
    const a = calculateBasisExit(exit), b = calculateBasisExit({ ...exit, cdsSpreadChangeBp: 100 }), c = calculateBasisExit({ ...exit, cashSpreadChangeBp: 0, cdsSpreadChangeBp: 0, rateChangeBp: 50, earnedCarry: 0, exitCosts: 0 }), d = calculateBasisExit({ ...exit, cdsCs01: 300, cashSpreadChangeBp: 100, cdsSpreadChangeBp: 100 });
    expect(a.basisChangeBp).toBe(-40); expect(a.bond).toBe(-40000); expect(a.protection).toBe(24000); expect(a.approximateResult).toBe(-16000); expect(b.priceChange).toBe(0); expect(c.rates).toBe(-20000); expect(d.basisChangeBp).toBe(0); expect(d.priceChange).toBe(-10000);
  });
  test('author guards run during SSR and reject invalid math or missing localized arrays', () => {
    expect(() => renderToStaticMarkup(createElement(CashCdsCarry, { haircut: .8 }))).toThrow('CashCdsCarry'); expect(() => renderToStaticMarkup(createElement(CdsQuoteBridge, { riskyAnnuity: 0 }))).toThrow('CdsQuoteBridge'); expect(() => renderToStaticMarkup(createElement(CreditRecoveryBridge, { auctionRecovery: 1.2 }))).toThrow('CreditRecoveryBridge'); expect(() => renderToStaticMarkup(createElement(BasisExitApproximation, { exitCosts: -1 }))).toThrow('BasisExitApproximation'); expect(() => renderToStaticMarkup(createElement(CdsQuoteBridge, { labels: ['Missing four result labels'] }))).toThrow('CdsQuoteBridge'); expect(() => calculateCashCarry({ ...carry, notional: Number.NaN })).toThrow();
  });
});
