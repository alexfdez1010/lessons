import { describe, expect, test } from 'bun:test';
import { BopAccountBridge, ExternalPositionBridge, calculateBopAccounts, calculateExternalPosition } from '@/components/react/ExternalAccountsBridge';
const base = { exports: 120, imports: 150, earnedIncome: -4, transfers: 4, capital: 2, assets: 12, liabilities: 40 };
describe('external account sign convention', () => {
  test('current, capital and financial measures agree without a residual', () => {
    expect(calculateBopAccounts(base)).toEqual({ trade: -30, current: -30, resources: -28, financial: -28, discrepancy: 0, netInward: 28 });
  });
  test('independent measurements create an explicit, correctly signed residual', () => {
    const r = calculateBopAccounts({ ...base, liabilities: 38 });
    expect(r.discrepancy).toBe(2);
    expect(r.resources + r.discrepancy).toBe(r.financial);
    const changed = calculateBopAccounts({ ...base, exports: 125 });
    expect(changed.discrepancy).toBe(-5);
    expect(changed.financial).toBe(-28);
  });
  test('agreed debt forgiveness reduces liabilities without a cash receipt', () => {
    const r = calculateBopAccounts({ exports: 0, imports: 0, earnedIncome: 0, transfers: 0, capital: 2, assets: 0, liabilities: -2 });
    expect(r.resources).toBe(2); expect(r.financial).toBe(2); expect(r.discrepancy).toBe(0);
  });
  test('gross financial flows can rise together without changing the net measure', () => {
    expect(calculateBopAccounts({ ...base, assets: 112, liabilities: 140 })).toEqual(calculateBopAccounts(base));
    expect(calculateBopAccounts({ ...base, assets: -10, liabilities: 18 }).financial).toBe(-28);
  });
  test('valuation is separate from transactions in the stock bridge', () => {
    expect(calculateExternalPosition({ opening: -100, transactions: -28, valuation: 10, other: -2 })).toEqual({ closing: -120, change: -20 });
    expect(calculateExternalPosition({ opening: -100, transactions: -28, valuation: 30, other: -2 })).toEqual({ closing: -100, change: 0 });
  });
  test('author guards reject nonfinite, unsupported and malformed inputs before hooks', () => {
    expect(() => calculateBopAccounts({ ...base, exports: -1 })).toThrow('BopAccountBridge');
    expect(() => calculateBopAccounts({ ...base, assets: Number.NaN })).toThrow('BopAccountBridge');
    expect(() => BopAccountBridge({ imports: -1 })).toThrow('BopAccountBridge');
    expect(() => BopAccountBridge({ view: 'unknown' as 'current' })).toThrow('BopAccountBridge');
    expect(() => ExternalPositionBridge({ valuation: Number.POSITIVE_INFINITY })).toThrow('ExternalPositionBridge');
    expect(() => calculateExternalPosition({ opening: -100, transactions: 0, valuation: 1001, other: 0 })).toThrow('ExternalPositionBridge');
  });
});
