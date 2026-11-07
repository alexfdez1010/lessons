import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { ImpactCostLab, squareRootImpact, cumulativeImpactCost, impactSegmentCost, signedExecutionCost, illustrativeImpactDecay, rateImpactCost, impactCapacity } from '@/components/react/ImpactCostLab';
test('keeps signed return, average fill and currency amounts distinct for buys and sells',()=>{
 const buy=signedExecutionCost('buy',100,100.4,100.6,100000), sell=signedExecutionCost('sell',100,99.6,99.4,100000);
 for(const z of [buy,sell]){expect(z.averageReturn).toBeCloseTo(.004,12);expect(z.completionReturn).toBeCloseTo(.006,12);expect(z.cash).toBeCloseTo(40000,7);}
 expect(signedExecutionCost('sell',100,100.2,99,10000).cash).toBeCloseTo(-2000,7);
});
test('independent midpoint integration verifies the assumed path average and cash scaling',()=>{
 const Q=100000,N=50000;let sum=0;for(let i=0;i<N;i++)sum+=.02*Math.sqrt((i+.5)*Q/N/1e6)*Q/N*100;
 expect(cumulativeImpactCost(Q)).toBeCloseTo(42163.70213558,6);expect(Math.abs(sum-cumulativeImpactCost(Q))).toBeLessThan(.002);
 expect(squareRootImpact(200000)/squareRootImpact(Q)).toBeCloseTo(Math.sqrt(2),13);expect(cumulativeImpactCost(200000)/cumulativeImpactCost(Q)).toBeCloseTo(2*Math.sqrt(2),13);
 expect(cumulativeImpactCost(0)).toBe(0);expect(cumulativeImpactCost(Q)/Q).toBeLessThan(cumulativeImpactCost(200000)/200000);
});
test('same-path accounting partitions preserve cost, full reset is an extra change',()=>{
 for(const parts of [1,2,4,10,100]){let sum=0;for(let i=0;i<parts;i++)sum+=impactSegmentCost(i*100000/parts,(i+1)*100000/parts);expect(sum).toBeCloseTo(cumulativeImpactCost(100000),7);expect(parts*cumulativeImpactCost(100000/parts)).toBeCloseTo(cumulativeImpactCost(100000)/Math.sqrt(parts),7);}
 const connected=(2/3)*squareRootImpact(100000)*1e4,reset=connected/2;expect(reset+30).toBeGreaterThan(connected);expect(reset).toBeLessThan(connected);
});
test('decay retains transient response at finite horizons and respects the stipulated limit',()=>{
 expect(illustrativeImpactDecay(0,20,30)).toBe(60);expect(illustrativeImpactDecay(30,20,30)).toBe(40);expect(illustrativeImpactDecay(60,20,30)).toBe(30);expect(illustrativeImpactDecay(120,20,30)).toBe(22.5);
 for(const residual of [0,20,60])for(let t=0;t<240;t+=15){expect(illustrativeImpactDecay(t,residual,30)).toBeGreaterThanOrEqual(residual);expect(illustrativeImpactDecay(t+15,residual,30)).toBeLessThanOrEqual(illustrativeImpactDecay(t,residual,30));}
});
test('linear per-share rate concession produces quadratic rate cost and unchanged partition sums',()=>{
 expect(rateImpactCost(100,1)).toEqual({rate:100,concession:.1,cash:10});expect(rateImpactCost(100,2)).toEqual({rate:50,concession:.05,cash:5});
 for(const n of [1,2,4,10])expect(n*rateImpactCost(100/n,1/n).cash).toBeCloseTo(10,13);
});
test('capacity and monetary optimum differ; all test quantities respect the chosen objective',()=>{
 const z=impactCapacity(30,5);expect(z.breakEvenFraction).toBeCloseTo(.03515625,14);expect(z.profitFraction).toBeCloseTo(.015625,14);
 const profit=(x:number)=>100*1e6*x*(.0025-(2/3)*.02*Math.sqrt(x));expect(profit(z.breakEvenFraction)).toBeCloseTo(0,7);expect(profit(z.profitFraction)).toBeCloseTo(1302.0833333333,7);
 for(let i=0;i<=300;i++)expect(profit(i/10000)).toBeLessThanOrEqual(profit(z.profitFraction)+1e-7);
 expect(impactCapacity(5,5)).toEqual({breakEvenFraction:0,profitFraction:0});expect(impactCapacity(4,5)).toEqual({breakEvenFraction:0,profitFraction:0});expect(impactCapacity(55,5).breakEvenFraction/z.breakEvenFraction).toBeCloseTo(4,13);
});
test('author guards reject malformed domains and all seven modes expose localised real scroll tables',()=>{
 for(const props of [{mode:'wrong'},{orderPercent:0},{orderPercent:30.25},{mode:'scale',orderPercent:1.25},{mode:'horizon',orderPercent:21},{labels:{caption:''}}])expect(()=>renderToStaticMarkup(createElement(ImpactCostLab,props as any))).toThrow();
 for(const fn of [()=>squareRootImpact(-1),()=>squareRootImpact(100,0),()=>signedExecutionCost('buy',0,100,100,10),()=>illustrativeImpactDecay(-1,20,30),()=>rateImpactCost(100,0),()=>impactCapacity(30,-1),()=>impactSegmentCost(5,4)])expect(fn).toThrow();
 const labels=JSON.parse(readFileSync('/tmp/lessons-run100/088/es-labels.json','utf8')),en=JSON.parse(readFileSync('/tmp/lessons-run100/088/en-labels.json','utf8'));expect(Object.keys(labels).sort()).toEqual(Object.keys(en).sort());
 for(const mode of ['measurement','scale','horizon','decay','slicing','rate','capacity']as const){const html=renderToStaticMarkup(createElement(ImpactCostLab,{mode,locale:'es-ES',labels}));expect(html).toContain('tabindex="0"');expect(html).toContain('block w-full max-w-full overflow-x-auto');expect(html).toContain(labels.table);expect(html).not.toContain('NaN');expect(html).not.toContain('Infinity');expect(html).not.toMatch(/<svg[^>]*>[\s\S]*?<text /);}
});
