import { describe, expect, test } from 'bun:test';
import { calculateCashFlowReturns } from '@/components/react/CashFlowReturnComparison';

describe('cash-flow-adjusted return illustration', () => {
  test('reconciles deposits, balances and the unique annual IRR', () => {
    const result = calculateCashFlowReturns(1000, 1000);
    expect(result.beforeContribution).toBeCloseTo(1100, 8);
    expect(result.afterContribution).toBeCloseTo(2100, 8);
    expect(result.finalValue).toBeCloseTo(1890, 8);
    expect(result.gain).toBeCloseTo(-110, 8);
    expect(result.totalTwr).toBeCloseTo(-0.01, 12);
    expect(result.annualMwr).toBeCloseTo(-0.0371261161672205, 12);
  });

  test('changing the contribution alters MWR while preserving the market path', () => {
    const noFlow = calculateCashFlowReturns(1000, 0);
    const smallFlow = calculateCashFlowReturns(1000, 500);
    const largeFlow = calculateCashFlowReturns(1000, 3000);
    expect(noFlow.annualMwr).toBeCloseTo(noFlow.annualTwr, 12);
    expect(smallFlow.totalTwr).toBeCloseTo(noFlow.totalTwr, 12);
    expect(largeFlow.totalTwr).toBeCloseTo(noFlow.totalTwr, 12);
    expect(smallFlow.annualMwr).toBeLessThan(noFlow.annualMwr);
    expect(largeFlow.annualMwr).toBeLessThan(smallFlow.annualMwr);
    for (const contribution of [0, 10, 500, 1000, 3000]) {
      const result = calculateCashFlowReturns(1000, contribution);
      const factor = 1 + result.annualMwr;
      expect(1000 * factor ** 2 + contribution * factor).toBeCloseTo(result.finalValue, 8);
    }
  });

  test('rejects impossible and non-finite author inputs', () => {
    for (const [principal, contribution] of [[0, 0], [-1, 0], [1000, -1], [1000, 3001], [Infinity, 0], [1000, NaN]]) {
      expect(() => calculateCashFlowReturns(principal, contribution)).toThrow('CashFlowReturnComparison requires');
    }
  });
});
