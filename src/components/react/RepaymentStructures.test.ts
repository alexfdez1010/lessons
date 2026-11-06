import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RepaymentStructures, simulateRepaymentStructures } from '@/components/react/RepaymentStructures';
const base = { principal: 1000, monthlyRate: .01, months: 3, customPayment: 5, capitalizeUnpaidInterest: true };

describe('repayment structures with monthly cents and explicit maturity', () => {
  test('three-period amortization adjusts the last cent and conserves principal plus interest', () => {
    const { amortizing: p } = simulateRepaymentStructures(base);
    expect(p.rows.map(r => r.paymentCents)).toEqual([34002, 34002, 34003]);
    expect(p.rows.map(r => r.closingCents)).toEqual([66998, 33666, 0]);
    expect(p.interestCents).toBe(2007);
    expect(p.balloonCents).toBe(0);
    expect(p.totalWithBalloonCents).toBe(102007);
    expect(p.rows.reduce((sum, r) => sum + r.principalReductionCents, 0)).toBe(100000);
  });
  test('interest-only retains principal until its separate same-date balloon', () => {
    const { interestOnly: p } = simulateRepaymentStructures(base);
    expect(p.rows.map(r => r.paymentCents)).toEqual([1000,1000,1000]);
    expect(p.rows.map(r => r.closingCents)).toEqual([100000,100000,100000]);
    expect(p.interestCents).toBe(3000);
    expect(p.balloonCents).toBe(100000);
    expect(p.maturityDueCents).toBe(101000);
    expect(p.totalWithBalloonCents).toBe(103000);
  });
  test('under-interest payments grow the balance only with explicit capitalization permission', () => {
    const { custom: p } = simulateRepaymentStructures(base);
    expect(p!.rows.map(r => r.closingCents)).toEqual([100500,101005,101515]);
    expect(p!.rows.map(r => r.interestCents)).toEqual([1000,1005,1010]);
    expect(p!.interestCents).toBe(3015);
    expect(p!.balloonCents).toBe(101515);
    expect(p!.maturityDueCents).toBe(102015);
    expect(p!.totalWithBalloonCents).toBe(103015);
    expect(simulateRepaymentStructures({...base,capitalizeUnpaidInterest:false}).custom).toBeNull();
    expect(simulateRepaymentStructures({...base,customPayment:10,capitalizeUnpaidInterest:false}).custom!.balloonCents).toBe(100000);
  });
  test('changing the payment alters principal and balloon, not the common quoted rate', () => {
    const small=simulateRepaymentStructures(base), larger=simulateRepaymentStructures({...base,customPayment:100});
    expect(larger.custom!.balloonCents).toBeLessThan(small.custom!.balloonCents);
    expect(larger.custom!.interestCents).toBeLessThan(small.custom!.interestCents);
    for(const p of [small.amortizing,small.interestOnly,small.custom!,larger.custom!]){
      expect(p.totalWithBalloonCents-100000).toBe(p.interestCents);
      for(const row of p.rows)expect(row.openingCents+row.interestCents-row.paymentCents).toBe(row.closingCents);
    }
  });
  test('zero rate, early payoff and a larger recast balance behave coherently', () => {
    const free=simulateRepaymentStructures({...base,monthlyRate:0});
    expect(free.amortizing.rows.map(r=>r.paymentCents)).toEqual([33333,33333,33334]);
    expect(free.amortizing.interestCents).toBe(0);
    const early=simulateRepaymentStructures({...base,customPayment:2000}).custom!;
    expect(early.rows.map(r=>r.paymentCents)).toEqual([101000,0,0]);
    expect(early.balloonCents).toBe(0);
    expect(early.interestCents).toBe(1000);
    const recast=simulateRepaymentStructures({...base,principal:1015.15}).amortizing;
    expect(recast.rows.map(r=>r.paymentCents)).toEqual([34517,34517,34518]);
    expect(recast.interestCents).toBe(2037);
  });
  test('invalid author data fails SSR and localized labels reach the semantic UI', () => {
    for(const props of [{principal:0},{monthlyRate:NaN},{monthlyRate:.00001},{months:0},{months:61},{months:1.5},{customPayment:-5},{tableHeaders:['Only one']}])expect(()=>renderToStaticMarkup(createElement(RepaymentStructures,props))).toThrow('RepaymentStructures');
    const html=renderToStaticMarkup(createElement(RepaymentStructures,{locale:'es-ES',chartBeforeLabel:'Saldos antes de la cuota final',capitalizationLabel:'Capitalización pactada',settlementLabel:'Mostrar pago al vencimiento'}));
    expect(html).toContain('Saldos antes de la cuota final');
    expect(html).toContain('Capitalización pactada');
    expect(html).toContain('1.015,15');
    expect(html).toContain('not-prose');
    expect(html).toContain('aria-live="polite"');
  });
});
