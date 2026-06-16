import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface OnchainVolProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the true (continuous, off-chain) implied-vol line. */
  trueLabel?: string;
  /** Legend label for the on-chain oracle's sampled-and-held reading. */
  oracleLabel?: string;
  /** Legend label for the shaded staleness-gap band. */
  gapLabel?: string;
  /** Label for the fast-update toggle button. */
  fastLabel?: string;
  /** Label for the slow-update toggle button. */
  slowLabel?: string;
  /** Label for the x-axis (time). */
  timeLabel?: string;
  /** Label for the y-axis (annualized implied volatility). */
  volLabel?: string;
  /** Label for the worst-staleness-gap stat. */
  maxGapLabel?: string;
  /** Explanatory sentence shown in the aria-live note. */
  note?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const pct = (value: number, suffix: string): string => `${value.toFixed(0)}${suffix}`;

// 37 fine-grained observations of the "true" implied vol an off-chain desk sees
// continuously. Calm in the 50s, then a sharp vol spike (a crash) around points
// 16–22, then a slow decay back. An on-chain oracle only writes a fresh value
// every few blocks, so between writes it serves a STALE number — and the gap is
// widest exactly when vol is moving fastest.
const TRUE_IV = [
  52, 51, 53, 52, 54, 53, 52, 54, 55, 54, 56, 55, 57, 58, 60, 66, 82, 104, 118,
  110, 96, 84, 76, 70, 66, 63, 61, 59, 58, 57, 56, 55, 55, 54, 54, 53, 53,
];

/**
 * On-chain implied-volatility oracle. Off-chain desks watch implied vol move
 * continuously, but a blockchain oracle can only **write a new value every few
 * blocks** — so on-chain protocols read a *stale* number that lags the live
 * market. This island samples the true vol curve at a chosen interval and holds
 * it flat until the next update (the stepped line), shading the gap between the
 * stale reading and reality. The gap is harmless when vol is calm and dangerous
 * when vol is exploding — exactly when an on-chain options AMM is most likely to
 * misprice, and when an arbitrageur can trade against the lagging oracle. The
 * toggle slows the update cadence to show staleness getting worse. The true line
 * draws in on mount via stroke-dashoffset, gated by `motion-reduce`.
 */
