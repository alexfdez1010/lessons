import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorRuinCurveProps {
  title?: string;
  /** Win probability minus 50%, expressed in percentage points by the control. */
  edgeLabel?: string;
  unitsLabel?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  ruinLabel?: string;
  caption?: string;
  /** Initial p − 0.5, from −0.20 to 0.20 in steps of 0.01. */
  edge?: number;
  /** Integer distance to a fixed absorbing floor, in fixed stake units, 1–60. */
  units?: number;
  /** Compare with additive Brownian motion matched to the walk's mean and variance. */
  showApproximation?: boolean;
  approximationLabel?: string;
  /** Accessible description template: {p}, {units}, {exact}, {approximation}. */
  chartLabel?: string;
  /** Accessible edge value template: {edge}, {p}. */
  edgeValueLabel?: string;
  /** Accessible distance value template: {units}. */
  unitsValueLabel?: string;
  locale?: string;
  className?: string;
}

function assertWalkInputs(p: number, units: number) {
  if (!Number.isFinite(p) || p < 0 || p > 1 || !Number.isSafeInteger(units) || units < 0) {
    throw new Error('RorRuinCurve: p must be in [0, 1] and units must be a non-negative safe integer.');
  }
}

/** Eventual absorption at zero for an iid additive ±1 walk, without an upper target. */
export function fixedUnitRuin(p: number, units: number): number {
  assertWalkInputs(p, units);
  if (units === 0 || p <= 0.5) return 1;
  return ((1 - p) / p) ** units;
}

/** Exact lower-floor hitting probability for additive Brownian motion, not fractional wealth. */
export function additiveBrownianRuin(mu: number, distance: number, variance: number): number {
  if (![mu, distance, variance].every(Number.isFinite) || distance < 0 || variance <= 0) {
    throw new Error('RorRuinCurve: Brownian distance must be non-negative and variance must be positive; all inputs must be finite.');
  }
  if (distance === 0 || mu <= 0) return 1;
  return Math.exp((-2 * mu * distance) / variance);
}

/** One unit per step gives mean 2p−1 and variance 4p(1−p) per step. */
export function matchedBrownianRuin(p: number, units: number): number {
  assertWalkInputs(p, units);
  if (p === 0 || p === 1) return fixedUnitRuin(p, units);
  return additiveBrownianRuin(2 * p - 1, units, 4 * p * (1 - p));
}

const interpolate = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * A deterministic, static SVG for a FIXED MONETARY UNIT walk. Integer distances
 * are connected as a visual guide. No fixed-fraction or finite-horizon claim is
 * made. The optional dashed curve is a different continuous model matched only
 * on additive mean and variance; it is not an exact bound for the discrete walk.
 */
