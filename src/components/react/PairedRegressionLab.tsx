import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
import { calculatePairedMoments, type PairedValue } from '@/components/react/CorrelationRiskLab';

const compensatedSum = (values: number[]) => {
  let total = 0, correction = 0;
  for (const value of values) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return total + correction;
};
const rescaleError = () => { throw new Error('PairedRegressionLab: a coefficient, residual or score is outside the supported numerical scale; rescale the measurements.'); };
const validatePairs = (pairs: PairedValue[]) => {
  if (!Array.isArray(pairs) || pairs.length < 2 || pairs.length > 1000 || pairs.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x) > 10000 || Math.abs(p.y) > 10000)) throw new Error('PairedRegressionLab: supply two to 1000 finite paired values with absolute magnitudes at most 10000.');
};
/** Centered prediction score; a constant target has no defined centered R-squared. */
export function scorePairedPredictions(actual: number[], predicted: number[]) {
  if (!Array.isArray(actual) || !Array.isArray(predicted) || actual.length < 2 || actual.length !== predicted.length || [...actual, ...predicted].some(v => !Number.isFinite(v))) throw new Error('PairedRegressionLab: scoring requires matching finite observed and predicted arrays with at least two values.');
  const mean = actual[0] + compensatedSum(actual.map(y => y - actual[0])) / actual.length;
  const residuals = actual.map((y, i) => y - predicted[i]), centered = actual.map(y => y - mean);
  const squares = residuals.map(e => e * e), centeredSquares = centered.map(e => e * e);
  if (residuals.some((e, i) => e !== 0 && squares[i] === 0) || centered.some((e, i) => e !== 0 && centeredSquares[i] === 0)) rescaleError();
  const sse = compensatedSum(squares), sst = compensatedSum(centeredSquares), rSquared = sst === 0 ? null : 1 - sse / sst;
  if (![mean, sse, sst, rSquared].every(v => v === null || Number.isFinite(v))) rescaleError();
  return { mean, residuals, sse, sst, rSquared };
}
/** Algebraic unweighted OLS fit, not a probabilistic error model or causal estimate. */
export function fitPairedOLS(pairs: PairedValue[], includeIntercept = true) {
  validatePairs(pairs);
  if (typeof includeIntercept !== 'boolean') throw new Error('PairedRegressionLab: includeIntercept must be a boolean.');
  const moments = calculatePairedMoments(pairs, 'sample');
  let slope: number | null, intercept: number | null;
  if (includeIntercept) {
    slope = moments.varianceX === 0 ? null : moments.covariance / moments.varianceX;
    if (moments.covariance !== 0 && slope === 0) rescaleError();
    intercept = slope === null ? moments.meanX === 0 ? moments.meanY : null : moments.meanY - slope * moments.meanX;
  } else {
    const scale = Math.max(...pairs.map(p => Math.abs(p.x)));
    const numerator = scale ? compensatedSum(pairs.map(p => (p.x / scale) * p.y)) : 0;
    const denominator = scale ? compensatedSum(pairs.map(p => (p.x / scale) ** 2)) : 0;
    slope = scale ? numerator / denominator / scale : null;
    if (numerator !== 0 && slope === 0) rescaleError();
    intercept = 0;
  }
  if (![slope, intercept].every(v => v === null || Number.isFinite(v))) rescaleError();
  const fitted = pairs.map(p => slope === null ? includeIntercept ? moments.meanY : 0 : includeIntercept ? moments.meanY + slope * (p.x - moments.meanX) : slope * p.x);
  const score = scorePairedPredictions(pairs.map(p => p.y), fitted);
  const identified = slope !== null;
  return { ...moments, ...score, slope, intercept, fitted, identified, includeIntercept, rows: pairs.map((p, i) => ({ ...p, fitted: fitted[i], residual: score.residuals[i], squaredResidual: score.residuals[i] ** 2 })) };
}
export type PairedOLSFit = ReturnType<typeof fitPairedOLS>;
/** Evaluate a frozen fit. An unidentified line cannot extrapolate away from its constant predictor. */
export function evaluatePairedOLS(fit: PairedOLSFit, pairs: PairedValue[]) {
  validatePairs(pairs);
  if (!fit.identified && pairs.some(p => p.x !== fit.meanX)) return { supported: false as const, fitted: null, score: null };
  const fitted = pairs.map(p => fit.slope === null ? fit.includeIntercept ? fit.meanY : 0 : fit.includeIntercept ? fit.meanY + fit.slope * (p.x - fit.meanX) : fit.slope * p.x);
  return { supported: true as const, fitted, score: scorePairedPredictions(pairs.map(p => p.y), fitted) };
}

