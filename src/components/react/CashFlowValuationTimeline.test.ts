import { describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CashFlowValuationTimeline, valueCashFlowStream, valueDatedCashFlow } from '@/components/react/CashFlowValuationTimeline';

const receipts = [{ label: 'First', time: 1, amount: 110 }, { label: 'Second', time: 2, amount: 242 }];

describe('dated cash-flow valuation', () => {
  it('converts each flow to the common date before adding', () => {
    expect(valueCashFlowStream(receipts, 0, 0.1)).toBeCloseTo(300, 10);
    expect(valueCashFlowStream(receipts, 2, 0.1)).toBeCloseTo(363, 10);
    expect(valueCashFlowStream(receipts, 2, 0.1)).toBeCloseTo(valueCashFlowStream(receipts, 0, 0.1) * 1.1 ** 2, 10);
  });
  it('preserves signs, zero-rate amounts and payments on the valuation date', () => {
    expect(valueDatedCashFlow(-110, 1, 0, 0.1)).toBeCloseTo(-100, 10);
    expect(valueDatedCashFlow(242, 2, 2, 0.1)).toBe(242);
    expect(valueCashFlowStream(receipts, 0, 0)).toBe(352);
    expect(valueCashFlowStream(receipts.map((flow) => ({ ...flow, amount: -flow.amount })), 0, 0.1)).toBeCloseTo(-300, 10);
  });
  it('values ordinary and due schedules at the same present and future dates', () => {
    const ordinary = [1, 2, 3].map((time) => ({ label: String(time), time, amount: 100 }));
    const due = ordinary.map((flow) => ({ ...flow, time: flow.time - 1 }));
    expect(valueCashFlowStream(ordinary, 0, 0.1)).toBeCloseTo(331000 / 1331, 10);
    expect(valueCashFlowStream(due, 0, 0.1)).toBeCloseTo(33100 / 121, 10);
    expect(valueCashFlowStream(ordinary, 3, 0.1)).toBeCloseTo(331, 10);
    expect(valueCashFlowStream(due, 3, 0.1)).toBeCloseTo(364.1, 10);
  });
  it('rejects invalid mathematical inputs', () => {
    expect(() => valueDatedCashFlow(100, 1, 0, -1)).toThrow('above -100%');
    expect(() => valueDatedCashFlow(Infinity, 1, 0, 0.1)).toThrow('finite');
  });
});

describe('CashFlowValuationTimeline rendering guards and fallback', () => {
  const render = (overrides: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(CashFlowValuationTimeline, { flows: receipts, maxDate: 2, ...overrides }));
  it('fails rendering for malformed authored input', () => {
    expect(() => render({ flows: [] })).toThrow('one to eight');
    expect(() => render({ flows: [{ label: 'Bad date', time: 3, amount: 10 }] })).toThrow('within the timeline');
    expect(() => render({ flows: [{ label: '', time: 1, amount: 10 }] })).toThrow('every flow');
    expect(() => render({ rate: 0.5 })).toThrow('zero and 20%');
    expect(() => render({ valuationDate: -1 })).toThrow('dates must');
  });
  it('server-renders the calculation and localized controls without hydration', () => {
    const html = render({ title: 'Flujos', rateLabel: 'Tipo supuesto', totalLabel: 'Suma', locale: 'es-ES', currency: 'EUR' });
    expect(html).toContain('Tipo supuesto');
    expect(html).toContain('Suma');
    expect(html).toContain('<table tabindex="0"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('300,00');
    expect(html).not.toContain('NaN');
  });
});
