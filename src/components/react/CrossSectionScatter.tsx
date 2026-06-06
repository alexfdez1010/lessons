import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One portfolio in the cross-section: a factor loading and its average return. */
export interface CrossSectionPoint {
  /** Optional label shown in the point's tooltip (e.g. "Lo β" or a portfolio id). */
  label?: string;
  /** Factor loading / beta — the X position. */
  x: number;
  /** Average realised excess return (% / yr) — the Y position. */
  y: number;
}

export interface CrossSectionScatterProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the X axis (factor loading / beta). */
  xLabel?: string;
  /** Label for the Y axis (average excess return). */
  yLabel?: string;
  /** Readout label for the fitted slope (the factor risk premium). */
  slopeLabel?: string;
  /** Readout label for the fitted intercept (the pricing error / alpha). */
  interceptLabel?: string;
  /** Portfolios to plot. Each is a factor loading (x) and average return (y). */
  points?: CrossSectionPoint[];
  /**
   * Optional fitted line. If omitted, an ordinary-least-squares fit is computed
   * from `points`. `slope` is the estimated factor premium; `intercept` is the
   * pricing error (alpha).
   */
  line?: { slope: number; intercept: number };
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_POINTS: CrossSectionPoint[] = [
  // A priced factor: higher loading → higher average return, with scatter.
  { label: 'Lo β', x: 0.4, y: 2.1 },
  { label: 'P2', x: 0.65, y: 4.4 },
  { label: 'P3', x: 0.85, y: 4.0 },
  { label: 'P4', x: 1.0, y: 6.3 },
  { label: 'P5', x: 1.15, y: 7.1 },
  { label: 'P6', x: 1.3, y: 6.6 },
  { label: 'P7', x: 1.5, y: 9.2 },
  { label: 'Hi β', x: 1.7, y: 9.9 },
];

/** Ordinary-least-squares fit: returns slope + intercept for y ~ x. */
const olsFit = (
  pts: CrossSectionPoint[],
): { slope: number; intercept: number } => {
  const n = pts.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    const dx = p.x - mx;
    num += dx * (p.y - my);
    den += dx * dx;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
};

/** Pad a [min, max] range outward by `frac` of its span (min span guarded). */
const paddedRange = (
  lo: number,
  hi: number,
  frac: number,
): [number, number] => {
  const span = hi - lo || Math.abs(hi) || 1;
  return [lo - span * frac, hi + span * frac];
};

const fmt = (v: number, digits = 2): string =>
  v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (v: number, digits = 2): string =>
  `${v >= 0 ? '+' : ''}${fmt(v, digits)}`;

/**
 * Cross-sectional asset-pricing scatter. Each dot is one portfolio plotted with
 * its factor loading (beta) on the X axis and its average realised excess return
 * on the Y axis. A best-fit regression line runs through the cloud: its **slope**
 * estimates the factor's risk premium (how much extra average return one extra
 * unit of loading earns) and its **intercept** is the pricing error / alpha
 * (the average return left unexplained at zero loading). If the factor is
 * priced, higher loading lines up with higher average return and the slope is
 * positive.
 *
 * On scroll into view the points pop/fade in and the fit line draws itself via a
 * stroke-dashoffset animation. `prefers-reduced-motion` renders the final state
 * instantly. All user-facing strings are props; values come from props.
 */
