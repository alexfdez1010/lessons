import { useId, useState, type ReactNode } from 'react';
import { cx } from '@/components/react/cx';

const finite = (value: number, low: number, high: number) => Number.isFinite(value) && value >= low && value <= high;
const onGrid = (value: number, min: number, max: number, step: number) => finite(value, min, max) && Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-8;
const renderNumber = (value: number) => Number(value.toFixed(3));

/** Standard normal CDF evaluated by the positive-term density-integral series.
 * Beyond eight standard deviations the omitted tail is below 6.3e-16.
 * The analytical option model and its floating-point evaluation are distinct. */
export function blackScholesNormalCdf(value: number): number {
  if (Number.isNaN(value)) throw new Error('BlackScholesLab: the normal-CDF argument must not be NaN.');
  if (value >= 8) return 1;
  if (value <= -8) return 0;
  let term = value, sum = value;
  for (let n = 1; n < 240; n++) {
    term *= value * value / (2 * n + 1);
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-16) break;
  }
  return Math.min(1, Math.max(0, .5 + sum * Math.exp(-.5 * value * value) / Math.sqrt(2 * Math.PI)));
}

export interface BlackScholesInputs {
  spot: number;
  strike: number;
  volatility: number;
  time: number;
  rate: number;
  dividendYield: number;
}
export interface BlackScholesResult {
  mode: 'regular' | 'expiry' | 'deterministic';
  call: number;
  put: number;
  d1: number | null;
  d2: number | null;
  nd1: number | null;
  nd2: number | null;
  callDelta: number | null;
  putDelta: number | null;
  callItmProbability: number;
  putItmProbability: number;
  discount: number;
  prepaidSpot: number;
  discountedStrike: number;
  assetLeg: number;
  cashLeg: number;
  callTheta: number | null;
  putTheta: number | null;
  vega: number | null;
  forward: number;
  logReturnSd: number;
}
function modelGuard(x: BlackScholesInputs) {
  if (!finite(x.spot, 1e-9, 1e9) || !finite(x.strike, 1e-9, 1e9) || !finite(x.volatility, 0, 5) || !finite(x.time, 0, 100) || !finite(x.rate, -2, 2) || !finite(x.dividendYield, -2, 2)) throw new Error('BlackScholesLab: provide finite supported positive spot and strike, nonnegative volatility and years, and matched annual continuous rate/yield inputs.');
}

/** European call/put with constant continuous r/q, lognormal pricing dynamics,
 * frictionless replication and no jumps. Theta is per calendar year as time
 * advances; vega is per unit volatility, not per percentage point.
 * Zero time and zero volatility are legal financial states, with no invented
 * normal terms or derivative at a deterministic payoff kink. */
