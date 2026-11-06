import { expect, test } from 'bun:test';
import { ImpermanentLossCurve, calculateImpermanentLoss } from '@/components/react/ImpermanentLossCurve';
const base={depositValue:10000,initialPrice:2000,ratio:2,initialQuoteValue:1,quoteValue:1,feesEarnedPct:0,feeBase:'deposit' as const,costs:0};
test('fee-free inventory preserves k and the final quote, with a holding benchmark of original quantities',()=>{
 const r=calculateImpermanentLoss(base);expect(r.initialA).toBe(2.5);expect(r.initialB).toBe(5000);expect(r.tokenA*r.tokenB).toBeCloseTo(12500,8);expect(r.tokenB/r.tokenA).toBeCloseTo(4000,8);expect(r.hodlValue).toBe(15000);expect(r.lpValue).toBeCloseTo(14142.13562373095,8);expect(r.gap).toBeCloseTo(857.86437626905,8);expect(r.il).toBeCloseTo(-.05719095841793653,12);
});
test('reciprocal relative moves have equal IL but different absolute values',()=>{
 const up=calculateImpermanentLoss(base),down=calculateImpermanentLoss({...base,ratio:.5});expect(up.il).toBeCloseTo(down.il,14);expect(down.hodlValue).toBe(7500);expect(down.lpValue).toBeCloseTo(7071.067811865475,8);expect(down.lpAbsolute).toBeCloseTo(-.2928932188134524,12);expect(up.lpAbsolute).toBeCloseTo(.4142135623730951,12);
});
test('common reporting-currency conversion preserves IL while changing absolute return',()=>{
 const r=calculateImpermanentLoss({...base,quoteValue:.5});expect(r.il).toBeCloseTo(calculateImpermanentLoss(base).il,14);expect(r.hodlValue).toBe(7500);expect(r.lpValue).toBeCloseTo(7071.067811865475,8);expect(r.lpAbsolute).toBeCloseTo(-.2928932188134524,12);
});
test('an 8 percent fee credit has three different monetary denominators',()=>{
 const deposit=calculateImpermanentLoss({...base,feesEarnedPct:8}),lp=calculateImpermanentLoss({...base,feesEarnedPct:8,feeBase:'lp'}),hodl=calculateImpermanentLoss({...base,feesEarnedPct:8,feeBase:'hodl'});
 expect(deposit.feeValue).toBe(800);expect(deposit.netRelative).toBeCloseTo(-.003857625084603189,12);expect(lp.feeValue).toBeCloseTo(1131.370849898476,8);expect(lp.netRelative).toBeCloseTo(.018233764908628477,12);expect(hodl.feeValue).toBe(1200);expect(hodl.netRelative).toBeCloseTo(.02280904158206365,12);expect(hodl.netRelative).toBeCloseTo(hodl.il+.08,14);
});
test('separate costs enter once and change the monetary break-even credit',()=>{
 const r=calculateImpermanentLoss({...base,feesEarnedPct:8,costs:100});expect(r.netValue).toBeCloseTo(14842.13562373095,8);expect(r.netRelative).toBeCloseTo(-.010524291751269787,12);expect(r.breakEvenFees).toBeCloseTo(957.86437626905,8);
});
test('reciprocal bounded range starts at the same allocation and becomes one token at its upper boundary',()=>{
 const entry=calculateImpermanentLoss({...base,ratio:1,rangeUpper:2}),edge=calculateImpermanentLoss({...base,rangeUpper:2}),outside=calculateImpermanentLoss({...base,ratio:4,rangeUpper:2});expect(entry.concentrated?.value).toBeCloseTo(10000,8);expect(entry.concentrated?.tokenA).toBeCloseTo(2.5,12);expect(entry.concentrated?.tokenB).toBeCloseTo(5000,8);expect(edge.concentrated?.tokenA).toBe(0);expect(edge.concentrated?.tokenB).toBeCloseTo(12071.067811865476,8);expect(edge.concentrated?.relative).toBeCloseTo(-.19526214587563495,12);expect(edge.concentrated?.active).toBe(false);expect(outside.concentrated?.value).toBeCloseTo(edge.concentrated!.value,8);expect(outside.concentrated?.relative).toBeCloseTo(-.5171572875253809,12);
});
test('returning to entry removes the ideal fee-free relative gap, not a separate cost',()=>{
 const r=calculateImpermanentLoss({...base,ratio:1,costs:100});expect(r.il).toBe(0);expect(r.lpValue).toBe(10000);expect(r.netRelative).toBeCloseTo(-.01,12);
});
test('scaling the position scales amounts without changing relative comparison',()=>{
 const small=calculateImpermanentLoss(base),large=calculateImpermanentLoss({...base,depositValue:20000});expect(large.lpValue).toBeCloseTo(2*small.lpValue,8);expect(large.gap).toBeCloseTo(2*small.gap,8);expect(large.il).toBe(small.il);
});
test('invalid author maths and chart domains fail before hooks',()=>{
 expect(()=>ImpermanentLossCurve({initialRatio:0})).toThrow('ImpermanentLossCurve');expect(()=>ImpermanentLossCurve({minRatio:1,maxRatio:2})).toThrow('ImpermanentLossCurve');expect(()=>ImpermanentLossCurve({step:0})).toThrow('ImpermanentLossCurve');expect(()=>calculateImpermanentLoss({...base,quoteValue:Number.NaN})).toThrow('ImpermanentLossCurve');expect(()=>calculateImpermanentLoss({...base,rangeUpper:1})).toThrow('ImpermanentLossCurve');expect(()=>calculateImpermanentLoss({...base,feesEarnedPct:-1})).toThrow('ImpermanentLossCurve');expect(()=>calculateImpermanentLoss({...base,rangeUpper:1+Number.EPSILON})).toThrow('ImpermanentLossCurve');expect(()=>calculateImpermanentLoss({...base,initialPrice:1e-310})).toThrow('ImpermanentLossCurve');
});
