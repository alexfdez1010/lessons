import { useId, useState } from 'react';

export interface CallModelInput { spot: number; strike: number; volatility: number; years: number; rate: number; }
const finite = (x: number) => Number.isFinite(x);
function validateModel(x: CallModelInput) {
  if (![x.spot,x.strike,x.volatility,x.years,x.rate].every(finite) || x.spot <= 0 || x.strike <= 0 || x.volatility <= 0 || x.years <= 0) throw Error('Call model needs finite inputs, positive spot, strike, volatility and remaining years.');
}
// Integrate the standard normal density using its positive-term series.
// The bounded viewer's d1/d2 values lie inside the computed range; beyond
// eight standard deviations, the omitted probability is below 1e-15.
// Independent tests compare with Python math.erf and account identities.
function normalCdf(x: number) {
  if (x >= 8) return 1;
  if (x <= -8) return 0;
  let term = x, sum = x;
  for (let n = 1; n < 240; n++) {
    term *= x*x/(2*n+1);
    sum += term;
    if (Math.abs(term) <= Math.abs(sum)*1e-16) break;
  }
  return Math.min(1,Math.max(0,.5 + sum*Math.exp(-.5*x*x)/Math.sqrt(2*Math.PI)));
}
/** European no-dividend call, constant continuous financing rate. Vega is per
 * unit volatility (1.00), theta per calendar year as time advances. */
export function hedgeCallModel(x: CallModelInput) {
  validateModel(x);
  const {spot:s,strike:k,volatility:v,years:t,rate:r} = x;
  const d1 = (Math.log(s/k) + (r + .5*v*v)*t)/(v*Math.sqrt(t)), d2 = d1 - v*Math.sqrt(t);
  const phi = Math.exp(-.5*d1*d1)/Math.sqrt(2*Math.PI);
  const result = {value:s*normalCdf(d1)-k*Math.exp(-r*t)*normalCdf(d2),delta:normalCdf(d1),gamma:phi/(s*v*Math.sqrt(t)),theta:-s*phi*v/(2*Math.sqrt(t))-r*k*Math.exp(-r*t)*normalCdf(d2),vega:s*phi*Math.sqrt(t)};
  if (!Object.values(result).every(finite)) throw Error('Call model inputs exceed the finite numerical domain.');
  return result;
}
export interface HedgeIntervalInput { initial: CallModelInput; endSpot: number; endVolatility: number; days: number; multiplier: number; feePerShare: number; }
/** One short call contract, +delta shares, initial net wealth zero. Frozen
 * shares until endpoint; borrowing and lending both accrue at initial.rate.
 * A rebalance exchanges cash and shares at the same endpoint mark. */
