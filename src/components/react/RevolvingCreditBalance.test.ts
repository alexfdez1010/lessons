import { describe, expect, test } from 'bun:test';
import { simulateRevolvingCredit } from '@/components/react/RevolvingCreditBalance';
const base = { principal: 1000, monthlyRate: 0.02, fixedPayment: 50, monthlySpending: 0, months: 120 };

describe('revolving credit recurrence', () => {
  test('reproduces worked monthly rows and cents-rounded payoff totals', () => {
    const result = simulateRevolvingCredit(base);
    expect(result.fixed.rows[0]).toEqual({ month: 1, opening: 1000, interest: 20, spending: 0, payment: 50, closing: 970 });
    expect(result.fixed.rows[2].closing).toBe(908.19);
    expect(result.minimum.rows[2].closing).toBe(970.30);
    expect(result.fixed.payoffMonth).toBe(26);
    expect(result.fixed.totalInterest).toBe(289.88);
    expect(result.fixed.rows.at(-1)?.payment).toBe(39.88);
    expect(result.minimum.payoffMonth).toBe(74);
    expect(result.minimum.totalInterest).toBe(886.90);
    expect(result.minimum.rows.at(-1)?.payment).toBe(15.39);
  });
  test('caps the last payment, handles zero interest and reports a finite unresolved horizon', () => {
    const tiny = simulateRevolvingCredit({ ...base, principal: 20 });
    expect(tiny.minimum.rows[0].payment).toBe(20.40);
    expect(tiny.minimum.closingBalance).toBe(0);
    const free = simulateRevolvingCredit({ ...base, principal: 100, monthlyRate: 0 });
    expect(free.fixed.payoffMonth).toBe(2);
    expect(free.fixed.totalInterest).toBe(0);
    const limited = simulateRevolvingCredit({ ...base, months: 12 });
    expect(limited.minimum.payoffMonth).toBeNull();
    expect(limited.minimum.closingBalance).toBeGreaterThan(0);
    expect(limited.minimum.rows).toHaveLength(12);
  });
  test('captures new-spending offsets, below-minimum payments and ledger conservation', () => {
    const spending = simulateRevolvingCredit({ ...base, monthlySpending: 30 });
    expect(spending.fixed.closingBalance).toBe(1000);
    expect(spending.fixed.payoffMonth).toBeNull();
    const shortfall = simulateRevolvingCredit({ ...base, fixedPayment: 10, months: 1 });
    expect(shortfall.fixed.rows[0].closing).toBe(1010);
    expect(shortfall.fixed.belowMinimumMonths).toBe(1);
    for (const plan of [spending.fixed, spending.minimum]) {
      expect(plan.totalPayments + plan.closingBalance).toBeCloseTo(base.principal + plan.totalInterest + 30 * plan.rows.length, 6);
      expect(plan.rows.every((row) => row.closing >= 0 && row.payment <= row.opening + row.interest + row.spending)).toBe(true);
    }
  });
  test('rejects bad author inputs rather than running an unbounded projection', () => {
    for (const change of [{ principal: 0 }, { monthlyRate: NaN }, { monthlyRate: 0.051 }, { fixedPayment: 0 }, { monthlySpending: -1 }, { months: 121 }, { months: 2.5 }]) {
      expect(() => simulateRevolvingCredit({ ...base, ...change })).toThrow('RevolvingCreditBalance requires');
    }
  });
});
