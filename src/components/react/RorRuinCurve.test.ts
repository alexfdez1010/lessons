import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RorMonteCarloRuin } from '@/components/react/RorMonteCarloRuin';
import { RorRuinCurve, fixedUnitRuin, additiveBrownianRuin, matchedBrownianRuin } from '@/components/react/RorRuinCurve';

describe('fixed-unit floor hitting versus additive Brownian model', () => {
  test('exact walk boundary cases and positive-edge recurrence', () => {
    expect(fixedUnitRuin(0.55, 0)).toBe(1);
    expect(fixedUnitRuin(0.5, 30)).toBe(1);
    expect(fixedUnitRuin(0.45, 30)).toBe(1);
    expect(fixedUnitRuin(0, 30)).toBe(1);
    expect(fixedUnitRuin(1, 30)).toBe(0);
    expect(fixedUnitRuin(0.55, 10)).toBeCloseTo(0.13443063274931166, 12);
    const p = 0.55, n = 10;
    expect(fixedUnitRuin(p, n)).toBeCloseTo(p * fixedUnitRuin(p, n + 1) + (1 - p) * fixedUnitRuin(p, n - 1), 12);
    expect(fixedUnitRuin(p, 2 * n)).toBeCloseTo(fixedUnitRuin(p, n) ** 2, 12);
  });
  test('Brownian matching uses variance, one power of drift and compatible units', () => {
    expect(additiveBrownianRuin(10, 1000, 9900)).toBeCloseTo(0.13262866870306278, 12);
    expect(matchedBrownianRuin(0.55, 10)).toBeCloseTo(additiveBrownianRuin(10, 1000, 9900), 12);
    // Changing euros to cents multiplies drift/distance by 100 and variance by 10000.
    expect(additiveBrownianRuin(1000, 100000, 99000000)).toBeCloseTo(additiveBrownianRuin(10, 1000, 9900), 12);
    expect(additiveBrownianRuin(20, 1000, 9900)).toBeCloseTo(additiveBrownianRuin(10, 1000, 9900) ** 2, 12);
    expect(additiveBrownianRuin(0, 1000, 9900)).toBe(1);
    expect(additiveBrownianRuin(-10, 1000, 9900)).toBe(1);
    expect(matchedBrownianRuin(0.7, 5)).toBeLessThan(fixedUnitRuin(0.7, 5));
    expect(matchedBrownianRuin(0.7, 5)).toBeCloseTo(0.008549309479686067, 12);
  });
  test('curve controls change the intended distance and probability', () => {
    expect(fixedUnitRuin(0.55, 20)).toBeLessThan(fixedUnitRuin(0.55, 10));
    expect(fixedUnitRuin(0.6, 10)).toBeLessThan(fixedUnitRuin(0.55, 10));
    expect(fixedUnitRuin(0.5, 60)).toBe(1);
    expect(fixedUnitRuin(0.45, 60)).toBe(1);
  });
  test('author guards reject invalid models before rendering', () => {
    for (const [p, n] of [[NaN, 10], [1.1, 10], [0.55, 1.5], [0.55, -1]]) expect(() => fixedUnitRuin(p, n)).toThrow();
    for (const props of [{ units: 0 }, { units: 61 }, { units: 2.5 }, { edge: 0.25 }, { edge: 0.055 }, { edge: NaN }]) expect(() => renderToStaticMarkup(createElement(RorRuinCurve, props))).toThrow('RorRuinCurve');
    expect(() => additiveBrownianRuin(1, 10, 0)).toThrow();
    expect(() => additiveBrownianRuin(Infinity, 10, 1)).toThrow();
  });
  test('the reused finite-horizon fractional panel localizes chart and control descriptions', () => {
    const markup = renderToStaticMarkup(createElement(RorMonteCarloRuin, { risk: 0.1, locale: 'es-ES', chartLabel: 'Simulación de {paths} trayectorias con apuesta del {risk}; probabilidad {probability}', riskValueLabel: '{risk} del capital actual' }));
    expect(markup).toContain('aria-label="Simulación de 40 trayectorias');
    expect(markup).toContain('del capital actual');
    expect(markup).not.toContain('percent risk per trade');
    expect(markup).toContain('not-prose');
  });
  test('localized semantic chart exposes both models without motion', () => {
    const markup = renderToStaticMarkup(createElement(RorRuinCurve, { units: 10, showApproximation: true, locale: 'es-ES', chartLabel: 'Probabilidad {p}; distancia {units}; exacta {exact}; aproximación {approximation}', edgeValueLabel: '{edge} puntos porcentuales; probabilidad {p}', unitsValueLabel: '{units} unidades fijas', ruinLabel: 'Paseo exacto', approximationLabel: 'Modelo browniano' }));
    expect(markup).toContain('13,4431');
    expect(markup).toContain('13,2629');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('type="range"');
    expect(markup).toContain('not-prose');
    expect(markup).not.toContain('animate');
  });
});
