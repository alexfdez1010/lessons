import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
export type Three = readonly [number, number, number];
export interface KeyRateCashFlow { time: number; amount: number }
export interface KeyRateInputs { nodes: Three; zeroRates: Three; cashFlows: readonly KeyRateCashFlow[]; shockBp: Three; bumpBp: number }
export function keyRateBasis(time: number, nodes: Three): Three {
  if (time <= nodes[0]) return [1, 0, 0];
  if (time >= nodes[2]) return [0, 0, 1];
  const j = time <= nodes[1] ? 0 : 1, fraction = (time - nodes[j]!) / (nodes[j + 1]! - nodes[j]!);
  return j === 0 ? [1 - fraction, fraction, 0] : [0, 1 - fraction, fraction];
}
/** Continuous zero rates, linear interpolation of zero rates, and flat endpoint
 * extrapolation. Node shifts define the risk coordinates; this is not a
 * calibrated market-quote delta. Every cash flow is fixed and fully received. */
export function calculateKeyRateRisk(i: KeyRateInputs) {
  if (i.nodes.length !== 3 || i.nodes.some(x => !Number.isFinite(x) || x <= 0 || x > 50) || !(i.nodes[0] < i.nodes[1] && i.nodes[1] < i.nodes[2])) throw new Error('KeyRateCurveHedge: provide three strictly increasing positive nodes at most 50 years.');
  if (i.zeroRates.length !== 3 || i.zeroRates.some(x => !Number.isFinite(x) || x < -.05 || x > .2)) throw new Error('KeyRateCurveHedge: zero rates must be from -0.05 to 0.20.');
  if (!i.cashFlows.length || i.cashFlows.length > 30 || i.cashFlows.some(x => !Number.isFinite(x.time) || x.time < 0 || x.time > 50 || !Number.isFinite(x.amount) || x.amount < 0 || x.amount > 1e9) || !i.cashFlows.some(x => x.amount > 0)) throw new Error('KeyRateCurveHedge: provide one to thirty nonnegative fixed cash flows, positive in total, at times from zero to 50.');
  if (i.shockBp.length !== 3 || i.shockBp.some(x => !Number.isFinite(x) || Math.abs(x) > 200) || !Number.isFinite(i.bumpBp) || i.bumpBp < .01 || i.bumpBp > 50) throw new Error('KeyRateCurveHedge: shocks must be within 200 basis points and the central bump from 0.01 to 50 basis points.');
  const priceAt = (rates: readonly number[]) => i.cashFlows.reduce((sum, flow) => { const basis = keyRateBasis(flow.time, i.nodes), rate = basis.reduce((total, b, j) => total + b * rates[j]!, 0); return sum + flow.amount * Math.exp(-flow.time * rate); }, 0);
  const rows = i.cashFlows.map(flow => { const basis = keyRateBasis(flow.time, i.nodes), zeroRate = basis.reduce((total, b, j) => total + b * i.zeroRates[j]!, 0), presentValue = flow.amount * Math.exp(-flow.time * zeroRate); return { ...flow, basis, zeroRate, presentValue }; });
  const price = rows.reduce((total, r) => total + r.presentValue, 0);
  const moneyDuration = i.nodes.map((_, j) => rows.reduce((total, r) => total + r.time * r.presentValue * r.basis[j]!, 0));
  const keyDurations = moneyDuration.map(d => d / price), dv01 = moneyDuration.map(d => d * .0001), h = i.bumpBp * .0001;
  const centralKeyDurations = i.nodes.map((_, j) => { const minus = [...i.zeroRates], plus = [...i.zeroRates]; minus[j] -= h; plus[j] += h; return (priceAt(minus) - priceAt(plus)) / (2 * h * price); });
  const parallelDuration = rows.reduce((total, r) => total + r.time * r.presentValue, 0) / price;
  const centralParallelDuration = (priceAt(i.zeroRates.map(z => z - h)) - priceAt(i.zeroRates.map(z => z + h))) / (2 * h * price);
  const shiftedRates = i.zeroRates.map((z, j) => z + .0001 * i.shockBp[j]!), exactPrice = priceAt(shiftedRates);
  const linearPnl = -dv01.reduce((total, d, j) => total + d * i.shockBp[j]!, 0);
  return { price, rows, keyDurations, dv01, centralKeyDurations, parallelDuration, centralParallelDuration, shiftedRates, exactPrice, exactPnl: exactPrice - price, linearPnl };
}
/** H rows are rate buckets, columns are currency-per-bp sensitivities of one
 * long hedge unit. The solve is H*n = -book. A relative pivot threshold marks
 * numerical rank loss rather than emitting huge/undefined positions. */
