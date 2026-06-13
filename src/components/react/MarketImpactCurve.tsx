import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MarketImpactCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the order-size slider (as a fraction of daily volume). */
  sizeLabel?: string;
  /** Label for the square-root impact curve. */
  sqrtLabel?: string;
  /** Label for the naive linear curve. */
  linearLabel?: string;
  /** Label for the y-axis (cost in basis points). */
  costLabel?: string;
  /** Label for the x-axis (order size as % of ADV). */
  participationLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const N = 60;
// Cost coefficient (bps) for the square-root law at 100% of ADV.
const K = 90;
// A naive linear model, anchored to match the sqrt model at a small size.
const LIN = 150;

/**
 * Market-impact visual: the square-root law. Cost (in bps) grows like
 * √(size/ADV), so it is steep for the first slices and then flattens — doubling
 * an already-large order does NOT double its cost. The dashed linear line is the
 * intuitive-but-wrong mental model; the gap between them is why working a big
 * order slowly (and why capacity scales sub-linearly) matters. Pure SVG with
 * CSS-eased transitions; prefers-reduced-motion respected globally.
 */
export function MarketImpactCurve({
  title = 'Market impact: the square-root law',
  sizeLabel = 'Order size (% of daily volume)',
  sqrtLabel = 'Square-root law (real)',
  linearLabel = 'Linear (naive)',
  costLabel = 'Impact cost (bps)',
  participationLabel = 'Order size (% of ADV)',
  caption = 'Impact grows like the square root of size, so the curve is steep at first then flattens: the tenth percent of volume costs far less than the first. The dashed line is the naive "twice the size, twice the cost" guess — it overcharges small orders and badly underestimates how punishing the very first slices already are.',
  className,
}: MarketImpactCurveProps) {
  const id = useId();
  // size as a fraction of ADV in [0.01, 0.30].
  const [size, setSize] = useState(0.1);

  const W = 520;
  const H = 240;
  const padLeft = 44;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 36;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // Domain: x from 0 to 0.30 (30% of ADV). y from 0 to 60 bps.
  const xMax = 0.3;
  const yMax = 60;

  const sqrtCost = (x: number) => K * Math.sqrt(x);
  const linCost = (x: number) => LIN * x;

  const xToPx = (x: number) => padLeft + (x / xMax) * plotW;
  const yToPx = (v: number) => padTop + (1 - Math.min(v, yMax) / yMax) * plotH;

  const buildPath = (fn: (x: number) => number): string => {
    let d = '';
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * xMax;
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(x).toFixed(2)} ${yToPx(fn(x)).toFixed(2)} `;
    }
    return d.trim();
  };

  const sqrtD = buildPath(sqrtCost);
  const linD = buildPath(linCost);

  const cX = xToPx(size);
  const cY = yToPx(sqrtCost(size));
  const cost = sqrtCost(size);

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
          {sqrtLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill bg-ink-400"
            style={{ borderTop: '2px dashed var(--color-ink-400)', background: 'transparent' }}
            aria-hidden="true"
          />
          {linearLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Impact cost in basis points against order size as a percent of average daily volume. The square-root-law curve rises steeply for the first slices then flattens, staying below the naive straight linear line at large sizes."
      >
        {/* axes */}
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={W - padRight}
          y2={padTop + plotH}
          stroke="var(--color-ink-300)"
        />
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="var(--color-ink-300)" />

        {/* linear naive curve */}
        <path
          d={linD}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        {/* square-root curve */}
        <path
          d={sqrtD}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* marker */}
        <line
          x1={cX}
          y1={padTop + plotH}
          x2={cX}
          y2={cY}
          stroke="var(--color-brand-400)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          style={{ transition: 'all 200ms ease' }}
        />
        <circle cx={cX} cy={cY} r={4.5} fill="var(--color-brand-500)" style={{ transition: 'all 200ms ease' }} />

        {/* axis labels */}
        <text x={padLeft + plotW / 2} y={H - 4} fontSize={11} fill="var(--color-ink-700)" textAnchor="middle">
          {participationLabel}
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

      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{sizeLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{(size * 100).toFixed(0)}%</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">impact</span>
          <span className="font-mono font-semibold text-accent-600">{cost.toFixed(1)} bps</span>
        </span>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${id}-sz`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{sizeLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {(size * 100).toFixed(0)}%
          </span>
        </label>
        <input
          id={`${id}-sz`}
          type="range"
          min={0.01}
          max={0.3}
          step={0.01}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          aria-valuetext={`${(size * 100).toFixed(0)} percent of daily volume`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MarketImpactCurve;
