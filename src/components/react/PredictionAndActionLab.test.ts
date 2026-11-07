import {expect,test} from 'bun:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {PredictionAndActionLab,proxyPolicyPopulation,abnormalReturn,routingActionPopulation,selectedIndependentPopulation,approximateAlphaInterval} from '@/components/react/PredictionAndActionLab';
test('enumerated noisy population separates correlation, slope and realised policy risk',()=>{
 const z=proxyPolicyPopulation(2,10);expect(z.rows).toHaveLength(8);expect(z.rows.reduce((s,r)=>s+r.mass,0)).toBeCloseTo(1,14);
 const meanX=z.rows.reduce((s,r)=>s+r.mass*r.original,0),meanY=z.rows.reduce((s,r)=>s+r.mass*r.outcome,0),vx=z.rows.reduce((s,r)=>s+r.mass*(r.original-meanX)**2,0),vy=z.rows.reduce((s,r)=>s+r.mass*(r.outcome-meanY)**2,0),cov=z.rows.reduce((s,r)=>s+r.mass*(r.original-meanX)*(r.outcome-meanY),0);
 expect(vx).toBeCloseTo(2,14);expect(vy).toBeCloseTo(.002,14);expect(cov).toBeCloseTo(.02,14);expect(cov/Math.sqrt(vx*vy)).toBeCloseTo(1/Math.sqrt(10),14);expect(z.slope).toBeCloseTo(.01,14);
 expect(z.gross).toBeCloseTo(.01,14);expect(z.cost).toBeCloseTo(.0005,14);expect(z.net).toBeCloseTo(.0095,14);expect(Math.min(...z.rows.map(r=>r.net))).toBeCloseTo(-.021,14);expect(z.rows.filter(r=>r.net<0).reduce((s,r)=>s+r.mass,0)).toBeCloseTo(.25,14);
});
test('forcing a recorded feature changes exposure, not the stipulated underlying outcome law',()=>{
 const observed=proxyPolicyPopulation(2,10);
 for(const policy of ['force-low','force-high']as const){const z=proxyPolicyPopulation(2,10,policy);expect(z.rows.map(r=>r.outcome)).toEqual(observed.rows.map(r=>r.outcome));expect(z.assetMean).toBeCloseTo(0,14);expect(z.featureEffect).toBe(0);expect(z.gross).toBeCloseTo(0,14);expect(z.cost).toBeCloseTo(.001,14);expect(z.net).toBeCloseTo(-.001,14);}
 for(const policy of ['off','force-zero']as const)expect(proxyPolicyPopulation(2,10,policy).net).toBe(0);
});
test('regime frequency and a changed return coefficient have different transport effects',()=>{
 for(const p of [.2,.3,.5,.7,.8]){const z=proxyPolicyPopulation(2,10,'observed',p),mx=z.rows.reduce((s,r)=>s+r.mass*r.original,0),my=z.assetMean,cov=z.rows.reduce((s,r)=>s+r.mass*(r.original-mx)*(r.outcome-my),0),vx=z.rows.reduce((s,r)=>s+r.mass*(r.original-mx)**2,0);expect(z.gross).toBeCloseTo(.01,14);expect(z.net).toBeCloseTo(.0095,14);expect(z.slope).toBeCloseTo(cov/vx,14);expect(my).toBeCloseTo(.02*(2*p-1),14);const reverse=proxyPolicyPopulation(-2,10,'observed',p);expect(reverse.gross).toBeCloseTo(-.01,14);expect(reverse.net).toBeCloseTo(-.0105,14);}
 expect(proxyPolicyPopulation(2,10,'observed',.8).assetMean).toBeCloseTo(.012,14);
});
test('routing selection changes naive means, not the supplied effect, and missing arms are unavailable',()=>{
 for(const q of [0,.1,.2,.5,.8,.9,1])for(const effect of [-10,0,5,10]){const z=routingActionPopulation(q,effect);expect(z.rows.reduce((s,r)=>s+r.mass,0)).toBeCloseTo(1,14);expect(z.modelEffect).toBe(effect);expect(z.observedDifference).toBeCloseTo(effect+40*(2*q-1),12);for(const r of z.rows)expect(r.potential1-r.potential0).toBe(effect);if(q===0||q===1){expect(z.overlap).toBe(false);expect(z.adjustedDifference).toBeNull();expect(z.standardizedTreated).toBeNull();}else{expect(z.overlap).toBe(true);expect(z.adjustedDifference).toBe(effect);expect(z.standardizedTreated).toBe(30+effect);expect(z.standardizedUntreated).toBe(30);}}
 const z=routingActionPopulation(.8,5);expect(z.treated).toBeCloseTo(47,12);expect(z.untreated).toBeCloseTo(18,12);expect(z.observedDifference).toBeCloseTo(29,12);expect(routingActionPopulation(.2,5).observedDifference).toBeCloseTo(-19,12);
});
test('model-relative one-period residual and a separate estimator interval retain their units',()=>{
 expect(abnormalReturn(12,10,2,1.5)).toEqual({excess:10,active:2,benchmark:14,abnormal:-2});expect(abnormalReturn(12,10,2,.5)).toEqual({excess:10,active:2,benchmark:6,abnormal:6});
 const z=approximateAlphaInterval(.2,.3);expect(z.lower).toBeCloseTo(-.388,14);expect(z.upper).toBeCloseTo(.788,14);expect(z.t).toBeCloseTo(2/3,14);expect(approximateAlphaInterval(.2,.1).lower).toBeCloseTo(.004,14);
});
test('future-dependent common-effect selection induces association from independent variables',()=>{
 for(const flag of [false,true]){const z=selectedIndependentPopulation(flag);expect(z.rows.reduce((s,r)=>s+r.analysisMass,0)).toBe(1);expect(z.rows.reduce((s,r)=>s+r.sourceMass,0)).toBe(1);const mean=(a:number)=>z.rows.filter(r=>r.a===a).reduce((s,r)=>s+r.analysisMass*r.y,0)/.5;expect(mean(1)-mean(0)).toBe(z.association);expect(z.modelEffect).toBe(0);}
 expect(selectedIndependentPopulation(true).rows.filter(r=>r.retained).map(r=>[r.a,r.y])).toEqual([[0,0],[1,1]]);
});
test('visible author controls reject invalid steps and all localised modes expose actual focusable tables',()=>{
 for(const props of [{mode:'bad'},{mode:'proxy',coefficientPercent:1},{mode:'proxy',regimePercent:55},{mode:'action',selectionPercent:85},{mode:'selection',conditioned:'yes'},{labels:{caption:''}}])expect(()=>renderToStaticMarkup(createElement(PredictionAndActionLab,props as any))).toThrow();
 for(const f of [()=>proxyPolicyPopulation(20,10),()=>proxyPolicyPopulation(2,-1),()=>proxyPolicyPopulation(2,10,'observed',1.1),()=>routingActionPopulation(1.1,5),()=>routingActionPopulation(.8,11),()=>approximateAlphaInterval(.2,0),()=>abnormalReturn(1,1e308,0,1e308)])expect(f).toThrow();
 const es=JSON.parse(readFileSync('/tmp/lessons-run100/091/es-labels.json','utf8')),en=JSON.parse(readFileSync('/tmp/lessons-run100/091/en-labels.json','utf8'));expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
 for(const mode of ['proxy','alpha','estimate','action','selection']as const){const html=renderToStaticMarkup(createElement(PredictionAndActionLab,{mode,locale:'es-ES',labels:es}));expect(html).toContain('tabindex="0"');expect(html).toContain('block w-full max-w-full overflow-x-auto');expect(html).toContain(es.table);expect(html).not.toContain('NaN');expect(html).not.toContain('Infinity');expect(html).not.toContain('<text ');expect(html).not.toContain('>-0</td>');}
 const missing=renderToStaticMarkup(createElement(PredictionAndActionLab,{mode:'action',selectionPercent:100,labels:es,locale:'es-ES'}));expect(missing).toContain(es.missing);
});
