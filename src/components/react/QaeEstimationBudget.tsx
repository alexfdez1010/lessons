import { useId, useState } from 'react';

/** Exact algebra and conservative bounds for the explicitly stated ideal models, not a quantum simulator. */
export function qaeCanonicalBound(a: number, m: number) {
  if (!Number.isFinite(a) || a < 0 || a > 1 || !Number.isInteger(m) || m < 1 || m > 30) throw Error('qaeCanonicalBound: probability in [0,1] and integer m in 1–30 required.');
  const M = 2 ** m;
  return { M, error: 2 * Math.PI * Math.sqrt(a * (1 - a)) / M + Math.PI ** 2 / M ** 2, successLower: 8 / Math.PI ** 2, grover: M - 1, preparationBlocks: 2 * M - 1 };
}
export function qaeMedianFailure(runs: number) {
  if (!Number.isInteger(runs) || runs < 1 || runs > 19 || runs % 2 !== 1) throw Error('qaeMedianFailure: use an odd run count from 1 to 19.');
  const p = 1 - 8 / Math.PI ** 2;
  let sum = 0, choose = 1;
  for (let k = 0; k <= runs; k++) {
    if (k >= (runs + 1) / 2) sum += choose * p ** k * (1 - p) ** (runs - k);
    choose *= (runs - k) / (k + 1);
  }
  return sum;
}
export function qaePayoffEncoding(upper = 80, epsilon = .01) {
  if (!Number.isFinite(upper) || upper <= -20 || !Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) throw Error('qaePayoffEncoding: finite positive payoff range and probability-error bound required.');
  const lower = -20, range = upper - lower, a = .3, discount = .95, mean = lower + range * a;
  return { lower, upper, range, a, mean, discount, price: discount * mean, epsilon, priceBound: discount * range * epsilon, amplitudeForOneDollar: 1 / (discount * range) };
}
export function qaeAtomRisk(confidence = .95, epsilon = .001) {
  if (!Number.isFinite(confidence) || confidence < .9 || confidence > .99 || !Number.isFinite(epsilon) || epsilon < 0 || epsilon > 1) throw Error('qaeAtomRisk: confidence .90–.99 and a finite probability error in [0,1] required.');
  const q = confidence <= .9 ? 0 : confidence <= .98 ? 50 : 100;
  const excess = .08 * Math.max(50 - q, 0) + .02 * Math.max(100 - q, 0), range = 100 - q;
  const strictTail = q === 0 ? .1 : q === 50 ? .02 : 0;
  return { q, confidence, strictTail, excess, range, amplitude: range ? excess / range : 0, es: q + excess / (1 - confidence), epsilon, esBound: range * epsilon / (1 - confidence) };
}
export function qaeResourceBudget(precisionPower = 3, blockMicroseconds = 100) {
  if (!Number.isInteger(precisionPower) || precisionPower < 2 || precisionPower > 4 || !Number.isFinite(blockMicroseconds) || blockMicroseconds <= 0) throw Error('qaeResourceBudget: precision power 2–4 and finite positive block time required.');
  const epsilon = 10 ** -precisionPower, delta = .05, classical = Math.ceil(Math.log(2 / delta) / (2 * epsilon ** 2));
  let m = 1;
  while (qaeCanonicalBound(.5, m).error > epsilon) m++;
  const canonical = qaeCanonicalBound(.5, m), runs = 7, grover = runs * canonical.grover, preparationBlocks = runs * canonical.preparationBlocks;
  return { epsilon, classical, m, M: canonical.M, runs, grover, preparationBlocks, confidenceLower: 1 - qaeMedianFailure(runs), classicalSeconds: classical / 1e6, blockMicroseconds, otherSeconds: .05, quantumSeconds: preparationBlocks * blockMicroseconds / 1e6 + .05 };
}

