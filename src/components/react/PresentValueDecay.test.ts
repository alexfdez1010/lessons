import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PresentValueDecay } from '@/components/react/PresentValueDecay';

describe('PresentValueDecay comparisons', () => {
  test('shows present value and its difference from the fixed future payment', () => {
    const html = renderToStaticMarkup(createElement(PresentValueDecay, { futureValue: 1210, rate: 0.1, years: 2 }));
    // Discounting 1210 by 1.1 twice recovers 1000, leaving a difference of 210.
    expect(html).toContain('>$1,000</dd>');
    expect(html).toContain('>$210</dd>');
    expect(html).toContain('a $1,210 payment due in 2 years');
  });

  test('zero discount preserves the full future amount', () => {
    const html = renderToStaticMarkup(createElement(PresentValueDecay, { rate: 0, years: 40 }));
    expect(html).toContain('>$1,000</dd>');
    expect(html).toContain('>$0</dd>');
    expect(html).toContain('>100¢</dd>');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  test('localizes the accessible calculation and readouts', () => {
    const html = renderToStaticMarkup(createElement(PresentValueDecay, {
      futureValue: 12100, rate: 0.1, years: 2, locale: 'es-ES', currencyPrefix: '€',
      chartLabel: '{future} dentro de {years} años al {rate}%: {present} hoy; diferencia {discount}',
    }));
    expect(html).toContain('aria-label="€12.100 dentro de 2 años al 10%: €10.000 hoy; diferencia €2100"');
    expect(html).toContain('>€10.000</dd>');
  });
});
