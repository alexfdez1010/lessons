import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';
export interface DcfOperatingInputs {forecastCashFlows:number[];terminalCashFlow:number;discountRate:number;terminalGrowth:number;}
export interface DcfOperatingResult {explicitPresentValue:number;terminalValue:number|null;terminalPresentValue:number|null;operatingValue:number|null;}
function validateDcfInputs(x:DcfOperatingInputs){
 if(!Array.isArray(x.forecastCashFlows)||x.forecastCashFlows.length>50||x.forecastCashFlows.some(v=>!Number.isFinite(v)||Math.abs(v)>1e15))throw new Error('DcfSensitivityExplorer: forecastCashFlows must contain at most 50 finite amounts.');
 if(!Number.isFinite(x.terminalCashFlow)||x.terminalCashFlow<=0||x.terminalCashFlow>1e15)throw new Error('DcfSensitivityExplorer: terminalCashFlow must be positive and finite.');
 if(!Number.isFinite(x.discountRate)||x.discountRate<=0||x.discountRate>.5||!Number.isFinite(x.terminalGrowth)||x.terminalGrowth<=-1||x.terminalGrowth>.5)throw new Error('DcfSensitivityExplorer: discount rates must be positive and at most 0.5; growth must exceed −1 and be at most 0.5.');
 if(x.terminalGrowth<x.discountRate&&!Number.isFinite(x.terminalCashFlow/(x.discountRate-x.terminalGrowth)))throw new Error('DcfSensitivityExplorer: the rate gap overflows the numerical valuation range.');
}
/** Terminal cash is the independently forecast first payment AFTER the explicit forecast. */
export function calculateDcfOperatingValue(x:DcfOperatingInputs):DcfOperatingResult{
 validateDcfInputs(x);
 const explicitPresentValue=x.forecastCashFlows.reduce((sum,flow,index)=>sum+flow/(1+x.discountRate)**(index+1),0);
 if(x.terminalGrowth>=x.discountRate)return {explicitPresentValue,terminalValue:null,terminalPresentValue:null,operatingValue:null};
 const terminalValue=x.terminalCashFlow/(x.discountRate-x.terminalGrowth),terminalPresentValue=terminalValue/(1+x.discountRate)**x.forecastCashFlows.length;
 return {explicitPresentValue,terminalValue,terminalPresentValue,operatingValue:explicitPresentValue+terminalPresentValue};
}
export interface DcfSensitivityExplorerProps {
 title?:string;discountLabel?:string;growthLabel?:string;valueLabel?:string;valuePrefix?:string;valueSuffix?:string;
 /** First normalized FCFF after the explicit forecast. With no forecast, it is next-year FCFF. */
 baseCashFlow?:number;forecastCashFlows?:number[];discountRates?:number[];growthRates?:number[];
 invalidLabel?:string;caption?:string;tableCaption?:string;cornerLabel?:string;explicitLabel?:string;terminalLabel?:string;terminalCashLabel?:string;locale?:string;currency?:string;className?:string;
}
const DEFAULT_DISCOUNTS=[.07,.08,.09,.1,.11],DEFAULT_GROWTHS=[.01,.02,.03,.04];
export function DcfSensitivityExplorer({title='Operating value across discount and growth assumptions',discountLabel='Annual discount rate',growthLabel='Perpetual growth after the first terminal cash flow',valueLabel='Operating value at date zero',valuePrefix='$',valueSuffix='',baseCashFlow=100,forecastCashFlows=[],discountRates=DEFAULT_DISCOUNTS,growthRates=DEFAULT_GROWTHS,invalidLabel='No finite positive-perpetuity value: growth is at least the discount rate.',caption='Select a cell. The explicit annual cash flows and the first normalized terminal cash flow stay fixed while the discount rate and subsequent perpetual growth change. This is mathematical sensitivity, not a probability interval or a complete operating forecast revision. A valid positive perpetuity requires growth below the discount rate.',tableCaption='Date-zero operating value for every displayed discount-rate and terminal-growth pair.',cornerLabel='r / g',explicitLabel='Present value of explicit forecast',terminalLabel='Present value of terminal cash flows',terminalCashLabel='First normalized cash flow after forecast, fixed',locale='en-US',currency,className}:DcfSensitivityExplorerProps){
 for(const grid of [discountRates,growthRates])if(!Array.isArray(grid)||!grid.length||grid.length>10||new Set(grid).size!==grid.length)throw new Error('DcfSensitivityExplorer: rate grids need one through ten distinct values.');
 for(const r of discountRates)for(const g of growthRates)validateDcfInputs({forecastCashFlows,terminalCashFlow:baseCashFlow,discountRate:r,terminalGrowth:g});
 const id=useId(),[sel,setSel]=useState<[number,number]>([Math.floor(discountRates.length/2),Math.floor(growthRates.length/2)]);
 const ri=Math.min(sel[0],discountRates.length-1),gi=Math.min(sel[1],growthRates.length-1);
 const resultAt=(r:number,g:number)=>calculateDcfOperatingValue({forecastCashFlows,terminalCashFlow:baseCashFlow,discountRate:r,terminalGrowth:g});
 const values=useMemo(()=>discountRates.map(r=>growthRates.map(g=>resultAt(r,g))),[forecastCashFlows,baseCashFlow,discountRates,growthRates]);
 const finite=values.flat().flatMap(result=>result.operatingValue===null?[]:[result.operatingValue]);const min=Math.min(...finite),max=Math.max(...finite);
 const selected=values[ri][gi];
 const pct=(value:number)=>new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2}).format(value);
 const fmt=(value:number)=>currency?new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(value)+valueSuffix:valuePrefix+new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value)+valueSuffix;
 return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5',className)}>
  <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
  <p className="mt-3 text-sm text-ink-700">{terminalCashLabel}: <strong className="font-mono text-ink-900">{fmt(baseCashFlow)}</strong></p>
  <div className="mt-4 min-w-0"><table tabIndex={0} aria-label={tableCaption} className="block w-full max-w-full overflow-x-auto border-collapse text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableCaption}</caption><thead><tr><th scope="col" aria-label={`${discountLabel} / ${growthLabel}`} className="px-2 py-2 text-left text-xs font-medium text-ink-700">{cornerLabel}</th>{growthRates.map((g,index)=><th key={`${id}-${index}`} scope="col" className="whitespace-nowrap px-2 py-2 text-center font-mono text-xs text-ink-700">{pct(g)}</th>)}</tr></thead><tbody>{discountRates.map((r,row)=><tr key={`${id}-${row}`}><th scope="row" className="whitespace-nowrap px-2 py-2 font-mono text-xs text-ink-700">{pct(r)}</th>{growthRates.map((g,col)=>{const value=values[row][col].operatingValue,heat=value===null?0:max===min?.5:(value-min)/(max-min);return <td key={col} className="p-1"><button type="button" aria-pressed={ri===row&&gi===col} aria-label={`${discountLabel} ${pct(r)}, ${growthLabel} ${pct(g)}: ${value===null?invalidLabel:fmt(value)}`} onClick={()=>setSel([row,col])} className={cx('flex min-h-11 w-full min-w-20 items-center justify-center whitespace-nowrap rounded-md px-2 py-2 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600',ri===row&&gi===col&&'ring-2 ring-brand-600 ring-offset-1',value===null&&'bg-ink-100 text-ink-700')} style={value===null?undefined:{backgroundColor:`color-mix(in oklab,var(--color-brand-600) ${Math.round(heat*45)}%,var(--color-surface))`,color:'var(--color-ink-900)'}}>{value===null?'—':fmt(value)}</button></td>;})}</tr>)}</tbody></table></div>
  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" aria-live="polite" aria-atomic="true">{[{label:valueLabel,value:selected.operatingValue},{label:explicitLabel,value:selected.explicitPresentValue},{label:terminalLabel,value:selected.terminalPresentValue}].map(item=><div key={item.label} className="min-w-0"><dt className="text-ink-700">{item.label}</dt><dd className="mt-1 break-words font-mono font-semibold text-ink-900">{item.value===null?invalidLabel:fmt(item.value)}</dd></div>)}</dl>
  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div className="min-w-0"><dt className="text-ink-700">{discountLabel}</dt><dd className="font-mono font-semibold text-ink-900">{pct(discountRates[ri])}</dd></div><div className="min-w-0"><dt className="text-ink-700">{growthLabel}</dt><dd className="font-mono font-semibold text-ink-900">{pct(growthRates[gi])}</dd></div></dl>
  <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
 </figure>;
}
export default DcfSensitivityExplorer;
