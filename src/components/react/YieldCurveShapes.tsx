import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

type Shape = 'normal' | 'flat' | 'inverted';

export interface YieldCurveShapesProps {
  /** Heading above the chart. */
  title?: string;
  /** Toggle label for the upward-sloping (normal) curve. */
  normalLabel?: string;
  /** Toggle label for the flat curve. */
  flatLabel?: string;
  /** Toggle label for the downward-sloping (inverted) curve. */
  invertedLabel?: string;
  /** Label for the x (maturity) axis. */
  maturityAxisLabel?: string;
  /** Label for the y (yield) axis. */
  yieldAxisLabel?: string;
  /** Label for the 10y-minus-3m spread readout. */
  spreadLabel?: string;
  /** Label for the short-rate (3m) readout. */
  shortLabel?: string;
  /** Label for the long-rate (10y) readout. */
  longLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Interpretation text for a positive (upward) spread. */
  normalInterpretation?: string;
  /** Interpretation text for a roughly flat spread. */
  flatInterpretation?: string;
  /** Interpretation text for a negative (inverted) spread. */
  invertedInterpretation?: string;
  /** Maturity tick labels, left → right. Defaults to a 6-point ladder. */
  maturityTicks?: string[];
  /** Which shape to show first. Defaults to `'normal'`. */
  shape?: Shape;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;

const signedPct = (value: number): string => {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}%`;
};

const DEFAULT_TICKS = ['3m', '1y', '2y', '5y', '10y', '30y'];

// Plausible yields (%) at each of the 6 maturities, per shape.
const YIELDS: Record<Shape, number[]> = {
  normal: [3.6, 4.0, 4.3, 4.7, 5.0, 5.3],
  flat: [4.5, 4.5, 4.55, 4.5, 4.5, 4.55],
  inverted: [5.4, 5.1, 4.8, 4.4, 4.1, 3.9],
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Catmull-Rom → cubic Bézier so the curve passes smoothly through every point. */
const smoothPath = (pts: Array<{ x: number; y: number }>): string => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
};

/**
 * Interactive yield curve that morphs between the three classic shapes —
 * **normal** (upward), **flat**, and **inverted** (downward). It plots yield
 * against *maturity* for a single issuer at one moment, with dots at each
 * tenor, gridlines and axis ticks. Switching shapes tweens the whole curve and
 * its dots between states, and the readouts show the short rate (3m), the long
 * rate (10y), and the 10y−3m spread with a sign and a one-line interpretation —
 * driving home that an inverted curve (negative spread) is the classic
 * recession signal. Respects `prefers-reduced-motion` (jumps to the final shape).
 */
export function YieldCurveShapes({
  title = 'The three shapes of the yield curve',
  normalLabel = 'Normal',
  flatLabel = 'Flat',
  invertedLabel = 'Inverted',
  maturityAxisLabel = 'Maturity',
  yieldAxisLabel = 'Yield',
  spreadLabel = '10y − 3m spread',
  shortLabel = 'Short rate (3m)',
  longLabel = 'Long rate (10y)',
  caption = 'The yield curve plots one issuer’s yields against maturity at a single moment. It usually slopes up (normal); when long rates fall below short rates it inverts — a classic recession warning.',
  normalInterpretation = 'Upward-sloping: longer money pays more — the healthy, everyday shape.',
  flatInterpretation = 'Flat: short and long rates roughly match — markets are undecided.',
  invertedInterpretation = 'Inverted: long rates below short rates — a classic recession signal.',
  maturityTicks = DEFAULT_TICKS,
  shape = 'normal',
  className,
}: YieldCurveShapesProps) {
  const [shapeState, setShapeState] = useState<Shape>(shape);
  const [t, setT] = useState(1); // tween progress 0 → 1
  const fromRef = useRef<number[]>(YIELDS[shape]);
  const toRef = useRef<number[]>(YIELDS[shape]);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 34;

  const ticks = maturityTicks.length ? maturityTicks : DEFAULT_TICKS;
  const n = ticks.length;

  // Fixed y-scale so the morph reads as the curve changing, not the axis.
  const yMin = 3.0;
  const yMax = 6.0;
  const yGrid = [3, 4, 5, 6];

  const px = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const py = (v: number) =>
    padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);

  // Current interpolated yields. Falls back to target shape if tick count
  // differs from the built-in 6-point arrays.
  const curve = (): number[] => {
    const base = YIELDS[shapeState];
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const target = base[i] ?? base[base.length - 1];
      const from = fromRef.current[i] ?? fromRef.current[fromRef.current.length - 1];
      const to = toRef.current[i] ?? toRef.current[toRef.current.length - 1];
      out.push(n === 6 ? lerp(from, to, t) : target);
    }
    return out;
  };

  const values = curve();
  const points = values.map((v, i) => ({ x: px(i), y: py(v) }));

  const shortRate = values[0];
  const longIdx = Math.min(4, n - 1); // 10y is the 5th point in the default ladder
  const longRate = values[longIdx];
  const spread = longRate - shortRate;

  const interpretation =
    shapeState === 'normal'
      ? normalInterpretation
      : shapeState === 'flat'
        ? flatInterpretation
        : invertedInterpretation;

  // Tween whenever the selected shape changes.
  useEffect(() => {
    toRef.current = YIELDS[shapeState];
    if (prefersReducedMotion()) {
      fromRef.current = YIELDS[shapeState];
      setT(1);
      return;
    }
    setT(0);
    const duration = 650;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      // ease-in-out
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setT(eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = YIELDS[shapeState];
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [shapeState]);

  const toggles: Array<{ key: Shape; label: string }> = [
    { key: 'normal', label: normalLabel },
    { key: 'flat', label: flatLabel },
    { key: 'inverted', label: invertedLabel },
  ];

  const spreadColor =
    spread > 0.05
      ? 'text-brand-700'
      : spread < -0.05
        ? 'text-accent-500'
        : 'text-ink-900';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
      </figcaption>

      {/* Segmented control */}
      <div
        role="group"
        aria-label={title}
        className="mt-4 inline-flex rounded-pill border border-ink-100 bg-surface-sunken/50 p-1"
      >
        {toggles.map((opt) => {
          const active = opt.key === shapeState;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              onClick={() => setShapeState(opt.key)}
              className={cx(
                'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-brand-600 text-white shadow-soft'
                  : 'text-ink-700 hover:text-ink-900',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. ${interpretation} Short rate ${pct(shortRate)}, long rate ${pct(
          longRate,
        )}, ${spreadLabel} ${signedPct(spread)}.`}
      >
        {/* Horizontal gridlines + y ticks */}
        {yGrid.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={py(v)}
              x2={W - padR}
              y2={py(v)}
              stroke="var(--color-ink-200)"
              strokeWidth={1}
              strokeDasharray={v === yMin ? undefined : '3 4'}
            />
            <text
              x={padL - 8}
              y={py(v) + 4}
              textAnchor="end"
              className="font-mono"
              fontSize={11}
              fill="var(--color-ink-500)"
            >
              {v}%
            </text>
          </g>
        ))}

        {/* x ticks (maturities) */}
        {ticks.map((label, i) => (
          <text
            key={label + i}
            x={px(i)}
            y={H - padB + 18}
            textAnchor="middle"
            className="font-mono"
            fontSize={11}
            fill="var(--color-ink-500)"
          >
            {label}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={(padL + (W - padR)) / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-700)"
        >
          {maturityAxisLabel}
        </text>
        <text
          x={12}
          y={padT + (H - padT - padB) / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-700)"
          transform={`rotate(-90 12 ${padT + (H - padT - padB) / 2})`}
        >
          {yieldAxisLabel}
        </text>

        {/* The curve */}
        <path
          d={smoothPath(points)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="var(--color-surface)"
            stroke="var(--color-brand-600)"
            strokeWidth={2.5}
          />
        ))}
      </svg>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{shortLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(shortRate)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{longLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(longRate)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spreadLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', spreadColor)}>
            {signedPct(spread)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm font-medium text-ink-700">{interpretation}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default YieldCurveShapes;
