import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { calculateReinvestmentGrowth as model, ReinvestmentGrowthValue } from '@/components/react/ReinvestmentGrowthValue';
const base={firstYearNopat:100,reinvestmentRate:.4,incrementalRoic:.15,wacc:.1,years:5};
describe('ReinvestmentGrowthValue',()=>{
  test('reinvestment first earns profit next year and cash allocation reconciles',()=>{
    const r=model(base); expect(r.growth).toBeCloseTo(.06,12); expect(r.rows[0].nopat).toBe(100); expect(r.rows[0].reinvestment).toBe(40); expect(r.rows[0].fcff).toBe(60); expect(r.rows[1].nopat).toBe(106);
    for(const row of r.rows) {expect(row.reinvestment+row.fcff).toBeCloseTo(row.nopat,10); expect(row.presentValue).toBeCloseTo(row.fcff/(1.1)**row.year,10);}
    expect(r.perpetuityValue).toBe(1500); expect(r.noGrowthValue).toBe(1000);
  });
  test('value tracks the marginal return spread, not the growth rate alone',()=>{
    expect(model({...base,incrementalRoic:.1}).perpetuityValue).toBe(1000);
    expect(model({...base,incrementalRoic:.05}).perpetuityValue).toBe(750);
    const more=model({...base,incrementalRoic:.05,reinvestmentRate:.8});
    expect(more.growth).toBeGreaterThan(.02); expect(more.perpetuityValue!).toBeLessThan(750);
    for(const k of [0,.2,.4,.6,.8,.9]) expect(model({...base,incrementalRoic:.1,reinvestmentRate:k}).perpetuityValue).toBeCloseTo(1000,9);
  });
  test('boundary and above-boundary perpetuities are unresolved but finite forecast remains defined',()=>{
    for(const inputs of [{...base,incrementalRoic:.2,reinvestmentRate:.5},{...base,incrementalRoic:.2,reinvestmentRate:.6}]){
      const r=model(inputs); expect(r.perpetuityValue).toBeNull(); expect(Number.isFinite(r.finiteCashFlowPv)).toBe(true); expect(r.rows).toHaveLength(5);
    }
    expect(model({...base,incrementalRoic:.2,reinvestmentRate:.49}).perpetuityValue).toBeGreaterThan(0);
  });
  test('scale and zero-reinvestment invariants',()=>{
    const r=model(base),scaled=model({...base,firstYearNopat:300}); expect(scaled.perpetuityValue).toBe(r.perpetuityValue!*3); expect(scaled.finiteCashFlowPv).toBeCloseTo(r.finiteCashFlowPv*3,9);
    const zero=model({...base,reinvestmentRate:0}); expect(zero.growth).toBe(0); expect(zero.perpetuityValue).toBe(zero.noGrowthValue); expect(zero.rows.every(row=>row.nopat===100&&row.reinvestment===0)).toBe(true);
  });
  test('author guards fail before hooks while meaningful boundary inputs render',()=>{
    for(const bad of [{wacc:0},{firstYearNopat:0},{reinvestmentRate:1},{incrementalRoic:NaN},{years:0},{headers:['one']}])expect(()=>renderToStaticMarkup(createElement(ReinvestmentGrowthValue,{...base,...bad}))).toThrow('ReinvestmentGrowthValue');
    expect(renderToStaticMarkup(createElement(ReinvestmentGrowthValue,{...base,incrementalRoic:.2,reinvestmentRate:.5,invalidLabel:'Sin valor finito',locale:'es-ES'}))).toContain('Sin valor finito');
  });
});
