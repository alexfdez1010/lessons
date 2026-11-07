import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { LinkedDiscountFactors, calculateLinkedFactors, valueLinkedSchedule, calculateLinkedFlowPath } from '@/components/react/LinkedDiscountFactors';
const rates = [.05, -.1, .2], amounts = [-200, 21, 94.5, 113.4];
describe('Linked dated factors and external transfers', () => {
  test('annual factors chain through positive and negative periods', () => {
    const r = calculateLinkedFactors(rates);
    for (const [i, a] of [1, 1.05, .945, 1.134].entries()) { expect(r.accumulation[i]).toBeCloseTo(a, 14); expect(r.accumulation[i] * r.discount[i]).toBeCloseTo(1, 14); }
    expect(r.totalReturn).toBeCloseTo(.134, 14); expect(r.equivalentRate).toBeCloseTo(.04280799346593489, 14); expect(r.arithmeticRate).toBeCloseTo(.05, 14);
    expect(21 / (1 + r.equivalentRate)).toBeCloseTo(20.137935393267583, 12);
    expect(r.discount[2]).toBeGreaterThan(1);
  });
  test('each signed payment reaches the same valuation date before summing', () => {
    const today = valueLinkedSchedule(rates, amounts, 0), dateTwo = valueLinkedSchedule(rates, amounts, 2);
    expect(today.total).toBeCloseTo(20, 12); expect(dateTwo.total).toBeCloseTo(18.9, 12);
    for (const [i, v] of [-200, 20, 100, 100].entries()) expect(today.rows[i].value).toBeCloseTo(v, 12);
    for (const [i, v] of [-189, 18.9, 94.5, 94.5].entries()) expect(dateTwo.rows[i].value).toBeCloseTo(v, 12);
    expect(valueLinkedSchedule(rates, amounts, 3).total).toBeCloseTo(22.68, 12);
    expect(valueLinkedSchedule([-.5, -.5, -.5], [0, 0, 0, 1e-323], 3).rows[3].value).toBe(1e-323);
    expect(() => valueLinkedSchedule([.5, .5, .5], [0, 0, 0, Number.MIN_VALUE], 0)).toThrow('underflows');
    expect(() => calculateLinkedFlowPath(Array(12).fill(-.95), 1e-320, 0)).toThrow('underflows');
    expect(valueLinkedSchedule([-.5, -.5, -.5], [1e6, 1e-8, -250000, 0], 0).total).toBe(2e-8);
  });
  test('composition, reciprocity, flat-rate limit and endpoint equivalence hold', () => {
    for (const a of [-.5, -.1, 0, .05, .5]) for (const b of [-.5, -.1, 0, .2, .5]) for (const c of [-.5, -.1, 0, .2, .5]) {
      const rates = [a, b, c], r = calculateLinkedFactors(rates);
      expect((1 + r.equivalentRate) ** 3).toBeCloseTo(r.accumulation[3], 13);
      expect(calculateLinkedFactors([...rates].reverse()).accumulation[3]).toBeCloseTo(r.accumulation[3], 13);
      for (let s = 0; s <= 3; s++) for (let t = 0; t <= 3; t++) for (let u = 0; u <= 3; u++) {
        const st = r.accumulation[t] / r.accumulation[s], tu = r.accumulation[u] / r.accumulation[t];
        expect(st * tu).toBeCloseTo(r.accumulation[u] / r.accumulation[s], 12);
      }
      const zero = valueLinkedSchedule(rates, amounts, 0);
      for (let date = 0; date <= 3; date++) expect(valueLinkedSchedule(rates, amounts, date).total).toBeCloseTo(zero.total * r.accumulation[date], 10);
    }
    for (const r of [-.5, 0, .05, .5]) { const z = calculateLinkedFactors([r, r, r]); expect(z.equivalentRate).toBeCloseTo(r, 14); expect(z.accumulation[3]).toBeCloseTo((1 + r) ** 3, 14); }
    expect(calculateLinkedFactors([0, 0, 0]).discount).toEqual([1, 1, 1, 1]);
    expect(calculateLinkedFactors([1e-200, 1e-200, 1e-200]).equivalentRate).toBe(1e-200);
  });
  test('rate order changes only the dated transfer contribution to this endpoint', () => {
    for (const transfer of [-50, 0, 50, 100]) {
      const a = calculateLinkedFlowPath(rates, 100, transfer), b = calculateLinkedFlowPath([...rates].reverse(), 100, transfer);
      expect(a.terminal).toBeCloseTo(a.principalTerminal + a.flowTerminal, 12);
      expect(b.terminal).toBeCloseTo(b.principalTerminal + b.flowTerminal, 12);
      expect(a.principalTerminal).toBeCloseTo(b.principalTerminal, 12);
      expect(a.terminal - b.terminal).toBeCloseTo(transfer * (.9 * 1.2 - .9 * 1.05), 12);
      expect(a.funded && b.funded).toBe(true);
    }
    expect(calculateLinkedFlowPath(rates, 100, 50).terminal).toBeCloseTo(167.4, 12);
    expect(calculateLinkedFlowPath([...rates].reverse(), 100, 50).terminal).toBeCloseTo(160.65, 12);
    expect(calculateLinkedFlowPath(rates, 100, -50).terminal).toBeCloseTo(59.4, 12);
    expect(calculateLinkedFlowPath([...rates].reverse(), 100, -50).terminal).toBeCloseTo(66.15, 12);
    expect(calculateLinkedFlowPath([-.5, -.5, -.5], 100, -50).balances).toEqual([100, 0, 0, 0]);
    expect(calculateLinkedFlowPath([-.5], 100, -60).funded).toBe(false);
  });
  test('invalid authored controls fail before hooks, while zero rates and a funded zero balance render', () => {
    for (const props of [{ rates: [.055, -.1, .2] }, { rates: [-1, 0, 0] }, { valuationDate: .5 }, { flowFraction: .53 }, { amounts: [-200, 21, 94.5] }, { view: 'other' }]) expect(() => renderToString(createElement(LinkedDiscountFactors, props as never))).toThrow('LinkedDiscountFactors');
    for (const view of ['chain', 'discount', 'valuation', 'equivalent', 'flows'] as const) for (const rates of [[0, 0, 0], [-.5, -.5, -.5], [.5, .5, .5]] as [number, number, number][]) {
      const html = renderToString(createElement(LinkedDiscountFactors, { view, rates, flowFraction: -.5 })); expect(html).not.toMatch(/NaN|Infinity|undefined/); expect(html).toContain('tabindex="0"');
    }
    expect(() => calculateLinkedFactors([-1])).toThrow('positive');
    expect(() => valueLinkedSchedule(rates, amounts, 4)).toThrow('common date');
    expect(() => calculateLinkedFactors([])).toThrow('one to twelve');
  });
});
