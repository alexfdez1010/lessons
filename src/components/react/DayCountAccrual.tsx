import{useId,useState}from'react';import{cx}from'@/components/react/cx';
export interface CivilDate {year:number;month:number;day:number;utc:number;}
/** Strict YYYY-MM-DD Gregorian date, with no local timezone or implicit rollover. */
export function parseDayCountDate(value:string):CivilDate{
 const m=typeof value==='string'?/^(\d{4})-(\d{2})-(\d{2})$/.exec(value):null;
 if(!m)throw new Error('DayCountAccrual: date must use YYYY-MM-DD.');
 const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
 if(year<1900||year>2100||month<1||month>12||day<1||day>31)throw new Error('DayCountAccrual: date is outside the supported Gregorian range 1900–2100.');
 const utc=Date.UTC(year,month-1,day),date=new Date(utc);
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('DayCountAccrual: impossible Gregorian date.');
 return{year,month,day,utc};
}
export interface DayCountResult{
 actualDays:number;thirtyEDays:number;actualFraction:number;thirtyEFraction:number;
 actualInterest:number;thirtyEInterest:number;adjustedStartDay:number;adjustedEndDay:number;
 yearDifference:number;monthDifference:number;dayDifference:number;
}
/** Constant-principal, fixed annual simple rate. Plain 30E/360 clamps 31 to 30 at
 * each endpoint; it does not apply 30E/360 ISDA end-of-February rules. */
