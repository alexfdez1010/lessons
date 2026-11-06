import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculatePerpetuitySeries, PerpetuityConvergence, type PerpetuitySeriesInput } from '@/components/react/PerpetuityConvergence';

const base: PerpetuitySeriesInput = {
  payment: 100, discountRate: 0.1, growthRate: 0, firstPaymentAt: 1, payments: 30,
};
const model = (change: Partial<PerpetuitySeriesInput> = {}) => calculatePerpetuitySeries({ ...base, ...change });

describe('discounted perpetuity sums', () => {
  test('matches the independent finite level-annuity identity and its limit', () => {
    const result = model({ payments: 50 });
    expect(result.limit).toBeCloseTo(1000, 10);
    expect(result.subtotal).toBeCloseTo(100 / 0.1 * (1 - 1.1 ** -50), 9);
    expect(result.rows[0]?.presentValue).toBeCloseTo(100 / 1.1, 10);
    expect(result.rows[49]?.year).toBe(50);
  });

  test('matches the growing geometric-sum identity', () => {
    const result = model({ discountRate: 0.08, growthRate: 0.03, payments: 60 });
    expect(result.limit).toBeCloseTo(2000, 9);
    const ratio = 1.03 / 1.08;
    expect(result.subtotal).toBeCloseTo(2000 * (1 - ratio ** 60), 8);
    expect(result.rows[1]?.cashFlow).toBeCloseTo(103, 10);
    expect(result.rows[2]?.cashFlow).toBeCloseTo(106.09, 10);
  });

  test('discounts every term and the limit by the same delay factor', () => {
    const ordinary = model();
    const delayed = model({ firstPaymentAt: 3 });
    expect(delayed.limit).toBeCloseTo(1000 / 1.1 ** 2, 10);
    expect(delayed.subtotal / ordinary.subtotal).toBeCloseTo(1 / 1.1 ** 2, 12);
    expect(delayed.rows[0]?.presentValue).toBeCloseTo(100 / 1.1 ** 3, 10);
  });

  test('delaying a growing stream does not silently grow the first actual payment', () => {
    const ordinary = model({ discountRate: 0.08, growthRate: 0.03 });
    const delayed = model({ discountRate: 0.08, growthRate: 0.03, firstPaymentAt: 3 });
    expect(delayed.rows[0]?.cashFlow).toBe(100);
    expect(delayed.rows[1]?.cashFlow).toBeCloseTo(103, 10);
    expect(delayed.limit).toBeCloseTo(2000 / 1.08 ** 2, 9);
    expect(delayed.subtotal / ordinary.subtotal).toBeCloseTo(1 / 1.08 ** 2, 12);
  });

  test('positive partial sums increase toward a valid limit and preserve the remainder', () => {
    let prior = 0;
    for (let payments = 1; payments <= 100; payments++) {
      const result = model({ discountRate: 0.08, growthRate: 0.03, payments });
      expect(result.subtotal).toBeGreaterThan(prior);
      expect(result.subtotal).toBeLessThan(result.limit!);
      expect(result.subtotal + result.tail!).toBeCloseTo(result.limit!, 8);
      prior = result.subtotal;
    }
  });

  test('scales every value with the first payment', () => {
    const single = model({ discountRate: 0.08, growthRate: 0.03 });
    const double = model({ payment: 200, discountRate: 0.08, growthRate: 0.03 });
    expect(double.subtotal).toBeCloseTo(single.subtotal * 2, 10);
    expect(double.limit).toBeCloseTo(single.limit! * 2, 10);
    expect(double.rows[5]?.presentValue).toBeCloseTo(single.rows[5]!.presentValue * 2, 10);
  });
});

describe('valid nonconvergent states and zero rates', () => {
  test('zero growth and zero discount give a finite N times payment, not an infinite value', () => {
    const result = model({ discountRate: 0, payments: 7 });
    expect(result.subtotal).toBe(700);
    expect(result.ratio).toBe(1);
    expect(result.limit).toBeNull();
    expect(result.tail).toBeNull();
  });

  test('equal positive rates produce equal discounted payments', () => {
    const result = model({ discountRate: 0.08, growthRate: 0.08, payments: 10 });
    expect(result.limit).toBeNull();
    expect(result.subtotal).toBeCloseTo(10 * 100 / 1.08, 9);
    for (const row of result.rows) expect(row.presentValue).toBeCloseTo(100 / 1.08, 9);
  });

  test('growth above discount has positive finite partial sums and no negative formula value', () => {
    const result = model({ discountRate: 0.05, growthRate: 0.08 });
    expect(result.limit).toBeNull();
    expect(result.ratio).toBeGreaterThan(1);
    expect(result.rows[1]!.presentValue).toBeGreaterThan(result.rows[0]!.presentValue);
    expect(Number.isFinite(result.subtotal)).toBe(true);
  });

  test('a declining positive stream can converge even with zero discount', () => {
    const result = model({ discountRate: 0, growthRate: -0.05 });
    expect(result.limit).toBeCloseTo(2000, 10);
    expect(result.subtotal).toBeCloseTo(2000 * (1 - 0.95 ** 30), 9);
  });

  test('SSR explains nonconvergence without Infinity or NaN', () => {
    const html = renderToStaticMarkup(createElement(PerpetuityConvergence, {
      discountRate: 0, growthRate: 0, payments: 7,
    }));
    expect(html).toContain('No finite limit');
    expect(html).toContain('Growth and discounting cancel.');
    expect(html).toContain('700.00');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('NaN');
  });
});

describe('author guards', () => {
  test('rejects malformed numerical settings rather than silently displaying wrong charts', () => {
    for (const bad of [
      { payment: 0 }, { payment: Number.NaN }, { discountRate: -0.1 },
      { discountRate: Number.POSITIVE_INFINITY }, { growthRate: -1 },
      { firstPaymentAt: 0 }, { firstPaymentAt: 1.5 }, { payments: 0 }, { payments: 101 },
    ]) expect(() => model(bad)).toThrow('PerpetuityConvergence:');
  });

  test('rejects an empty accessible chart description during SSR', () => {
    expect(() => renderToStaticMarkup(createElement(PerpetuityConvergence, { chartLabel: '' })))
      .toThrow('chartLabel must be nonempty');
  });
});
