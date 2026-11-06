import {useId,useState} from 'react';
import {cx} from '@/components/react/cx';
export interface AlphaModelFit {
 alpha:number;marketBeta:number;styleBeta:number;marketContribution:number;styleContribution:number;
 residuals:number[];residualVolatility:number;appraisalRatio:number;
}
export interface AlphaModelResult {
 rows:Array<{period:number;market:number;style:number;fund:number;active:number;residual:number}>;
 fundMean:number;marketMean:number;styleMean:number;activeMean:number;trackingError:number;informationRatio:number;
 restricted:AlphaModelFit;full:AlphaModelFit;
}
const mean=(x:number[])=>x.reduce((a,b)=>a+b,0)/x.length;
const dot=(a:number[],b:number[])=>a.reduce((s,v,i)=>s+v*b[i],0);
/** Descriptive volatility uses equal weight 1/N, not a regression standard error. */
const volatility=(x:number[])=>{const m=mean(x);return Math.sqrt(mean(x.map(v=>(v-m)**2)));};
/** Refit the same four invented periods under a market-only and a two-factor model.
 * Return values are percentage points per period; coefficients are dimensionless.
 * The fixed residual is orthogonal to the intercept and both factors. This is a
 * numerical teaching fixture, not a sufficiently sized performance study. */
