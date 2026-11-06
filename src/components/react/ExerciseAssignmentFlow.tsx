import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export type ExerciseOptionType = 'call' | 'put';
export type ExercisePosition = 'long' | 'short';
export type ExerciseStyle = 'american' | 'european';
export type ExerciseSettlement = 'physical' | 'cash';
export type ExercisePhase = 'before' | 'expiration' | 'afterCutoff';
export interface ExerciseFlowInput {
  optionType: ExerciseOptionType;
  position: ExercisePosition;
  style: ExerciseStyle;
  settlement: ExerciseSettlement;
  phase: ExercisePhase;
  strike: number;
  reference: number;
  optionBid: number;
  multiplier: number;
  contracts: number;
}
export interface ExerciseFlowResult {
  units: number;
  intrinsicPerUnit: number;
  intrinsicTotal: number;
  /** Exact change if a valid exercise/assignment occurs; not a predicted event. */
  cashChange: number;
  shareChange: number;
  /** Cash from closing the long at the specified executable bid, excluding entry premium. */
  longClosingProceeds: number;
  closeMinusIntrinsic: number;
  /** Whether the simplified selected window accepts a new exercise instruction. */
  newExerciseAllowed: boolean;
}

/** Generic plain-vanilla contract. Cash reference is the contractual settlement value,
 * not necessarily an executable stock price. USD and contract multiplier are UI inputs. */
export function calculateExerciseFlow(input: ExerciseFlowInput): ExerciseFlowResult {
  for (const [key, allowed] of Object.entries({optionType:['call','put'],position:['long','short'],style:['american','european'],settlement:['physical','cash'],phase:['before','expiration','afterCutoff']})) {
    if (!allowed.includes(String(input[key as keyof ExerciseFlowInput]))) throw new Error(`ExerciseAssignmentFlow: invalid ${key}.`);
  }
  for (const [key, min, max] of [['strike',1,1e6],['reference',0,2e6],['optionBid',0,1e6]] as const) {
    if (!Number.isFinite(input[key]) || input[key] < min || input[key] > max) throw new Error(`ExerciseAssignmentFlow: ${key} must be finite and between ${min} and ${max}.`);
  }
  for (const key of ['multiplier','contracts'] as const)
    if (!Number.isInteger(input[key]) || input[key] < 1 || input[key] > 1000) throw new Error(`ExerciseAssignmentFlow: ${key} must be an integer from 1 to 1000.`);
  const units = input.multiplier * input.contracts;
  const intrinsicPerUnit = Math.max(input.optionType === 'call' ? input.reference-input.strike : input.strike-input.reference, 0);
  const intrinsicTotal = intrinsicPerUnit * units;
  const sign = input.position === 'long' ? 1 : -1;
  const cashChange = input.settlement === 'cash'
    ? sign * intrinsicTotal
    : sign * (input.optionType === 'call' ? -1 : 1) * input.strike * units;
  const shareChange = input.settlement === 'cash' ? 0 : sign * (input.optionType === 'call' ? 1 : -1) * units;
  return {
    units, intrinsicPerUnit, intrinsicTotal, cashChange, shareChange,
    longClosingProceeds: input.optionBid * units,
    closeMinusIntrinsic: (input.optionBid - intrinsicPerUnit) * units,
    newExerciseAllowed: input.phase !== 'afterCutoff' && (input.style === 'american' || input.phase === 'expiration'),
  };
}

