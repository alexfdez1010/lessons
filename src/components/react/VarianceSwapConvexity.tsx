import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VarianceSwapConvexityProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the convex variance-swap payoff curve / toggle. */
  varianceLabel?: string;
  /** Label for the linear vol-swap payoff line / toggle. */
  volSwapLabel?: string;
  /** Label for the x-axis (realized volatility). */
  realizedVolLabel?: string;
  /** Label for the y-axis (payoff in vega-equivalent units). */
  payoffLabel?: string;
  /** Label for the strike-vol reference marker. */
  strikeLabel?: string;
  /** Toggle option that shows both payoffs at once. */
  bothLabel?: string;
  /** Explanation shown beneath the chart. */
  note?: string;
  /** Suffix appended to volatility percentages. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

type Mode = 'variance' | 'volswap' | 'both';

// Strike volatility K, in percent.
const K = 20;
// X-axis domain for realized volatility, in percent.
const SIG_MIN = 0;
const SIG_MAX = 40;

// Vol-swap payoff: linear in realized vol, zero at the strike.
const pVol = (sigma: number): number => sigma - K;
// Variance-swap payoff in vega-equivalent units: (σ² − K²) / (2K).
// Tangent to the vol-swap line at σ = K (value 0, slope 1) and convex above it.
const pVar = (sigma: number): number => (sigma * sigma - K * K) / (2 * K);

const fmt = (value: number): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

/**
 * Variance-swap convexity. A **vol swap** pays linearly in realized
 * volatility, `σ − K`, so its payoff is a straight line through the strike. A
 * **variance swap** settles on realized *variance* (volatility squared); in
 * vega-equivalent units its payoff is `(σ² − K²) / (2K)`, which is **tangent**
 * to the vol-swap line at the strike `K` (same value, same slope of 1) but
 * **curves above it everywhere else**. That gap is the convexity: long variance
 * gains *more* when vol spikes up and loses *less* when vol falls, relative to a
 * vol swap struck at the same level — it is structurally long "vol of vol". The
 * pill toggle shows the variance curve, the vol-swap line, or both; the shaded
 * wedge between them visualises the convexity benefit. Opacity transitions
 * honour `motion-reduce`.
 */
