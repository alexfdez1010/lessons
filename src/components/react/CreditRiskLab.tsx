import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CreditCashInputs { physicalPD: number; pricingPD: number; recovery: number; riskFree: number }
const probability = (n: number, name: string) => { if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`CreditRiskLab: ${name} must be a finite probability from zero to one.`); };
export function calculateCreditCashflows(input: CreditCashInputs) {
  const { physicalPD: p, pricingPD: q, recovery: R, riskFree: r } = input;
  probability(p, 'physical PD'); probability(q, 'pricing PD'); probability(R, 'recovery');
  if (!Number.isFinite(r) || r < 0 || r > .2) throw new Error('CreditRiskLab: the one-year effective reference rate must be from zero to 20%.');
  const loss = 1 - R, expectedPhysicalCash = 100 * ((1 - p) + p * R), expectedPricingCash = 100 * ((1 - q) + q * R);
  const price = expectedPricingCash / (1 + r);
  // A zero state-price value has no defined purchase-price return or YTM.
  const promisedYield = price > 0 ? 100 / price - 1 : null;
  const expectedReturn = price > 0 ? expectedPhysicalCash / price - 1 : null;
  const defaultReturn = price > 0 ? 100 * R / price - 1 : null;
  if ([promisedYield, expectedReturn, defaultReturn].some(value => value !== null && !Number.isFinite(value))) throw new Error('CreditRiskLab: this positive model price is too small for a finite supported purchase-return ratio.');
  return { sameSupport: (p === 0) === (q === 0) && (p === 1) === (q === 1), price, expectedPhysicalCash, expectedPricingCash, physicalLoss: 100 * p * loss, pricingLoss: 100 * q * loss, promisedYield, expectedReturn, defaultReturn, spread: promisedYield === null ? null : promisedYield - r, expectedExcess: expectedReturn === null ? null : expectedReturn - r, recoveryCash: 100 * R };
}
export function calculateCreditRegimes(stressWeight: number) {
  probability(stressWeight, 'stress weight');
  const w = stressWeight, pd = (1 - w) * .01 + w * .1, averageLGD = (1 - w) * .4 + w * .8;
  const expectedLoss = (1 - w) * .01 * .4 + w * .1 * .8;
  return { pd, averageLGD, expectedLoss, naiveProduct: pd * averageLGD, conditionalLGD: expectedLoss / pd, gap: expectedLoss - pd * averageLGD };
}
export function calculateCreditDependence(coupling: number, pd = .02, lgd = .6) {
  probability(coupling, 'common-default mixture weight'); probability(pd, 'marginal PD'); probability(lgd, 'conditional LGD');
  const both = (1 - coupling) * pd * pd + coupling * pd;
  // This convex mixture is a valid joint law, including zero-probability states.
  const onlyOne = 2 * pd * (1 - pd) * (1 - coupling);
  const neither = (1 - coupling) * (1 - pd) ** 2 + coupling * (1 - pd);
  const losses = [0, 100 * lgd, 200 * lgd], probabilities = [neither, onlyOne, both];
  return { losses, probabilities, expectedLoss: 200 * pd * lgd, both, onlyOne, neither };
}
export function calculateCreditIntensity(intensity: number, years: number) {
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1 || !Number.isFinite(years) || years < 0 || years > 100) throw new Error('CreditRiskLab: intensity must be from zero to one per year and horizon from zero to 100 years.');
  return { survival: Math.exp(-intensity * years), cumulativePD: -Math.expm1(-intensity * years) };
}
const defaultLabels = {
  cashModel: 'Invented one-year zero-coupon bond: face 100, recovery of face and all payments at year one. No fees, taxes, earlier payments or currency changes. Q weights price states; P weights physical outcomes. Both are assumptions, not observed default frequencies.',
  regimeModel: 'Two invented physical regimes. Calm: PD 1%, LGD 40%. Stress: PD 10%, LGD 80%. Exposure is fixed at 100 in either regime; LGD is conditional on default within each regime.',
  jointModel: 'Two exposures of 100, each with physical PD 2% and fixed conditional LGD 60%. The control mixes an independent-default joint law with a perfectly common-default joint law, keeping both individual PDs unchanged.',
  intensityModel: 'A constant intensity in one specified probability measure, per year. This view labels it Q for pricing. It plots cumulative pricing default and survival, not realized physical frequencies or a credit-spread curve.',
  physicalPD: 'Physical one-year default probability P', pricingPD: 'Pricing one-year default weight Q', recovery: 'Recovery fraction of face at year one', riskFree: 'One-year effective reference rate', stress: 'Physical probability of the stress regime', coupling: 'Weight of the common-default joint law in the mixture', intensity: 'Constant pricing intensity per year',
  quantity: 'Quantity', value: 'Value', code: 'Chart code', promised: 'Promised cash at year one', recoveryCash: 'Cash received in default at year one', physicalCash: 'Expected cash under P at year one', pricingCash: 'Expected cash under Q at year one', price: 'Model purchase price at time zero', ytm: 'Promised one-year yield', spread: 'Promised yield minus reference rate, percentage points', expectedReturn: 'Expected physical one-year purchase return', expectedExcess: 'Expected physical return minus reference rate, percentage points', defaultReturn: 'Realized return if default pays the stated recovery', noDefaultReturn: 'Realized return if all promised cash is paid', physicalLoss: 'Expected physical loss of promised face', pricingLoss: 'Expected lost face under Q',
  exactLoss: 'Correct physical expected loss / exposure', naive: 'Marginal PD times unconditional regime-average LGD', pd: 'Marginal physical PD', averageLGD: 'Unconditional regime-average LGD', conditionalLGD: 'Average LGD conditional on default', gap: 'Correct loss minus naive product, percentage points',
  zeroLoss: 'No issuer defaults', oneLoss: 'Exactly one issuer defaults', twoLoss: 'Both issuers default', lossAmount: 'Aggregate loss amount', mass: 'Physical probability', meanLoss: 'Expected aggregate loss amount', jointDefault: 'Probability both issuers default',
  year: 'Horizon in years', survival: 'Pricing survival probability', cumulativePD: 'Cumulative pricing default probability',
  cashAxis: 'Vertical axis: cash units per face 100 at year one. Codes below identify the four bars.', lossAxis: 'Vertical axis: loss fraction of exposure in percent. Codes below identify the two calculations.', probabilityAxis: 'Vertical axis: physical probability in percent. Only the positive-loss states are plotted to make the joint tail readable; the table also includes the no-loss state. Horizontal labels are aggregate loss amounts.', timeAxis: 'Horizontal axis: years from zero to ten. Vertical axis: probability in percent.',
  measureWarning: 'These P and Q weights disagree on impossible states, so they are not equivalent probability measures. The weighted-cash arithmetic remains defined; this setting does not establish a valid no-arbitrage pricing interpretation.',
  chart: 'Calculated model relationships. The focusable table gives the complete numbers and units.', table: 'Complete credit-model calculations; focus and use arrow keys to scroll horizontally', unavailable: 'Undefined because the model purchase price is zero', caption: 'Changing a model input changes this calculation. A promised yield, pricing weight, physical expectation and realized state return answer different questions.', units: 'Cash and loss amounts are in the same invented currency units; rates are percentages, spread differences are percentage points.',
};
export type CreditRiskLabels = typeof defaultLabels;
export interface CreditRiskLabProps extends Partial<CreditCashInputs> { view?: 'cash' | 'regimes' | 'joint' | 'intensity'; stressWeight?: number; coupling?: number; intensity?: number; title?: string; caption?: string; locale?: string; labels?: CreditRiskLabels; className?: string }
const onGrid = (n: number, min: number, max: number, step: number, name: string) => {
  if (!Number.isFinite(n) || n < min || n > max || Math.abs((n - min) / step - Math.round((n - min) / step)) > 1e-8) throw new Error(`CreditRiskLab: ${name} must match its native control range and step.`);
};
export function CreditRiskLab({ view = 'cash', physicalPD = .02, pricingPD = .04, recovery = .4, riskFree = .04, stressWeight = .2, coupling = 0, intensity = .02, title = 'Price states, forecast outcomes and inspect losses', caption, locale = 'en-US', labels = defaultLabels, className }: CreditRiskLabProps) {
  if (!['cash', 'regimes', 'joint', 'intensity'].includes(view)) throw new Error('CreditRiskLab: unsupported view.');
  onGrid(physicalPD, 0, .2, .005, 'physical PD'); onGrid(pricingPD, 0, .2, .005, 'pricing PD'); onGrid(recovery, 0, 1, .05, 'recovery'); onGrid(riskFree, 0, .1, .005, 'reference rate'); onGrid(stressWeight, 0, 1, .05, 'stress probability'); onGrid(coupling, 0, 1, .05, 'mixture weight'); onGrid(intensity, 0, .1, .005, 'intensity');
  for (const key of Object.keys(defaultLabels) as (keyof CreditRiskLabels)[]) if (typeof labels[key] !== 'string' || !labels[key].trim()) throw new Error(`CreditRiskLab: provide the localized ${key} label.`);
  const id = useId(), l = labels;
  const [p, setP] = useState(physicalPD), [q, setQ] = useState(pricingPD), [R, setR] = useState(recovery), [r, setRfr] = useState(riskFree), [w, setW] = useState(stressWeight), [mix, setMix] = useState(coupling), [lambda, setLambda] = useState(intensity);
  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(n);
  const percent = (n: number | null) => n === null ? l.unavailable : new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(n);
  const cash = calculateCreditCashflows({ physicalPD: p, pricingPD: q, recovery: R, riskFree: r }), regimes = calculateCreditRegimes(w), joint = calculateCreditDependence(mix);
  const controls = view === 'cash' ? [[l.physicalPD, p, setP, 0, .2, .005], [l.pricingPD, q, setQ, 0, .2, .005], [l.recovery, R, setR, 0, 1, .05], [l.riskFree, r, setRfr, 0, .1, .005]] as const : view === 'regimes' ? [[l.stress, w, setW, 0, 1, .05]] as const : view === 'joint' ? [[l.coupling, mix, setMix, 0, 1, .05]] as const : [[l.intensity, lambda, setLambda, 0, .1, .005]] as const;
  const rows: [string, string][] = view === 'cash' ? [[l.price, number(cash.price)], [l.promised, number(100)], [l.recoveryCash, number(cash.recoveryCash)], [l.physicalCash, number(cash.expectedPhysicalCash)], [l.pricingCash, number(cash.expectedPricingCash)], [l.ytm, percent(cash.promisedYield)], [l.spread, cash.spread === null ? l.unavailable : number(100 * cash.spread)], [l.expectedReturn, percent(cash.expectedReturn)], [l.expectedExcess, cash.expectedExcess === null ? l.unavailable : number(100 * cash.expectedExcess)], [l.noDefaultReturn, percent(cash.promisedYield)], [l.defaultReturn, percent(cash.defaultReturn)], [l.physicalLoss, number(cash.physicalLoss)], [l.pricingLoss, number(cash.pricingLoss)]] : view === 'regimes' ? [[l.pd, percent(regimes.pd)], [l.averageLGD, percent(regimes.averageLGD)], [l.conditionalLGD, percent(regimes.conditionalLGD)], [l.exactLoss, percent(regimes.expectedLoss)], [l.naive, percent(regimes.naiveProduct)], [l.gap, number(100 * regimes.gap)]] : [[l.meanLoss, number(joint.expectedLoss)], [l.jointDefault, percent(joint.both)]];
  const bars = view === 'cash' ? [{ label: l.promised, value: 100 }, { label: l.recoveryCash, value: cash.recoveryCash }, { label: l.physicalCash, value: cash.expectedPhysicalCash }, { label: l.pricingCash, value: cash.expectedPricingCash }] : view === 'regimes' ? [{ label: l.exactLoss, value: 100 * regimes.expectedLoss }, { label: l.naive, value: 100 * regimes.naiveProduct }] : joint.probabilities.slice(1).map((mass, i) => ({ label: [l.oneLoss, l.twoLoss][i], value: 100 * mass }));
  const max = view === 'regimes' ? 8 : view === 'joint' ? 4 : 100, W = 640, H = 320, left = 96, right = 586, top = 44, bottom = 258;
  const coord = (n: number) => Number(n.toFixed(3)), x = (v: number) => coord(left + v / 10 * (right - left)), y = (v: number) => coord(bottom - v / (view === 'intensity' ? 100 : max) * (bottom - top));
  const colors = ['var(--color-ink-500)', 'var(--color-accent-600)', 'var(--color-brand-600)', 'var(--color-brand-400)'];
  const axis = view === 'cash' ? l.cashAxis : view === 'regimes' ? l.lossAxis : view === 'joint' ? l.probabilityAxis : l.timeAxis;
  return <figure data-credit-view={view} className={cx('not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 shadow-soft sm:p-6', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed text-ink-700">{view === 'cash' ? l.cashModel : view === 'regimes' ? l.regimeModel : view === 'joint' ? l.jointModel : l.intensityModel}</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{controls.map(([label, value, change, min, maxControl, step], i) => <label key={label} htmlFor={`${id}-${i}`} className="block min-w-0 text-sm text-ink-800"><span className="flex flex-wrap justify-between gap-2"><span>{label}</span><output className="font-mono" htmlFor={`${id}-${i}`}>{percent(value)}</output></span><input id={`${id}-${i}`} aria-label={label} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" type="range" min={min} max={maxControl} step={step} value={value} onChange={event => change(Number(event.currentTarget.value))} /></label>)}</div>
    <div className="mt-4 rounded-card bg-surface-sunken p-3 text-sm leading-relaxed text-ink-900" aria-live="polite" aria-atomic="true">{view === 'cash' ? `${l.price}: ${number(cash.price)}. ${l.ytm}: ${percent(cash.promisedYield)}. ${l.expectedReturn}: ${percent(cash.expectedReturn)}.` : view === 'regimes' ? `${l.exactLoss}: ${percent(regimes.expectedLoss)}. ${l.naive}: ${percent(regimes.naiveProduct)}. ${l.conditionalLGD}: ${percent(regimes.conditionalLGD)}.` : view === 'joint' ? `${l.meanLoss}: ${number(joint.expectedLoss)}. ${l.jointDefault}: ${percent(joint.both)}.` : `${l.intensity}: ${percent(lambda)}. ${l.cumulativePD} (${l.year}: ${number(5)}): ${percent(calculateCreditIntensity(lambda, 5).cumulativePD)}.`}</div>
    {view === 'cash' && !cash.sameSupport && <p role="status" className="mt-3 rounded-card border border-accent-300 p-3 text-sm leading-relaxed text-ink-800">{l.measureWarning}</p>}
    <p className="mt-4 text-sm text-ink-700">{axis}</p>
    <svg className="mt-2 w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${l.chart}`}>
      {[0, max / 2, max].map(tick => <g key={tick}><line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="var(--color-ink-200)" /><text x={left - 12} y={y(tick) + 9} textAnchor="end" className="text-[38px] sm:text-[15px]" fill="var(--color-ink-700)">{number(tick)}</text></g>)}
      {view === 'intensity' ? <>{[0, 5, 10].map(year => <text key={year} x={x(year)} y={306} textAnchor="middle" className="text-[38px] sm:text-[15px]" fill="var(--color-ink-700)">{number(year)}</text>)}{[false, true].map((isDefault, k) => <path key={k} d={Array.from({ length: 101 }, (_, i) => { const a = calculateCreditIntensity(lambda, i / 10); return `${i ? 'L' : 'M'} ${x(i / 10)} ${y(100 * (isDefault ? a.cumulativePD : a.survival))}`; }).join(' ')} fill="none" stroke={colors[k + 1]} strokeWidth={5} />)}</> : bars.map((bar, i) => { const step = (right - left) / bars.length, center = coord(left + step * (i + .5)); return <g key={bar.label}><rect x={coord(center - step * .25)} width={coord(step * .5)} y={y(bar.value)} height={coord(bottom - y(bar.value))} fill={colors[i]} /><text x={center} y={306} textAnchor="middle" className="text-[38px] sm:text-[15px]" fill="var(--color-ink-800)">{view === 'joint' ? number(joint.losses[i + 1]) : String.fromCharCode(65 + i)}</text></g>; })}
    </svg>
    <div className="mt-2 grid gap-2 text-sm text-ink-700">{view === 'intensity' ? [l.survival, l.cumulativePD].map((text, i) => <p key={text} className="flex items-start gap-2"><span className="mt-1 h-3 w-3 shrink-0 rounded-sm" style={{ background: colors[i + 1] }} aria-hidden="true" />{text}</p>) : bars.map((bar, i) => <p key={bar.label}><span className="font-mono font-semibold">{view === 'joint' ? number(joint.losses[i + 1]) : String.fromCharCode(65 + i)}</span>: {bar.label}</p>)}</div>
    <p className="mt-4 text-sm text-ink-700">{l.units}</p>
    <div className="mt-3"><table tabIndex={0} aria-label={l.table} className="block w-full max-w-full overflow-x-auto border-collapse text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
      <thead><tr>{(view === 'intensity' ? [l.year, l.survival, l.cumulativePD] : view === 'joint' ? [l.lossAmount, l.mass] : [l.quantity, l.value]).map(h => <th key={h} scope="col" className="border-b border-ink-300 p-3 text-left font-semibold text-ink-900">{h}</th>)}</tr></thead>
      <tbody>{view === 'intensity' ? [0, 1, 2, 5, 10].map(t => { const z = calculateCreditIntensity(lambda, t); return <tr key={t}><th scope="row" className="border-b border-ink-100 p-3 text-left">{number(t)}</th><td className="whitespace-nowrap border-b border-ink-100 p-3 font-mono">{percent(z.survival)}</td><td className="whitespace-nowrap border-b border-ink-100 p-3 font-mono">{percent(z.cumulativePD)}</td></tr>; }) : view === 'joint' ? <>{joint.losses.map((loss, i) => <tr key={loss}><th scope="row" className="border-b border-ink-100 p-3 text-left font-mono">{number(loss)}</th><td className="whitespace-nowrap border-b border-ink-100 p-3 font-mono">{percent(joint.probabilities[i])}</td></tr>)}</> : rows.map(([label, value]) => <tr key={label}><th scope="row" className="w-1/2 min-w-36 border-b border-ink-100 p-3 text-left font-medium sm:min-w-48">{label}</th><td className="whitespace-nowrap border-b border-ink-100 p-3 font-mono">{value}</td></tr>)}</tbody>
    </table></div>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{caption ?? l.caption}</p>
  </figure>;
}
