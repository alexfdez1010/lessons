import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { calculateVisibleExecution, calculateSpreadRoundTrip, calculateQueueFill, calculateConditionalStop, validateVisibleBook, illustrativeOrderBids, illustrativeOrderAsks, OrderExecutionLab, type VisibleExecutionInputs } from '@/components/react/OrderExecutionLab';
const base: VisibleExecutionInputs = { side: 'buy', orderType: 'market', quantity: 500, limitPrice: 100.15, timeInForce: 'day', fee: 0, available: true, bids: illustrativeOrderBids, asks: illustrativeOrderAsks };
describe('Order instructions, quantity conservation and cash', () => {
  test('the fixed book gives weighted fills and distinct quote and midpoint comparisons', () => {
    const z = calculateVisibleExecution(base);
    expect(z.fills).toEqual([{ price: 100.1, quantity: 300 }, { price: 100.2, quantity: 200 }]);
    expect(z.principal).toBeCloseTo(50070, 10); expect(z.average).toBeCloseTo(100.14, 12); expect(z.quoteCost).toBeCloseTo(20, 10); expect(z.midpointCost).toBeCloseTo(70, 10);
    const sale = calculateVisibleExecution({ ...base, side: 'sell' });
    expect(sale.principal).toBeCloseTo(49940, 10); expect(sale.average).toBeCloseTo(99.88, 12); expect(sale.quoteCost).toBeCloseTo(10, 10); expect(sale.midpointCost).toBeCloseTo(60, 10);
    const noMatching = calculateVisibleExecution({ ...base, available: false });
    expect(noMatching.filled).toBe(0); expect(noMatching.pending).toBe(500); expect(noMatching.average).toBeNull(); expect(noMatching.chargedFee).toBe(0);
  });
  test('a limit bounds security fill prices, not the fee-inclusive per-share cash amount', () => {
    const z = calculateVisibleExecution({ ...base, quantity: 100, orderType: 'limit', limitPrice: 100.1, fee: 10 });
    expect(z.average).toBeCloseTo(100.1, 12); expect(z.cashFlow).toBeCloseTo(-10020, 10); expect(z.allInAverage).toBeCloseTo(100.2, 12); expect(z.allInAverage!).toBeGreaterThan(100.1);
    const sale = calculateVisibleExecution({ ...base, side: 'sell', quantity: 100, orderType: 'limit', limitPrice: 99.9, fee: 10 });
    expect(sale.average).toBeCloseTo(99.9, 12); expect(sale.allInAverage).toBeCloseTo(99.8, 12); expect(sale.allInAverage!).toBeLessThan(99.9);
    const missed = calculateVisibleExecution({ ...base, orderType: 'limit', limitPrice: 100.05, fee: 10 });
    expect(missed.filled).toBe(0); expect(missed.resting).toBe(500); expect(missed.chargedFee).toBe(0);
  });
  test('DAY, IOC and FOK differ on the same marketable limit and charge the declared fee once', () => {
    const input = { ...base, orderType: 'limit' as const, fee: 10 }, day = calculateVisibleExecution(input), ioc = calculateVisibleExecution({ ...input, timeInForce: 'ioc' }), fok = calculateVisibleExecution({ ...input, timeInForce: 'fok' });
    expect(day.filled).toBe(300); expect(day.resting).toBe(200); expect(day.cancelled).toBe(0);
    expect(ioc.filled).toBe(300); expect(ioc.cancelled).toBe(200); expect(ioc.resting).toBe(0); expect(ioc.cashFlow).toBeCloseTo(-30040, 10);
    expect(fok.filled).toBe(0); expect(fok.cancelled).toBe(500); expect(fok.principal).toBe(0); expect(fok.chargedFee).toBe(0);
    const full = calculateVisibleExecution({ ...input, quantity: 300, timeInForce: 'fok' }); expect(full.filled).toBe(300); expect(full.chargedFee).toBe(10);
  });
  test('the round trip costs one full spread and its relative return uses the purchase outlay', () => {
    const z = calculateSpreadRoundTrip(99.95, 100.05, 100, 0);
    expect(z.purchaseOutlay).toBe(10005); expect(z.netSale).toBe(9995); expect(z.pnl).toBeCloseTo(-10, 10); expect(z.entryMidCost).toBeCloseTo(5, 10); expect(z.exitMidCost).toBeCloseTo(5, 10);
    const small = calculateSpreadRoundTrip(4, 4.4, 100, 0); expect(small.returnOnOutlay).toBeCloseTo(-1 / 11, 14);
    const fee = calculateSpreadRoundTrip(99.95, 100.05, 100, 10); expect(fee.pnl).toBeCloseTo(-30, 10); expect(fee.entryMidCost + fee.exitMidCost).toBeCloseTo(-fee.pnl, 12);
    expect(calculateSpreadRoundTrip(100, 100, 100, 0).pnl).toBeCloseTo(0, 14);
  });
  test('a declared FIFO queue distinguishes a touched price from a fill', () => {
    expect(calculateQueueFill(400, 200, 150)).toEqual({ usedAhead: 150, filled: 0, remaining: 400, aheadRemaining: 50, incomingBeyondOrder: 0 });
    expect(calculateQueueFill(400, 200, 350)).toEqual({ usedAhead: 200, filled: 150, remaining: 250, aheadRemaining: 0, incomingBeyondOrder: 0 });
    for (let ahead = 0; ahead <= 1000; ahead += 50) for (let incoming = 0; incoming <= 3000; incoming += 50) {
      const z = calculateQueueFill(400, ahead, incoming);
      expect(z.filled + z.remaining).toBe(400); expect(z.usedAhead + z.filled + z.incomingBeyondOrder).toBe(incoming); expect(z.usedAhead + z.aheadRemaining).toBe(ahead);
      expect(z.filled).toBeGreaterThanOrEqual(0); expect(z.filled).toBeLessThanOrEqual(400);
    }
  });
  test('the selected trigger reference, monitoring eligibility and prior activation are separate from execution', () => {
    const input = { ...base, side: 'sell' as const, quantity: 100, stopPrice: 95, reference: 'last' as const, lastPrice: 96, monitoringEligible: true, previouslyTriggered: false, bids: [{ price: 94, quantity: 500 }], asks: [{ price: 94.2, quantity: 500 }] };
    expect(calculateConditionalStop(input).active).toBe(false);
    const quote = calculateConditionalStop({ ...input, reference: 'sideQuote' }); expect(quote.active).toBe(true); expect(quote.execution!.average).toBe(94);
    expect(calculateConditionalStop({ ...input, reference: 'sideQuote', monitoringEligible: false }).active).toBe(false);
    const gap = { ...input, lastPrice: 88, bids: [{ price: 88, quantity: 500 }], asks: [{ price: 88.2, quantity: 500 }] }, market = calculateConditionalStop(gap), limited = calculateConditionalStop({ ...gap, orderType: 'limit', limitPrice: 94 });
    expect(market.execution!.average).toBe(88); expect((100 - market.execution!.average!) * 100).toBe(1200); expect(limited.active).toBe(true); expect(limited.execution!.filled).toBe(0); expect(limited.execution!.resting).toBe(100);
    const unavailable = calculateConditionalStop({ ...gap, available: false }); expect(unavailable.active).toBe(true); expect(unavailable.execution!.filled).toBe(0); expect(unavailable.execution!.pending).toBe(100);
    const rebound = calculateConditionalStop({ ...input, lastPrice: 99, previouslyTriggered: true, monitoringEligible: false, bids: [{ price: 99, quantity: 500 }], asks: [{ price: 99.2, quantity: 500 }] });
    expect(rebound.conditionMet).toBe(false); expect(rebound.active).toBe(true); expect(rebound.execution!.average).toBe(99);
    const buy = calculateConditionalStop({ ...input, side: 'buy', stopPrice: 105, lastPrice: 108, bids: [{ price: 108, quantity: 500 }], asks: [{ price: 108.2, quantity: 500 }] }); expect(buy.active).toBe(true); expect(buy.execution!.cashFlow).toBeCloseTo(-10820, 10);
  });
  test('all fill and remainder quantities conserve the request across sides, price caps and availability', () => {
    for (const side of ['buy', 'sell'] as const) for (const orderType of ['market', 'limit'] as const) for (const timeInForce of ['day', 'ioc', 'fok'] as const) for (const available of [false, true]) for (const quantity of [100, 300, 500, 1500, 2000]) for (const limitPrice of [99.5, 99.9, 100.05, 100.15, 100.5]) {
      const z = calculateVisibleExecution({ ...base, side, orderType, timeInForce, available, quantity, limitPrice, fee: 10 });
      expect(z.filled + z.cancelled + z.resting + z.pending + z.outsideSnapshot).toBe(quantity);
      expect(z.filled).toBe(z.fills.reduce((a, p) => a + p.quantity, 0)); expect(z.chargedFee).toBe(z.filled ? 10 : 0);
      expect(z.cashFlow).toBeCloseTo(z.filled ? (side === 'buy' ? -z.principal - 10 : z.principal - 10) : 0, 8);
      if (orderType === 'limit') expect(z.fills.every(p => side === 'buy' ? p.price <= limitPrice : p.price >= limitPrice)).toBe(true);
      if (timeInForce === 'fok') expect(z.filled === 0 || z.filled === quantity).toBe(true);
      expect(Object.values(z).every(v => typeof v !== 'number' || Number.isFinite(v))).toBe(true);
    }
    const noAsks = calculateVisibleExecution({ ...base, asks: [] }); expect(noAsks.filled).toBe(0); expect(noAsks.bestPrice).toBeNull(); expect(noAsks.outsideSnapshot).toBe(500);
  });
  test('author grids and book structure reject invalid inputs before hooks while valid unavailable states render', () => {
    for (const props of [{ quantity: 150 }, { limitPrice: 100.12 }, { spreadWidth: .015 }, { sharesAhead: 125 }, { fee: .5 }, { stopPrice: 95.5 }, { available: 0 }]) expect(() => renderToString(createElement(OrderExecutionLab, props as never))).toThrow('OrderExecutionLab');
    expect(() => validateVisibleBook([{ price: 100, quantity: 10 }], [{ price: 99, quantity: 10 }])).toThrow('uncrossed');
    expect(() => validateVisibleBook([], [{ price: 100, quantity: 10 }, { price: 99, quantity: 10 }])).toThrow('ascending');
    for (const props of [{ view: 'spread', spreadWidth: 0 }, { view: 'book', available: false }, { view: 'book', orderType: 'limit', timeInForce: 'fok' }, { view: 'queue', incomingShares: 0 }, { view: 'stop', available: false }, { view: 'stop', previouslyTriggered: true, scenario: 'rebound' }, { view: 'stop', monitoringEligible: false }]) {
      const html = renderToString(createElement(OrderExecutionLab, props as never)); expect(html).not.toMatch(/NaN|Infinity/); expect(html).toContain('tabindex="0"');
    }
  });
});