export function solveKeyRateHedge(book: Three, matrix: readonly Three[]) {
  if (book.length !== 3 || book.some(x => !Number.isFinite(x) || Math.abs(x) > 1e9) || matrix.length !== 3 || matrix.some(row => row.length !== 3 || row.some(x => !Number.isFinite(x) || Math.abs(x) > 1e6))) throw new Error('KeyRateCurveHedge: provide a finite three-bucket book and a finite three-by-three hedge matrix.');
  const norm = Math.max(...matrix.map(row => row.reduce((s, x) => s + Math.abs(x), 0)));
  const augmented = matrix.map((row, j) => [...row, ...[0, 1, 2].map(k => Number(j === k))]);
  for (let j = 0; j < 3; j++) {
    let pivot = j;
    for (let k = j + 1; k < 3; k++) if (Math.abs(augmented[k]![j]!) > Math.abs(augmented[pivot]![j]!)) pivot = k;
    if (Math.abs(augmented[pivot]![j]!) <= norm * 64 * Number.EPSILON) return { status: 'singular' as const, positions: null, residual: null, condition: null };
    [augmented[j], augmented[pivot]] = [augmented[pivot]!, augmented[j]!];
    const divisor = augmented[j]![j]!;
    for (let k = 0; k < 6; k++) augmented[j]![k] /= divisor;
    for (let row = 0; row < 3; row++) if (row !== j) { const factor = augmented[row]![j]!; for (let k = 0; k < 6; k++) augmented[row]![k] -= factor * augmented[j]![k]!; }
  }
  const inverse = augmented.map(row => row.slice(3)), positions = inverse.map(row => -row.reduce((sum, value, j) => sum + value * book[j]!, 0));
  const residual = matrix.map((row, j) => book[j]! + row.reduce((sum, value, k) => sum + value * positions[k]!, 0));
  const inverseNorm = Math.max(...inverse.map(row => row.reduce((sum, x) => sum + Math.abs(x), 0)));
  return { status: 'solved' as const, positions, residual, condition: norm * inverseNorm };
}
export function blendedHedgeMatrix(independence: number): readonly Three[] {
  if (!Number.isFinite(independence) || independence < 0 || independence > 1) throw new Error('KeyRateCurveHedge: independence must be from zero to one.');
  return [[20, 0, 0], [5, 40, 40 * (1 - independence)], [0, 10, 10 * (1 - independence) + 50 * independence]];
}
const shapeVectors: readonly Three[] = [[1,0,0],[0,1,0],[0,0,1],[1,1,1],[-1,0,1],[-.5,1,-.5]];
export interface KeyRateCurveHedgeProps {
  mode?: 'pricing' | 'hedge'; nodes?: Three; zeroRates?: Three; cashFlows?: readonly KeyRateCashFlow[];
  shockShape?: number; shockSizeBp?: number; independence?: number; book?: Three; locale?: string; currency?: string;
  title?: string; nodeLabels?: ThreeStrings; shapeLabels?: readonly string[]; shapeLabel?: string; shockLabel?: string; independenceLabel?: string; roundingLabel?: string;
  assumptions?: string; hedgeAssumptions?: string; baseCurveLabel?: string; shockedCurveLabel?: string; chartLabel?: string; hedgeChartLabel?: string;
  priceLabel?: string; exactLabel?: string; linearLabel?: string; durationLabel?: string; conditionLabel?: string; singularMessage?: string;
  bucketLabel?: string; krdLabel?: string; dv01Label?: string; centralLabel?: string; shockHeading?: string; bookLabel?: string; residualLabel?: string;
  tableLabel?: string; cashTableLabel?: string; cashHeading?: string; timeLabel?: string; amountLabel?: string; rateLabel?: string; pvLabel?: string; basisLabel?: string;
  instrumentLabel?: string; positionLabel?: string; positionsLabel?: string; hedgeLabels?: ThreeStrings; undefinedLabel?: string; caption?: string; className?: string;
}
type ThreeStrings = readonly [string,string,string];
export function KeyRateCurveHedge({
  mode = 'pricing', nodes = [2,5,10], zeroRates = [.03,.04,.05], cashFlows = [{time:2,amount:50},{time:4,amount:50},{time:10,amount:1050}],
  shockShape = 3, shockSizeBp = 10, independence = 1, book = [100,300,200], locale = 'en-GB', currency = 'EUR',
  title = 'Measure the curve risk by node', nodeLabels = ['2 years','5 years','10 years'], shapeLabels = ['Short node only','Middle node only','Long node only','Level: equal node changes','Slope: opposite endpoint changes','Curvature: middle versus endpoints'],
  shapeLabel = 'Defined shock shape', shockLabel = 'Shock amplitude in basis points', independenceLabel = 'Independent part of the third hedge', roundingLabel = 'Round hedge positions to whole units',
  assumptions = 'Invented fixed cash flows, fully received. Continuous zero rates are linearly interpolated, with flat endpoint extrapolation. Sensitivities are to those zero-rate nodes, not calibrated market quotes. Central differences use a one-basis-point bump.',
  hedgeAssumptions = 'Separate invented three-bucket book, in currency per basis point. Each hedge matrix column is one long unit. Positions solve the linear sensitivity system, not a full cash-flow repricing. Negative positions are shorts; funding, costs and margin are excluded.',
  baseCurveLabel = 'Base zero curve', shockedCurveLabel = 'Shocked zero curve', chartLabel = 'Continuous zero rates at the three specified maturities, before and after the selected node shock.', hedgeChartLabel = 'Signed bucket DV01 before and after the chosen hedge. A singular hedge system has no displayed residual solution.',
  priceLabel = 'Initial present value', exactLabel = 'Exact fixed-flow P&L', linearLabel = 'First-order P&L', durationLabel = 'Sum of derivative key rate durations', conditionLabel = 'Infinity-norm condition number',
  singularMessage = 'No unique numerical solution for these three hedge columns. The third hedge duplicates another risk direction at zero independence. Some books cannot be matched with this instrument set; no zero residual is being claimed.',
  bucketLabel = 'Rate node', krdLabel = 'Derivative KRD', dv01Label = 'Bucket DV01', centralLabel = 'Central-bump KRD', shockHeading = 'Node shock in bp', bookLabel = 'Book DV01', residualLabel = 'Residual DV01',
  tableLabel = 'Node sensitivities and hedge matrix; scroll horizontally if needed', cashTableLabel = 'Fixed cash flows, present values and interpolation weights; scroll horizontally if needed', cashHeading = 'Inspect the cash-flow calculation', timeLabel = 'Years', amountLabel = 'Cash received', rateLabel = 'Interpolated zero rate', pvLabel = 'Present value', basisLabel = 'Node interpolation weights',
  instrumentLabel = 'Hedge instrument', positionLabel = 'Signed units', positionsLabel = 'Calculated hedge positions', hedgeLabels = ['Hedge 1','Hedge 2','Hedge 3'], undefinedLabel = 'No unique solution',
  caption = 'The coordinates, interpolation and shocks are part of the measurement. A first-order curve hedge leaves finite-move convexity, spread, basis, funding and execution risks.', className,
}: KeyRateCurveHedgeProps) {
  if (!['pricing','hedge'].includes(mode) || !Number.isInteger(shockShape) || shockShape < 0 || shockShape > 5 || !Number.isInteger(shockSizeBp) || Math.abs(shockSizeBp) > 100) throw new Error('KeyRateCurveHedge: use a valid mode, one of six shock shapes and an integer amplitude within 100 basis points.');
  calculateKeyRateRisk({ nodes, zeroRates, cashFlows, shockBp: shapeVectors[shockShape]!.map(x => x * shockSizeBp) as unknown as Three, bumpBp: 1 });
  solveKeyRateHedge(book, blendedHedgeMatrix(independence));
  if (nodeLabels.length !== 3 || hedgeLabels.length !== 3 || shapeLabels.length !== 6 || [...nodeLabels,...hedgeLabels,...shapeLabels].some(x => !x.trim())) throw new Error('KeyRateCurveHedge: provide three node and hedge labels and six nonempty shock labels.');
  for (const [key,value] of Object.entries({ title,shapeLabel,shockLabel,independenceLabel,roundingLabel,assumptions,hedgeAssumptions,baseCurveLabel,shockedCurveLabel,chartLabel,hedgeChartLabel,priceLabel,exactLabel,linearLabel,durationLabel,conditionLabel,singularMessage,bucketLabel,krdLabel,dv01Label,centralLabel,shockHeading,bookLabel,residualLabel,tableLabel,cashTableLabel,cashHeading,timeLabel,amountLabel,rateLabel,pvLabel,basisLabel,instrumentLabel,positionLabel,positionsLabel,undefinedLabel,caption })) if (!value.trim()) throw new Error(`KeyRateCurveHedge: ${key} must be nonempty.`);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('KeyRateCurveHedge: currency must be a three-letter code.');
  new Intl.NumberFormat(locale,{style:'currency',currency});
  const id = useId(), [shape,setShape] = useState(shockShape), [amplitude,setAmplitude] = useState(shockSizeBp), [independent,setIndependent] = useState(independence), [rounded,setRounded] = useState(false);
  const shocks = shapeVectors[shape]!.map(v => v * amplitude) as unknown as Three;
  const r = calculateKeyRateRisk({nodes,zeroRates,cashFlows,shockBp:shocks,bumpBp:1}), matrix = blendedHedgeMatrix(independent), solution = solveKeyRateHedge(book,matrix);
  const positions = solution.positions?.map(value => rounded ? Math.round(value) : value) ?? null;
  const residual = positions ? matrix.map((row,j) => book[j]! + row.reduce((sum,value,k) => sum + value * positions[k]!,0)) : null;
  const pnl = (risk: readonly number[]) => -risk.reduce((sum,value,j) => sum + value * shocks[j]!,0);
  const number = new Intl.NumberFormat(locale,{maximumFractionDigits:6}), percent = new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:4}), money = new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'code',maximumFractionDigits:4});
  const moneyValue = (value: number) => money.format(Math.abs(value) < 1e-9 ? 0 : value);
  const display = (v: number) => number.format(Math.abs(v) < 1e-10 ? 0 : v);
  const focus = 'block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const x = (time: number) => 140 + (time - nodes[0]) / (nodes[2] - nodes[0]) * 390;
  const low = Math.min(0,...zeroRates,...r.shiftedRates) - .002, high = Math.max(.01,...zeroRates,...r.shiftedRates) + .002;
  const tickPercent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const y = (rate: number) => 195 - (rate - low) / (high - low) * 160;
  const poly = (rates: readonly number[]) => nodes.map((time,j) => `${x(time)},${y(rates[j]!)}`).join(' ');
  const riskScale = Math.max(1,...book.map(Math.abs),...(residual ?? []).map(Math.abs)), ry = (value: number) => 130 - value / riskScale * 80;
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6',className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-sm leading-relaxed">{mode === 'pricing' ? assumptions : hedgeAssumptions}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="min-w-0"><label htmlFor={`${id}-shape`} className="text-sm font-medium">{shapeLabel}</label><select id={`${id}-shape`} value={shape} onChange={e=>setShape(Number(e.target.value))} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface p-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600">{shapeLabels.map((label,j)=><option key={j} value={j}>{label}</option>)}</select></div><label htmlFor={`${id}-shock`} className="min-w-0 text-sm font-medium">{shockLabel}: <output className="font-mono">{display(amplitude)}</output><input id={`${id}-shock`} type="range" min={-100} max={100} step={1} value={amplitude} onChange={e=>setAmplitude(Number(e.target.value))} className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"/></label>
      {mode === 'hedge' && <><label htmlFor={`${id}-independence`} className="min-w-0 text-sm font-medium">{independenceLabel}: <output className="font-mono">{percent.format(independent)}</output><input id={`${id}-independence`} type="range" min={0} max={1} step="any" value={independent} onChange={e=>setIndependent(Number(e.target.value))} className="mt-2 h-8 w-full accent-accent-600 focus-visible:outline-2 focus-visible:outline-brand-600"/></label><label className="flex min-h-8 items-center gap-3 text-sm" htmlFor={`${id}-round`}><input id={`${id}-round`} type="checkbox" checked={rounded} onChange={e=>setRounded(e.target.checked)} className="h-5 w-5 accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"/>{roundingLabel}</label></>}
    </div>
    {mode === 'pricing' ? <>
      <p className="mt-4 text-sm">{rateLabel}</p><svg viewBox="0 0 640 270" role="img" aria-label={chartLabel} className="mt-5 w-full"><line x1={140} x2={530} y1={y(0)} y2={y(0)} stroke="var(--color-ink-400)"/><polyline points={poly(zeroRates)} fill="none" stroke="var(--color-ink-600)" strokeWidth={2} strokeDasharray="7 5"/><polyline points={poly(r.shiftedRates)} fill="none" stroke="var(--color-brand-600)" strokeWidth={3}/>{nodes.map((time,j)=><g key={j}><circle cx={x(time)} cy={y(r.shiftedRates[j]!)} r={5} fill="var(--color-brand-600)"/><text x={x(time)} y={255} textAnchor="middle" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{display(time)}</text></g>)}{[low,(low+high)/2,high].map(value=><text key={value} x={125} y={y(value)+10} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{tickPercent.format(value)}</text>)}</svg><p className="mt-1 text-center text-sm">{timeLabel}</p><ul className="mt-3 space-y-1 text-sm">{nodes.map((_,j)=><li key={j}>{nodeLabels[j]}: <span className="font-mono">{percent.format(r.shiftedRates[j]!)}</span></li>)}</ul>
      <div className="mt-2 flex flex-wrap gap-4 text-xs"><span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-600" aria-hidden="true"/>{baseCurveLabel}</span><span className="inline-flex items-center gap-2"><span className="h-1 w-5 bg-brand-600" aria-hidden="true"/>{shockedCurveLabel}</span></div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[priceLabel,moneyValue(r.price)],[exactLabel,moneyValue(r.exactPnl)],[linearLabel,moneyValue(r.linearPnl)],[durationLabel,display(r.parallelDuration)]].map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
      <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className={focus}><caption className="sr-only">{tableLabel}</caption><thead><tr>{[bucketLabel,krdLabel,centralLabel,dv01Label,shockHeading].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{nodes.map((_,j)=><tr key={j} className="border-t border-ink-200"><th scope="row" className="p-2 font-medium">{nodeLabels[j]}</th><td className="p-2 font-mono">{display(r.keyDurations[j]!)}</td><td className="p-2 font-mono">{display(r.centralKeyDurations[j]!)}</td><td className="p-2 font-mono">{moneyValue(r.dv01[j]!)}</td><td className="p-2 font-mono">{display(shocks[j]!)}</td></tr>)}</tbody></table></div>
      <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{cashHeading}</summary><div className="mt-3"><table tabIndex={0} aria-label={cashTableLabel} className={focus}><caption className="sr-only">{cashTableLabel}</caption><thead><tr>{[timeLabel,amountLabel,rateLabel,pvLabel,basisLabel].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{r.rows.map((row,j)=><tr key={j} className="border-t border-ink-200"><th scope="row" className="p-2 font-mono font-medium">{display(row.time)}</th><td className="p-2 font-mono">{moneyValue(row.amount)}</td><td className="p-2 font-mono">{percent.format(row.zeroRate)}</td><td className="p-2 font-mono">{moneyValue(row.presentValue)}</td><td className="p-2 font-mono">{row.basis.map(value=>display(value)).join(' / ')}</td></tr>)}</tbody></table></div></details>
    </> : <>
      {solution.status === 'singular' ? <p role="status" className="mt-5 text-sm leading-relaxed">{singularMessage}</p> : <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[conditionLabel,display(solution.condition!)],[bookLabel+' · '+linearLabel,moneyValue(pnl(book))],[residualLabel+' · '+linearLabel,moneyValue(pnl(residual!))]].map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>}
      <svg viewBox="0 0 640 250" role="img" aria-label={hedgeChartLabel} className="mt-5 w-full"><line x1={65} x2={575} y1={130} y2={130} stroke="var(--color-ink-500)"/>{book.map((value,j)=><g key={j}><rect x={110+j*170} y={Math.min(130,ry(value))} width={45} height={Math.abs(ry(value)-130)} fill="var(--color-ink-500)"/>{residual && <rect x={160+j*170} y={Math.min(130,ry(residual[j]!))} width={45} height={Math.abs(ry(residual[j]!)-130)} fill="var(--color-brand-600)"/>}<text x={157+j*170} y={235} textAnchor="middle" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{display(nodes[j]!)}</text></g>)}</svg><p className="mt-1 text-center text-sm">{timeLabel}</p><p className="mt-2 text-sm">{bucketLabel}: {nodeLabels.join(' · ')}</p><div className="mt-2 flex flex-wrap gap-4 text-xs"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-ink-500" aria-hidden="true"/>{bookLabel}</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-brand-600" aria-hidden="true"/>{residualLabel}</span></div>
      <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className={focus}><caption className="sr-only">{tableLabel}</caption><thead><tr>{[bucketLabel,bookLabel,...hedgeLabels,residualLabel,shockHeading].map(label=><th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{matrix.map((row,j)=><tr key={j} className="border-t border-ink-200"><th scope="row" className="p-2 font-medium">{nodeLabels[j]}</th><td className="p-2 font-mono">{moneyValue(book[j]!)}</td>{row.map((value,k)=><td key={k} className="p-2 font-mono">{moneyValue(value)}</td>)}<td className="p-2 font-mono">{residual ? moneyValue(Math.abs(residual[j]!)<1e-9 ? 0 : residual[j]!) : undefinedLabel}</td><td className="p-2 font-mono">{display(shocks[j]!)}</td></tr>)}</tbody></table></div>
      <div className="mt-5"><table tabIndex={0} aria-label={positionsLabel} className={focus}><caption className="sr-only">{positionsLabel}</caption><thead><tr><th scope="col" className="p-2">{instrumentLabel}</th><th scope="col" className="p-2">{positionLabel}</th></tr></thead><tbody>{hedgeLabels.map((label,j)=><tr key={j} className="border-t border-ink-200"><th scope="row" className="p-2 font-medium">{label}</th><td className="p-2 font-mono">{positions ? display(positions[j]!) : undefinedLabel}</td></tr>)}</tbody></table></div>
    </>}
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
