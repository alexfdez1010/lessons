import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EmpiricalTailRow { loss: number; descendingRank: number; esUnits: number; esProbability: number; weightedLoss: number; }
export interface EmpiricalTailResult {
  n: number; confidence: number; ascendingRank: number; descendingRank: number;
  valueAtRisk: number; interpolatedVaR: number; expectedShortfall: number;
  tailCount: number; strictExceedanceProbability: number; boundaryProbabilityUsed: number;
  numericalBoundary: 'none' | 'lower' | 'upper'; rows: EmpiricalTailRow[];
}
/** Floating-point policy: snap c*N to an integer only within 16 machine-epsilon
 * units scaled by N. This fixes representation noise at exact mathematical
 * boundaries; it is not a statistical or economic rounding tolerance. */
function snappedProbabilityProduct(confidence: number, n: number): number {
  const raw = confidence * n, nearest = Math.round(raw);
  const tolerance = 16 * Number.EPSILON * Math.max(1, n, Math.abs(raw));
  return Math.abs(raw - nearest) <= tolerance ? nearest : raw;
}
/** Equal empirical probability 1/N. Losses are signed: gains are negative.
 * VaR is the lower inverse empirical CDF, k=ceil(c*N), one-based ascending.
 * ES integrates the upper tail of THAT empirical distribution, including only
 * the boundary probability needed to fill exactly 1-c. It is not generally a
 * conditional mean of all observations >=VaR or >VaR. */
