import {describe,expect,test} from 'bun:test';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {calculateCopulaTail,COPULA_RHOS,COPULA_NUS,COPULA_QUANTILES,CopulaTailComparison} from '@/components/react/CopulaTailComparison';
describe('finite copula reference probabilities',()=>{
 test('matches the worked conditional and joint calculations',()=>{
  const m=calculateCopulaTail(.5,4,.01);
  expect(m.gaussian).toBeCloseTo(.129392441826476,10);expect(m.student).toBeCloseTo(.287678434851537,10);expect(m.limit).toBeCloseTo(.253169995100323,10);
  expect(m.q*m.gaussian).toBeCloseTo(.00129392441826476,12);expect(m.q*m.student).toBeCloseTo(.00287678434851537,12);
 });
 test('respects probability bounds and finite-grid monotonicity',()=>{
  for(const rho of COPULA_RHOS)for(const nu of COPULA_NUS){
   let g=1,t=1;
   for(const q of COPULA_QUANTILES){
    const m=calculateCopulaTail(rho,nu,q);
    for(const v of [m.gaussian,m.student,m.limit]){expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(1);}
    expect(m.gaussian).toBeLessThanOrEqual(g+1e-10);expect(m.student).toBeLessThanOrEqual(t+1e-10);g=m.gaussian;t=m.student;
    expect(m.q*m.gaussian).toBeLessThanOrEqual(q);expect(m.q*m.student).toBeLessThanOrEqual(q);
    expect(m.student+1e-10).toBeGreaterThanOrEqual(m.limit);
   }
  }
 });
 test('zero Gaussian correlation is independence at every finite grid quantile',()=>{
  for(const nu of COPULA_NUS)for(const q of COPULA_QUANTILES){
   const m=calculateCopulaTail(0,nu,q);expect(m.gaussian).toBeCloseTo(q,10);expect(m.q*m.gaussian).toBeCloseTo(q*q,12);expect(m.student).toBeGreaterThan(q);expect(m.limit).toBeGreaterThan(0);
  }
 });
 test('rho changes t tail dependence even with common nu',()=>{
  for(const nu of COPULA_NUS){
   let previous=-1;
   for(const rho of COPULA_RHOS){const m=calculateCopulaTail(rho,nu,.01);expect(m.limit).toBeGreaterThan(previous);previous=m.limit;}
  }
 });
 test('lower nu increases the coefficient at each supported rho',()=>{
  for(const rho of COPULA_RHOS){expect(calculateCopulaTail(rho,3,.01).limit).toBeGreaterThan(calculateCopulaTail(rho,4,.01).limit);expect(calculateCopulaTail(rho,4,.01).limit).toBeGreaterThan(calculateCopulaTail(rho,10,.01).limit);}
 });
 test('does not return a mutable reference into the data grid',()=>{
  const a=calculateCopulaTail(.5,4,.01);a.gaussian=1;expect(calculateCopulaTail(.5,4,.01).gaussian).toBeLessThan(1);
 });
 test('rejects unsupported author settings rather than interpolating silently',()=>{
  expect(()=>calculateCopulaTail(.4,4,.01)).toThrow('rho');expect(()=>calculateCopulaTail(.5,5,.01)).toThrow('nu');expect(()=>calculateCopulaTail(.5,4,0)).toThrow('q');
  expect(()=>renderToStaticMarkup(createElement(CopulaTailComparison,{q:0}))).toThrow('q');expect(()=>renderToStaticMarkup(createElement(CopulaTailComparison,{title:''}))).toThrow('title');
 });
});