export function RorRuinCurve({
  title = 'Eventual ruin in a fixed-unit walk',
  edgeLabel = 'Win probability minus 50% (percentage points)',
  unitsLabel = 'Distance to the fixed floor in stake units',
  xAxisLabel = 'Distance to the floor in fixed units',
  yAxisLabel = 'Eventual ruin probability',
  ruinLabel = 'Exact fixed-unit walk',
  caption = 'Independent ±1 steps with constant p, a fixed absorbing floor, no upper target and an infinite horizon. Integer distances are joined as a visual guide. At p ≤ 50%, eventual ruin is certain for every finite distance.',
  edge = 0.05,
  units = 20,
  showApproximation = false,
  approximationLabel = 'Matched additive Brownian model',
  chartLabel = 'Fixed-unit eventual ruin at win probability {p} and distance {units}: {exact}.',
  edgeValueLabel = '{edge} percentage points; win probability {p}',
  unitsValueLabel = '{units} fixed stake units to the floor',
  locale = 'en-US',
  className,
}: RorRuinCurveProps) {
  if (!Number.isFinite(edge) || edge < -0.2 || edge > 0.2 || Math.abs(edge * 100 - Math.round(edge * 100)) > 1e-8 || !Number.isInteger(units) || units < 1 || units > 60) {
    throw new Error('RorRuinCurve: edge must be from −0.20 to 0.20 in steps of 0.01; units must be an integer from 1 to 60.');
  }
  const id = useId();
  const [edgePct, setEdgePct] = useState(Math.round(edge * 100));
  const [unitCount, setUnitCount] = useState(units);
  const p = 0.5 + edgePct / 100;
  const exact = fixedUnitRuin(p, unitCount);
  const approximation = matchedBrownianRuin(p, unitCount);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: 'exceptZero' });
  const fmt = (value: number) => value > 0 && value < 0.000001 ? `< ${percent.format(0.000001)}` : percent.format(value);
  const values = { p: percent.format(p), units: number.format(unitCount), exact: fmt(exact), approximation: fmt(approximation), edge: signed.format(edgePct) };
  const W = 560, H = 270, left = 52, right = 16, top = 16, bottom = 48;
  const x = (n: number) => left + n / 60 * (W - left - right);
  const y = (r: number) => top + (1 - r) * (H - top - bottom);
  const path = (fn: (probability: number, n: number) => number) => Array.from({ length: 61 }, (_, n) => `${n ? 'L' : 'M'} ${x(n).toFixed(2)} ${y(fn(p, n)).toFixed(2)}`).join(' ');

  return (
    <figure className={cx('not-prose my-6 min-w-0 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="font-medium text-ink-900">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 block w-full" role="img" aria-label={interpolate(chartLabel, values)} aria-describedby={`${id}-caption`}>
        {[0, 0.5, 1].map((r) => <g key={r}>
          <line x1={left} y1={y(r)} x2={W - right} y2={y(r)} stroke="var(--color-ink-100)" strokeDasharray="3 4" />
          <text x={left - 8} y={y(r) + 4} fontSize={11} fill="var(--color-ink-700)" textAnchor="end">{percent.format(r)}</text>
        </g>)}
        <line x1={left} y1={top} x2={left} y2={y(0)} stroke="var(--color-ink-200)" />
        <line x1={left} y1={y(0)} x2={W - right} y2={y(0)} stroke="var(--color-ink-200)" />
        {[0, 10, 20, 30, 40, 50, 60].map((n) => <text key={n} x={x(n)} y={y(0) + 16} textAnchor="middle" fontSize={11} fill="var(--color-ink-700)">{number.format(n)}</text>)}
        {showApproximation && <path d={path(matchedBrownianRuin)} fill="none" stroke="var(--color-brand-600)" strokeWidth={2.3} strokeDasharray="7 4" />}
        <path d={path(fixedUnitRuin)} fill="none" stroke="var(--color-danger)" strokeWidth={2.5} />
        <line x1={x(unitCount)} x2={x(unitCount)} y1={y(0)} y2={y(exact)} stroke="var(--color-ink-500)" strokeDasharray="3 3" />
        <circle cx={x(unitCount)} cy={y(exact)} r={5} fill="var(--color-danger)" />
        {showApproximation && <circle cx={x(unitCount)} cy={y(approximation)} r={4} fill="var(--color-surface)" stroke="var(--color-brand-600)" strokeWidth={2} />}
        <text x={(left + W - right) / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--color-ink-700)">{xAxisLabel}</text>
        <text x={14} y={(top + y(0)) / 2} transform={`rotate(-90 14 ${(top + y(0)) / 2})`} textAnchor="middle" fontSize={11} fill="var(--color-ink-700)">{yAxisLabel}</text>
      </svg>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2" aria-live="polite" aria-atomic="true">
        <div className="min-w-0"><dt className="flex items-center gap-2 text-ink-700"><span aria-hidden="true" className="inline-block h-0.5 w-6 shrink-0 bg-danger" />{ruinLabel}</dt><dd className="mt-1 font-mono font-semibold text-ink-900">{fmt(exact)}</dd></div>
        {showApproximation && <div className="min-w-0"><dt className="flex items-center gap-2 text-ink-700"><svg width="24" height="4" aria-hidden="true" className="shrink-0"><path d="M0 2H24" stroke="var(--color-brand-600)" strokeWidth="2" strokeDasharray="6 3" /></svg>{approximationLabel}</dt><dd className="mt-1 font-mono font-semibold text-ink-900">{fmt(approximation)}</dd></div>}
      </dl>
      <div className="mt-5">
        <label htmlFor={`${id}-edge`} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm font-medium text-ink-700"><span>{edgeLabel}</span><span className="font-mono text-brand-700">{signed.format(edgePct)} pp · p = {percent.format(p)}</span></label>
        <input id={`${id}-edge`} type="range" min={-20} max={20} step={1} value={edgePct} onChange={(e) => setEdgePct(Number(e.target.value))} aria-valuetext={interpolate(edgeValueLabel, values)} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
      </div>
      <div className="mt-3">
        <label htmlFor={`${id}-units`} className="flex flex-wrap justify-between gap-3 text-sm font-medium text-ink-700"><span>{unitsLabel}</span><span className="font-mono text-brand-700">{number.format(unitCount)}</span></label>
        <input id={`${id}-units`} type="range" min={1} max={60} step={1} value={unitCount} onChange={(e) => setUnitCount(Number(e.target.value))} aria-valuetext={interpolate(unitsValueLabel, values)} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
      </div>
      <p id={`${id}-caption`} className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RorRuinCurve;
