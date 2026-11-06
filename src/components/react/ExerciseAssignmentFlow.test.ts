import {describe,expect,test} from 'bun:test';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {calculateExerciseFlow,ExerciseAssignmentFlow,type ExerciseFlowInput} from '@/components/react/ExerciseAssignmentFlow';
const base:ExerciseFlowInput={optionType:'call',position:'long',style:'american',settlement:'physical',phase:'before',strike:95,reference:100,optionBid:7,multiplier:100,contracts:1};
describe('exercise and assignment budget',()=>{
 test('separates the executable closing bid from the exercise value',()=>{
  const m=calculateExerciseFlow(base);
  expect(m.units).toBe(100);expect(m.cashChange).toBe(-9500);expect(m.shareChange).toBe(100);
  expect(m.intrinsicTotal).toBe(500);expect(m.longClosingProceeds).toBe(700);expect(m.closeMinusIntrinsic).toBe(200);
  expect(100*100+m.cashChange).toBe(500);
 });
 test('derives all four physical rights and obligations',()=>{
  for(const [optionType,position,cash,shares] of [['call','long',-9500,100],['call','short',9500,-100],['put','long',9500,-100],['put','short',-9500,100]] as const){
   const m=calculateExerciseFlow({...base,optionType,position});expect(m.cashChange).toBe(cash);expect(m.shareChange).toBe(shares);
  }
 });
 test('cash settlement transfers intrinsic value without delivering shares',()=>{
  for(const optionType of ['call','put'] as const)for(const reference of [0,90,95,100,190]){
   const l=calculateExerciseFlow({...base,optionType,reference,settlement:'cash'});const s=calculateExerciseFlow({...base,optionType,reference,settlement:'cash',position:'short'});
   const direct=100*Math.max(optionType==='call'?reference-95:95-reference,0);
   expect(l.cashChange).toBe(direct);expect(l.cashChange+s.cashChange).toBe(0);expect(l.shareChange).toBe(0);expect(s.shareChange).toBe(0);
  }
 });
 test('style permission is independent of the settlement method',()=>{
  for(const settlement of ['physical','cash'] as const){
   expect(calculateExerciseFlow({...base,settlement}).newExerciseAllowed).toBe(true);
   expect(calculateExerciseFlow({...base,settlement,style:'european'}).newExerciseAllowed).toBe(false);
   expect(calculateExerciseFlow({...base,settlement,style:'european',phase:'expiration'}).newExerciseAllowed).toBe(true);
  }
 });
 test('a closed instruction window is not a claim that prior assignment is impossible',()=>{
  const a=calculateExerciseFlow(base),b=calculateExerciseFlow({...base,phase:'afterCutoff',position:'short'});
  expect(b.newExerciseAllowed).toBe(false);expect(b.cashChange).toBe(-a.cashChange);expect(b.shareChange).toBe(-a.shareChange);
 });
 test('conserves matched transfers and scales contract quantities',()=>{
  for(const optionType of ['call','put'] as const)for(const settlement of ['physical','cash'] as const)for(const reference of [0,80,95,110,190])for(const contracts of [1,3,10]){
   const a=calculateExerciseFlow({...base,optionType,settlement,reference,contracts});const b=calculateExerciseFlow({...base,optionType,settlement,reference,contracts,position:'short'});
   expect(a.cashChange+b.cashChange).toBe(0);expect(a.shareChange+b.shareChange).toBe(0);expect(a.longClosingProceeds).toBe(700*contracts);expect(a.units).toBe(100*contracts);
  }
 });
 test('a positive intrinsic amount does not encode a premium-based investment profit',()=>{
  const m=calculateExerciseFlow({...base,optionBid:3});expect(m.intrinsicTotal).toBe(500);expect(m.closeMinusIntrinsic).toBe(-200);
  expect(m.intrinsicTotal-800).toBe(-300);
 });
 test('author errors throw before rendering',()=>{
  for(const patch of [{strike:0},{reference:NaN},{optionBid:-1},{multiplier:0},{contracts:1.5}])expect(()=>calculateExerciseFlow({...base,...patch})).toThrow('ExerciseAssignmentFlow');
  expect(()=>renderToStaticMarkup(createElement(ExerciseAssignmentFlow,{multiplier:0}))).toThrow('multiplier');
  expect(()=>renderToStaticMarkup(createElement(ExerciseAssignmentFlow,{title:''}))).toThrow('title');
  expect(()=>renderToStaticMarkup(createElement(ExerciseAssignmentFlow,{strike:95,reference:191}))).toThrow('reference');
 });
});
