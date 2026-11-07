import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
export interface ParetoTailInputs { minimum: number; alpha: number; confidence: number; capMultiple: number }
/** Pareto I: survival(l)=(minimum/l)^alpha above the positive minimum.
 * A cap is a changed loss min(L,B), B=q*capMultiple, not conditioning on L<=B.
 * Null denotes a divergent unbounded ES, never a JS Infinity in display data.
 * expm1 keeps the finite cap integral stable close to alpha=1. */
export function calculateParetoTail(i: ParetoTailInputs) {
  if (!Number.isFinite(i.minimum) || i.minimum < 1e-6 || i.minimum > 1e9) throw new Error('ParetoTailMean: minimum must be from 0.000001 to 1e9 loss units.');
  if (!Number.isFinite(i.alpha) || i.alpha < .5 || i.alpha > 3) throw new Error('ParetoTailMean: alpha must be in the teaching range from 0.5 to 3.');
  if (!Number.isFinite(i.confidence) || i.confidence < .5 || i.confidence > .999) throw new Error('ParetoTailMean: confidence must be from 0.5 to 0.999.');
  if (!Number.isFinite(i.capMultiple) || i.capMultiple < 1 || i.capMultiple > 1e6) throw new Error('ParetoTailMean: capMultiple must be from one to one million.');
  const q = i.minimum * Math.exp(-Math.log1p(-i.confidence) / i.alpha), logRatio = Math.log(i.capMultiple), exponent = 1 - i.alpha;
  const normalizedIntegral = exponent === 0 ? logRatio : Math.expm1(exponent * logRatio) / exponent;
  const normalizedCappedES = 1 + normalizedIntegral, cap = q * i.capMultiple, cappedES = q * normalizedCappedES;
  const finiteMean = i.alpha > 1, finiteVariance = i.alpha > 2;
  const normalizedES = finiteMean ? i.alpha / (i.alpha - 1) : null;
  const expectedShortfall = normalizedES === null ? null : q * normalizedES;
  const remainingTail = finiteMean ? q / (i.alpha - 1) * Math.exp(exponent * logRatio) : null;
  const capProbability = (1 - i.confidence) * Math.exp(-i.alpha * logRatio);
  return { valueAtRisk: q, cap, cappedES, normalizedCappedES, finiteMean, finiteVariance, expectedShortfall, normalizedES, remainingTail, capProbability };
}
export interface ParetoTailMeanProps extends Partial<ParetoTailInputs> {
  locale?: string; title?: string; alphaLabel?: string; confidenceLabel?: string; capLabel?: string; boundaryLabel?: string;
  modelMessage?: string; finiteMessage?: string; divergentMessage?: string; varLabel?: string; cappedLabel?: string; populationLabel?: string;
  infiniteLabel?: string; capAmountLabel?: string; capMassLabel?: string; remainderLabel?: string; meanStatusLabel?: string;
  finiteVarianceMessage?: string; infiniteVarianceMessage?: string; chartLabel?: string; horizontalLabel?: string; verticalLabel?: string;
  curveLabel?: string; limitLabel?: string; tableLabel?: string; multipleHeading?: string; normalizedHeading?: string; caption?: string; className?: string;
}
export function ParetoTailMean({ minimum=1,alpha=1,confidence=.95,capMultiple=100,locale='en-GB',
  title='A finite tail integral can keep growing without a finite limit',alphaLabel='Pareto I shape alpha',confidenceLabel='Confidence',capLabel='Loss cap as a multiple of the original VaR',boundaryLabel='Set alpha to exactly one',
  modelMessage='Invented Pareto I loss, lower bound {minimum} loss units. The cap B is always at least the original VaR. The curve is the exact ES of the changed loss min(L,B), divided by the original VaR, not an estimate of the unbounded ES.',
  finiteMessage='The unbounded model has finite ES because alpha is greater than one. Its limit is shown as a dashed line; a finite cap can still omit a material tail contribution.',
  divergentMessage='The unbounded model has infinite ES because alpha is at most one. Every finite cap calculation is finite, but the curve has no finite limiting tail mean. The absence of a horizontal limit is mathematical, not a failed calculation.',
  varLabel='Original finite VaR in loss units',cappedLabel='ES of the capped loss in loss units',populationLabel='ES of the unbounded population',infiniteLabel='Infinite in the unbounded model',capAmountLabel='Absolute loss cap B',capMassLabel='Probability collapsed into the cap',remainderLabel='Unbounded ES minus capped ES',meanStatusLabel='Population moment conditions',
  finiteVarianceMessage='The unbounded loss has a finite second moment because alpha is greater than two.',infiniteVarianceMessage='The unbounded loss has no finite second moment at alpha at most two; finite ES alone does not justify an ordinary finite-variance standard error.',
  chartLabel='Exact capped Expected Shortfall divided by original VaR as the cap multiple increases. A horizontal unbounded-ES limit exists only when alpha exceeds one.',horizontalLabel='Cap divided by original VaR, logarithmic scale',verticalLabel='Capped ES divided by original VaR',curveLabel='Exact capped-loss ES ratio',limitLabel='Unbounded population ES ratio, when finite',tableLabel='Exact cap levels and capped tail means; scroll horizontally if needed',multipleHeading='Cap multiple',normalizedHeading='Capped ES / original VaR',
  caption='A finite cap changes the loss distribution and places probability at the cap. It is different from a distribution conditioned to stay below that number or a finite observed sample. Inputs and moment statements describe this mathematical Pareto I model, not evidence of a real exposure limit.',className,
}:ParetoTailMeanProps) {
  calculateParetoTail({minimum,alpha,confidence,capMultiple});
  for(const [key,value] of Object.entries({title,alphaLabel,confidenceLabel,capLabel,boundaryLabel,modelMessage,finiteMessage,divergentMessage,varLabel,cappedLabel,populationLabel,infiniteLabel,capAmountLabel,capMassLabel,remainderLabel,meanStatusLabel,finiteVarianceMessage,infiniteVarianceMessage,chartLabel,horizontalLabel,verticalLabel,curveLabel,limitLabel,tableLabel,multipleHeading,normalizedHeading,caption})) if(!value.trim())throw new Error(`ParetoTailMean: ${key} must be nonempty.`);
  new Intl.NumberFormat(locale);
  const id=useId(),[shape,setShape]=useState(alpha),[level,setLevel]=useState(confidence),[multiple,setMultiple]=useState(capMultiple);
  const r=calculateParetoTail({minimum,alpha:shape,confidence:level,capMultiple:multiple}),number=new Intl.NumberFormat(locale,{maximumFractionDigits:6}),short=new Intl.NumberFormat(locale,{maximumSignificantDigits:4}),integer=new Intl.NumberFormat(locale,{maximumFractionDigits:0}),percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:6});
  const scientific = new Intl.NumberFormat(locale,{notation:'scientific',maximumSignificantDigits:3});
  const scientificPercent = new Intl.NumberFormat(locale,{style:'percent',notation:'scientific',maximumSignificantDigits:3});
  const probability = (value:number) => value>0&&value<1e-8?scientificPercent.format(value):percent.format(value);
  const axisNumber = (value:number) => value>=1e4?scientific.format(value):short.format(value);
  const levels=[...new Set([.9,.95,.99,confidence])].sort((a,b)=>a-b),rows=[...new Set([1,10,100,1000,10000,100000,1000000,multiple])].sort((a,b)=>a-b).map(capMultiple=>({multiple:capMultiple,...calculateParetoTail({minimum,alpha:shape,confidence:level,capMultiple})}));
  const values=Array.from({length:81},(_,j)=>{const multiple=10**(6*j/80);return{multiple,...calculateParetoTail({minimum,alpha:shape,confidence:level,capMultiple:multiple})};});
  const coordinate=(value:number)=>Number(value.toFixed(3));
  const maximum=Math.max(1.1,...values.map(v=>v.normalizedCappedES),r.normalizedES??0),x=(multiple:number)=>coordinate(160+Math.log10(multiple)/6*370),y=(ratio:number)=>coordinate(215-ratio/maximum*175);
  const d=values.map((v,j)=>`${j?'L':'M'} ${x(v.multiple)} ${y(v.normalizedCappedES)}`).join(' '),focus='block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6',className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-sm leading-relaxed">{modelMessage.replace('{minimum}',number.format(minimum))}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label htmlFor={`${id}-alpha`} className="min-w-0 text-sm font-medium">{alphaLabel}: <output className="font-mono">{number.format(shape)}</output><input id={`${id}-alpha`} type="range" min={.5} max={3} step="any" value={shape} onChange={e=>setShape(Number(e.target.value))} className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"/></label><div className="min-w-0"><label htmlFor={`${id}-confidence`} className="text-sm font-medium">{confidenceLabel}</label><select id={`${id}-confidence`} value={level} onChange={e=>setLevel(Number(e.target.value))} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface p-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600">{levels.map(c=><option key={c} value={c}>{percent.format(c)}</option>)}</select></div><label htmlFor={`${id}-cap`} className="min-w-0 text-sm font-medium sm:col-span-2">{capLabel}: <output className="font-mono">{short.format(multiple)}</output><input id={`${id}-cap`} type="range" min={0} max={6} step="any" value={Math.log10(multiple)} onChange={e=>setMultiple(10**Number(e.target.value))} className="mt-2 h-8 w-full accent-accent-600 focus-visible:outline-2 focus-visible:outline-brand-600"/></label></div>
    <button type="button" onClick={()=>setShape(1)} className="mt-4 min-h-8 rounded-lg border border-ink-300 bg-surface px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-600">{boundaryLabel}</button>
    <p className="mt-4 text-sm leading-relaxed" aria-live="polite">{r.finiteMean?finiteMessage:divergentMessage}</p>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[varLabel,number.format(r.valueAtRisk)],[cappedLabel,number.format(r.cappedES)],[populationLabel,r.expectedShortfall===null?infiniteLabel:short.format(r.expectedShortfall)],[capAmountLabel,short.format(r.cap)],[capMassLabel,probability(r.capProbability)],[remainderLabel,r.remainingTail===null?infiniteLabel:short.format(r.remainingTail)]].map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
    <svg viewBox="0 0 640 275" role="img" aria-label={chartLabel} className="mt-5 w-full"><line x1={160} x2={530} y1={215} y2={215} stroke="var(--color-ink-400)"/><path d={d} fill="none" stroke="var(--color-brand-600)" strokeWidth={3}/>{r.normalizedES!==null&&<line x1={160} x2={530} y1={y(r.normalizedES)} y2={y(r.normalizedES)} stroke="var(--color-ink-600)" strokeWidth={2} strokeDasharray="7 5"/>}<circle cx={x(multiple)} cy={y(r.normalizedCappedES)} r={5} fill="var(--color-accent-600)"/>{[1,1000,1000000].map(v=><text key={v} x={x(v)} y={255} textAnchor="middle" fill="var(--color-ink-700)" className="text-[35px] sm:text-[15px]">{integer.format(v)}</text>)}<text x={140} y={220} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">0</text><text x={140} y={45} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{axisNumber(maximum)}</text></svg><p className="mt-2 text-xs text-ink-600">{horizontalLabel}; {verticalLabel}</p>
    <div className="mt-3 flex flex-wrap gap-4 text-xs"><span className="inline-flex items-center gap-2"><span className="h-1 w-5 bg-brand-600" aria-hidden="true"/>{curveLabel}</span>{r.normalizedES!==null&&<span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-600" aria-hidden="true"/>{limitLabel}</span>}</div>
    <p className="mt-4 text-sm leading-relaxed">{meanStatusLabel}: {r.finiteVariance?finiteVarianceMessage:infiniteVarianceMessage}</p>
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className={focus}><caption className="sr-only">{tableLabel}</caption><thead><tr>{[multipleHeading,capAmountLabel,cappedLabel,normalizedHeading].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.multiple} className="border-t border-ink-200"><th scope="row" className="p-2 font-mono font-medium">{short.format(row.multiple)}</th><td className="p-2 font-mono">{short.format(row.cap)}</td><td className="p-2 font-mono">{short.format(row.cappedES)}</td><td className="p-2 font-mono">{number.format(row.normalizedCappedES)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
