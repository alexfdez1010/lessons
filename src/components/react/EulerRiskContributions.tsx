import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EulerRiskInputs {
  weights: readonly [number, number];
  volatilities: readonly [number, number];
  correlation: number;
}
export interface EulerRiskResult {
  variance: number;
  volatility: number;
  covarianceWithPortfolio: readonly [number, number];
  varianceContributions: readonly [number, number];
  marginal: readonly [number, number] | null;
  components: readonly [number, number] | null;
  shares: readonly [number, number] | null;
  numericalZero: boolean;
}
/** Exposures are fractions of fixed reference capital. Partial derivatives hold
 * the other exposure fixed; they are not automatically budget-neutral trades.
 * The two-asset factor representation avoids cancellation in w' Sigma w.
 * At exact/roundoff-scale cancellation (16 eps times gross volatility exposure),
 * the norm is reported as zero and its undefined gradient remains null. */
export function calculateEulerRisk(i: EulerRiskInputs): EulerRiskResult {
  if (!Array.isArray(i.weights) || i.weights.length !== 2 || i.weights.some(x => !Number.isFinite(x) || x < 0 || x > 2)) throw new Error('EulerRiskContributions: weights must contain two finite exposures from zero to two.');
  if (!Array.isArray(i.volatilities) || i.volatilities.length !== 2 || i.volatilities.some(x => !Number.isFinite(x) || x <= 0 || x > 1)) throw new Error('EulerRiskContributions: volatilities must contain two positive values at most one.');
  if (!Number.isFinite(i.correlation) || Math.abs(i.correlation) > 1) throw new Error('EulerRiskContributions: correlation must be from -1 to 1.');
  const [wA, wB] = i.weights, [sA, sB] = i.volatilities, rho = i.correlation;
  const a = wA * sA, b = wB * sB;
  const norm = Math.hypot(a + rho * b, b * Math.sqrt((1 - rho) * (1 + rho)));
  const numericalZero = norm <= 16 * Number.EPSILON * (Math.abs(a) + Math.abs(b));
  const volatility = numericalZero ? 0 : norm;
  const q: [number, number] = [sA * (a + rho * b), sB * (rho * a + b)];
  const varianceContributions: [number, number] = [wA * q[0], wB * q[1]];
  const marginal: [number, number] | null = volatility === 0 ? null : [q[0] / volatility, q[1] / volatility];
  const components: [number, number] | null = marginal ? [wA * marginal[0], wB * marginal[1]] : null;
  const shares: [number, number] | null = components ? [components[0] / volatility, components[1] / volatility] : null;
  return { variance: volatility * volatility, volatility, covarianceWithPortfolio: q, varianceContributions, marginal, components, shares, numericalZero };
}
export function calculateEulerTransfer(i: EulerRiskInputs, transfer: number) {
  const before = calculateEulerRisk(i);
  if (!Number.isFinite(transfer) || transfer < -i.weights[1] || transfer > i.weights[0] || i.weights[0] - transfer > 2 || i.weights[1] + transfer > 2) throw new Error('EulerRiskContributions: the funded transfer must keep both exposures nonnegative.');
  const after = calculateEulerRisk({ ...i, weights: [i.weights[0] - transfer, i.weights[1] + transfer] });
  const slope = before.marginal ? before.marginal[1] - before.marginal[0] : null;
  const linear = slope === null ? null : before.volatility + transfer * slope;
  return { before, after, slope, linear, exactChange: after.volatility - before.volatility };
}
export interface EulerRiskContributionsProps {
  weightA?: number; volatilityA?: number; volatilityB?: number; correlation?: number; transfer?: number;
  mode?: 'components' | 'transfer'; locale?: string; title?: string; assetLabels?: readonly [string, string];
  weightLabel?: string; correlationLabel?: string; transferLabel?: string; assumptionsMessage?: string;
  volatilityLabel?: string; componentLabel?: string; marginalLabel?: string; shareLabel?: string;
  assetLabel?: string; weightHeading?: string; tableLabel?: string; varianceLabel?: string;
  currentLabel?: string; exactLabel?: string; tangentLabel?: string; changeLabel?: string;
  zeroMessage?: string; signedMessage?: string; transferMessage?: string; undefinedLabel?: string;
  chartLabel?: string; transferChartLabel?: string; caption?: string; className?: string;
}
export function EulerRiskContributions({
  weightA = .8, volatilityA = .2, volatilityB = .1, correlation = -.8, transfer = .05,
  mode = 'components', locale = 'en-GB', title = 'Read the signed contributions to portfolio volatility',
  assetLabels = ['Asset A', 'Asset B'], weightLabel = 'Weight of asset A', correlationLabel = 'Correlation',
  transferLabel = 'Weight moved from A into B', assumptionsMessage = 'Invented one-year return covariance. A volatility {a}; B volatility {b}. Both weights are nonnegative and sum to one. Covariance stays fixed as the weights change; costs and return forecasts are absent.',
  volatilityLabel = 'Portfolio volatility', componentLabel = 'Component volatility points', marginalLabel = 'Marginal derivative', shareLabel = 'Share of portfolio volatility',
  assetLabel = 'Asset', weightHeading = 'Capital weight', tableLabel = 'Weights, marginal derivatives and signed Euler contributions; scroll horizontally if needed', varianceLabel = 'Variance contribution',
  currentLabel = 'Current volatility', exactLabel = 'Exact volatility after the funded transfer', tangentLabel = 'Local linear estimate', changeLabel = 'Exact change in volatility points',
  zeroMessage = 'At zero model volatility the volatility gradient and percentage contributions are undefined. The chart still shows exact risk after a funded transfer. Zero is determined at roundoff-scale cancellation, not a guarantee of a riskless investment.',
  signedMessage = 'Signed Euler components add to portfolio volatility. A negative component is a local hedging effect with this covariance, not a negative position or a guaranteed payoff. Shares can be below zero or above 100%.',
  transferMessage = 'The transfer sells A and buys the same capital weight of B. Its local slope is marginal B minus marginal A; a large transfer requires exact repricing. The dotted tangent may become negative even though true volatility cannot.',
  undefinedLabel = 'Undefined at zero volatility', chartLabel = 'Signed volatility components for {a} and {b}, measured in volatility percentage points. Zero is marked by the vertical reference line.',
  transferChartLabel = 'Exact portfolio volatility as capital is moved from A into B. Solid curve: exact volatility. Dotted line: local tangent at the current weights, where defined. Circle: chosen funded transfer.',
  caption = 'A covariance-based sensitivity illustration. Estimates, horizon, costs and investment constraints must be checked separately. No expected return or hedge-performance guarantee is implied.', className,
}: EulerRiskContributionsProps) {
  if (!Number.isFinite(weightA) || weightA < 0 || weightA > 1) throw new Error('EulerRiskContributions: weightA must be from zero to one.');
  const authored = { weights: [weightA, 1 - weightA] as const, volatilities: [volatilityA, volatilityB] as const, correlation };
  calculateEulerTransfer(authored, transfer);
  if (!['components', 'transfer'].includes(mode)) throw new Error('EulerRiskContributions: mode must be components or transfer.');
  if (assetLabels.length !== 2 || assetLabels.some(s => !s.trim())) throw new Error('EulerRiskContributions: provide two nonempty asset labels.');
  for (const [key, value] of Object.entries({ title, weightLabel, correlationLabel, transferLabel, assumptionsMessage, volatilityLabel, componentLabel, marginalLabel, shareLabel, assetLabel, weightHeading, tableLabel, varianceLabel, currentLabel, exactLabel, tangentLabel, changeLabel, zeroMessage, signedMessage, transferMessage, undefinedLabel, chartLabel, transferChartLabel, caption })) if (!value.trim()) throw new Error(`EulerRiskContributions: ${key} must be nonempty.`);
  new Intl.NumberFormat(locale);
  const id = useId();
  const [weight, setWeight] = useState(weightA), [rho, setRho] = useState(correlation), [delta, setDelta] = useState(transfer);
  const inputs = { weights: [weight, 1 - weight] as const, volatilities: [volatilityA, volatilityB] as const, correlation: rho };
  const boundedDelta = Math.min(weight, Math.max(-(1 - weight), delta));
  const result = calculateEulerTransfer(inputs, boundedDelta), r = result.before;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const points = (value: number | null) => value === null ? undefinedLabel : number.format(100 * value);
  const template = (message: string, variables: Record<string, string>) => message.replace(/\{([a-z]+)\}/g, (whole, key: string) => variables[key] ?? whole);
  const allComponents = r.components ?? [0, 0];
  const scale = Math.max(.01, r.volatility, ...allComponents.map(Math.abs));
  const x = (value: number) => 320 + value / scale * 230;
  const samples = Array.from({ length: 81 }, (_, j) => {
    const d = -(1 - weight) + j / 80;
    const exact = calculateEulerRisk({ ...inputs, weights: [1 - j / 80, j / 80] }).volatility;
    const linear = result.slope === null ? null : r.volatility + d * result.slope;
    return { d, exact, linear };
  });
  const minY = Math.min(0, ...samples.map(p => p.linear ?? 0)), maxY = Math.max(volatilityA, volatilityB, ...samples.map(p => p.linear ?? 0));
  const tickPercent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const px = (d: number) => 160 + (d + 1 - weight) * 370, py = (v: number) => 220 - (v - minY) / (maxY - minY) * 180;
  const path = (key: 'exact' | 'linear') => samples.filter(p => p[key] !== null).map((p, j) => `${j ? 'L' : 'M'} ${px(p.d)} ${py(p[key]!)}`).join(' ');
  const controls = [
    { key: 'weight', label: weightLabel, value: weight, min: 0, max: 1, step: 'any', set: setWeight, display: pct.format(weight) },
    { key: 'rho', label: correlationLabel, value: rho, min: -1, max: 1, step: 'any', set: setRho, display: number.format(rho) },
    ...(mode === 'transfer' ? [{ key: 'delta', label: transferLabel, value: boundedDelta, min: -(1 - weight), max: weight, step: 'any', set: setDelta, display: pct.format(boundedDelta) }] : []),
  ];
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <p className="mt-3 text-sm leading-relaxed">{template(assumptionsMessage, { a: pct.format(volatilityA), b: pct.format(volatilityB) })}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{controls.map(c => <label key={c.key} htmlFor={`${id}-${c.key}`} className="min-w-0 text-sm font-medium">{c.label}: <output className="font-mono">{c.display}</output><input id={`${id}-${c.key}`} type="range" min={c.min} max={c.max} step={c.step} value={c.value} onChange={e => c.set(Number(e.target.value))} className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"/></label>)}</div>
    <p className="mt-4 text-sm leading-relaxed">{r.marginal ? (mode === 'components' ? signedMessage : transferMessage) : zeroMessage}</p>
    {mode === 'components' ? <>
      <p className="mt-5 font-mono" aria-live="polite" aria-atomic="true">{volatilityLabel}: {pct.format(r.volatility)}</p>
      <svg viewBox="0 0 640 200" role="img" aria-label={template(chartLabel, { a: assetLabels[0], b: assetLabels[1] })} className="mt-4 w-full"><line x1={320} x2={320} y1={20} y2={170} stroke="var(--color-ink-500)"/><text x={320} y={190} textAnchor="middle" fill="var(--color-ink-700)" className="text-[35px] sm:text-[15px]">0</text>{allComponents.map((value, j) => <g key={j}><rect x={Math.min(320, x(value))} y={40 + j * 75} width={Math.abs(x(value) - 320)} height={30} fill={j ? 'var(--color-accent-600)' : 'var(--color-brand-600)'}/></g>)}</svg>
      <div className="mt-2 space-y-2 text-sm">{assetLabels.map((label, j) => <div key={j} className="flex min-w-0 items-start gap-2"><span aria-hidden="true" className={cx('mt-1 h-3 w-3 shrink-0', j ? 'bg-accent-600' : 'bg-brand-600')}/><span className="min-w-0 break-words">{label}: <strong className="font-mono">{points(r.components?.[j] ?? null)}</strong> · {componentLabel}</span></div>)}</div>
    </> : <>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[currentLabel, pct.format(r.volatility)], [exactLabel, pct.format(result.after.volatility)], [tangentLabel, result.linear === null ? undefinedLabel : pct.format(result.linear)], [changeLabel, points(result.exactChange)]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
      <svg viewBox="0 0 640 270" role="img" aria-label={transferChartLabel} className="mt-4 w-full"><line x1={160} x2={530} y1={py(0)} y2={py(0)} stroke="var(--color-ink-500)"/><path d={path('exact')} fill="none" stroke="var(--color-brand-600)" strokeWidth={3}/>{result.slope !== null && <path d={path('linear')} fill="none" stroke="var(--color-accent-600)" strokeWidth={2} strokeDasharray="7 5"/>}<circle cx={px(boundedDelta)} cy={py(result.after.volatility)} r={6} fill="var(--color-brand-800)"/><line x1={px(0)} x2={px(0)} y1={40} y2={220} stroke="var(--color-ink-400)" strokeDasharray="4 5"/>{[0, .5, 1].map(v => <text key={v} x={160 + 370 * v} y={255} textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'} className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{tickPercent.format(v - 1 + weight)}</text>)}<text x={145} y={py(0) + 10} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">0</text><text x={145} y={py(maxY) + 10} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{tickPercent.format(maxY)}</text></svg>
      <p className="mt-2 text-xs">{transferLabel}</p><div className="mt-2 flex flex-wrap gap-4 text-xs"><span className="inline-flex items-center gap-2"><span className="h-1 w-5 bg-brand-600" aria-hidden="true"/>{exactLabel}</span><span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-accent-600" aria-hidden="true"/>{tangentLabel}</span></div>
    </>}
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableLabel}</caption><thead><tr>{[assetLabel, weightHeading, marginalLabel, componentLabel, shareLabel, varianceLabel].map(label => <th key={label} scope="col" className="p-2 align-bottom font-semibold">{label}</th>)}</tr></thead><tbody>{assetLabels.map((label, j) => <tr key={j} className="border-t border-ink-200"><th scope="row" className="p-2 font-medium">{label}</th><td className="p-2 font-mono">{pct.format(inputs.weights[j]!)}</td><td className="p-2 font-mono">{r.marginal ? number.format(r.marginal[j]!) : undefinedLabel}</td><td className="p-2 font-mono">{r.components ? points(r.components[j]!) : undefinedLabel}</td><td className="p-2 font-mono">{r.shares ? pct.format(r.shares[j]!) : undefinedLabel}</td><td className="p-2 font-mono">{number.format(r.varianceContributions[j]!)}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
