import { describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModifiedDietzTimeline, calculateModifiedDietz } from '@/components/react/ModifiedDietzTimeline';
const base = { beginningValue: 100, endingValue: 130, duration: 30, flows: [{ label: 'In', time: 6, amount: 40 }, { label: 'Out', time: 24, amount: -20 }] };
describe('Modified Dietz weighted capital', () => {
  it('reconciles gain and separately weighted signed capital', () => {
    const r = calculateModifiedDietz(base);
    expect(r.gain).toBe(10);expect(r.netFlow).toBe(20);expect(r.capital).toBe(128);expect(r.rate).toBe(0.078125);
    expect(r.rows.map((flow) => flow.weight)).toEqual([0.8, 0.2]);expect(r.rows.map((flow) => flow.weightedAmount)).toEqual([32, -4]);
  });
  it('uses endpoint weights and preserves gain as flow timing changes', () => {
    const first = calculateModifiedDietz({ ...base, flows: [{ ...base.flows[0], time: 0 }, base.flows[1]] });
    const last = calculateModifiedDietz({ ...base, flows: [{ ...base.flows[0], time: 30 }, base.flows[1]] });
    expect(first.rows[0].weight).toBe(1);expect(last.rows[0].weight).toBe(0);expect(first.gain).toBe(last.gain);
    expect(first.capital).toBe(136);expect(last.capital).toBe(96);expect(first.rate!).toBeLessThan(last.rate!);
  });
  it('withholds conventional rates at zero or negative capital rather than emitting Infinity or a false loss', () => {
    const zero = calculateModifiedDietz({ ...base, endingValue: 0, flows: [{ label: 'Exit', amount: -200, time: 15 }] });
    const negative = calculateModifiedDietz({ ...base, endingValue: 0, flows: [{ label: 'Exit', amount: -300, time: 15 }] });
    expect(zero.gain).toBe(100);expect(zero.capital).toBe(0);expect(zero.rate).toBeNull();expect(zero.status).toBe('zero');
    expect(negative.gain).toBe(200);expect(negative.capital).toBe(-50);expect(negative.rate).toBeNull();expect(negative.status).toBe('negative');
  });
  it('exposes the large-flow approximation and money-scale invariance', () => {
    const stress = calculateModifiedDietz({ ...base, endingValue: 600, flows: [{ label: 'Large flow', amount: 1000, time: 15 }] });
    expect(stress.gain).toBe(-500);expect(stress.capital).toBe(600);expect(stress.rate).toBeCloseTo(-5 / 6, 12);
    const scaled = calculateModifiedDietz({ ...base, beginningValue: 1000, endingValue: 1300, flows: base.flows.map((flow) => ({ ...flow, amount: flow.amount * 10 })) });
    expect(scaled.rate).toBe(calculateModifiedDietz(base).rate);
    expect(calculateModifiedDietz({ ...base, endingValue: 110, flows: [] }).rate).toBeCloseTo(0.1, 12);
  });
});
describe('Dietz author guards and localized fallback', () => {
  const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(ModifiedDietzTimeline, { ...base, ...props }));
  it('rejects malformed authored inputs before rendering', () => {
    for (const extra of [{ beginningValue: 0 }, { endingValue: Infinity }, { duration: 0 }, { flows: [{ label: 'Bad', time: 31, amount: 1 }] }, { flows: [{ label: '', time: 1, amount: 1 }] }]) expect(() => render(extra)).toThrow('ModifiedDietzTimeline:');
  });
  it('renders exact localized values, actual focus target and a finite zero-capital state', () => {
    const html = render({ locale: 'es-ES', currency: 'EUR', title: 'Capital ponderado', tableLabel: 'Flujos y pesos' });
    expect(html).toContain('7,8125');expect(html).toContain('<table tabindex="0" aria-label="Flujos y pesos"');expect(html).toContain('aria-live="polite"');expect(html).toContain('not-prose');
    const zero = render({ endingValue: 0, flows: [{ label: 'Salida', amount: -200, time: 15 }], zeroCapitalLabel: 'Capital cero: sin porcentaje finito' });
    expect(zero).toContain('Capital cero: sin porcentaje finito');expect(zero).not.toContain('Infinity');expect(zero).not.toContain('NaN');
  });
});
