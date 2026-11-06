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

  test('shows the simple-interest comparison and interest earned on interest', () => {
    const html = renderToStaticMarkup(createElement(CompoundingCurve, { rate: 0.1, years: 2 }));
    // 1000 × 1.1² = 1210; simple interest pays 1000 × (1 + 0.1 × 2) = 1200.
    expect(html).toContain('>$1,210</dd>');
    expect(html).toContain('>$1,200</dd>');
    expect(html).toContain('>$10</dd>');
  });

  test('describes the supplied fractional rate rather than rounding it to an integer', () => {
    const html = renderToStaticMarkup(createElement(CompoundingCurve, { rate: 0.075, years: 20 }));
    expect(html).toContain('7.5% a year for 20 years');
    expect(html).toContain('value="7.5"');
    expect(html).toContain('>$4,248</dd>');
    expect(html).not.toContain('>CAGR</dt>');
  });

  test('keeps a high-rate authored loan scenario within the slider bounds', () => {
    const html = renderToStaticMarkup(createElement(CompoundingCurve, { rate: 0.18 }));
    expect(html).toContain('max="18"');
    expect(html).toContain('value="18"');
    expect(html).toContain('18% a year');
  });
});
