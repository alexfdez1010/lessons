import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvPowerLawPlotProps {
  /** Heading above the chart. */
  title?: string;
  /** Slider label for the tail index α. */
  alphaLabel?: string;
  /** Label for the log-log straight line. */
  lineLabel?: string;
  /** Label describing the slope readout. */
  slopeLabel?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const num = (value: number, digits = 1): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

/**
 * Log-log plot of a power-law (Pareto) survival function P(X > x) = x^(-α).
 * On a log-log axis a power law is a perfectly straight line whose slope is the
 * negative tail index −α. The slider changes α; the line tilts, and the readout
 * shows the slope. A toggle overlays the Gaussian tail, which on the same axes
 * curves sharply downward (its tail dies far faster than any straight line),
 * dramatising why a power law is "scale-free" while a normal tail is not.
 */
export function EvPowerLawPlot({
  title = 'A power-law tail is a straight line in log-log',
  alphaLabel = 'Tail index α',
  lineLabel = 'Power-law tail',
  slopeLabel = 'Slope of the log-log line',
  caption = 'Plot the chance of exceeding x against x, both on log axes. A power law plots as a ruler-straight line whose slope is exactly −α: smaller α means a flatter line and a heavier tail. Flip on the Gaussian comparison and watch its tail nose-dive off the chart — proof that a normal has no straight-line tail at all.',
  className,
}: EvPowerLawPlotProps) {
  const id = useId();
  const [alpha, setAlpha] = useState(3);
  const [showNormal, setShowNormal] = useState(false);

  const W = 540;
  const H = 270;
  const padL = 40;
  const padR = 14;
  const padT = 14;
  const padB = 30;

  // x ranges over log10 from 0 (x=1) to 3 (x=1000).
  const lxMin = 0;
  const lxMax = 3;
  // y is log10 of survival; ranges from 0 (=1) down to -8.
  const lyMin = -8;
  const lyMax = 0;

  const px = (lx: number) => padL + ((lx - lxMin) / (lxMax - lxMin)) * (W - padL - padR);
  const py = (ly: number) => padT + ((lyMax - ly) / (lyMax - lyMin)) * (H - padT - padB);

  const SAMPLES = 120;
  // Power law: log10 S = -alpha * log10 x.
  const powerPts: { lx: number; ly: number }[] = [];
  const normalPts: { lx: number; ly: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const lx = lxMin + (i / SAMPLES) * (lxMax - lxMin);
    powerPts.push({ lx, ly: -alpha * lx });
    // Normal survival ~ exp(-x^2/2) for the standardised tail; use x itself (x>=1).
    const xv = Math.pow(10, lx);
    const surv = Math.exp(-(xv * xv) / 2);
    normalPts.push({ lx, ly: surv > 0 ? Math.log10(surv) : lyMin });
  }

  const clampLy = (ly: number) => Math.max(lyMin, Math.min(lyMax, ly));

  const pathOf = (pts: { lx: number; ly: number }[]) =>
    pts
      .map(
        (p, i) => `${i === 0 ? 'M' : 'L'} ${num(px(p.lx), 2)} ${num(py(clampLy(p.ly)), 2)}`,
      )
      .join(' ');

  const xTicks = [0, 1, 2, 3];
  const yTicks = [0, -2, -4, -6, -8];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          α {num(alpha, 1)}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {lineLabel}
        </span>
        {showNormal && (
          <span className="inline-flex items-center gap-2 text-ink-700">
            <span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />
            Gaussian tail
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. The power-law tail plots as a straight line of slope minus ${num(alpha, 1)} on log-log axes.`}
      >
        {/* gridlines */}
        {yTicks.map((ty, i) => (
          <g key={`y${i}`}>
            <line
              x1={padL}
              y1={py(ty)}
              x2={W - padR}
              y2={py(ty)}
              stroke="var(--color-ink-100)"
            />
            <text x={padL - 6} y={py(ty) + 4} textAnchor="end" fontSize={10} fill="var(--color-ink-400)">
              10^{num(ty, 0)}
            </text>
          </g>
        ))}
        {xTicks.map((tx, i) => (
          <g key={`x${i}`}>
            <line
              x1={px(tx)}
              y1={padT}
              x2={px(tx)}
              y2={H - padB}
              stroke="var(--color-ink-100)"
            />
            <text
              x={px(tx)}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-400)"
            >
              10^{num(tx, 0)}
            </text>
          </g>
        ))}

        {showNormal && (
          <path
            d={pathOf(normalPts)}
            fill="none"
            stroke="var(--color-ink-400)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <path
          d={pathOf(powerPts)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'd 250ms ease' }}
        />
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[12rem]">
          <label
            htmlFor={`${id}-alpha`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{alphaLabel}</span>
            <span className="font-mono text-ink-900">{num(alpha, 1)}</span>
          </label>
          <input
            id={`${id}-alpha`}
            type="range"
            min={1}
            max={6}
            step={0.1}
            value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <button
          type="button"
          aria-pressed={showNormal}
          onClick={() => setShowNormal((s) => !s)}
          className={cx(
            'rounded-pill border border-ink-100 px-4 py-2 text-sm font-medium transition-colors',
            showNormal ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {showNormal ? 'hide Gaussian' : 'compare Gaussian'}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{slopeLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">−{num(alpha, 1)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvPowerLawPlot;
