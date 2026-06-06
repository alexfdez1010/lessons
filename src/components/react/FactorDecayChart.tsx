import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single (time, value) sample on a factor's premium path. */
export interface FactorDecayPoint {
  /** Years relative to publication: negative = before, 0 = publication date. */
  t: number;
  /** The factor's average return / premium at that time (e.g. percent per year). */
  value: number;
}

/** One factor's premium series across in-sample and out-of-sample years. */
export interface FactorDecaySeries {
  /** Display name of the factor (e.g. "Value", "Momentum"). */
  label: string;
  /** Ordered samples; mix negative (pre-publication) and ≥0 (post-publication) `t`. */
  points: FactorDecayPoint[];
}

export interface FactorDecayChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Factor premium series to plot (1–3 supported, each in a distinct token color). */
  series: FactorDecaySeries[];
  /** X-axis label. Defaults to `'Years relative to publication'`. */
  xLabel?: string;
  /** Y-axis label. Defaults to `'Average premium (% / yr)'`. */
  yLabel?: string;
  /** Label on the vertical divider at t = 0. Defaults to `'Published'`. */
  publishedLabel?: string;
  /** Caption for the in-sample (pre-publication) region. Defaults to `'In-sample'`. */
  inSampleLabel?: string;
  /** Caption for the out-of-sample (post-publication) region. Defaults to `'Out-of-sample'`. */
  outSampleLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Token colours used, in order, for up to three series. */
const SERIES_COLORS = [
  'var(--color-brand-500)',
  'var(--color-accent-500)',
  'var(--color-ink-700)',
] as const;

/** Tailwind background classes mirroring `SERIES_COLORS` for legend swatches. */
const SERIES_SWATCH = ['bg-brand-500', 'bg-accent-500', 'bg-ink-700'] as const;

const fmtPremium = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(1);

/** Average of a list of numbers (0 when empty). */
const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Animated factor-decay chart. Each series is a factor's average premium plotted
 * against time relative to its academic publication date (t = 0). A vertical
 * "Published" divider splits the in-sample (pre-publication) era on the left from
 * the out-of-sample (post-publication) era on the right, which is shaded to
 * highlight where the premium decays. On scroll into view the lines draw
 * left-to-right via `stroke-dashoffset`; `prefers-reduced-motion` renders the
 * final lines instantly.
 *
 * Teaching point: published anomalies tend to shrink by roughly a third to a half
 * out-of-sample (McLean & Pontiff, 2016) — the rest eaten by arbitrage/crowding
 * and statistical over-fitting (data mining). All values come from props; the
 * component bakes in no lesson numbers.
 */
