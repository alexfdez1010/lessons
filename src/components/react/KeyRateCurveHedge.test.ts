import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculateKeyRateRisk, keyRateBasis, solveKeyRateHedge, blendedHedgeMatrix, KeyRateCurveHedge } from '@/components/react/KeyRateCurveHedge';
const base = { nodes: [2,5,10] as const, zeroRates: [.03,.04,.05] as const, cashFlows: [{time:2,amount:50},{time:4,amount:50},{time:10,amount:1050}], shockBp: [10,10,10] as const, bumpBp: 1 };
const book = [100,300,200] as const;
describe('zero-curve node sensitivities and multi-bucket hedging', () => {
  test('worked cash flows use the specified continuous rate interpolation', () => {
    const r = calculateKeyRateRisk(base);
    expect(r.price).toBeCloseTo(727.1245088795557, 10);
    expect(r.rows[1]!.basis[0]).toBeCloseTo(1/3,14); expect(r.rows[1]!.basis[1]).toBeCloseTo(2/3,14); expect(r.rows[1]!.basis[2]).toBe(0);
    expect(r.rows[1]!.zeroRate).toBeCloseTo(.03666666666666667,14);
    expect(r.rows.map(row=>row.presentValue)).toEqual([47.08822667921243,43.179089502078206,636.8571926982651]);
    for (const [j,value] of [.20869681992752837,.15835560109180913,8.758571398997596].entries()) expect(r.keyDurations[j]!).toBeCloseTo(value,12);
    expect(r.parallelDuration).toBeCloseTo(9.125623820016934,12);
    expect(r.linearPnl).toBeCloseTo(-6.635464738349389,11);
    expect(r.exactPnl).toBeCloseTo(-6.603288670453026,10);
  });
  test('basis weights partition unity including flat endpoint extrapolation', () => {
    for (const time of [0,1,2,3,4,5,7,10,15,50]) {
      const b = keyRateBasis(time,base.nodes); expect(b.reduce((a,x)=>a+x,0)).toBeCloseTo(1,14); expect(b.every(x=>x>=0&&x<=1)).toBe(true);
    }
    expect(keyRateBasis(1,base.nodes)).toEqual([1,0,0]); expect(keyRateBasis(15,base.nodes)).toEqual([0,0,1]);
  });
  test('derivative KRDs sum to the same-coordinate parallel duration and match central derivatives', () => {
    for (const rates of [[0,0,0],[-.02,0,.01],[.03,.04,.05],[.15,.1,.05]] as const) for (const scale of [.5,1,20]) {
      const r = calculateKeyRateRisk({...base,zeroRates:rates,cashFlows:base.cashFlows.map(flow=>({...flow,amount:scale*flow.amount}))});
      expect(r.keyDurations.reduce((a,b)=>a+b,0)).toBeCloseTo(r.parallelDuration,12);
      expect(r.dv01.reduce((a,b)=>a+b,0)).toBeCloseTo(r.price*r.parallelDuration*.0001,12);
      for (const [j,value] of r.keyDurations.entries()) expect(r.centralKeyDurations[j]!).toBeCloseTo(value,5);
    }
  });
  test('finite central bumps only approximate additivity when flows span node intervals', () => {
    const a = calculateKeyRateRisk({...base,bumpBp:25}), b = calculateKeyRateRisk({...base,bumpBp:12.5});
    const error = (r:typeof a)=>r.centralParallelDuration-r.centralKeyDurations.reduce((a,b)=>a+b,0);
    expect(Math.abs(error(a))).toBeGreaterThan(1e-8);
    expect(error(a)/error(b)).toBeCloseTo(4,3);
  });
  test('exact repricing and directional approximation differ for slope and curvature shocks', () => {
    const slope = calculateKeyRateRisk({...base,shockBp:[-10,0,10]}), curve = calculateKeyRateRisk({...base,shockBp:[-5,10,-5]});
    expect(slope.linearPnl).toBeCloseTo(-6.216823354288122,11); expect(slope.exactPnl).toBeCloseTo(-6.1849537349453385,10);
    expect(curve.linearPnl).toBeCloseTo(3.145016011166382,11); expect(curve.exactPnl).toBeCloseTo(3.1530998631336615,10);
    const zero = calculateKeyRateRisk({...base,shockBp:[0,0,0]}); expect(zero.exactPnl).toBe(0); expect(zero.linearPnl).toBe(-0);
  });
  test('three independent hedge columns solve every bucket and expose rounded residuals', () => {
    const matrix = blendedHedgeMatrix(1), r = solveKeyRateHedge(book,matrix);
    expect(r.positions).toEqual([-5,-6.875,-2.625]); expect(r.condition).toBeCloseTo(3,12); expect(r.residual).toEqual([0,0,0]);
    const rounded = r.positions!.map(Math.round), residual = matrix.map((row,j)=>book[j]!+row.reduce((sum,v,k)=>sum+v*rounded[k]!,0));
    expect(rounded).toEqual([-5,-7,-3]); expect(residual).toEqual([0,-5,-20]);
  });
  test('near-redundant hedges inflate positions and input sensitivity before rank loss', () => {
    const matrix = blendedHedgeMatrix(.01), r = solveKeyRateHedge(book,matrix), perturbed = solveKeyRateHedge([100,300,201],matrix);
    expect(r.positions![0]).toBeCloseTo(-5,12); expect(r.positions![1]).toBeCloseTo(253,9); expect(r.positions![2]).toBeCloseTo(-262.5,9);
    expect(r.condition!).toBeGreaterThan(100); expect(perturbed.positions![2]!-r.positions![2]!).toBeCloseTo(-2,10);
    expect(r.residual!.every(x=>Math.abs(x)<1e-9)).toBe(true);
    const singular = solveKeyRateHedge(book,blendedHedgeMatrix(0)); expect(singular.status).toBe('singular'); expect(singular.positions).toBeNull(); expect(singular.residual).toBeNull(); expect(singular.condition).toBeNull();
  });
  test('singular learner state renders finite explanation instead of a false zero hedge', () => {
    const html = renderToStaticMarkup(createElement(KeyRateCurveHedge,{mode:'hedge',independence:0})); expect(html).toContain('No unique numerical solution'); expect(html).not.toContain('NaN'); expect(html).not.toContain('Infinity');
  });
  test('invalid author inputs fail before hooks', () => {
    for (const patch of [{nodes:[2,2,10]},{zeroRates:[.03,NaN,.05]},{cashFlows:[]},{cashFlows:[{time:-1,amount:100}]},{bumpBp:0},{shockBp:[0,201,0]}]) expect(()=>calculateKeyRateRisk({...base,...patch} as typeof base)).toThrow('KeyRateCurveHedge');
    expect(()=>solveKeyRateHedge(book,[[1,2,3],[4,NaN,6],[7,8,9]])).toThrow('matrix');
    expect(()=>renderToStaticMarkup(createElement(KeyRateCurveHedge,{nodes:[2,2,10]}))).toThrow('increasing');
    expect(()=>renderToStaticMarkup(createElement(KeyRateCurveHedge,{title:''}))).toThrow('title');
  });
});
