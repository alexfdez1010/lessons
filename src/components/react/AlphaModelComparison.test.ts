import{describe,expect,test}from'bun:test';import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
import{calculateAlphaModels,AlphaModelComparison}from'@/components/react/AlphaModelComparison';
describe('refitted factor models and distinct ratios',()=>{
 test('reproduces the four-period positive style example',()=>{
  const m=calculateAlphaModels(1,1);expect(m.rows.map(r=>r.market)).toEqual([-1,0,2,3]);expect(m.rows.map(r=>r.style)).toEqual([-1,1.5,2.5,1]);expect(m.rows.map(r=>r.fund)).toEqual([-1.3,1.6,5.4,4.3]);
  expect(m.fundMean).toBe(2.5);expect(m.restricted.marketBeta).toBeCloseTo(1.5,12);expect(m.restricted.alpha).toBeCloseTo(1,12);expect(m.full.alpha).toBeCloseTo(.5,12);expect(m.full.marketBeta).toBeCloseTo(1,12);expect(m.full.styleBeta).toBeCloseTo(1,12);
 });
 test('adding the style factor can raise alpha despite positive exposure and positive factor mean',()=>{
  const m=calculateAlphaModels(1,.25);expect(m.fundMean).toBeCloseTo(1.75,12);expect(m.restricted.alpha).toBeCloseTo(.25,12);expect(m.full.alpha).toBeCloseTo(.5,12);expect(m.restricted.marketBeta).toBeCloseTo(1.5,12);expect(m.full.marketBeta).toBeCloseTo(1,12);
 });
 test('the projection-intercept identity governs the alpha change',()=>{
  for(const b of [-1,-.5,0,.5,1,1.5])for(const s of [-.5,.25,.5,1,1.5]){
   const m=calculateAlphaModels(b,s);expect(m.restricted.alpha-m.full.alpha).toBeCloseTo(b*(s-.5),10);expect(m.restricted.marketBeta-m.full.marketBeta).toBeCloseTo(.5*b,10);
   for(const fit of[m.restricted,m.full]){
    expect(fit.alpha+fit.marketContribution+fit.styleContribution).toBeCloseTo(m.fundMean,10);
    expect(fit.residuals.reduce((a,v)=>a+v,0)).toBeCloseTo(0,10);
    expect(m.rows.reduce((a,row,i)=>a+row.market*fit.residuals[i],0)).toBeCloseTo(0,10);
    expect(fit.residualVolatility).toBeGreaterThan(0);expect(Number.isFinite(fit.appraisalRatio)).toBe(true);
   }
   expect(m.rows.reduce((a,row,i)=>a+row.style*m.full.residuals[i],0)).toBeCloseTo(0,10);
  }
 });
 test('active return ratio and model residual ratio use different numerators and risks',()=>{
  const m=calculateAlphaModels(1,1);expect(m.activeMean).toBe(1.5);expect(m.trackingError).toBeCloseTo(Math.sqrt(1.725),12);expect(m.informationRatio).toBeCloseTo(1.5/Math.sqrt(1.725),12);
  expect(m.full.residualVolatility).toBeCloseTo(Math.sqrt(.1),12);expect(m.full.appraisalRatio).toBeCloseTo(.5/Math.sqrt(.1),12);expect(m.informationRatio).not.toBeCloseTo(m.full.appraisalRatio,4);
 });
 test('the ratios agree in the special unit-beta market-only case',()=>{
  const m=calculateAlphaModels(0,1);expect(m.activeMean).toBeCloseTo(m.full.alpha,12);expect(m.trackingError).toBeCloseTo(m.full.residualVolatility,12);expect(m.informationRatio).toBeCloseTo(m.full.appraisalRatio,12);
 });
 test('flat projected style intercept leaves alpha unchanged while beta can change',()=>{
  const m=calculateAlphaModels(1,.5);expect(m.restricted.alpha).toBeCloseTo(m.full.alpha,12);expect(m.restricted.marketBeta).not.toBeCloseTo(m.full.marketBeta,4);
 });
 test('guards reject invalid author inputs and empty labels',()=>{
  for(const [b,s]of[[NaN,1],[2,1],[1,Infinity],[1,-1]])expect(()=>calculateAlphaModels(b,s)).toThrow('AlphaModelComparison');
  expect(()=>renderToStaticMarkup(createElement(AlphaModelComparison,{styleMean:Infinity}))).toThrow('styleMean');expect(()=>renderToStaticMarkup(createElement(AlphaModelComparison,{title:''}))).toThrow('title');
 });
});
