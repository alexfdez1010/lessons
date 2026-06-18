import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface BundleProfitSplitProps {
  /** Heading above the chart. */
  title?: string;
  /** Label + unit suffix for monetary amounts (e.g. ' USDC' or ' $'). */
  unitSuffix?: string;
  /** Starting gross opportunity value. Defaults to `1000`. */
  initialGross?: number;
  /** Maximum gross value on the slider. Defaults to `3000`. */
  maxGross?: number;
  /** Fixed gas + execution cost the searcher pays win or lose. Defaults to `40`. */
  gasCost?: number;
  /** Starting competition intensity (0–1: fraction of post-gas profit bid to the builder). Defaults to `0.85`. */
  initialBeta?: number;
  /** Slider label for gross opportunity. */
  grossLabel?: string;
  /** Slider label for competition intensity. */
  competitionLabel?: string;
  /** Readout label for the searcher's net take. */
  searcherLabel?: string;
  /** Readout label for the builder/validator payment. */
  builderLabel?: string;
  /** Readout label for gas. */
  gasLabel?: string;
  /** Label shown when the opportunity reverts at a loss. */
  revertLabel?: string;
  /** Caption: monopoly end of the slider. */
  monopolyLabel?: string;
  /** Caption: perfect-competition end of the slider. */
  perfectLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

const fmt = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Where on-chain arbitrage profit actually goes. A searcher finds a gross
 * opportunity worth `gross`. They first pay a fixed `gasCost` (sunk win or
 * lose). What remains — the post-gas profit — is split with the block builder /
 * validator by the competition intensity β: in a competitive priority-gas /
 * PBS auction the searcher must bid most of the profit away to win inclusion, so
 * builderPayment = (gross − gas)·β and searcherNet = (gross − gas)·(1 − β). The
 * learner drags the gross size and the competition dial and watches a stacked
 * bar reallocate the spoils — at β → 1 the searcher's slice collapses toward
 * zero and the builder/validator captures almost everything. If gas exceeds the
 * gross, the bundle reverts and the searcher simply eats the gas. Locale-agnostic.
 */
export function BundleProfitSplit({
  title = 'Who keeps the arbitrage profit?',
  unitSuffix = '',
  initialGross = 1000,
  maxGross = 3000,
  gasCost = 40,
  initialBeta = 0.85,
  grossLabel = 'Gross opportunity (after slippage)',
  competitionLabel = 'Competition intensity (β)',
  searcherLabel = 'Searcher net',
  builderLabel = 'Builder / validator',
  gasLabel = 'Gas',
  revertLabel = 'Reverts — searcher eats the gas',
  monopolyLabel = 'monopoly searcher keeps it all',
  perfectLabel = 'perfect competition → bid away',
  caption =
    'Gas comes off the top no matter what. Whatever profit is left gets split with whoever orders the block — and the fiercer the auction, the more of it the searcher must bid away to win inclusion. At full competition the spread you found ends up in the builder’s and validator’s pockets, not yours.',
  className,
}: BundleProfitSplitProps) {
  const id = useId();
  const [gross, setGross] = useState(initialGross);
  const [beta, setBeta] = useState(initialBeta);

  const postGas = gross - gasCost;
  const reverts = postGas <= 0;
  const builderPay = reverts ? 0 : postGas * beta;
  const searcherNet = reverts ? -gasCost : postGas * (1 - beta);

  // Bar segments as fractions of the gross (for the reverted case, gas fills it).
  const denom = Math.max(gross, gasCost);
  const segGas = useMemo(() => (gasCost / denom) * 100, [gasCost, denom]);
  const segBuilder = reverts ? 0 : (builderPay / denom) * 100;
  const segSearcher = reverts ? 0 : (searcherNet / denom) * 100;

  const ariaLabel =
    `${title}. ${grossLabel}: ${fmt(gross)}. ${competitionLabel}: ${beta.toFixed(2)}. ` +
    `${gasLabel}: ${fmt(gasCost)}. ${builderLabel}: ${fmt(builderPay)}. ` +
    `${searcherLabel}: ${fmt(searcherNet)}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 font-mono text-sm font-medium',
            searcherNet > 0 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
        >
          {searcherLabel}: {fmt(searcherNet)}
          {unitSuffix}
        </span>
      </figcaption>

      {/* Stacked bar */}
      <div
        className="mt-4 flex h-12 w-full overflow-hidden rounded-card border border-ink-100"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="flex items-center justify-center bg-warning text-xs font-semibold text-white transition-all duration-300"
          style={{ width: `${segGas}%` }}
        >
          {segGas > 8 ? gasLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-brand-500 text-xs font-semibold text-white transition-all duration-300"
          style={{ width: `${segBuilder}%` }}
        >
          {segBuilder > 14 ? builderLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-success text-xs font-semibold text-white transition-all duration-300"
          style={{ width: `${segSearcher}%` }}
        >
          {segSearcher > 14 ? searcherLabel : ''}
        </div>
      </div>
      {reverts && (
        <p className="mt-2 text-sm font-semibold text-warning">{revertLabel}</p>
      )}

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`${id}-gross`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{grossLabel}</span>
            <span className="font-mono text-ink-900">
              {fmt(gross)}
              {unitSuffix}
            </span>
          </label>
          <input
            id={`${id}-gross`}
            type="range"
            min={0}
            max={maxGross}
            step={maxGross / 120}
            value={gross}
            onChange={(e) => setGross(Number(e.target.value))}
            aria-label={grossLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-beta`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{competitionLabel}</span>
            <span className="font-mono text-ink-900">{beta.toFixed(2)}</span>
          </label>
          <input
            id={`${id}-beta`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={beta}
            onChange={(e) => setBeta(Number(e.target.value))}
            aria-label={competitionLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-400">
            <span>{monopolyLabel}</span>
            <span>{perfectLabel}</span>
          </div>
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gasLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-warning">
            {fmt(gasCost)}
            {unitSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{builderLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(builderPay)}
            {unitSuffix}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{searcherLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              searcherNet > 0 ? 'text-success' : 'text-warning',
            )}
          >
            {fmt(searcherNet)}
            {unitSuffix}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default BundleProfitSplit;
