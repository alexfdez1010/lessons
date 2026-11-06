import { describe, expect, test } from 'bun:test';
import { calculateCashCycle } from '@/components/react/DaysOfCashCycle';

describe('cash conversion timeline', () => {
  test('places events on one purchase-based clock and reconciles the signed gap', () => {
    expect(calculateCashCycle(60, 45, 40)).toEqual({ saleDay: 60, collectionDay: 105, paymentDay: 40, cycleDays: 65 });
    expect(calculateCashCycle(15, 0, 45)).toEqual({ saleDay: 15, collectionDay: 15, paymentDay: 45, cycleDays: -30 });
    expect(calculateCashCycle(20, 10, 30).cycleDays).toBe(0);
  });
  test('isolates the different effects of the three delay controls', () => {
    const base = calculateCashCycle(60, 45, 40);
    expect(calculateCashCycle(70, 45, 40).cycleDays - base.cycleDays).toBe(10);
    expect(calculateCashCycle(60, 55, 40).cycleDays - base.cycleDays).toBe(10);
    expect(calculateCashCycle(60, 45, 50).cycleDays - base.cycleDays).toBe(-10);
    expect(calculateCashCycle(180, 180, 0).collectionDay).toBe(360);
  });
  test('rejects unsupported author inputs instead of clipping them', () => {
    for (const value of [-1, 181, NaN, Infinity]) {
      expect(() => calculateCashCycle(value, 0, 0)).toThrow('DaysOfCashCycle requires');
      expect(() => calculateCashCycle(0, value, 0)).toThrow('DaysOfCashCycle requires');
      expect(() => calculateCashCycle(0, 0, value)).toThrow('DaysOfCashCycle requires');
    }
  });
});
