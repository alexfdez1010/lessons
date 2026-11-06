import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateRebalance, isRebalanceDue, RebalanceDrift } from '@/components/react/RebalanceDrift';
const base = { stock: 600, bonds: 400, stockReturn: .2, bondReturn: -.1, targetStock: .6 };
describe('RebalanceDrift arithmetic', () => {
  test('walks the worked example independently', () => {
    const m = calculateRebalance(base);
    expect(m.stock).toBe(720); expect(m.bonds).toBe(360); expect(m.total).toBe(1080);
    expect(m.stockWeight).toBeCloseTo(2 / 3, 12);
    expect(m.targetStockValue).toBe(648); expect(m.targetBondValue).toBe(432);
    expect(m.stockTrade).toBe(-72); expect(m.bondTrade).toBe(72);
    expect(m.bothLegNotional).toBe(144); expect(m.oneWayTurnover).toBeCloseTo(1 / 15, 12);
    expect(m.contribution).toEqual({ stock: 720, bonds: 480, total: 1200, outsideFlow: 120 });
    expect(m.withdrawal).toEqual({ stock: 540, bonds: 360, total: 900, outsideFlow: -180 });
  });
  test('all paths reach the same weight with their own conservation identities', () => {
    for (const stockReturn of [-.5, -.1, 0, .2, 1]) for (const bondReturn of [-.5, 0, .3, 1]) for (const targetStock of [.1, .4, .6, .9]) {
      const m = calculateRebalance({ ...base, stockReturn, bondReturn, targetStock });
      expect(m.stockTrade + m.bondTrade).toBeCloseTo(0, 10);
      expect(m.stock + m.stockTrade).toBeCloseTo(targetStock * m.total, 9);
      expect(m.bonds + m.bondTrade).toBeCloseTo((1 - targetStock) * m.total, 9);
      for (const path of [m.contribution, m.withdrawal]) {
        expect(path.total).toBeGreaterThan(0);
        expect(path.stock + path.bonds).toBeCloseTo(path.total, 9);
        expect(path.total - m.total).toBeCloseTo(path.outsideFlow, 9);
        expect(path.stock / path.total).toBeCloseTo(targetStock, 10);
      }
      expect(m.contribution.stock).toBeGreaterThanOrEqual(m.stock - 1e-9);
      expect(m.contribution.bonds).toBeGreaterThanOrEqual(m.bonds - 1e-9);
      expect(m.withdrawal.stock).toBeLessThanOrEqual(m.stock + 1e-9);
      expect(m.withdrawal.bonds).toBeLessThanOrEqual(m.bonds + 1e-9);
    }
  });
  test('already on target needs neither trades nor outside capital', () => {
    const m = calculateRebalance({ ...base, stockReturn: 0, bondReturn: 0 });
    expect(m.bothLegNotional).toBe(0); expect(m.contribution.outsideFlow).toBe(0); expect(m.withdrawal.outsideFlow).toBe(-0);
  });
  test('scaling preserves weights and turnover, scales amounts', () => {
    const a = calculateRebalance(base); const b = calculateRebalance({ ...base, stock: 60000, bonds: 40000 });
    expect(b.stockWeight).toBe(a.stockWeight); expect(b.oneWayTurnover).toBeCloseTo(a.oneWayTurnover, 12);
    expect(b.bothLegNotional).toBe(a.bothLegNotional * 100);
    expect(b.contribution.outsideFlow).toBeCloseTo(a.contribution.outsideFlow * 100, 8);
  });
  test('rejects author inputs outside the supported long-only model', () => {
    for (const patch of [{ stock: 0 }, { bonds: Infinity }, { stockReturn: -1 }, { bondReturn: NaN }, { targetStock: 0 }, { targetStock: 1 }])
      expect(() => calculateRebalance({ ...base, ...patch })).toThrow('RebalanceDrift');
    expect(() => renderToStaticMarkup(createElement(RebalanceDrift, { stock: 0 }))).toThrow('stock');
    expect(() => renderToStaticMarkup(createElement(RebalanceDrift, { title: '' }))).toThrow('title');
  });
});
describe('policy triggers', () => {
  test('separates date from drift and specifies equality', () => {
    expect(isRebalanceDue('calendar', false, .1, .05)).toBe(false);
    expect(isRebalanceDue('calendar', true, 0, .05)).toBe(true);
    expect(isRebalanceDue('threshold', false, -.05, .05)).toBe(true);
    expect(isRebalanceDue('threshold', true, .049, .05)).toBe(false);
    expect(isRebalanceDue('combined', false, .1, .05)).toBe(false);
    expect(isRebalanceDue('combined', true, .05, .05)).toBe(true);
    expect(isRebalanceDue('combined', true, .01, .05)).toBe(false);
    expect(() => isRebalanceDue('threshold', true, 0, -.1)).toThrow('band');
  });
});
