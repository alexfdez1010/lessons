import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { makeCreditTransitionMatrix, creditMigrationPath, blendCreditTransitionMatrix, calculateMigrationBond, calculateCreditMeasure, RatingTransitionLab, MigrationBondReturnLab, CreditMeasureLab } from '@/components/react/CreditMigrationLab';

const matrix = () => makeCreditTransitionMatrix(.05, .2);
const bond = { face: 100, couponRate: .05, remainingPayments: 2, strongerYield: .04, weakerYield: .1, recovery: .4, initialPrice: 100, probabilities: [.8, .15, .05] as [number, number, number] };
const measure = { face: 100, couponRate: .05, recovery: .4, physicalDefault: .05, pricingDefault: .1, riskFreeRate: .03 };
describe('Credit migration, cash and pricing measures', () => {
  test('each annual row is a complete conditional distribution and two years sum all intermediate paths', () => {
    const path = creditMigrationPath([1, 0, 0], [matrix(), matrix()]);
    for (const [i, value] of [.655, .225, .12].entries()) expect(path[2].distribution[i]).toBeCloseTo(value, 13);
    expect(path[1].cumulativeDefault).toBeCloseTo(.05, 13);
    expect(path[2].newDefault).toBeCloseTo(.07, 13);
    expect(path[2].conditionalDefault).toBeCloseTo(7 / 95, 13);
    expect(creditMigrationPath([0, 1, 0], [matrix(), matrix()])[2].cumulativeDefault).toBeCloseTo(.345, 13);
  });
  test('probabilities remain complete, default accumulates and increments telescope across an arbitrary supported path', () => {
    const path = creditMigrationPath([.7, .3, 0], Array.from({ length: 20 }, () => matrix()));
    for (const [i, point] of path.entries()) {
      expect(point.distribution.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 13);
      expect(point.distribution.every(value => value >= 0)).toBe(true);
      if (i > 0) expect(point.cumulativeDefault).toBeGreaterThanOrEqual(path[i - 1].cumulativeDefault);
    }
    expect(path.reduce((sum, point) => sum + point.newDefault, 0)).toBeCloseTo(path.at(-1)!.cumulativeDefault, 13);
    const absorbed = creditMigrationPath([0, 0, 1], [matrix(), matrix()]);
    expect(absorbed[2].distribution).toEqual([0, 0, 1]);
    expect(absorbed[2].newDefault).toBe(0);
    expect(absorbed[2].conditionalDefault).toBeNull();
  });
  test('a changed second-year scenario is an ordered product rather than a stationary square', () => {
    const stress = blendCreditTransitionMatrix(matrix(), [[.7, .2, .1], [.05, .6, .35], [0, 0, 1]], 1);
    const path = creditMigrationPath([1, 0, 0], [matrix(), stress]);
    for (const [i, value] of [.5675, .25, .1825].entries()) expect(path[2].distribution[i]).toBeCloseTo(value, 13);
    expect(creditMigrationPath([1, 0, 0], [stress, matrix()])[2].cumulativeDefault).not.toBeCloseTo(.1825, 8);
    expect(blendCreditTransitionMatrix(matrix(), stress, 0)).toEqual(matrix());
  });
  test('coupon, ex-coupon continuation mark and default recovery are mutually exclusive complete outcomes', () => {
    const result = calculateMigrationBond(bond);
    expect(result.states[0].mark).toBeCloseTo(101.88609467455621, 12);
    expect(result.states[1].mark).toBeCloseTo(91.32231404958678, 12);
    expect(result.states[0].wealth).toBeCloseTo(106.88609467455621, 12);
    expect(result.states[1].holdingReturn).toBeCloseTo(-.03677685950413223, 13);
    expect(result.states[2]).toEqual({ probability: .05, coupon: 0, mark: 0, recovery: 40, wealth: 40, holdingReturn: -.6, weightedWealth: 2 });
    expect(result.expectedCoupon).toBeCloseTo(4.75, 13);
    expect(result.expectedMark).toBeCloseTo(95.20722284708299, 12);
    expect(result.expectedRecovery).toBe(2);
    expect(result.expectedWealth).toBeCloseTo(101.95722284708299, 12);
    expect(result.expectedReturn).toBeCloseTo(.01957222847082987, 13);
    expect(result.lossProbability).toBeCloseTo(.2, 13);
  });
  test('marks respond to stated yields, while probability weights and entry prices change different quantities', () => {
    const original = calculateMigrationBond(bond), yieldStress = calculateMigrationBond({ ...bond, weakerYield: .2 }), probabilityStress = calculateMigrationBond({ ...bond, probabilities: [.7, .15, .15] }), priceStress = calculateMigrationBond({ ...bond, initialPrice: 120 });
    expect(yieldStress.states[1].mark).toBeLessThan(original.states[1].mark);
    expect(yieldStress.states[0].mark).toBe(original.states[0].mark);
    expect(probabilityStress.states[0].mark).toBe(original.states[0].mark);
    expect(probabilityStress.expectedWealth).toBeLessThan(original.expectedWealth);
    expect(priceStress.expectedWealth).toBe(original.expectedWealth);
    expect(priceStress.expectedReturn).toBeLessThan(original.expectedReturn);
    expect(priceStress.lossProbability).toBeCloseTo(1, 13);
    const zero = calculateMigrationBond({ ...bond, couponRate: 0, strongerYield: 0, weakerYield: 0, probabilities: [1, 0, 0] });
    expect(zero.states[0].mark).toBe(100);
    expect(zero.expectedReturn).toBe(0);
    expect(zero.lossProbability).toBe(0);
  });
  test('changing physical weights does not change a price determined by separately supplied pricing weights', () => {
    const original = calculateCreditMeasure(measure), changed = calculateCreditMeasure({ ...measure, physicalDefault: .2 }), equal = calculateCreditMeasure({ ...measure, physicalDefault: .1 });
    expect(original.physicalCash).toBe(101.75);
    expect(original.pricingCash).toBe(98.5);
    expect(original.price).toBeCloseTo(95.63106796116505, 12);
    expect(original.physicalDiscountShortcut).toBeCloseTo(98.7864077669903, 12);
    expect(original.physicalExpectedReturn).toBeCloseTo(.06398477157360406, 13);
    expect(original.pricingExpectedReturn).toBeCloseTo(.03, 13);
    expect(changed.price).toBe(original.price);
    expect(changed.physicalExpectedReturn!).toBeLessThan(original.physicalExpectedReturn!);
    expect(equal.physicalExpectedReturn).toBeCloseTo(.03, 13);
    expect(calculateCreditMeasure({ ...measure, recovery: 0, pricingDefault: 1 }).physicalExpectedReturn).toBeNull();
  });
  test('small surviving mass retains a conditional probability without subtracting rounded cumulative mass', () => {
    const path = creditMigrationPath([1, 0, 0], Array.from({ length: 25 }, () => makeCreditTransitionMatrix(.85, .9))), last = path.at(-1)!;
    expect(last.distribution[0] + last.distribution[1]).toBeGreaterThan(0);
    expect(last.cumulativeDefault).toBeLessThanOrEqual(1);
    expect(last.newDefault).toBeGreaterThan(0);
    expect(last.conditionalDefault).not.toBeNull();
    expect(last.conditionalDefault!).toBeGreaterThan(.8);
    expect(() => calculateCreditMeasure({ ...measure, pricingDefault: 1, recovery: 1e-320 })).toThrow('not representable');
    expect(() => creditMigrationPath([1, 0, 0], [[[1e-320, 0, 1], [0, 0, 1], [0, 0, 1]], [[1e-320, 0, 1], [0, 0, 1], [0, 0, 1]]])).toThrow('underflows');
  });
  test('pure helpers reject invalid probability systems without silently normalizing them', () => {
    expect(() => creditMigrationPath([1, 0, 0], [[[.8, .15, .1], [.1, .7, .2], [0, 0, 1]]])).toThrow('each transition row');
    expect(() => creditMigrationPath([1, 0, 0], [[[.8, .15, .05], [.1, .7, .2], [.1, 0, .9]]])).toThrow('settled-default');
    expect(() => calculateMigrationBond({ ...bond, probabilities: [.8, .2, .1] })).toThrow('complete three-state');
    expect(() => calculateCreditMeasure({ ...measure, pricingDefault: -1 })).toThrow('finite supported');
  });
  test('author guards prevent native control snapping before SSR while helpers retain continuous domains', () => {
    expect(() => renderToStaticMarkup(createElement(RatingTransitionLab, { horizon: 2.5 }))).toThrow('native integer grids');
    expect(() => renderToStaticMarkup(createElement(MigrationBondReturnLab, { weakerYieldPct: 10.4 }))).toThrow('integer native grids');
    expect(() => renderToStaticMarkup(createElement(CreditMeasureLab, { pricingDefaultPct: 10.4 }))).toThrow('integer native author');
    expect(() => renderToStaticMarkup(createElement(RatingTransitionLab, { view: 'stress', strongerDefaultPct: 5.4 }))).not.toThrow();
    expect(() => calculateMigrationBond({ ...bond, weakerYield: .104 })).not.toThrow();
    expect(() => calculateCreditMeasure({ ...measure, pricingDefault: .104 })).not.toThrow();
    expect(() => creditMigrationPath([1, 0, 0], [makeCreditTransitionMatrix(.054, .207)])).not.toThrow();
  });
});
