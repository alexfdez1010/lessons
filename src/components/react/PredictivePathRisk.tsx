import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PredictivePathInputs { alpha: number; beta: number; trials: number }
export function calculatePredictivePaths({ alpha, beta, trials }: PredictivePathInputs) {
  const concentration = alpha + beta;
  // Tolerance covers only binary roundoff when the controls split a total into two shapes.
  const boundaryTolerance = 16 * Number.EPSILON * Math.max(1, Math.abs(concentration));
  if (![alpha, beta].every(Number.isFinite) || alpha <= 0 || beta <= 0 || concentration < 2 - boundaryTolerance || concentration > 100 + boundaryTolerance) throw new Error('PredictivePathRisk: positive finite Beta shapes with total from 2 to 100 are required in this teaching viewer.');
  if (!Number.isInteger(trials) || trials < 1 || trials > 20) throw new Error('PredictivePathRisk: trials must be an integer from 1 to 20.');
  const mean = alpha / concentration, failureMean = beta / concentration;
  const rising = (value: number, count: number) => { let result = 1; for (let j = 0; j < count; j++) result *= value + j; return result; };
  const choose = (n: number, k: number) => { let result = 1; for (let j = 1; j <= k; j++) result *= (n - j + 1) / j; return result; };
  const denominator = rising(concentration, trials);
  const counts = Array.from({ length: trials + 1 }, (_, successes) => ({
    successes,
    predictive: choose(trials, successes) * rising(alpha, successes) * rising(beta, trials - successes) / denominator,
    plugin: choose(trials, successes) * mean ** successes * failureMean ** (trials - successes),
  }));
  let prefix = 1;
  const failurePath = Array.from({ length: trials }, (_, index) => {
    const step = index + 1, conditionalFailure = (beta + index) / (concentration + index);
    prefix *= conditionalFailure;
    return { step, conditionalFailure, predictive: prefix, plugin: failureMean ** step };
  });
  const oneStepVariance = mean * failureMean, parameterVariance = oneStepVariance / (concentration + 1);
  const expectedConditionalVariance = oneStepVariance - parameterVariance;
  const countVariance = trials * oneStepVariance + trials * (trials - 1) * parameterVariance;
  return { alpha, beta, trials, concentration, mean, failureMean, counts, failurePath, oneStepVariance, parameterVariance,
    expectedConditionalVariance, countMean: trials * mean, countVariance, pluginCountVariance: trials * oneStepVariance,
    pairCovariance: parameterVariance, pairCorrelation: 1 / (concentration + 1), allFailures: prefix, pluginAllFailures: failureMean ** trials,
    conditionalCountVariance: trials * expectedConditionalVariance, parameterCountVariance: trials ** 2 * parameterVariance };
}

export interface PredictivePathRiskProps extends Partial<PredictivePathInputs> {
  initialView?: 'count' | 'path'; locale?: string; title?: string; modelMessage?: string; trialsLabel?: string; meanLabel?: string;
  concentrationLabel?: string; viewLabel?: string; countViewLabel?: string; pathViewLabel?: string; predictiveLabel?: string; pluginLabel?: string;
  countAxisLabel?: string; pathAxisLabel?: string; probabilityLabel?: string; countChartLabel?: string; pathChartLabel?: string;
  posteriorLabel?: string; parameterVarianceLabel?: string; oneStepVarianceLabel?: string; countVarianceLabel?: string; pluginVarianceLabel?: string;
  covarianceLabel?: string; correlationLabel?: string; allFailuresLabel?: string; pluginFailuresLabel?: string;
  tableLabel?: string; successesLabel?: string; stepLabel?: string; conditionalLabel?: string; countScopeMessage?: string; pathScopeMessage?: string;
  caption?: string; className?: string;
}
/** A shared-parameter Beta–Bernoulli mixture, computed analytically rather than by simulation.
 * One parameter is shared by a whole future block. Conditional independence does not imply marginal independence.
 * Count probabilities and a specified all-failure prefix are different events; neither is an anywhere-in-a-longer-path run probability. */
