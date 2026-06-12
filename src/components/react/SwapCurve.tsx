import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SwapCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + line label for the par swap-rate series. */
  parRateLabel?: string;
  /** Legend + line label for the implied forward series. */
  forwardLabel?: string;
  /** Label for the upward-sloping ("Normal") mode button. */
  normalLabel?: string;
  /** Label for the downward-sloping ("Inverted") mode button. */
  invertedLabel?: string;
  /** Label for the toggle that overlays the implied-forward curve. */
  showForwardLabel?: string;
  /** Label for the x-axis (swap tenor in years). */
  tenorAxisLabel?: string;
  /** Label for the y-axis (rate). */
  rateAxisLabel?: string;
  /** Explanation shown in Normal (upward-sloping) mode. */
  normalNote?: string;
  /** Explanation shown in Inverted (downward-sloping) mode. */
  invertedNote?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(2)}${suffix}`;

/**
 * The swap curve and its implied forwards. The **par swap curve** is the term
 * structure of fixed rates that price a vanilla interest-rate swap to zero at
 * each tenor — what a 2y, 5y or 30y swap quotes today. The **implied forward
 * curve** is what those par rates predict the short rate must be in each future
 * period to make the longer rates internally consistent.
 *
 * The teaching point: when the par curve slopes **up**, the forward curve sits
 * **above** it — each new forward has to exceed the running average to drag that
 * average higher. When the par curve is **inverted**, the forwards sit **below**
 * it for the mirror reason. Toggle Normal/Inverted to redraw the par curve (the
 * `<path>` re-keys on mode so the transition restarts), and flip the forward
 * overlay to compare.
 *
 * The forward approximation: par rates are treated as zero-rate proxies and the
 * implied one-period forward between consecutive listed tenors is
 * `f ≈ ((1+r_t)^t / (1+r_{t-1})^{t-1})^(1/(t - t_{prev})) − 1`. The grid is
 * uneven (1,2,3,5,7,10,20,30), so this is an annualised approximation across
 * each gap, not an exact bootstrap — it is plenty to show forwards-above /
 * forwards-below, which is the lesson.
 */
export function SwapCurve({
  title = 'The swap curve and its implied forwards',
  parRateLabel = 'Par swap rate',
  forwardLabel = 'Implied 1y forward',
  normalLabel = 'Normal',
  invertedLabel = 'Inverted',
  showForwardLabel = 'Show implied forwards',
  tenorAxisLabel = 'Swap tenor (years)',
  rateAxisLabel = 'Rate',
  normalNote = 'Upward-sloping par curve: each longer swap rate is an average of the short rates expected over its life, so to keep dragging that average higher the implied 1y forwards must sit above the par curve. Forwards lead; par follows.',
  invertedNote = 'Inverted par curve: longer swaps lock in lower rates, which is only possible if the market expects the short rate to fall. The implied 1y forwards drop below the par curve to pull the running average down. Forwards lag below par.',
  percentSuffix = '%',
  className,
}: SwapCurveProps) {
  const [mode, setMode] = useState<'normal' | 'inverted'>('normal');
  const [showForward, setShowForward] = useState(true);

  // Listed swap tenors (years) on an uneven grid.
  const tenors = [1, 2, 3, 5, 7, 10, 20, 30];
  const normal = [3.2, 3.6, 3.9, 4.2, 4.4, 4.6, 4.8, 4.9];
  const inverted = [5.2, 5.0, 4.8, 4.5, 4.2, 4.0, 3.7, 3.6];
  const par = mode === 'normal' ? normal : inverted;

  // Implied forwards. Treat par rates (in %) as zero-rate proxies, build the
  // total growth factor (1 + r)^t to each tenor, then annualise the marginal
  // growth over each gap: f = (growth_t / growth_{t-1})^(1/Δt) − 1. The first
  // tenor's "forward" is just its own par rate (no prior point to imply from).
  const growth = par.map((r, i) => Math.pow(1 + r / 100, tenors[i]));
  const forward = par.map((r, i) => {
    if (i === 0) return r;
    const dt = tenors[i] - tenors[i - 1];
    const f = Math.pow(growth[i] / growth[i - 1], 1 / dt) - 1;
    return f * 100;
  });

  const W = 560;
  const H = 260;
  const padX = 44;
  const padY = 28;
  // Fixed rate window so both modes and both series share one scale.
  const minV = 2.8;
  const maxV = 6.4;

  const x = (i: number) => padX + (i / (tenors.length - 1)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const toPath = (series: number[]) =>
    series
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ');

  const parPath = toPath(par);
  const forwardPath = toPath(forward);

  // Gridline rates across the y-axis.
  const gridRates = [3, 4, 5, 6];

  const ariaLabel =
    `${title}: the par swap curve is ${mode === 'normal' ? 'upward-sloping' : 'inverted'}, ` +
    `running from ${pct(par[0], percentSuffix)} at ${tenors[0]} years to ` +
    `${pct(par[par.length - 1], percentSuffix)} at ${tenors[tenors.length - 1]} years. ` +
    (showForward
      ? `The implied 1-year forward curve lies ${mode === 'normal' ? 'above' : 'below'} the par curve.`
      : 'The implied forward overlay is hidden.');

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
            onClick={() => setMode('normal')}
            aria-pressed={mode === 'normal'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'normal'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {normalLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('inverted')}
            aria-pressed={mode === 'inverted'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'inverted'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {invertedLabel}
          </button>
        </div>
      </figcaption>

      {/* Forward-overlay toggle */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowForward((s) => !s)}
          aria-pressed={showForward}
          className={cx(
            'inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
            showForward
              ? 'border-accent-500 bg-accent-500/10 text-accent-600'
              : 'border-ink-200 text-ink-600 hover:text-ink-900',
          )}
        >
          <span
            className={cx(
              'h-3 w-3 rounded-full border-2',
              showForward
                ? 'border-accent-500 bg-accent-500'
                : 'border-ink-300 bg-transparent',
            )}
            aria-hidden="true"
          />
          {showForwardLabel}
        </button>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <svg width={22} height={8} aria-hidden="true">
            <line
              x1={0}
              y1={4}
              x2={22}
              y2={4}
              stroke="var(--color-brand-500)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </svg>
          {parRateLabel}
        </span>
        {showForward && (
          <span className="inline-flex items-center gap-2 text-ink-700">
            <svg width={22} height={8} aria-hidden="true">
              <line
                x1={0}
                y1={4}
                x2={22}
                y2={4}
                stroke="var(--color-accent-500)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="5 4"
              />
            </svg>
            {forwardLabel}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Horizontal gridlines + rate ticks */}
        {gridRates.map((r) => (
          <g key={`grid-${r}`}>
            <line
              x1={padX}
              y1={y(r)}
              x2={W - padX}
              y2={y(r)}
              stroke="var(--color-ink-200)"
              strokeWidth={1}
              strokeDasharray="3 5"
            />
            <text
              x={padX - 8}
              y={y(r) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-500)"
              fontFamily="var(--font-mono)"
            >
              {pct(r, percentSuffix)}
            </text>
          </g>
        ))}

        {/* Implied forward curve (dashed, accent). Drawn first so the par
            curve sits on top. Re-keyed on mode so the transition restarts. */}
        {showForward && (
          <path
            key={`fwd-${mode}`}
            d={forwardPath}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth={2.5}
            strokeDasharray="6 5"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="transition-all duration-500 motion-reduce:transition-none"
          />
        )}

        {/* Par swap curve (solid, brand). Re-keyed on mode. */}
        <path
          key={`par-${mode}`}
          d={parPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Forward dots */}
        {showForward &&
          forward.map((v, i) => (
            <circle
              key={`fdot-${i}`}
              cx={x(i)}
              cy={y(v)}
              r={3}
              fill="var(--color-accent-600)"
              stroke="white"
              strokeWidth={1.5}
              className="transition-all duration-500 motion-reduce:transition-none"
            />
          ))}

        {/* Par dots */}
        {par.map((v, i) => (
          <circle
            key={`pdot-${i}`}
            cx={x(i)}
            cy={y(v)}
            r={3.5}
            fill="var(--color-brand-600)"
            stroke="white"
            strokeWidth={1.5}
            className="transition-all duration-500 motion-reduce:transition-none"
          />
        ))}

        {/* Tenor ticks */}
        {tenors.map((t, i) => (
          <text
            key={`tick-${t}`}
            x={x(i)}
            y={H - padY + 16}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-500)"
            fontFamily="var(--font-mono)"
          >
            {t}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {tenorAxisLabel}
        </text>
        <text x={padX - 8} y={padY - 12} fontSize={11} fill="var(--color-ink-500)">
          {rateAxisLabel}
        </text>
      </svg>

      <p
        className="mt-3 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
      >
        {mode === 'normal' ? normalNote : invertedNote}
      </p>
    </figure>
  );
}

export default SwapCurve;