export function calculateDayCount(start:string,end:string,principal:number,annualRate:number):DayCountResult{
 const s=parseDayCountDate(start),e=parseDayCountDate(end);
 if(e.utc<=s.utc)throw new Error('DayCountAccrual: end must be after start.');
 if(!Number.isFinite(principal)||principal<0||principal>1e12)throw new Error('DayCountAccrual: principal must be finite from 0 to 1e12.');
 if(!Number.isFinite(annualRate)||annualRate<0||annualRate>.25)throw new Error('DayCountAccrual: annualRate must be finite from 0 to 0.25.');
 const actualDays=(e.utc-s.utc)/86400000,adjustedStartDay=Math.min(s.day,30),adjustedEndDay=Math.min(e.day,30);
 const yearDifference=e.year-s.year,monthDifference=e.month-s.month,dayDifference=adjustedEndDay-adjustedStartDay;
 const thirtyEDays=360*yearDifference+30*monthDifference+dayDifference;
 const actualFraction=actualDays/365,thirtyEFraction=thirtyEDays/360;
 return{actualDays,thirtyEDays,actualFraction,thirtyEFraction,actualInterest:principal*annualRate*actualFraction,thirtyEInterest:principal*annualRate*thirtyEFraction,adjustedStartDay,adjustedEndDay,yearDifference,monthDifference,dayDifference};
}
export interface DayCountAccrualProps{
 start?:string;end?:string;principal?:number;annualRate?:number;locale?:string;currency?:string;title?:string;
 startLabel?:string;endLabel?:string;rateLabel?:string;principalLabel?:string;boundaryMessage?:string;
 actualLabel?:string;thirtyELabel?:string;calendarDaysLabel?:string;basisDaysLabel?:string;denominatorLabel?:string;fractionLabel?:string;interestLabel?:string;
 /** Invalid learner dates are a recoverable UI state; invalid author defaults throw. */
 invalidMessage?:string;
 detailsLabel?:string;tableRegionLabel?:string;componentLabel?:string;valueLabel?:string;startComponentLabel?:string;endComponentLabel?:string;
 yearTermLabel?:string;monthTermLabel?:string;dayTermLabel?:string;caption?:string;
 /** Accessible bar description accepts {method},{days},{denominator},{fraction},{interest}. */
 chartLabel?:string;className?:string;
}
export function DayCountAccrual({start='2025-12-31',end='2026-01-31',principal=10000,annualRate=.06,locale='en-US',currency='EUR',
 title='Turn dates into an accrual fraction',startLabel='Accrual start date',endLabel='Accrual end date',rateLabel='Annual simple rate',principalLabel='Constant principal',
 boundaryMessage='The start date is included and the end date is excluded. Dates are accrual boundaries, not necessarily payment dates.',actualLabel='Actual/365 Fixed',thirtyELabel='Plain 30E/360, Eurobond algorithm',calendarDaysLabel='Actual calendar days',basisDaysLabel='Convention numerator',denominatorLabel='Year denominator',fractionLabel='Year fraction',interestLabel='Simple interest accrued',
 invalidMessage='Choose valid dates from 1900 to 2100, with the end after the start. No accrual is calculated for an incomplete or reversed interval.',detailsLabel='Inspect the 30E date-component calculation',tableRegionLabel='Thirty-E date components and numerator, scroll horizontally if needed',componentLabel='Calculation component',valueLabel='Value',startComponentLabel='Start day component after clamping 31 to 30',endComponentLabel='End day component after clamping 31 to 30',yearTermLabel='Year difference times 360',monthTermLabel='Month difference times 30',dayTermLabel='Adjusted end day minus adjusted start day',
 caption='Illustrative fixed-rate simple accrual with unchanged principal, no capitalization, fees, tax or business-day adjustment. Plain 30E/360 changes endpoint day 31 to 30 only; February dates remain their actual day numbers. Other 30/360 variants and other interest methods need their own contractual rules. Amounts shown are rounded; calculations use unrounded values.',
 chartLabel='{method}: numerator {days}, denominator {denominator}, year fraction {fraction}, simple interest {interest}.',className,
}:DayCountAccrualProps){
 calculateDayCount(start,end,principal,annualRate);
 const labels={title,startLabel,endLabel,rateLabel,principalLabel,boundaryMessage,actualLabel,thirtyELabel,calendarDaysLabel,basisDaysLabel,denominatorLabel,fractionLabel,interestLabel,invalidMessage,detailsLabel,tableRegionLabel,componentLabel,valueLabel,startComponentLabel,endComponentLabel,yearTermLabel,monthTermLabel,dayTermLabel,caption,chartLabel};
 for(const[name,value]of Object.entries(labels))if(typeof value!=='string'||!value.trim())throw new Error(`DayCountAccrual: ${name} must be nonempty.`);
 const money=new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2});const number=new Intl.NumberFormat(locale,{maximumFractionDigits:8});const integer=new Intl.NumberFormat(locale,{maximumFractionDigits:0});const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2});
 const id=useId();const[from,setFrom]=useState(start),[to,setTo]=useState(end),[rate,setRate]=useState(annualRate);
 let model:DayCountResult|null=null;try{model=calculateDayCount(from,to,principal,rate);}catch{/* A partial/invalid learner interval is displayed below, without date rollover. */}
 const rows=model?[{method:actualLabel,days:model.actualDays,denominator:365,fraction:model.actualFraction,interest:model.actualInterest},{method:thirtyELabel,days:model.thirtyEDays,denominator:360,fraction:model.thirtyEFraction,interest:model.thirtyEInterest}]:[];
 const maxDays=model?Math.max(1,model.actualDays,model.thirtyEDays):1;
 const fieldClass='mt-2 block w-full min-w-0 rounded-lg border border-ink-300 bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
 return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6',className)} aria-labelledby={`${id}-title`}>
  <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-2 text-sm">{principalLabel}: <strong>{money.format(principal)}</strong></p><p id={`${id}-boundary`} className="mt-2 text-xs leading-relaxed text-ink-600">{boundaryMessage}</p>
  <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="min-w-0"><label htmlFor={`${id}-from`} className="text-sm font-medium">{startLabel}</label><input id={`${id}-from`} type="date" aria-invalid={model===null} aria-describedby={`${id}-${model?'boundary':'error'}`} min="1900-01-01" max="2100-12-31" value={from} onChange={e=>setFrom(e.target.value)} className={fieldClass}/></div><div className="min-w-0"><label htmlFor={`${id}-to`} className="text-sm font-medium">{endLabel}</label><input id={`${id}-to`} type="date" aria-invalid={model===null} aria-describedby={`${id}-${model?'boundary':'error'}`} min="1900-01-01" max="2100-12-31" value={to} onChange={e=>setTo(e.target.value)} className={fieldClass}/></div><label htmlFor={`${id}-rate`} className="text-sm font-medium sm:col-span-2">{rateLabel}: <output>{percent.format(rate)}</output><input id={`${id}-rate`} type="range" min={0} max={.25} step={.001} value={rate} onChange={e=>setRate(Number(e.target.value))} className="mt-3 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"/></label></div>
  {!model?<p id={`${id}-error`} role="alert" className="mt-5 text-sm font-medium text-danger">{invalidMessage}</p>:<>
   <p className="mt-5 text-sm">{calendarDaysLabel}: <strong>{integer.format(model.actualDays)}</strong></p>
   <div className="mt-4 grid gap-4 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{rows.map((row,i)=>{const values={method:row.method,days:integer.format(row.days),denominator:integer.format(row.denominator),fraction:number.format(row.fraction),interest:money.format(row.interest)};const alt=chartLabel.replace(/\{(method|days|denominator|fraction|interest)\}/g,(_,key:keyof typeof values)=>values[key]);return <section key={row.method} className="rounded-lg bg-surface p-4"><h3 className="font-semibold text-ink-900" style={{margin:0}}>{row.method}</h3><div role="img" aria-label={alt} className="mt-4"><p className="mb-2 text-xs">{basisDaysLabel}: <strong>{integer.format(row.days)}</strong></p><div className="h-4 rounded-pill bg-ink-100" aria-hidden="true"><div className={cx('h-4 rounded-pill',i===0?'bg-brand-600':'bg-accent-600')} style={{width:`${100*row.days/maxDays}%`}}/></div></div><dl className="mt-4 space-y-3 text-sm">{[[denominatorLabel,integer.format(row.denominator)],[fractionLabel,number.format(row.fraction)],[interestLabel,money.format(row.interest)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd className="mt-1 break-words font-mono font-semibold">{value}</dd></div>)}</dl></section>;})}</div>
   <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{detailsLabel}</summary><div className="mt-3"><table tabIndex={0} aria-label={tableRegionLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableRegionLabel}</caption><thead><tr><th scope="col" className="p-2 font-semibold">{componentLabel}</th><th scope="col" className="p-2 font-semibold">{valueLabel}</th></tr></thead><tbody>{[[startComponentLabel,model.adjustedStartDay],[endComponentLabel,model.adjustedEndDay],[yearTermLabel,360*model.yearDifference],[monthTermLabel,30*model.monthDifference],[dayTermLabel,model.dayDifference],[basisDaysLabel,model.thirtyEDays]].map(([label,value])=><tr key={label} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{label}</th><td className="p-2 font-mono">{integer.format(Number(value))}</td></tr>)}</tbody></table></div></details>
  </>}
  <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
 </figure>;
}
export default DayCountAccrual;
