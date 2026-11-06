import { describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NpvProfiles, calculateNpvProfiles, type NpvProfile } from '@/components/react/NpvProfiles';

const project = (label: string, amounts: number[]): NpvProfile => ({
  label, flows: amounts.map((amount, time) => ({ label: String(time), time, amount })),
});
const early = project('Early', [-100, 140]);
const late = project('Late', [-100, 0, 180]);

describe('NPV profile economic invariants', () => {
  it('shows the timing crossover and verifies each conventional IRR', () => {
    const values = calculateNpvProfiles([early, late], [0.1, 0.3, 2 / 7, 0.4, Math.sqrt(1.8) - 1]);
    expect(values[0][0]).toBeCloseTo(27.272727272727, 9);
    expect(values[0][1]).toBeCloseTo(48.760330578512, 9);
    expect(values[1][0]).toBeGreaterThan(values[1][1]);
    expect(values[2][0]).toBeCloseTo(values[2][1], 10);
    expect(values[3][0]).toBeCloseTo(0, 10);
    expect(values[4][1]).toBeCloseTo(0, 10);
  });
  it('preserves scale and incremental-value additivity', () => {
    const doubled = { ...early, flows: early.flows.map((flow) => ({ ...flow, amount: flow.amount * 2 })) };
    const incremental = project('Late minus early', [0, -140, 180]);
    const [[a, b, twice], [difference]] = [calculateNpvProfiles([early, late, doubled], [0.1])[0], calculateNpvProfiles([incremental], [0.1])[0]];
    expect(twice).toBeCloseTo(a * 2, 10);
    expect(difference).toBeCloseTo(b - a, 10);
  });
  it('retains two roots and the positive interval without selecting a preferred IRR', () => {
    const [[low], [first], [between], [second], [high]] = calculateNpvProfiles([project('Cleanup', [-100, 230, -132])], [0, 0.1, 0.15, 0.2, 0.3]);
    expect(low).toBe(-2);
    expect(first).toBeCloseTo(0, 10);
    expect(between).toBeCloseTo(0.189035916824, 9);
    expect(second).toBeCloseTo(0, 10);
    expect(high).toBeLessThan(0);
  });
  it('values a no-real-root schedule even when a root does not exist', () => {
    const values = calculateNpvProfiles([project('No root', [-100, 50, -10])], [-0.9, -0.6, 0, 0.1, 2]);
    expect(values.every(([value]) => value < 0)).toBe(true);
    expect(values[1][0]).toBeCloseTo(-37.5, 10);
    expect(values[3][0]).toBeCloseTo(-62.809917355372, 9);
  });
});

describe('NPV profiles author guards and accessible fallback', () => {
  const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(NpvProfiles, { profiles: [early, late], ...extra }));
  it('rejects malformed authored data during server rendering', () => {
    expect(() => render({ profiles: [] })).toThrow('one to three');
    expect(() => render({ profiles: [project('Bad', [Infinity])] })).toThrow('finite flows');
    expect(() => render({ profiles: [{ label: 'Bad', flows: [{ label: 'Payment', amount: 1, time: -1 }] }] })).toThrow('integer dates');
    expect(() => render({ minRate: -1 })).toThrow('increasing rate domain');
    expect(() => render({ maxRate: 0.05 })).toThrow('selected rate inside');
    expect(() => render({ tableRates: [0.7] })).toThrow('within the domain');
  });
  it('server-renders localized chart data, live results and the actual focusable table', () => {
    const html = render({ title: 'Perfiles de VAN', rateLabel: 'Tipo supuesto', rateAxisLabel: 'Tipo', valueAxisLabel: 'VAN', selectedLabel: 'Con el tipo elegido', tableLabel: 'Valores exactos', tableCaption: 'Flujos a fecha cero', chartLabel: 'Perfiles de {min} a {max}; elegido {rate}', scopeLabel: 'El gráfico no busca raíces fuera del intervalo', locale: 'es-ES', currency: 'EUR' });
    expect(html).toContain('Perfiles de VAN');
    expect(html).toContain('27,27');
    expect(html).toContain('<table tabindex="0" aria-label="Valores exactos"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('not-prose');
    expect(html).not.toContain('Sampled net-present-value');
    expect(html).not.toContain('NaN');
  });
});
