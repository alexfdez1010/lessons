import { describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SecuritiesLendingCollateral, calculateLendingCollateral } from '@/components/react/SecuritiesLendingCollateral';

const stress = { initialLoan: 50, initialCollateral: 51, loanReturn: 0.1, collateralReturn: -0.2 };

describe('securities lending conditional collateral shortfall', () => {
  it('calculates the adverse two-price scenario despite initial overcollateralization', () => {
    const result = calculateLendingCollateral(stress);
    expect(result.replacementCost).toBeCloseTo(55, 12);
    expect(result.collateralRealizable).toBeCloseTo(40.8, 12);
    expect(result.initialCoverage).toBeCloseTo(1.02, 12);
    expect(result.currentCoverage).toBeCloseTo(40.8 / 55, 12);
    expect(result.shortfall).toBeCloseTo(14.2, 12);
    expect(result.surplus).toBe(0);
  });
  it('keeps excess collateral separate from shortfall and preserves the accounting difference', () => {
    const covered = calculateLendingCollateral({ ...stress, loanReturn: 0, collateralReturn: 0 });
    expect(covered.shortfall).toBe(0);
    expect(covered.surplus).toBe(1);
    expect(covered.collateralRealizable + covered.shortfall - covered.surplus).toBe(covered.replacementCost);
    const destroyed = calculateLendingCollateral({ ...stress, collateralReturn: -1 });
    expect(destroyed.collateralRealizable).toBe(0);
    expect(destroyed.shortfall).toBeCloseTo(55, 12);
  });
  it('moves the risk in the expected direction when either price changes alone', () => {
    const base = calculateLendingCollateral(stress);
    const dearerShares = calculateLendingCollateral({ ...stress, loanReturn: 0.2 });
    const dearerCollateral = calculateLendingCollateral({ ...stress, collateralReturn: -0.1 });
    expect(dearerShares.shortfall).toBeGreaterThan(base.shortfall);
    expect(dearerShares.currentCoverage).toBeLessThan(base.currentCoverage);
    expect(dearerCollateral.shortfall).toBeLessThan(base.shortfall);
    expect(dearerCollateral.currentCoverage).toBeGreaterThan(base.currentCoverage);
  });
  it('is homogeneous in the monetary amounts and leaves coverage ratios unchanged', () => {
    const base = calculateLendingCollateral(stress);
    const doubled = calculateLendingCollateral({ ...stress, initialLoan: 100, initialCollateral: 102 });
    expect(doubled.shortfall).toBeCloseTo(2 * base.shortfall, 12);
    expect(doubled.initialCoverage).toBeCloseTo(base.initialCoverage, 12);
    expect(doubled.currentCoverage).toBeCloseTo(base.currentCoverage, 12);
  });
});

describe('securities lending visual author guards and fallback', () => {
  const render = (props: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SecuritiesLendingCollateral, props));
  it('rejects malformed authored cases during server rendering', () => {
    for (const props of [{ initialLoan: 0 }, { initialLoan: -1 }, { initialLoan: Infinity }, { initialCollateral: -1 }, { initialCollateral: NaN }, { loanReturn: -1 }, { loanReturn: 1.01 }, { collateralReturn: -1.01 }, { collateralReturn: Infinity }]) {
      expect(() => render(props)).toThrow('SecuritiesLendingCollateral');
    }
  });
  it('renders exact localized amounts, conditional language and the actual focusable table without hydration', () => {
    const html = render({
      title: 'Garantía y coste de reposición', loanReturnLabel: 'Cambio de las acciones', collateralReturnLabel: 'Cambio de la garantía',
      replacementLabel: 'Reposición', collateralLabel: 'Garantía realizable', initialCoverageLabel: 'Cobertura inicial', currentCoverageLabel: 'Cobertura actual',
      shortfallLabel: 'Déficit si hay impago ahora', surplusLabel: 'Exceso de garantía',
      scopeLabel: 'Sin reposición de garantías ni otros cobros; el exceso no es ingreso.',
      chartLabel: 'Reposición {replacement}, garantía {collateral}, déficit {shortfall}.',
      tableLabel: 'Valores exactos', measureLabel: 'Magnitud', initialLabel: 'Inicio', currentLabel: 'Precios elegidos', coverageLabel: 'Cobertura',
      locale: 'es-ES', currency: 'EUR',
    });
    expect(html).toContain('14,20');
    expect(html).toContain('40,80');
    expect(html).toContain('55,00');
    expect(html).toContain('102');
    expect(html).toContain('Déficit si hay impago ahora');
    expect(html).toContain('<table tabindex="0" aria-label="Valores exactos"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('motion-reduce:transition-none');
    expect(html).toContain('not-prose');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Hypothetical default');
  });
});
