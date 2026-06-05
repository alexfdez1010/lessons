import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface GeometricMeanGapProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the swing (volatility) slider. */
  swingLabel?: string;
  /** Legend label for the realised compounded-wealth curve. */
  realisedLabel?: string;
  /** Legend label for the flat arithmetic-expectation line. */
  expectedLabel?: string;
  /** Label for the arithmetic-mean readout. */
  arithmeticLabel?: string;
  /** Label for the geometric-mean readout. */
  geometricLabel?: string;
  /** Label for the gap readout (arithmetic − geometric). */
  gapLabel?: string;
  /** Label for the starting-amount badge. */
  startLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Starting amount. Defaults to `100`. */
  principal?: number;
  /** Initial swing as a fraction (0–0.6). Defaults to `0.3`. */
  swing?: number;
  /** Number of alternating periods drawn. Defaults to `12`. */
  periods?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}`;

const pct = (value: number): string =>
  `${value >= 0 ? '' : '−'}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(Math.abs(value * 100))}%`;

/**
 * Interactive "volatility drag" chart. A two-outcome asset swings up by +g% or
 * down by −g% with equal odds, so its *arithmetic* mean per period is 0% — yet a
 * gain followed by an equal loss leaves you below where you started. The realised
 * compounded wealth (alternating +g, −g, +g, −g…) sinks while the naive
 * arithmetic expectation stays flat; the widening gap between the two curves *is*
 * the geometric-mean drag, which grows with the swing. Drag the swing slider and
 * the curve plus the arithmetic / geometric / gap readouts update live; the
 * realised curve animates in on mount and on every change. Respects
 * `prefers-reduced-motion` (jumps straight to the final curve).
 */
export function GeometricMeanGap({
  title = 'Volatility drags the average down',
  swingLabel = 'Swing (±%)',
  realisedLabel = 'Realised (compounded)',
  expectedLabel = 'Arithmetic expectation',
  arithmeticLabel = 'Arithmetic mean',
  geometricLabel = 'Geometric mean',
  gapLabel = 'Gap (drag)',
  startLabel = 'Start',
  caption = 'Alternating +30% / −30% averages to 0% — but a gain then an equal loss leaves you below where you started. The geometric mean is what your money actually earns, and it sinks faster as swings grow.',
  currencyPrefix = '$',
  principal = 100,
  swing = 0.3,
  periods = 12,
  className,
}: GeometricMeanGapProps) {
  const id = useId();
  const [swingState, setSwingState] = useState(swing);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padY = 14;

  const g = swingState;
  // Arithmetic mean of +g and −g is exactly 0; geometric mean compounds them.
  const arithmeticMean = (g + -g) / 2; // = 0
  const geometricMean = Math.sqrt((1 + g) * (1 - g)) - 1; // sqrt(1 - g^2) - 1 ≤ 0
  const gap = arithmeticMean - geometricMean;

  // Realised wealth after each alternating period: +g, −g, +g, −g, …
  const realisedAt = (period: number): number => {
    let v = principal;
    for (let i = 0; i < period; i++) {
      v *= i % 2 === 0 ? 1 + g : 1 - g;
    }
    return v;
  };
  // The arithmetic expectation grows at the arithmetic mean (0%): a flat line.
  const expectedAt = (period: number): number =>
    principal * Math.pow(1 + arithmeticMean, period);

  const finalRealised = realisedAt(periods);
  const minV = Math.min(realisedAt(periods - 1), realisedAt(periods), principal);
  const maxV = Math.max(principal * 1.02, expectedAt(periods));

  const x = (period: number) => padX + (period / periods) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  // Realised curve revealed up to `progress` (whole-period steps, sub-step tween).
  const realisedPath = () => {
    const upto = progress * periods;
    let d = `M ${x(0)} ${y(realisedAt(0))}`;
    for (let p = 1; p <= periods; p++) {
      if (p > upto) {
        // Interpolate the final partial segment for a smooth reveal.
        const prev = p - 1;
        const frac = upto - prev;
        const vx = prev + frac;
        const vy = realisedAt(prev) + (realisedAt(p) - realisedAt(prev)) * frac;
        d += ` L ${x(vx)} ${y(vy)}`;
        break;
      }
      d += ` L ${x(p)} ${y(realisedAt(p))}`;
    }
    return d;
  };

  const expectedPath = `M ${x(0)} ${y(expectedAt(0))} L ${x(periods)} ${y(
    expectedAt(periods),
  )}`;

  // Animate the realised curve drawing in whenever the swing changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [swingState]);

  const swingPct = Math.round(g * 100);

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
          {startLabel}: {money(currencyPrefix, principal)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {realisedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {expectedLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: with a swing of ${swingPct}% the arithmetic mean is ${pct(
          arithmeticMean,
        )} per period, but the geometric mean is ${pct(
          geometricMean,
        )}, so ${money(currencyPrefix, principal)} compounded over ${periods} alternating periods falls to ${money(
          currencyPrefix,
          finalRealised,
        )}.`}
      >
        {/* Starting baseline */}
        <line
          x1={padX}
          y1={y(principal)}
          x2={W - padX}
          y2={y(principal)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Flat arithmetic-expectation line */}
        <path d={expectedPath} fill="none" stroke="var(--color-accent-500)" strokeWidth={2} />
        {/* Realised compounded curve, animated reveal */}
        <path
          d={realisedPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-swing`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{swingLabel}</span>
          <span className="font-mono text-ink-900">±{swingPct}%</span>
        </label>
        <input
          id={`${id}-swing`}
          type="range"
          min={0}
          max={60}
          step={1}
          value={swingPct}
          onChange={(e) => setSwingState(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{arithmeticLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(arithmeticMean)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{geometricLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(geometricMean)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gapLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">{pct(gap)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default GeometricMeanGap;