export function VarianceSwapConvexity({
  title = 'Variance swap vs vol swap: the convexity of being long variance',
  varianceLabel = 'Variance swap payoff',
  volSwapLabel = 'Vol swap payoff',
  realizedVolLabel = 'Realized volatility',
  payoffLabel = 'Payoff (vega-equivalent units)',
  strikeLabel = 'Strike vol',
  bothLabel = 'Both',
  note = 'A variance swap settles on realized VARIANCE (volatility squared), so its payoff curves upward in vol. Struck to match a vol swap at the strike, it pays MORE than the vol swap when realized vol comes in high and loses LESS when vol comes in low — it is structurally LONG CONVEXITY (long "vol of vol"). That convexity is why dealers quote variance-swap strikes slightly ABOVE at-the-money implied vol: the buyer is getting a convex payoff and pays for it. A variance swap can also be replicated by a static portfolio of options across all strikes, weighted 1/K², which is the link to the VIX.',
  percentSuffix = '%',
  className,
}: VarianceSwapConvexityProps) {
  const [mode, setMode] = useState<Mode>('both');

  const showVar = mode === 'variance' || mode === 'both';
  const showVol = mode === 'volswap' || mode === 'both';

  const W = 520;
  const H = 260;
  const padX = 40;
  const padY = 24;

  // Payoff domain must cover both curves' extremes over [SIG_MIN, SIG_MAX]:
  // the vol swap bottoms out at pVol(0) = -20 and the variance swap tops out
  // at pVar(40) = +30. Use those, with a touch of headroom.
  const minP = pVol(SIG_MIN); // -20 (lowest point of either payoff)
  const maxP = pVar(SIG_MAX); // +30 (highest point of either payoff)

  const x = (sigma: number) =>
    padX + ((sigma - SIG_MIN) / (SIG_MAX - SIG_MIN)) * (W - padX * 2);
  const y = (p: number) =>
    padY + (1 - (p - minP) / (maxP - minP)) * (H - padY * 2);

  // Sample the smooth variance curve.
  const steps = 48;
  const varPts = Array.from({ length: steps + 1 }, (_, i) => {
    const sigma = SIG_MIN + (i / steps) * (SIG_MAX - SIG_MIN);
    return { sigma, p: pVar(sigma) };
  });

  const varPath = varPts
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${x(pt.sigma).toFixed(1)} ${y(pt.p).toFixed(1)}`)
    .join(' ');

  // Vol-swap line spans the same domain.
  const volPath = `M ${x(SIG_MIN).toFixed(1)} ${y(pVol(SIG_MIN)).toFixed(1)} L ${x(SIG_MAX).toFixed(1)} ${y(pVol(SIG_MAX)).toFixed(1)}`;

  // Convexity wedge: variance curve out, vol-swap line back, closed.
  const wedgePath = `${varPath} L ${x(SIG_MAX).toFixed(1)} ${y(pVol(SIG_MAX)).toFixed(1)} L ${x(SIG_MIN).toFixed(1)} ${y(pVol(SIG_MIN)).toFixed(1)} Z`;

  // Sample vols for the concrete stat line.
  const samples = [10, 35];

  const ticks = [0, 10, 20, 30, 40];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div
          className="inline-flex rounded-pill border border-ink-200 p-0.5"
          role="group"
        >
          <button
            type="button"
            onClick={() => setMode('variance')}
            aria-pressed={mode === 'variance'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'variance'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {varianceLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('volswap')}
            aria-pressed={mode === 'volswap'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'volswap'
                ? 'bg-accent-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {volSwapLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('both')}
            aria-pressed={mode === 'both'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'both'
                ? 'bg-ink-900 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {bothLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. The vol-swap payoff is a straight line, ${volSwapLabel} = realized vol minus the ${strikeLabel} of ${K}${percentSuffix}. The variance-swap payoff is a convex curve tangent to that line at the strike and lying above it everywhere else; the gap between them is the convexity benefit of being long variance.`}
      >
        {/* Convexity wedge between the two payoffs */}
        {mode === 'both' && (
          <path
            d={wedgePath}
            fill="var(--color-brand-500)"
            fillOpacity={0.12}
            stroke="none"
          />
        )}

        {/* Zero payoff line */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
        />
        <text
          x={padX - 6}
          y={y(0) + 3}
          textAnchor="end"
          fontSize={10}
          fill="var(--color-ink-400)"
        >
          0
        </text>

        {/* Vertical dashed strike line */}
        <line
          x1={x(K)}
          y1={padY}
          x2={x(K)}
          y2={H - padY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={x(K)}
          y={padY - 8}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--color-ink-500)"
        >
          {strikeLabel} {K}
          {percentSuffix}
        </text>

        {/* Vol-swap straight line */}
        <path
          d={volPath}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={3}
          strokeLinecap="round"
          className={cx(
            'transition-opacity duration-500 motion-reduce:transition-none',
            showVol ? 'opacity-100' : 'opacity-0',
          )}
        />

        {/* Variance-swap convex curve */}
        <path
          d={varPath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className={cx(
            'transition-opacity duration-500 motion-reduce:transition-none',
            showVar ? 'opacity-100' : 'opacity-0',
          )}
        />

        {/* Tangent point at (K, 0) where the two payoffs touch */}
        <circle
          cx={x(K)}
          cy={y(0)}
          r={4.5}
          fill="var(--color-surface)"
          stroke="var(--color-ink-700)"
          strokeWidth={2}
        />
        <text
          x={x(K) + 8}
          y={y(0) + 16}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-ink-600)"
        >
          tangent
        </text>

        {/* Curve end labels */}
        <text
          x={x(SIG_MAX)}
          y={y(pVar(SIG_MAX)) - 6}
          textAnchor="end"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-brand-600)"
          className={cx(
            'transition-opacity duration-500 motion-reduce:transition-none',
            showVar ? 'opacity-100' : 'opacity-0',
          )}
        >
          {varianceLabel}
        </text>
        <text
          x={x(SIG_MAX)}
          y={y(pVol(SIG_MAX)) + 14}
          textAnchor="end"
          fontSize={10}
          fontWeight={600}
          fill="var(--color-accent-600)"
          className={cx(
            'transition-opacity duration-500 motion-reduce:transition-none',
            showVol ? 'opacity-100' : 'opacity-0',
          )}
        >
          {volSwapLabel}
        </text>

        {/* X-axis ticks */}
        {ticks.map((tk) => (
          <text
            key={tk}
            x={x(tk)}
            y={H - padY + 14}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
          >
            {tk}
            {percentSuffix}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 1}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {realizedVolLabel}
        </text>
        <text
          x={padX - 6}
          y={padY - 10}
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {payoffLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {samples.map((sigma) => {
          const v = pVar(sigma);
          const l = pVol(sigma);
          return (
            <span key={sigma} className="text-ink-600">
              At {sigma}
              {percentSuffix} vol:{' '}
              <span className="font-medium text-brand-600">{fmt(v)}</span>{' '}
              {varianceLabel.toLowerCase()} vs{' '}
              <span className="font-medium text-accent-600">{fmt(l)}</span>{' '}
              {volSwapLabel.toLowerCase()}
            </span>
          );
        })}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {note}
      </p>
    </figure>
  );
}

export default VarianceSwapConvexity;
