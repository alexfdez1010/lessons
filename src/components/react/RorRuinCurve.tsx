import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorRuinCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the edge (win-rate advantage) slider. */
  edgeLabel?: string;
  /** Label for the units-of-risk slider. */
  unitsLabel?: string;
  /** Axis label for the units-of-capital (x) axis. */
  xAxisLabel?: string;
  /** Axis label for the risk-of-ruin (y) axis. */
  yAxisLabel?: string;
  /** Readout label preceding the current ruin probability. */
  ruinLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial edge as a fraction (win probability minus 0.5). Defaults to 0.05. */
  edge?: number;
  /** Initial number of units of capital marked on the curve. Defaults to 20. */
  units?: number;
  className?: string;
}

/**
 * Plots the classic risk-of-ruin curve for an even-money, fixed-fraction game.
 * For a per-bet win probability p (edge = p − 0.5) and a bankroll of N betting
 * units, the probability of eventual ruin is RoR = ((1 − edge·2)/(1 + edge·2))^N
 * — i.e. q/p raised to the number of units, where q = 1 − p. The curve shows how
 * ruin probability collapses exponentially as you hold more units of capital,
 * and the edge slider shows how a bigger edge bends the whole curve toward zero.
 * A marker tracks the ruin probability at the chosen number of units. Pure SVG,
 * no animation, no Math.random — fully deterministic from the slider values.
 */
export function RorRuinCurve({
  title = 'Risk of ruin vs units of capital',
  edgeLabel = 'Edge (win rate over 50%)',
  unitsLabel = 'Units of capital',
  xAxisLabel = 'Units of capital (bankroll ÷ bet)',
  yAxisLabel = 'Risk of ruin',
  ruinLabel = 'Risk of ruin',
  caption = 'Ruin probability falls exponentially as you stake fewer units per bet (more units of capital). A bigger edge bends the whole curve toward zero — but capital, not edge alone, is what buys survival.',
  edge = 0.05,
  units = 20,
  className,
}: RorRuinCurveProps) {
  const id = useId();
  const [edgePct, setEdgePct] = useState(Math.round(edge * 100));
  const [unitCount, setUnitCount] = useState(units);

  const p = 0.5 + edgePct / 100;
  const q = 1 - p;
  // q/p ratio per unit; ruin = (q/p)^N for an even-money fixed-unit game.
  const ratio = q / p;

  const W = 560;
  const H = 260;
  const padLeft = 46;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 32;
  const maxUnits = 60;

  const xToPx = (u: number) => padLeft + (u / maxUnits) * (W - padLeft - padRight);
  const yToPx = (r: number) => padTop + (1 - r) * (H - padTop - padBottom);

  const ruinAt = (u: number) => Math.pow(ratio, u);

  const curveD = useMemo(() => {
    let d = '';
    for (let u = 0; u <= maxUnits; u += 0.5) {
      const px = xToPx(u);
      const py = yToPx(ruinAt(u));
      d += `${u === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    return d.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  const currentRuin = ruinAt(unitCount);
  const markX = xToPx(unitCount);
  const markY = yToPx(currentRuin);
  const baseY = H - padBottom;

  const fmtRuin = (r: number) =>
    r >= 0.01 ? `${(r * 100).toFixed(1)}%` : r >= 0.0001 ? `${(r * 100).toFixed(3)}%` : '<0.01%';

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white" aria-live="polite">
          {ruinLabel}: {fmtRuin(currentRuin)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Risk-of-ruin curve for a win probability of ${Math.round(p * 100)} percent. At ${unitCount} units of capital the ruin probability is about ${fmtRuin(currentRuin)}.`}
      >
        {/* Axes */}
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={baseY} stroke="var(--color-ink-200)" />
        <line x1={padLeft} y1={baseY} x2={W - padRight} y2={baseY} stroke="var(--color-ink-200)" />

        {/* y gridlines at 0, 0.5, 1 */}
        {[0, 0.5, 1].map((r) => (
          <g key={r}>
            <line
              x1={padLeft}
              y1={yToPx(r)}
              x2={W - padRight}
              y2={yToPx(r)}
              stroke="var(--color-ink-100)"
              strokeDasharray="3 4"
            />
            <text x={padLeft - 6} y={yToPx(r) + 3} fontSize={10} fill="var(--color-ink-500)" textAnchor="end">
              {`${Math.round(r * 100)}%`}
            </text>
          </g>
        ))}

        {/* The ruin curve */}
        <path d={curveD} fill="none" stroke="var(--color-danger)" strokeWidth={2.6} strokeLinejoin="round" />

        {/* Marker at chosen units */}
        <line x1={markX} y1={baseY} x2={markX} y2={markY} stroke="var(--color-brand-500)" strokeDasharray="3 3" />
        <circle cx={markX} cy={markY} r={5} fill="var(--color-brand-600)" />

        {/* Axis labels */}
        <text x={(padLeft + W - padRight) / 2} y={H - 6} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {xAxisLabel}
        </text>
        <text
          x={14}
          y={(padTop + baseY) / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(padTop + baseY) / 2})`}
        >
          {yAxisLabel}
        </text>
      </svg>

      {/* Edge slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-edge`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{edgeLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            +{edgePct}%
          </span>
        </label>
        <input
          id={`${id}-edge`}
          type="range"
          min={1}
          max={20}
          step={1}
          value={edgePct}
          onChange={(e) => setEdgePct(Number(e.target.value))}
          aria-valuetext={`${edgePct} percent edge`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Units slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-units`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{unitsLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {unitCount}
          </span>
        </label>
        <input
          id={`${id}-units`}
          type="range"
          min={1}
          max={maxUnits}
          step={1}
          value={unitCount}
          onChange={(e) => setUnitCount(Number(e.target.value))}
          aria-valuetext={`${unitCount} units of capital`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RorRuinCurve;
