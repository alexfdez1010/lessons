import { useId, useState } from 'react';

const requireValue = (ok: boolean, message: string) => { if (!ok) throw new Error(`CashFlowMatchingLab: ${message}`); };
const finite = (x: number) => Number.isFinite(x);
const bounded = (x: number, lo: number, hi: number) => finite(x) && x >= lo && x <= hi;
const tuple = (x: readonly number[], name: string) => requireValue(x.length === 3 && x.every(v => bounded(v, 0, 10000)), `${name} must contain three finite nonnegative amounts no greater than 10,000.`);
export function matchingHoldings(liabilities: readonly number[]) {
  tuple(liabilities, 'Liabilities');
  const [a,b,c] = liabilities;
  const holdings = [(273*a-13*b-10*c)/27300, (26*b-c)/2730, c/104];
  return { holdings, receipts: bondReceipts(holdings), cost: 98*holdings[0]+99*holdings[1]+100*holdings[2], longOnly: holdings.every(q => q >= 0) };
}
export function bondReceipts(q: readonly number[]) {
  requireValue(q.length === 3 && q.every(v => bounded(v,-200,200)), 'Three bond quantities must be finite and between −200 and 200.');
  return [100*q[0]+5*q[1]+4*q[2],105*q[1]+4*q[2],104*q[2]];
}
/** Reserve is supplied at date zero; this ledger never assumes a credit line. */
export function fundingLedger(receipts: readonly number[], liabilities: readonly number[], carryRate = 0) {
  tuple(receipts,'Receipts'); tuple(liabilities,'Liabilities');
  requireValue(bounded(carryRate,-.5,1), 'The assumed annual cash rate must be between −50% and 100%.');
  const gross = 1+carryRate;
  let discountedNet = 0, rawReserve = 0;
  const gaps = receipts.map((receipt,i) => {
    discountedNet += (receipt-liabilities[i])/gross**(i+1);
    rawReserve = Math.max(rawReserve,-discountedNet);
    return discountedNet;
  });
  // Only floating-point noise is removed; the bound is stated in the visual.
  const tolerance = 64*Number.EPSILON*Math.max(1,...receipts,...liabilities)*3;
  const reserve = rawReserve <= tolerance ? 0 : rawReserve;
  let balance = reserve;
  const rows = receipts.map((receipt,i) => {
    const opening = balance, interest = opening*carryRate;
    const rawBalance = opening+interest+receipt-liabilities[i];
    balance = Math.abs(rawBalance) <= tolerance ? 0 : rawBalance;
    return { year:i+1, opening, interest, receipt, liability:liabilities[i], gap:gaps[i], balance };
  });
  return { reserve, rawReserve, tolerance, rows };
}
export function durationPayment(carryRate: number, resaleYield: number, sell: boolean) {
  requireValue(bounded(carryRate,0,.2)&&bounded(resaleYield,0,.2), 'Future rates must be between 0% and 20%.');
  const liabilityPV=100/1.04**2, earlyFace=liabilityPV*1.04/2, lateFace=liabilityPV*1.04**3/2;
  const carried=earlyFace*(1+carryRate), sale=sell?lateFace/(1+resaleYield):0;
  return {liabilityPV,earlyFace,lateFace,carried,sale,available:carried+sale,shortfall:100-carried-sale,remainingClaim:sell?0:lateFace,macDuration:2,modifiedDuration:2/1.04};
}
export function rollingLadder(futureRate: number) {
  requireValue(bounded(futureRate,-.5,1),'The future reinvestment rate must be between −50% and 100%.');
  return { atOne:104, atTwo:104*(1+futureRate), liability:108.16, surplus:104*(1+futureRate)-108.16 };
}
export function matchingStress(kind: 'base'|'default'|'indexed', recovery: number, inflation: number) {
  requireValue(['base','default','indexed'].includes(kind),'Unknown stress.');
  requireValue(bounded(recovery,0,1)&&bounded(inflation,0,.2),'Recovery and liability growth must be in their stated domains.');
  const q=matchingHoldings([100,100,100]).holdings;
  const receipts=bondReceipts(q);
  if(kind==='default') receipts[1] = 100+(100*recovery-105)*q[1];
  const liabilities=[1,2,3].map(t => kind==='indexed'?100*(1+inflation)**t:100);
  return {holdings:q,receipts,liabilities,...fundingLedger(receipts,liabilities)};
}
const labels = {
  title:'Cash by the deadline', caption:'Invented euro cash flows. Payments arrive before the liability on each annual date. Promises are assumed paid unless the selected stress changes them.',
  year:'Year', receipt:'Receipts (€)', liability:'Liability (€)', opening:'Opening cash (€)', interest:'Cash interest (€)', balance:'Funded closing cash (€)', gap:'Discounted cumulative net (€)',
  reserve:'Required initial cash reserve (€)', securities:'Bond purchase cost (€)', fees:'Fees paid at date zero (€)', total:'Initial funding including reserve and fees (€)', budget:'Available initial budget (€)', budgetGap:'Budget surplus / shortfall (€)',
  qA:'Units of bond A',qB:'Units of bond B',qC:'Units of bond C', l1:'Liability at year 1 (€)',l2:'Liability at year 2 (€)',l3:'Liability at year 3 (€)', fee:'Fee per positive bond position (€)', cashRate:'Assumed annual cash carry (%)',
  schedule:'Receipt schedule',late:'All receipts at year 3',matched:'100 on each date',
  exact:'Exact equality candidate',longOnly:'All candidate holdings are nonnegative.',negative:'The equality candidate includes a negative holding. It is not a long-only solution. Allowing surplus cash can yield a different feasible long-only plan.',
  timingScope:'Equal total receipts do not guarantee funding at earlier deadlines. The reserve shown is additional money at date zero, not an assumed loan.',
  reserveScope:'The ledger first supplies the required date-zero reserve, then pays each liability. It does not silently borrow. Only round-off within a stated floating-point bound is treated as zero.', tolerance:'Round-off bound (€)',
  target:'Target liability at year 2 (€)',pv:'Initial liability and asset PV (€)',duration:'Initial Macaulay duration (years)',modified:'Initial modified duration under annual 4% yield',early:'Year-1 zero payment (€)',lateFace:'Year-3 zero claim (€)',carry:'Year-1 payment carried to year 2 (€)',sale:'Sale proceeds at year 2 (€)',available:'Available at year 2 (€)',shortfall:'Liability minus available (€)',remaining:'Claim retained at year 3 (€)',
  resale:'Year-2 yield for the remaining one-year bond (%)',sell:'Sell the remaining bond at year 2',durationScope:'Initial PV and duration use a flat annual-effective 4% curve. Future reinvestment and sale yields are separate scenarios. A sold claim cannot also pay this owner at year 3.',
  future:'Unknown next-year rate: assumed scenario (%)',first:'Year-1 maturity proceeds (€)',terminal:'Year-2 rolled proceeds (€)',rollingLiability:'Year-2 liability (€)',surplus:'Rolled proceeds minus liability (€)',rollingScope:'The first-year 4% return is stipulated. The second-year rate is a scenario, not a forward-rate forecast. A direct two-year promise has different reinvestment exposure.',
  stress:'Stress scenario',base:'All original promises paid',default:'Bond B defaults at year 2',indexed:'Liability grows annually',recovery:'Recovery as % of original face',inflation:'Annual liability growth (%)',stressScope:'Default stress: B pays its year-1 coupon, then replaces the entire year-2 payment of 105 with recovery on original face 100. Indexed-liability stress keeps the original nominal bond receipts.',
  table:'Complete dated funding ledger',summary:'Calculation details',scroll:'Focus the table and use the arrow keys if columns extend beyond the screen.', holdings:'Bond quantities and scheduled receipts',date:'Date',value:'Value',metric:'Metric',currency:'All amounts are euros; quantities are fractions of an original-face-100 bond.',
};
export type CashFlowMatchingLabels = typeof labels;
export interface CashFlowMatchingLabProps {
  mode?: 'timing'|'match'|'cash'|'duration'|'rolling'|'stress'; locale?: string; labels?: Partial<CashFlowMatchingLabels>; title?: string; caption?: string;
  liabilities?: readonly number[]; quantities?: readonly number[]; fee?: number; budget?: number; cashPct?: number; resalePct?: number; futurePct?: number; sellAtTwo?: boolean;
  stress?: 'base'|'default'|'indexed'; recoveryPct?: number; inflationPct?: number; schedule?: 'late'|'matched';
}
function nativeGrid(v:number,min:number,max:number,step:number,name:string){const d=String(step).split('.')[1]?.length??0;const p=Number((min+Math.round((v-min)/step)*step).toFixed(d));requireValue(bounded(v,min,max)&&v===p,`${name} must equal a supported native control value from ${min} to ${max}, step ${step}.`);}
export function CashFlowMatchingLab({mode='match',locale='en-US',labels:overrides={},title,caption,liabilities=[100,100,100],quantities=[1,1,1],fee=1,budget=280,cashPct=0,resalePct=4,futurePct=4,sellAtTwo=true,stress='default',recoveryPct=40,inflationPct=3,schedule='late'}:CashFlowMatchingLabProps){
  requireValue(['timing','match','cash','duration','rolling','stress'].includes(mode),'Unknown mode.');
  tuple(liabilities,'Liabilities');tuple(quantities,'Quantities');
  liabilities.forEach((v,i)=>nativeGrid(v,10,200,10,`Liability ${i+1}`));quantities.forEach((v,i)=>nativeGrid(v,0,2,.01,`Quantity ${i+1}`));
  nativeGrid(fee,0,5,1,'Fee');nativeGrid(budget,250,350,5,'Budget');nativeGrid(cashPct,0,10,1,'Cash rate');nativeGrid(resalePct,0,10,1,'Resale yield');nativeGrid(futurePct,0,10,1,'Future rate');nativeGrid(recoveryPct,0,100,5,'Recovery');nativeGrid(inflationPct,0,10,1,'Liability growth');
  requireValue(['base','default','indexed'].includes(stress)&&['late','matched'].includes(schedule),'Unknown scenario.');
  const l={...labels,...overrides}, id=useId();
  const [ls,setLs]=useState([...liabilities]),[qs,setQs]=useState([...quantities]),[f,setF]=useState(fee),[b,setB]=useState(budget),[cp,setCp]=useState(cashPct),[rp,setRp]=useState(resalePct),[fp,setFp]=useState(futurePct),[selling,setSelling]=useState(sellAtTwo),[s,setS]=useState(stress),[rec,setRec]=useState(recoveryPct),[inf,setInf]=useState(inflationPct),[sch,setSch]=useState(schedule);
  const fmt=(n:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:6,...(n!==0&&Math.abs(n)<1e-6?{notation:'scientific' as const}: {})}).format(Object.is(n,-0)?0:n);
  const range=(key:string,text:string,value:number,min:number,max:number,step:number,onChange:(v:number)=>void)=><label key={key} className="block text-sm text-ink-700" htmlFor={`${id}-${key}`}>{text}<output className="ml-2 font-mono font-semibold text-ink-900">{fmt(value)}</output><input id={`${id}-${key}`} data-control={key} className="mt-1 block h-8 w-full accent-brand-600" type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
  const tableClass='block w-full max-w-full overflow-x-auto text-sm focus-visible:outline-2 focus-visible:outline-brand-600';
  const stats=(rows:[string,string,number][]) => <><p className="my-2 text-sm text-ink-600">{l.scroll}</p><table tabIndex={0} aria-label={l.summary} className={tableClass}><thead><tr><th className="min-w-40 p-2 text-left">{l.metric}</th><th className="p-2 text-right">{l.value}</th></tr></thead><tbody>{rows.map(([key,text,value])=><tr key={key} className="border-t border-ink-200"><th className="p-2 text-left font-normal">{text}</th><td data-value={key} className="whitespace-nowrap p-2 text-right font-mono">{fmt(value)}</td></tr>)}</tbody></table></>;
  const candidate=matchingHoldings(ls);
  const stressData=matchingStress(s,rec/100,inf/100);
  const receipts=mode==='timing'?(sch==='late'?[0,0,300]:[100,100,100]):mode==='match'?candidate.receipts:mode==='stress'?stressData.receipts:bondReceipts(qs);
  // A negative equality candidate is shown algebraically, not passed off as a funded long-only portfolio.
  const ledger=fundingLedger(receipts,mode==='stress'?stressData.liabilities:mode==='match'?ls:[100,100,100],mode==='cash'?cp/100:0);
  const cost=98*qs[0]+99*qs[1]+100*qs[2],fees=qs.filter(q=>q>0).length*f,total=cost+fees+ledger.reserve;
  const duration=durationPayment(cp/100,rp/100,selling),rolling=rollingLadder(fp/100);
  return <section data-cash-mode={mode} className="not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 shadow-soft sm:p-6" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`} className="m-0 font-display text-xl font-semibold text-ink-900">{title??l.title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-600">{caption??l.caption}</p>
    <div className="my-4 grid gap-3 sm:grid-cols-2">
      {mode==='timing'&&<label className="text-sm">{l.schedule}<select data-control="schedule" value={sch} onChange={e=>setSch(e.target.value as typeof sch)} className="mt-1 block min-h-10 w-full rounded-lg border border-ink-200 bg-surface p-2"><option value="late">{l.late}</option><option value="matched">{l.matched}</option></select></label>}
      {mode==='match'&&ls.map((v,i)=>range(`l${i+1}`,[l.l1,l.l2,l.l3][i],v,10,200,10,n=>setLs(ls.map((x,j)=>i===j?n:x))))}
      {mode==='cash'&&<>{qs.map((v,i)=>range(`q${i+1}`,[l.qA,l.qB,l.qC][i],v,0,2,.01,n=>setQs(qs.map((x,j)=>i===j?n:x))))}{range('fee',l.fee,f,0,5,1,setF)}{range('budget',l.budget,b,250,350,5,setB)}{range('cash',l.cashRate,cp,0,10,1,setCp)}</>}
      {mode==='duration'&&<>{range('cash',l.cashRate,cp,0,10,1,setCp)}{range('resale',l.resale,rp,0,10,1,setRp)}<label className="flex min-h-10 items-center gap-3 text-sm"><input data-control="sell" type="checkbox" checked={selling} onChange={e=>setSelling(e.target.checked)}/>{l.sell}</label></>}
      {mode==='rolling'&&range('future',l.future,fp,0,10,1,setFp)}
      {mode==='stress'&&<><label className="text-sm">{l.stress}<select data-control="stress" value={s} onChange={e=>setS(e.target.value as typeof s)} className="mt-1 block min-h-10 w-full rounded-lg border border-ink-200 bg-surface p-2"><option value="base">{l.base}</option><option value="default">{l.default}</option><option value="indexed">{l.indexed}</option></select></label>{range('recovery',l.recovery,rec,0,100,5,setRec)}{range('inflation',l.inflation,inf,0,10,1,setInf)}</>}
    </div>
    <div aria-live="polite" aria-atomic="false">
    {mode==='duration'?<><p className="text-sm text-ink-600">{l.durationScope}</p>{stats([['pv',l.pv,duration.liabilityPV],['duration',l.duration,duration.macDuration],['modified',l.modified,duration.modifiedDuration],['early',l.early,duration.earlyFace],['lateFace',l.lateFace,duration.lateFace],['carry',l.carry,duration.carried],['sale',l.sale,duration.sale],['available',l.available,duration.available],['shortfall',l.shortfall,duration.shortfall],['remaining',l.remaining,duration.remainingClaim]])}</>:
    mode==='rolling'?<><p className="text-sm text-ink-600">{l.rollingScope}</p>{stats([['first',l.first,rolling.atOne],['terminal',l.terminal,rolling.atTwo],['liability',l.rollingLiability,rolling.liability],['surplus',l.surplus,rolling.surplus]])}</>:
    <>
      {mode==='match'&&<><p data-status className="text-sm font-semibold">{candidate.longOnly?l.longOnly:l.negative}</p>{stats(candidate.holdings.map((q,i)=>[`q${i+1}`,[l.qA,l.qB,l.qC][i],q] as [string,string,number]).concat([['cost',l.securities,candidate.cost]]))}</>}
      <p className="text-sm text-ink-600">{mode==='timing'?l.timingScope:mode==='stress'?l.stressScope:l.reserveScope}</p>
      <div className="my-4 grid gap-3 sm:grid-cols-3" aria-label={l.holdings}>{ledger.rows.map(row=>{const scale=Math.max(1,row.receipt,row.liability);return <div key={row.year} className="min-w-0 rounded-lg border border-ink-200 p-3"><p className="m-0 text-sm font-semibold">{l.year} {row.year}</p><p className="my-1 text-sm">{l.receipt}: {fmt(row.receipt)}</p><div aria-hidden className="h-3 rounded bg-brand-100"><div className="h-3 rounded bg-brand-600" style={{width:`${100*row.receipt/scale}%`}}/></div><p className="my-1 text-sm">{l.liability}: {fmt(row.liability)}</p><div aria-hidden className="h-3 rounded bg-accent-100"><div className="h-3 rounded bg-accent-600" style={{width:`${100*row.liability/scale}%`}}/></div></div>})}</div>
      {stats(mode==='cash'?[['reserve',l.reserve,ledger.reserve],['cost',l.securities,cost],['fees',l.fees,fees],['total',l.total,total],['budget',l.budget,b],['budgetGap',l.budgetGap,b-total],['tolerance',l.tolerance,ledger.tolerance]]:[['reserve',l.reserve,ledger.reserve],['tolerance',l.tolerance,ledger.tolerance]])}
      <p className="my-2 text-sm text-ink-600">{l.scroll}</p><table tabIndex={0} aria-label={l.table} className={tableClass}><thead><tr>{[l.year,l.opening,l.interest,l.receipt,l.liability,l.gap,l.balance].map(t=><th key={t} className="min-w-28 p-2 text-right">{t}</th>)}</tr></thead><tbody>{ledger.rows.map(row=><tr key={row.year} className="border-t border-ink-200">{[row.year,row.opening,row.interest,row.receipt,row.liability,row.gap,row.balance].map((v,i)=><td key={i} data-cell={`${row.year}-${i}`} className="whitespace-nowrap p-2 text-right font-mono">{fmt(v)}</td>)}</tr>)}</tbody></table>
    </>}
    </div><p className="mt-3 text-sm text-ink-600">{l.currency}</p>
  </section>;
}
