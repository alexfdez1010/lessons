import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type Style = 'aggressive' | 'passive';

interface Component {
  key: string;
  label: string;
  /** Cost in bps for each trading style. */
  aggressive: number;
  passive: number;
}

export interface IsWaterfallProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the aggressive (fast) toggle. */
  aggressiveLabel?: string;
  /** Label for the passive (slow) toggle. */
  passiveLabel?: string;
  /** Label for the final total bar. */
  totalLabel?: string;
  /** Y-axis / readout unit label. Defaults to `'bps'`. */
  unitLabel?: string;
  /** Y-axis title (cost). Defaults to `'Cost'`. */
  costAxisLabel?: string;
  /** Label under the final summed bar. Defaults to `'Total'`. */
  totalBarLabel?: string;
  /**
   * The cost components, in left-to-right waterfall order. Each carries its bps
   * cost under the aggressive and passive styles. Defaults to the five classic
   * implementation-shortfall buckets.
   */
  components?: Component[];
  /** Explanation shown for the aggressive style. */
  aggressiveExplanation?: string;
  /** Explanation shown for the passive style. */
  passiveExplanation?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const DEFAULT_COMPONENTS: Component[] = [
  { key: 'delay', label: 'Delay', aggressive: 1, passive: 5 },
  { key: 'spread', label: 'Spread & fees', aggressive: 3, passive: 2 },
  { key: 'impact', label: 'Market impact', aggressive: 20, passive: 5 },
  { key: 'timing', label: 'Timing (drift)', aggressive: 2, passive: 11 },
  { key: 'opportunity', label: 'Opportunity', aggressive: 0, passive: 8 },
];

/**
 * Implementation-shortfall waterfall. Implementation shortfall is the gap
 * between the paper (decision-price) return and the realised return, broken
 * into its cost buckets. Toggling between an aggressive (fast) and a passive
 * (slow) execution shows the central trade-off: trade fast and MARKET IMPACT
 * dominates; trade slow and TIMING drift plus OPPORTUNITY cost (unfilled shares)
 * take over. The total is the cumulative height of the waterfall. Pure SVG;
 * prefers-reduced-motion respected globally.
 */
export function IsWaterfall({
  title = 'Implementation shortfall: where the cost goes',
  aggressiveLabel = 'Trade fast',
  passiveLabel = 'Trade slow',
  totalLabel = 'Total shortfall',
  unitLabel = 'bps',
  costAxisLabel = 'Cost',
  totalBarLabel = 'Total',
  components = DEFAULT_COMPONENTS,
  aggressiveExplanation = 'Trading fast crushes timing risk and leaves nothing unfilled — but you pay for it in market impact, which dominates the bill. You move the price against yourself by demanding liquidity now.',
  passiveExplanation = 'Trading slow shrinks market impact to a trickle — but the order is exposed to the price drifting away (timing cost) and may not fully fill (opportunity cost). Patience has its own, larger, price here.',
  caption = 'Implementation shortfall = paper return − real return, split into buckets. Fast execution is impact-heavy; slow execution is timing- and opportunity-heavy. The optimal speed lives between these two extremes — which is exactly what optimal-execution models solve for.',
  className,
}: IsWaterfallProps) {
  const id = useId();
  const [style, setStyle] = useState<Style>('aggressive');

  const W = 520;
  const H = 250;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 52;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const valueOf = (c: Component) => (style === 'aggressive' ? c.aggressive : c.passive);
  const total = components.reduce((s, c) => s + valueOf(c), 0);
  // Keep a fixed scale so the two styles are visually comparable.
  const yMax = 36;

  const nBars = components.length + 1;
  const slot = plotW / nBars;
  const barW = slot * 0.6;

  const yToPx = (v: number) => padTop + (1 - Math.min(v, yMax) / yMax) * plotH;

  // Cumulative running total for the floating waterfall bars.
  let running = 0;
  const bars = components.map((c, i) => {
    const v = valueOf(c);
    const start = running;
    running += v;
    const x = padLeft + i * slot + (slot - barW) / 2;
    const yTop = yToPx(running);
    const yBot = yToPx(start);
    return { c, v, x, yTop, h: Math.max(0, yBot - yTop), end: running };
  });

  const explanation = style === 'aggressive' ? aggressiveExplanation : passiveExplanation;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Execution style">
        {(
          [
            ['aggressive', aggressiveLabel],
            ['passive', passiveLabel],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStyle(key)}
            aria-pressed={style === key}
            className={cx(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors',
              style === key
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-300',
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{totalLabel}</span>
          <span className="font-mono font-semibold text-accent-600">
            {total.toFixed(0)} {unitLabel}
          </span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Waterfall of implementation-shortfall cost components under the ${style} style, summing to ${total} ${unitLabel}.`}
      >
        {/* gridline at top */}
        <line x1={padLeft} y1={padTop + plotH} x2={W - padRight} y2={padTop + plotH} stroke="var(--color-ink-300)" />

        {bars.map(({ c, v, x, yTop, h }, i) => (
          <g key={c.key}>
            <rect
              x={x}
              y={yTop}
              width={barW}
              height={h}
              rx={2}
              fill={c.key === 'impact' ? 'var(--color-brand-500)' : 'var(--color-brand-400)'}
              opacity={0.85}
              style={{ transition: 'all 300ms ease' }}
            />
            {v > 0 && (
              <text x={x + barW / 2} y={yTop - 4} fontSize={10} fill="var(--color-ink-600)" textAnchor="middle">
                {v}
              </text>
            )}
            {/* connector to next bar */}
            {i < bars.length - 1 && (
              <line
                x1={x + barW}
                y1={yToPx(bars[i].end)}
                x2={bars[i + 1].x}
                y2={yToPx(bars[i].end)}
                stroke="var(--color-ink-300)"
                strokeDasharray="3 2"
              />
            )}
            <text
              x={x + barW / 2}
              y={padTop + plotH + 14}
              fontSize={9.5}
              fill="var(--color-ink-600)"
              textAnchor="middle"
            >
              {c.label}
            </text>
          </g>
        ))}

        {/* total bar */}
        {(() => {
          const x = padLeft + components.length * slot + (slot - barW) / 2;
          const yTop = yToPx(total);
          const h = Math.max(0, yToPx(0) - yTop);
          return (
            <g>
              <rect x={x} y={yTop} width={barW} height={h} rx={2} fill="var(--color-accent-500)" style={{ transition: 'all 300ms ease' }} />
              <text x={x + barW / 2} y={yTop - 4} fontSize={10} fill="var(--color-accent-700)" textAnchor="middle" fontWeight={600}>
                {total.toFixed(0)}
              </text>
              <text x={x + barW / 2} y={padTop + plotH + 14} fontSize={9.5} fill="var(--color-ink-700)" textAnchor="middle" fontWeight={600}>
                {totalBarLabel}
              </text>
            </g>
          );
        })()}

        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {costAxisLabel} ({unitLabel})
        </text>
      </svg>

      <p className="mt-2 rounded-card bg-surface-50 px-4 py-3 text-sm leading-relaxed text-ink-700" aria-live="polite">
        {explanation}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default IsWaterfall;
