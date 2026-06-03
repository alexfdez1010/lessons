import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single price sample along the timeline. */
export interface DepegPoint {
  /** Time position (e.g. day or hour index). Used for the x-axis. */
  day: number;
  /** Market price at that time (e.g. `0.88` for $0.88). */
  price: number;
}

/** A labeled event annotation pinned to a point in time. */
export interface DepegEvent {
  /** Time position (matched to the price series' x-axis). */
  day: number;
  /** Short label shown beside the marker dot. */
  label: string;
}

export interface DepegTimelineProps {
  /** Heading above the chart. */
  title?: string;
  /**
   * Ordered price series (low → high `day`). Defaults to a depeg-and-recover
   * story: a slide to ~$0.88 and a climb back to ~$1.00.
   */
  series?: DepegPoint[];
  /** Labeled event markers pinned to days on the line. */
  events?: DepegEvent[];
  /** The peg the asset is supposed to hold. Defaults to `1`. */
  peg?: number;
  /** Legend / aria label for the price line. */
  priceLabel?: string;
  /** Legend / aria label for the peg reference line. */
  pegLabel?: string;
  /** Readout label for the lowest price reached (the trough). */
  troughLabel?: string;
  /** Readout label for the final price. */
  finalLabel?: string;
  /** Readout label for the deepest depeg depth. */
  depthLabel?: string;
  /** Button label that redraws the line from the start. */
  replayLabel?: string;
  /** One-line story caption shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to price values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const price = (prefix: string, value: number): string =>
  `${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)}`;

/** Signed percent of `value` away from `peg`, rounded to whole percent. */
const pegPct = (value: number, peg: number): number =>
  peg === 0 ? 0 : Math.round(((value - peg) / peg) * 100);

const DEFAULT_SERIES: DepegPoint[] = [
  { day: 0, price: 1.0 },
  { day: 1, price: 0.998 },
  { day: 2, price: 0.985 },
  { day: 3, price: 0.94 },
  { day: 4, price: 0.88 },
  { day: 5, price: 0.905 },
  { day: 6, price: 0.96 },
  { day: 7, price: 0.99 },
  { day: 8, price: 0.999 },
  { day: 9, price: 1.0 },
];

const DEFAULT_EVENTS: DepegEvent[] = [
  { day: 2, label: 'Bad news breaks' },
  { day: 4, label: 'Reserves in doubt' },
  { day: 9, label: 'Repegged' },
];

/**
 * Stablecoin depeg timeline. Plots an asset's market price over time against a
 * dashed reference line at its peg (typically $1.00). The slice between the
 * price line and the peg, wherever the price sits *below* it, is shaded in a
 * warning tint to dramatize the depeg. The price line draws in left-to-right on
 * mount and on the Replay button (progressive point reveal); under
 * `prefers-reduced-motion` it appears instantly and the full final state is
 * always exposed to screen readers. Labeled event markers (passed as props,
 * pinned by `day`) annotate the key moments of the story. Readouts surface the
 * trough price, the final price, and the deepest depeg depth.
 *
 * The price series and events are props so one lesson can pass the
 * USDC-recovers narrative and another the UST terminal-collapse narrative, in
 * either locale.
 */
export function DepegTimeline({
  title = 'Anatomy of a depeg',
  series = DEFAULT_SERIES,
  events = DEFAULT_EVENTS,
  peg = 1,
  priceLabel = 'Market price',
  pegLabel = 'Peg',
  troughLabel = 'Lowest price',
  finalLabel = 'Final price',
  depthLabel = 'Max depeg depth',
  replayLabel = 'Replay',
  caption = 'A stablecoin is only “stable” while the market believes it. Watch the price slip below its $1.00 peg as confidence cracks — and whether it claws its way back.',
  currencyPrefix = '$',
  className,
}: DepegTimelineProps) {
  // Defensive copy, sorted by time so the path is monotonic on x.
  const points =
    series.length > 0
      ? [...series].sort((a, b) => a.day - b.day)
      : DEFAULT_SERIES;

  const [progress, setProgress] = useState(1); // 0 → 1 line draw-in
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 14;
  const padTop = 16;
  const padBottom = 22;

  const minDay = points[0].day;
  const maxDay = points[points.length - 1].day;
  const daySpan = maxDay - minDay || 1;

  const prices = points.map((p) => p.price);
  const troughPrice = Math.min(...prices);
  const finalPrice = points[points.length - 1].price;
  const maxDepthPct = pegPct(troughPrice, peg); // negative when below peg

  // Y bounds: always include the peg, with a little headroom on both sides.
  const rawMax = Math.max(peg, ...prices);
  const rawMin = Math.min(peg, ...prices);
  const span = rawMax - rawMin || peg * 0.1;
  const yMax = rawMax + span * 0.12;
  const yMin = rawMin - span * 0.12;

  const x = (day: number) =>
    padX + ((day - minDay) / daySpan) * (W - padX * 2);
  const y = (v: number) =>
    padTop + (1 - (v - yMin) / (yMax - yMin)) * (H - padTop - padBottom);

  const pegY = y(peg);

  // Interpolate the price at a fractional day (for the moving line head).
  const priceAt = (day: number): number => {
    if (day <= points[0].day) return points[0].price;
    const last = points[points.length - 1];
    if (day >= last.day) return last.price;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      if (day <= b.day) {
        const t = (day - a.day) / (b.day - a.day || 1);
        return a.price + (b.price - a.price) * t;
      }
    }
    return last.price;
  };

