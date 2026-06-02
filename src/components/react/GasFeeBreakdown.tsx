import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface GasFeeBreakdownProps {
  /** Heading above the visual. */
  title?: string;
  /** One-line takeaway: base fee is burned, tip pays the validator. */
  caption?: string;
  /** Label for the network-demand (congestion) slider. */
  congestionLabel?: string;
  /** Low end of the congestion slider. */
  lowLabel?: string;
  /** High end of the congestion slider. */
  highLabel?: string;
  /** Readout label for the derived base fee. */
  baseFeeLabel?: string;
  /** Label for the priority-tip slider. */
  tipLabel?: string;
  /** Label for the transaction-type (gas used) selector. */
  gasUsedLabel?: string;
  /** Segmented-button label: simple ETH transfer. */
  transferLabel?: string;
  /** Segmented-button label: token swap. */
  swapLabel?: string;
  /** Segmented-button label: NFT mint. */
  mintLabel?: string;
  /** Legend/readout label for the burned (base-fee) portion. */
  burnedLabel?: string;
  /** Legend/readout label for the validator (tip) portion. */
  validatorLabel?: string;
  /** Readout label for the total fee. */
  totalLabel?: string;
  /** Unit suffix for per-unit gas prices. Defaults to `'gwei'`. */
  gweiLabel?: string;
  /** Unit suffix for total amounts in ether. Defaults to `'ETH'`. */
  ethLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Gas-used presets per transaction kind (units of gas). */
const GAS_PRESETS = {
  transfer: 21_000,
  swap: 120_000,
  mint: 80_000,
} as const;

type TxKind = keyof typeof GAS_PRESETS;

/** 1 ETH = 1,000,000,000 gwei. */
const GWEI_PER_ETH = 1_000_000_000;

/** Map a 0..100 congestion value to a base fee in gwei (~5 calm → ~150 busy). */
const baseFeeFromCongestion = (congestion: number): number =>
  Math.round(5 + congestion * 1.45);

const ethFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
const gweiFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Interactive EIP-1559 gas-fee breakdown. The learner scrubs network demand
 * (which moves the burned base fee), picks a priority tip, and picks a
 * transaction type (which fixes the gas used). The total fee
 * `gas × (base fee + tip)` is split into a stacked bar: the base-fee portion is
 * burned (brand color, removed from supply) and the tip portion rewards the
 * validator (accent color). Busier network ⇒ higher base fee ⇒ higher total.
 * No motion is required; the bar transitions are skipped under
 * `prefers-reduced-motion`.
 */
export function GasFeeBreakdown({
  title = 'Where your gas fee goes (EIP-1559)',
  caption = 'Every transaction pays gas used × (base fee + priority tip). The base fee is destroyed — burned out of the ETH supply forever — while only the tip rewards the validator who includes you. A busier network pushes the base fee up, so the same transaction costs more.',
  congestionLabel = 'Network demand',
  lowLabel = 'calm',
  highLabel = 'busy',
  baseFeeLabel = 'Base fee',
  tipLabel = 'Priority tip',
  gasUsedLabel = 'Transaction type (gas used)',
  transferLabel = 'Simple ETH transfer',
  swapLabel = 'Token swap',
  mintLabel = 'NFT mint',
  burnedLabel = 'Burned (base fee)',
  validatorLabel = 'To validator (tip)',
  totalLabel = 'Total fee',
  gweiLabel = 'gwei',
  ethLabel = 'ETH',
  className,
}: GasFeeBreakdownProps) {
  const id = useId();
  const [congestion, setCongestion] = useState(30);
  const [tip, setTip] = useState(2);
  const [kind, setKind] = useState<TxKind>('swap');

  const gasUsed = GAS_PRESETS[kind];
  const baseFee = baseFeeFromCongestion(congestion);

  // All fee figures in gwei, then converted to ETH for display.
  const burnedGwei = gasUsed * baseFee;
  const tipGwei = gasUsed * tip;
  const feeGwei = burnedGwei + tipGwei;

  const burnedEth = burnedGwei / GWEI_PER_ETH;
  const tipEth = tipGwei / GWEI_PER_ETH;
  const feeEth = feeGwei / GWEI_PER_ETH;

  // Bar split as percentages (guard against a zero-fee divide).
  const burnedPct = feeGwei > 0 ? (burnedGwei / feeGwei) * 100 : 100;
  const tipPct = 100 - burnedPct;

  const transitionClass = prefersReducedMotion()
    ? ''
    : 'transition-[width] duration-300 ease-out';

  const segments: { value: TxKind; label: string; gas: number }[] = [
    { value: 'transfer', label: transferLabel, gas: GAS_PRESETS.transfer },
    { value: 'swap', label: swapLabel, gas: GAS_PRESETS.swap },
    { value: 'mint', label: mintLabel, gas: GAS_PRESETS.mint },
  ];

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
          {totalLabel}: {ethFmt.format(feeEth)} {ethLabel}
        </span>
      </figcaption>

      {/* Controls */}
      <div className="mt-4 space-y-5">
        {/* Network demand → base fee */}
        <div>
          <label
            htmlFor={`${id}-congestion`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{congestionLabel}</span>
            <span className="font-mono text-ink-900">
              {baseFeeLabel}: {gweiFmt.format(baseFee)} {gweiLabel}
            </span>
          </label>
          <input
            id={`${id}-congestion`}
            type="range"
            min={0}
            max={100}
            step={1}
            value={congestion}
            onChange={(e) => setCongestion(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-500">
            <span>{lowLabel}</span>
            <span>{highLabel}</span>
          </div>
        </div>

        {/* Priority tip */}
        <div>
          <label
            htmlFor={`${id}-tip`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{tipLabel}</span>
            <span className="font-mono text-ink-900">
              {gweiFmt.format(tip)} {gweiLabel}
            </span>
          </label>
          <input
            id={`${id}-tip`}
            type="range"
            min={0}
            max={10}
            step={1}
            value={tip}
            onChange={(e) => setTip(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        {/* Transaction type (gas used) */}
        <div>
          <span className="text-sm text-ink-700">{gasUsedLabel}</span>
          <div
            role="group"
            aria-label={gasUsedLabel}
            className="mt-2 grid grid-cols-3 gap-2"
          >
            {segments.map((seg) => {
              const active = seg.value === kind;
              return (
                <button
                  key={seg.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(seg.value)}
                  className={cx(
                    'rounded-card border px-3 py-2 text-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                    active
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-ink-100 bg-surface-sunken/40 text-ink-700 hover:border-brand-300',
                  )}
                >
                  <span className="block">{seg.label}</span>
                  <span
                    className={cx(
                      'mt-0.5 block font-mono text-xs',
                      active ? 'text-white/80' : 'text-ink-500',
                    )}
                  >
                    {gweiFmt.format(seg.gas)} gas
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-brand-500"
            aria-hidden="true"
          />
          {burnedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-accent-500"
            aria-hidden="true"
          />
          {validatorLabel}
        </span>
      </div>

      {/* Stacked fee bar */}
      <div
        role="img"
        aria-label={`${totalLabel}: ${ethFmt.format(
          feeEth,
        )} ${ethLabel}. ${burnedLabel}: ${ethFmt.format(
          burnedEth,
        )} ${ethLabel}. ${validatorLabel}: ${ethFmt.format(
          tipEth,
        )} ${ethLabel}.`}
        className="mt-3 flex h-10 w-full overflow-hidden rounded-card border border-ink-100 bg-surface-sunken/40"
      >
        <div
          className={cx(
            'flex items-center justify-center bg-brand-500',
            transitionClass,
          )}
          style={{ width: `${burnedPct}%` }}
        >
          {burnedPct >= 12 && (
            <span className="px-2 font-mono text-xs font-semibold text-white">
              {Math.round(burnedPct)}%
            </span>
          )}
        </div>
        <div
          className={cx(
            'flex items-center justify-center bg-accent-500',
            transitionClass,
          )}
          style={{ width: `${tipPct}%` }}
        >
          {tipPct >= 12 && (
            <span className="px-2 font-mono text-xs font-semibold text-white">
              {Math.round(tipPct)}%
            </span>
          )}
        </div>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{burnedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {ethFmt.format(burnedEth)} {ethLabel}
          </dd>
          <dd className="font-mono text-xs text-ink-500">
            {gweiFmt.format(baseFee)} {gweiLabel} × {gweiFmt.format(gasUsed)} gas
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{validatorLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {ethFmt.format(tipEth)} {ethLabel}
          </dd>
          <dd className="font-mono text-xs text-ink-500">
            {gweiFmt.format(tip)} {gweiLabel} × {gweiFmt.format(gasUsed)} gas
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{totalLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {ethFmt.format(feeEth)} {ethLabel}
          </dd>
          <dd className="font-mono text-xs text-ink-500">
            {gweiFmt.format(baseFee + tip)} {gweiLabel} × {gweiFmt.format(gasUsed)} gas
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default GasFeeBreakdown;
