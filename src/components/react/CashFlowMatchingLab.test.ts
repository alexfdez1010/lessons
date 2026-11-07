import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { CashFlowMatchingLab, matchingHoldings, bondReceipts, fundingLedger, durationPayment, rollingLadder, matchingStress } from '@/components/react/CashFlowMatchingLab';
const close=(a:number,b:number)=>expect(Math.abs(a-b)).toBeLessThan(2e-10*Math.max(1,Math.abs(b)));
describe('Dated funding under declared contract rules',()=>{
 test('Backwards coupon matching conserves every date, including negative equality candidates',()=>{
  for(const a of[10,50,100,200])for(const b of[10,50,100,200])for(const c of[10,50,100,200]){const x=matchingHoldings([a,b,c]);x.receipts.forEach((v,i)=>close(v,[a,b,c][i]));expect(x.longOnly).toBe(x.holdings.every(q=>q>=0));}
  const x=matchingHoldings([100,100,100]);close(x.cost,75500/273);close(x.holdings[0],250/273);close(x.holdings[2],25/26);expect(matchingHoldings([10,100,200]).longOnly).toBe(false);
  expect(bondReceipts([0,1,2])).toEqual([13,113,208]);
 });
 test('Equal totals do not fund prefixes; funded ledger never assumes borrowing',()=>{
  const x=fundingLedger([0,0,300],[100,100,100]);expect(x.reserve).toBe(200);expect(x.rows.map(r=>r.balance)).toEqual([100,0,200]);
  for(const rate of[-.5,0,.03,.1,1])for(const r of[[0,0,300],[109,109,104],[99.39,99.39,99.84],[10,20,0]]){const x=fundingLedger(r,[100,100,100],rate);expect(x.rows.every(row=>row.balance>=-x.tolerance)).toBe(true);x.rows.forEach(row=>close(row.balance,row.opening*(1+rate)+row.receipt-row.liability));if(x.reserve>0){const lower=x.reserve-1e-6;const gaps=x.rows.map((row,i)=>lower+row.gap);expect(Math.min(...gaps)).toBeLessThan(0);}}
 });
 test('Lot scenarios, costs and floating-point boundary have explicit meanings',()=>{
  const down=fundingLedger(bondReceipts([.91,.91,.96]),[100,100,100]);close(down.reserve,1.38);close(98*.91+99*.91+100*.96+3+down.reserve,279.65);
  const round=fundingLedger(bondReceipts([.92,.92,.96]),[100,100,100]);expect(round.reserve).toBe(0);round.rows.forEach((r,i)=>close(r.balance,[.44,.88,.72][i]));
  const exact=fundingLedger(matchingHoldings([100,100,100]).receipts,[100,100,100]);expect(exact.reserve).toBe(0);
  expect(fundingLedger([100-1e-8,100,100],[100,100,100]).reserve).toBeGreaterThan(9e-9);
 });
 test('PV/duration does not supply a dated payment, and a sold claim is transferred',()=>{
  const x=durationPayment(.04,.04,true);close(x.liabilityPV,100/1.04**2);close(x.available,100);expect(x.remainingClaim).toBe(0);close(x.modifiedDuration,2/1.04);
  const z=durationPayment(0,.08,true);close(z.shortfall,100-(100/1.04/2+52/1.08));
  const held=durationPayment(.04,.04,false);close(held.available,50);close(held.remainingClaim,52);
 });
 test('Renewal and separately assigned default/indexation paths reconcile',()=>{
  close(rollingLadder(.01).surplus,-3.12);close(rollingLadder(.07).atTwo,111.28);
  const d=matchingStress('default',.4,.03);close(100-d.receipts[1],65*250/273);close(d.reserve,65*250/273);close(d.receipts[0],100);
  const i=matchingStress('indexed',.4,.03);close(i.reserve,18.3627);i.liabilities.forEach((v,j)=>close(v,100*1.03**(j+1)));
 });
 test('Domain guards reject invalid author inputs before rendering',()=>{
  for(const f of[()=>matchingHoldings([100,100]),()=>bondReceipts([NaN,1,1]),()=>fundingLedger([100,100,100],[100,100,100],-1),()=>durationPayment(-.01,.04,true),()=>rollingLadder(Infinity),()=>matchingStress('default',1.01,.03)])expect(f).toThrow();
  for(const props of[{quantities:[1e-10,1,1]},{quantities:[Number.MIN_VALUE,1,1]},{quantities:[.30000000000000004,1,1]},{liabilities:[10.00000000001,100,100]}])expect(()=>renderToString(createElement(CashFlowMatchingLab,props))).toThrow();
 });
 test('Every supported native decimal numeral remains identical to authored value',()=>{
  for(let n=0;n<=200;n++){const q=Number((n/100).toFixed(2));expect(()=>renderToString(createElement(CashFlowMatchingLab,{mode:'cash',quantities:[q,q,q]}))).not.toThrow();}
  for(let n=10;n<=200;n+=10)expect(()=>renderToString(createElement(CashFlowMatchingLab,{liabilities:[n,n,n]}))).not.toThrow();
  for(let n=0;n<=10;n++)expect(()=>renderToString(createElement(CashFlowMatchingLab,{cashPct:n,resalePct:n,futurePct:n,inflationPct:n}))).not.toThrow();
 });
 test('All modes and legitimate unfunded/zero states have finite accessible output',()=>{
  for(const mode of['timing','match','cash','duration','rolling','stress'] as const){const s=renderToString(createElement(CashFlowMatchingLab,{mode,quantities:[0,0,0],recoveryPct:0,inflationPct:0,cashPct:0}));expect(s).not.toMatch(/NaN|Infinity/);expect(s).toContain('tabindex="0"');expect(s).toContain('aria-live="polite"');}
 });
});
