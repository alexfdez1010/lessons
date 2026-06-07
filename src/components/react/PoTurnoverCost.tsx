import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PoTurnoverCostProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the cost-penalty slider. */
  penaltyLabel?: string;
  /** Caption under the slider 0 end (no penalty). */
  noPenaltyLabel?: string;
  /** Caption under the slider high end (heavy penalty). */
  heavyPenaltyLabel?: string;
  /** Readout label for gross alpha. */
  grossLabel?: string;
  /** Readout label for trading cost. */
  costLabel?: string;
  /** Readout label for net alpha after costs. */
  netLabel?: string;
  /** Readout label for turnover. */
  turnoverLabel?: string;
  /** Caption text. */
  caption?: string;
  className?: string;
}

/**
 * The transaction-cost trade-off. With no penalty, an optimizer chases every
 * tiny signal, racking up huge turnover and surrendering its gross edge to
 * trading costs — net alpha can go negative. Adding a turnover penalty (or
 * no-trade band) damps the rebalancing: turnover and cost fall fast, gross alpha
 * dips a little, and **net** alpha rises to a peak before over-damping starves
 * the strategy of signal. The slider sets the penalty; bars show gross, cost,
 * and net, with a turnover gauge. Locale-agnostic.
 */
export function PoTurnoverCost({
  title = 'Trading costs flip the optimal portfolio',
  penaltyLabel = 'Turnover penalty',
  noPenaltyLabel = 'No penalty: chase every signal',
  heavyPenaltyLabel = 'Heavy penalty: barely trade',
  grossLabel = 'Gross alpha',
  costLabel = 'Trading cost',
  netLabel = 'Net alpha',
  turnoverLabel = 'Turnover',
  caption = 'A cost-blind optimizer trades constantly, and the costs eat the edge — net alpha can sink below zero. Add a turnover penalty and trading collapses: costs fall faster than the gross edge, so net alpha climbs to a peak. Push the penalty too far and you trade so little the signal goes stale. The best portfolio depends on what trading it costs.',
  className,
}: PoTurnoverCostProps) {
  const id = useId();
  const [penalty, setPenalty] = useState(0.3);

  // Model: turnover falls with penalty; gross alpha falls slightly with penalty
  // (less responsiveness); cost ∝ turnover. Net = gross − cost.
  const { turnover, gross, cost, net } = useMemo(() => {
    const turnover = 2.4 * Math.exp(-2.6 * penalty); // annual turnover (e.g. 2.4 = 240%)
    const gross = 6.0 - 1.6 * penalty - 0.6 * penalty * penalty; // %
    const cost = 0.035 * turnover * 100; // bps→% style; tuned so cost is large at high turnover
    const net = gross - cost;
    return { turnover, gross, cost, net };
  }, [penalty]);

  const W = 520;
  const H = 220;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const vMax = 8;
  const vMin = -3;
  const toY = (v: number): number => padT + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const zeroY = toY(0);
  const cats = [
    { label: grossLabel, v: gross, color: 'var(--color-ink-400)' },
    { label: costLabel, v: -cost, color: 'var(--color-accent-500)' },
    { label: netLabel, v: net, color: net >= 0 ? 'var(--color-brand-600)' : 'var(--color-accent-600)' },
  ];
  const slot = plotW / cats.length;
  const bw = slot * 0.45;

  const ariaLabel = `${title}. With turnover penalty ${penalty.toFixed(2)}: ${turnoverLabel} ${(turnover * 100).toFixed(
    0,
  )} percent, ${grossLabel} ${gross.toFixed(1)} percent, ${costLabel} ${cost.toFixed(1)} percent, ${netLabel} ${net.toFixed(
    1,
  )} percent.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            net >= 0 ? 'bg-brand-600' : 'bg-accent-600',
          )}
        >
          {netLabel}: {net.toFixed(1)}%
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        {[-2, 0, 2, 4, 6, 8].map((tk) => (
          <g key={`y-${tk}`}>
            <line
              x1={padL}
              y1={toY(tk)}
              x2={W - padR}
              y2={toY(tk)}
              stroke={tk === 0 ? 'var(--color-ink-300)' : 'var(--color-ink-100)'}
              strokeWidth={tk === 0 ? 1.5 : 1}
            />
            <text x={padL - 6} y={toY(tk) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">{`${tk}%`}</text>
          </g>
        ))}
        {cats.map((c, i) => {
          const cx0 = padL + slot * (i + 0.5);
          const yTop = c.v >= 0 ? toY(c.v) : zeroY;
          const h = Math.abs(toY(c.v) - zeroY);
          return (
            <g key={`b-${i}`}>
              <rect x={cx0 - bw / 2} y={yTop} width={bw} height={Math.max(1, h)} rx={3} fill={c.color} opacity={0.9} />
              <text
                x={cx0}
                y={c.v >= 0 ? yTop - 5 : yTop + h + 12}
                textAnchor="middle"
                fontSize="11"
                fontWeight={600}
                fill="var(--color-ink-700)"
              >
                {c.v >= 0 ? c.v.toFixed(1) : c.v.toFixed(1)}%
              </text>
              <text x={cx0} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2">
        <label htmlFor={`${id}-p`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{penaltyLabel}</span>
          <span className="font-mono text-ink-900">{penalty.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-p`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={penalty}
          onChange={(e) => setPenalty(Number(e.target.value))}
          aria-label={penaltyLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{noPenaltyLabel}</span>
          <span>{heavyPenaltyLabel}</span>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2" aria-live="polite">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">{turnoverLabel}</span>
          <span className="font-mono font-semibold text-ink-900">{(turnover * 100).toFixed(0)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-ink-100">
          <div
            className="h-full rounded-pill bg-accent-500 transition-[width] duration-200"
            style={{ width: `${Math.min(100, (turnover / 2.6) * 100)}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PoTurnoverCost;
