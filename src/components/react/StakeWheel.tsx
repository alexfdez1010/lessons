import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface StakeWheelProps {
  /** Heading above the visual. */
  title?: string;
  /** One-line takeaway explaining weighted selection + slashing. */
  caption?: string;
  /** Word for a single validator (used in readouts). */
  validatorWord?: string;
  /** Column header for the staked-ETH amount. */
  stakeLabel?: string;
  /** Column header for the selection probability. */
  chanceLabel?: string;
  /** Button: deterministically pick the next proposer. */
  selectLabel?: string;
  /** Readout label naming the chosen proposer. */
  proposerLabel?: string;
  /** Phrase appended after the proposer name (the upside). */
  rewardLabel?: string;
  /** Button: slash the chosen (or default) cheater. */
  slashLabel?: string;
  /** Phrase appended after a slashed validator name (the downside). */
  slashedLabel?: string;
  /** Button: restore original stakes + clear selection. */
  resetLabel?: string;
  /** Unit suffix for staked amounts (not money). Defaults to `'ETH'`. */
  ethLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Generic validator names + their initial stake in ETH. */
const VALIDATOR_NAMES = ['V1', 'V2', 'V3', 'V4'] as const;
const INITIAL_STAKES = [320, 160, 96, 32] as const;
/** A slashed validator keeps this fraction of its stake. */
const SLASH_KEEP_FRACTION = 0.5;
/** Each segment uses a distinct brand/accent token so slices read apart. */
const SEGMENT_COLORS = [
  'var(--color-brand-600)',
  'var(--color-brand-400)',
  'var(--color-accent-500)',
  'var(--color-accent-300)',
] as const;

const formatEth = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(value),
  );

