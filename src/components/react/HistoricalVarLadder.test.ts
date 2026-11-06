import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';import { renderToStaticMarkup } from 'react-dom/server';
import { calculateEmpiricalTail, HistoricalVarLadder } from '@/components/react/HistoricalVarLadder';
const losses = [380000,250000,170000,90000,30000,-40000,-80000,-150000,-220000,-310000];
describe('inverse empirical quantile and exact empirical ES', () => {
 test('keeps ascending and descending one-based ranks consistent at exact decimal boundaries', () => {
  for (const [n,c,k,rank] of [[10,.9,9,2],[20,.95,19,2],[100,.95,95,6],[100,.99,99,2],[250,.99,248,3],[1000,.99,990,11],[50,.14,7,44]]) {
   const r=calculateEmpiricalTail(Array.from({length:n!},(_,i)=>i+1),c!);
   expect(r.ascendingRank).toBe(k!);expect(r.descendingRank).toBe(rank!);expect(r.valueAtRisk).toBe(k!);
   expect(r.tailCount).toBeCloseTo(n!*(1-c!),10);
  }
 });
 test('changes rank on the correct side of a boundary outside the machine-noise tolerance', () => {
  const x=Array.from({length:10},(_,i)=>i+1), y=Array.from({length:50},(_,i)=>i+1);
  expect(calculateEmpiricalTail(x,.9-1e-8).valueAtRisk).toBe(9);
  expect(calculateEmpiricalTail(x,.9).valueAtRisk).toBe(9);
  expect(calculateEmpiricalTail(x,.9+1e-8).valueAtRisk).toBe(10);
  expect(calculateEmpiricalTail(y,.14-1e-8).valueAtRisk).toBe(7);
  expect(calculateEmpiricalTail(y,.14).valueAtRisk).toBe(7);
  expect(calculateEmpiricalTail(y,.14+1e-8).valueAtRisk).toBe(8);
 });
 test('partial boundary mass fills exactly fifteen percent rather than a whole conditional tail', () => {
  const r=calculateEmpiricalTail(losses,.85);
  expect(r.valueAtRisk).toBe(250000);expect(r.tailCount).toBe(1.5);
  expect(r.expectedShortfall).toBeCloseTo(336666.6666666667,8);
  expect(r.strictExceedanceProbability).toBe(.1);expect(r.boundaryProbabilityUsed).toBe(.05);
  expect(r.rows.map(x=>x.esUnits)).toEqual([1,.5,0,0,0,0,0,0,0,0]);
  expect(r.rows.reduce((s,x)=>s+x.esProbability,0)).toBeCloseTo(.15,14);
  expect(r.interpolatedVaR).toBeCloseTo(222000,8);
  const p=calculateEmpiricalTail(losses,.95);expect(p.valueAtRisk).toBe(380000);
  expect(p.interpolatedVaR).toBeCloseTo(321500,8);
 });
 test('integer tail size excludes the next boundary observation and ties use only needed mass', () => {
  const r=calculateEmpiricalTail(losses,.9);expect(r.valueAtRisk).toBe(250000);
  expect(r.expectedShortfall).toBe(380000);expect(r.rows[1]!.esUnits).toBe(0);
  const tied=calculateEmpiricalTail(losses.map(v=>v===170000?250000:v),.85);
  expect(tied.valueAtRisk).toBe(250000);expect(tied.expectedShortfall).toBe(r.expectedShortfall-43333.333333333314);
  expect(tied.expectedShortfall).toBeCloseTo(336666.6666666667,8);
  expect(tied.boundaryProbabilityUsed).toBe(.05);expect(tied.strictExceedanceProbability).toBe(.1);
  expect(calculateEmpiricalTail([5,5,5,5],.6).expectedShortfall).toBe(5);
 });
 test('near-zero and immediately-below-one confidence retain finite empirical limits', () => {
  const nearOne=1-Number.EPSILON/2;
  for(const x of [[1,2],[3,1,-2],[-10,-5,-1],Array.from({length:1000},(_,i)=>i-500)]){
   const high=calculateEmpiricalTail(x,nearOne),low=calculateEmpiricalTail(x,Number.MIN_VALUE);
   expect(high.valueAtRisk).toBe(Math.max(...x));expect(high.expectedShortfall).toBe(Math.max(...x));
   expect(high.tailCount).toBeGreaterThan(0);expect(high.numericalBoundary).toBe('upper');
   expect(high.rows.reduce((s,v)=>s+v.esUnits,0)).toBeCloseTo(high.tailCount,14);
   expect(low.ascendingRank).toBe(1);expect(low.valueAtRisk).toBe(Math.min(...x));
   expect(low.expectedShortfall).toBeCloseTo(x.reduce((s,v)=>s+v,0)/x.length,10);
   for(const r of [high,low])for(const key of ['valueAtRisk','expectedShortfall','interpolatedVaR','tailCount','boundaryProbabilityUsed'] as const)expect(Number.isFinite(r[key])).toBe(true);
  }
 });
 test('mass, ordering, dominance, scaling and translation hold over a finite grid', () => {
  const sets=[losses,[80,70,60,50,40,30,20,10,5,0,-5,-10,-15,-20,-25,-30,-35,-40,-45,-50],[3,3,3,1,-1,-2],[-9,-7,-3,-1]];
  for(const x of sets)for(const c of [.01,.14,.5,.8,.85,.9,.95,.99,.999]){
   const r=calculateEmpiricalTail(x,c),scale=calculateEmpiricalTail(x.map(v=>3*v),c),shift=calculateEmpiricalTail(x.map(v=>v+7),c),reverse=calculateEmpiricalTail([...x].reverse(),c);
   expect(r.rows.reduce((s,v)=>s+v.esUnits,0)).toBeCloseTo(r.tailCount,10);
   expect(r.rows.every(v=>v.esUnits>=0&&v.esUnits<=1)).toBe(true);
   expect(r.expectedShortfall+1e-8).toBeGreaterThanOrEqual(r.valueAtRisk);
   expect(r.expectedShortfall).toBeLessThanOrEqual(Math.max(...x)+1e-8);
   expect(r.strictExceedanceProbability).toBeLessThanOrEqual(1-c+1e-12);
   expect(x.filter(v=>v>=r.valueAtRisk).length/x.length).toBeGreaterThanOrEqual(1-c-1e-12);
   expect(scale.expectedShortfall).toBeCloseTo(3*r.expectedShortfall,7);
   expect(shift.expectedShortfall).toBeCloseTo(r.expectedShortfall+7,7);
   expect(shift.valueAtRisk).toBe(r.valueAtRisk+7);expect(reverse.expectedShortfall).toBe(r.expectedShortfall);
  }
 });
 test('fixed-size ghost replacement changes the stated sample without extrapolation',()=>{
  const before=calculateEmpiricalTail(losses,.9),after=calculateEmpiricalTail(losses.map(v=>v===380000?0:v),.9);
  expect(before.valueAtRisk-after.valueAtRisk).toBe(80000);expect(before.expectedShortfall-after.expectedShortfall).toBe(130000);
 });
 test('invalid author defaults fail before rendering',()=>{
  for(const c of [0,1,-.1,NaN,Infinity])expect(()=>calculateEmpiricalTail(losses,c)).toThrow('confidence');
  for(const x of [[],[1],[1,NaN],[1,Infinity],[1,1e16]])expect(()=>calculateEmpiricalTail(x,.95)).toThrow('losses');
  expect(()=>renderToStaticMarkup(createElement(HistoricalVarLadder,{losses:[1,NaN]}))).toThrow('losses');
  expect(()=>renderToStaticMarkup(createElement(HistoricalVarLadder,{title:''}))).toThrow('title');
  expect(()=>renderToStaticMarkup(createElement(HistoricalVarLadder,{confidenceLevels:[.9]}))).toThrow('confidenceLevels');
 });
});