const originalPairs = [{ x: 2, y: 1 }, { x: -1, y: -2 }, { x: 3, y: 4 }, { x: -4, y: -3 }];
const defaultEvaluation = [{ x: -2, y: 2 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 2, y: -2 }];
const labelsDefault = {
  model: 'Invented paired observations, equally weighted. The fitted line minimizes squared vertical residuals on the designated fitting rows. The charts describe those rows and the stated transformations; no normality, independence, causal effect, future skill or market forecast is established.',
  momentsModel: 'Conventions divide the same centered sums by n or n minus one. Return values use the selected common units; covariance and variance use those units squared. A matching divisor cancels from correlation and the fitted slope.',
  basisModel: 'Both columns contain matched invented simple returns. A single constant risk-free return per period is subtracted from both for the excess-return view. A changing risk-free series would not generally preserve the same slope.',
  evaluationModel: 'The original fitting rows alone determine the frozen line. Later rows are evaluated separately when their predictor is observed; a contemporaneous market return is not information known before that period starts. Selecting the fitting rows again does not refit on later outcomes.',
  view: 'Regression display', moments: 'Paired moments', fit: 'Fitted line and vertical gaps', residuals: 'Residuals by predictor', basis: 'Raw or excess return basis', domain: 'Coefficient domain', nonlinear: 'Chosen predictor feature', evaluation: 'Frozen-fit evaluation',
  units: 'Measurement scale for both observed columns', originalUnits: 'Original authored units', scaledUnits: 'Each authored column divided by one hundred', pp: 'Percentage points', decimal: 'Decimal returns', convention: 'Moment convention', population: 'Population: divide by n', sample: 'Sample: divide by n minus one',
  candidate: 'Line whose squared residuals are shown', ols: 'OLS with an intercept', meanLine: 'Horizontal line at the fitting mean', identity: 'Identity line: response equals predictor', origin: 'OLS constrained to zero intercept',
  shift: 'Add the same return shift to every response, percentage points', riskFree: 'Constant risk-free return per period, percentage points', returnBasis: 'Returns supplied to the fit', raw: 'Raw simple returns', excess: 'Returns minus the same risk-free return',
  domainCase: 'Displayed data case', variable: 'Both original series vary', constantX: 'Every predictor equals 2 percentage points', constantY: 'Every response equals 1 percentage point', constantBoth: 'Predictor 2 and response 1 in every row',
  feature: 'Predictor supplied to the linear fit', linear: 'The displayed original predictor', square: 'Square of the displayed original predictor', evaluationSet: 'Rows scored with the frozen line', fittingRows: 'Original fitting observations', laterRows: 'Later held-out observations',
  n: 'Number of fitting observations', meanX: 'Fitting predictor mean in selected units', meanY: 'Fitting response mean in selected units', covariance: 'Covariance under the selected convention', varianceX: 'Predictor variance under the selected convention', varianceY: 'Response variance under the selected convention', correlation: 'Pearson correlation of the supplied predictor and response on the fitting rows', slope: 'OLS fitted slope', intercept: 'OLS fitted intercept in selected units', selectedSlope: 'Selected line slope', selectedIntercept: 'Selected line intercept in selected units', olsSSE: 'OLS squared-residual sum', sse: 'Selected squared-residual sum', sst: 'Centered response sum of squares on the scored rows', score: 'Centered R-squared score on the scored rows', trainScore: 'Centered R-squared on the original fitting rows', residualSum: 'Sum of selected residuals',
  undefined: 'Undefined: a required variance is zero', unidentified: 'Not uniquely identified by these data and this model', constantStatus: 'A constant predictor with an intercept identifies the fitted mean at the observed predictor, but not a unique slope. There are multiple coefficient pairs; extrapolation away from that predictor is not identified.', targetStatus: 'A constant response has centered total variation zero. The centered R-squared ratio and Pearson correlation are undefined; a perfect fit does not turn the ratio zero over zero into one.',
  noInterceptStatus: 'This line is constrained to pass through zero. The displayed score still uses centered total variation; it is not an uncentered software convention, and the in-sample Pearson-square identity need not hold.',
  featureStatus: 'The graph keeps the original predictor on its horizontal axis. When its square is selected, the fit is linear in that supplied squared feature and can be curved in the original coordinate. Squaring a rescaled predictor changes its slope units; the table retains the actual supplied feature.',
  axisFit: 'Horizontal axis: observed predictor in the selected units. Vertical axis: response in those units. Filled points are observations, the solid curve is the selected fitted rule, and vertical segments are its signed prediction gaps. All observations and numeric gaps remain in the table.',
  axisResidual: 'Horizontal axis: observed predictor in the selected units. Vertical axis: residual, observed response minus selected fitted response, in the same units. The zero line is a reference; patternless residuals are not automatically independent model errors.',
  chart: 'Observed paired values and selected fitted rule or residuals, with complete live values and a focusable table.', table: 'All scored paired values, fitted values and squared residuals; focus and use arrow keys to scroll horizontally', row: 'Observation', predictor: 'Observed predictor', supplied: 'Predictor supplied to fit', response: 'Observed response', fitted: 'Selected fitted response', residual: 'Observed minus fitted', squaredResidual: 'Squared residual',
  caption: 'Keep fitting rows, predictor definition, intercept convention, units and scoring rows with every result. A descriptive fit or a held-out score alone does not certify a market mechanism or future investment result.',
};
export type PairedRegressionLabels = typeof labelsDefault;
export interface PairedRegressionLabProps {
  view?: 'moments' | 'fit' | 'residuals' | 'basis' | 'domain' | 'nonlinear' | 'evaluation';
  pairs?: PairedValue[]; evaluationPairs?: PairedValue[]; convention?: 'population' | 'sample'; unit?: 'pp' | 'decimal';
  candidate?: 'ols' | 'mean' | 'identity' | 'origin'; responseShift?: number; riskFreePp?: number; returnBasis?: 'raw' | 'excess'; domainCase?: 'variable' | 'constantX' | 'constantY' | 'constantBoth'; feature?: 'linear' | 'square'; evaluationSet?: 'fitting' | 'later';
  title?: string; caption?: string; locale?: string; labels?: PairedRegressionLabels; className?: string;
}
const nativeGrid = (n: number, min: number, max: number, step: number, name: string) => {
  if (!Number.isFinite(n) || n < min || n > max || Math.abs((n - min) / step - Math.round((n - min) / step)) > 1e-8) throw new Error(`PairedRegressionLab: ${name} must match its native range and step.`);
};
export function PairedRegressionLab({ view = 'fit', pairs = originalPairs, evaluationPairs = defaultEvaluation, convention = 'sample', unit = 'pp', candidate = 'ols', responseShift = 0, riskFreePp = .5, returnBasis = 'raw', domainCase = 'variable', feature = 'linear', evaluationSet = 'later', title = 'Keep the fitted line and its evidence together', caption, locale = 'en-US', labels = labelsDefault, className }: PairedRegressionLabProps) {
  if (!['moments', 'fit', 'residuals', 'basis', 'domain', 'nonlinear', 'evaluation'].includes(view) || !['population', 'sample'].includes(convention) || !['pp', 'decimal'].includes(unit) || !['ols', 'mean', 'identity', 'origin'].includes(candidate) || !['raw', 'excess'].includes(returnBasis) || !['variable', 'constantX', 'constantY', 'constantBoth'].includes(domainCase) || !['linear', 'square'].includes(feature) || !['fitting', 'later'].includes(evaluationSet)) throw new Error('PairedRegressionLab: use supported display, data, feature and model conventions.');
  validatePairs(pairs); validatePairs(evaluationPairs);
  if (pairs.some(p => Math.abs(p.x) > 10 || Math.abs(p.y) > 10) || evaluationPairs.some(p => Math.abs(p.x) > 10 || Math.abs(p.y) > 10)) throw new Error('PairedRegressionLab: authored viewer observations must be within ten percentage points; use the generic helper for wider units.');
  nativeGrid(responseShift, -2, 2, .25, 'response shift'); nativeGrid(riskFreePp, 0, 1, .1, 'constant risk-free return');
  if (!labels || Object.keys(labelsDefault).some(k => typeof labels[k as keyof PairedRegressionLabels] !== 'string' || !labels[k as keyof PairedRegressionLabels].trim())) throw new Error('PairedRegressionLab: provide every nonempty localized label.');
  // Bound the reusable viewer's extrapolated display; generic helpers support wider scales.
  for (const f of [1, .01]) for (const square of view === 'nonlinear' ? [false, true] : [false]) {
    const checked = fitPairedOLS(pairs.map(p => ({ x: square ? (p.x * f) ** 2 : p.x * f, y: p.y * f })));
    if ([checked.slope, checked.intercept].some(v => v !== null && Math.abs(v) > 1e6)) throw new Error('PairedRegressionLab: authored viewer coefficients exceed the supported display scale; rescale the paired measurements.');
  }
  const id = useId(), l = labels;
  const [chosenUnit, setUnit] = useState(unit), [chosenConvention, setConvention] = useState(convention), [line, setLine] = useState(candidate), [shift, setShift] = useState(responseShift), [riskFree, setRiskFree] = useState(riskFreePp), [basis, setBasis] = useState(returnBasis), [dataCase, setDataCase] = useState(domainCase), [chosenFeature, setFeature] = useState(feature), [scoredSet, setScoredSet] = useState(evaluationSet);
  const factor = chosenUnit === 'pp' ? 1 : .01;
  const transform = (data: PairedValue[]) => data.map(p => {
    const constantX = view === 'domain' && ['constantX', 'constantBoth'].includes(dataCase), constantY = view === 'domain' && ['constantY', 'constantBoth'].includes(dataCase);
    const subtraction = view === 'basis' && basis === 'excess' ? riskFree : 0;
    return { x: ((constantX ? 2 : p.x) - subtraction) * factor, y: ((constantY ? 1 : p.y) + (view === 'fit' || view === 'residuals' ? shift : 0) - subtraction) * factor };
  });
  const observedTraining = transform(pairs), suppliedTraining = observedTraining.map(p => ({ x: view === 'nonlinear' && chosenFeature === 'square' ? p.x * p.x : p.x, y: p.y }));
  const ols = fitPairedOLS(suppliedTraining), moments = calculatePairedMoments(suppliedTraining, chosenConvention);
  const selected = (view === 'fit' || view === 'residuals') && line === 'origin' ? fitPairedOLS(suppliedTraining, false) : ols;
  const isEvaluation = view === 'evaluation' && scoredSet === 'later', observed = isEvaluation ? transform(evaluationPairs) : observedTraining;
  const supplied = observed.map(p => ({ x: view === 'nonlinear' && chosenFeature === 'square' ? p.x * p.x : p.x, y: p.y }));
  const prediction = (x: number) => {
    if ((view === 'fit' || view === 'residuals') && line === 'mean') return ols.meanY;
    if ((view === 'fit' || view === 'residuals') && line === 'identity') return x;
    return selected.slope === null ? selected.includeIntercept ? selected.meanY : 0 : selected.includeIntercept ? selected.meanY + selected.slope * (x - selected.meanX) : selected.slope * x;
  };
  const fitted = supplied.map(p => prediction(p.x)), score = scorePairedPredictions(supplied.map(p => p.y), fitted), selectedSlope = line === 'mean' && ['fit', 'residuals'].includes(view) ? 0 : line === 'identity' && ['fit', 'residuals'].includes(view) ? 1 : selected.slope, selectedIntercept = line === 'mean' && ['fit', 'residuals'].includes(view) ? ols.meanY : line === 'identity' && ['fit', 'residuals'].includes(view) ? 0 : selected.intercept;
  const number = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Math.abs(n) < 5e-9 ? 0 : n);
  const value = (n: number | null, missing = l.undefined) => n === null ? missing : number(n);
  const results: [string, string, string][] = view === 'moments' ? [['n', l.n, number(pairs.length)], ['meanX', l.meanX, number(moments.meanX)], ['meanY', l.meanY, number(moments.meanY)], ['covariance', l.covariance, number(moments.covariance)], ['varianceX', l.varianceX, number(moments.varianceX)], ['varianceY', l.varianceY, number(moments.varianceY)], ['correlation', l.correlation, value(moments.correlation)], ['slope', l.slope, value(ols.slope, l.unidentified)]] : [['slope', l.slope, value(ols.slope, l.unidentified)], ['intercept', l.intercept, value(ols.intercept, l.unidentified)], ['correlation', l.correlation, value(ols.correlation)], ['trainScore', l.trainScore, value(ols.rSquared)], ['selectedSlope', l.selectedSlope, value(selectedSlope, l.unidentified)], ['selectedIntercept', l.selectedIntercept, value(selectedIntercept, l.unidentified)], ['olsSSE', l.olsSSE, number(ols.sse)], ['sse', l.sse, number(score.sse)], ['sst', l.sst, number(score.sst)], ['score', l.score, value(score.rSquared)], ['residualSum', l.residualSum, number(compensatedSum(score.residuals))]];
  const selectClass = 'mt-2 min-h-10 w-full rounded-sm border border-ink-300 bg-surface p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const selector = (key: string, label: string, current: string, change: (v: string) => void, options: [string, string][]) => <label className="block min-w-0 text-sm text-ink-800" htmlFor={`${id}-${key}`}><span>{label}</span><select id={`${id}-${key}`} aria-label={label} value={current} onChange={e => change(e.currentTarget.value)} className={selectClass}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>;
  const range = (key: string, label: string, current: number, change: (v: number) => void, min: number, max: number, step: number) => <label className="block min-w-0 text-sm text-ink-800" htmlFor={`${id}-${key}`}><span className="flex flex-wrap justify-between gap-2"><span>{label}</span><output htmlFor={`${id}-${key}`} className="font-mono">{number(current)}</output></span><input id={`${id}-${key}`} aria-label={label} aria-valuetext={number(current)} type="range" value={current} min={min} max={max} step={step} onChange={e => change(Number(e.currentTarget.value))} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>;
  const W = 640, H = 350, left = 200, right = 574, top = 44, bottom = 258, coord = (n: number) => Number(n.toFixed(3));
  const xExtent = Math.max(factor, ...observed.map(p => Math.abs(p.x))), residualView = view === 'residuals';
  const curvePoints = Array.from({ length: 81 }, (_, i) => { const x = -xExtent + 2 * xExtent * i / 80, suppliedX = view === 'nonlinear' && chosenFeature === 'square' ? x * x : x; return { x, y: prediction(suppliedX) }; });
  const plotCurve = selected.identified || ['fit', 'residuals'].includes(view) && ['mean', 'identity'].includes(line);
  const yExtent = Math.max(factor, ...(residualView ? score.residuals.map(Math.abs) : [...observed.map(p => Math.abs(p.y)), ...(plotCurve ? curvePoints.map(p => Math.abs(p.y)) : [])]));
  const xOf = (x: number) => coord(left + (x + xExtent) / (2 * xExtent) * (right - left)), yOf = (y: number) => coord(bottom - (y + yExtent) / (2 * yExtent) * (bottom - top));
  const tick = (n: number) => new Intl.NumberFormat(locale, { useGrouping: false, maximumSignificantDigits: 3 }).format(Math.abs(n) < 1e-12 ? 0 : n);
  return <figure data-regression-view={view} className={cx('not-prose my-8 min-w-0 rounded-card border border-ink-200 bg-surface p-4 shadow-soft sm:p-6', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.model}</p>
    {view === 'moments' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.momentsModel}</p>}
    {view === 'basis' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.basisModel}</p>}
    {view === 'evaluation' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.evaluationModel}</p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {selector('units', l.units, chosenUnit, v => setUnit(v as typeof unit), [['pp', view === 'nonlinear' ? l.originalUnits : l.pp], ['decimal', view === 'nonlinear' ? l.scaledUnits : l.decimal]])}
      {view === 'moments' && selector('convention', l.convention, chosenConvention, v => setConvention(v as typeof convention), [['population', l.population], ['sample', l.sample]])}
      {['fit', 'residuals'].includes(view) && <>{selector('candidate', l.candidate, line, v => setLine(v as typeof candidate), [['ols', l.ols], ['mean', l.meanLine], ['identity', l.identity], ['origin', l.origin]])}{range('shift', l.shift, shift, setShift, -2, 2, .25)}</>}
      {view === 'basis' && <>{selector('basis', l.returnBasis, basis, v => setBasis(v as typeof returnBasis), [['raw', l.raw], ['excess', l.excess]])}{range('risk-free', l.riskFree, riskFree, setRiskFree, 0, 1, .1)}</>}
      {view === 'domain' && selector('domain', l.domainCase, dataCase, v => setDataCase(v as typeof domainCase), [['variable', l.variable], ['constantX', l.constantX], ['constantY', l.constantY], ['constantBoth', l.constantBoth]])}
      {view === 'nonlinear' && selector('feature', l.feature, chosenFeature, v => setFeature(v as typeof feature), [['linear', l.linear], ['square', l.square]])}
      {view === 'evaluation' && selector('scored', l.evaluationSet, scoredSet, v => setScoredSet(v as typeof evaluationSet), [['fitting', l.fittingRows], ['later', l.laterRows]])}
    </div>
    <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 rounded-card bg-surface-sunken p-3 text-sm text-ink-900">{results.map(([key, label, display]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd data-stat={key} className={cx('m-0', [l.undefined, l.unidentified].includes(display) ? '' : 'font-mono')}>{display}</dd></div>)}</dl>
    {!ols.identified && <p role="status" className="mt-3 rounded-card border border-accent-300 p-3 text-sm leading-relaxed text-ink-800">{l.constantStatus}</p>}
    {ols.sst === 0 && <p role="status" className="mt-3 rounded-card border border-accent-300 p-3 text-sm leading-relaxed text-ink-800">{l.targetStatus}</p>}
    {['fit', 'residuals'].includes(view) && line === 'origin' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.noInterceptStatus}</p>}
    {view === 'nonlinear' && <p className="mt-3 text-sm leading-relaxed text-ink-700">{l.featureStatus}</p>}
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{residualView ? l.axisResidual : l.axisFit}</p>
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-visible" role="img" aria-label={`${title}. ${l.chart}`}>
      {[-yExtent, 0, yExtent].map(v => <g key={v}><line x1={left} x2={right} y1={yOf(v)} y2={yOf(v)} stroke="var(--color-ink-200)" /><text x={left - 12} y={yOf(v) + 9} textAnchor="end" className="text-[38px] sm:text-[20px] md:text-[15px]" fill="var(--color-ink-700)">{tick(v)}</text></g>)}
      {[-xExtent, 0, xExtent].map(v => <g key={v}><line x1={xOf(v)} x2={xOf(v)} y1={top} y2={bottom} stroke="var(--color-ink-100)" /><text x={xOf(v)} y={332} textAnchor="middle" className="text-[38px] sm:text-[20px] md:text-[15px]" fill="var(--color-ink-700)">{tick(v)}</text></g>)}
      {!residualView && plotCurve && <path d={curvePoints.map((p, i) => `${i ? 'L' : 'M'} ${xOf(p.x)} ${yOf(p.y)}`).join(' ')} fill="none" stroke="var(--color-brand-600)" strokeWidth={4} />}
      {observed.map((p, i) => <g key={i}>{!residualView && <line x1={xOf(p.x)} x2={xOf(p.x)} y1={yOf(p.y)} y2={yOf(fitted[i])} stroke="var(--color-accent-500)" strokeWidth={3} />}<circle cx={xOf(p.x)} cy={yOf(residualView ? score.residuals[i] : p.y)} r={8} fill={isEvaluation ? 'var(--color-accent-600)' : 'var(--color-brand-600)'} /></g>)}
    </svg>
    <div className="mt-3"><table tabIndex={0} aria-label={l.table} className="block w-full max-w-full overflow-x-auto border-collapse text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{[l.row, l.predictor, l.supplied, l.response, l.fitted, l.residual, l.squaredResidual].map(h => <th key={h} scope="col" className="border-b border-ink-300 p-3 text-left font-semibold text-ink-900">{h}</th>)}</tr></thead><tbody>{observed.map((p, i) => <tr key={i}>{[number(i + 1 + (isEvaluation ? pairs.length : 0)), number(p.x), number(supplied[i].x), number(p.y), number(fitted[i]), number(score.residuals[i]), number(score.residuals[i] ** 2)].map((display, j) => j === 0 ? <th key={j} scope="row" className="border-b border-ink-100 p-3 text-left font-mono">{display}</th> : <td key={j} className="whitespace-nowrap border-b border-ink-100 p-3 font-mono">{display}</td>)}</tr>)}</tbody></table></div>
    <p className="mt-4 text-sm leading-relaxed text-ink-700">{caption ?? l.caption}</p>
  </figure>;
}
