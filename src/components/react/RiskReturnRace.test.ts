import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RiskReturnRace } from '@/components/react/RiskReturnRace';

describe('RiskReturnRace computed statistics', () => {
  test('derives volatility and Sharpe from the plotted monthly observations', () => {
    const html = renderToStaticMarkup(createElement(RiskReturnRace));
    // Independent calculation for the 11 simple monthly returns, sample sd,
    // zero risk-free rate, with monthly-to-annual scaling by sqrt(12).
    expect(html).toContain('>1.7% (low)</td>');
    expect(html).toContain('>123% (high)</td>');
    expect(html).toContain('>31.35</td>');
    expect(html).toContain('>0.96</td>');
    expect(html.match(/>\+60%<\/td>/g)?.length).toBe(2);
    expect(html).toContain('zero risk-free rate');
  });

  test('server output contains complete paths and observations before playback', () => {
    const html = renderToStaticMarkup(createElement(RiskReturnRace));
    expect(html).toContain('Month 11 of 11');
    expect(html.match(/>160<\/dd>/g)?.length).toBe(2);
    expect(html).toContain('type="range"');
    expect(html).toContain('max="11"');
    expect(html).not.toContain('NaN');
  });

  test('localizes metrics and accessible path description', () => {
    const html = renderToStaticMarkup(createElement(RiskReturnRace, {
      locale: 'es-ES', lowLabel: 'baja', highLabel: 'alta', seriesLabels: ['Estable', 'Variable'],
      chartLabel: 'Mes {observation} de {total}: {smooth} {smoothValue}; {jagged} {jaggedValue}',
    }));
    expect(html).toContain('aria-label="Mes 11 de 11: Estable 160; Variable 160"');
    expect(html).toContain('>31,35</td>');
    expect(html).toContain('>0,96</td>');
    expect(html).toContain('1,7');
    expect(html).toContain('(baja)');
  });
});
