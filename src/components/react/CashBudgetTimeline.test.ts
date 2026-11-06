import { expect, test } from 'bun:test';
import { CashBudgetTimeline, calculateCashBudget } from '@/components/react/CashBudgetTimeline';
const base = { openingCash: 300, reserve: 0, income: 1800, incomeDay: 25, payments: [{ day: 3, amount: 1200 }, { day: 10, amount: 400 }, { day: 28, amount: 100 }], horizon: 30, shockAmount: 0, shockDay: 12 };
test('positive period flow and closing cash do not eliminate an earlier funding gap', () => {
 const r = calculateCashBudget(base);
 expect(r.rows.map(row => row.balance)).toEqual([-900, -1300, 500, 400]);
 expect(r.closing).toBe(400); expect(r.netFlow).toBe(100); expect(r.minimum).toBe(-1300); expect(r.requiredReserve).toBe(1300); expect(r.firstShortfallDay).toBe(3);
});
test('moving the receipt earlier changes the path while retaining the same total', () => {
 const r = calculateCashBudget({ ...base, incomeDay: 2 });
 expect(r.closing).toBe(400); expect(r.minimum).toBe(300); expect(r.requiredReserve).toBe(0); expect(r.firstShortfallDay).toBeNull();
});
test('income after the horizon is excluded rather than counted as available', () => {
 const r = calculateCashBudget({ ...base, incomeDay: 31 });
 expect(r.incomeOutsideHorizon).toBe(true); expect(r.inflows).toBe(0); expect(r.closing).toBe(-1400); expect(r.minimum).toBe(-1400);
});
test('an existing reserve shifts every balance and is not an income receipt', () => {
 const r = calculateCashBudget({ ...base, reserve: 1300 });
 expect(r.opening).toBe(1600); expect(r.minimum).toBe(0); expect(r.closing).toBe(1700); expect(r.inflows).toBe(1800); expect(r.netFlow).toBe(100); expect(r.requiredReserve).toBe(1300); expect(r.additionalCashNeeded).toBe(0);
});
test('combined timing and extra-payment stress can exhaust a base-case reserve', () => {
 const r = calculateCashBudget({ ...base, incomeDay: 30, shockAmount: 600, reserve: 1300 });
 expect(r.minimum).toBe(-700); expect(r.requiredReserve).toBe(2000); expect(r.additionalCashNeeded).toBe(700); expect(r.closing).toBe(1100);
 const covered = calculateCashBudget({ ...base, incomeDay: 30, shockAmount: 600, reserve: 2000 });
 expect(covered.minimum).toBe(0); expect(covered.closing).toBe(1800);
});
test('same-day payments precede income and can create an intraday requirement', () => {
 const r = calculateCashBudget({ ...base, incomeDay: 3 });
 expect(r.rows.slice(0, 2).map(row => row.kind)).toEqual(['payment', 'income']); expect(r.minimum).toBe(-900); expect(r.closing).toBe(400);
});
test('cent arithmetic avoids repeated fractional-currency drift', () => {
 const r = calculateCashBudget({ ...base, openingCash: .3, income: .2, incomeDay: 1, payments: [{ day: 2, amount: .1 }, { day: 3, amount: .2 }] });
 expect(r.closing).toBe(.2); expect(r.rows.at(-1)?.balance).toBe(.2); expect(r.netFlow).toBe(-.1);
 expect(calculateCashBudget({ ...base, openingCash: .1, reserve: .2 }).opening).toBe(.3);
});
test('bad author inputs and mismatched accessible labels fail before hooks', () => {
 expect(() => CashBudgetTimeline({ incomeDay: 0 })).toThrow('CashBudgetTimeline');
 expect(() => CashBudgetTimeline({ paymentLabels: ['Only one'] })).toThrow('CashBudgetTimeline');
 expect(() => calculateCashBudget({ ...base, reserve: Number.NaN })).toThrow('CashBudgetTimeline');
 expect(() => calculateCashBudget({ ...base, payments: [{ day: 31, amount: 20 }] })).toThrow('CashBudgetTimeline');
 expect(() => calculateCashBudget({ ...base, openingCash: .001 })).toThrow('CashBudgetTimeline');
});
