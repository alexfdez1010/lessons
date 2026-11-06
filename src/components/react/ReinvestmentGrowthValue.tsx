import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ReinvestmentInputs { firstYearNopat: number; reinvestmentRate: number; incrementalRoic: number; wacc: number; years: number; }
export interface ReinvestmentRow { year: number; nopat: number; reinvestment: number; fcff: number; presentValue: number; }
export interface ReinvestmentResult { growth: number; spread: number; rows: ReinvestmentRow[]; finiteCashFlowPv: number; noGrowthValue: number; perpetuityValue: number | null; }
function validate({firstYearNopat,reinvestmentRate,incrementalRoic,wacc,years}: ReinvestmentInputs) {
  if (!Number.isFinite(firstYearNopat) || firstYearNopat <= 0 || firstYearNopat > 1e9) throw new Error('ReinvestmentGrowthValue: firstYearNopat must be positive and at most one billion.');
  if (!Number.isFinite(reinvestmentRate) || reinvestmentRate < 0 || reinvestmentRate > .9 || Math.abs(reinvestmentRate*100-Math.round(reinvestmentRate*100))>1e-8) throw new Error('ReinvestmentGrowthValue: reinvestmentRate must be 0–0.90 in percentage-point steps.');
  if (!Number.isFinite(incrementalRoic) || incrementalRoic < 0 || incrementalRoic > .4 || Math.abs(incrementalRoic*10000-Math.round(incrementalRoic*10000))>1e-8) throw new Error('ReinvestmentGrowthValue: incrementalRoic must be 0–0.40 in basis-point steps.');
  if (!Number.isFinite(wacc) || wacc < .01 || wacc > .3 || Math.abs(wacc*10000-Math.round(wacc*10000))>1e-8) throw new Error('ReinvestmentGrowthValue: wacc must be 0.01–0.30 in basis-point steps.');
  if (!Number.isInteger(years) || years < 1 || years > 10) throw new Error('ReinvestmentGrowthValue: years must be an integer from one through ten.');
}
/** End-of-year reinvestment first earns NOPAT next year. The first-year NOPAT is fixed. */
export function calculateReinvestmentGrowth(inputs: ReinvestmentInputs): ReinvestmentResult {
  validate(inputs);
  const {firstYearNopat,reinvestmentRate,incrementalRoic,wacc,years}=inputs;
  const growthNumerator=Math.round(reinvestmentRate*100)*Math.round(incrementalRoic*10000);
  const growth=growthNumerator/1e6;
  const denominatorNumerator=Math.round(wacc*10000)*100-growthNumerator;
  const rows=Array.from({length:years},(_,index)=> {
    const year=index+1;
    const nopat=firstYearNopat*(1+growth)**index;
    const reinvestment=nopat*reinvestmentRate;
    const fcff=nopat-reinvestment;
    return {year,nopat,reinvestment,fcff,presentValue:fcff/(1+wacc)**year};
  });
  return {growth,spread:incrementalRoic-wacc,rows,finiteCashFlowPv:rows.reduce((sum,row)=>sum+row.presentValue,0),noGrowthValue:firstYearNopat/wacc,perpetuityValue:denominatorNumerator>0?firstYearNopat*(1-reinvestmentRate)/(denominatorNumerator/1e6):null};
}
export interface ReinvestmentGrowthValueProps extends Partial<ReinvestmentInputs> {
  title?: string; reinvestmentLabel?: string; roicLabel?: string; waccLabel?: string; growthLabel?: string; spreadLabel?: string;
  firstYearLabel?: string; reinvestedLabel?: string; fcffLabel?: string; yearLabel?: string; chartLabel?: string;
  baselineLabel?: string; policyLabel?: string; differenceLabel?: string; invalidLabel?: string; finiteLabel?: string; finiteNote?: string;
  showCapitalCharge?: boolean; capitalChartLabel?: string; extraProfitLabel?: string; chargeLabel?: string; economicProfitLabel?: string; capitalNote?: string;
  allocationLabel?: string; valueChartLabel?: string; tableLabel?: string; headers?: string[]; caption?: string; locale?: string; currency?: string; className?: string;
}
export function ReinvestmentGrowthValue({firstYearNopat=100,reinvestmentRate=.4,incrementalRoic=.15,wacc=.1,years=5,
  showCapitalCharge=false,capitalChartLabel='Annual profit earned by the first new investment versus its annual opportunity-cost charge.',extraProfitLabel='Additional annual NOPAT from year 2',chargeLabel='Annual opportunity-cost charge on first reinvestment',economicProfitLabel='Incremental annual economic profit',capitalNote='The capital charge is not an extra cash payment. Do not subtract it again from FCFF before discounting at the cost of capital.',
  title='What does reinvestment buy?',reinvestmentLabel='Share of annual NOPAT reinvested',roicLabel='After-tax return on new investment',waccLabel='Annual cost of capital',growthLabel='Modelled annual NOPAT growth',spreadLabel='New-investment return minus cost',firstYearLabel='First-year NOPAT, fixed',reinvestedLabel='Net reinvestment',fcffLabel='FCFF available to capital providers',yearLabel='Year',chartLabel='Each year’s operating profit is split between net reinvestment and free cash flow. All bars use the same amount scale.',baselineLabel='No-growth operating value',policyLabel='Policy operating value',differenceLabel='Value change versus no growth',invalidLabel='No finite growing-perpetuity value: growth is at least the discount rate.',finiteLabel='Present value of displayed FCFF only',finiteNote='This finite sum excludes all later cash flows and any terminal value. It is not the whole business value.',allocationLabel='Annual cash allocation',valueChartLabel='No-growth and policy operating values on one common amount scale.',tableLabel='Annual forecast and discounted cash flows',headers=['Year','NOPAT','Net reinvestment','FCFF','Discounted FCFF'],caption='Invented annual model. The first-year after-tax operating profit is fixed. Reinvestment occurs at each year-end and earns the selected after-tax return from the next year. Existing operations are maintained; risk, taxes, return and reinvestment policy stay constant. The perpetuity requires growth below the cost of capital forever. Values are rounded only for display, not inside the calculations.',locale='en-US',currency='EUR',className}:ReinvestmentGrowthValueProps) {
  validate({firstYearNopat,reinvestmentRate,incrementalRoic,wacc,years});
  if(!Array.isArray(headers)||headers.length!==5||headers.some(label=>typeof label!=='string'||!label.trim()))throw new Error('ReinvestmentGrowthValue: headers must contain five non-empty labels.');
  const id=useId();
  const [inputs,setInputs]=useState({reinvestmentRate,incrementalRoic,wacc});
  const result=calculateReinvestmentGrowth({firstYearNopat,years,...inputs});
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(value);
  const percent=(value:number)=>new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2}).format(value);
  const signedMoney=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,signDisplay:'exceptZero',maximumFractionDigits:2}).format(value);
  const max=Math.max(...result.rows.map(row=>row.nopat));
  const valueMax=Math.max(result.noGrowthValue,result.perpetuityValue??0);
  const controls=[{key:'reinvestmentRate' as const,label:reinvestmentLabel,min:0,max:.9,step:.01},{key:'incrementalRoic' as const,label:roicLabel,min:0,max:.4,step:.0001},{key:'wacc' as const,label:waccLabel,min:.01,max:.3,step:.0001}];
  return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5',className)}>
    <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">{controls.map(control=><div key={control.key} className="min-w-0"><label htmlFor={`${id}-${control.key}`} className="block text-sm text-ink-700">{control.label}<output htmlFor={`${id}-${control.key}`} className="mt-1 block font-mono font-semibold text-ink-900">{percent(inputs[control.key])}</output></label><input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={inputs[control.key]} aria-valuetext={percent(inputs[control.key])} onChange={event=>setInputs(previous=>({...previous,[control.key]:Number(event.target.value)}))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></div>)}</div>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" aria-live="polite" aria-atomic="true">
      {[{label:firstYearLabel,value:money(firstYearNopat)},{label:growthLabel,value:percent(result.growth)},{label:spreadLabel,value:percent(result.spread)}].map(item=><div key={item.label} className="min-w-0"><dt className="text-ink-600">{item.label}</dt><dd className="font-mono font-semibold text-ink-900">{item.value}</dd></div>)}
    </dl>
    {showCapitalCharge&&<div className="mt-4 rounded-card bg-surface p-3"><dl className="space-y-3 text-sm" aria-label={capitalChartLabel} aria-live="polite" aria-atomic="true">{[{label:extraProfitLabel,value:result.rows[0].reinvestment*inputs.incrementalRoic},{label:chargeLabel,value:result.rows[0].reinvestment*inputs.wacc}].map(item=><div key={item.label}><dt className="text-ink-700">{item.label}</dt><dd className="font-mono font-semibold">{money(item.value)}</dd><div className="mt-1 h-2 rounded-pill bg-ink-100" aria-hidden="true"><div className="h-full rounded-pill bg-brand-600" style={{width:`${item.value/Math.max(1,result.rows[0].reinvestment*inputs.incrementalRoic,result.rows[0].reinvestment*inputs.wacc)*100}%`}} /></div></div>)}<div><dt className="text-ink-700">{economicProfitLabel}</dt><dd className="font-mono font-semibold">{signedMoney(result.rows[0].reinvestment*result.spread)}</dd></div></dl><p className="mt-3 text-xs leading-relaxed text-ink-700">{capitalNote}</p></div>}
    <h3 className="mt-5 text-sm font-semibold text-ink-900">{allocationLabel}</h3>
    <p className="mt-1 text-xs text-ink-700"><span className="font-semibold text-brand-700">{reinvestedLabel}</span> + <span className="font-semibold text-accent-700">{fcffLabel}</span></p>
    <ol className="mt-3 list-none space-y-3 p-0" aria-label={chartLabel}>{result.rows.map(row=><li key={row.year} className="min-w-0"><div className="flex flex-wrap justify-between gap-2 text-xs text-ink-700"><span>{yearLabel} {row.year}</span><span className="font-mono">{money(row.reinvestment)} + {money(row.fcff)} = {money(row.nopat)}</span></div><div className="mt-1 flex h-4 w-full" aria-hidden="true"><div className="h-full rounded-l-pill bg-brand-600" style={{width:`${row.reinvestment/max*100}%`}} /><div className="h-full rounded-r-pill bg-accent-600" style={{width:`${row.fcff/max*100}%`}} /></div></li>)}</ol>
    <div className="mt-5 rounded-card bg-surface p-3" aria-live="polite" aria-atomic="true">
      <dl className="space-y-3 text-sm" aria-label={valueChartLabel}>{[{label:baselineLabel,value:result.noGrowthValue},{label:policyLabel,value:result.perpetuityValue}].map(item=><div key={item.label}><dt className="text-ink-700">{item.label}</dt><dd className="font-mono font-semibold text-ink-900">{item.value===null?invalidLabel:money(item.value)}</dd>{item.value!==null&&<div className="mt-1 h-2 rounded-pill bg-ink-100" aria-hidden="true"><div className="h-full rounded-pill bg-ink-700" style={{width:`${item.value/valueMax*100}%`}} /></div>}</div>)}</dl>
      {result.perpetuityValue!==null&&<p className="mt-3 text-sm text-ink-700">{differenceLabel}: <strong className="font-mono text-ink-900">{signedMoney(result.perpetuityValue-result.noGrowthValue)}</strong></p>}
    </div>
    <p className="mt-4 text-sm text-ink-700">{finiteLabel}: <strong className="font-mono text-ink-900">{money(result.finiteCashFlowPv)}</strong>. {finiteNote}</p>
    <details className="mt-3 text-sm"><summary className="w-fit cursor-pointer rounded-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{tableLabel}</summary><div className="mt-3 min-w-0"><table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{headers.map(label=><th key={label} scope="col" className="whitespace-nowrap px-2 py-2 text-ink-700">{label}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr key={row.year}><th scope="row" className="px-2 py-2 font-medium">{row.year}</th>{[row.nopat,row.reinvestment,row.fcff,row.presentValue].map((value,index)=><td key={index} className="whitespace-nowrap px-2 py-2 font-mono text-ink-800">{money(value)}</td>)}</tr>)}</tbody></table></div></details>
    <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default ReinvestmentGrowthValue;
