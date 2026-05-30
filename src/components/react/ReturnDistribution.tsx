import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ReturnDistributionProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the tight, low-volatility curve. */
  lowVolLabel?: string;
  /** Legend label for the wide, high-volatility curve. */
  highVolLabel?: string;
  /** Label for the dashed shared-mean line. */
  meanLabel?: string;
  /** Label for the σ slider. */
  sigmaLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Return axis, in percent.
const X_MIN = -40;
const X_MAX = 40;
const MEAN = 8; // shared mean return, +8%
const LOW_SIGMA = 7; // fixed tight curve
const HIGH_SIGMA_MIN = 5;
const HIGH_SIGMA_MAX = 30;
const SAMPLES = 96;

const gaussian = (x: number, mu: number, sigma: number): number =>
  Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma));

/**
 * Two bell curves, same mean, different spread — the picture of "volatility =
 * spread of returns". The tight low-volatility curve is tall and narrow; the
 * wide high-volatility curve is short and broad, yet both are centred on the
 * exact same average return (marked by a dashed mean line). Drag the σ slider
 * and the high-volatility curve flattens and fans out, so learners *feel* that
 * identical expected returns can hide wildly different risk. Curves fade/scale
 * up on mount, respecting `prefers-reduced-motion` (renders final immediately).
 */
export function ReturnDistribution({
  title = 'Same average return, different risk',
  lowVolLabel = 'Low volatility',
  highVolLabel = 'High volatility',
  meanLabel = 'Same average return',
  sigmaLabel = 'Volatility (σ)',
  caption = 'Both curves peak at the same average return. The wider one just spreads its outcomes further from that average — that spread is volatility.',
  className,
}: ReturnDistributionProps) {
  const id = useId();
  const [highSigma, setHighSigma] = useState(20);
  const [intro, setIntro] = useState(0); // 0 → 1 mount animation
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 8;
  const padTop = 14;
  const padBottom = 24;

  const xToPx = (x: number) => padX + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - padX * 2);
  // Peak amplitude of a Gaussian is 1; scale so the tallest (low-vol) curve fills the height.
  const yToPx = (h: number) =>
    padTop + (1 - h * intro) * (H - padTop - padBottom);

  const curvePath = (sigma: number): string => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const x = X_MIN + (i / SAMPLES) * (X_MAX - X_MIN);
      const px = xToPx(x);
      const py = yToPx(gaussian(x, MEAN, sigma));
      d += `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    return d.trim();
  };

  const areaPath = (sigma: number): string => {
    const base = H - padBottom;
    return `${curvePath(sigma)} L ${xToPx(X_MAX).toFixed(2)} ${base} L ${xToPx(X_MIN).toFixed(2)} ${base} Z`;
  };

  // Mount animation: ease the curves up from the baseline.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setIntro(1);
      return;
    }
    const duration = 700;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setIntro(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const meanX = xToPx(MEAN);
  const baseY = H - padBottom;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {lowVolLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {highVolLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-0.5 border-l border-dashed border-ink-400"
            aria-hidden="true"
          />
          {meanLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: two bell curves share the same mean return but the ${highVolLabel.toLowerCase()} curve (σ ${highSigma}%) is shorter and far wider than the ${lowVolLabel.toLowerCase()} curve, showing a larger spread of outcomes around the same average.`}
      >
        {/* Baseline (return axis) */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* High-volatility curve (wide, short) */}
        <path d={areaPath(highSigma)} fill="var(--color-accent-300)" fillOpacity={0.35} stroke="none" />
        <path
          d={curvePath(highSigma)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Low-volatility curve (tall, narrow) */}
        <path d={areaPath(LOW_SIGMA)} fill="var(--color-brand-100)" fillOpacity={0.4} stroke="none" />
        <path
          d={curvePath(LOW_SIGMA)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Shared mean line */}
        <line
          x1={meanX}
          y1={padTop}
          x2={meanX}
          y2={baseY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* Axis ticks at the extremes and the mean */}
        <text x={xToPx(X_MIN)} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="start">
          {`${X_MIN}%`}
        </text>
        <text x={meanX} y={H - 6} fontSize={11} fill="var(--color-ink-900)" textAnchor="middle">
          {`+${MEAN}%`}
        </text>
        <text x={xToPx(X_MAX)} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="end">
          {`+${X_MAX}%`}
        </text>
      </svg>

      {/* σ slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-sigma`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{sigmaLabel}</span>
          <span className="font-mono text-accent-600" aria-hidden="true">
            {`${highSigma}%`}
          </span>
        </label>
        <input
          id={`${id}-sigma`}
          type="range"
          min={HIGH_SIGMA_MIN}
          max={HIGH_SIGMA_MAX}
          step={1}
          value={highSigma}
          onChange={(e) => setHighSigma(Number(e.target.value))}
          aria-valuetext={`${highSigma} percent`}
          className="mt-2 w-full accent-accent-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ReturnDistribution;
