import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EnsembleTimeFanProps {
  title?: string; rerunLabel?: string; meanLabel?: string; medianLabel?: string;
  ensembleRateLabel?: string; timeRateLabel?: string; roundsLabel?: string; wealthLabel?: string;
  currencyPrefix?: string; caption?: string; rounds?: number; players?: number; className?: string;
  upFactor?: number; downFactor?: number; probability?: number; locale?: string;
  analyticMeanLabel?: string; geometricReferenceLabel?: string; logGrowthLabel?: string;
  tableLabel?: string; chartLabel?: string; pathsLabel?: string; logAxisLabel?: string;
  medianConventionLabel?: string;
}
export function positiveGrowthMoments(up: number, down: number, probability: number) {
  if (![up, down, probability].every(Number.isFinite) || up < 1 || up > 2 || down < 0.01 || down > 1 || probability <= 0 || probability >= 1) throw new Error('Positive-growth model requires an up factor from 1 to 2, a down factor from 0.01 to 1, and probability strictly between 0 and 1.');
  const meanFactor = probability * up + (1 - probability) * down;
  const logGrowth = probability * Math.log(up) + (1 - probability) * Math.log(down);
  return { meanFactor, logGrowth, geometricFactor: Math.exp(logGrowth) };
}
export function seededUniform(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function simulatePositiveGrowth(rounds: number, players: number, seed: number, up = 1.5, down = 0.6, probability = 0.5) {
  const moments = positiveGrowthMoments(up, down, probability);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100 || !Number.isInteger(players) || players < 10 || players > 200 || !Number.isInteger(seed)) throw new Error('Positive-growth simulation requires 1–100 whole rounds, 10–200 whole players and an integer seed.');
  const rng = seededUniform(seed);
  const paths = Array.from({ length: players }, () => { const a = [100]; for (let t = 1; t <= rounds; t++) a.push(a[t - 1] * (rng() < probability ? up : down)); return a; });
  const mean: number[] = [], median: number[] = [], expected: number[] = [], geometric: number[] = [];
  for (let t = 0; t <= rounds; t++) { const values = paths.map(p => p[t]).sort((a, b) => a - b); mean.push(values.reduce((a, b) => a + b, 0) / players); const m = Math.floor(players / 2); median.push(players % 2 ? values[m] : (values[m - 1] + values[m]) / 2); expected.push(100 * moments.meanFactor ** t); geometric.push(100 * Math.exp(t * moments.logGrowth)); }
  return { paths, mean, median, expected, geometric, ...moments };
}
/** Synthetic iid positive wealth factors. Exact moments and a finite pseudo-sample are distinct series.
 * The geometric benchmark is not generally a unique population median. No trajectory is forced. */
