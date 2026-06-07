import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TsOverfitCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the complexity (number of tries / parameters) slider. */
  complexityLabel?: string;
  /** Label for the in-sample (backtest) curve. */
  inSampleLabel?: string;
  /** Label for the out-of-sample (live) curve. */
  outSampleLabel?: string;
  /** Label for the y-axis (performance). */
  performanceLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const N = 40;

/**
 * An overfitting / data-snooping visual. As you crank "complexity" (more
 * parameters, or equivalently more strategies tried on the same data), the
 * in-sample backtest performance climbs ever upward — the curve fits the noise.
 * But the out-of-sample (live) performance rises, peaks, then collapses: past
 * the sweet spot you are mining noise, and the live edge degrades. The widening
 * gap between the two curves is the overfitting gap. Pure SVG with CSS-eased
 * transitions; respects prefers-reduced-motion globally.
 */
export function TsOverfitCurve({
  title = 'Overfitting: backtest soars, live performance collapses',
  complexityLabel = 'Model complexity / strategies tried',
  inSampleLabel = 'In-sample (backtest)',
  outSampleLabel = 'Out-of-sample (live)',
  performanceLabel = 'Apparent performance',
  caption = 'Add parameters or test more variants on the same history and the backtest curve keeps rising — it is memorizing noise. The live curve rises to a sweet spot, then falls off a cliff as the model fits quirks that will not repeat. The gap between the two is exactly the overfitting you are paying for.',
  className,
}: TsOverfitCurveProps) {
  const id = useId();
  // complexity in [0,1], maps to position along the curves.
  const [complexity, setComplexity] = useState(0.4);

  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 34;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // In-sample: monotonically increasing, saturating.
  const inSample = (c: number) => 0.15 + 0.8 * (1 - Math.exp(-3 * c));
  // Out-of-sample: rises then falls — a hump peaking near c≈0.35.
  const outSample = (c: number) => {
    const peak = 0.35;
    const base = 0.15 + 0.55 * (1 - Math.exp(-5 * c));
    const penalty = 0.7 * Math.max(0, c - peak) ** 1.4;
    return Math.max(0.02, base - penalty);
  };

  const xToPx = (c: number) => padLeft + c * plotW;
  const yToPx = (v: number) => padTop + (1 - v) * plotH;

  const buildPath = (fn: (c: number) => number): string => {
    let d = '';
    for (let i = 0; i <= N; i++) {
      const c = i / N;
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(c).toFixed(2)} ${yToPx(fn(c)).toFixed(2)} `;
    }
    return d.trim();
  };

  const inD = buildPath(inSample);
  const outD = buildPath(outSample);

  const cInY = yToPx(inSample(complexity));
  const cOutY = yToPx(outSample(complexity));
  const cX = xToPx(complexity);
  const gap = inSample(complexity) - outSample(complexity);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {inSampleLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {outSampleLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Two performance curves against model complexity: the in-sample backtest curve rises monotonically while the out-of-sample live curve rises, peaks, and then declines, the gap between them growing with complexity."
      >
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={W - padRight}
          y2={padTop + plotH}
          stroke="var(--color-ink-300)"
        />

        <path
          d={inD}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={outD}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current-complexity marker line + the gap */}
        <line
          x1={cX}
          y1={cInY}
          x2={cX}
          y2={cOutY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          style={{ transition: 'all 250ms ease' }}
        />
        <circle
          cx={cX}
          cy={cInY}
          r={4}
          fill="var(--color-brand-500)"
          style={{ transition: 'all 250ms ease' }}
        />
        <circle
          cx={cX}
          cy={cOutY}
          r={4}
          fill="var(--color-accent-500)"
          style={{ transition: 'all 250ms ease' }}
        />

        <text
          x={padLeft + plotW / 2}
          y={H - 4}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {complexityLabel}
        </text>
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {performanceLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">gap</span>
          <span className="font-mono font-semibold text-accent-600">
            {(gap * 100).toFixed(0)}%
          </span>
        </span>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${id}-cx`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{complexityLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {(complexity * 100).toFixed(0)}%
          </span>
        </label>
        <input
          id={`${id}-cx`}
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={complexity}
          onChange={(e) => setComplexity(Number(e.target.value))}
          aria-valuetext={`complexity ${(complexity * 100).toFixed(0)} percent`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TsOverfitCurve;
