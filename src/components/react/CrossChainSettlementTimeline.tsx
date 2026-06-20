import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CrossChainSettlementTimelineProps {
  /** Heading above the timeline. */
  title?: string;
  /**
   * Seconds per block / confirmation on the source chain. Drives the fixed
   * "block inclusion" segment and the per-confirmation cost of the finality
   * wait. Defaults to `12`.
   */
  blockSeconds?: number;
  /** Starting number of confirmations to wait for. Defaults to `12`. */
  initialConfirmations?: number;
  /** Minimum confirmations on the slider. Defaults to `1`. */
  minConfirmations?: number;
  /** Maximum confirmations on the slider. Defaults to `64`. */
  maxConfirmations?: number;
  /** Starting bridge relay latency in seconds. Defaults to `90`. */
  initialBridgeLatencySec?: number;
  /** Maximum bridge latency on the slider, in seconds. Defaults to `600`. */
  maxBridgeLatencySec?: number;
  /**
   * Annualized volatility (as a fraction, e.g. `0.8` = 80%) used to translate
   * the exposure window into an illustrative price-drift figure. Defaults to
   * `0.8`. Set the readout label empty to hide it conceptually.
   */
  annualizedVol?: number;

  /** Label for stage 1: the sell leg is broadcast on chain A at t=0. */
  sellLegLabel?: string;
  /** Label for stage 2: the sell leg lands in a block on chain A. */
  blockInclusionLabel?: string;
  /** Label for stage 3: waiting out confirmations for finality on chain A. */
  finalityWaitLabel?: string;
  /** Label for stage 4: the bridge relays the message to chain B. */
  bridgeRelayLabel?: string;
  /** Label for stage 5: the buy leg executes on chain B (the end). */
  buyLegLabel?: string;

  /** Slider label for the confirmations control. */
  confirmationsLabel?: string;
  /** Slider label for the bridge-latency control. */
  bridgeLatencyLabel?: string;

  /** Readout label for the at-risk exposure window. */
  exposureLabel?: string;
  /** Readout label for the total settlement time. */
  totalLabel?: string;
  /** Readout label for the illustrative price drift over the window. */
  driftLabel?: string;

  /** Chip/comparison label for the atomic single-chain baseline. */
  atomicLabel?: string;
  /** Short note describing the atomic baseline's near-zero exposure. */
  atomicNote?: string;

  /** Suffix appended to second values (e.g. ` s`). */
  secondsSuffix?: string;
  /** Suffix appended to minute values (e.g. ` min`). */
  minutesSuffix?: string;

  /** One-line takeaway under the timeline. */
  caption?: string;
  className?: string;
}

/** Format a whole-second duration, switching to minutes past 90s for readability. */
const dur = (
  seconds: number,
  secondsSuffix: string,
  minutesSuffix: string,
): string => {
  if (seconds < 90) {
    return `${Math.round(seconds)}${secondsSuffix}`;
  }
  const mins = seconds / 60;
  return `${mins.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}${minutesSuffix}`;
};

/**
 * Why cross-chain arbitrage is not atomic — and what that costs you.
 *
 * A single-chain ("on-chain") arb is one all-or-nothing transaction: it either
 * lands in a block with both legs settled, or it reverts. Its exposure window —
 * the time during which the price can move against you mid-trade — is essentially
 * one block, and the price risk is ~zero because the bundle is atomic.
 *
 * A cross-chain arb is two separate transactions on two separate ledgers. You
 * sell on chain A, wait for the block to include it, then wait for enough
 * *confirmations* that the inclusion is final (so a reorg can't undo it), then a
 * *bridge* relays a proof/message to chain B, and only then does the buy leg
 * execute. The stretch from "sell submitted" to "buy executes" is irreducibly
 * non-atomic: during the finality wait plus the bridge relay, the destination
 * price can drift, and you are holding inventory you can't yet close. That gap is
 * the **exposure window**.
 *
 * This island renders the five stages as a proportional horizontal bar and lets
 * the learner drag two dials:
 *   - **confirmations** — each one adds `blockSeconds` to the finality wait.
 *     Deeper finality is safer against reorgs but stretches the at-risk window.
 *   - **bridge latency** — slower bridges lengthen the relay segment directly.
 * The highlighted exposure-window readout (= finality wait + bridge relay) and an
 * illustrative price-drift figure (scaled by `annualizedVol` over the window)
 * make the core trade-off concrete: deeper finality protection buys safety
 * against reorgs at the price of a longer window in which the price can move
 * against you. A comparison chip contrasts the atomic single-chain baseline,
 * whose exposure window is ~one block. Every user-facing string is a prop, so the
 * Spanish twin passes Spanish copy. Locale-agnostic.
 */