  // Price line revealed up to `progress` along the timeline.
  const upToDay = minDay + progress * daySpan;
  const linePath = (): string => {
    let d = `M ${x(points[0].day)} ${y(points[0].price)}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.day > upToDay) {
        d += ` L ${x(upToDay)} ${y(priceAt(upToDay))}`;
        return d;
      }
      d += ` L ${x(p.day)} ${y(p.price)}`;
    }
    return d;
  };

  // Shaded below-peg area: the band between the (revealed) price line and the
  // peg, clipped to where the price sits below the peg. Built by sampling so
  // partial segments crossing the peg shade correctly.
  const belowPegArea = (): string => {
    const samples = 120;
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> | null = null;
    for (let s = 0; s <= samples; s++) {
      const day = minDay + (s / samples) * daySpan;
      if (day > upToDay) break;
      const v = priceAt(day);
      if (v < peg) {
        if (!current) {
          current = [];
          segments.push(current);
        }
        current.push({ x: x(day), y: y(v) });
      } else {
        current = null;
      }
    }
    return segments
      .filter((seg) => seg.length > 1)
      .map((seg) => {
        const top = seg.map((p) => `${p.x} ${p.y}`).join(' L ');
        const firstX = seg[0].x;
        const lastX = seg[seg.length - 1].x;
        return `M ${firstX} ${pegY} L ${top} L ${lastX} ${pegY} Z`;
      })
      .join(' ');
  };

  const runAnimation = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1100;
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
  };

  // Draw in on mount.
  useEffect(() => {
    runAnimation();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedEvents = [...events].sort((a, b) => a.day - b.day);

  // Full-state description for screen readers (independent of animation).
  const ariaSummary = `${title}: ${priceLabel} starts at ${price(
    currencyPrefix,
    points[0].price,
  )}, falls to a low of ${price(currencyPrefix, troughPrice)} (${maxDepthPct}% from the ${price(
    currencyPrefix,
    peg,
  )} ${pegLabel.toLowerCase()}), and ends at ${price(
    currencyPrefix,
    finalPrice,
  )}.`;

  const depthClass = maxDepthPct < 0 ? 'text-warning' : 'text-success';
  const finalClass =
    pegPct(finalPrice, peg) < 0 ? 'text-warning' : 'text-success';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            maxDepthPct < 0 ? 'bg-accent-600' : 'bg-brand-600',
          )}
        >
          {maxDepthPct < 0 ? `${maxDepthPct}%` : price(currencyPrefix, peg)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {priceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0.5 w-5 rounded-pill bg-ink-400"
            aria-hidden="true"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--color-ink-400) 0 4px, transparent 4px 7px)',
            }}
          />
          {pegLabel} ({price(currencyPrefix, peg)})
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaSummary}
      >
        {/* Below-peg shaded area (the depeg) */}
        <path
          d={belowPegArea()}
          fill="var(--color-warning)"
          fillOpacity={0.16}
          stroke="none"
        />

        {/* Peg reference line */}
        <line
          x1={padX}
          y1={pegY}
          x2={W - padX}
          y2={pegY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={W - padX}
          y={pegY - 5}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {pegLabel} {price(currencyPrefix, peg)}
        </text>

        {/* Price line */}
        <path
          d={linePath()}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Event markers (revealed as the line passes them) */}
        {sortedEvents.map((ev, k) => {
          const revealed = ev.day <= upToDay + 1e-6;
          if (!revealed) return null;
          const ex = x(ev.day);
          const ey = y(priceAt(ev.day));
          const below = priceAt(ev.day) < peg;
          // Place the label above the dot when below peg, below when above,
          // to keep it off the line. Flip near the right edge.
          const labelY = below ? ey - 12 : ey + 18;
          const anchor =
            ex > W - 110 ? 'end' : ex < 70 ? 'start' : 'middle';
          return (
            <g key={k}>
              <line
                x1={ex}
                y1={ey}
                x2={ex}
                y2={pegY}
                stroke="var(--color-ink-300)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <circle
                cx={ex}
                cy={ey}
                r={4}
                fill="var(--color-surface)"
                stroke="var(--color-accent-600)"
                strokeWidth={2}
              />
              <text
                x={ex}
                y={labelY}
                textAnchor={anchor}
                fontSize="10.5"
                fontWeight={600}
                fill="var(--color-ink-700)"
              >
                {ev.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Replay */}
      <div className="mt-3">
        <button
          type="button"
          onClick={runAnimation}
          aria-label={replayLabel}
          className="rounded-pill border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {replayLabel}
        </button>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{troughLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-warning">
            {price(currencyPrefix, troughPrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{finalLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', finalClass)}>
            {price(currencyPrefix, finalPrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{depthLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', depthClass)}>
            {maxDepthPct > 0 ? `+${maxDepthPct}%` : `${maxDepthPct}%`}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DepegTimeline;
