import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * Props for {@link OfaRefundSplit}.
 *
 * Every user-facing string is a label prop so the component stays
 * locale-agnostic and the Spanish twin can pass translated copy verbatim.
 */
export interface OfaRefundSplitProps {
  /** Heading shown in the figcaption. */
  title?: string;
  /** Slider label for the gross extractable (back-run) value. */
  valueLabel?: string;
  /** Slider label for the searcher-competition dial (0–1). */
  competitionLabel?: string;
  /** Slider label for the share of the winning bid routed back to the user. */
  refundShareLabel?: string;
  /** Readout label for the amount refunded to the user. */
  userRefundLabel?: string;
  /** Readout label for the OFA operator's fee. */
  operatorFeeLabel?: string;
  /** Readout label for the searcher's residual profit. */
  searcherProfitLabel?: string;
  /** Caption under the competition slider's minimum (least competition). */
  fewSearchersLabel?: string;
  /** Caption under the competition slider's maximum (most competition). */
  manySearchersLabel?: string;
  /** Suffix appended after each "X%" readout, e.g. "of value created". */
  ofShareLabel?: string;
  /** Optional unit suffix appended after every money amount (amounts lead with `$`). */
  unitSuffix?: string;
  /** One-line takeaway rendered under the figure. */
  caption?: string;
  /** Extra classes merged onto the root `<figure>`. */
  className?: string;
}

/** Format a number as `$1,234` (+ optional unit suffix). */
const money = (v: number, unitSuffix: string): string =>
  `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}${unitSuffix}`;

/** Format a fraction-of-value as a whole-percent string, e.g. `81%`. */
const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;

/**
 * **Where the back-run value goes** — a live split of an order-flow auction (OFA).
 *
 * An OFA sells, in a sealed auction, the right to back-run a user's swap. The gross
 * extractable value that swap creates is `value`. Searchers bid for the right; how
 * close the winning bid lands to full value is set by `competition`
 * (`bid = competition · value`). The OFA then refunds a `refundShare` slice of that
 * bid to the user and keeps the rest as an operator fee. Whatever the winner did
 * **not** bid away stays with the searcher:
 *
 * - `userRefund   = refundShare · bid`
 * - `operatorFee  = (1 − refundShare) · bid`
 * - `searcherProfit = value − bid`
 *
 * The three add up to `value`, and the stacked bar (width = `value`) shows the split
 * as user (brand) ▸ operator (neutral ink) ▸ searcher (accent). The lesson it makes
 * obvious: drive `competition → 1` and the bid approaches full value, so the searcher's
 * slice collapses and the user pockets ~`refundShare` of the value their own order
 * created — the whole point of routing flow through an auction.
 */
export function OfaRefundSplit({
  title = 'Where the back-run value goes',
  valueLabel = 'Value your swap creates',
  competitionLabel = 'Searcher competition',
  refundShareLabel = 'Refund share to user',
  userRefundLabel = 'Refunded to you',
  operatorFeeLabel = 'OFA operator fee',
  searcherProfitLabel = 'Searcher keeps',
  fewSearchersLabel = 'one bidder',
  manySearchersLabel = 'many bidders',
  ofShareLabel = 'of value created',
  unitSuffix = '',
  caption = 'The auction turns your swap’s back-run value into a refund: the more searchers compete, the closer the winning bid lands to full value — and the bigger the slice that flows back to you instead of to whoever back-runs you.',
  className,
}: OfaRefundSplitProps) {
  const id = useId();
  const [value, setValue] = useState(100);
  const [competition, setCompetition] = useState(0.9);
  const [refundShare, setRefundShare] = useState(0.9);

  const bid = competition * value;
  const userRefund = refundShare * bid;
  const operatorFee = (1 - refundShare) * bid;
  const searcherProfit = value - bid;

  // Segment widths as a percentage of total value. Guard against value = 0.
  const denom = value > 0 ? value : 1;
  const userPct = (userRefund / denom) * 100;
  const operatorPct = (operatorFee / denom) * 100;
  const searcherPct = (searcherProfit / denom) * 100;

  const ariaLabel =
    `${title}. ${valueLabel}: ${money(value, unitSuffix)}. ` +
    `${userRefundLabel}: ${money(userRefund, unitSuffix)} (${pct(userRefund / denom)}). ` +
    `${operatorFeeLabel}: ${money(operatorFee, unitSuffix)} (${pct(operatorFee / denom)}). ` +
    `${searcherProfitLabel}: ${money(searcherProfit, unitSuffix)} (${pct(searcherProfit / denom)}).`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-500/15 px-3 py-1 font-mono text-sm font-medium text-brand-700">
          {userRefundLabel}: {money(userRefund, unitSuffix)}
        </span>
      </figcaption>

      {/* Stacked bar: user (brand) ▸ operator (ink) ▸ searcher (accent) */}
      <div
        className="mt-4 flex h-12 w-full overflow-hidden rounded-card border border-ink-100"
        role="img"
        aria-label={ariaLabel}
      >
        <div
          className="flex items-center justify-center bg-brand-500 text-xs font-semibold text-white transition-all duration-300"
          style={{ width: `${userPct}%` }}
        >
          {userPct > 14 ? userRefundLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-ink-300 text-xs font-semibold text-ink-900 transition-all duration-300"
          style={{ width: `${operatorPct}%` }}
        >
          {operatorPct > 14 ? operatorFeeLabel : ''}
        </div>
        <div
          className="flex items-center justify-center bg-accent-500 text-xs font-semibold text-white transition-all duration-300"
          style={{ width: `${searcherPct}%` }}
        >
          {searcherPct > 14 ? searcherProfitLabel : ''}
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-4">
        <div>
          <label
            htmlFor={`${id}-value`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{valueLabel}</span>
            <span className="font-mono text-ink-900">{money(value, unitSuffix)}</span>
          </label>
          <input
            id={`${id}-value`}
            type="range"
            min={0}
            max={200}
            step={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label={valueLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-competition`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{competitionLabel}</span>
            <span className="font-mono text-ink-900">{competition.toFixed(2)}</span>
          </label>
          <input
            id={`${id}-competition`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={competition}
            onChange={(e) => setCompetition(Number(e.target.value))}
            aria-label={competitionLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-500">
            <span>{fewSearchersLabel}</span>
            <span>{manySearchersLabel}</span>
          </div>
        </div>

        <div>
          <label
            htmlFor={`${id}-refund`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{refundShareLabel}</span>
            <span className="font-mono text-ink-900">{pct(refundShare)}</span>
          </label>
          <input
            id={`${id}-refund`}
            type="range"
            min={0.5}
            max={1}
            step={0.01}
            value={refundShare}
            onChange={(e) => setRefundShare(Number(e.target.value))}
            aria-label={refundShareLabel}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{userRefundLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(userRefund, unitSuffix)}
          </dd>
          <dd className="mt-0.5 text-xs text-ink-500">
            {pct(userRefund / denom)} {ofShareLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{operatorFeeLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-700">
            {money(operatorFee, unitSuffix)}
          </dd>
          <dd className="mt-0.5 text-xs text-ink-500">
            {pct(operatorFee / denom)} {ofShareLabel}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{searcherProfitLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {money(searcherProfit, unitSuffix)}
          </dd>
          <dd className="mt-0.5 text-xs text-ink-500">
            {pct(searcherProfit / denom)} {ofShareLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default OfaRefundSplit;