const defaults = {
  title: 'Audit the estimation budget',
  caption: 'Invented inputs and ideal mathematical bounds. This panel does not simulate quantum hardware or establish measured advantage.',
  sampleControl: 'Base-10 sample exponent k; N = 10^k',
  upperControl: 'Upper payoff U (USD); lower payoff fixed at −20 USD',
  precisionControl: 'Probability precision exponent k; ε = 10^(−k)',
  phaseControl: 'Phase-register qubits m; M = 2^m',
  repeatsControl: 'Independent canonical runs (odd count)',
  confidenceControl: 'Loss confidence level (%)',
  blockControl: 'Invented preparation/inverse block time (microseconds)',
  quantity: 'Quantity', value: 'Value', samples: 'Independent classical samples N',
  sigma: 'Standard deviation of Bernoulli(0.3)', standardError: 'Sample-mean standard error',
  hoeffding: '95% Hoeffding absolute-error radius', probability: 'Probability or error (unitless)',
  lower: 'Lower payoff L (USD)', upper: 'Upper payoff U (USD)', range: 'Payoff range U−L (USD)',
  amplitude: 'Marked probability a', mean: 'Expected payoff (USD)', discount: 'Discount factor',
  price: 'Discounted value (USD)', amplitudeError: 'Absolute probability-error bound ε',
  priceBound: 'Converted absolute value-error bound (USD)', oneDollar: 'Probability error corresponding to 1 USD',
  M: 'Resolution parameter M', grover: 'Counted Q applications', blocks: 'Counted A or inverse-A blocks',
  firstTerm: 'Canonical leading error term', secondTerm: 'Canonical second error term',
  canonical: 'Canonical probability-error bound at a=0.3', singleSuccess: 'Single-run success lower bound',
  failure: 'Median failure upper bound', confidence: 'Median success lower bound', runs: 'Independent runs',
  q: 'Exact supplied loss quantile (USD)', tail: 'Strict exceedance probability', excess: 'Expected excess above q (USD)',
  es: 'Exact weighted-tail ES (USD)', esBound: 'ES-error bound from probability estimation only (USD)',
  classicalSeconds: 'Classical time in the invented cost model (seconds)', quantumSeconds: 'Quantum time in the invented cost model (seconds)',
  other: 'All other quantum work, stipulated (seconds)', fixedScale: 'Fixed bar scale in the units shown',
  money: 'USD', seconds: 'Seconds', exactTable: 'Exact rounded values for the stated estimation model',
  chart: 'Bars compare the labelled quantities on a fixed scale; the following table gives rounded exact values.',
  sampleNote: 'IID Bernoulli probability 0.3, finite variance. Standard error is a sampling standard deviation, not a guaranteed realised error. Hoeffding supplies a separate at-least-95% absolute-error bound for independent [0,1] observations.',
  encodingNote: 'Invented pricing probabilities 70/30% for payoffs L/U. The marked probability is 0.3, its amplitude is √0.3. The discount factor is fixed at 0.95. The panel fixes the absolute probability-error bound at 0.01; the monetary error bound changes with the payoff range.',
  canonicalNote: 'Ideal canonical QAE at marked probability 0.3. The theorem gives this error bound with success at least 8/π². Our circuit convention counts M−1 Q applications plus one initial A; each Q contains one A and one inverse A. Controlled gates, reflections and readout are further resources.',
  confidenceNote: 'Independent repetitions with single-run success at least 8/π². The binomial majority tail is an upper bound on median failure, not its exact observed frequency. Repetitions multiply work without shortening each circuit; m is fixed at 10 here.',
  tailNote: 'Invented losses 0/50/100 USD with probabilities 90/8/2%. Quantile convention is inverse CDF. ES uses exact worst-tail mass. The error bound holds with q supplied exactly and excess encoded in [0,100−q]; quantile-search error is additional. At q=100 the excess is known zero.',
  resourceNote: 'Both constructions satisfy at least 95% per-problem success under their ideal assumptions. Classical uses the conservative bounded-variable Hoeffding count at 1 microsecond/sample. Quantum uses a worst-case-a canonical bound and seven independent runs. Counted A/inverse-A blocks use the selected invented time; all remaining quantum work is stipulated at 0.05 seconds. These are cost-model arithmetic, not measured machine timings or best achievable algorithms.'
};
export type QaeBudgetLabels = typeof defaults;
export type QaeBudgetMode = 'sampling' | 'encoding' | 'canonical' | 'confidence' | 'tail' | 'resources';
export interface QaeEstimationBudgetProps {
  mode?: QaeBudgetMode; locale?: 'en' | 'es'; title?: string; caption?: string; labels?: Partial<QaeBudgetLabels>;
  initialSamplePower?: number; initialUpper?: number; initialPhaseQubits?: number; initialRuns?: number;
  initialConfidence?: number; initialPrecisionPower?: number; initialBlockMicroseconds?: number;
}
function guard(value: number, min: number, max: number, step: number, name: string) {
  const digits = Math.max(String(min).split('.')[1]?.length ?? 0, String(step).split('.')[1]?.length ?? 0);
  const index = Math.round((value - min) / step);
  const canonical = Number((min + index * step).toFixed(digits));
  if (!Number.isFinite(value) || value < min || value > max || value !== canonical) throw Error('QaeEstimationBudget: ' + name + ' must match its visible native range and step.');
}
const draw = (v: number) => Math.round(v * 1000) / 1000;
export function QaeEstimationBudget({ mode = 'sampling', locale = 'en', title, caption, labels, initialSamplePower = 4, initialUpper = 80, initialPhaseQubits = 10, initialRuns = 7, initialConfidence = 95, initialPrecisionPower = 3, initialBlockMicroseconds = 100 }: QaeEstimationBudgetProps) {
  if (!['sampling', 'encoding', 'canonical', 'confidence', 'tail', 'resources'].includes(mode)) throw Error('QaeEstimationBudget: unsupported mode.');
  if (mode === 'sampling') guard(initialSamplePower, 2, 6, 1, 'initialSamplePower');
  if (mode === 'encoding') guard(initialUpper, 20, 180, 20, 'initialUpper');
  if (mode === 'canonical') guard(initialPhaseQubits, 6, 12, 1, 'initialPhaseQubits');
  if (mode === 'confidence') guard(initialRuns, 1, 9, 2, 'initialRuns');
  if (mode === 'tail') guard(initialConfidence, 90, 99, 1, 'initialConfidence');
  if (mode === 'resources') { guard(initialPrecisionPower, 2, 4, 1, 'initialPrecisionPower'); guard(initialBlockMicroseconds, 1, 200, 1, 'initialBlockMicroseconds'); }
  const id = useId(), l = { ...defaults, ...labels };
  const [samplePower, setSamplePower] = useState(initialSamplePower), [upper, setUpper] = useState(initialUpper), [phaseQubits, setPhaseQubits] = useState(initialPhaseQubits), [runs, setRuns] = useState(initialRuns), [confidence, setConfidence] = useState(initialConfidence), [precisionPower, setPrecisionPower] = useState(initialPrecisionPower), [blockTime, setBlockTime] = useState(initialBlockMicroseconds);
  const n = (v: number) => { const z = Math.round(v * 1e9) / 1e9; return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', { maximumFractionDigits: 9 }).format(Object.is(z, -0) ? 0 : z); };
  let rows: [string, number][] = [], bars: [string, number][] = [], note = '', scale = 1, signed = false, unit = l.probability;
  if (mode === 'sampling') { const N = 10 ** samplePower, se = Math.sqrt(.3 * .7 / N), radius = Math.sqrt(Math.log(40) / (2 * N)); rows = [[l.samples, N], [l.sigma, Math.sqrt(.21)], [l.standardError, se], [l.hoeffding, radius]]; bars = rows.slice(2); scale = .15; note = l.sampleNote; }
  else if (mode === 'encoding') { const x = qaePayoffEncoding(upper); rows = [[l.lower, x.lower], [l.upper, x.upper], [l.range, x.range], [l.amplitude, x.a], [l.mean, x.mean], [l.discount, x.discount], [l.price, x.price], [l.amplitudeError, x.epsilon], [l.priceBound, x.priceBound], [l.oneDollar, x.amplitudeForOneDollar]]; bars = [[l.mean, x.mean], [l.price, x.price], [l.priceBound, x.priceBound]]; scale = 70; signed = true; unit = l.money; note = l.encodingNote; }
  else if (mode === 'canonical') { const x = qaeCanonicalBound(.3, phaseQubits); const first = 2 * Math.PI * Math.sqrt(.21) / x.M, second = Math.PI ** 2 / x.M ** 2; rows = [[l.M, x.M], [l.grover, x.grover], [l.blocks, x.preparationBlocks], [l.firstTerm, first], [l.secondTerm, second], [l.canonical, x.error], [l.singleSuccess, x.successLower]]; bars = [[l.firstTerm, first], [l.secondTerm, second], [l.canonical, x.error]]; scale = .06; note = l.canonicalNote; }
  else if (mode === 'confidence') { const x = qaeCanonicalBound(.3, 10), fail = qaeMedianFailure(runs); rows = [[l.runs, runs], [l.singleSuccess, x.successLower], [l.failure, fail], [l.confidence, 1 - fail], [l.grover, runs * x.grover], [l.blocks, runs * x.preparationBlocks]]; bars = [[l.singleSuccess, x.successLower], [l.confidence, 1 - fail], [l.failure, fail]]; note = l.confidenceNote; }
  else if (mode === 'tail') { const x = qaeAtomRisk(confidence / 100); rows = [[l.q, x.q], [l.tail, x.strictTail], [l.excess, x.excess], [l.amplitude, x.amplitude], [l.es, x.es], [l.amplitudeError, x.epsilon], [l.esBound, x.esBound]]; bars = [[l.q, x.q], [l.es, x.es], [l.esBound, x.esBound]]; scale = 110; unit = l.money; note = l.tailNote; }
  else { const x = qaeResourceBudget(precisionPower, blockTime); rows = [[l.amplitudeError, x.epsilon], [l.samples, x.classical], [l.M, x.M], [l.runs, x.runs], [l.grover, x.grover], [l.blocks, x.preparationBlocks], [l.confidence, x.confidenceLower], [l.other, x.otherSeconds], [l.classicalSeconds, x.classicalSeconds], [l.quantumSeconds, x.quantumSeconds]]; bars = [[l.classicalSeconds, x.classicalSeconds], [l.quantumSeconds, x.quantumSeconds]]; scale = 200; unit = l.seconds; note = l.resourceNote; }
  const input = (label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => <label className="block min-w-0 text-sm font-medium text-ink-700">{label}: <output className="font-mono">{n(value)}</output><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} className="mt-1 block h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>;
  const spoken = mode === 'sampling' ? rows.slice(2) : mode === 'encoding' ? [rows[6], rows[8]] : mode === 'canonical' ? [rows[0], rows[5]] : mode === 'confidence' ? [rows[0], rows[3], rows[4]] : mode === 'tail' ? [rows[0], rows[4], rows[6]] : rows.slice(8);
  return <figure className="not-prose my-8 min-w-0 rounded-card border border-ink-100 bg-surface p-4 sm:p-6" aria-labelledby={id} data-qae-budget={mode}>
    <figcaption id={id} className="font-display text-lg font-semibold text-ink-900">{title ?? l.title}</figcaption>
    <div className="my-4 grid min-w-0 gap-3 sm:grid-cols-2">
      {mode === 'sampling' && input(l.sampleControl, samplePower, 2, 6, 1, setSamplePower)}
      {mode === 'encoding' && input(l.upperControl, upper, 20, 180, 20, setUpper)}
      {mode === 'canonical' && input(l.phaseControl, phaseQubits, 6, 12, 1, setPhaseQubits)}
      {mode === 'confidence' && input(l.repeatsControl, runs, 1, 9, 2, setRuns)}
      {mode === 'tail' && input(l.confidenceControl, confidence, 90, 99, 1, setConfidence)}
      {mode === 'resources' && <>{input(l.precisionControl, precisionPower, 2, 4, 1, setPrecisionPower)}{input(l.blockControl, blockTime, 1, 200, 1, setBlockTime)}</>}
    </div>
    <div role="img" aria-label={l.chart} className="my-4 space-y-3">
      <p className="text-xs text-ink-500">{l.fixedScale}: {signed ? '−' + n(scale) : '0'} … {n(scale)} · {unit}</p>
      {bars.map(([label, value]) => <div key={label} className="min-w-0"><div className="mb-1 flex flex-wrap justify-between gap-2 text-sm text-ink-700"><span>{label}</span><span className="font-mono">{n(value)}</span></div><div className="relative h-6 rounded bg-ink-50"><span className="absolute top-0 h-full border-l border-ink-400" style={{ left: signed ? '50%' : '2%' }} /><span className={'absolute top-1 h-4 rounded transition-[width,left] duration-300 motion-reduce:transition-none ' + (value < 0 ? 'bg-accent-500' : 'bg-brand-600')} style={{ left: (signed ? (value < 0 ? 50 - draw(Math.abs(value) / scale * 48) : 50) : 2) + '%', width: draw(Math.abs(value) / scale * (signed ? 48 : 96)) + '%' }} /></div></div>)}
    </div>
    <output aria-live="polite" aria-atomic="true" className="sr-only">{spoken.map(([label, value]) => label + ': ' + n(value)).join('; ')}</output>
    <p className="my-4 text-sm leading-relaxed text-ink-600">{note}</p>
    <div className="my-4 min-w-0"><table tabIndex={0} aria-label={(title ?? l.title) + ': ' + l.exactTable} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr><th scope="col" className="border-b border-ink-200 px-3 py-2 text-ink-800">{l.quantity}</th><th scope="col" className="border-b border-ink-200 px-3 py-2 text-ink-800">{l.value}</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row" className="border-b border-ink-100 px-3 py-2 font-medium text-ink-700">{label}</th><td className="whitespace-nowrap border-b border-ink-100 px-3 py-2 font-mono text-ink-700">{n(value)}</td></tr>)}</tbody></table></div>
    <p className="text-sm leading-relaxed text-ink-600">{caption ?? l.caption}</p>
  </figure>;
}
