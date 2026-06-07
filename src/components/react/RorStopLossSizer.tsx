import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorStopLossSizerProps {
  /** Heading above the widget. */
  title?: string;
  /** Label for the account-risk slider (% of account risked per trade). */
  accountRiskLabel?: string;
  /** Label for the stop-distance slider (% from entry to stop). */
  stopDistanceLabel?: string;
  /** Label for the resulting position-size readout. */
  positionLabel?: string;
  /** Label for the resulting dollar-at-risk readout. */
  dollarRiskLabel?: string;
  /** Label for the position-as-share-of-account readout. */
  exposureLabel?: string;
  /** Label for the account-size context (shown as fixed reference). */
  accountLabel?: string;
  /** Account size used as the reference base. Defaults to 100 (e.g. $100k). */
  account?: number;
  /** Currency/units suffix for money readouts. Defaults to "k". */
  unitSuffix?: string;
  /** One-line takeaway shown under the widget. */
  caption?: string;
  /** Initial account-risk fraction. Defaults to 0.01. */
  accountRisk?: number;
  /** Initial stop-distance fraction. Defaults to 0.08. */
  stopDistance?: number;
  className?: string;
}

/**
 * Interactive position-size calculator built on the stop-loss identity:
 * position size = (account × risk%) ÷ stop-distance%. Two sliders set how much
 * of the account you are willing to lose on the trade (account-risk) and how far
 * the stop sits from entry (stop-distance). The widget derives the dollar at
 * risk, the resulting position size, and what fraction of the account that
 * position represents — making vivid that a tighter stop buys a bigger position
 * for the SAME dollar risk, and that risk-per-trade and stop placement are two
 * independent dials. Pure computation, no animation, fully deterministic.
 */
export function RorStopLossSizer({
  title = 'Position sizing from your stop',
  accountRiskLabel = 'Account risked per trade',
  stopDistanceLabel = 'Stop distance from entry',
  positionLabel = 'Position size',
  dollarRiskLabel = 'Dollars at risk',
  exposureLabel = 'Position as share of account',
  accountLabel = 'Account size',
  account = 100,
  unitSuffix = 'k',
  caption = 'Risk-per-trade and stop-distance are independent dials. The dollars you put at risk depend only on your risk-per-trade; the stop distance then decides how big a position delivers exactly that risk. A tighter stop lets you hold a bigger position for the same risk — but a stop too tight gets you knocked out by noise.',
  accountRisk = 0.01,
  stopDistance = 0.08,
  className,
}: RorStopLossSizerProps) {
  const id = useId();
  const [riskBp, setRiskBp] = useState(Math.round(accountRisk * 1000)); // tenths of a percent
  const [stopPct, setStopPct] = useState(Math.round(stopDistance * 100));

  const riskFrac = riskBp / 1000;
  const stopFrac = stopPct / 100;

  const dollarRisk = account * riskFrac; // $ at risk
  const position = dollarRisk / stopFrac; // position size
  const exposure = position / account; // share of account

  const fmtMoney = (v: number) => `${v.toFixed(v < 10 ? 2 : 1)}${unitSuffix}`;
  const fmtPct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

  const overLeveraged = exposure > 1;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {accountLabel}: {fmtMoney(account)}
        </span>
      </figcaption>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{dollarRiskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{fmtMoney(dollarRisk)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{positionLabel}</dt>
          <dd className="font-mono text-lg font-semibold" style={{ color: 'var(--color-brand-600)' }}>
            {fmtMoney(position)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{exposureLabel}</dt>
          <dd
            className="font-mono text-lg font-semibold"
            style={{ color: overLeveraged ? 'var(--color-danger)' : 'var(--color-ink-900)' }}
          >
            {fmtPct1(exposure)}
          </dd>
        </div>
      </dl>

      {/* Account-risk slider */}
      <div className="mt-5">
        <label htmlFor={`${id}-risk`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{accountRiskLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {riskFrac.toFixed(1) === riskFrac.toString() ? `${(riskFrac * 100).toFixed(1)}%` : `${(riskFrac * 100).toFixed(1)}%`}
          </span>
        </label>
        <input
          id={`${id}-risk`}
          type="range"
          min={2}
          max={50}
          step={1}
          value={riskBp}
          onChange={(e) => setRiskBp(Number(e.target.value))}
          aria-valuetext={`${(riskFrac * 100).toFixed(1)} percent of account risked`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Stop-distance slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-stop`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{stopDistanceLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {stopPct}%
          </span>
        </label>
        <input
          id={`${id}-stop`}
          type="range"
          min={1}
          max={40}
          step={1}
          value={stopPct}
          onChange={(e) => setStopPct(Number(e.target.value))}
          aria-valuetext={`${stopPct} percent stop distance`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default RorStopLossSizer;
