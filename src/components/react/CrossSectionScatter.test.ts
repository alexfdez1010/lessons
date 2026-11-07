import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CrossSectionScatter } from '@/components/react/CrossSectionScatter';

describe('CrossSectionScatter SVG serialization', () => {
  test('normalizes render geometry while preserving a known OLS slope and intercept', () => {
    const html = renderToString(createElement(CrossSectionScatter, {
      points: [{ label: 'P1', x: -1, y: -1.1 }, { label: 'P2', x: 1, y: .9 }, { label: 'P3', x: -1, y: -.9 }, { label: 'P4', x: 1, y: 1.1 }],
    }));
    const readouts = [...html.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map(match => match[1]);
    expect(readouts).toEqual(['1.00', '+0.00']);
    expect(html).toContain('<title>P1: Factor loading (β) -1.00, Average excess return (% / yr) -1.1</title>');
    for (const match of html.matchAll(/(?:x1|x2|y1|y2|cx|cy|stroke-dasharray|stroke-dashoffset)="(-?\d+(?:\.\d+)?)"/g)) {
      expect(match[1].split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });

  test('keeps a supplied line and localized tooltip words without multiple title children', () => {
    const html = renderToString(createElement(CrossSectionScatter, {
      points: [{ label: 'Cartera', x: 1, y: 2 }],
      line: { slope: 3.141592653589793, intercept: -2.718281828459045 },
      xLabel: 'Carga', yLabel: 'Rentabilidad',
    }));
    const readouts = [...html.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map(match => match[1]);
    expect(readouts).toEqual(['3.14', '-2.72']);
    expect(html).toContain('<title>Cartera: Carga 1.00, Rentabilidad 2.0</title>');
  });
});
