import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateLognormalPrice, LognormalPrice } from '@/components/react/LognormalPrice';

describe('Lognormal pricing density compatibility', () => {
  test('keeps the zero-rate default law and adds explicit Q price drift r minus q', () => {
    const old = calculateLognormalPrice({ spot: 100, strike: 100, volatility: .2, time: 1 }), carry = calculateLognormalPrice({ spot: 100, strike: 100, volatility: .2, time: 1, rate: .05, dividendYield: .02 });
    expect(old.d2).toBeCloseTo(-.1, 14);
    expect(old.median).toBeCloseTo(100 * Math.exp(-.02), 12);
    expect(old.mean).toBe(100);
    expect(carry.d2).toBeCloseTo(.05, 14);
    expect(carry.mean).toBeCloseTo(100 * Math.exp(.03), 12);
    expect(carry.median).toBeCloseTo(100 * Math.exp(.01), 12);
    expect(carry.callProbability + carry.putProbability).toBeCloseTo(1, 14);
    expect(carry.callProbability).toBeCloseTo(.5199388058383725, 6);
  });
  test('author guards reject snapping and singular densities while the pure helper keeps a continuous domain', () => {
    expect(() => renderToStaticMarkup(createElement(LognormalPrice, { vol: .204 }))).toThrow('native grids');
    expect(() => renderToStaticMarkup(createElement(LognormalPrice, { time: .15 }))).toThrow('native grids');
    expect(() => renderToStaticMarkup(createElement(LognormalPrice, { strike: 110.4 }))).toThrow('native grids');
    expect(() => calculateLognormalPrice({ spot: 100.4, strike: 110.4, volatility: .204, time: .15 })).not.toThrow();
    expect(() => calculateLognormalPrice({ spot: 100, strike: 100, volatility: 0, time: 1 })).toThrow('positive');
  });
  test('localized display never enters native numeric values or serialized SVG coordinates', () => {
    const html = renderToStaticMarkup(createElement(LognormalPrice, { locale: 'es-ES', chartLabel: 'Densidad Q: {probability}; mediana {median}', chartScrollLabel: 'Gráfico desplazable {title}', timeLabel: 'Años', yearUnitLabel: 'años' }));
    expect(html).toContain('Densidad Q:');
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('min-w-[624px]');
    expect(html).toContain('value="25"');
    expect(html).toContain('value="110"');
    const curve = html.match(/<path d="([^"]+)"/)?.[1];
    expect(curve).toBeDefined();
    expect(curve).not.toContain(',');
    for (const number of curve!.match(/-?\d+(?:\.\d+)?/g)!) expect(number.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});