export function OnchainVol({
  title = 'On-chain vol oracle: the price of a stale number',
  trueLabel = 'True implied vol (live, off-chain)',
  oracleLabel = 'On-chain oracle (sampled & held)',
  gapLabel = 'Staleness gap',
  fastLabel = 'Updates every 3 blocks',
  slowLabel = 'Updates every 6 blocks',
  timeLabel = 'Time (blocks)',
  volLabel = 'Annualized implied vol',
  maxGapLabel = 'Worst staleness gap',
  note = 'A blockchain cannot stream a live volatility number — an oracle writes one only every few blocks, then on-chain contracts read that frozen value until the next update. In calm markets nobody notices. But when vol gaps higher in a crash, the oracle keeps serving yesterday’s low number, so an on-chain options AMM quotes vol far too cheap — and an arbitrageur buys those underpriced options against the lagging oracle. Slower updates widen the gap. On-chain implied vol is always a delayed, manipulable approximation of the real thing.',
  percentSuffix = '%',
  className,
}: OnchainVolProps) {
  const [cadence, setCadence] = useState<'fast' | 'slow'>('fast');
  const step = cadence === 'fast' ? 3 : 6;
  const n = TRUE_IV.length;

  // Sample-and-hold: the oracle's value equals the true value at the most recent
  // update block, held flat until the next write.
  const oracle = TRUE_IV.map((_, i) => TRUE_IV[i - (i % step)]);

  const gaps = TRUE_IV.map((v, i) => Math.abs(v - oracle[i]));
  const maxGap = Math.max(...gaps);

  const W = 560;
  const H = 280;
  const padX = 42;
  const padY = 28;
  const minV = 40;
  const maxV = 130;

  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  // Smooth true line.
  const truePath = TRUE_IV.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  // Stepped oracle line (hold flat between writes).
  const oraclePath = oracle
    .map((v, i) => {
      const cmd = i === 0 ? `M ${x(i).toFixed(1)} ${y(v).toFixed(1)}` : '';
      if (i === 0) return cmd;
      // horizontal hold from previous point, then (if a write) a vertical step.
      const hold = `L ${x(i).toFixed(1)} ${y(oracle[i - 1]).toFixed(1)}`;
      const stepTo = v !== oracle[i - 1] ? ` L ${x(i).toFixed(1)} ${y(v).toFixed(1)}` : '';
      return `${hold}${stepTo}`;
    })
    .join(' ');

  // Gap band between the two lines, per segment.
  const bands = Array.from({ length: n - 1 }, (_, i) => {
    const x0 = x(i);
    const x1 = x(i + 1);
    const d = `M ${x0.toFixed(1)} ${y(TRUE_IV[i]).toFixed(1)} L ${x1.toFixed(1)} ${y(
      TRUE_IV[i + 1],
    ).toFixed(1)} L ${x1.toFixed(1)} ${y(oracle[i + 1]).toFixed(1)} L ${x0.toFixed(1)} ${y(
      oracle[i],
    ).toFixed(1)} Z`;
    return { d, key: i };
  });

  const lineLen = W * 2;
  const yTicks = [40, 70, 100, 130];

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div className="inline-flex rounded-pill border border-ink-200 p-0.5" role="group">
          <button
            type="button"
            onClick={() => setCadence('fast')}
            aria-pressed={cadence === 'fast'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              cadence === 'fast' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {fastLabel}
          </button>
          <button
            type="button"
            onClick={() => setCadence('slow')}
            aria-pressed={cadence === 'slow'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              cadence === 'slow' ? 'bg-accent-600 text-white' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {slowLabel}
          </button>
        </div>
      </figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-brand-600)' }} aria-hidden="true" />
          {trueLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-accent-600)' }} aria-hidden="true" />
          {oracleLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-accent-500)', opacity: 0.3 }} aria-hidden="true" />
          {gapLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: the true implied vol moves continuously, but the on-chain oracle, updating only every ${step} blocks, serves a stale value held flat between writes. The worst staleness gap is ${pct(
          maxGap,
          percentSuffix,
        )} of vol, occurring during the spike — exactly when an on-chain options market is most likely to misprice.`}
      >
        <style>{`
          @keyframes ocv-draw { to { stroke-dashoffset: 0; } }
          .ocv-line {
            stroke-dasharray: ${lineLen};
            stroke-dashoffset: ${lineLen};
            animation: ocv-draw 1.8s ease-out forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .ocv-line { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
          }
        `}</style>

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padX} y1={y(v)} x2={W - padX} y2={y(v)} stroke="var(--color-ink-100)" strokeWidth={1} />
            <text x={padX - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--color-ink-500)">
              {v}
            </text>
          </g>
        ))}

        {/* Staleness gap bands */}
        {bands.map((b) => (
          <path key={`${cadence}-${b.key}`} d={b.d} fill="var(--color-accent-500)" fillOpacity={0.16} stroke="none" />
        ))}

        {/* Oracle stepped line */}
        <path
          key={`oracle-${cadence}`}
          d={oraclePath}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* True implied-vol line */}
        <path
          d={truePath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="ocv-line"
        />

        {/* X-axis baseline */}
        <line x1={padX} y1={H - padY} x2={W - padX} y2={H - padY} stroke="var(--color-ink-200)" strokeWidth={1.5} />

        <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="var(--color-ink-500)">
          {timeLabel}
        </text>
        <text x={padX - 6} y={padY - 12} fontSize={11} fill="var(--color-ink-500)">
          {volLabel}
        </text>
      </svg>

      <div className="mt-3 text-sm">
        <span className="text-ink-600">
          {maxGapLabel}:{' '}
          <span className="font-medium text-accent-600">{pct(maxGap, percentSuffix)}</span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {note}
      </p>
    </figure>
  );
}

export default OnchainVol;
