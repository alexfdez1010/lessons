import { describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IndexWeights } from '@/components/react/IndexWeights';

const companies = [
  { name: 'A', marketCap: 50000 },
  { name: 'B', marketCap: 30000 },
  { name: 'C', marketCap: 20000 },
];

describe('IndexWeights number localization', () => {
  const render = (locale?: string) => renderToStaticMarkup(createElement(IndexWeights, { companies, locale }));
  it('preserves English percentages by default and localizes all numeric readouts for Spanish', () => {
    const en = render();
    const es = render('es-ES');
    const spanishPercent = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(0.5);
    expect(en).toContain('A: 50.0%');
    expect(en).toContain('50,000');
    expect(en).toContain('aria-valuetext="50,000"');
    expect(es).toContain('A: ' + spanishPercent);
    expect(es).toContain('50.000');
    expect(es).toContain('aria-valuetext="50.000"');
    expect(es).not.toContain('50.0%');
    expect(es).not.toContain('50,000');
  });
  it('rejects a malformed locale during server rendering', () => {
    expect(() => render('invalid_locale')).toThrow(RangeError);
  });
});
