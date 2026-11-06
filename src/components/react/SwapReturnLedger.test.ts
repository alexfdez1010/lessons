import { describe, it, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SwapReturnLedger, calculateSwapReturnLedger } from '@/components/react/SwapReturnLedger';

const inputs = { notional: 100, indexReturn: 0.08, basketReturn: 0.03, fee: 0.2, collateral: 3 };

describe('Unfunded swap cash-flow reconciliation', () => {
  it('reconciles owned basket and signed net settlement without holding index securities', () => {
    const data = calculateSwapReturnLedger(inputs);
    expect(data.basketValue).toBeCloseTo(103, 10);
    expect(data.swapValue).toBeCloseTo(5, 10);
    expect(data.finalValue).toBeCloseTo(107.8, 10);
    expect(data.positiveClaim).toBeCloseTo(5, 10);
    expect(data.unsecuredClaim).toBeCloseTo(2, 10);
  });
  it('cancels the basket-return effect only when the swap performs as contracted', () => {
    for (const basketReturn of [-0.5, -0.1, 0, 0.03, 0.5]) {
      expect(calculateSwapReturnLedger({ ...inputs, basketReturn }).finalValue).toBeCloseTo(107.8, 10);
    }
    const falling = calculateSwapReturnLedger({ ...inputs, indexReturn: -0.1, basketReturn: -0.04 });
    expect(falling.swapValue).toBeCloseTo(-6, 10);
    expect(falling.finalValue).toBeCloseTo(89.8, 10);
    expect(falling.positiveClaim).toBe(0);
    expect(falling.unsecuredClaim).toBe(0);
  });
  it('does not count collateral as fund income and floors only positive credit claims', () => {
    const none = calculateSwapReturnLedger({ ...inputs, collateral: 0 });
    const excess = calculateSwapReturnLedger({ ...inputs, collateral: 7 });
    expect(none.finalValue).toBe(excess.finalValue);
    expect(none.unsecuredClaim).toBeCloseTo(5, 10);
    expect(excess.unsecuredClaim).toBe(0);
  });
});

describe('Swap ledger author guards and localization', () => {
  const render = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SwapReturnLedger, { ...inputs, ...extra }));
  it('rejects malformed authored values before rendering', () => {
    for (const extra of [{ notional: 0 }, { indexReturn: NaN }, { basketReturn: -1 }, { collateral: -1 }, { fee: 51 }]) {
      expect(() => render(extra)).toThrow('SwapReturnLedger:');
    }
  });
  it('renders native labeled controls, exact signed amounts and the focusable table', () => {
    const html = render({ title: 'Flujos de la permuta', indexReturnLabel: 'Rentabilidad del índice', basketReturnLabel: 'Rentabilidad de la cesta', tableLabel: 'Conciliación exacta', locale: 'es-ES', currency: 'EUR' });
    expect(html).toContain('107,80');
    expect(html).toContain('Rentabilidad del índice');
    expect(html).toContain('<table tabindex="0" aria-label="Conciliación exacta"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('not-prose');
    expect(html).not.toContain('NaN');
  });
});