const formatPercent = (fraction: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(fraction);

/**
 * Interactive Ethereum proof-of-stake selection visual. Four validators hold
 * different stakes; a proportional "wheel" (segmented bar) shows that a bigger
 * stake = a wider slice = a higher chance of being chosen to propose the next
 * block. The "Select a proposer" button picks deterministically — no
 * randomness — via a weighted round-robin (each press adds every validator's
 * stake to an accumulator, the largest accumulator wins, then totalStake is
 * subtracted from the winner), so selections occur in proportion to stake.
 * "Slash a cheater" cuts the chosen validator's stake in half, live-recomputing
 * every chance to show that cheating costs real skin in the game and lifts
 * everyone else's relative odds. Animation is gated on `prefers-reduced-motion`.
 */
export function StakeWheel({
  title = 'Stake decides who proposes the next block',
  caption = 'Your chance of being chosen to propose a block is proportional to how much ETH you have staked. A validator caught cheating gets slashed — part of its stake is destroyed — so skin in the game replaces proof-of-work’s electricity bill.',
  validatorWord = 'Validator',
  stakeLabel = 'Stake',
  chanceLabel = 'Chance',
  selectLabel = 'Select a proposer',
  proposerLabel = 'Chosen proposer',
  rewardLabel = 'earns the block reward',
  slashLabel = 'Slash a cheater',
  slashedLabel = 'slashed — stake cut',
  resetLabel = 'Reset',
  ethLabel = 'ETH',
  className,
}: StakeWheelProps) {
  const id = useId();
  const [stakes, setStakes] = useState<number[]>([...INITIAL_STAKES]);
  const [accumulators, setAccumulators] = useState<number[]>(
    VALIDATOR_NAMES.map(() => 0),
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const [slashed, setSlashed] = useState<boolean[]>(
    VALIDATOR_NAMES.map(() => false),
  );
  const [pulse, setPulse] = useState(0); // 0 → 1 highlight pulse on selection
  const rafRef = useRef<number | null>(null);

  const total = stakes.reduce((sum, s) => sum + s, 0);

  // Deterministic, stake-proportional pick (weighted round-robin / largest
  // accumulator). Adding each stake then subtracting the total from the winner
  // makes long-run selection frequency match each validator's stake share.
  const handleSelect = () => {
    const next = stakes.map((s, i) => accumulators[i] + s);
    let winner = 0;
    for (let i = 1; i < next.length; i++) {
      if (next[i] > next[winner]) winner = i;
    }
    next[winner] -= total;
    setAccumulators(next);
    setChosen(winner);
    if (prefersReducedMotion()) {
      setPulse(1);
    } else {
      setPulse(0);
    }
  };

  // Cut the chosen validator (or V4 if none chosen yet) to half its stake.
  const handleSlash = () => {
    const target = chosen ?? VALIDATOR_NAMES.length - 1;
    setStakes((prev) =>
      prev.map((s, i) =>
        i === target ? Math.round(s * SLASH_KEEP_FRACTION) : s,
      ),
    );
    setSlashed((prev) => prev.map((v, i) => (i === target ? true : v)));
    setChosen(target);
  };

  const handleReset = () => {
    setStakes([...INITIAL_STAKES]);
    setAccumulators(VALIDATOR_NAMES.map(() => 0));
    setSlashed(VALIDATOR_NAMES.map(() => false));
    setChosen(null);
    setPulse(0);
  };

  // Pulse the chosen segment on selection (gated on reduced motion above).
  useEffect(() => {
    if (chosen === null) return;
    if (prefersReducedMotion()) return;
    setPulse(0);
    const duration = 600;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setPulse(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [chosen, stakes]);

  // Geometry for the proportional bar.
  const W = 520;
  const H = 64;
  const pad = 4;
  const barW = W - pad * 2;
  let cursor = pad;
  const segments = stakes.map((stake, i) => {
    const fraction = total > 0 ? stake / total : 0;
    const width = fraction * barW;
    const seg = { x: cursor, width, fraction, index: i };
    cursor += width;
    return seg;
  });

  const chosenName = chosen !== null ? VALIDATOR_NAMES[chosen] : null;
  const chosenSlashed = chosen !== null && slashed[chosen];

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
          {formatEth(total)} {ethLabel}
        </span>
      </figcaption>

      {/* Proportional "wheel" rendered as a segmented bar. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`Proportional stake bar: ${stakes
          .map(
            (s, i) =>
              `${VALIDATOR_NAMES[i]} ${formatEth(s)} ${ethLabel} (${formatPercent(
                total > 0 ? s / total : 0,
              )})`,
          )
          .join(', ')}. A wider slice means a higher chance of proposing the next block.`}
      >
        {segments.map((seg) => {
          const isChosen = seg.index === chosen;
          const grow = isChosen ? 1 + 0.06 * Math.sin(pulse * Math.PI) : 1;
          const cy = H / 2;
          const h = (H - pad * 2) * grow;
          const y = cy - h / 2;
          return (
            <g key={`${id}-seg-${seg.index}`}>
              <rect
                x={seg.x}
                y={y}
                width={Math.max(0, seg.width - 1)}
                height={h}
                rx={4}
                fill={SEGMENT_COLORS[seg.index]}
                stroke={
                  isChosen ? 'var(--color-ink-900)' : 'var(--color-surface)'
                }
                strokeWidth={isChosen ? 2 : 1}
                opacity={slashed[seg.index] ? 0.55 : 1}
              />
              {seg.width > 34 ? (
                <text
                  x={seg.x + seg.width / 2}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="var(--color-surface)"
                >
                  {VALIDATOR_NAMES[seg.index]}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {/* Per-validator stake + chance table. */}
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-ink-500">
            <th className="py-1 font-medium">{validatorWord}</th>
            <th className="py-1 text-right font-medium">{stakeLabel}</th>
            <th className="py-1 text-right font-medium">{chanceLabel}</th>
          </tr>
        </thead>
        <tbody>
          {stakes.map((stake, i) => {
            const isChosen = i === chosen;
            return (
              <tr
                key={`${id}-row-${i}`}
                className={cx(
                  'border-t border-ink-100',
                  isChosen && 'bg-surface-sunken/40',
                )}
              >
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-pill"
                      style={{ background: SEGMENT_COLORS[i] }}
                      aria-hidden="true"
                    />
                    <span
                      className={cx(
                        'font-mono text-ink-900',
                        isChosen && 'font-semibold',
                      )}
                    >
                      {VALIDATOR_NAMES[i]}
                    </span>
                    {slashed[i] ? (
                      <span className="rounded-pill bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
                        {slashedLabel}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono text-ink-700">
                  {formatEth(stake)} {ethLabel}
                </td>
                <td className="py-1.5 text-right font-mono font-semibold text-brand-700">
                  {formatPercent(total > 0 ? stake / total : 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSelect}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {selectLabel}
        </button>
        <button
          type="button"
          onClick={handleSlash}
          className="rounded-pill border border-accent-300 bg-surface px-4 py-2 text-sm font-medium text-accent-700 transition hover:bg-accent-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {slashLabel}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-300"
        >
          {resetLabel}
        </button>
      </div>

      {/* Result readout */}
      <div
        className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3 text-sm"
        aria-live="polite"
      >
        {chosenName === null ? (
          <span className="text-ink-500">{proposerLabel}: —</span>
        ) : chosenSlashed ? (
          <span className="text-ink-700">
            <span className="font-mono font-semibold text-accent-700">
              {chosenName}
            </span>{' '}
            {slashedLabel}.
          </span>
        ) : (
          <span className="text-ink-700">
            {proposerLabel}:{' '}
            <span className="font-mono font-semibold text-brand-700">
              {chosenName}
            </span>{' '}
            {rewardLabel}.
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default StakeWheel;