export function calculateEmpiricalTail(losses: readonly number[], confidence: number): EmpiricalTailResult {
  if (!Array.isArray(losses) || losses.length < 2 || losses.length > 1000 || losses.some(v => !Number.isFinite(v) || Math.abs(v) > 1e15)) throw new Error('HistoricalVarLadder: losses must contain 2–1000 finite signed amounts with absolute value at most 1e15.');
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) throw new Error('HistoricalVarLadder: confidence must be strictly between zero and one.');
  const n = losses.length, product = snappedProbabilityProduct(confidence, n);
  const ascendingRank = Math.max(1, Math.min(n, Math.ceil(product)));
  const descendingRank = n - ascendingRank + 1;
  const sorted = [...losses].sort((a, b) => b - a), valueAtRisk = sorted[descendingRank - 1]!;
  // Complement the same probability product, rather than recomputing N*(1-c).
  const numericalBoundary = product === n ? 'upper' : product === 0 ? 'lower' : 'none';
  // Endpoint numerical policy: preserve finite empirical limits. If snapping
  // reaches N, VaR and ES are the observed maximum; compute the tiny positive
  // tail mass from the unsnapped complement. If it reaches zero, use the lower
  // limit k=1 and ES=sample mean (sub-epsilon tail differences are unresolvable).
  const tailCount = numericalBoundary === 'upper' ? n * (1 - confidence) : n - product;
  const whole = Math.floor(tailCount), fraction = tailCount - whole;
  const rows = sorted.map((loss, i) => { const esUnits = i < whole ? 1 : i === whole ? fraction : 0;
    return { loss, descendingRank: i + 1, esUnits, esProbability: esUnits / n, weightedLoss: esUnits === 0 ? 0 : esUnits * loss }; });
  const expectedShortfall = numericalBoundary === 'upper' ? sorted[0]! : rows.reduce((sum, row) => sum + row.weightedLoss, 0) / tailCount;
  const strict = sorted.filter(loss => loss > valueAtRisk).length;
  const strictExceedanceProbability = strict / n;
  const boundaryProbabilityUsed = Math.max(0, tailCount - strict) / n;
  // R type 7's separate interpolated estimate, not a quantile of the step ECDF.
  const ascending = [...sorted].reverse(), h = (n - 1) * confidence;
  const j = Math.floor(h), t = h - j;
  const interpolatedVaR = ascending[j]! + t * (ascending[Math.min(n - 1, j + 1)]! - ascending[j]!);
  return { n, confidence, ascendingRank, descendingRank, valueAtRisk, interpolatedVaR, expectedShortfall,
    tailCount, strictExceedanceProbability, boundaryProbabilityUsed, numericalBoundary, rows };
}
const DEFAULT_LOSSES = [380000, 250000, 170000, 90000, 30000, -40000, -80000, -150000, -220000, -310000] as const;
export interface HistoricalVarLadderProps {
  losses?: readonly number[]; confidence?: number; confidenceLevels?: readonly number[]; locale?: string; currency?: string;
  title?: string; confidenceLabel?: string; varLabel?: string; worstLabel?: string; gainsLabel?: string; caption?: string;
  esLabel?: string; interpolatedLabel?: string; rankLabel?: string; tailCountLabel?: string; exceedanceLabel?: string;
  boundaryMassLabel?: string; tableLabel?: string; scenarioLabel?: string; lossLabel?: string; massLabel?: string;
  weightedLabel?: string; fullTailLabel?: string; partialTailLabel?: string; outsideTailLabel?: string;
  chartLabel?: string; conventionMessage?: string; axisLabel?: string; className?: string;
}
export function HistoricalVarLadder({ losses = DEFAULT_LOSSES, confidence = .95, confidenceLevels = [.8, .85, .9, .95, .99], locale = 'en-US', currency = 'EUR',
  title = 'Read the empirical quantile and fill the tail exactly', confidenceLabel = 'Confidence level', varLabel = 'VaR, inverse empirical CDF',
  worstLabel = 'Larger signed losses', gainsLabel = 'Smaller losses or gains', esLabel = 'Empirical Expected Shortfall', interpolatedLabel = 'Separate type 7 interpolated VaR estimate',
  rankLabel = 'VaR rank from the worst, one-based', tailCountLabel = 'Tail size in scenario equivalents', exceedanceLabel = 'Empirical probability strictly above VaR',
  boundaryMassLabel = 'Probability taken from the VaR boundary for ES', tableLabel = 'Ranked signed losses and ES probability weights, scroll horizontally if needed',
  scenarioLabel = 'Rank from worst', lossLabel = 'Signed loss', massLabel = 'Probability used in ES', weightedLabel = 'ES contribution',
  fullTailLabel = 'Full empirical mass', partialTailLabel = 'Partial empirical mass', outsideTailLabel = 'No mass used',
  conventionMessage = 'Each invented one-day scenario has probability 1/N. Positive loss means a loss; negative loss means a gain. VaR uses k=ceil(cN) from ascending losses. ES fills exactly the upper 1-c probability; type 7 is a separate interpolated quantile estimate.',
  axisLabel = 'Ranked one-day signed losses; zero is the horizontal baseline',
  chartLabel = '{n} equally weighted scenarios. At confidence {confidence}, inverse-ECDF VaR is {var}, rank {rank} from the worst. Tail size {tail}; ES {es}. Strictly above VaR {exceedance}; boundary probability used {boundary}.',
  caption = 'Invented one-day losses for a fixed current portfolio. Bar height shows signed loss; solid accent fill marks probability used by ES, with a partial bar for partial boundary mass. The dashed vertical marker identifies the VaR observation, which need not contribute its full mass to ES. Empirical probabilities describe the chosen sample and do not guarantee future coverage. The table gives numerical values and probability weights, rounded for display. No iid assumption is required to compute these finite-sample summaries.', className,
}: HistoricalVarLadderProps) {
  calculateEmpiricalTail(losses, confidence);
  if (!Array.isArray(confidenceLevels) || confidenceLevels.length < 1 || confidenceLevels.length > 20 || new Set(confidenceLevels).size !== confidenceLevels.length || !confidenceLevels.includes(confidence)) throw new Error('HistoricalVarLadder: confidenceLevels must be unique and include confidence.');
  for (const c of confidenceLevels) calculateEmpiricalTail(losses, c);
  const labels = { title, confidenceLabel, varLabel, worstLabel, gainsLabel, esLabel, interpolatedLabel, rankLabel, tailCountLabel, exceedanceLabel, boundaryMassLabel, tableLabel, scenarioLabel, lossLabel, massLabel, weightedLabel, fullTailLabel, partialTailLabel, outsideTailLabel, conventionMessage, axisLabel, chartLabel, caption };
  for (const [name, value] of Object.entries(labels)) if (typeof value !== 'string' || !value.trim()) throw new Error(`HistoricalVarLadder: ${name} must be nonempty.`);
  const id = useId(); const [level, setLevel] = useState(confidence); const m = calculateEmpiricalTail(losses, level);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 8 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const W = 640, H = 300, left = 18, right = 622, zero = 148, half = 112, slot = (right - left) / m.n;
  const max = Math.max(1, ...m.rows.map(row => Math.abs(row.loss)));
  const barWidth = slot * .65, barX = (i: number) => left + i * slot + (slot - barWidth) / 2;
  const y = (loss: number) => zero - loss / max * half;
  const substitutions = { n: number.format(m.n), confidence: percent.format(level), var: money.format(m.valueAtRisk), rank: number.format(m.descendingRank), tail: number.format(m.tailCount), es: money.format(m.expectedShortfall), exceedance: percent.format(m.strictExceedanceProbability), boundary: percent.format(m.boundaryProbabilityUsed) };
  const alt = chartLabel.replace(/\{(n|confidence|var|rank|tail|es|exceedance|boundary)\}/g, (_, key: keyof typeof substitutions) => substitutions[key]);
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-xs leading-relaxed text-ink-600">{conventionMessage}</p>
    <label htmlFor={`${id}-confidence`} className="mt-5 block text-sm font-medium">{confidenceLabel}</label><select id={`${id}-confidence`} value={level} onChange={e => setLevel(Number(e.target.value))} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{confidenceLevels.map(c => <option key={c} value={c}>{percent.format(c)}</option>)}</select>
    <div className="mt-4 flex justify-between gap-3 text-xs"><span>{worstLabel}</span><span className="text-right">{gainsLabel}</span></div>
    <svg role="img" aria-label={alt} viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full"><line x1={left} x2={right} y1={zero} y2={zero} stroke="var(--color-ink-400)"/>
      {m.rows.map((row, i) => { const top = Math.min(zero, y(row.loss)), height = Math.abs(y(row.loss) - zero);return <g key={i}><rect x={barX(i)} y={top} width={barWidth} height={height} fill={row.loss >= 0 ? 'var(--color-ink-400)' : 'var(--color-brand-500)'}/>{row.esUnits > 0 && <rect x={barX(i)} y={top} width={barWidth * row.esUnits} height={height} fill="var(--color-accent-600)"/>}</g>;})}
      <line x1={barX(m.descendingRank - 1) + barWidth / 2} x2={barX(m.descendingRank - 1) + barWidth / 2} y1={18} y2={270} stroke="var(--color-brand-700)" strokeWidth={2} strokeDasharray="7 5"/>
      {[0, m.n - 1].map(i => <text key={i} x={barX(i) + barWidth / 2} y={295} textAnchor={i === m.n - 1 ? "end" : "middle"} fill="var(--color-ink-700)" className="text-[28px] sm:text-[15px]">{number.format(i + 1)}</text>)}
    </svg><p className="text-center text-xs text-ink-600">{axisLabel}</p>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[varLabel, money.format(m.valueAtRisk)], [esLabel, money.format(m.expectedShortfall)], [interpolatedLabel, money.format(m.interpolatedVaR)], [rankLabel, number.format(m.descendingRank)], [tailCountLabel, number.format(m.tailCount)], [exceedanceLabel, percent.format(m.strictExceedanceProbability)], [boundaryMassLabel, percent.format(m.boundaryProbabilityUsed)]].map(([label, value]) => <div key={label} className="rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableLabel}</caption><thead><tr>{[scenarioLabel, lossLabel, massLabel, weightedLabel].map(label => <th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{m.rows.map(row => <tr key={row.descendingRank} className="odd:bg-surface"><th scope="row" className="p-2 font-medium">{number.format(row.descendingRank)}<span className="sr-only"> {row.esUnits === 1 ? fullTailLabel : row.esUnits > 0 ? partialTailLabel : outsideTailLabel}</span></th><td className="whitespace-nowrap p-2 font-mono">{money.format(row.loss)}</td><td className="whitespace-nowrap p-2 font-mono">{percent.format(row.esProbability)}</td><td className="whitespace-nowrap p-2 font-mono">{money.format(row.weightedLoss / m.tailCount)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default HistoricalVarLadder;