export function calculateBlackScholes(x: BlackScholesInputs): BlackScholesResult {
  modelGuard(x);
  const { spot: s, strike: k, volatility: v, time: t, rate: r, dividendYield: q } = x;
  const discount = Math.exp(-r * t), dividendDiscount = Math.exp(-q * t), a = s * dividendDiscount, b = k * discount, forward = s * Math.exp((r - q) * t), sd = v * Math.sqrt(t);
  let result: BlackScholesResult;
  if (t === 0 || v === 0) {
    const difference = a - b, callItmProbability = difference > 0 ? 1 : 0, putItmProbability = difference < 0 ? 1 : 0, callDelta = difference > 0 ? dividendDiscount : difference < 0 ? 0 : null;
    result = { mode: t === 0 ? 'expiry' : 'deterministic', call: Math.max(difference, 0), put: Math.max(-difference, 0), d1: null, d2: null, nd1: null, nd2: null, callDelta, putDelta: callDelta === null ? null : callDelta - dividendDiscount, callItmProbability, putItmProbability, discount, prepaidSpot: a, discountedStrike: b, assetLeg: callItmProbability ? a : 0, cashLeg: callItmProbability ? b : 0, callTheta: null, putTheta: null, vega: null, forward, logReturnSd: sd };
  } else {
    if (sd < 1e-8) throw new Error('BlackScholesLab: positive dispersion is below this CDF-difference evaluator’s supported numerical resolution; use higher-precision evaluation rather than reporting a zero premium or substituting zero time or volatility.');
    const d1 = (Math.log(s / k) + (r - q + .5 * v * v) * t) / sd, d2 = d1 - sd;
    if (![d1, d2].every(Number.isFinite)) throw new Error('BlackScholesLab: standardized normal terms are not representable at this numerical scale.');
    const nd1 = blackScholesNormalCdf(d1), nd2 = blackScholesNormalCdf(d2), minusD1 = blackScholesNormalCdf(-d1), minusD2 = blackScholesNormalCdf(-d2), phi = Math.exp(-.5 * d1 * d1) / Math.sqrt(2 * Math.PI), rawCall = a * nd1 - b * nd2, rawPut = b * minusD2 - a * minusD1;
    if (Math.min(rawCall, rawPut) < -1e-12 * Math.max(a, b)) throw new Error('BlackScholesLab: price cancellation exceeds the supported numerical tolerance.');
    // Evaluate the out-of-the-money side and recover its partner by parity.
    // Bounding a tiny negative residual only removes floating-point roundoff.
    const call = a <= b ? Math.max(rawCall, 0) : Math.max(rawPut, 0) + a - b, put = a <= b ? call + b - a : Math.max(rawPut, 0);
    result = { mode: 'regular', call, put, d1, d2, nd1, nd2, callDelta: dividendDiscount * nd1, putDelta: -dividendDiscount * minusD1, callItmProbability: nd2, putItmProbability: minusD2, discount, prepaidSpot: a, discountedStrike: b, assetLeg: a * nd1, cashLeg: b * nd2, callTheta: -a * phi * v / (2 * Math.sqrt(t)) - r * b * nd2 + q * a * nd1, putTheta: -a * phi * v / (2 * Math.sqrt(t)) + r * b * minusD2 - q * a * minusD1, vega: a * phi * Math.sqrt(t), forward, logReturnSd: sd };
  }
  if (Object.values(result).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new Error('BlackScholesLab: an output is outside the finite numerical domain.');
  return result;
}

export interface PhysicalLognormalInputs { spot: number; strike: number; volatility: number; time: number; priceDrift: number }
/** A separately stated capital-gain price drift under a physical lognormal law.
 * This probability calculation does not assert an arbitrage-free pricing
 * measure or convert an estimated physical drift into a discount rate. */
export function physicalLognormalSummary(x: PhysicalLognormalInputs) {
  modelGuard({ ...x, rate: x.priceDrift, dividendYield: 0 });
  const sd = x.volatility * Math.sqrt(x.time), mean = x.spot * Math.exp(x.priceDrift * x.time), median = x.spot * Math.exp((x.priceDrift - .5 * x.volatility * x.volatility) * x.time);
  let callItmProbability: number, putItmProbability: number;
  if (x.time === 0 || x.volatility === 0) { callItmProbability = median > x.strike ? 1 : 0; putItmProbability = median < x.strike ? 1 : 0; }
  else { if (sd < 1e-8) throw new Error('BlackScholesLab: positive physical dispersion is below this CDF evaluator’s supported numerical resolution.'); const z = (Math.log(x.spot / x.strike) + (x.priceDrift - .5 * x.volatility * x.volatility) * x.time) / sd; if (!Number.isFinite(z)) throw new Error('BlackScholesLab: the physical normal argument is outside the numerical domain.'); callItmProbability = blackScholesNormalCdf(z); putItmProbability = blackScholesNormalCdf(-z); }
  if (![mean, median, callItmProbability, putItmProbability].every(Number.isFinite)) throw new Error('BlackScholesLab: physical distribution outputs exceed the finite numerical domain.');
  return { mean, median, callItmProbability, putItmProbability };
}

function textGuard(labels: string[], count: number) { if (!Array.isArray(labels) || labels.length !== count || labels.some(label => typeof label !== 'string' || !label.trim())) throw new Error(`BlackScholesLab: supply ${count} nonempty localized labels.`); }
function Shell({ title, caption, children, className }: { title: string; caption: string; children: ReactNode; className?: string }) { return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5', className)}><figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>{children}<p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p></figure>; }
function Range({ id, label, value, min, max, step, display, change }: { id: string; label: string; value: number; min: number; max: number; step: number; display: string; change: (value: number) => void }) { return <div className="flex min-w-0 flex-col"><label htmlFor={id} className="flex flex-1 flex-col text-sm text-ink-700">{label}<output htmlFor={id} className="mt-auto block pt-1 font-mono font-semibold">{display}</output></label><input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={display} onChange={event => change(Number(event.target.value))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></div>; }
function Bars({ label, names, values, display }: { label: string; names: string[]; values: number[]; display: (value: number) => string }) { const max = Math.max(.01, ...values.map(Math.abs)); return <div role="group" aria-label={label} className="mt-4 space-y-3">{values.map((value, i) => <div key={names[i]}><div className="flex flex-wrap justify-between gap-x-3 text-sm"><span>{names[i]}</span><span className="font-mono">{display(value)}</span></div><div aria-hidden="true" className="relative mt-1 h-4 rounded-sm bg-surface"><div className={cx('h-full rounded-sm', i === 1 ? 'bg-accent-500' : 'bg-brand-600')} style={{ width: `${renderNumber(100 * Math.abs(value) / max)}%` }} /></div></div>)}</div>; }
function DataTable({ label, headers, rows }: { label: string; headers: string[]; rows: string[][] }) { return <details className="mt-4 text-sm"><summary className="w-fit cursor-pointer rounded-sm py-2 font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{label}</summary><div className="mt-2 min-w-0"><table tabIndex={0} aria-label={label} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{headers.map(header => <th key={header} scope="col" className="px-2 py-2">{header}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => j === 0 ? <th key={j} scope="row" className="px-2 py-2 font-medium">{value}</th> : <td key={j} className="whitespace-nowrap px-2 py-2 font-mono">{value}</td>)}</tr>)}</tbody></table></div></details>; }
interface CurvePoint { x: number; first: number; second?: number }
function Curve({ points, selected, labels, xLabel, title, scrollLabel, hint, number, maxY }: { points: CurvePoint[]; selected: CurvePoint; labels: string[]; xLabel: string; title: string; scrollLabel: string; hint: string; number: (value: number, digits?: number) => string; maxY?: number }) {
  const w = 600, h = 250, left = 62, right = 28, top = 24, bottom = 40, minX = points[0].x, maxX = points.at(-1)!.x, limit = maxY ?? Math.max(.01, ...points.flatMap(point => [point.first, point.second ?? 0])) * 1.1, x = (value: number) => renderNumber(left + (value - minX) / (maxX - minX) * (w - left - right)), y = (value: number) => renderNumber(h - bottom - value / limit * (h - top - bottom)), path = (key: 'first' | 'second') => points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${x(point.x)} ${y(point[key] ?? 0)}`).join(' '), series = points[0].second === undefined ? 1 : 2;
  return <div className="mt-5 min-w-0"><p className="text-sm font-semibold text-ink-800">{title}</p><div role="region" tabIndex={0} aria-label={scrollLabel.replaceAll('{title}', title)} className="mt-2 max-w-full overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><svg viewBox={`0 0 ${w} ${h}`} className="block w-full min-w-[600px]" role="img" aria-label={title}><line x1={left} x2={w - right} y1={h - bottom} y2={h - bottom} stroke="var(--color-ink-300)" />{[0, .5, 1].map(fraction => <g key={fraction}><line x1={left} x2={w - right} y1={y(fraction * limit)} y2={y(fraction * limit)} stroke="var(--color-ink-200)" /><text x={left - 9} y={renderNumber(y(fraction * limit) + 5)} textAnchor="end" fontSize={14} fill="var(--color-ink-600)">{number(fraction * limit, Math.abs(fraction * limit) < .1 ? 6 : 2)}</text></g>)}{[0, .25, .5, .75, 1].map(fraction => { const value = minX + fraction * (maxX - minX); return <text key={fraction} x={x(value)} y={h - 14} textAnchor="middle" fontSize={14} fill="var(--color-ink-600)">{number(value, 2)}</text>; })}<path d={path('first')} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} />{series === 2 && <path d={path('second')} fill="none" stroke="var(--color-accent-600)" strokeWidth={3} />}<circle cx={x(selected.x)} cy={y(selected.first)} r={5} fill="var(--color-brand-600)" />{series === 2 && <circle cx={x(selected.x)} cy={y(selected.second ?? 0)} r={5} fill="var(--color-accent-600)" />}</svg></div><p className="mt-2 text-sm text-ink-700">{xLabel}</p><ul className="mt-2 flex list-none flex-wrap gap-4 text-sm">{labels.slice(0, series).map((label, i) => <li key={label} className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className={cx('h-1 w-5 rounded-sm', i === 0 ? 'bg-brand-600' : 'bg-accent-600')} />{label}</li>)}</ul><p className="mt-2 text-sm text-ink-600">{hint}</p></div>;
}

export type BlackScholesView = 'inputs' | 'components' | 'measure' | 'probability' | 'dividends' | 'limits';
export interface BlackScholesLabProps {
  view?: BlackScholesView;
  spot?: number;
  strike?: number;
  volatilityPct?: number;
  time?: number;
  ratePct?: number;
  dividendYieldPct?: number;
  physicalPriceDriftPct?: number;
  title?: string;
  controls?: string[];
  readoutLabels?: string[];
  optionLabels?: string[];
  termLabels?: string[];
  measureLabels?: string[];
  comparisonLabels?: string[];
  unitsLabel?: string;
  regularLabel?: string;
  expiryLabel?: string;
  deterministicLabel?: string;
  undefinedLabel?: string;
  priceCurveLabel?: string;
  volatilityPriceCurveLabel?: string;
  probabilityCurveLabel?: string;
  spotXAxisLabel?: string;
  volatilityXAxisLabel?: string;
  curveScrollLabel?: string;
  scrollHint?: string;
  termChartLabel?: string;
  measureChartLabel?: string;
  comparisonChartLabel?: string;
  spotTableLabel?: string;
  volatilityTableLabel?: string;
  spotTableHeaders?: string[];
  volatilityTableHeaders?: string[];
  caption?: string;
  locale?: string;
  className?: string;
}
const defaultReadouts = ['European model call, currency per share', 'European model put, currency per share', 'd1, dimensionless', 'd2, dimensionless', 'Spot delta of the call, shares per option share', 'Spot delta of the put, shares per option share', 'Q probability of call finishing strictly in the money', 'Q probability of put finishing strictly in the money', 'Normal CDF N(d1)', 'Risk-free discount factor over the remaining term', 'Prepaid-stock value S exp(−qT)', 'Discounted strike K exp(−rT)', 'Exercise-indicator-weighted asset value', 'Exercise-indicator-weighted cash payment', 'Standard deviation of the log return over the term', 'Pricing-model forward price', 'Call theta per calendar year', 'Put theta per calendar year', 'Vega per unit volatility', 'Physical mean terminal price', 'Q mean terminal price', 'Physical median terminal price', 'Q median terminal price', 'Physical call exercise probability', 'Q call exercise probability', 'Equivalent effective annual financing rate'];
export function BlackScholesLab({ view = 'components', spot = 100, strike = 100, volatilityPct = 20, time = 1, ratePct = 5, dividendYieldPct = 0, physicalPriceDriftPct = 12, title = 'Read a European model price with its assumptions', controls = ['Current spot price', 'Strike price', 'Annualized log-return volatility, percent', 'Remaining time, years', 'Annual continuously compounded financing rate', 'Continuous proportional dividend yield per year', 'Physical capital-gain price drift per year'], readoutLabels = defaultReadouts, optionLabels = ['Call', 'Put'], termLabels = ['Asset received, indicator weighted', 'Strike paid, indicator weighted', 'Call value: asset less cash'], measureLabels = ['Physical exercise probability', 'Q exercise probability'], comparisonLabels = ['Spot delta', 'N(d1)', 'Call exercise probability under Q'], unitsLabel = 'European exercise, positive spot/strike, constant annual continuous financing/dividend yields, annualized log-return volatility and matching years. The model assumes frictionless dynamic replication, no jumps and the stated continuous proportional dividends. Numerical CDF evaluation is approximate; a model price is not a quoted execution or a physical return forecast.', regularLabel = 'Positive time and volatility: the regular lognormal pricing formulas apply. Q ex-dividend price drift is r−q; a physical capital-gain drift is a separate assumption.', expiryLabel = 'Expiry: the payoff is known. No normal d terms or future density are supplied. At the payoff kink delta is undefined, and strictly in-the-money probabilities are zero for both sides at an exact tie.', deterministicLabel = 'Zero volatility with positive time: use the discounted deterministic-forward payoff. The normal d terms are undefined. At a deterministic tie, strict exercise indicators are both zero; the positive-variance probability limit need not equal that tie value.', undefinedLabel = 'Undefined at this boundary', priceCurveLabel = 'Model call and put values versus the current spot, currency per share', volatilityPriceCurveLabel = 'Model call value versus annualized volatility, currency per share', probabilityCurveLabel = 'Q call exercise probability versus annualized volatility, fraction', spotXAxisLabel = 'Horizontal: current spot price, currency per share', volatilityXAxisLabel = 'Horizontal: annualized log-return volatility, percent', curveScrollLabel = 'Scrollable model curve: {title}', scrollHint = 'Focus the plot and use left/right arrow keys, or scroll horizontally, to read its full axis. Lines connect sampled model values; exact selected results appear below.', termChartLabel = 'The two discounted exercise-weighted terms and their difference', measureChartLabel = 'Physical versus pricing exercise probability at the same strike', comparisonChartLabel = 'Delta, N(d1) and exercise probability are different quantities', spotTableLabel = 'Sampled call and put model values across current spot prices', volatilityTableLabel = 'Sampled call values and Q exercise probabilities across annualized volatility', spotTableHeaders = ['Current spot', 'Model call', 'Model put'], volatilityTableHeaders = ['Annualized volatility', 'Model call', 'Q call exercise probability'], caption = 'Keep contract, measure and units attached to every result. Volatility can be a specified model input or calibrated implied parameter; it is not automatically a physical forecast. Time and zero-volatility boundaries are shown explicitly instead of being clamped to another contract.', locale = 'en-US', className }: BlackScholesLabProps) {
  const visible: Record<BlackScholesView, number[]> = { inputs: [0, 1, 2, 3, 4, 5], components: [1, 2, 4], measure: [1, 2, 3, 6], probability: [1, 2, 3], dividends: [5], limits: [0, 1, 2, 3] };
  if (!Object.hasOwn(visible, view) || !finite(spot, 20, 200) || !finite(strike, 20, 200) || !finite(volatilityPct, 0, 80) || !finite(time, 0, 3) || !finite(ratePct, -5, 15) || !finite(dividendYieldPct, 0, 10) || !finite(physicalPriceDriftPct, -10, 20)) throw new Error('BlackScholesLab: use a supported view and bounded finite author inputs for spot, strike, volatility, years, continuous financing/dividends and physical price drift.');
  const positiveComparison = view === 'measure' || view === 'probability', minima = [20, 20, positiveComparison ? 5 : 0, positiveComparison ? .25 : 0, -5, 0, -10], maxima = [200, 200, 80, 3, 15, 10, 20], steps = [1, 1, 1, .25, 1, 1, 1], initial = [spot, strike, volatilityPct, time, ratePct, dividendYieldPct, physicalPriceDriftPct];
  if (visible[view].some(i => !onGrid(initial[i], minima[i], maxima[i], steps[i]))) throw new Error('BlackScholesLab: visible controlled author values must lie on their native grids: spot/strike in whole currency units, volatility/rates/yields/drift in whole percentage points, and time in quarter years. Probability/measure comparisons require positive time and at least 5% annualized volatility.');
  textGuard(controls, 7); textGuard(readoutLabels, 26); textGuard(optionLabels, 2); textGuard(termLabels, 3); textGuard(measureLabels, 2); textGuard(comparisonLabels, 3); textGuard(spotTableHeaders, 3); textGuard(volatilityTableHeaders, 3);
  calculateBlackScholes({ spot, strike, volatility: volatilityPct / 100, time, rate: ratePct / 100, dividendYield: dividendYieldPct / 100 });
  const id = useId(), [s, setS] = useState(spot), [k, setK] = useState(strike), [v, setV] = useState(volatilityPct), [t, setT] = useState(time), [r, setR] = useState(ratePct), [q, setQ] = useState(dividendYieldPct), [mu, setMu] = useState(physicalPriceDriftPct), number = (value: number, digits = 6) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Object.is(value, -0) ? 0 : value), percent = (value: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 6 }).format(value), input: BlackScholesInputs = { spot: s, strike: k, volatility: v / 100, time: t, rate: r / 100, dividendYield: q / 100 }, result = calculateBlackScholes(input), physical = view === 'measure' ? physicalLognormalSummary({ spot: s, strike: k, volatility: v / 100, time: t, priceDrift: mu / 100 }) : null, values = [s, k, v, t, r, q, mu], setters = [setS, setK, setV, setT, setR, setQ, setMu];
  const allValues: (number | null)[] = [result.call, result.put, result.d1, result.d2, result.callDelta, result.putDelta, result.callItmProbability, result.putItmProbability, result.nd1, result.discount, result.prepaidSpot, result.discountedStrike, result.assetLeg, result.cashLeg, result.logReturnSd, result.forward, result.callTheta, result.putTheta, result.vega, physical?.mean ?? null, s * Math.exp((r - q) / 100 * t), physical?.median ?? null, s * Math.exp(((r - q) / 100 - .5 * (v / 100) ** 2) * t), physical?.callItmProbability ?? null, result.callItmProbability, Math.expm1(r / 100)], indices: Record<BlackScholesView, number[]> = { inputs: [0, 1, 9, 10, 11, 14, 15, 25], components: [0, 1, 2, 3, 8, 6, 12, 13], measure: [0, 19, 20, 21, 22, 23, 24], probability: [0, 1, 2, 3, 6, 8, 4], dividends: [0, 1, 4, 5, 8, 6, 10, 11], limits: [0, 1, 2, 3, 4, 5, 6, 7, 16, 17] };
  const spotSamples = [...new Set([...Array.from({ length: 37 }, (_, i) => 20 + i * 5), ...(v === 0 && k * Math.exp((q - r) / 100 * t) >= 20 && k * Math.exp((q - r) / 100 * t) <= 200 ? [k * Math.exp((q - r) / 100 * t)] : []), s])].sort((a, b) => a - b).map(value => { const model = calculateBlackScholes({ ...input, spot: value }); return { x: value, first: model.call, second: model.put }; }), volatilitySamples = [...new Set([...Array.from({ length: 16 }, (_, i) => 5 + 5 * i), Math.max(5, v)])].sort((a, b) => a - b).map(value => { const model = calculateBlackScholes({ ...input, volatility: value / 100 }); return { x: value, first: model.call, second: model.callItmProbability }; });
  return <Shell title={title} caption={caption} className={className}><p className="mt-3 text-sm leading-relaxed text-ink-600">{unitsLabel}</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{visible[view].map(i => <Range key={i} id={`${id}-${i}`} label={controls[i]} value={values[i]} min={minima[i]} max={maxima[i]} step={steps[i]} display={i === 2 || i >= 4 ? percent(values[i] / 100) : number(values[i], 2)} change={setters[i]} />)}</div><p role="status" className="mt-4 text-sm leading-relaxed text-ink-700">{result.mode === 'regular' ? regularLabel : result.mode === 'expiry' ? expiryLabel : deterministicLabel}</p>{(view === 'inputs' || view === 'limits') && <><Curve points={spotSamples} selected={{ x: s, first: result.call, second: result.put }} labels={optionLabels} xLabel={spotXAxisLabel} title={priceCurveLabel} scrollLabel={curveScrollLabel} hint={scrollHint} number={number} /><DataTable label={spotTableLabel} headers={spotTableHeaders} rows={spotSamples.map(point => [number(point.x), number(point.first), number(point.second!)])} /></>}{view === 'components' && <Bars label={termChartLabel} names={termLabels} values={[result.assetLeg, result.cashLeg, result.call]} display={number} />}{view === 'measure' && physical && <Bars label={measureChartLabel} names={measureLabels} values={[physical.callItmProbability, result.callItmProbability]} display={percent} />}{view === 'probability' && <><Curve points={volatilitySamples.map(point => ({ x: point.x, first: point.first }))} selected={{ x: v, first: result.call }} labels={[optionLabels[0]]} xLabel={volatilityXAxisLabel} title={volatilityPriceCurveLabel} scrollLabel={curveScrollLabel} hint={scrollHint} number={number} /><Curve points={volatilitySamples.map(point => ({ x: point.x, first: point.second! }))} selected={{ x: v, first: result.callItmProbability }} labels={[measureLabels[1]]} xLabel={volatilityXAxisLabel} title={probabilityCurveLabel} scrollLabel={curveScrollLabel} hint={scrollHint} number={number} maxY={1} /><DataTable label={volatilityTableLabel} headers={volatilityTableHeaders} rows={volatilitySamples.map(point => [percent(point.x / 100), number(point.first), percent(point.second!)])} /></>}{view === 'dividends' && result.nd1 !== null && result.callDelta !== null && <Bars label={comparisonChartLabel} names={comparisonLabels} values={[result.callDelta!, result.nd1!, result.callItmProbability]} display={number} />}<dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{indices[view].map(index => <div key={index} className="min-w-0 rounded-card bg-surface p-3"><dt className="text-ink-700">{readoutLabels[index]}</dt><dd className="mt-1 break-words font-mono font-semibold">{allValues[index] === null ? undefinedLabel : [6, 7, 23, 24, 25].includes(index) ? percent(allValues[index]!) : number(allValues[index]!)}</dd></div>)}</dl></Shell>;
}
