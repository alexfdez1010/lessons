import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VarDistributionChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the confidence-level slider. */
  confidenceLabel?: string;
  /** Label/chip for the Value-at-Risk readout and VaR line. */
  varLabel?: string;
  /** Label/chip for the Expected Shortfall (CVaR) readout. */
  esLabel?: string;
  /** Label for the dashed mean line. */
  meanLabel?: string;
  /** Label for the loss (left) side of the axis. */
  lossLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// P&L axis, in percent of portfolio per day.
const X_MIN = -8;
const X_MAX = 8;
const MU = 0.05; // mean daily return, +0.05%
const SIGMA = 2; // daily volatility, %
const SAMPLES = 120;

const gaussian = (x: number, mu: number, sigma: number): number =>
  Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma));

// Standard normal pdf.
const stdPdf = (z: number): number => Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);

// Lower-tail inverse-normal z = invNorm(1 - c) for the discrete slider steps.
// Keyed by confidence in percent (90.0 … 99.5, step 0.5). All values negative
// (left tail). Robust and exact enough for the readouts.
const Z_TABLE: Record<string, number> = {
  '90': -1.2816,
  '90.5': -1.3106,
  '91': -1.3408,
  '91.5': -1.3722,
  '92': -1.4051,
  '92.5': -1.4395,
  '93': -1.4758,
  '93.5': -1.5141,
  '94': -1.5548,
  '94.5': -1.5982,
  '95': -1.6449,
  '95.5': -1.6954,
  '96': -1.7507,
  '96.5': -1.8119,
  '97': -1.8808,
  '97.5': -1.9600,
  '98': -2.0537,
  '98.5': -2.1701,
  '99': -2.3263,
  '99.5': -2.5758,
};

const zForConfidence = (c: number): number => {
  const key = Number.isInteger(c) ? String(c) : c.toFixed(1);
  return Z_TABLE[key] ?? -1.6449;
};

/**
 * The core Value-at-Risk picture. A bell curve of daily portfolio P&L (mean
 * slightly positive) sits over a return axis from −8% to +8%. A solid vertical
 * line marks the VaR threshold — the loss quantile in the LEFT tail at the
 * chosen confidence — and the whole tail to its LEFT is shaded to represent the
 * Expected Shortfall (CVaR), the *average* loss given you're past the line.
 * Drag the confidence slider up and the VaR line slides further left into the
 * tail, with the VaR% and ES% readouts updating live. The curve eases up on
 * mount, respecting `prefers-reduced-motion` (renders final immediately).
 */
export function VarDistributionChart({
  title = 'Value at Risk and the tail beyond it',
  confidenceLabel = 'Confidence level',
  varLabel = 'VaR',
  esLabel = 'Expected Shortfall',
  meanLabel = 'Average outcome',
  lossLabel = 'Loss',
  caption = 'VaR is the line you rarely cross; Expected Shortfall is how bad it gets, on average, once you do. Raise the confidence level and the line marches deeper into the loss tail.',
  className,
}: VarDistributionChartProps) {
  const id = useId();
  const [confidence, setConfidence] = useState(99);
  const [intro, setIntro] = useState(0); // 0 → 1 mount animation
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 8;
  const padTop = 14;
  const padBottom = 24;

  const xToPx = (x: number) => padX + ((x - X_MIN) / (X_MAX - X_MIN)) * (W - padX * 2);
  // Peak amplitude of a Gaussian is 1; scale so the curve fills the height.
  const yToPx = (h: number) => padTop + (1 - h * intro) * (H - padTop - padBottom);

  const curvePath = (): string => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const x = X_MIN + (i / SAMPLES) * (X_MAX - X_MIN);
      const px = xToPx(x);
      const py = yToPx(gaussian(x, MU, SIGMA));
      d += `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    return d.trim();
  };

  // Shaded tail to the LEFT of the VaR threshold (the ES region).
  const tailPath = (varReturn: number): string => {
    const base = H - padBottom;
    let d = `M ${xToPx(X_MIN).toFixed(2)} ${base.toFixed(2)} `;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = X_MIN + (i / SAMPLES) * (varReturn - X_MIN);
      const px = xToPx(x);
      const py = yToPx(gaussian(x, MU, SIGMA));
      d += `L ${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    d += `L ${xToPx(varReturn).toFixed(2)} ${base.toFixed(2)} Z`;
    return d;
  };

  // Mount animation: ease the curve up from the baseline.
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

  const z = zForConfidence(confidence);
  const alpha = 1 - confidence / 100; // tail mass

  // VaR threshold as a return (negative); VaR% reported as a positive loss.
  const varReturn = MU + z * SIGMA;
  const varPct = -varReturn;
  // ES (CVaR) for a normal: E[X | X < VaR] = mu - sigma * pdf(z)/alpha.
  const esReturn = MU - SIGMA * (stdPdf(z) / alpha);
  const esPct = -esReturn;

  const meanX = xToPx(MU);
  const varX = xToPx(varReturn);
  const baseY = H - padBottom;
  const confText = `${confidence.toFixed(1)}%`;

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
          {`P&L (${confText})`}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-300" aria-hidden="true" />
          {esLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-0.5 bg-accent-600" aria-hidden="true" />
          {varLabel}
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
        aria-label={`Distribution of daily portfolio profit and loss. At ${confText} confidence, ${varLabel} is ${varPct.toFixed(2)} percent and ${esLabel} is ${esPct.toFixed(2)} percent. The loss tail to the left of the ${varLabel} line is shaded.`}
      >
        {/* Baseline (P&L axis) */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-200)"
        />

        {/* Expected-shortfall tail (left of the VaR line) */}
        <path
          d={tailPath(varReturn)}
          fill="var(--color-accent-300)"
          fillOpacity={0.35}
          stroke="none"
        />

        {/* P&L bell curve */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Mean line (dashed) */}
        <line
          x1={meanX}
          y1={padTop}
          x2={meanX}
          y2={baseY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        {/* VaR threshold line (solid) */}
        <line
          x1={varX}
          y1={padTop}
          x2={varX}
          y2={baseY}
          stroke="var(--color-accent-600)"
          strokeWidth={2}
        />
        <text
          x={varX}
          y={padTop + 2}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-accent-600)"
          textAnchor="middle"
        >
          {varLabel}
        </text>

        {/* Axis ticks at the extremes and zero */}
        <text x={xToPx(X_MIN)} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="start">
          {`${X_MIN}% · ${lossLabel}`}
        </text>
        <text x={xToPx(0)} y={H - 6} fontSize={11} fill="var(--color-ink-900)" textAnchor="middle">
          0%
        </text>
        <text x={xToPx(X_MAX)} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="end">
          {`+${X_MAX}%`}
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{varLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{`${varPct.toFixed(2)}%`}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{esLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{`${esPct.toFixed(2)}%`}</span>
        </span>
      </div>

      {/* Confidence slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-conf`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{confidenceLabel}</span>
          <span className="font-mono text-accent-600" aria-hidden="true">
            {confText}
          </span>
        </label>
        <input
          id={`${id}-conf`}
          type="range"
          min={90}
          max={99.5}
          step={0.5}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          aria-valuetext={`${confText} confidence`}
          className="mt-2 w-full accent-accent-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default VarDistributionChart;
