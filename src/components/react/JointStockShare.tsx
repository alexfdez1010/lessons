import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ShareInvestor {
  /** Investor name shown on the bar segment and payout row. */
  name: string;
  /** Capital this investor pledges into the pooled company. */
  contribution: number;
}

export interface JointStockShareProps {
  /** Heading above the widget. */
  title?: string;
  /** One-line takeaway shown under the widget. */
  caption?: string;
  /** The investors pooling capital. Defaults to a VOC-style merchant syndicate. */
  investors?: ShareInvestor[];
  /** Label for the pooled-capital readout. */
  totalCapitalLabel?: string;
  /** Label for the profit/loss slider. */
  profitLabel?: string;
  /** Column header for an investor's ownership share. */
  shareLabel?: string;
  /** Column header for an investor's total payout when the company is wound up. */
  payoutLabel?: string;
  /** Column header for the investor's name. */
  investorLabel?: string;
  /** Column header for the capital each investor put in. */
  stakeLabel?: string;
  /** Label for the per-unit "value of one share" readout. */
  perShareLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'ƒ'` (the Dutch guilder). */
  currencyPrefix?: string;
  className?: string;
}

const DEFAULT_INVESTORS: ShareInvestor[] = [
  { name: 'Pieter', contribution: 4800 },
  { name: 'Anna', contribution: 3000 },
  { name: 'Joost', contribution: 1500 },
  { name: 'Klaas', contribution: 700 },
];

// Distinct, token-based fills so each investor's slice is legible.
const SEGMENT_FILLS = [
  'var(--color-brand-500)',
  'var(--color-accent-500)',
  'var(--color-brand-300)',
  'var(--color-accent-300)',
  'var(--color-brand-700)',
  'var(--color-accent-700)',
];

const fmt = (n: number): string =>
  Math.round(n).toLocaleString('en-US');

/**
 * JointStockShare — the single invention behind the joint-stock company: pool
 * capital from many investors into one permanent pot, slice that pot into equal
 * tradable *shares*, and split every profit (or loss) strictly in proportion to
 * how many shares each holder owns. A profit/loss slider drives the voyage's
 * outcome; the stacked bar shows who owns what; the table shows each investor's
 * payout when the company is wound up. Locale-agnostic — every string is a prop,
 * so the Spanish twin just passes Spanish copy. No motion beyond width
 * transitions, so it is `prefers-reduced-motion` friendly by construction.
 */
export function JointStockShare({
  title = 'Pool the capital, split the profit',
  caption,
  investors = DEFAULT_INVESTORS,
  totalCapitalLabel = 'Pooled capital',
  profitLabel = 'Voyage profit / loss',
  shareLabel = 'Share',
  payoutLabel = 'Payout',
  investorLabel = 'Investor',
  stakeLabel = 'Put in',
  perShareLabel = 'Value of one share',
  currencyPrefix = 'ƒ',
  className,
}: JointStockShareProps) {
  // Profit as a percentage of pooled capital, from a –50% loss to a +150% gain.
  const [profitPct, setProfitPct] = useState(60);
  const sliderId = useId();

  const total = useMemo(
    () => investors.reduce((s, i) => s + i.contribution, 0),
    [investors],
  );

  // One "share" = 100 guilders of capital, the VOC's actual share denomination.
  const SHARE_UNIT = 100;
  const totalShares = total / SHARE_UNIT;
  const finalValue = total * (1 + profitPct / 100);
  const perShare = totalShares > 0 ? finalValue / totalShares : 0;

  const money = (n: number) => `${currencyPrefix}${fmt(n)}`;
  const gain = profitPct >= 0;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {totalCapitalLabel}: {money(total)}
        </span>
      </figcaption>

      {/* Stacked ownership bar — each investor's slice is proportional to capital. */}
      <div
        className="mt-4 flex h-12 w-full overflow-hidden rounded-pill border border-ink-100"
        role="img"
        aria-label={investors
          .map((i) => `${i.name}: ${Math.round((i.contribution / total) * 100)}%`)
          .join(', ')}
      >
        {investors.map((inv, i) => {
          const pct = (inv.contribution / total) * 100;
          return (
            <div
              key={inv.name}
              className="flex items-center justify-center text-xs font-semibold text-white transition-[width] duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: SEGMENT_FILLS[i % SEGMENT_FILLS.length],
              }}
              title={`${inv.name} — ${pct.toFixed(1)}%`}
            >
              {pct >= 9 ? `${Math.round(pct)}%` : ''}
            </div>
          );
        })}
      </div>

      {/* Profit / loss slider */}
      <div className="mt-5">
        <label
          htmlFor={sliderId}
          className="flex items-center justify-between text-sm font-medium text-ink-700"
        >
          <span>{profitLabel}</span>
          <span
            className={cx(
              'font-mono font-semibold',
              gain ? 'text-brand-700' : 'text-accent-700',
            )}
          >
            {gain ? '+' : ''}
            {profitPct}%
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={-50}
          max={150}
          step={5}
          value={profitPct}
          onChange={(e) => setProfitPct(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600"
        />
        <div className="mt-1 flex justify-between font-mono text-xs text-ink-400">
          <span>−50%</span>
          <span>0%</span>
          <span>+150%</span>
        </div>
      </div>

      {/* Per-share readout */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <p className="text-xs text-ink-500">{perShareLabel}</p>
          <p
            className={cx(
              'font-mono text-lg font-semibold',
              perShare >= SHARE_UNIT ? 'text-brand-700' : 'text-accent-700',
            )}
            aria-live="polite"
          >
            {money(perShare)}
          </p>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <p className="text-xs text-ink-500">{totalShares} × {money(SHARE_UNIT)}</p>
          <p className="font-mono text-lg font-semibold text-ink-700" aria-live="polite">
            {money(finalValue)}
          </p>
        </div>
      </div>

      {/* Payout table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-ink-500">
              <th className="py-1.5 pr-3 font-medium">{investorLabel}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{stakeLabel}</th>
              <th className="py-1.5 pr-3 text-right font-medium">{shareLabel}</th>
              <th className="py-1.5 text-right font-medium">{payoutLabel}</th>
            </tr>
          </thead>
          <tbody>
            {investors.map((inv, i) => {
              const pct = (inv.contribution / total) * 100;
              const payout = (inv.contribution / total) * finalValue;
              return (
                <tr key={inv.name} className="border-b border-ink-100 last:border-0">
                  <td className="py-1.5 pr-3 font-medium text-ink-800">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ backgroundColor: SEGMENT_FILLS[i % SEGMENT_FILLS.length] }}
                    />
                    {inv.name}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink-600">
                    {money(inv.contribution)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink-600">
                    {pct.toFixed(1)}%
                  </td>
                  <td
                    className={cx(
                      'py-1.5 text-right font-mono font-semibold',
                      payout >= inv.contribution ? 'text-brand-700' : 'text-accent-700',
                    )}
                  >
                    {money(payout)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {caption && <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>}
    </figure>
  );
}

export default JointStockShare;
