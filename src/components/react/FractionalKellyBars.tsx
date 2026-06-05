import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface FractionalKellyBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the Kelly-fraction slider. */
  fractionLabel?: string;
  /** Snap label shown at k = 0.5. */
  halfKellyLabel?: string;
  /** Snap label shown at k = 1.0. */
  fullKellyLabel?: string;
  /** Snap label shown for k > 1. */
  overBettingLabel?: string;
  /** Label for the growth bar / readout. */
  growthLabel?: string;
  /** Label for the volatility bar / readout. */
  volatilityLabel?: string;
  /**
   * Verdict for k ≤ 1. `{growth}` and `{vol}` are replaced with the percentages.
   */
  fractionalVerdict?: string;
  /** Verdict for k > 1 (over-betting). */
  overBettingVerdict?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial Kelly fraction (0–2). Defaults to `0.5` (half Kelly). */
  fraction?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Growth as a fraction of the maximum: G(k·f*) / G(f*) = k·(2 − k). */
const growthFraction = (k: number): number => Math.max(0, k * (2 - k));

/** Volatility scales linearly with the Kelly fraction. */
const relativeVolatility = (k: number): number => k;

const fill = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);

/**
 * Interactive full-vs-fractional Kelly trade-off. The learner drags the Kelly
 * fraction k from 0 to 2.0 and watches two horizontal bars react: growth (as a
 * percentage of the maximum, a downward parabola peaking at full Kelly) and
 * volatility (which rises in a straight line). The point lands hard at half
 * Kelly — about three-quarters of the growth for half the swings — and shows
 * that over-betting (k > 1) is strictly worse: less growth AND more risk. Bars
 * animate their width on every change; respects `prefers-reduced-motion`
 * (snaps straight to the final widths).
 */
export function FractionalKellyBars({
  title = 'Half Kelly: most of the growth, half the swings',
  fractionLabel = 'Kelly fraction k',
  halfKellyLabel = 'Half Kelly',
  fullKellyLabel = 'Full Kelly',
  overBettingLabel = 'Over-betting',
  growthLabel = 'Growth (% of max)',
  volatilityLabel = 'Volatility (relative)',
  fractionalVerdict = 'keeps {growth}% of the growth at {vol}% of the risk',
  overBettingVerdict = 'over-betting: less growth AND more risk',
  caption = 'Full Kelly is the growth-maximising bet — but it swings violently. Because growth falls only gently around the peak while risk falls in a straight line, most pros bet a fraction of Kelly: half-Kelly keeps about three-quarters of the growth for half the volatility. Betting more than full Kelly is never worth it — you give up growth AND take on more risk.',
  fraction = 0.5,
  className,
}: FractionalKellyBarsProps) {
  const id = useId();
  const [k, setK] = useState(fraction);
  const [animate, setAnimate] = useState(true);
  const firstRender = useRef(true);

  // Disable CSS width transitions when reduced motion is requested.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (prefersReducedMotion()) setAnimate(false);
    }
  }, []);

  const growth = growthFraction(k) * 100; // 0 → 100
  const vol = relativeVolatility(k) * 100; // 0 → 200
  const growthPct = Math.round(growth);
  const volPct = Math.round(vol);
  const volWidthPct = Math.min(100, (vol / 200) * 100); // bar caps at 200%

  const snapLabel =
    k > 1 ? overBettingLabel : k >= 0.9 ? fullKellyLabel : k >= 0.4 && k <= 0.6 ? halfKellyLabel : '';

  const verdict =
    k > 1
      ? overBettingVerdict
      : fill(fractionalVerdict, { growth: String(growthPct), vol: String(volPct) });

  const W = 520;
  const H = 180;
  const padX = 12;
  const padTop = 18;
  const barH = 38;
  const gap = 34;
  const trackW = W - padX * 2;

  const growthY = padTop;
  const volY = padTop + barH + gap;
  const growthW = (growth / 100) * trackW;
  const volW = (volWidthPct / 100) * trackW;
  const tickX = padX + trackW; // 100% growth reference

  const barTransition = animate ? 'width 600ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none';

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
          k = {k.toFixed(2)}× {snapLabel ? `· ${snapLabel}` : ''}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {growthLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {volatilityLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: at ${k.toFixed(
          2,
        )} times full Kelly you keep ${growthPct}% of the maximum growth at ${volPct}% of the volatility.`}
      >
        {/* Growth bar track */}
        <rect
          x={padX}
          y={growthY}
          width={trackW}
          height={barH}
          rx={8}
          fill="var(--color-ink-200)"
          opacity={0.4}
        />
        {/* Growth bar fill */}
        <rect
          x={padX}
          y={growthY}
          width={growthW}
          height={barH}
          rx={8}
          fill="var(--color-brand-500)"
          style={{ transition: barTransition }}
        />
        {/* 100% growth reference tick */}
        <line
          x1={tickX}
          y1={growthY - 6}
          x2={tickX}
          y2={growthY + barH + 6}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />

        {/* Volatility bar track */}
        <rect
          x={padX}
          y={volY}
          width={trackW}
          height={barH}
          rx={8}
          fill="var(--color-ink-200)"
          opacity={0.4}
        />
        {/* Volatility bar fill */}
        <rect
          x={padX}
          y={volY}
          width={volW}
          height={barH}
          rx={8}
          fill="var(--color-accent-500)"
          style={{ transition: barTransition }}
        />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-k`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{fractionLabel}</span>
          <span className="font-mono text-ink-900">{k.toFixed(2)}×</span>
        </label>
        <input
          id={`${id}-k`}
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={k}
          onChange={(e) => setK(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500" aria-hidden="true">
          <span>0.5× · {halfKellyLabel}</span>
          <span>1.0× · {fullKellyLabel}</span>
          <span>{overBettingLabel}</span>
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{growthLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{growthPct}%</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{volatilityLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{volPct}%</dd>
        </div>
        <div className="col-span-2 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{snapLabel || fractionLabel}</dt>
          <dd className="font-medium text-ink-900">{verdict}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default FractionalKellyBars;