export function FactorDecayChart({
  title = 'Factor decay after publication',
  series,
  xLabel = 'Years relative to publication',
  yLabel = 'Average premium (% / yr)',
  publishedLabel = 'Published',
  inSampleLabel = 'In-sample',
  outSampleLabel = 'Out-of-sample',
  caption = 'A factor looks strong in the years before it is published. Once the paper is out, arbitrageurs pile in and over-fit edges evaporate — so the average premium steps down out-of-sample.',
  className,
}: FactorDecayChartProps) {
  const id = useId();
  const figureRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0); // 0 → 1 (line draw-in)

  const W = 520;
  const H = 240;
  const padX = 36; // room for the y-axis label / first point
  const padTop = 18;
  const padBottom = 30; // room for the x-axis label

  // Keep only series with at least two points; cap at three colours.
  const visibleSeries = useMemo(
    () => series.filter((s) => s.points.length >= 2).slice(0, SERIES_COLORS.length),
    [series],
  );

  // Sort each series by time so the path draws monotonically left-to-right.
  const sortedSeries = useMemo(
    () =>
      visibleSeries.map((s) => ({
        ...s,
        points: [...s.points].sort((a, b) => a.t - b.t),
      })),
    [visibleSeries],
  );

  // Axis ranges spanning every point across every series, with headroom.
  const { tMin, tMax, vMin, vMax } = useMemo(() => {
    const ts: number[] = [];
    const vs: number[] = [];
    for (const s of sortedSeries) {
      for (const p of s.points) {
        ts.push(p.t);
        vs.push(p.value);
      }
    }
    // Always include t = 0 (the publication divider) in the x-range.
    ts.push(0);
    const rawTMin = Math.min(...ts);
    const rawTMax = Math.max(...ts);
    const rawVMin = Math.min(...vs, 0);
    const rawVMax = Math.max(...vs, 0);
    const vPad = (rawVMax - rawVMin) * 0.1 || 1;
    return {
      tMin: rawTMin,
      tMax: rawTMax === rawTMin ? rawTMin + 1 : rawTMax,
      vMin: rawVMin - vPad,
      vMax: rawVMax + vPad,
    };
  }, [sortedSeries]);

  const x = (t: number) =>
    padX + ((t - tMin) / (tMax - tMin)) * (W - padX * 2);
  const y = (v: number) =>
    padTop + (1 - (v - vMin) / (vMax - vMin)) * (H - padTop - padBottom);

  const publishedX = x(0);
  const zeroY = y(0);

  // Build a polyline path string for a series.
  const pathFor = (pts: FactorDecayPoint[]): string =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t)} ${y(p.value)}`)
      .join(' ');

  // Per-series in-sample vs out-of-sample averages, for the a11y summary.
  const summaries = useMemo(
    () =>
      sortedSeries.map((s) => {
        const inSample = mean(s.points.filter((p) => p.t < 0).map((p) => p.value));
        const outSample = mean(s.points.filter((p) => p.t >= 0).map((p) => p.value));
        const drop = inSample !== 0 ? 1 - outSample / inSample : 0;
        return { label: s.label, inSample, outSample, drop };
      }),
    [sortedSeries],
  );

  const ariaSummary = useMemo(() => {
    const parts = summaries.map(
      (s) =>
        `${s.label}: ${inSampleLabel} ${fmtPremium(s.inSample)}, ${outSampleLabel} ${fmtPremium(
          s.outSample,
        )}.`,
    );
    return `${title}. ${parts.join(' ')}`;
  }, [summaries, inSampleLabel, outSampleLabel, title]);

  // Draw the lines in on scroll into view (once). Respect reduced motion.
  useEffect(() => {
    const node = figureRef.current;
    if (node === null) return;

    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }

    let started = false;
    const animate = () => {
      if (started) return;
      started = true;
      const duration = 1100;
      let startTs: number | null = null;
      const step = (ts: number) => {
        if (startTs === null) startTs = ts;
        const p = Math.min(1, (ts - startTs) / duration);
        setProgress(p);
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    if (typeof IntersectionObserver !== 'function') {
      animate();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animate();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (sortedSeries.length === 0) {
    throw new Error(
      'FactorDecayChart: `series` must contain at least one series with two or more points.',
    );
  }

  return (
    <figure
      ref={figureRef}
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {publishedLabel}: t = 0
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        {sortedSeries.map((s, i) => (
          <span
            key={`${s.label}-${i}`}
            className="inline-flex items-center gap-2 text-ink-700"
          >
            <span
              className={cx('h-1 w-5 rounded-pill', SERIES_SWATCH[i])}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-5 rounded-sm bg-accent-500/15"
            aria-hidden="true"
          />
          {outSampleLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaSummary}
      >
        {/* Out-of-sample region shading (post-publication) */}
        <rect
          x={publishedX}
          y={padTop}
          width={Math.max(0, W - padX - publishedX)}
          height={H - padTop - padBottom}
          fill="var(--color-accent-500)"
          opacity={0.08}
        />

        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* x-axis */}
        <line
          x1={padX}
          y1={H - padBottom}
          x2={W - padX}
          y2={H - padBottom}
          stroke="var(--color-ink-200)"
        />

        {/* "Published" vertical divider at t = 0 */}
        <line
          x1={publishedX}
          y1={padTop}
          x2={publishedX}
          y2={H - padBottom}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={publishedX}
          y={padTop - 4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--color-ink-700)"
        >
          {publishedLabel}
        </text>

        {/* Region captions */}
        <text
          x={(padX + publishedX) / 2}
          y={H - padBottom - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-400)"
        >
          {inSampleLabel}
        </text>
        <text
          x={(publishedX + (W - padX)) / 2}
          y={H - padBottom - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-accent-600)"
        >
          {outSampleLabel}
        </text>

        {/* Series lines, drawn left-to-right via stroke-dashoffset */}
        {sortedSeries.map((s, i) => (
          <AnimatedLine
            key={`${s.label}-${i}`}
            d={pathFor(s.points)}
            color={SERIES_COLORS[i]}
            progress={progress}
          />
        ))}

        {/* Endpoint markers */}
        {sortedSeries.map((s, i) => {
          const last = s.points[s.points.length - 1];
          if (progress < 0.999) return null;
          return (
            <circle
              key={`marker-${s.label}-${i}`}
              cx={x(last.t)}
              cy={y(last.value)}
              r={4}
              fill={SERIES_COLORS[i]}
              stroke="var(--color-surface, #fff)"
              strokeWidth={2}
            />
          );
        })}

        {/* y-axis label (rotated) */}
        <text
          transform={`translate(12 ${(padTop + (H - padBottom)) / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          {yLabel}
        </text>
        {/* x-axis label */}
        <text
          x={(padX + (W - padX)) / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          {xLabel}
        </text>
      </svg>

      {/* Per-series readouts: in-sample vs out-of-sample averages */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        {summaries.map((s, i) => (
          <div
            key={`${s.label}-readout-${i}`}
            className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2"
          >
            <dt className="flex items-center gap-2 text-ink-500">
              <span
                className={cx('h-2 w-2 rounded-pill', SERIES_SWATCH[i])}
                aria-hidden="true"
              />
              {s.label}
            </dt>
            <dd className="mt-1 font-mono text-sm text-ink-900">
              <span className="font-semibold text-ink-700">
                {fmtPremium(s.inSample)}
              </span>
              <span className="px-1 text-ink-400" aria-hidden="true">
                →
              </span>
              <span className="font-semibold text-accent-600">
                {fmtPremium(s.outSample)}
              </span>
            </dd>
            <dd className="text-xs text-ink-500">
              {inSampleLabel} → {outSampleLabel}
            </dd>
          </div>
        ))}
      </dl>

      <p id={`${id}-caption`} className="mt-3 text-sm leading-relaxed text-ink-600">
        {caption}
      </p>
    </figure>
  );
}

/**
 * A single factor line that reveals left-to-right by animating its
 * `stroke-dashoffset` from full length down to zero as `progress` goes 0 → 1.
 * Uses the path's own measured length so the reveal tracks the real geometry.
 */
function AnimatedLine({
  d,
  color,
  progress,
}: {
  d: string;
  color: string;
  progress: number;
}) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, [d]);

  // Before we know the length, fall back to a large number so nothing flashes.
  const dash = length || 1000;

  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={dash}
      strokeDashoffset={dash * (1 - progress)}
    />
  );
}

export default FactorDecayChart;
