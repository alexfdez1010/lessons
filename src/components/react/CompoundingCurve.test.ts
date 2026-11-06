import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompoundingCurve } from '@/components/react/CompoundingCurve';

describe('CompoundingCurve descriptions', () => {
  test('preserves the default English description and monetary formatting', () => {
    const html = renderToStaticMarkup(createElement(CompoundingCurve));
    expect(html).toContain('Compounding pulls away: $1,000 growing at 8% a year for 20 years reaches $4,661');
    expect(html).toContain('versus $2,600 with simple growth.');
  });

  test('localizes monetary readouts and the accessible comparison', () => {
    const html = renderToStaticMarkup(createElement(CompoundingCurve, {
      locale: 'es-ES', currencyPrefix: '€', principal: 10000,
      chartLabel: '{start} al {rate}% durante {years} años: {compound} frente a {simple}',
    }));
    expect(html).toContain('aria-label="€10.000 al 8% durante 20 años: €46.610 frente a €26.000"');
    expect(html).toContain('>€46.610</dd>');
  });

  test('describes zero interest without introducing non-finite values', () => {
    const html = renderToStaticMarkup(createElement(CompoundingCurve, { rate: 0, years: 1 }));
    expect(html).toContain('0% a year for 1 years reaches $1,000');
    expect(html).toContain('versus $1,000 with simple growth.');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });
});