export function deltaHedgeInterval(x: HedgeIntervalInput) {
  validateModel(x.initial);
  if (![x.endSpot,x.endVolatility,x.days,x.multiplier,x.feePerShare].every(finite) || x.endSpot <= 0 || x.endVolatility <= 0 || x.days < 0 || x.days/365 >= x.initial.years || x.multiplier <= 0 || x.feePerShare < 0) throw Error('Hedge interval needs positive endpoint inputs and multiplier, a nonnegative fee, and days before expiry.');
  const a=hedgeCallModel(x.initial), b=hedgeCallModel({...x.initial,spot:x.endSpot,volatility:x.endVolatility,years:x.initial.years-x.days/365});
  const m=x.multiplier,h=m*a.delta,cash0=m*a.value-h*x.initial.spot, dt=x.days/365,ds=x.endSpot-x.initial.spot,dv=x.endVolatility-x.initial.volatility;
  const cashBefore=cash0*Math.exp(x.initial.rate*dt), interest=cashBefore-cash0,option=-m*(b.value-a.value),stock=h*ds;
  const gamma=-.5*m*a.gamma*ds*ds,theta=-m*a.theta*dt,vega=-m*a.vega*dv;
  const trade=m*b.delta-h,fee=Math.abs(trade)*x.feePerShare,cashAfter=cashBefore-trade*x.endSpot-fee;
  const exact=option+stock+interest,approx=gamma+theta+vega+interest;
  const result = {initial:a,end:b,shares:h,cash0,cashBefore,cashAfter,interest,option,stock,gamma,theta,vega,exact,approx,residual:exact-approx,trade,fee,endShares:m*b.delta,deltaBefore:h-m*b.delta,deltaAfter:0,wealthBefore:cashBefore+h*x.endSpot-m*b.value,wealthAfter:cashAfter+m*b.delta*x.endSpot-m*b.value};
  if (!Object.values(result).filter(value => typeof value === 'number').every(value => finite(value as number))) throw Error('Hedge interval inputs exceed the finite numerical domain.');
  return result;
}
export function hedgePolicyScore(n:number,a:number,b:number,riskWeight:number) {
  if (![n,a,b,riskWeight].every(finite) || n < 1 || a < 0 || b < 0 || riskWeight < 0) throw Error('Hedge policy needs N at least 1 and nonnegative finite coefficients.');
  const risk=a/Math.sqrt(n),cost=b*Math.sqrt(n);return {risk,cost,score:riskWeight*risk+cost};
}
export interface DeltaLedgerLabels { title:string;spot:string;days:string;volatility:string;initial:string;endpoint:string;quantity:string;value:string;call:string;shares:string;cash:string;delta:string;optionPnl:string;stockPnl:string;interest:string;exact:string;gamma:string;theta:string;vega:string;approx:string;residual:string;trade:string;fee:string;before:string;after:string;table:string;chart:string;caption:string; }
const defaults:DeltaLedgerLabels={title:'A short call, shares and the financing account',spot:'Endpoint stock price (USD)',days:'Elapsed calendar days',volatility:'Endpoint implied volatility (%)',initial:'Initial mark',endpoint:'Endpoint mark',quantity:'Quantity',value:'Value',call:'Call value per share (USD)',shares:'Shares held',cash:'Cash account (USD)',delta:'Net delta (equivalent shares)',optionPnl:'Short call change (USD)',stockPnl:'Frozen-share gain (USD)',interest:'Cash interest (USD)',exact:'Full model repricing P&L (USD)',gamma:'Gamma approximation (USD)',theta:'Theta approximation (USD)',vega:'Vega approximation (USD)',approx:'Taylor plus exact financing (USD)',residual:'Repricing minus approximation (USD)',trade:'Rebalance shares: positive buys',fee:'Rebalance trading cost (USD)',before:'Before rebalance',after:'After rebalance',table:'Exact model values and signed account ledger',chart:'Signed option, share and cash changes, with exact model and local approximation totals. Exact values are in the following table.',caption:'Invented one-contract European no-dividend call: initial stock and strike 100 USD, volatility 20%, remaining time 0.25 years and continuous financing rate 4%. Multiplier 100; fractional shares allowed. Shares stay fixed until the endpoint. All changes are measured from the same initial mark. This is a conditional model calculation, not a price or loss forecast. No initial execution cost is charged; the rebalance fee is shown separately.'};
export interface DeltaHedgeLedgerProps { mode?:'local'|'attribution'|'rebalance';endSpot?:number;days?:number;endVolatility?:number;feePerShare?:number;locale?:string;labels?:Partial<DeltaLedgerLabels>; }
const tableClass='block w-full max-w-full overflow-x-auto rounded-card border border-ink-100 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
const cell='border-b border-ink-100 px-3 py-2 text-left align-top';
const rangeClass='block h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
export function DeltaHedgeLedger({mode='attribution',endSpot=105,days=5,endVolatility=.2,feePerShare=.02,locale='en-US',labels={}}:DeltaHedgeLedgerProps) {
  if (!['local','attribution','rebalance'].includes(mode) || !Number.isInteger(days) || days<0 || days>30 || !finite(endSpot) || endSpot<80 || endSpot>120 || !finite(endVolatility) || endVolatility<.1 || endVolatility>.5) throw Error('DeltaHedgeLedger needs a supported mode, price from 80 to 120, whole days from 0 to 30, and volatility from 10% to 50%.');
  // Validate the authored fee before any hooks, including the local mode.
  if (!Number.isInteger(endSpot) || (mode !== 'local' && Math.abs(endVolatility * 100 - Math.round(endVolatility * 100)) > 1e-9)) throw Error('DeltaHedgeLedger visible controls need whole-unit prices and volatility in whole percentage points.');
  deltaHedgeInterval({initial:{spot:100,strike:100,volatility:.2,years:.25,rate:.04},endSpot,endVolatility,days,multiplier:100,feePerShare});
  const id=useId(),[s,setS]=useState(endSpot),[d,setD]=useState(mode==='local'?0:days),[v,setV]=useState(mode==='local'?.2:endVolatility),l={...defaults,...labels};
  const z=deltaHedgeInterval({initial:{spot:100,strike:100,volatility:.2,years:.25,rate:.04},endSpot:s,endVolatility:v,days:d,multiplier:100,feePerShare});
  const num=(x:number,digits=4)=>new Intl.NumberFormat(locale,{maximumFractionDigits:digits,minimumFractionDigits:2}).format(Math.abs(x)<1e-9?0:x);
  const money=(x:number)=>num(x,2),rows:[string,number][] = mode==='rebalance'?[[l.trade,z.trade],[l.fee,z.fee],[l.cash+' / '+l.before,z.cashBefore],[l.cash+' / '+l.after,z.cashAfter],[l.shares+' / '+l.before,z.shares],[l.shares+' / '+l.after,z.endShares],[l.delta+' / '+l.before,z.deltaBefore],[l.delta+' / '+l.after,z.deltaAfter],[l.exact+' / '+l.before,z.wealthBefore],[l.exact+' / '+l.after,z.wealthAfter]]:[[l.optionPnl,z.option],[l.stockPnl,z.stock],[l.interest,z.interest],[l.exact,z.exact],[l.gamma,z.gamma],[l.theta,z.theta],[l.vega,z.vega],[l.approx,z.approx],[l.residual,z.residual]];
  const bars=mode==='rebalance'?[[l.cash+' / '+l.before,z.cashBefore],[l.cash+' / '+l.after,z.cashAfter]] as [string,number][]:[[l.optionPnl,z.option],[l.stockPnl,z.stock],[l.interest,z.interest],[l.exact,z.exact]] as [string,number][];
  const max=Math.max(1,...bars.map(x=>Math.abs(x[1])));
  return <figure className="not-prose my-6 rounded-card border border-ink-100 bg-surface p-4 shadow-soft"><figcaption className="font-display text-lg font-semibold">{l.title}</figcaption><div className="my-3 grid gap-3 sm:grid-cols-3"><label htmlFor={id+'s'} className="text-sm">{l.spot}: <span className="font-mono">{money(s)}</span><input id={id+'s'} type="range" min={80} max={120} step={1} value={s} onChange={e=>setS(+e.target.value)} className={rangeClass}/></label>{mode!=='local'&&<><label htmlFor={id+'d'} className="text-sm">{l.days}: <span className="font-mono">{d}</span><input id={id+'d'} type="range" min={0} max={30} step={1} value={d} onChange={e=>setD(+e.target.value)} className={rangeClass}/></label><label htmlFor={id+'v'} className="text-sm">{l.volatility}: <span className="font-mono">{money(v*100)}</span><input id={id+'v'} type="range" min={10} max={50} step={1} value={Math.round(v*100)} onChange={e=>setV(+e.target.value/100)} className={rangeClass}/></label></>}</div><dl className="my-3 grid gap-2 text-sm sm:grid-cols-3" aria-live="polite">{[[l.call,z.end.value],[mode==='rebalance'?l.shares+' / '+l.after:l.shares,mode==='rebalance'?z.endShares:z.shares],[mode==='rebalance'?l.exact+' / '+l.before:l.exact,z.exact]].map(([key,value])=><div key={key} className="rounded-card bg-surface-sunken p-3"><dt>{key}</dt><dd className="mt-1 font-mono">{num(value as number)}</dd></div>)}</dl><div role="img" aria-label={l.chart} className="my-4 space-y-3">{bars.map(([label,value])=><div key={label}><div className="mb-1 flex flex-wrap justify-between gap-2 text-sm"><span>{label}</span><span className="font-mono">{money(value)}</span></div><div className="relative flex h-4 bg-surface-sunken"><div className="w-1/2 border-r border-ink-400"/><div className={value<0?'absolute right-1/2 h-4 bg-accent-500':'absolute left-1/2 h-4 bg-brand-600'} style={{width:(Math.abs(value)/max*50)+'%'}}/></div></div>)}</div><table tabIndex={0} aria-label={l.table} className={tableClass}><thead><tr><th className={cell}>{l.quantity}</th><th className={cell}>{l.value}</th></tr></thead><tbody>{rows.map(([label,value])=><tr key={label}><th className={cell}>{label}</th><td className={cell+' whitespace-nowrap font-mono'}>{num(value)}</td></tr>)}</tbody></table><p className="mt-3 text-sm leading-relaxed text-ink-700">{l.caption}</p></figure>;
}
export interface HedgePolicyLabels {title:string;riskWeight:string;costCoefficient:string;risk:string;cost:string;score:string;n:string;best:string;table:string;chart:string;caption:string;}
const policyDefaults:HedgePolicyLabels={title:'Choose an objective before choosing a frequency',riskWeight:'Weight on one USD of P&L standard deviation',costCoefficient:'Cost coefficient b (USD)',risk:'Model P&L standard deviation (USD)',cost:'Assumed expected cost (USD)',score:'Chosen score λ × standard deviation + cost (USD)',n:'Rebalances N',best:'Best integer N in 1–250',table:'Assumed risk cost and chosen score at selected rebalance counts',chart:'Three model curves: declining P&L standard deviation, increasing assumed trading cost, and their chosen weighted score. Horizontal positions use a logarithmic N scale; all vertical values are USD. The table gives exact selected values.',caption:'The horizontal N scale is logarithmic; all three vertical curves use USD. Illustrative assumptions over one fixed horizon: standard deviation = 1000/√N USD; expected trading cost = b√N USD. The dimensionless weight λ converts risk into a decision score, not an expected cash loss. The best count is only for this chosen objective and integer range. These formulas do not establish a universal hedge frequency, monotone results on one realised path, or protection against jumps and model error.'};
export interface HedgePolicyComparisonProps {riskWeight?:number;costCoefficient?:number;locale?:string;labels?:Partial<HedgePolicyLabels>;}
export function HedgePolicyComparison({riskWeight=1,costCoefficient=60,locale='en-US',labels={}}:HedgePolicyComparisonProps) {
  if(!finite(riskWeight)||riskWeight<0||riskWeight>3||!finite(costCoefficient)||costCoefficient<0||costCoefficient>200)throw Error('HedgePolicyComparison needs a risk weight from 0 to 3 and cost coefficient from 0 to 200 USD.');
  if (Math.abs(riskWeight * 10 - Math.round(riskWeight * 10)) > 1e-9 || !Number.isInteger(costCoefficient)) throw Error('HedgePolicyComparison visible controls need risk weight in steps of 0.1 and a whole-USD cost coefficient.');
  const id=useId(),[weight,setWeight]=useState(riskWeight),[cost,setCost]=useState(costCoefficient),l={...policyDefaults,...labels};
  const all=Array.from({length:250},(_,i)=>({n:i+1,...hedgePolicyScore(i+1,1000,cost,weight)}));
  const best=all.reduce((a,b)=>b.score<a.score?b:a);const ns=[1,13,17,63,250];const max=Math.max(...all.map(x=>Math.max(x.risk,x.cost,x.score)));
  const num=(x:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(x);
  // Quantize only SVG coordinates: Node/Chromium Math.log can differ at the last bit.
  const coordinate=(value:number)=>Number(value.toFixed(3));
  const paths=(key:'risk'|'cost'|'score')=>all.map((z,i)=>`${i?'L':'M'} ${coordinate(12+Math.log(z.n)/Math.log(250)*496)} ${coordinate(190-z[key]/max*175)}`).join(' ');
  return <figure className="not-prose my-6 rounded-card border border-ink-100 bg-surface p-4 shadow-soft"><figcaption className="font-display text-lg font-semibold">{l.title}</figcaption><label htmlFor={id+'w'} className="mt-3 block text-sm">{l.riskWeight}: {num(weight)}<input id={id+'w'} type="range" min={0} max={3} step={.1} value={weight} onChange={e=>setWeight(+e.target.value)} className={rangeClass}/></label><label htmlFor={id+'b'} className="mt-3 block text-sm">{l.costCoefficient}: {num(cost)}<input id={id+'b'} type="range" min={0} max={200} step={1} value={cost} onChange={e=>setCost(+e.target.value)} className={rangeClass}/></label><div className="my-3 flex flex-wrap gap-3 text-sm">{[l.risk,l.cost,l.score].map((s,i)=><span key={s} className="inline-flex items-center gap-2"><span className={'h-1 w-5 '+(['bg-ink-500','bg-accent-500','bg-brand-600'][i])}/>{s}</span>)}</div><svg viewBox="0 0 520 205" className="w-full" role="img" aria-label={l.chart}>{(['risk','cost','score']as const).map((key,i)=><path key={key} d={paths(key)} fill="none" stroke={['var(--color-ink-500)','var(--color-accent-500)','var(--color-brand-600)'][i]} strokeWidth={2.5}/>)}<line x1={12} y1={190} x2={508} y2={190} stroke="var(--color-ink-300)"/></svg><div className="flex justify-between font-mono text-sm"><span>N = 1</span><span>N = 250</span></div><p className="my-3 text-sm" aria-live="polite">{l.best}: <strong className="font-mono">{best.n}</strong> / {l.score}: <span className="font-mono">{num(best.score)}</span></p><table tabIndex={0} aria-label={l.table} className={tableClass}><thead><tr>{[l.n,l.risk,l.cost,l.score].map(s=><th key={s} className={cell}>{s}</th>)}</tr></thead><tbody>{ns.map(n=>{const z=all[n-1];return <tr key={n}><th className={cell}>{n}</th>{[z.risk,z.cost,z.score].map((v,i)=><td key={i} className={cell+' whitespace-nowrap font-mono'}>{num(v)}</td>)}</tr>;})}</tbody></table><p className="mt-3 text-sm leading-relaxed text-ink-700">{l.caption}</p></figure>;
}
