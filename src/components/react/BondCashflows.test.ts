import { describe, it, expect } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BondCashflows, calculateBondSchedule } from '@/components/react/BondCashflows';
describe('Conditional fixed nominal bullet schedule', () => {
  it('matches the three-year semiannual schedule and pays principal once', () => {
    const s=calculateBondSchedule(1000,0.05,3,2);expect(s.coupon).toBe(25);expect(s.totalInterest).toBe(150);expect(s.paymentCount).toBe(6);expect(s.maturityPayment).toBe(1025);expect(s.flows.map(f=>f.time)).toEqual([0.5,1,1.5,2,2.5,3]);expect(s.flows.reduce((sum,f)=>sum+f.amount,0)).toBe(1150);
  });
  it('has one positive cash payment at maturity for zero coupon and preserves fractional coupons', () => {
    const s=calculateBondSchedule(1000,0,3,2);expect(s.paymentCount).toBe(1);expect(s.couponDates).toBe(0);expect(s.flows).toEqual([{time:3,amount:1000}]);expect(calculateBondSchedule(1000,0.055,3,2).coupon).toBe(27.5);
  });
  it('rejects malformed authored terms during server rendering', () => {
    for(const props of[{faceValue:0},{couponRate:NaN},{years:1.5},{frequency:3}])expect(()=>renderToStaticMarkup(createElement(BondCashflows,props))).toThrow('BondCashflows:');
  });
  it('localizes accessible and visible numbers and scopes the schedule honestly', () => {
    const html=renderToStaticMarkup(createElement(BondCashflows,{faceValue:10000,couponRate:0.055,years:3,frequency:2,locale:'es-ES',chartLabel:'Calendario condicional: nominal{face},cupón{rate},importe{coupon},pagos{payments},final{final}',caption:'Supone pago completo; no garantiza el resultado'}));
    expect(html).toContain('10.000');expect(html).toContain('5,5');expect(html).toContain('pagos6');expect(html).toContain('Supone pago completo');expect(html).not.toContain('a $10,000 bond paying');expect(html).toContain('not-prose');
  });
});
