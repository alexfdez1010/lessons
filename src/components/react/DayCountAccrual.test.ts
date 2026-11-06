import{describe,expect,test}from'bun:test';import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
import{calculateDayCount,parseDayCountDate,DayCountAccrual}from'@/components/react/DayCountAccrual';
const P=10000,r=.06;
describe('date-only accrual conventions',()=>{
 test('distinguishes31 actual days from30E adjusted days across year-end',()=>{
  const m=calculateDayCount('2025-12-31','2026-01-31',P,r);expect(m.actualDays).toBe(31);expect(m.thirtyEDays).toBe(30);expect(m.adjustedStartDay).toBe(30);expect(m.adjustedEndDay).toBe(30);
  expect(m.actualFraction).toBe(31/365);expect(m.thirtyEFraction).toBe(1/12);expect(m.actualInterest).toBeCloseTo(50.958904109589,10);expect(m.thirtyEInterest).toBe(50);
 });
 test('retains denominator365 in a leap period and a leap calendar year',()=>{
  const feb=calculateDayCount('2024-02-01','2024-03-01',P,r);expect(feb.actualDays).toBe(29);expect(feb.actualFraction).toBe(29/365);expect(feb.thirtyEDays).toBe(30);expect(feb.thirtyEFraction).toBe(30/360);
  const year=calculateDayCount('2024-01-01','2025-01-01',P,r);expect(year.actualDays).toBe(366);expect(year.actualFraction).toBe(366/365);expect(year.thirtyEFraction).toBe(1);
 });
 test('plain30E does not normalize February endpoints to30',()=>{
  const m=calculateDayCount('2024-02-29','2024-03-31',P,r);expect(m.adjustedStartDay).toBe(29);expect(m.adjustedEndDay).toBe(30);expect(m.actualDays).toBe(31);expect(m.thirtyEDays).toBe(31);
 });
 test('a valid one-day calendar interval may have zero30E numerator',()=>{
  const m=calculateDayCount('2026-01-30','2026-01-31',P,r);expect(m.actualDays).toBe(1);expect(m.thirtyEDays).toBe(0);expect(m.thirtyEInterest).toBe(0);
 });
 test('rejects impossible dates instead of accepting Date rollover',()=>{
  for(const date of['2024-02-30','2023-02-29','1900-02-29','2100-02-29','2024-04-31','2024-13-01','2024-00-01','2024-01-00','2024-2-01','2024-02-01T00:00:00Z','', '2101-01-01'])expect(()=>parseDayCountDate(date)).toThrow('DayCountAccrual');
  expect(parseDayCountDate('2000-02-29').day).toBe(29);expect(parseDayCountDate('2024-02-29').day).toBe(29);
 });
 test('UTC arithmetic is unaffected by local daylight-saving transitions',()=>{
  expect(calculateDayCount('2024-03-09','2024-03-11',P,r).actualDays).toBe(2);expect(calculateDayCount('2024-10-26','2024-10-28',P,r).actualDays).toBe(2);
  const moduleUrl=new URL('./DayCountAccrual.tsx',import.meta.url).href;
  for(const zone of['UTC','Europe/Madrid','America/New_York']){
   const source=`import{calculateDayCount}from${JSON.stringify(moduleUrl)};process.stdout.write(String(calculateDayCount('2024-03-09','2024-03-11',10000,.06).actualDays));`;
   const proc=Bun.spawnSync([process.execPath,'-e',source],{env:{...process.env,TZ:zone}});expect(proc.exitCode).toBe(0);expect(proc.stdout.toString()).toBe('2');
  }
 });
 test('fractions and fixed-principal simple accrual are additive over adjacent subperiods',()=>{
  for(const mid of['2024-01-31','2024-02-29','2024-06-15','2024-12-31']){
   const a=calculateDayCount('2024-01-01',mid,P,r),b=calculateDayCount(mid,'2025-01-01',P,r),c=calculateDayCount('2024-01-01','2025-01-01',P,r);
   expect(a.actualDays+b.actualDays).toBe(c.actualDays);expect(a.thirtyEDays+b.thirtyEDays).toBe(c.thirtyEDays);expect(a.actualInterest+b.actualInterest).toBeCloseTo(c.actualInterest,10);expect(a.thirtyEInterest+b.thirtyEInterest).toBeCloseTo(c.thirtyEInterest,10);
  }
 });
 test('handles zero rate/principal and scales a monetary budget',()=>{
  expect(calculateDayCount('2024-02-01','2024-03-01',P,0).actualInterest).toBe(0);expect(calculateDayCount('2024-02-01','2024-03-01',0,r).thirtyEInterest).toBe(0);
  const a=calculateDayCount('2025-12-31','2026-01-31',P,r),b=calculateDayCount('2025-12-31','2026-01-31',P*5,r);expect(b.actualInterest).toBeCloseTo(a.actualInterest*5,10);expect(b.thirtyEInterest).toBe(a.thirtyEInterest*5);
 });
 test('author defaults must be valid before rendering',()=>{
  expect(()=>calculateDayCount('2024-03-01','2024-02-01',P,r)).toThrow('end');expect(()=>calculateDayCount('2024-02-01','2024-02-01',P,r)).toThrow('end');expect(()=>calculateDayCount('2024-02-01','2024-03-01',P,Infinity)).toThrow('annualRate');
  expect(()=>renderToStaticMarkup(createElement(DayCountAccrual,{start:'2024-02-30'}))).toThrow('impossible');expect(()=>renderToStaticMarkup(createElement(DayCountAccrual,{title:''}))).toThrow('title');
 });
});
