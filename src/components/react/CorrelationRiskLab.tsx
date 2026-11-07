import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PairedValue { x: number; y: number }
export interface WeightedPair extends PairedValue { probability: number }
const sum = (values: number[]) => {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
};
const numericError = () => { throw new Error('CorrelationRiskLab: nonconstant variation or covariance is outside the supported numerical scale; rescale the measurement units.'); };
/** Population moments of an explicitly supplied finite joint law. */
export function calculateWeightedMoments(states: WeightedPair[]) {
  if (!Array.isArray(states) || states.length < 1 || states.length > 1000 || states.some(s => !s || !Number.isFinite(s.x) || !Number.isFinite(s.y) || Math.abs(s.x) > 10000 || Math.abs(s.y) > 10000 || !Number.isFinite(s.probability) || s.probability < 0 || s.probability > 1)) throw new Error('CorrelationRiskLab: supply one to 1000 finite supported paired values and nonnegative probabilities.');
  const total = sum(states.map(s => s.probability));
  if (Math.abs(total - 1) > 1e-8) throw new Error('CorrelationRiskLab: supplied probabilities must sum to one within the stated floating-point tolerance.');
  const positive = states.filter(s => s.probability > 0).map(s => ({ ...s, probability: s.probability / total }));
  if (!positive.length) throw new Error('CorrelationRiskLab: at least one joint state must have positive probability.');
  const originX = positive[0].x, originY = positive[0].y;
  const meanX = originX + sum(positive.map(s => s.probability * (s.x - originX))), meanY = originY + sum(positive.map(s => s.probability * (s.y - originY)));
  const deviations = positive.map(s => ({ ...s, dx: s.x - meanX, dy: s.y - meanY }));
  const scaleX = Math.max(...deviations.map(s => Math.abs(s.dx))), scaleY = Math.max(...deviations.map(s => Math.abs(s.dy)));
  const nx = scaleX ? sum(deviations.map(s => s.probability * (s.dx / scaleX) ** 2)) : 0;
  const ny = scaleY ? sum(deviations.map(s => s.probability * (s.dy / scaleY) ** 2)) : 0;
  const cross = scaleX && scaleY ? sum(deviations.map(s => s.probability * (s.dx / scaleX) * (s.dy / scaleY))) : 0;
  const varianceX = scaleX * (scaleX * nx), varianceY = scaleY * (scaleY * ny), covariance = scaleX * (scaleY * cross);
  if (scaleX > 0 && varianceX === 0 || scaleY > 0 && varianceY === 0 || cross !== 0 && covariance === 0) numericError();
  let correlation = scaleX && scaleY ? cross / Math.sqrt(nx) / Math.sqrt(ny) : null;
  // The exact coefficient obeys Cauchy–Schwarz. Snap only overshoots within 64 epsilons.
  if (correlation !== null && Math.abs(correlation) > 1) {
    if (Math.abs(correlation) > 1 + 64 * Number.EPSILON) numericError();
    correlation = Math.sign(correlation);
  }
  if ([meanX, meanY, varianceX, varianceY, covariance, correlation].some(v => v !== null && !Number.isFinite(v))) numericError();
  return { meanX, meanY, varianceX, varianceY, covariance, sdX: Math.sqrt(varianceX), sdY: Math.sqrt(varianceY), correlation };
}
export function calculatePairedMoments(pairs: PairedValue[], convention: 'population' | 'sample' = 'sample') {
  if (!Array.isArray(pairs) || !['population', 'sample'].includes(convention) || pairs.length < (convention === 'sample' ? 2 : 1)) throw new Error('CorrelationRiskLab: use a supported moment convention and enough complete paired observations.');
  const n = pairs.length, result = calculateWeightedMoments(pairs.map(s => ({ ...s, probability: 1 / n }))), adjustment = convention === 'sample' ? n / (n - 1) : 1;
  const varianceX = result.varianceX * adjustment, varianceY = result.varianceY * adjustment, covariance = result.covariance * adjustment;
  return { ...result, n, divisor: convention === 'sample' ? n - 1 : n, varianceX, varianceY, covariance, sdX: Math.sqrt(varianceX), sdY: Math.sqrt(varianceY), sumXX: result.varianceX * n, sumYY: result.varianceY * n, sumXY: result.covariance * n, rows: pairs.map((s, i) => ({ ...s, index: i + 1, dx: s.x - result.meanX, dy: s.y - result.meanY, product: (s.x - result.meanX) * (s.y - result.meanY) })) };
}
export function calculateTwoAssetRisk(volA: number, volB: number, correlation: number, weightA: number) {
  if (![volA, volB].every(v => Number.isFinite(v) && v >= 0 && v <= 1) || !Number.isFinite(correlation) || correlation < -1 || correlation > 1 || !Number.isFinite(weightA) || weightA < 0 || weightA > 1) throw new Error('CorrelationRiskLab: use finite standard deviations from zero to one, correlation from minus one to one and a long-only weight from zero to one.');
  const scale = Math.max(volA, volB), defined = volA > 0 && volB > 0;
  if (!scale) return { covariance: 0, variance: 0, volatility: 0, referenceVol: 0, gapVol: 0, correlation: null, minimumWeight: null, minimumVol: 0 };
  if (volA > 0 && volA * volA === 0 || volB > 0 && volB * volB === 0) numericError();
  const a = volA / scale, b = volB / scale, u = weightA * a, v = (1 - weightA) * b;
  const varianceNorm = (u - v) ** 2 + 2 * u * v * (1 + correlation), volatility = scale * Math.sqrt(varianceNorm), variance = volatility * volatility, covariance = volA * (volB * correlation);
  if (varianceNorm > 0 && variance === 0 || defined && correlation !== 0 && covariance === 0) numericError();
  const referenceVol = scale * (u + v), gapVol = u + v + Math.sqrt(varianceNorm) > 0 ? scale * 2 * u * v * (1 - correlation) / (u + v + Math.sqrt(varianceNorm)) : 0;
  const denominator = (a - b) ** 2 + 2 * a * b * (1 - correlation);
  const minimumWeight = denominator ? Math.max(0, Math.min(1, (b * b - a * b * correlation) / denominator)) : null;
  const minimumVol = minimumWeight === null ? volA : minimumWeight === 0 ? volB : minimumWeight === 1 ? volA : scale * Math.sqrt((a * b) ** 2 * (1 - correlation) * (1 + correlation) / denominator);
  if (minimumWeight !== null && minimumWeight > 0 && minimumWeight < 1 && Math.abs(correlation) < 1 && defined && minimumVol === 0) numericError();
  return { covariance, variance, volatility, referenceVol, gapVol, correlation: defined ? correlation : null, minimumWeight, minimumVol };
}
/** Mixture of two explicit joint laws, with identical marginals and zero covariance. */
export function calculateFiniteJointLoss(mixture: number) {
  if (!Number.isFinite(mixture) || mixture < 0 || mixture > 1) throw new Error('CorrelationRiskLab: the finite joint-law mixture weight must be between zero and one.');
  const values = [-.3, -.15, .15, .3], marginal = [.1, .4, .4, .1];
  const states: WeightedPair[] = values.flatMap((x, i) => values.map((y, j) => {
    const dependent = i === 0 && j === 0 || i === 3 && j === 3 ? .1 : i === 1 && j === 2 || i === 2 && j === 1 ? .4 : 0;
    return { x, y, probability: (1 - mixture) * marginal[i] * marginal[j] + mixture * dependent };
  }));
  const moments = calculateWeightedMoments(states), tailX = sum(states.filter(s => s.x <= -.2).map(s => s.probability)), tailY = sum(states.filter(s => s.y <= -.2).map(s => s.probability)), joint = sum(states.filter(s => s.x <= -.2 && s.y <= -.2).map(s => s.probability));
  return { states, ...moments, equalWeightVolatility: Math.sqrt((moments.varianceX + moments.varianceY + 2 * moments.covariance) / 4), tailX, tailY, joint, conditional: joint / tailX, independentJoint: tailX * tailY };
}
const defaultLabels = {
  momentModel: 'The base pairs are A 10, -2, 4 and B 4, 0, 2 in percentage points. The switches can make A constant or add a fourth pair. Interpret the displayed cases as an equal-probability population or use the sample n-minus-one convention; neither choice proves a future return law.',
  riskModel: 'Invented one-period simple-return moments and initial long-only weights summing to one, before costs or external flows. The plotted variance is conditional on those inputs; no expected-return improvement or executable hedge is established.',
  jointModel: 'Two invented one-period joint laws share means zero, marginal variances 0.036 in squared decimal-return units and zero covariance. The mixture changes which outcomes occur together while preserving these moments. The event is both returns at or below -20%, a finite threshold, not a limiting tail coefficient.',
  convention: 'Moment convention', population: 'Population: divide by n', sample: 'Sample: divide by n minus one', units: 'Return display units', pp: 'Percentage points', decimal: 'Decimal returns', constant: 'Make all A returns constant at 4 percentage points', extra: 'Add a fourth pair: A 10, B 0 percentage points when A is variable',
  volA: 'Standard deviation of asset A per period', volB: 'Standard deviation of asset B per period', rho: 'Model correlation when both standard deviations are positive', weight: 'Initial long-only weight in asset A', mixture: 'Weight of the dependent four-state joint law',
  n: 'Number of displayed pairs', divisor: 'Divisor of the centered products', meanX: 'Mean return of A in the selected units', meanY: 'Mean return of B in the selected units', varianceX: 'Variance of A in squared selected units', varianceY: 'Variance of B in squared selected units', covariance: 'Covariance under the selected convention', sdX: 'Standard deviation of A in the selected units', sdY: 'Standard deviation of B in the selected units', coefficient: 'Pearson coefficient of the displayed pairs',
  undefined: 'Undefined: at least one standard deviation is zero', constantMessage: 'A constant series has zero deviations and covariance. Dividing by its zero standard deviation does not define a correlation; it must not be reported as zero.',
  modelCovariance: 'Model covariance in squared percentage points', modelVariance: 'Portfolio variance in squared percentage points', portfolioVol: 'Portfolio standard deviation', reference: 'Same-weight volatility at correlation plus one', gap: 'Volatility gap to that reference, percentage points', minimumWeight: 'Long-only minimum-variance weight in A', minimumVol: 'Long-only minimum standard deviation', family: 'Every permitted weight has the same minimum variance', inactive: 'Correlation is undefined for a zero-variance input; its control is inactive and covariance is zero.',
  probability: 'Joint-state probability', marginalA: 'Probability A is at or below the threshold', marginalB: 'Probability B is at or below the threshold', joint: 'Probability both are at or below the threshold', independentJoint: 'Joint probability if these marginals are independent', conditional: 'Probability B crosses the threshold given that A crosses it', jointCoefficient: 'Population Pearson correlation of this joint law', jointCovariance: 'Population covariance in decimal-return units squared', equalWeightVolatility: 'Standard deviation of the equal-weight portfolio',
  momentAxis: 'Horizontal axis: A deviation from its displayed mean. Vertical axis: B deviation from its displayed mean. Each axis uses its own printed scale in the selected return units. Repeated pairs may overlap; the table retains every row.',
  riskAxis: 'Horizontal axis: long-only weight in A, percent. Vertical axis: portfolio standard deviation per period, percent. The curve samples the stated moment formula, not an observed return path.',
  jointAxis: 'Horizontal axis: A return, percent. Vertical axis: B return, percent. Dashed lines mark -20%. The shaded corner is their joint finite-threshold loss event. Circle area is proportional to positive joint probability; zero-mass states remain in the table.',
  selected: 'Chosen weight', minimum: 'Calculated minimum', landmark: 'Curve landmark', marker: 'Point description', point: 'Pair or state', returnA: 'A return', returnB: 'B return', deviationA: 'A deviation', deviationB: 'B deviation', product: 'Product of the deviations', weightA: 'Weight in A',
  momentUnits: 'In percentage-point display, covariance and variances are in pp squared; in decimal display they are in decimal-return units squared. Standard deviations use the unsquared selected units. Correlation has no units.',
  chart: 'Calculated joint returns or portfolio-risk relationship. Live results and the focusable data table retain the complete inputs and relevant numeric values.', table: 'Calculated paired moments, risk landmarks or joint probabilities; focus and use arrow keys to scroll horizontally', caption: 'Keep the input distribution, moment convention, units, horizon and weight constraints with the calculation. A historical or assumed correlation is not a guarantee about future joint outcomes.',
};
export type CorrelationRiskLabels = typeof defaultLabels;
export interface CorrelationRiskLabProps {
  view?: 'moments' | 'portfolio' | 'joint'; convention?: 'population' | 'sample'; unit?: 'pp' | 'decimal'; constantA?: boolean; extraObservation?: boolean;
  volA?: number; volB?: number; correlation?: number; weightA?: number; mixture?: number;
  title?: string; caption?: string; locale?: string; labels?: CorrelationRiskLabels; className?: string;
}
const grid = (v: number, min: number, max: number, step: number, name: string) => {
  if (!Number.isFinite(v) || v < min || v > max || Math.abs((v - min) / step - Math.round((v - min) / step)) > 1e-8) throw new Error(`CorrelationRiskLab: ${name} must match its native control range and step.`);
};
export function CorrelationRiskLab({ view = 'moments', convention = 'sample', unit = 'pp', constantA = false, extraObservation = false, volA = .3, volB = .2, correlation = 0, weightA = .5, mixture = 1, title = 'Keep the paired data and risk assumptions together', caption, locale = 'en-US', labels = defaultLabels, className }: CorrelationRiskLabProps) {
  if (!['moments', 'portfolio', 'joint'].includes(view) || !['population', 'sample'].includes(convention) || !['pp', 'decimal'].includes(unit) || typeof constantA !== 'boolean' || typeof extraObservation !== 'boolean') throw new Error('CorrelationRiskLab: provide supported view, moment convention, return units and boolean data switches.');
  grid(volA, 0, .6, .05, 'asset A standard deviation'); grid(volB, 0, .6, .05, 'asset B standard deviation'); grid(correlation, -1, 1, .05, 'correlation'); grid(weightA, 0, 1, .05, 'long-only weight'); grid(mixture, 0, 1, .05, 'joint-law mixture');
  if (!labels || typeof labels !== 'object') throw new Error('CorrelationRiskLab: provide all localized labels.');
  for (const key of Object.keys(defaultLabels) as (keyof CorrelationRiskLabels)[]) if (typeof labels[key] !== 'string' || !labels[key].trim()) throw new Error(`CorrelationRiskLab: provide the nonempty localized ${key} label.`);
  const id = useId(), l = labels;
  const [chosenConvention, setConvention] = useState(convention), [chosenUnit, setUnit] = useState(unit), [isConstant, setConstant] = useState(constantA), [hasExtra, setExtra] = useState(extraObservation);
  const [sigmaA, setSigmaA] = useState(volA), [sigmaB, setSigmaB] = useState(volB), [rho, setRho] = useState(correlation), [weight, setWeight] = useState(weightA), [coupling, setCoupling] = useState(mixture);
  const factor = chosenUnit === 'pp' ? 1 : .01;
  const raw = [[10, 4], [-2, 0], [4, 2], ...(hasExtra ? [[10, 0]] : [])];
  const pairs = raw.map(([x, y]) => ({ x: (isConstant ? 4 : x) * factor, y: y * factor }));
  const moments = calculatePairedMoments(pairs, chosenConvention), risk = calculateTwoAssetRisk(sigmaA, sigmaB, rho, weight), joint = calculateFiniteJointLoss(coupling);
  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Math.abs(n) < 5e-9 ? 0 : n);
  const percent = (n: number) => new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Math.abs(n) < 5e-9 ? 0 : n);
  const tick = (n: number) => new Intl.NumberFormat(locale, { useGrouping: false, maximumSignificantDigits: 4 }).format(Math.abs(n) < 1e-12 ? 0 : n);
  const resultRows: [string, string, string][] = view === 'moments' ? [['n', l.n, number(moments.n)], ['divisor', l.divisor, number(moments.divisor)], ['meanX', l.meanX, number(moments.meanX)], ['meanY', l.meanY, number(moments.meanY)], ['varianceX', l.varianceX, number(moments.varianceX)], ['varianceY', l.varianceY, number(moments.varianceY)], ['covariance', l.covariance, number(moments.covariance)], ['sdX', l.sdX, number(moments.sdX)], ['sdY', l.sdY, number(moments.sdY)], ['correlation', l.coefficient, moments.correlation === null ? l.undefined : number(moments.correlation)]] : view === 'portfolio' ? [['correlation', l.rho, risk.correlation === null ? l.undefined : number(risk.correlation)], ['covariance', l.modelCovariance, number(10000 * risk.covariance)], ['variance', l.modelVariance, number(10000 * risk.variance)], ['volatility', l.portfolioVol, percent(risk.volatility)], ['reference', l.reference, percent(risk.referenceVol)], ['gap', l.gap, number(100 * risk.gapVol)], ['minimumWeight', l.minimumWeight, risk.minimumWeight === null ? l.family : percent(risk.minimumWeight)], ['minimumVol', l.minimumVol, percent(risk.minimumVol)]] : [['correlation', l.jointCoefficient, joint.correlation === null ? l.undefined : number(joint.correlation)], ['covariance', l.jointCovariance, number(joint.covariance)], ['sdX', l.volA, percent(joint.sdX)], ['sdY', l.volB, percent(joint.sdY)], ['equalWeightVolatility', l.equalWeightVolatility, percent(joint.equalWeightVolatility)], ['tailX', l.marginalA, percent(joint.tailX)], ['tailY', l.marginalB, percent(joint.tailY)], ['joint', l.joint, percent(joint.joint)], ['independent', l.independentJoint, percent(joint.independentJoint)], ['conditional', l.conditional, percent(joint.conditional)]];
  const weights = [...Array.from({ length: 11 }, (_, i) => i / 10), weight, ...(risk.minimumWeight === null ? [] : [risk.minimumWeight])].sort((a, b) => a - b).filter((w, i, all) => !i || Math.abs(w - all[i - 1]) > 8 * Number.EPSILON);
  const headings = view === 'moments' ? [l.point, l.returnA, l.returnB, l.deviationA, l.deviationB, l.product] : view === 'portfolio' ? [l.weightA, l.portfolioVol, l.gap, l.marker] : [l.point, l.returnA, l.returnB, l.probability];
  const tableRows = view === 'moments' ? moments.rows.map(row => [number(row.index), number(row.x), number(row.y), number(row.dx), number(row.dy), number(row.product)]) : view === 'portfolio' ? weights.map(w => { const value = calculateTwoAssetRisk(sigmaA, sigmaB, rho, w); const flags = [Math.abs(w - weight) <= 8 * Number.EPSILON ? l.selected : '', risk.minimumWeight !== null && Math.abs(w - risk.minimumWeight) <= 8 * Number.EPSILON ? l.minimum : ''].filter(Boolean); return [percent(w), percent(value.volatility), number(100 * value.gapVol), flags.length ? flags.join('; ') : l.landmark]; }) : joint.states.map((s, i) => [number(i + 1), percent(s.x), percent(s.y), percent(s.probability)]);
  const W = 640, H = 350, left = 168, right = 574, top = 44, bottom = 258;
  const coord = (n: number) => Number(n.toFixed(3));
  const extentX = view === 'moments' ? Math.max(factor, ...moments.rows.map(s => Math.abs(s.dx))) : view === 'joint' ? 35 : 1;
  const extentY = view === 'moments' ? Math.max(factor, ...moments.rows.map(s => Math.abs(s.dy))) : view === 'joint' ? 35 : Math.max(sigmaA, sigmaB, .01) * 100;
  const xOf = (x: number) => coord(left + (view === 'portfolio' ? x : (x + extentX) / (2 * extentX)) * (right - left));
  const yOf = (y: number) => coord(bottom - (view === 'portfolio' ? y / extentY : (y + extentY) / (2 * extentY)) * (bottom - top));
  const xTicks = view === 'portfolio' ? [0, .5, 1] : view === 'joint' ? [-30, 0, 30] : [-extentX, 0, extentX];
  const yTicks = view === 'portfolio' ? [0, extentY / 2, extentY] : view === 'joint' ? [-30, 0, 30] : [-extentY, 0, extentY];
  const controls = [[l.volA, sigmaA, setSigmaA, 0, .6, .05, true], [l.volB, sigmaB, setSigmaB, 0, .6, .05, true], [l.rho, rho, setRho, -1, 1, .05, false], [l.weight, weight, setWeight, 0, 1, .05, true]] as const;
  return <figure data-correlation-view={view} className={cx('not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 shadow-soft sm:p-6', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed text-ink-700">{view === 'moments' ? l.momentModel : view === 'portfolio' ? l.riskModel : l.jointModel}</p>
    {view === 'moments' && <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block min-w-0 text-sm text-ink-800" htmlFor={`${id}-convention`}>{l.convention}<select id={`${id}-convention`} aria-label={l.convention} value={chosenConvention} onChange={e => setConvention(e.currentTarget.value as 'population' | 'sample')} className="mt-2 min-h-10 w-full rounded-sm border border-ink-300 bg-surface p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><option value="population">{l.population}</option><option value="sample">{l.sample}</option></select></label><label className="block min-w-0 text-sm text-ink-800" htmlFor={`${id}-units`}>{l.units}<select id={`${id}-units`} aria-label={l.units} value={chosenUnit} onChange={e => setUnit(e.currentTarget.value as 'pp' | 'decimal')} className="mt-2 min-h-10 w-full rounded-sm border border-ink-300 bg-surface p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><option value="pp">{l.pp}</option><option value="decimal">{l.decimal}</option></select></label><label className="flex min-h-8 items-start gap-2 text-sm text-ink-800"><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" type="checkbox" checked={isConstant} onChange={e => setConstant(e.currentTarget.checked)} />{l.constant}</label><label className="flex min-h-8 items-start gap-2 text-sm text-ink-800"><input className="mt-1 h-5 w-5 shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" type="checkbox" checked={hasExtra} onChange={e => setExtra(e.currentTarget.checked)} />{l.extra}</label></div>}
    {view === 'portfolio' && <div className="mt-4 grid gap-4 sm:grid-cols-2">{controls.map(([label, value, change, min, max, step, asPercent], i) => { const inactive = i === 2 && risk.correlation === null, display = inactive ? l.undefined : asPercent ? percent(value) : number(value); return <label key={label} htmlFor={`${id}-${i}`} className="block min-w-0 text-sm text-ink-800"><span className="flex flex-wrap justify-between gap-2"><span>{label}</span><output htmlFor={`${id}-${i}`} className="font-mono">{display}</output></span><input id={`${id}-${i}`} aria-label={label} aria-valuetext={display} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-40" type="range" min={min} max={max} step={step} value={value} disabled={inactive} onChange={e => change(Number(e.currentTarget.value))} /></label>; })}</div>}
    {view === 'joint' && <label className="mt-4 block text-sm text-ink-800" htmlFor={`${id}-mixture`}><span className="flex flex-wrap justify-between gap-2">{l.mixture}<output className="font-mono" htmlFor={`${id}-mixture`}>{percent(coupling)}</output></span><input id={`${id}-mixture`} aria-label={l.mixture} type="range" min={0} max={1} step={.05} value={coupling} onChange={e => setCoupling(Number(e.currentTarget.value))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>}
    <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 rounded-card bg-surface-sunken p-3 text-sm text-ink-900">{resultRows.map(([key, label, value]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd data-stat={key} className={cx('m-0', value === l.undefined || value === l.family ? '' : 'font-mono')}>{value}</dd></div>)}</dl>
    {view === 'moments' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.momentUnits}</p>}
    {view === 'moments' && moments.correlation === null && <p role="status" className="mt-3 rounded-card border border-accent-300 p-3 text-sm leading-relaxed text-ink-800">{l.constantMessage}</p>}
    {view === 'portfolio' && risk.correlation === null && <p role="status" className="mt-3 rounded-card border border-accent-300 p-3 text-sm leading-relaxed text-ink-800">{l.inactive}</p>}
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{view === 'moments' ? l.momentAxis : view === 'portfolio' ? l.riskAxis : l.jointAxis}</p>
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-visible" role="img" aria-label={`${title}. ${l.chart}`}>
      {view === 'moments' && <><rect x={xOf(0)} y={top} width={right - xOf(0)} height={yOf(0) - top} fill="var(--color-brand-500)" opacity={.06} /><rect x={left} y={yOf(0)} width={xOf(0) - left} height={bottom - yOf(0)} fill="var(--color-brand-500)" opacity={.06} /></>}
      {view === 'joint' && <rect x={left} y={yOf(-20)} width={xOf(-20) - left} height={bottom - yOf(-20)} fill="var(--color-accent-500)" opacity={.12} />}
      {yTicks.map(v => <g key={v}><line x1={left} x2={right} y1={yOf(v)} y2={yOf(v)} stroke="var(--color-ink-200)" /><text x={left - 12} y={yOf(v) + 9} textAnchor="end" className="text-[38px] sm:text-[20px] md:text-[15px]" fill="var(--color-ink-700)">{tick(v)}</text></g>)}
      {xTicks.map(v => <g key={v}><line x1={xOf(v)} x2={xOf(v)} y1={top} y2={bottom} stroke="var(--color-ink-100)" /><text x={xOf(v)} y={332} textAnchor="middle" className="text-[38px] sm:text-[20px] md:text-[15px]" fill="var(--color-ink-700)">{tick(view === 'portfolio' ? v * 100 : v)}</text></g>)}
      {view === 'moments' && moments.rows.map(row => <circle key={row.index} cx={xOf(row.dx)} cy={yOf(row.dy)} r={9} fill="var(--color-brand-600)" opacity={.85} />)}
      {view === 'portfolio' && <><path d={Array.from({ length: 101 }, (_, i) => { const w = i / 100, r = calculateTwoAssetRisk(sigmaA, sigmaB, rho, w); return `${i ? 'L' : 'M'} ${xOf(w)} ${yOf(100 * r.volatility)}`; }).join(' ')} fill="none" stroke="var(--color-brand-600)" strokeWidth={5} /><circle cx={xOf(weight)} cy={yOf(100 * risk.volatility)} r={8} fill="var(--color-brand-600)" />{risk.minimumWeight !== null && <circle cx={xOf(risk.minimumWeight)} cy={yOf(100 * risk.minimumVol)} r={6} stroke="var(--color-accent-600)" strokeWidth={4} fill="var(--color-surface)" />}</>}
      {view === 'joint' && <><line x1={xOf(-20)} x2={xOf(-20)} y1={top} y2={bottom} stroke="var(--color-accent-600)" strokeDasharray="8 6" strokeWidth={3} /><line x1={left} x2={right} y1={yOf(-20)} y2={yOf(-20)} stroke="var(--color-accent-600)" strokeDasharray="8 6" strokeWidth={3} />{joint.states.filter(s => s.probability > 0).map((s, i) => <circle key={i} cx={xOf(100 * s.x)} cy={yOf(100 * s.y)} r={coord(44 * Math.sqrt(s.probability))} fill={s.x <= -.2 && s.y <= -.2 ? 'var(--color-accent-600)' : 'var(--color-brand-600)'} opacity={.75} />)}</>}
    </svg>
    {view === 'portfolio' && <p className="mt-2 text-sm text-ink-700">{risk.minimumWeight === null ? l.family : <>{l.selected}: ● · {l.minimum}: ○</>}</p>}
    <div className="mt-3"><table tabIndex={0} aria-label={l.table} className="block w-full max-w-full overflow-x-auto border-collapse text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{headings.map(h => <th key={h} scope="col" className="border-b border-ink-300 p-3 text-left font-semibold text-ink-900">{h}</th>)}</tr></thead><tbody>{tableRows.map((row, i) => <tr key={i}>{row.map((value, j) => j === 0 ? <th key={j} scope="row" className="border-b border-ink-100 p-3 text-left font-mono">{value}</th> : <td key={j} className={cx('border-b border-ink-100 p-3', view === 'portfolio' && j === 3 ? '' : 'whitespace-nowrap font-mono')}>{value}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{caption ?? l.caption}</p>
  </figure>;
}
