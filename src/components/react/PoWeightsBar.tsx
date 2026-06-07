import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PoWeightsBarProps {
  /** Heading above the chart. */
  title?: string;
  /** Names of the assets, in order. Length sets the number of bars. */
  assetLabels?: string[];
  /** Label for the risk-aversion / tilt slider. */
  tiltLabel?: string;
  /** Caption explaining the long-vs-short hint at the low end of the slider. */
  shortLabel?: string;
  /** Caption explaining the concentrated hint at the high end. */
  concentratedLabel?: string;
  /** Label for the "sum of weights" readout. */
  sumLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

/**
 * An interactive bar chart of portfolio **weights**. Solving an optimizer
 * produces a vector of weights — the fraction of capital in each asset — that
 * must sum to one but can go negative (a short). The learner drags a single
 * "tilt" slider that interpolates between an aggressive max-Sharpe-style mix
 * (concentrated, with one short leg) and a defensive minimum-variance-style mix
 * (spread out, all long). Bars above the zero line are long positions; bars
 * below are shorts. The running sum stays pinned at 100%. Locale-agnostic:
 * every user-facing string is a prop.
 */
export function PoWeightsBar({
  title = 'A portfolio is a vector of weights',
  assetLabels = ['Stocks', 'Bonds', 'Gold', 'Cash'],
  tiltLabel = 'Tilt: defensive ↔ aggressive',
  shortLabel = 'Defensive: spread out, all long',
  concentratedLabel = 'Aggressive: concentrated, one short leg',
  sumLabel = 'Sum of weights',
  caption = 'The optimizer hands you one number per asset — the share of capital it gets. They must sum to 100%, but nothing stops a weight from going negative: that is a short position, funding a bigger bet elsewhere. Drag the tilt to see weights swing from a calm, spread-out mix to an aggressive, concentrated one.',
  className,
}: PoWeightsBarProps) {
  const id = useId();
  const n = assetLabels.length;
  const [tilt, setTilt] = useState(0.4);

  // Two endpoint weight vectors (each sums to 1). Defensive = spread, all long.
  // Aggressive = concentrated, with a short leg. Interpolate between them.
  const weights = useMemo(() => {
    const defensive =
      n === 4 ? [0.35, 0.4, 0.15, 0.1] : Array.from({ length: n }, () => 1 / n);
    const aggressive =
      n === 4 ? [0.85, 0.35, 0.1, -0.3] : Array.from({ length: n }, (_, i) => (i === 0 ? 1.4 : (1 - 1.4) / (n - 1)));
    const w = defensive.map((d, i) => d + tilt * (aggressive[i] - d));
    // Renormalize to sum exactly 1 (numerical safety).
    const s = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / s);
  }, [tilt, n]);

  const sum = weights.reduce((a, b) => a + b, 0);

  // Chart geometry.
  const W = 520;
  const H = 280;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const wMax = 1.0; // axis top
  const wMin = -0.5; // axis bottom
  const toY = (w: number): number => padT + plotH - ((w - wMin) / (wMax - wMin)) * plotH;
  const zeroY = toY(0);
  const slot = plotW / n;
  const barW = slot * 0.56;

  const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

  const ariaLabel = `${title}. ${assetLabels
    .map((a, i) => `${a}: ${pct(weights[i])}`)
    .join(', ')}. ${sumLabel}: ${pct(sum)}.`;

  const yTicks = [-0.5, 0, 0.5, 1.0];

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {sumLabel}: {pct(sum)}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        {/* Y gridlines + ticks */}
        {yTicks.map((tk) => {
          const gy = toY(tk);
          return (
            <g key={`y-${tk}`}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                stroke={tk === 0 ? 'var(--color-ink-300)' : 'var(--color-ink-100)'}
                strokeWidth={tk === 0 ? 1.5 : 1}
              />
              <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
                {`${(tk * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {weights.map((w, i) => {
          const cx0 = padL + slot * (i + 0.5);
          const x = cx0 - barW / 2;
          const yTop = w >= 0 ? toY(w) : zeroY;
          const h = Math.abs(toY(w) - zeroY);
          const long = w >= 0;
          return (
            <g key={`bar-${i}`}>
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={Math.max(1, h)}
                rx={3}
                fill={long ? 'var(--color-brand-600)' : 'var(--color-accent-500)'}
                opacity={0.9}
              />
              <text
                x={cx0}
                y={long ? yTop - 5 : yTop + h + 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight={600}
                fill={long ? 'var(--color-brand-700)' : 'var(--color-accent-600)'}
              >
                {pct(w)}
              </text>
              <text
                x={cx0}
                y={H - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-500)"
              >
                {assetLabels[i]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tilt slider */}
      <div className="mt-2">
        <label htmlFor={`${id}-tilt`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{tiltLabel}</span>
        </label>
        <input
          id={`${id}-tilt`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={tilt}
          onChange={(e) => setTilt(Number(e.target.value))}
          aria-label={tiltLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{shortLabel}</span>
          <span>{concentratedLabel}</span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PoWeightsBar;