export function EnsembleTimeFan({ title = 'Positive factors: expectation and a finite sample', rerunLabel = 'Draw another sample', meanLabel = 'Sample mean', medianLabel = 'Sample median', ensembleRateLabel = 'Expected simple return per round', timeRateLabel = 'Equivalent geometric return per round', roundsLabel = 'Rounds', wealthLabel = 'Wealth', currencyPrefix = '$', caption = 'Synthetic independent draws with constant probabilities and positive factors. The exact expectation is a distributional mean, not a guaranteed sample result. The geometric benchmark follows expected log growth; it is not generally a unique population median.', rounds = 100, players = 150, upFactor = 1.5, downFactor = 0.6, probability = 0.5, locale = 'en-US', analyticMeanLabel = 'Exact expected wealth', geometricReferenceLabel = 'Geometric benchmark', logGrowthLabel = 'Expected log increment per round', tableLabel = 'Exact reference values and finite-sample wealth summaries by round', chartLabel = 'Synthetic positive-factor wealth paths on a logarithmic axis. Exact expected wealth, a geometric benchmark, and finite-sample mean and median are distinct lines. Exact values are in the following table.', pathsLabel = 'Individual sample paths', logAxisLabel = 'Logarithmic wealth scale; all values are positive', medianConventionLabel = 'Sample median: the middle value, or the arithmetic average of the two middle values for an even sample size.', className }: EnsembleTimeFanProps) {
  positiveGrowthMoments(upFactor, downFactor, probability);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100 || !Number.isInteger(players) || players < 10 || players > 200) throw new Error('EnsembleTimeFan requires 1–100 whole rounds and 10–200 whole players.');
  const id = useId(); const [n, setN] = useState(rounds); const [seed, setSeed] = useState(1);
  const sim = useMemo(() => simulatePositiveGrowth(n, players, seed, upFactor, downFactor, probability), [n, players, seed, upFactor, downFactor, probability]);
  const number = (x: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(x);
  const money = (x: number) => currencyPrefix + number(x);
  const pct = (x: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 }).format(x);
  const logs = [...sim.paths.flat(), ...sim.expected, ...sim.geometric].map(Math.log); const lo = Math.min(...logs) - 0.1; const hi = Math.max(...logs) + 0.1;
  const x = (t: number) => 8 + 584 * t / n; const y = (v: number) => 230 - 220 * (Math.log(v) - lo) / (hi - lo);
  const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(3)},${y(v).toFixed(3)}`).join(' ');
  const references = [{ label: analyticMeanLabel, values: sim.expected, color: 'var(--color-accent-600)', dash: '' }, { label: geometricReferenceLabel, values: sim.geometric, color: 'var(--color-brand-700)', dash: '7 4' }, { label: meanLabel, values: sim.mean, color: 'var(--color-ink-900)', dash: '' }, { label: medianLabel, values: sim.median, color: 'var(--color-brand-400)', dash: '2 3' }];
  const dates = [...new Set([0, Math.floor(n / 2), n])];
  return <figure className={cx('not-prose my-6 rounded-card border border-ink-100 bg-surface p-4 shadow-soft', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <label htmlFor={id} className="mt-4 block text-sm text-ink-700">{roundsLabel}: {n}<input id={id} type="range" min={1} max={100} step={1} value={n} onChange={e => setN(Number(e.target.value))} className="mt-1 block h-8 w-full accent-brand-600" /></label>
    <div className="my-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">{references.map(r => <span key={r.label} className="inline-flex items-center gap-2"><span aria-hidden="true" className="inline-block h-1 w-5" style={{ background: r.color }} />{r.label}</span>)}<span className="text-ink-500">{pathsLabel}: {players}</span></div>
    <p className="text-sm text-ink-600">{logAxisLabel}</p>
    <svg viewBox="0 0 600 240" role="img" aria-label={chartLabel} className="mt-2 w-full"><title>{title}</title><g fill="none" stroke="var(--color-ink-300)" strokeWidth="0.6" opacity="0.5">{sim.paths.map((p, i) => <path d={path(p)} key={i} />)}</g>{references.map(r => <path key={r.label} d={path(r.values)} fill="none" stroke={r.color} strokeWidth="2.5" strokeDasharray={r.dash} />)}</svg>
    <div className="flex justify-between text-sm text-ink-700"><span>0</span><span>{n} {roundsLabel}</span></div>
    <dl aria-live="polite" className="my-4 grid gap-3 text-sm sm:grid-cols-3">{[[ensembleRateLabel, pct(sim.meanFactor - 1)], [logGrowthLabel, number(sim.logGrowth)], [timeRateLabel, pct(sim.geometricFactor - 1)]].map(([a, b]) => <div key={a} className="rounded-card bg-surface-sunken p-3"><dt>{a}</dt><dd className="mt-1 font-mono font-semibold">{b}</dd></div>)}</dl>
    <table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"><thead><tr>{[roundsLabel, ...references.map(r => r.label)].map(v => <th key={v} className="whitespace-nowrap border-b border-ink-200 px-3 py-2 text-left">{v}</th>)}</tr></thead><tbody>{dates.map(t => <tr key={t}><th className="px-3 py-2 text-left">{t}</th>{references.map(r => <td key={r.label} className="whitespace-nowrap px-3 py-2 font-mono">{money(r.values[t])}</td>)}</tr>)}</tbody></table>
    <p className="mt-3 text-sm text-ink-600">{medianConventionLabel}</p><button type="button" onClick={() => setSeed(s => s + 1)} className="mt-3 rounded-pill border border-ink-200 px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">{rerunLabel}</button><p className="mt-3 text-sm leading-relaxed text-ink-700">{caption}</p><span className="sr-only">{wealthLabel}</span>
  </figure>;
}
export default EnsembleTimeFan;