/** Locale-agnostic controls and a conditional settlement budget; no exercise is submitted. */
export interface ExerciseAssignmentFlowProps extends Partial<ExerciseFlowInput> {
  title?: string;
  locale?: string;
  currency?: string;
  typeLabel?: string;
  callLabel?: string;
  putLabel?: string;
  positionLabel?: string;
  longLabel?: string;
  shortLabel?: string;
  styleLabel?: string;
  americanLabel?: string;
  europeanLabel?: string;
  settlementLabel?: string;
  physicalLabel?: string;
  cashLabel?: string;
  phaseLabel?: string;
  beforeLabel?: string;
  expirationLabel?: string;
  afterCutoffLabel?: string;
  stockPriceLabel?: string;
  cashReferenceLabel?: string;
  bidLabel?: string;
  contractLabel?: string;
  unitsLabel?: string;
  strikeLabel?: string;
  allowedMessage?: string;
  europeanWaitMessage?: string;
  cutoffMessage?: string;
  budgetLabel?: string;
  cashChangeLabel?: string;
  shareChangeLabel?: string;
  intrinsicLabel?: string;
  closeLabel?: string;
  differenceLabel?: string;
  shortCloseMessage?: string;
  exerciseMessage?: string;
  assignmentMessage?: string;
  counterpartyLabel?: string;
  detailsLabel?: string;
  tableRegionLabel?: string;
  partyLabel?: string;
  caption?: string;
  className?: string;
}
export function ExerciseAssignmentFlow({
  optionType='call',position='long',style='american',settlement='physical',phase='before',
  strike=95,reference=100,optionBid=7,multiplier=100,contracts=1,
  title='Follow exercise into cash and shares',locale='en-US',currency='USD',
  typeLabel='Option type',callLabel='Call',putLabel='Put',positionLabel='Position',longLabel='Long holder',shortLabel='Assigned short',
  styleLabel='Exercise style',americanLabel='American',europeanLabel='European',settlementLabel='Settlement',physicalLabel='Physical delivery',cashLabel='Cash settlement',
  phaseLabel='Instruction window',beforeLabel='Before expiration',expirationLabel='Expiration exercise window',afterCutoffLabel='After instruction cutoff',
  stockPriceLabel='Executable stock price',cashReferenceLabel='Contractual cash settlement reference',bidLabel='Executable option bid per unit',
  contractLabel='Contracts',unitsLabel='Multiplier per contract',strikeLabel='Strike per unit',
  allowedMessage='A new exercise instruction is allowed in this simplified window, subject to the actual contract and broker procedures.',
  europeanWaitMessage='European style does not allow early exercise. A closing trade may still be possible while its market is open.',
  cutoffMessage='This selected instruction window is closed. A valid instruction submitted earlier may still produce assignment and settlement; the budget below does not predict the outcome.',
  budgetLabel='Conditional settlement budget',cashChangeLabel='Cash change',shareChangeLabel='Share change',intrinsicLabel='Intrinsic value before entry premium',
  closeLabel='Long closing-sale proceeds',differenceLabel='Closing proceeds minus intrinsic value',
  shortCloseMessage='A short position closes with a buy-to-close trade at an executable ask, not by selling at this bid. The long closing comparison is hidden for the short side.',
  exerciseMessage='If validly exercised, the long holder receives the right’s settlement and the option is extinguished.',
  assignmentMessage='If assigned after a valid exercise, the short owes the matching settlement. This is an obligation, not a new choice to exercise.',
  counterpartyLabel='Matching opposite side',detailsLabel='Inspect the delivery budget',tableRegionLabel='Conditional cash and share changes, scroll horizontally if needed',partyLabel='Side',
  caption='Hypothetical plain-vanilla contract, zero fees and taxes, no price moves during the transaction. Cash and share changes exclude the original option premium. Cash reference follows the selected contract’s method; the bid is an independent executable input, not a price forecast. A closing comparison is usable only while that market is open. No automatic-exercise or broker cutoff policy is assumed.',className,
}:ExerciseAssignmentFlowProps) {
  calculateExerciseFlow({optionType,position,style,settlement,phase,strike,reference,optionBid,multiplier,contracts});
  if (reference>2*strike) throw new Error('ExerciseAssignmentFlow: initial reference must not exceed twice strike for the slider.');
  const labels={title,typeLabel,callLabel,putLabel,positionLabel,longLabel,shortLabel,styleLabel,americanLabel,europeanLabel,settlementLabel,physicalLabel,cashLabel,phaseLabel,beforeLabel,expirationLabel,afterCutoffLabel,stockPriceLabel,cashReferenceLabel,bidLabel,contractLabel,unitsLabel,strikeLabel,allowedMessage,europeanWaitMessage,cutoffMessage,budgetLabel,cashChangeLabel,shareChangeLabel,intrinsicLabel,closeLabel,differenceLabel,shortCloseMessage,exerciseMessage,assignmentMessage,counterpartyLabel,detailsLabel,tableRegionLabel,partyLabel,caption};
  for(const [name,value] of Object.entries(labels)) if(typeof value!=='string'||!value.trim()) throw new Error(`ExerciseAssignmentFlow: ${name} must be nonempty.`);
  const money=new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2});
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:4});
  const id=useId();
  const [kind,setKind]=useState(optionType);const [side,setSide]=useState(position);const [exerciseStyle,setStyle]=useState(style);
  const [delivery,setDelivery]=useState(settlement);const [window,setWindow]=useState(phase);const [value,setValue]=useState(reference);const [bid,setBid]=useState(optionBid);
  const m=calculateExerciseFlow({optionType:kind,position:side,style:exerciseStyle,settlement:delivery,phase:window,strike,reference:value,optionBid:bid,multiplier,contracts});
  const status=window==='afterCutoff'?cutoffMessage:m.newExerciseAllowed?allowedMessage:europeanWaitMessage;
  const selectClass='mt-2 block w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const controls=[
    {key:'type',label:typeLabel,value:kind,set:(v:string)=>setKind(v as ExerciseOptionType),options:[['call',callLabel],['put',putLabel]]},
    {key:'position',label:positionLabel,value:side,set:(v:string)=>setSide(v as ExercisePosition),options:[['long',longLabel],['short',shortLabel]]},
    {key:'style',label:styleLabel,value:exerciseStyle,set:(v:string)=>setStyle(v as ExerciseStyle),options:[['american',americanLabel],['european',europeanLabel]]},
    {key:'settlement',label:settlementLabel,value:delivery,set:(v:string)=>setDelivery(v as ExerciseSettlement),options:[['physical',physicalLabel],['cash',cashLabel]]},
    {key:'phase',label:phaseLabel,value:window,set:(v:string)=>setWindow(v as ExercisePhase),options:[['before',beforeLabel],['expiration',expirationLabel],['afterCutoff',afterCutoffLabel]]},
  ];
  const cash=(v:number)=>money.format(Math.abs(v)<.005?0:v);
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6',className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-2 text-sm">{contractLabel}: {number.format(contracts)} · {unitsLabel}: {number.format(multiplier)} · {strikeLabel}: {money.format(strike)}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {controls.map(c=><div key={c.key} className="text-sm font-medium"><label htmlFor={`${id}-${c.key}`}>{c.label}</label><select id={`${id}-${c.key}`} value={c.value} onChange={e=>c.set(e.target.value)} className={selectClass}>{c.options.map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></div>)}
      <label htmlFor={`${id}-reference`} className="text-sm font-medium">{delivery==='physical'?stockPriceLabel:cashReferenceLabel}: <output>{money.format(value)}</output><input id={`${id}-reference`} type="range" min={0} max={strike*2} step={.25} value={value} onChange={e=>setValue(Number(e.target.value))} className="mt-3 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>
      {side==='long'&&<label htmlFor={`${id}-bid`} className="text-sm font-medium">{bidLabel}: <output>{money.format(bid)}</output><input id={`${id}-bid`} type="range" min={0} max={Math.max(20,optionBid)} step={.25} value={bid} onChange={e=>setBid(Number(e.target.value))} className="mt-3 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>}
    </div>
    <p role="status" className="mt-5 text-sm leading-relaxed">{status}</p>
    <section className="mt-5 rounded-lg bg-surface p-4" aria-labelledby={`${id}-budget`}>
      <h3 id={`${id}-budget`} className="font-semibold text-ink-900">{budgetLabel}</h3>
      <p className="mt-2 text-sm leading-relaxed">{side==='long'?exerciseMessage:assignmentMessage}</p>
      {/* The readouts and table expose the same signed transfers to assistive technology. */}
      <div aria-hidden="true" className="mt-4 rounded-lg bg-surface-sunken p-3">
        <div className="flex justify-between gap-5 text-xs font-semibold text-ink-800">
          <span className="max-w-[45%]">{side==='long'?longLabel:shortLabel}</span>
          <span className="max-w-[45%] text-right">{counterpartyLabel}</span>
        </div>
        {[
          {label:cashChangeLabel,value:m.cashChange,amount:cash(m.cashChange),color:'var(--color-brand-600)'},
          {label:shareChangeLabel,value:m.shareChange,amount:number.format(m.shareChange),color:'var(--color-accent-600)'},
        ].map(transfer=><div key={transfer.label} className="mt-3">
          <p className="text-center text-xs text-ink-700">{transfer.label}: <span className="font-mono font-semibold">{transfer.amount}</span></p>
          <svg viewBox="0 0 400 30" className="mt-1 h-5 w-full">
            <path d="M16 15H384" fill="none" stroke={transfer.value===0?'var(--color-ink-300)':transfer.color} strokeWidth={3} strokeDasharray={transfer.value===0?'5 5':undefined} />
            {transfer.value!==0&&<path d={transfer.value>0?'M28 7L16 15L28 23':'M372 7L384 15L372 23'} fill="none" stroke={transfer.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
          </svg>
        </div>)}
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2" aria-live="polite" aria-atomic="true">
        <div><dt className="text-sm text-ink-600">{cashChangeLabel}</dt><dd className="mt-1 font-mono text-xl font-semibold text-brand-700">{cash(m.cashChange)}</dd></div>
        <div><dt className="text-sm text-ink-600">{shareChangeLabel}</dt><dd className="mt-1 font-mono text-xl font-semibold text-brand-700">{number.format(m.shareChange)}</dd></div>
        <div><dt className="text-sm text-ink-600">{intrinsicLabel}</dt><dd className="mt-1 font-mono font-semibold">{cash(m.intrinsicTotal)}</dd></div>
        {side==='long'&&<><div><dt className="text-sm text-ink-600">{closeLabel}</dt><dd className="mt-1 font-mono font-semibold">{cash(m.longClosingProceeds)}</dd></div><div className="sm:col-span-2"><dt className="text-sm text-ink-600">{differenceLabel}</dt><dd className="mt-1 font-mono font-semibold">{cash(m.closeMinusIntrinsic)}</dd></div></>}
      </dl>
      {side==='short'&&<p className="mt-3 text-sm leading-relaxed">{shortCloseMessage}</p>}
    </section>
    <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{detailsLabel}</summary>
      <div className="mt-3">
        <table tabIndex={0} aria-label={tableRegionLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableRegionLabel}</caption><thead><tr>{[partyLabel,cashChangeLabel,shareChangeLabel].map(label=><th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>
          <tr className="bg-surface"><th scope="row" className="p-2 font-medium">{side==='long'?longLabel:shortLabel}</th><td className="p-2 font-mono">{cash(m.cashChange)}</td><td className="p-2 font-mono">{number.format(m.shareChange)}</td></tr>
          <tr><th scope="row" className="p-2 font-medium">{counterpartyLabel}</th><td className="p-2 font-mono">{cash(-m.cashChange)}</td><td className="p-2 font-mono">{number.format(-m.shareChange || 0)}</td></tr>
        </tbody></table>
      </div>
    </details>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default ExerciseAssignmentFlow;