export function CrossSectionScatter({
  title = 'Pricing a factor in the cross-section',
  xLabel = 'Factor loading (β)',
  yLabel = 'Average excess return (% / yr)',
  slopeLabel = 'Fitted premium (slope)',
  interceptLabel = 'Pricing error (intercept)',
  points = DEFAULT_POINTS,
  line,
  caption = 'Each dot is a portfolio: factor loading across, average return up. The best-fit slope estimates the factor risk premium; its intercept is the pricing error (alpha). A priced factor tilts the line upward.',
  className,
}: CrossSectionScatterProps) {
  // Geometry.
  const W = 520;
  const H = 360;
  const padL = 52;
  const padR = 20;
  const padT = 20;
  const padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Resolve the fitted line: explicit prop wins, otherwise compute OLS.
  const fit = useMemo(() => line ?? olsFit(points), [line, points]);

  // Axis ranges derived from the data (and the line's endpoints) with padding.
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const rawXMin = xs.length ? Math.min(...xs) : 0;
    const rawXMax = xs.length ? Math.max(...xs) : 1;
    const [xLo, xHi] = paddedRange(rawXMin, rawXMax, 0.08);
    // Include the line's y at the x-extremes so the line never clips.
    const lineYs = [fit.intercept + fit.slope * xLo, fit.intercept + fit.slope * xHi];
    const rawYMin = Math.min(...(ys.length ? ys : [0]), ...lineYs);
    const rawYMax = Math.max(...(ys.length ? ys : [1]), ...lineYs);
    const [yLo, yHi] = paddedRange(rawYMin, rawYMax, 0.1);
    return { xMin: xLo, xMax: xHi, yMin: yLo, yMax: yHi };
  }, [points, fit]);

  const toX = (v: number): number =>
    padL + ((v - xMin) / (xMax - xMin || 1)) * plotW;
  const toY = (v: number): number =>
    padT + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  // Fit-line endpoints across the visible x-range.
  const lx1 = xMin;
  const lx2 = xMax;
  const lp1 = { x: toX(lx1), y: toY(fit.intercept + fit.slope * lx1) };
  const lp2 = { x: toX(lx2), y: toY(fit.intercept + fit.slope * lx2) };
  const lineLen = Math.hypot(lp2.x - lp1.x, lp2.y - lp1.y);

  // Scroll-trigger: animate when the figure enters the viewport.
  const figRef = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  useEffect(() => {
    const el = figRef.current;
    if (!el) return;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  // Tick values (4 intervals each axis), rounded to nice-ish numbers.
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(xMin + ((xMax - xMin) * i) / 4);
    return ticks;
  }, [xMin, xMax]);
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(yMin + ((yMax - yMin) * i) / 4);
    return ticks;
  }, [yMin, yMax]);

  const relationship =
    fit.slope > 0.05
      ? 'higher loading lines up with higher average return (the factor looks priced)'
      : fit.slope < -0.05
        ? 'higher loading lines up with lower average return (the factor is inversely priced)'
        : 'average return barely changes with loading (little evidence the factor is priced)';

  const ariaLabel = `${title}. Scatter of ${points.length} portfolios: ${xLabel} across, ${yLabel} up. A best-fit line through the cloud has slope ${fmt(
    fit.slope,
  )} (${slopeLabel.toLowerCase()}) and intercept ${signed(
    fit.intercept,
  )} (${interceptLabel.toLowerCase()}). In words, ${relationship}.`;

  // Animation state derived from `shown`.
  const lineOffset = shown ? 0 : lineLen;

  return (
    <figure
      ref={figRef}
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {slopeLabel}: {fmt(fit.slope)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot background */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          rx={6}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />

        {/* Y gridlines + tick labels */}
        {yTicks.map((t, i) => {
          const gy = toY(t);
          return (
            <g key={`y-${i}`}>
              <line
                x1={padL}
                y1={gy}
                x2={padL + plotW}
                y2={gy}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={gy + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {fmt(t, 1)}
              </text>
            </g>
          );
        })}

        {/* X gridlines + tick labels */}
        {xTicks.map((t, i) => {
          const gx = toX(t);
          return (
            <g key={`x-${i}`}>
              <line
                x1={gx}
                y1={padT}
                x2={gx}
                y2={padT + plotH}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={gx}
                y={padT + plotH + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {fmt(t, 2)}
              </text>
            </g>
          );
        })}

        {/* Best-fit regression line — slope = premium, intercept = pricing error.
            Drawn with a dash-offset reveal triggered on scroll. */}
        <line
          x1={lp1.x}
          y1={lp1.y}
          x2={lp2.x}
          y2={lp2.y}
          stroke="var(--color-accent-600)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={lineLen}
          strokeDashoffset={lineOffset}
          style={
            reduced
              ? undefined
              : { transition: 'stroke-dashoffset 900ms ease-out' }
          }
        />

        {/* Scatter points — pop/fade in on scroll, staggered. */}
        {points.map((pt, i) => {
          const cxp = toX(pt.x);
          const cyp = toY(pt.y);
          const delay = reduced ? 0 : 120 + i * 70;
          return (
            <circle
              key={`pt-${i}`}
              cx={cxp}
              cy={cyp}
              r={5}
              fill="var(--color-brand-500)"
              stroke="var(--color-surface)"
              strokeWidth={1.5}
              opacity={shown ? 1 : 0}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                transform: shown ? 'scale(1)' : 'scale(0.2)',
                transition: reduced
                  ? undefined
                  : `opacity 320ms ease-out ${delay}ms, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
              }}
            >
              <title>
                {pt.label ? `${pt.label}: ` : ''}
                {`${xLabel} ${fmt(pt.x, 2)}, ${yLabel} ${fmt(pt.y, 1)}`}
              </title>
            </circle>
          );
        })}

        {/* X axis title */}
        <text
          x={padL + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {xLabel}
        </text>

        {/* Y axis title */}
        <text
          x={14}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
        >
          {yLabel}
        </text>
      </svg>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{slopeLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {fmt(fit.slope)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{interceptLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {signed(fit.intercept)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CrossSectionScatter;
