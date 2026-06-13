import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type Algo = 'twap' | 'vwap' | 'pov';

export interface ExecutionScheduleProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the TWAP toggle. */
  twapLabel?: string;
  /** Label for the VWAP toggle. */
  vwapLabel?: string;
  /** Label for the POV toggle. */
  povLabel?: string;
  /** Label for the faint market-volume profile. */
  volumeLabel?: string;
  /** Label for the child-order bars. */
  childLabel?: string;
  /** X-axis label. */
  timeLabel?: string;
  /** Explanation shown for TWAP. */
  twapExplanation?: string;
  /** Explanation shown for VWAP. */
  vwapExplanation?: string;
  /** Explanation shown for POV. */
  povExplanation?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

// A realistic U-shaped intraday volume profile across 13 half-hour buckets:
// heavy at the open, a midday lull, heavy into the close.
const VOLUME = [16, 11, 8, 6, 5, 4.5, 4.5, 5, 6, 8, 11, 15, 22];
const BUCKETS = VOLUME.length;
const VOL_SUM = VOLUME.reduce((a, b) => a + b, 0);

/**
 * Execution-schedule visual. The faint area is the market's U-shaped intraday
 * volume profile (heavy at the open and close, thin midday). The bars are the
 * algorithm's child-order sizes:
 *   • TWAP slices the order into equal pieces by the clock — flat bars that
 *     ignore where the liquidity actually is.
 *   • VWAP front-loads/back-loads to match the historical volume curve, so it
 *     trades more when the market is deep and less in the lull.
 *   • POV (percent-of-volume) tracks the SAME shape but is defined as a fixed
 *     participation rate of whatever volume actually prints.
 * Pure SVG; prefers-reduced-motion respected globally.
 */
export function ExecutionSchedule({
  title = 'Execution schedules: TWAP vs VWAP vs POV',
  twapLabel = 'TWAP',
  vwapLabel = 'VWAP',
  povLabel = 'POV',
  volumeLabel = 'Market volume',
  childLabel = 'Child orders',
  timeLabel = 'Trading day (open → close)',
  twapExplanation = 'TWAP splits the parent order into equal slices by the clock — same size every interval, regardless of where the liquidity is. Simple and predictable, but it over-trades the thin midday lull (paying more impact) and under-trades the deep open and close.',
  vwapExplanation = 'VWAP shapes the slices to the historical volume curve: trade big when the market is deep (open and close), small in the midday lull. Matching the volume profile minimises footprint and tracks the VWAP benchmark — the classic agency-execution default.',
  povExplanation = 'POV (percent-of-volume) fixes a participation rate — say 10% of whatever actually trades — so the schedule reacts to real-time volume instead of a forecast. It naturally tracks the same U-shape, but its end time is uncertain: a quiet day stretches the order out.',
  caption = 'Same parent order, three schedules. TWAP ignores the volume curve (flat bars); VWAP and POV bend to it, trading where the liquidity is so each slice leaves a smaller footprint. The faint area is the market’s own U-shaped volume profile.',
  className,
}: ExecutionScheduleProps) {
  const id = useId();
  const [algo, setAlgo] = useState<Algo>('vwap');

  const W = 520;
  const H = 230;
  const padLeft = 16;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 30;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const slot = plotW / BUCKETS;
  const barW = slot * 0.62;

  // Each algo produces child-order weights summing to 1.
  const weights: number[] = (() => {
    if (algo === 'twap') return VOLUME.map(() => 1 / BUCKETS);
    // VWAP and POV both follow the volume profile shape.
    return VOLUME.map((v) => v / VOL_SUM);
  })();

  const wMax = Math.max(...weights);
  const volMax = Math.max(...VOLUME);

  // Volume profile as a smooth-ish filled area (scaled to ~70% of plot height).
  const volPts = VOLUME.map((v, i) => {
    const x = padLeft + (i + 0.5) * slot;
    const y = padTop + plotH - (v / volMax) * plotH * 0.92;
    return [x, y] as const;
  });
  const volArea =
    `M ${padLeft} ${padTop + plotH} ` +
    volPts.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') +
    ` L ${padLeft + plotW} ${padTop + plotH} Z`;

  const explanation =
    algo === 'twap' ? twapExplanation : algo === 'vwap' ? vwapExplanation : povExplanation;

  const algos: { key: Algo; label: string }[] = [
    { key: 'twap', label: twapLabel },
    { key: 'vwap', label: vwapLabel },
    { key: 'pov', label: povLabel },
  ];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Execution algorithm">
        {algos.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAlgo(a.key)}
            aria-pressed={algo === a.key}
            className={cx(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
              algo === a.key
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300',
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-4 rounded-sm bg-brand-500" aria-hidden="true" />
          {childLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-4 rounded-sm bg-accent-200" aria-hidden="true" />
          {volumeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Child-order schedule for ${algo.toUpperCase()} overlaid on the market's U-shaped intraday volume profile.`}
      >
        {/* volume profile area */}
        <path d={volArea} fill="var(--color-accent-200)" opacity={0.5} />

        {/* child-order bars */}
        {weights.map((w, i) => {
          const h = (w / wMax) * plotH * 0.92;
          const x = padLeft + (i + 0.5) * slot - barW / 2;
          const y = padTop + plotH - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={2}
              fill="var(--color-brand-500)"
              opacity={0.85}
              style={{ transition: 'all 300ms ease' }}
            />
          );
        })}

        {/* baseline */}
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke="var(--color-ink-300)"
        />
        <text x={padLeft + plotW / 2} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {timeLabel}
        </text>
      </svg>

      <p className="mt-3 rounded-card bg-surface-50 px-4 py-3 text-sm leading-relaxed text-ink-700" aria-live="polite">
        {explanation}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ExecutionSchedule;
