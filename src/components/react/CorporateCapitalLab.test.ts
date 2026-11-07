import { describe, test, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { capitalWaterfall, safeRecapitalisation, riskyCapitalReturns, financingSources, cashOpportunity, financingReplica, noTaxCapitalCost, currentInterestShield, datedCapitalShields, adjustedCapitalValue, matchedPerpetualWacc, discreteCapitalTradeoff, constrainedCorporateFunding, issuePriceTransfer, capitalTargetAdjustment, incentivePayoffs, assertCorporateNativeInputs, CorporateCapitalLab } from '@/components/react/CorporateCapitalLab';
const close = (a: number, b: number, tolerance = 2e-11) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance * Math.max(1, Math.abs(b)));

describe('Corporate financing with explicit dated budgets and claim assumptions', () => {
 test('A senior waterfall conserves resources and never charges costs outside default', () => {
  for (let a = 0; a <= 200; a += 10) for (let f = 0; f <= 200; f += 10) for (let c = 0; c <= 40; c += 5) {
   const x = capitalWaterfall(a, f, c); close(x.residual, 0); expect(x.debtPaid).toBeGreaterThanOrEqual(0); expect(x.equityPaid).toBeGreaterThanOrEqual(0); expect(x.debtPaid).toBeLessThanOrEqual(f); expect(x.defaulted).toBe(a < f); if (a >= f) expect(x.defaultCost).toBe(0);
  }
  expect(capitalWaterfall(0, 100, 40).debtPaid).toBe(0); expect(capitalWaterfall(100, 100, 40).debtPaid).toBe(100);
 });
 test('A fully funded recap changes the residual, not operating value or the repurchase budget', () => {
  for (let d = 0; d <= 800; d += 100) for (let e = 0; e <= 200; e += 20) {
   const x = safeRecapitalisation(d, e); close(x.debt + x.equityValue, 1000); close(x.sharesRepurchased * 10, d); close(x.sharesRemaining + x.sharesRepurchased, 100); close(x.debtCash + x.equityCash, x.assetCash); expect(x.equityCash).toBeGreaterThanOrEqual(0); close(x.leveredEps / 10 * 100, x.equityReturnPct);
  }
  close(safeRecapitalisation(400, 100).leveredEps, 4 / 3); close(safeRecapitalisation(400, 40).leveredEps, 1 / 3); close(safeRecapitalisation(400, 50).leveredEps, .5);
 });
 test('Promised debt yield differs from expected received return under physical default risk', () => {
  const x = riskyCapitalReturns(); close(x.expectedDebtCash, 90); close(x.expectedEquityCash, 30); close(x.promisedYieldPct, 25); close(x.expectedDebtReturnPct, 12.5); close(x.expectedEquityReturnPct, 50); close(.8 * x.expectedDebtReturnPct + .2 * x.expectedEquityReturnPct, 20);
  close(.5 * x.states[0].debtPaid + .5 * x.states[1].debtPaid, 80); close(.5 * x.states[0].equityPaid + .5 * x.states[1].equityPaid, 20);
  for (let c = 0; c <= 40; c += 5) { const s = riskyCapitalReturns(c); close(s.expectedDistributed + s.expectedLoss, 120); close(s.expectedDebtCash, 90 - .25 * c); close(s.expectedEquityCash, 30); }
 });
 test('Gross issuance, fee and project sources/uses reconcile, including no external equity', () => {
  for (let d = 0; d <= 240; d += 10) for (let f = 0; f <= 10; f++) { const x = financingSources(d, f / 100); close(x.residual, 0); close(x.grossEquity * (1 - f / 100), x.netEquity); close(x.grossSources, x.grossUses); expect(x.netEquity).toBeGreaterThanOrEqual(0); }
  close(financingSources(150, .05).grossEquity, 1800 / 19); expect(financingSources(240, .1).grossEquity).toBe(0);
  close(cashOpportunity(.05).projectNpv, -50 / 11); close(cashOpportunity(.1).projectNpv, 0);
 });
 test('Homemade leverage requires matching borrowing terms and replicates in each state', () => {
  for (const a of [1000, 1040, 1100, 1160, 1200]) for (const rate of [.05, .06, .08, .1]) { const x = financingReplica(rate, a); close(x.homemadeCost, x.directCost); close(x.payoffDifference, -40 * (rate - .05)); close(x.reverseCost, x.assetPurchase); close(x.reverseTotalReceipt, x.unleveredReceipt); if (rate === .05) close(x.homemadePayoff, x.directPayoff); }
  close(financingReplica(.08).personalRepayment, 43.2); close(financingReplica(.08).payoffDifference, -1.2);
 });
 test('MM no-tax equity risk offsets the changing market debt weight', () => {
  for (let d = 0; d <= 800; d += 100) { const x = noTaxCapitalCost(d); close(x.noTaxWaccPct, 10); close(x.equityWeightPct + x.debtWeightPct, 100); close(x.equityRatePct, 10 + d / (1000 - d) * 5); }
  close(noTaxCapitalCost(400).equityRatePct, 40 / 3);
 });
 test('A current interest deduction cannot save tax absent current capacity in this model', () => {
  for (let e = 0; e <= 100; e += 5) for (let t = 0; t <= 40; t += 5) { const x = currentInterestShield(e, t / 100); close(x.usableShield, t / 100 * Math.min(e, 20)); close(x.usableShield + x.unusableCurrentShield, x.potentialShield); }
  expect(currentInterestShield(0, .25).usableShield).toBe(0); close(currentInterestShield(10, .25).usableShield, 2.5); close(currentInterestShield(20, .25).usableShield, 5);
 });
 test('Finite shields use their own annual dates, and APV charges costs once', () => {
  for (let r = 0; r <= 10; r++) { const x = datedCapitalShields(r / 100); close(x.totalShield, 11.25); close(x.shieldPv, 5 / (1 + r / 100) + 3.75 / (1 + r / 100) ** 2 + 2.5 / (1 + r / 100) ** 3); const a = adjustedCapitalValue(r / 100, 3, 8); close(a.leveredValue, 1000 + x.shieldPv - 11); }
  close(datedCapitalShields(0).shieldPv, 11.25);
 });
 test('Matched perpetual APV and after-tax WACC agree under exactly the stated policy', () => {
  const x = matchedPerpetualWacc(); close(x.baseValue, 900); close(x.shieldPv, 100); close(x.leveredValue, 1000); close(x.equityValue, 600); close(x.equityRatePct, 12); close(x.afterTaxWaccPct, 8.7); close(x.waccValue, 1000); close(x.doubleCountedValue, 1100);
 });
 test('A discrete best alternative is not a continuous optimum; ties stay visible', () => {
  expect(discreteCapitalTradeoff(1).bestDebt).toEqual([200]); expect(discreteCapitalTradeoff(0).bestDebt).toEqual([600]); expect(discreteCapitalTradeoff(2).bestDebt).toEqual([200]); expect(discreteCapitalTradeoff(.5).bestDebt).toEqual([400, 600]);
 });
 test('Covenant headroom, net financing and principal-inclusive cash cover stay separate', () => {
  for (let e = 60; e <= 140; e += 10) for (let f = 0; f <= 10; f++) { const x = constrainedCorporateFunding(e, f / 100); expect(x.totalDebt).toBeLessThanOrEqual(x.maximumDebt); close(x.newDebt + x.unusedDebtHeadroom, x.debtHeadroom); close(x.residual, 0); close(x.debtService, x.annualInterest + 40); expect(x.netEquity).toBeGreaterThanOrEqual(0); }
  const x = constrainedCorporateFunding(100, .05); close(x.debtHeadroom, 150); close(x.netEquity, 90); close(x.ebitdaInterestCoverage, 40 / 7); close(x.cashDebtServiceCoverage, 36 / 23); close(constrainedCorporateFunding(80, .05).netEquity, 160);
 });
 test('Scenario issue transfers and target adjustments preserve all cash and claims', () => {
  for (let p = 5; p <= 15; p += .5) { const x = issuePriceTransfer(p); close(x.oldClaim + x.newClaim, 1000); close(x.transferResidual, 0); close(x.newShares * p, 100); }
  close(issuePriceTransfer(9).oldWealthChange, 0); close(issuePriceTransfer(8).oldClaim, 8000 / 9);
  for (let shock = -40; shock <= 40; shock += 10) { const x = capitalTargetAdjustment(shock / 100); close(x.finalDebtWeightPct, 40); close(x.oldOwnerWealthAfter, x.oldEquity); close(x.oldDebt - x.debtRetired + x.newDebtRaised, x.targetDebt); close(x.outsideEquity, x.debtRetired); close(x.distribution, x.newDebtRaised); }
  close(capitalTargetAdjustment(-.2).outsideEquity, 80); close(capitalTargetAdjustment(.2).distribution, 80);
  for (const k of ['overhang', 'riskshift'] as const) { const x = incentivePayoffs(k); close(x.equityNetGain + x.debtGain, x.projectNpv); }
 });
 test('Continuous helper invalid domains and almost-native author values are rejected explicitly', () => {
  for (const v of [{ debt: 500 + 1e-10 }, { newDebt: Number.MIN_VALUE }, { issuePrice: 8.000000000000002 }, { assetCash: NaN }, { __proto__: null, toString: 0 }]) expect(() => assertCorporateNativeInputs(v as any)).toThrow('CorporateCapitalLab');
  for (const f of [() => capitalWaterfall(-1, 100), () => safeRecapitalisation(1000), () => financingSources(241, 0), () => financingReplica(.04), () => datedCapitalShields(Infinity), () => currentInterestShield(10, .5), () => issuePriceTransfer(0), () => capitalTargetAdjustment(.5)]) expect(f).toThrow('CorporateCapitalLab');
 });
 test('All native authored points SSR as raw inputs with finite accessible complete tables', () => {
  const cases = [['claims', 'assetCash', 0, 1200, 10], ['claims', 'promise', 0, 1200, 10], ['claims', 'defaultCost', 0, 40, 5], ['sources', 'newDebt', 0, 240, 10], ['sources', 'feePct', 0, 10, 1], ['cash', 'projectRatePct', 0, 20, 1], ['leverage', 'debt', 0, 800, 100], ['leverage', 'ebit', 0, 200, 20], ['replica', 'personalRatePct', 5, 10, 1], ['shield', 'taxEbit', 0, 100, 5], ['shield', 'taxPct', 0, 40, 5], ['schedule', 'shieldRatePct', 0, 10, 1], ['apv', 'issueCost', 0, 10, 1], ['apv', 'distressPv', 0, 80, 2], ['tradeoff', 'costScalePct', 0, 200, 25], ['budget', 'ebitda', 60, 140, 10], ['issue', 'issuePrice', 5, 15, .5], ['target', 'shockPct', -40, 40, 10]] as const;
  let count = 0;
  for (const [view, key, min, max, step] of cases) for (let i = 0; i <= Math.round((max - min) / step); i++) { const value = min + i * step; const s = renderToString(createElement(CorporateCapitalLab, { view, initial: { [key]: value } })); const tag = s.match(new RegExp(`<input[^>]*data-control="${key}"[^>]*>`))?.[0]; expect(tag).toBeDefined(); expect(Number(tag?.match(/value="([^"]+)"/)?.[1])).toBe(value); expect(s).not.toMatch(/NaN|Infinity|<th[^>]*><\/th>/); expect(s).toContain('tabindex="0"'); expect(s).toContain('aria-live="polite"'); count++; }
  expect(count).toBe(475);
  for (const view of ['default', 'distress', 'incentives', 'reverse', 'cost', 'wacc', 'coverage'] as const) expect(renderToString(createElement(CorporateCapitalLab, { view }))).not.toMatch(/NaN|Infinity|<th[^>]*><\/th>/);
  expect(() => renderToString(createElement(CorporateCapitalLab, { initial: { debt: 500 + 1e-10 } }))).toThrow('CorporateCapitalLab');
 });
});
