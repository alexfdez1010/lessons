import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface HalvingSupplyProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the cumulative-supply curve. */
  supplyLabel?: string;
  /** Legend label for the block-reward step line. */
  rewardLabel?: string;
  /** Label for the dashed 21M asymptote line. */
  capLabel?: string;
  /** Label for the halving-epoch slider/readout. */
  epochLabel?: string;
  /** Label prefixing the approximate calendar year. */
  yearLabel?: string;
  /** Readout label for cumulative coins mined so far. */
  circulatingLabel?: string;
  /** Readout label for the current block reward. */
  rewardReadoutLabel?: string;
  /** Unit suffix for coin amounts (not money). Defaults to `'BTC'`. */
  unitLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Bitcoin protocol constants. */
const BLOCKS_PER_EPOCH = 210_000;
const INITIAL_REWARD = 50;
const GENESIS_YEAR = 2009;
const YEARS_PER_EPOCH = 4;
/** Number of halving epochs we plot — enough to flatten against the cap. */
const PLOTTED_EPOCHS = 9;
/** The asymptotic total supply the curve approaches but never exceeds. */
const SUPPLY_CAP = 21_000_000;

/** Block reward after `k` halvings (50, 25, 12.5, 6.25, …). */
const rewardAt = (epoch: number): number => INITIAL_REWARD / Math.pow(2, epoch);

/** Cumulative coins mined through the end of epoch `k`. */
const cumulativeSupply = (epoch: number): number => {
  let total = 0;
  for (let i = 0; i <= epoch; i++) {
    total += BLOCKS_PER_EPOCH * rewardAt(i);
  }
  return total;
};

const coins = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );

/** Format a (possibly fractional) block reward like 50, 6.25, 3.125. */
const reward = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value);

/**
 * Interactive Bitcoin supply / halving chart. A cumulative-supply curve climbs
 * toward the fixed 21,000,000 cap (a dashed asymptote it approaches but never
 * crosses), while a stepped block-reward line drops by half at each halving
 * epoch — 50 → 25 → 12.5 → 6.25 → … Each halving adds less new supply, so the
 * curve visibly flattens. Scrub the epoch slider and the year, current block
 * reward and coins-mined-so-far readouts update live. The curve animates in on
 * mount; respects `prefers-reduced-motion` (jumps straight to the drawn curve).
 */
export function HalvingSupply({
  title = 'A capped supply that halves its way to 21M',
  supplyLabel = 'Coins in circulation',
  rewardLabel = 'Block reward per block',
  capLabel = '21M cap',
  epochLabel = 'Halving',
  yearLabel = '≈ Year',
  circulatingLabel = 'Mined so far',
  rewardReadoutLabel = 'Current block reward',
  unitLabel = 'BTC',
  caption = 'The block reward halves every ~210,000 blocks (about every four years). Each halving adds less new supply, so the curve flattens toward 21,000,000 coins — and never exceeds it.',
  className,
}: HalvingSupplyProps) {
  const id = useId();
  const [epoch, setEpoch] = useState(0);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 220;
  const padX = 10;
  const padY = 14;

  // Plotted points: one per epoch boundary (cumulative supply after each).
  const lastEpoch = PLOTTED_EPOCHS;
  const x = (e: number) => padX + (e / lastEpoch) * (W - padX * 2);
  const yCap = padY; // cap sits at the top of the plot
  const yFloor = H - padY; // zero supply at the bottom
  const ySupply = (v: number) =>
    yFloor - (v / SUPPLY_CAP) * (yFloor - yCap);
  // Reward is mapped on the same canvas, scaled to the initial reward.
  const yReward = (r: number) =>
    yFloor - (r / INITIAL_REWARD) * (yFloor - yCap);

  // Cumulative-supply curve, revealed left→right up to `progress`.
  const supplyPath = () => {
    const upto = progress * lastEpoch;
    let d = `M ${x(0)} ${ySupply(cumulativeSupply(0))}`;
    for (let e = 1; e <= lastEpoch; e++) {
      if (e > upto) {
        // Interpolate the partially revealed final segment.
        const e0 = e - 1;
        const f = upto - e0;
        const v0 = cumulativeSupply(e0);
        const v1 = cumulativeSupply(e);
        const v = v0 + (v1 - v0) * f;
        d += ` L ${x(upto)} ${ySupply(v)}`;
        break;
      }
      d += ` L ${x(e)} ${ySupply(cumulativeSupply(e))}`;
    }
    return d;
  };

  // Descending reward step line: flat across an epoch, then halves.
  const rewardPath = () => {
    let d = `M ${x(0)} ${yReward(rewardAt(0))}`;
    for (let e = 1; e <= lastEpoch; e++) {
      d += ` L ${x(e)} ${yReward(rewardAt(e - 1))}`; // flat to the halving
      d += ` L ${x(e)} ${yReward(rewardAt(e))}`; // step down
    }
    return d;
  };

  // Animate the supply curve drawing in on mount.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1100;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const currentReward = rewardAt(epoch);
  const currentSupply = cumulativeSupply(epoch);
  const currentYear = GENESIS_YEAR + epoch * YEARS_PER_EPOCH;

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
          {capLabel}: {coins(SUPPLY_CAP)} {unitLabel}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {supplyLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {rewardLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-500">
          <span
            className="h-0 w-5 border-t-2 border-dashed border-ink-200"
            aria-hidden="true"
          />
          {capLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: the block reward halves from ${reward(
          INITIAL_REWARD,
        )} ${unitLabel} at each epoch, so the cumulative supply curve flattens as it approaches the ${coins(
          SUPPLY_CAP,
        )} ${unitLabel} cap and never exceeds it.`}
      >
        {/* 21M cap asymptote */}
        <line
          x1={padX}
          y1={yCap}
          x2={W - padX}
          y2={yCap}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={yFloor}
          x2={W - padX}
          y2={yFloor}
          stroke="var(--color-ink-100)"
        />
        {/* Descending block-reward step line */}
        <path
          d={rewardPath()}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Cumulative-supply curve, animated reveal */}
        <path
          d={supplyPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Halving dots on the supply curve */}
        {Array.from({ length: lastEpoch + 1 }, (_, e) => {
          const revealed = progress * lastEpoch >= e;
          if (!revealed) return null;
          const cx0 = x(e);
          const cy0 = ySupply(cumulativeSupply(e));
          return (
            <circle
              key={`${id}-dot-${e}`}
              cx={cx0}
              cy={cy0}
              r={e === epoch ? 5 : 3}
              fill={
                e === epoch
                  ? 'var(--color-brand-600)'
                  : 'var(--color-brand-400)'
              }
              stroke="var(--color-surface)"
              strokeWidth={e === epoch ? 2 : 1}
            />
          );
        })}
      </svg>

      {/* Epoch slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-epoch`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{epochLabel}</span>
          <span className="font-mono text-ink-900">
            #{epoch} · {yearLabel} {currentYear}
          </span>
        </label>
        <input
          id={`${id}-epoch`}
          type="range"
          min={0}
          max={lastEpoch}
          step={1}
          value={epoch}
          onChange={(e) => setEpoch(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{rewardReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {reward(currentReward)} {unitLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{circulatingLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {coins(currentSupply)} {unitLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default HalvingSupply;
