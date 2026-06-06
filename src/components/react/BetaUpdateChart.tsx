import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BetaUpdateChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the "+ Win" button (record one observed success). */
  winLabel?: string;
  /** Label for the "+ Loss" button (record one observed failure). */
  lossLabel?: string;
  /** Label for the "+10 wins" bulk button. */
  win10Label?: string;
  /** Label for the "+10 losses" bulk button. */
  loss10Label?: string;
  /** Label for the "Reset" button (return to the prior). */
  resetLabel?: string;
  /** Label for the prior-α slider. */
  priorAlphaLabel?: string;
  /** Label for the prior-β slider. */
  priorBetaLabel?: string;
  /** Readout label for the posterior mean. */
  meanReadoutLabel?: string;
  /** Readout label for the 90% credible interval. */
  intervalReadoutLabel?: string;
  /** Readout label for the observed wins (successes). */
  winsReadoutLabel?: string;
  /** Readout label for the observed losses (failures). */
  lossesReadoutLabel?: string;
  /** Legend label for the posterior density curve. */
  posteriorLabel?: string;
  /** Legend label for the shaded credible interval band. */
  bandLabel?: string;
  /** Legend label for the posterior-mean line. */
  meanLineLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** y-axis label for the density. */
  densityAxisLabel?: string;
  /** Initial prior α₀ (1–10). Defaults to `1` (flat/uniform prior). */
  priorAlpha?: number;
  /** Initial prior β₀ (1–10). Defaults to `1` (flat/uniform prior). */
  priorBeta?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/**
 * Lanczos approximation of the natural log of the Gamma function. Used to
 * normalise the Beta density so the plotted curve is a true probability
 * density (peaks of tall, sharp posteriors stay comparable across updates).
 */
const lgamma = (z: number): number => {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // Reflection formula for z < 0.5.
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
    );
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
};

/** log of the Beta normalising constant: ln B(α,β). */
const lbeta = (a: number, b: number): number =>
  lgamma(a) + lgamma(b) - lgamma(a + b);

/** True normalised Beta(α,β) probability density at x ∈ (0,1). */
const betaPdf = (x: number, a: number, b: number): number => {
  if (x <= 0 || x >= 1) return 0;
  const logp =
    (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lbeta(a, b);
  return Math.exp(logp);
};

const SAMPLES = 120;

/** Sample the Beta density across [0,1] into an array of y-values. */
const sampleDensity = (a: number, b: number): number[] => {
  const ys: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = i / SAMPLES;
    ys.push(betaPdf(x, a, b));
  }
  return ys;
};

/**
 * Interactive Beta–Binomial conjugate-prior demo. The learner sets a prior
 * Beta(α₀, β₀) on a probability (e.g. a strategy's true win rate), then feeds
 * in observed wins (successes `s`) and losses (failures `f`). The posterior is
 * the conjugate Beta(α₀ + s, β₀ + f). The density curve sharpens and shifts as
 * data accumulates. A vertical line marks the posterior mean α/(α+β), and a
 * shaded band shows an approximate 90% credible interval.
 *
 * The credible interval uses the normal approximation mean ± 1.645·sd with
 * sd² = αβ / ((α+β)²(α+β+1)) — cheap and accurate once a handful of
 * observations have tightened the posterior; it can spill past [0,1] for very
 * flat priors, so it is clamped to the unit interval for display.
 *
 * The curve morphs between updates over ~500ms via requestAnimationFrame
 * interpolation of the sampled path; respects `prefers-reduced-motion`.
 */
