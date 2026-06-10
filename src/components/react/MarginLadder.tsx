import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MarginLadderProps {
  /** Heading above the simulator. */
  title?: string;
  /** Label for the equity bar / running balance. */
  equityLabel?: string;
  /** Label for the initial-margin reference line. */
  initialMarginLabel?: string;
  /** Label for the maintenance-margin reference line. */
  maintenanceLabel?: string;
  /** Label for the daily price-change column. */
  priceMoveLabel?: string;
  /** Label for the daily mark-to-market cash flow column. */
  variationLabel?: string;
  /** Badge shown on a day that triggers a margin call. */
  marginCallLabel?: string;
  /** Badge shown on a day the account is comfortably above maintenance. */
  okLabel?: string;
  /** Button that advances one trading day. */
  stepLabel?: string;
  /** Button shown once the last day is reached. */
  resetLabel?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** One-line takeaway shown under the simulator. */
  caption?: string;
  className?: string;
}

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`;
};

const signed = (prefix: string, value: number): string =>
  `${value >= 0 ? '+' : '−'}${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`;

/**
 * Mark-to-market / margin-call simulator. A futures position is settled daily:
 * each day the contract's price change is multiplied by the contract size and
 * swept into or out of the trader's margin account as variation margin. Step
 * through the days and watch the equity bar rise and fall; when equity drops
 * below the maintenance line, a margin call fires and the account must be topped
 * back up to the initial level. Deterministic, locale-agnostic (all strings are
 * props, no numbers baked into labels). No animation loop, so nothing to gate on
 * `prefers-reduced-motion`; the only transition is a CSS height tween that
 * already honours `motion-reduce`.
 */
export function MarginLadder({
  title = 'Mark-to-market: the daily true-up',
  equityLabel = 'Account equity',
  initialMarginLabel = 'Initial margin',
  maintenanceLabel = 'Maintenance margin',
  priceMoveLabel = 'Price move',
  variationLabel = 'Cash swept (variation margin)',
  marginCallLabel = 'Margin call',
  okLabel = 'Above maintenance',
  stepLabel = 'Next trading day',
  resetLabel = 'Reset',
  currencyPrefix = '$',
  caption = 'Every day, the day’s price change times the contract size is added to or taken from your account. Drop below the maintenance line and you get a margin call: wire cash back to the initial level by morning, or the broker closes you out.',
  className,
}: MarginLadderProps) {
  const id = useId();

  // One contract on 100 units. Initial margin 6,000; maintenance 4,500.
  const contractSize = 100;
  const initialMargin = 6000;
  const maintenance = 4500;

  // Deterministic daily price moves (per unit) the position is long.
  const priceMoves = [0, -8, -10, +6, -14, +5];

  const [day, setDay] = useState(0);

  // Walk the account forward to the current day, applying margin top-ups.
  type Row = {
    move: number;
    variation: number;
    equityBefore: number;
    topUp: number;
    equity: number;
    call: boolean;
  };
  const rows: Row[] = [];
  let equity = initialMargin;
  for (let d = 1; d <= day; d++) {
    const move = priceMoves[d];
    const variation = move * contractSize;
    const equityBefore = equity + variation;
    const call = equityBefore < maintenance;
    const topUp = call ? initialMargin - equityBefore : 0;
    equity = equityBefore + topUp;
    rows.push({ move, variation, equityBefore, topUp, equity, call });
  }

  const lastDay = priceMoves.length - 1;
  const atEnd = day >= lastDay;
  const currentEquity = day === 0 ? initialMargin : rows[rows.length - 1].equity;

  // Bar geometry: scale equity against a ceiling a little above initial margin.
  const ceiling = initialMargin * 1.25;
  const barPct = (v: number) => Math.max(0, Math.min(100, (v / ceiling) * 100));

  const advance = () => {
    if (atEnd) {
      setDay(0);
      return;
    }
    setDay((d) => d + 1);
  };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button
          type="button"
          onClick={advance}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none"
        >
          {atEnd ? resetLabel : stepLabel}
        </button>
      </figcaption>

      <div className="mt-5 flex items-stretch gap-5">
        {/* Equity bar */}
        <div
          className="relative w-24 shrink-0 rounded-card border border-ink-100 bg-surface-sunken/40"
          style={{ height: 200 }}
          aria-hidden="true"
        >
          {/* Initial margin line */}
          <div
            className="absolute inset-x-0 border-t border-dashed border-ink-300"
            style={{ bottom: `${barPct(initialMargin)}%` }}
          />
          {/* Maintenance line */}
          <div
            className="absolute inset-x-0 border-t-2 border-dashed"
            style={{
              bottom: `${barPct(maintenance)}%`,
              borderColor: 'var(--color-warning)',
            }}
          />
          {/* Equity fill */}
          <div
            className={cx(
              'absolute inset-x-1 bottom-1 rounded-card transition-all duration-500 motion-reduce:transition-none',
            )}
            style={{
              height: `calc(${barPct(currentEquity)}% - 4px)`,
              background:
                currentEquity < maintenance
                  ? 'var(--color-danger)'
                  : 'var(--color-brand-500)',
            }}
          />
        </div>

        {/* Readouts + legend */}
        <div className="flex flex-1 flex-col justify-center gap-2 text-sm">
          <div aria-live="polite">
            <span className="text-ink-500">{equityLabel}: </span>
            <span
              className={cx(
                'font-mono text-lg font-semibold',
                currentEquity < maintenance ? 'text-danger' : 'text-brand-700',
              )}
            >
              {money(currencyPrefix, currentEquity)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-ink-600">
            <span className="h-0 w-5 border-t border-dashed border-ink-300" aria-hidden="true" />
            {initialMarginLabel}: {money(currencyPrefix, initialMargin)}
          </div>
          <div className="flex items-center gap-2 text-ink-600">
            <span
              className="h-0 w-5 border-t-2 border-dashed"
              style={{ borderColor: 'var(--color-warning)' }}
              aria-hidden="true"
            />
            {maintenanceLabel}: {money(currencyPrefix, maintenance)}
          </div>
        </div>
      </div>

      {/* Day-by-day table */}
      {rows.length > 0 && (
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="text-ink-500">
              <th className="py-1 text-left font-medium">#</th>
              <th className="py-1 text-right font-medium">{priceMoveLabel}</th>
              <th className="py-1 text-right font-medium">{variationLabel}</th>
              <th className="py-1 text-right font-medium">{equityLabel}</th>
              <th className="py-1 text-right font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-ink-100">
                <td className="py-1.5 text-ink-700">{i + 1}</td>
                <td className="py-1.5 text-right font-mono text-ink-900">
                  {signed(currencyPrefix, r.move)}
                </td>
                <td
                  className={cx(
                    'py-1.5 text-right font-mono',
                    r.variation >= 0 ? 'text-brand-700' : 'text-accent-600',
                  )}
                >
                  {signed(currencyPrefix, r.variation)}
                </td>
                <td className="py-1.5 text-right font-mono text-ink-900">
                  {money(currencyPrefix, r.equity)}
                </td>
                <td className="py-1.5 text-right">
                  <span
                    className={cx(
                      'rounded-pill px-2 py-0.5 text-xs font-medium text-white',
                    )}
                    style={{
                      background: r.call
                        ? 'var(--color-danger)'
                        : 'var(--color-success)',
                    }}
                  >
                    {r.call ? marginCallLabel : okLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default MarginLadder;
