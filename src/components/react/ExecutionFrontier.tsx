import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ExecutionFrontierProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the risk-aversion slider. */
  aversionLabel?: string;
  /** Label for the x-axis (timing risk). */
  riskLabel?: string;
  /** Label for the y-axis (expected cost). */
  costLabel?: string;
  /** Label for the "trade fast" end of the frontier. */
  fastLabel?: string;
  /** Label for the "trade slow" end of the frontier. */
  slowLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const N = 60;
// Frontier endpoints, in bps.
const C_MAX = 28; // expected cost when trading fastest (impact-heavy)
const C_MIN = 4; // expected cost when trading slowest
const R_MIN = 2; // timing risk when trading fastest
const R_MAX = 38; // timing risk when trading slowest

/**
 * The efficient frontier of execution (Almgren–Chriss). Every trading speed is
 * a trade-off: trade FAST and you pay high expected impact cost but face little
 * timing risk (the price can't drift far in a few minutes); trade SLOW and the
 * expected cost falls but the timing risk balloons (the price has hours to move
 * against you). The set of best-possible trade-offs is the frontier; a trader's
 * risk aversion picks the single point on it. Pure SVG with CSS-eased
 * transitions; prefers-reduced-motion respected globally.
 */
export function ExecutionFrontier({
  title = 'The efficient frontier of execution',
  aversionLabel = 'Risk aversion',
  riskLabel = 'Timing risk — std of cost (bps)',
  costLabel = 'Expected cost (bps)',
  fastLabel = 'Trade fast: high cost, low risk',
  slowLabel = 'Trade slow: low cost, high risk',
  caption = 'Faster execution buys certainty (low timing risk) by paying more impact; slower execution saves impact but exposes the order to price drift. No point on the frontier is "free" — risk aversion alone picks where you sit. A high-aversion desk trades fast (top-left); a patient, low-aversion desk drifts down-right.',
  className,
}: ExecutionFrontierProps) {
  const id = useId();
  // risk aversion in [0,1]; high aversion → trade fast → less patience.
  const [aversion, setAversion] = useState(0.5);

  const W = 520;
  const H = 250;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 38;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const xMax = 42;
  const yMax = 32;

  // Parametrise by patience p in [0,1]: p=0 fastest, p=1 slowest.
  const riskAt = (p: number) => R_MIN + (R_MAX - R_MIN) * p;
  const costAt = (p: number) => C_MIN + (C_MAX - C_MIN) * Math.exp(-3 * p);

  const xToPx = (r: number) => padLeft + (r / xMax) * plotW;
  const yToPx = (c: number) => padTop + (1 - Math.min(c, yMax) / yMax) * plotH;

  let d = '';
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    d += `${i === 0 ? 'M' : 'L'} ${xToPx(riskAt(p)).toFixed(2)} ${yToPx(costAt(p)).toFixed(2)} `;
  }
  d = d.trim();

  // High aversion (slider → 1) means trade fast (p small).
  const p = 1 - aversion;
  const r = riskAt(p);
  const c = costAt(p);
  const cX = xToPx(r);
  const cY = yToPx(c);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label="The execution efficient frontier: expected cost on the vertical axis against timing risk on the horizontal axis. The downward-sloping convex curve runs from high-cost low-risk (trade fast, top-left) to low-cost high-risk (trade slow, bottom-right); a marker sits where the chosen risk aversion lands."
      >
        {/* axes */}
        <line x1={padLeft} y1={padTop + plotH} x2={W - padRight} y2={padTop + plotH} stroke="var(--color-ink-300)" />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="var(--color-ink-300)" />

        {/* frontier */}
        <path d={d} fill="none" stroke="var(--color-brand-500)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* endpoint dots */}
        <circle cx={xToPx(riskAt(0))} cy={yToPx(costAt(0))} r={3.5} fill="var(--color-ink-400)" />
        <circle cx={xToPx(riskAt(1))} cy={yToPx(costAt(1))} r={3.5} fill="var(--color-ink-400)" />

        {/* guide lines from marker to axes */}
        <line x1={cX} y1={cY} x2={cX} y2={padTop + plotH} stroke="var(--color-brand-400)" strokeWidth={1.25} strokeDasharray="4 3" style={{ transition: 'all 200ms ease' }} />
        <line x1={padLeft} y1={cY} x2={cX} y2={cY} stroke="var(--color-brand-400)" strokeWidth={1.25} strokeDasharray="4 3" style={{ transition: 'all 200ms ease' }} />
        <circle cx={cX} cy={cY} r={5} fill="var(--color-accent-500)" style={{ transition: 'all 200ms ease' }} />

        {/* axis labels */}
        <text x={padLeft + plotW / 2} y={H - 4} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {riskLabel}
        </text>
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {costLabel}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-500">
        <span>{fastLabel}</span>
        <span>{slowLabel}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{costLabel.split(' (')[0]}</span>
          <span className="font-mono font-semibold text-brand-600">{c.toFixed(1)} bps</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{riskLabel.split(' —')[0]}</span>
          <span className="font-mono font-semibold text-accent-600">{r.toFixed(1)} bps</span>
        </span>
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-av`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{aversionLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {(aversion * 100).toFixed(0)}%
          </span>
        </label>
        <input
          id={`${id}-av`}
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={aversion}
          onChange={(e) => setAversion(Number(e.target.value))}
          aria-valuetext={`risk aversion ${(aversion * 100).toFixed(0)} percent`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ExecutionFrontier;
