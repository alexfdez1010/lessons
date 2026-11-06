import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AprApyDial } from '@/components/react/AprApyDial';

describe('annual rate comparison', () => {
  test('compounds a nominal rate and distinguishes the percentage point gap', () => {
    const html = renderToStaticMarkup(createElement(AprApyDial, { apr: 0.12, periods: 12 }));
    expect(html).toContain('12.68%');
    expect(html).toContain('The difference is 0.68 percentage points.');
    expect(html).toContain('Difference in percentage points');
    expect(html).not.toContain('height="0"');
  });

  test('zero interest gives zero yield at every frequency', () => {
    for (const periods of [1, 2, 4, 12, 52, 365]) {
      const html = renderToStaticMarkup(createElement(AprApyDial, { apr: 0, periods }));
      expect(html).toContain('effective annual yield is 0.00%');
      expect(html).not.toMatch(/NaN|Infinity/);
    }
  });

  test('localizes the accessible calculation and decimal separator', () => {
    const html = renderToStaticMarkup(createElement(AprApyDial, {
      locale: 'es-ES', apr: 0.12, periods: 12,
      periodNames: ['Anual', 'Semestral', 'Trimestral', 'Mensual', 'Semanal', 'Diaria'],
      chartLabel: 'Tipo {rate}, {periods} periodos: {effective}; diferencia de {gap} puntos porcentuales.',
    }));
    expect(html).toContain('12,68');
    expect(html).toContain('diferencia de 0,68 puntos porcentuales.');
  });
});
