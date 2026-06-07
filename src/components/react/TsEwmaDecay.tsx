import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TsEwmaDecayProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the lambda (decay) slider. */
  lambdaLabel?: string;
  /** Label for the x-axis (lag / days ago). */
  lagLabel?: string;
  /** Label for the y-axis (weight). */
  weightLabel?: string;
  /** Label that displays the effective memory (half-life) readout. */
  halfLifeLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const N_BARS = 24;

/**
 * An EWMA weight-decay visual for RiskMetrics-style variance. Each bar is the
 * weight (1 − λ)·λ^k that an exponentially weighted moving average puts on the
 * squared return from k days ago. Sliding λ reshapes the whole geometric decay:
 * a small λ concentrates almost all weight on the last day or two (fast,
 * jumpy), while λ near 1 spreads the weight over a long memory (smooth, slow to
 * react). A readout reports the effective half-life ln(0.5)/ln(λ) — how many
 * days back hold half the total weight. Pure CSS transitions on bar heights;
 * respects prefers-reduced-motion globally.
 */
export function TsEwmaDecay({
  title = 'EWMA weights: the λ decay',
  lambdaLabel = 'Decay (λ)',
  lagLabel = 'Days ago (k)',
  weightLabel = 'Weight',
  halfLifeLabel = 'Half-life ≈',
  caption = 'EWMA weights the squared return from k days ago by (1 − λ)·λ^k — a geometric decay. Lower λ piles weight on the most recent days, reacting fast but jumpily; raise λ toward 1 and the weights spread into a long, smooth memory. RiskMetrics famously fixed λ = 0.94 for daily data.',
  className,
}: TsEwmaDecayProps) {
  const id = useId();
  const [lambda, setLambda] = useState(0.94);

  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 30;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const weights: number[] = [];
  for (let k = 0; k < N_BARS; k++) weights.push((1 - lambda) * lambda ** k);
  const wMax = weights[0] || 1;

  const slot = plotW / N_BARS;
  const barW = slot * 0.6;

  const yToH = (w: number) => (w / wMax) * plotH;

  // Half-life in days: solve lambda^h = 0.5 → h = ln(0.5)/ln(lambda).
  const halfLife = Math.log(0.5) / Math.log(lambda);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{halfLifeLabel}</span>
          <span className="font-mono font-semibold text-brand-600">
            {halfLife.toFixed(1)}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A decaying bar chart of EWMA weights with decay factor lambda ${lambda.toFixed(2)}, where the weight on each past day shrinks geometrically with a half-life of about ${halfLife.toFixed(1)} days.`}
      >
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={W - padRight}
          y2={padTop + plotH}
          stroke="var(--color-ink-300)"
        />

        {weights.map((w, k) => {
          const h = yToH(w);
          const x = padLeft + slot * k + (slot - barW) / 2;
          const y = padTop + plotH - h;
          return (
            <g key={`bar-${k}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={1.5}
                fill="var(--color-brand-500)"
                opacity={0.85}
                style={{ transition: 'all 350ms ease' }}
              />
              {k % 3 === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 14}
                  fontSize={9}
                  fill="var(--color-ink-600)"
                  textAnchor="middle"
                >
                  {k}
                </text>
              )}
            </g>
          );
        })}

        <text
          x={padLeft + plotW / 2}
          y={H - 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {lagLabel}
        </text>
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {weightLabel}
        </text>
      </svg>

      <div className="mt-4">
        <label
          htmlFor={`${id}-lambda`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{lambdaLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {lambda.toFixed(2)}
          </span>
        </label>
        <input
          id={`${id}-lambda`}
          type="range"
          min={0.8}
          max={0.99}
          step={0.01}
          value={lambda}
          onChange={(e) => setLambda(Number(e.target.value))}
          aria-valuetext={`lambda ${lambda.toFixed(2)}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TsEwmaDecay;