export function PredictivePathRisk({ alpha = 5, beta = 3, trials = 4, initialView = 'count', locale = 'en-GB',
  title = 'Predict future outcomes with a shared unknown probability',
  modelMessage = 'Invented model: posterior Beta({alpha}, {beta}); one unknown success probability is shared across all {trials} future trials, which are independent conditional on that probability. The sliders construct hypothetical posteriors; they do not automatically add observed data. The plug-in comparison fixes the probability at the same posterior mean.',
  trialsLabel = 'Number of future trials', meanLabel = 'Posterior mean success probability', concentrationLabel = 'Hypothetical posterior concentration at the selected mean',
  viewLabel = 'Event to inspect', countViewLabel = 'Number of successes', pathViewLabel = 'An all-failure prefix', predictiveLabel = 'Shared-parameter predictive probability', pluginLabel = 'Fixed-mean plug-in probability',
  countAxisLabel = 'Successes in the future block, integer counts', pathAxisLabel = 'Length of the specified initial all-failure prefix', probabilityLabel = 'Probability',
  countChartLabel = 'Beta-binomial and fixed-mean binomial probability masses for the future success count. Exact probabilities and assumptions are in the table.',
  pathChartLabel = 'Probability of every outcome failing in a specified initial prefix, with shared parameter uncertainty and with a fixed mean. Points are discrete prefix lengths, not the chance of a run anywhere in a longer path.',
  posteriorLabel = 'Hypothetical posterior shapes', parameterVarianceLabel = 'Posterior variance of the success probability', oneStepVarianceLabel = 'Variance of one future Bernoulli indicator',
  countVarianceLabel = 'Shared-parameter success-count variance', pluginVarianceLabel = 'Fixed-mean success-count variance', covarianceLabel = 'Covariance of two distinct future indicators', correlationLabel = 'Correlation of two distinct future indicators',
  allFailuresLabel = 'All future trials fail, shared-parameter model', pluginFailuresLabel = 'All future trials fail, fixed-mean model', tableLabel = 'Exact predictive count or prefix probabilities; scroll horizontally if needed',
  successesLabel = 'Successes', stepLabel = 'Prefix length', conditionalLabel = 'Next failure probability after only earlier failures',
  countScopeMessage = 'Bars are probability masses at integer counts. Several orders can produce the same count. One future Bernoulli outcome has the same marginal distribution as the fixed-mean comparison; a longer shared-parameter block can have larger count variance.',
  pathScopeMessage = 'The event is that every trial in this specified initial prefix fails. It is not the chance of at least one run somewhere in a longer sequence. Each next-step probability conditions on the preceding failures in this hypothetical path.',
  caption = 'Exact finite-model calculations, with a common fixed probability within each block and the stated posterior uncertainty. Dependence after averaging over that parameter is not proof of a causal market mechanism. Changing regimes, unequal opportunities, loss sizes and structural model uncertainty require additional assumptions.', className,
}: PredictivePathRiskProps) {
  const authored = calculatePredictivePaths({ alpha, beta, trials });
  if (authored.mean < .05 - 1e-12 || authored.mean > .95 + 1e-12) throw new Error('PredictivePathRisk: authored mean must be between 5% and 95% for the native controls.');
  if (!['count', 'path'].includes(initialView)) throw new Error('PredictivePathRisk: initialView must be count or path.');
  const labels = { title, modelMessage, trialsLabel, meanLabel, concentrationLabel, viewLabel, countViewLabel, pathViewLabel, predictiveLabel, pluginLabel, countAxisLabel, pathAxisLabel, probabilityLabel, countChartLabel, pathChartLabel, posteriorLabel, parameterVarianceLabel, oneStepVarianceLabel, countVarianceLabel, pluginVarianceLabel, covarianceLabel, correlationLabel, allFailuresLabel, pluginFailuresLabel, tableLabel, successesLabel, stepLabel, conditionalLabel, countScopeMessage, pathScopeMessage, caption };
  for (const [key, value] of Object.entries(labels)) if (typeof value !== 'string' || !value.trim()) throw new Error(`PredictivePathRisk: ${key} must be nonempty.`);
  new Intl.NumberFormat(locale);
  const id = useId(), [mean, setMean] = useState(authored.mean), [concentration, setConcentration] = useState(authored.concentration), [count, setCount] = useState(trials), [view, setView] = useState(initialView);
  const data = calculatePredictivePaths({ alpha: mean * concentration, beta: (1 - mean) * concentration, trials: count });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }), percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 6 });
  const tinyPercent = new Intl.NumberFormat(locale, { style: 'percent', notation: 'scientific', maximumSignificantDigits: 3 });
  const probability = (value: number) => value > 0 && value < 1e-8 ? tinyPercent.format(value) : percent.format(value);
  const tickPercent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const modelText = modelMessage.replace(/\{(alpha|beta|trials)\}/g, (_, key: 'alpha' | 'beta' | 'trials') => number.format(data[key]));
  const left = 160, right = 530, top = 30, bottom = 210, width = right - left;
  const maxProbability = view === 'path' ? 1 : Math.min(1, Math.max(...data.counts.flatMap(row => [row.predictive, row.plugin])) * 1.12);
  const coordinate = (value: number) => Number(value.toFixed(3));
  const y = (value: number) => coordinate(bottom - value / maxProbability * (bottom - top));
  const countX = (k: number) => coordinate(left + (k + .5) / (count + 1) * width);
  const pathX = (step: number) => coordinate(left + step / count * width);
  const pathRows = [{ step: 0, predictive: 1, plugin: 1 }, ...data.failurePath];
  const path = (key: 'predictive' | 'plugin') => pathRows.map((row, index) => `${index ? 'L' : 'M'} ${pathX(row.step)} ${y(row[key])}`).join(' ');
  const xTicks = [...new Set([0, Math.round(count / 2), count])];
  const stats = [[posteriorLabel, `${number.format(data.alpha)} / ${number.format(data.beta)}`], [parameterVarianceLabel, number.format(data.parameterVariance)], [oneStepVarianceLabel, number.format(data.oneStepVariance)], [countVarianceLabel, number.format(data.countVariance)], [pluginVarianceLabel, number.format(data.pluginCountVariance)], [covarianceLabel, number.format(data.pairCovariance)], [correlationLabel, percent.format(data.pairCorrelation)], [allFailuresLabel, probability(data.allFailures)], [pluginFailuresLabel, probability(data.pluginAllFailures)]];
  const focus = 'block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed">{modelText}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${id}-trials`} className="text-sm font-medium">{trialsLabel}: <output className="font-mono">{count}</output><input id={`${id}-trials`} type="range" min={1} max={20} step={1} value={count} onChange={event => setCount(Number(event.target.value))} className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" /></label>
      <label htmlFor={`${id}-mean`} className="text-sm font-medium">{meanLabel}: <output className="font-mono">{percent.format(mean)}</output><input id={`${id}-mean`} type="range" min={5} max={95} step={.5} value={mean * 100} onChange={event => setMean(Number(event.target.value) / 100)} className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" /></label>
      <label htmlFor={`${id}-concentration`} className="text-sm font-medium sm:col-span-2">{concentrationLabel}: <output className="font-mono">{number.format(concentration)}</output><input id={`${id}-concentration`} type="range" min={2} max={100} step={1} value={concentration} onChange={event => setConcentration(Number(event.target.value))} className="mt-2 h-8 w-full accent-accent-600 focus-visible:outline-2 focus-visible:outline-brand-600" /></label>
    </div>
    <fieldset className="mt-4"><legend className="text-sm font-medium">{viewLabel}</legend><div className="mt-2 flex flex-wrap gap-2">{(['count', 'path'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cx('min-h-8 rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600', view === value ? 'bg-brand-600 text-white' : 'border border-ink-300 bg-surface')}>{value === 'count' ? countViewLabel : pathViewLabel}</button>)}</div></fieldset>
    <p className="mt-4 text-sm leading-relaxed" aria-live="polite">{view === 'count' ? countScopeMessage : pathScopeMessage}</p>
    <p className="mt-4 text-sm">{probabilityLabel}</p>
    <svg role="img" aria-label={view === 'count' ? countChartLabel : pathChartLabel} viewBox="0 0 640 275" className="mt-2 w-full">
      {[0, maxProbability / 2, maxProbability].map(value => <g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="var(--color-ink-200)" /><text x={145} y={y(value) + 10} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{tickPercent.format(value)}</text></g>)}
      {view === 'count' ? data.counts.map(row => { const slot = width / (count + 1), barWidth = coordinate(slot * .35); return <g key={row.successes}><rect x={coordinate(countX(row.successes) - barWidth)} y={y(row.predictive)} width={barWidth} height={coordinate(bottom - y(row.predictive))} fill="var(--color-brand-600)" /><rect x={countX(row.successes)} y={y(row.plugin)} width={barWidth} height={coordinate(bottom - y(row.plugin))} fill="var(--color-accent-600)" /></g>; }) : <><path d={path('predictive')} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} /><path d={path('plugin')} fill="none" stroke="var(--color-accent-600)" strokeDasharray="7 5" strokeWidth={3} />{pathRows.map(row => <g key={row.step}><circle cx={pathX(row.step)} cy={y(row.predictive)} r={4} fill="var(--color-brand-600)" /><circle cx={pathX(row.step)} cy={y(row.plugin)} r={3} fill="var(--color-accent-600)" /></g>)}</>}
      {xTicks.map(value => <text key={value} x={view === 'count' ? countX(value) : pathX(value)} y={255} textAnchor="middle" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{value}</text>)}
    </svg>
    <p className="mt-1 text-center text-sm">{view === 'count' ? countAxisLabel : pathAxisLabel}</p>
    <div className="mt-3 flex flex-wrap gap-3 text-sm"><span className="inline-flex items-center gap-2"><span className="h-1 w-5 bg-brand-600" aria-hidden="true" />{predictiveLabel}</span><span className="inline-flex items-center gap-2"><span className="h-1 w-5 bg-accent-600" aria-hidden="true" />{pluginLabel}</span></div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{stats.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className={focus}><caption className="sr-only">{tableLabel}</caption><thead><tr>{(view === 'count' ? [successesLabel, predictiveLabel, pluginLabel] : [stepLabel, conditionalLabel, predictiveLabel, pluginLabel]).map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{view === 'count' ? data.counts.map(row => <tr key={row.successes} className="border-t border-ink-200"><th scope="row" className="p-2 font-mono font-medium">{row.successes}</th><td className="whitespace-nowrap p-2 font-mono">{probability(row.predictive)}</td><td className="whitespace-nowrap p-2 font-mono">{probability(row.plugin)}</td></tr>) : data.failurePath.map(row => <tr key={row.step} className="border-t border-ink-200"><th scope="row" className="p-2 font-mono font-medium">{row.step}</th><td className="whitespace-nowrap p-2 font-mono">{probability(row.conditionalFailure)}</td><td className="whitespace-nowrap p-2 font-mono">{probability(row.predictive)}</td><td className="whitespace-nowrap p-2 font-mono">{probability(row.plugin)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