export function calculateAlphaModels(styleExposure:number,styleMean:number):AlphaModelResult {
 if(!Number.isFinite(styleExposure)||styleExposure< -1||styleExposure>1.5)throw new Error('AlphaModelComparison: styleExposure must be finite from -1 to 1.5.');
 if(!Number.isFinite(styleMean)||styleMean< -.5||styleMean>1.5)throw new Error('AlphaModelComparison: styleMean must be finite from -0.5 to 1.5.');
 const mc=[-2,-1,1,2],orth=[-1,1,1,-1],e=[.2,-.4,.4,-.2];
 const market=mc.map(v=>1+v),style=mc.map((v,i)=>styleMean+.5*v+orth[i]);
 const fund=market.map((v,i)=>.5+v+styleExposure*style[i]+e[i]);
 const ym=mean(fund),mm=mean(market),sm=mean(style),yc=fund.map(v=>v-ym),sc=style.map(v=>v-sm);
 const a=dot(mc,mc),b=dot(mc,sc),c=dot(sc,sc),my=dot(mc,yc),sy=dot(sc,yc);
 const betaR=my/a,det=a*c-b*b,betaM=(my*c-sy*b)/det,betaS=(sy*a-my*b)/det;
 const fit=(marketBeta:number,styleBeta:number):AlphaModelFit=>{
  const alpha=ym-marketBeta*mm-styleBeta*sm;
  const residuals=fund.map((v,i)=>v-alpha-marketBeta*market[i]-styleBeta*style[i]);
  const residualVolatility=volatility(residuals);
  return {alpha,marketBeta,styleBeta,marketContribution:marketBeta*mm,styleContribution:styleBeta*sm,residuals,residualVolatility,appraisalRatio:alpha/residualVolatility};
 };
 const restricted=fit(betaR,0),full=fit(betaM,betaS),active=fund.map((v,i)=>v-market[i]);
 const activeMean=mean(active),trackingError=volatility(active);
 return {rows:market.map((v,i)=>({period:i+1,market:v,style:style[i],fund:fund[i],active:active[i],residual:full.residuals[i]})),fundMean:ym,marketMean:mm,styleMean:sm,activeMean,trackingError,informationRatio:activeMean/trackingError,restricted,full};
}
export interface AlphaModelComparisonProps {
 styleExposure?:number;styleMean?:number;locale?:string;title?:string;exposureLabel?:string;styleMeanLabel?:string;
 restrictedLabel?:string;fullLabel?:string;marketLabel?:string;styleLabel?:string;alphaLabel?:string;totalLabel?:string;
 marketBetaLabel?:string;styleBetaLabel?:string;residualLabel?:string;appraisalLabel?:string;activeLabel?:string;trackingLabel?:string;informationLabel?:string;
 /** Label explaining that all returns use percent per observation period. */
 unitMessage?:string;
 /** Accessible signed-contribution description accepting {model},{market},{style},{alpha},{total}. */
 chartLabel?:string;
 marketReturnLabel?:string;styleReturnLabel?:string;residualReturnLabel?:string;activeReturnLabel?:string;omittedLabel?:string;
 detailsLabel?:string;tableRegionLabel?:string;periodLabel?:string;fundLabel?:string;caption?:string;className?:string;
}
export function AlphaModelComparison({
 styleExposure=1,styleMean=1,locale='en-US',title='Refit the same returns and compare the two ratios',
 exposureLabel='Full-model style exposure',styleMeanLabel='Average style-factor return',restrictedLabel='Market-only fit',fullLabel='Market plus style fit',
 marketLabel='Market contribution',styleLabel='Style contribution',alphaLabel='Model alpha',totalLabel='Average fund excess return',marketBetaLabel='Market beta',styleBetaLabel='Style beta',
 residualLabel='Residual volatility',appraisalLabel='Appraisal ratio',activeLabel='Mean active return versus market',trackingLabel='Tracking error versus market',informationLabel='Information ratio versus market',
 unitMessage='Returns and volatility are percentages per invented observation period. Betas and ratios are dimensionless. Risk-free return is zero; the market is the comparison benchmark.',
 chartLabel='{model}: market contribution {market}, style contribution {style}, alpha {alpha}, total {total}. Bars extend left for negative and right for positive contributions.',
 marketReturnLabel='Market factor return',styleReturnLabel='Style factor return',residualReturnLabel='Full-model residual return',activeReturnLabel='Period active return versus market',omittedLabel='Omitted',
 detailsLabel='Inspect all four return observations',tableRegionLabel='Four invented periods, scroll horizontally if needed',periodLabel='Period',fundLabel='Fund excess return',
 caption='Moving a control generates a different invented fund or factor series. Within each state, both models refit exactly the same fund returns. Volatility uses descriptive equal-weight variance divided by 4, not a degrees-of-freedom-adjusted regression standard error. Four observations do not support an inference of skill, statistical significance or future returns.',className,
}:AlphaModelComparisonProps){
 calculateAlphaModels(styleExposure,styleMean);
 const labels={title,exposureLabel,styleMeanLabel,restrictedLabel,fullLabel,marketLabel,styleLabel,alphaLabel,totalLabel,marketBetaLabel,styleBetaLabel,residualLabel,appraisalLabel,activeLabel,trackingLabel,informationLabel,unitMessage,chartLabel,marketReturnLabel,styleReturnLabel,residualReturnLabel,activeReturnLabel,omittedLabel,detailsLabel,tableRegionLabel,periodLabel,fundLabel,caption};
 for(const [name,value]of Object.entries(labels))if(typeof value!=='string'||!value.trim())throw new Error(`AlphaModelComparison: ${name} must be nonempty.`);
 const fmt=new Intl.NumberFormat(locale,{maximumFractionDigits:4});const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:4});const pct=(v:number)=>percent.format((Math.abs(v)<1e-12?0:v)/100);
 const id=useId();const [exposure,setExposure]=useState(styleExposure),[factorMean,setFactorMean]=useState(styleMean);
 const m=calculateAlphaModels(exposure,factorMean);const models=[{label:restrictedLabel,fit:m.restricted,isRestricted:true},{label:fullLabel,fit:m.full,isRestricted:false}];
 const scale=Math.max(1,...models.flatMap(x=>[Math.abs(x.fit.marketContribution),Math.abs(x.fit.styleContribution),Math.abs(x.fit.alpha)]));
 const inputClass='mt-3 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
 return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6',className)} aria-labelledby={`${id}-title`}>
  <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-2 text-xs leading-relaxed text-ink-600">{unitMessage}</p>
  <div className="mt-5 grid gap-5 sm:grid-cols-2"><label htmlFor={`${id}-exposure`} className="text-sm font-medium">{exposureLabel}: <output>{fmt.format(exposure)}</output><input id={`${id}-exposure`} type="range" min={-1} max={1.5} step={.25} value={exposure} onChange={e=>setExposure(Number(e.target.value))} className={inputClass}/></label><label htmlFor={`${id}-mean`} className="text-sm font-medium">{styleMeanLabel}: <output>{pct(factorMean)}</output><input id={`${id}-mean`} type="range" min={-.5} max={1.5} step={.25} value={factorMean} onChange={e=>setFactorMean(Number(e.target.value))} className={inputClass}/></label></div>
  <div className="mt-6 grid gap-5 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{models.map(({label,fit,isRestricted})=>{
   const values={model:label,market:pct(fit.marketContribution),style:pct(fit.styleContribution),alpha:pct(fit.alpha),total:pct(m.fundMean)};
   const alt=chartLabel.replace(/\{(model|market|style|alpha|total)\}/g,(_,key:keyof typeof values)=>values[key]);
   const bars=[{label:marketLabel,value:fit.marketContribution,fill:'bg-brand-600'},{label:styleLabel,value:fit.styleContribution,fill:'bg-accent-600'},{label:alphaLabel,value:fit.alpha,fill:'bg-ink-500'}];
   return <section key={label} className="rounded-lg bg-surface p-4"><h3 className="font-semibold text-ink-900" style={{margin:0}}>{label}</h3><p className="mt-2 text-sm">{totalLabel}: <strong>{pct(m.fundMean)}</strong></p>
    <div className="mt-4 space-y-3" role="img" aria-label={alt}>{bars.map(bar=><div key={bar.label}><p className="mb-1 flex flex-wrap justify-between gap-2 text-xs"><span>{bar.label}</span><span className="font-mono">{pct(bar.value)}</span></p><div className="relative h-3 rounded-pill bg-ink-100" aria-hidden="true"><span className="absolute top-0 h-3 w-px bg-ink-500" style={{left:'50%'}}/><span className={cx('absolute top-0 h-3',bar.fill)} style={{left:`${bar.value<0?50-50*Math.abs(bar.value)/scale:50}%`,width:`${50*Math.abs(bar.value)/scale}%`}}/></div></div>)}</div>
    <dl className="mt-4 space-y-2 text-sm">{[[marketBetaLabel,fmt.format(fit.marketBeta)],[styleBetaLabel,isRestricted?omittedLabel:fmt.format(fit.styleBeta)],[residualLabel,pct(fit.residualVolatility)],[appraisalLabel,fmt.format(fit.appraisalRatio)]].map(([key,value])=><div key={key} className="flex flex-wrap justify-between gap-2"><dt>{key}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}</dl>
   </section>;
  })}</div>
  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3" aria-live="polite">{[[activeLabel,pct(m.activeMean)],[trackingLabel,pct(m.trackingError)],[informationLabel,fmt.format(m.informationRatio)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd className="mt-1 font-mono text-lg font-semibold">{value}</dd></div>)}</dl>
  <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{detailsLabel}</summary><div className="mt-3"><table tabIndex={0} aria-label={tableRegionLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableRegionLabel}</caption><thead><tr>{[periodLabel,marketReturnLabel,styleReturnLabel,fundLabel,activeReturnLabel,residualReturnLabel].map(label=><th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{m.rows.map(row=><tr key={row.period} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{row.period}</th>{[row.market,row.style,row.fund,row.active,row.residual].map((value,i)=><td key={i} className="p-2 font-mono">{pct(value)}</td>)}</tr>)}</tbody></table></div></details>
  <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
 </figure>;
}
export default AlphaModelComparison;