export function BetaUpdateChart({
  title = 'Updating a belief, win by win',
  winLabel = '+ Win',
  lossLabel = '+ Loss',
  win10Label = '+10 wins',
  loss10Label = '+10 losses',
  resetLabel = 'Reset',
  priorAlphaLabel = 'Prior α₀',
  priorBetaLabel = 'Prior β₀',
  meanReadoutLabel = 'Posterior mean',
  intervalReadoutLabel = '90% credible interval',
  winsReadoutLabel = 'Wins (s)',
  lossesReadoutLabel = 'Losses (f)',
  posteriorLabel = 'Posterior density',
  bandLabel = '90% credible interval',
  meanLineLabel = 'Posterior mean',
  caption = 'A Beta prior plus Binomial data gives a Beta posterior — that conjugacy is why one win or loss just bumps α or β by one. Watch the curve start wide and uncertain, then sharpen around the true win rate as evidence piles up.',
  densityAxisLabel = 'density',
  priorAlpha = 1,
  priorBeta = 1,
  className,
}: BetaUpdateChartProps) {
  const id = useId();
  const [alpha0, setAlpha0] = useState(priorAlpha);
  const [beta0, setBeta0] = useState(priorBeta);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);

  const a = alpha0 + wins;
  const b = beta0 + losses;

  const W = 520;
  const H = 220;
  const padX = 14;
  const padY = 16;

  const x = (p: number) => padX + p * (W - padX * 2);
  // y maps a density value (0 → yMax) onto the chart height.
  const toY = (value: number, yMax: number) =>
    padY + (1 - value / yMax) * (H - padY * 2);

  // Target sampled density for the current posterior.
  const targetRef = useRef<number[]>(sampleDensity(a, b));
  // Currently displayed (animated) density.
  const [display, setDisplay] = useState<number[]>(() => sampleDensity(a, b));
  const fromRef = useRef<number[]>(display);
  const rafRef = useRef<number | null>(null);

  // Animate the curve morphing whenever the posterior changes.
  useEffect(() => {
    const target = sampleDensity(a, b);
    targetRef.current = target;
    if (prefersReducedMotion()) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const duration = 500;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      // ease-out for a settling feel
      const e = 1 - (1 - t) * (1 - t);
      const next = target.map((v, i) => from[i] + (v - from[i]) * e);
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b]);

  // Scale the y-axis to the taller of the current and target peaks so the
  // morphing curve never overflows the frame mid-animation.
  const peak = Math.max(
    1e-6,
    ...display,
    ...targetRef.current,
  );

  const path = () => {
    let d = `M ${x(0)} ${toY(display[0], peak)}`;
    for (let i = 1; i < display.length; i++) {
      d += ` L ${x(i / SAMPLES)} ${toY(display[i], peak)}`;
    }
    return d;
  };

  // Filled area under the curve (for the credible band clipping baseline).
  const areaPath = () => {
    let d = `M ${x(0)} ${toY(0, peak)}`;
    for (let i = 0; i < display.length; i++) {
      d += ` L ${x(i / SAMPLES)} ${toY(display[i], peak)}`;
    }
    d += ` L ${x(1)} ${toY(0, peak)} Z`;
    return d;
  };

  // Posterior mean and normal-approximation credible interval.
  const mean = a / (a + b);
  const variance = (a * b) / ((a + b) * (a + b) * (a + b + 1));
  const sd = Math.sqrt(variance);
  // 90% interval ≈ mean ± 1.645·sd (normal approximation), clamped to [0,1].
  const ciLo = Math.max(0, mean - 1.645 * sd);
  const ciHi = Math.min(1, mean + 1.645 * sd);

  const meanY = toY(betaPdf(mean, a, b), peak);
  const baselineY = toY(0, peak);

  const reset = () => {
    setWins(0);
    setLosses(0);
  };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {meanReadoutLabel}: {pct(mean)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {posteriorLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded-sm bg-brand-500/20" aria-hidden="true" />
          {bandLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {meanLineLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: posterior Beta with ${wins} wins and ${losses} losses on a prior of alpha ${alpha0} and beta ${beta0}. Posterior mean ${pct(
          mean,
        )}, 90% credible interval ${pct(ciLo)} to ${pct(ciHi)}.`}
      >
        <defs>
          {/* Clip the credible band to the area under the density curve. */}
          <clipPath id={`${id}-area`}>
            <path d={areaPath()} />
          </clipPath>
        </defs>

        {/* y-axis label */}
        <text
          x={padX}
          y={padY - 4}
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          {densityAxisLabel}
        </text>

        {/* Baseline along the bottom (the [0,1] probability axis). */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--color-ink-200)"
        />
        {/* 0 / 0.5 / 1 tick labels on the probability axis. */}
        {[0, 0.5, 1].map((p) => (
          <text
            key={p}
            x={x(p)}
            y={H - 2}
            textAnchor={p === 0 ? 'start' : p === 1 ? 'end' : 'middle'}
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {p === 0.5 ? '0.5' : `${p}`}
          </text>
        ))}

        {/* Credible-interval band, clipped to the density area. */}
        <g clipPath={`url(#${id}-area)`}>
          <rect
            x={x(ciLo)}
            y={padY}
            width={Math.max(0, x(ciHi) - x(ciLo))}
            height={H - padY * 2}
            fill="var(--color-brand-500)"
            opacity={0.2}
          />
        </g>

        {/* Posterior-mean vertical line. */}
        <line
          x1={x(mean)}
          y1={meanY}
          x2={x(mean)}
          y2={baselineY}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        {/* Posterior density curve. */}
        <path
          d={path()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Mean marker on the curve. */}
        <circle
          cx={x(mean)}
          cy={meanY}
          r={5}
          fill="var(--color-accent-500)"
          stroke="var(--color-surface, #fff)"
          strokeWidth={2}
        />
      </svg>

      {/* Update buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setWins((w) => w + 1)}
          className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {winLabel}
        </button>
        <button
          type="button"
          onClick={() => setWins((w) => w + 10)}
          className="rounded-pill bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700 transition hover:bg-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {win10Label}
        </button>
        <button
          type="button"
          onClick={() => setLosses((l) => l + 1)}
          className="rounded-pill bg-accent-500 px-3 py-1 text-sm font-medium text-white transition hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {lossLabel}
        </button>
        <button
          type="button"
          onClick={() => setLosses((l) => l + 10)}
          className="rounded-pill bg-accent-500/15 px-3 py-1 text-sm font-medium text-accent-600 transition hover:bg-accent-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {loss10Label}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-200 bg-surface px-3 py-1 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      {/* Prior sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-alpha`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{priorAlphaLabel}</span>
            <span className="font-mono text-ink-900">{alpha0}</span>
          </label>
          <input
            id={`${id}-alpha`}
            type="range"
            min={1}
            max={10}
            step={1}
            value={alpha0}
            onChange={(e) => setAlpha0(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-beta`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{priorBetaLabel}</span>
            <span className="font-mono text-ink-900">{beta0}</span>
          </label>
          <input
            id={`${id}-beta`}
            type="range"
            min={1}
            max={10}
            step={1}
            value={beta0}
            onChange={(e) => setBeta0(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{winsReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {wins}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lossesReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {losses}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{meanReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(mean)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{intervalReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(ciLo)}–{pct(ciHi)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BetaUpdateChart;