export function CrossChainSettlementTimeline({
  title = 'Cross-chain arb: the exposure window',
  blockSeconds = 12,
  initialConfirmations = 12,
  minConfirmations = 1,
  maxConfirmations = 64,
  initialBridgeLatencySec = 90,
  maxBridgeLatencySec = 600,
  annualizedVol = 0.8,
  sellLegLabel = 'Sell leg submitted (Chain A)',
  blockInclusionLabel = 'Block inclusion (Chain A)',
  finalityWaitLabel = 'Finality wait (Chain A)',
  bridgeRelayLabel = 'Bridge relay',
  buyLegLabel = 'Buy leg executes (Chain B)',
  confirmationsLabel = 'Confirmations waited (finality depth)',
  bridgeLatencyLabel = 'Bridge latency',
  exposureLabel = 'Exposure window (price can drift)',
  totalLabel = 'Total settlement time',
  driftLabel = 'Illustrative price drift',
  atomicLabel = 'Atomic single-chain arb',
  atomicNote = 'One block, exposure ≈ 0 — both legs settle together or not at all.',
  secondsSuffix = ' s',
  minutesSuffix = ' min',
  caption =
    'A single-chain arb is one atomic transaction — both legs settle in the same block, so the price never gets a chance to move against you. A cross-chain arb is two transactions on two ledgers, separated by a finality wait and a bridge relay. Wait for more confirmations and you’re safer against reorgs, but the at-risk window — and the price drift that can eat your spread — grows right along with it.',
  className,
}: CrossChainSettlementTimelineProps) {
  const id = useId();
  const [confirmations, setConfirmations] = useState(initialConfirmations);
  const [bridgeLatencySec, setBridgeLatencySec] = useState(
    initialBridgeLatencySec,
  );

  // Stage durations (seconds).
  const submitSec = useMemo(() => blockSeconds * 0.25, [blockSeconds]);
  const inclusionSec = blockSeconds;
  const finalitySec = confirmations * blockSeconds;
  const relaySec = bridgeLatencySec;
  // The buy leg executes in a single destination block.
  const buyExecSec = blockSeconds;

  const exposureSec = finalitySec + relaySec;
  const totalSec = submitSec + inclusionSec + finalitySec + relaySec + buyExecSec;

  // Illustrative price drift over the window: vol scaled to the window length
  // (sqrt-of-time, vs. a 1-year baseline in seconds), expressed in percent.
  const yearSec = 365 * 24 * 3600;
  const driftPct = annualizedVol * Math.sqrt(exposureSec / yearSec) * 100;

  // Atomic baseline: one block, ~zero exposure.
  const atomicTotalSec = blockSeconds;

  // Bar segment widths as % of the total.
  const pct = (s: number): number => (totalSec > 0 ? (s / totalSec) * 100 : 0);
  const segSubmit = pct(submitSec);
  const segInclusion = pct(inclusionSec);
  const segFinality = pct(finalitySec);
  const segRelay = pct(relaySec);
  const segBuy = pct(buyExecSec);

  const ariaLabel =
    `${title}. ${confirmationsLabel}: ${confirmations}. ` +
    `${bridgeLatencyLabel}: ${dur(relaySec, secondsSuffix, minutesSuffix)}. ` +
    `${finalityWaitLabel}: ${dur(finalitySec, secondsSuffix, minutesSuffix)}. ` +
    `${bridgeRelayLabel}: ${dur(relaySec, secondsSuffix, minutesSuffix)}. ` +
    `${exposureLabel}: ${dur(exposureSec, secondsSuffix, minutesSuffix)}. ` +
    `${totalLabel}: ${dur(totalSec, secondsSuffix, minutesSuffix)}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-warning/15 px-3 py-1 font-mono text-sm font-medium text-warning">
          {exposureLabel}: {dur(exposureSec, secondsSuffix, minutesSuffix)}
        </span>
      </figcaption>

      {/* Proportional timeline */}
      <div
        className="mt-4 flex h-12 w-full overflow-hidden rounded-card border border-ink-100"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="flex items-center justify-center bg-brand-500 text-center text-[10px] font-semibold leading-tight text-white transition-all duration-300"
          style={{ width: `${segSubmit}%` }}
          title={sellLegLabel}
        >
          {segSubmit > 16 ? sellLegLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-brand-400 text-center text-[10px] font-semibold leading-tight text-white transition-all duration-300"
          style={{ width: `${segInclusion}%` }}
          title={blockInclusionLabel}
        >
          {segInclusion > 16 ? blockInclusionLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-warning text-center text-[10px] font-semibold leading-tight text-white transition-all duration-300"
          style={{ width: `${segFinality}%` }}
          title={finalityWaitLabel}
        >
          {segFinality > 16 ? finalityWaitLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-warning/70 text-center text-[10px] font-semibold leading-tight text-white transition-all duration-300"
          style={{ width: `${segRelay}%` }}
          title={bridgeRelayLabel}
        >
          {segRelay > 16 ? bridgeRelayLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-success text-center text-[10px] font-semibold leading-tight text-white transition-all duration-300"
          style={{ width: `${segBuy}%` }}
          title={buyLegLabel}
        >
          {segBuy > 16 ? buyLegLabel : ''}
        </div>
      </div>

      {/* The at-risk band marker: finality + relay = exposure */}
      <p className="mt-2 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-3 rounded-pill bg-warning"
            aria-hidden="true"
          />
          {finalityWaitLabel} + {bridgeRelayLabel} = {exposureLabel}
        </span>
      </p>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`${id}-conf`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{confirmationsLabel}</span>
            <span className="font-mono text-ink-900">
              {confirmations} ({dur(finalitySec, secondsSuffix, minutesSuffix)})
            </span>
          </label>
          <input
            id={`${id}-conf`}
            type="range"
            min={minConfirmations}
            max={maxConfirmations}
            step={1}
            value={confirmations}
            onChange={(e) => setConfirmations(Number(e.target.value))}
            aria-label={confirmationsLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-bridge`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{bridgeLatencyLabel}</span>
            <span className="font-mono text-ink-900">
              {dur(relaySec, secondsSuffix, minutesSuffix)}
            </span>
          </label>
          <input
            id={`${id}-bridge`}
            type="range"
            min={0}
            max={maxBridgeLatencySec}
            step={5}
            value={bridgeLatencySec}
            onChange={(e) => setBridgeLatencySec(Number(e.target.value))}
            aria-label={bridgeLatencyLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{exposureLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-warning">
            {dur(exposureSec, secondsSuffix, minutesSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {dur(totalSec, secondsSuffix, minutesSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{driftLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-warning">
            ±
            {driftPct.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            %
          </dd>
        </div>
      </dl>

      {/* Atomic baseline comparison chip */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2 text-sm">
        <span className="rounded-pill bg-success/15 px-3 py-1 font-mono text-xs font-medium text-success">
          {atomicLabel}: {dur(atomicTotalSec, secondsSuffix, minutesSuffix)}
        </span>
        <span className="text-ink-600">{atomicNote}</span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CrossChainSettlementTimeline;
