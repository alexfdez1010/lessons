import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SwapReturnInputs {
  notional: number;
  indexReturn: number;
  basketReturn: number;
  /** Separate fixed-period fee, between zero and half the notional in this teaching model. */
  fee: number;
  collateral: number;
}

/** End-period stylized unfunded swap; fee is a separate liability, collateral is not income. */
export function calculateSwapReturnLedger({ notional, indexReturn, basketReturn, fee, collateral }: SwapReturnInputs) {
  if (!Number.isFinite(notional) || notional <= 0 || notional > 1e12 ||
      ![indexReturn, basketReturn].every((item) => Number.isFinite(item) && item >= -0.5 && item <= 0.5) ||
      fee > notional / 2 ||
      ![fee, collateral].every((item) => Number.isFinite(item) && item >= 0 && item <= 1e12)) {
    throw new Error('SwapReturnLedger: positive finite notional, returns from -50% to 50%, a fee up to half the notional and finite nonnegative collateral are required.');
  }
  const basketValue = notional * (1 + basketReturn);
  const swapValue = notional * (indexReturn - basketReturn);
  const positiveClaim = Math.max(swapValue, 0);
  return {
    basketValue, swapValue, positiveClaim,
    finalValue: basketValue + swapValue - fee,
    unsecuredClaim: Math.max(positiveClaim - collateral, 0),
  };
}

export interface SwapReturnLedgerProps extends Partial<SwapReturnInputs> {
  title?: string;
  indexReturnLabel?: string;
  basketReturnLabel?: string;
  notionalLabel?: string;
  basketValueLabel?: string;
  swapValueLabel?: string;
  feeLabel?: string;
  finalValueLabel?: string;
  positiveClaimLabel?: string;
  collateralLabel?: string;
  unsecuredClaimLabel?: string;
  itemLabel?: string;
  valueLabel?: string;
  tableLabel?: string;
  scopeLabel?: string;
  chartLabel?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

/** Compare basket return and contracted index return through a net cash settlement.
 * Exact pre-settlement values are tabulated. The fund retains its basket;
 * posted collateral is never added to NAV or classified as revenue.
 * No autoplay or animation is required to understand the reconciliation.
 */
export function SwapReturnLedger({
  notional = 100, indexReturn = 0.08, basketReturn = 0.03, fee = 0.2, collateral = 0,
  title = 'Reconcile the basket and the contracted index return',
  indexReturnLabel = 'Index total return', basketReturnLabel = 'Owned basket total return',
  notionalLabel = 'Contract calculation base, notional', basketValueLabel = 'Owned basket at period end',
  swapValueLabel = 'Signed swap cash flow to the fund', feeLabel = 'Separate fee paid by the fund',
  finalValueLabel = 'Value after performance and separate fee', positiveClaimLabel = 'Positive swap claim before collateral',
  collateralLabel = 'Assumed realizable collateral for this claim', unsecuredClaimLabel = 'Uncovered positive claim in the simplified default case',
  itemLabel = 'Ledger item', valueLabel = 'Amount', tableLabel = 'End-period swap reconciliation and positive exposure',
  scopeLabel = 'One invented settlement period, an owned basket initially equal to notional, no other fund flows or costs. Swap and fee perform as contracted for the final-value calculation. Default exposure assumes the stated collateral is legally available and realizable, with no other recovery or costs. Collateral is not fee income.',
  chartLabel = 'Compare the end-period owned basket with its value after the signed swap settlement and separate fee. Exact amounts are in the table.',
  currency = 'USD', locale = 'en-US', className,
}: SwapReturnLedgerProps) {
  calculateSwapReturnLedger({ notional, indexReturn, basketReturn, fee, collateral });
  const id = useId();
  const [index, setIndex] = useState(indexReturn);
  const [basket, setBasket] = useState(basketReturn);
  const data = calculateSwapReturnLedger({ notional, indexReturn: index, basketReturn: basket, fee, collateral });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const controls = [{ label: indexReturnLabel, value: index, setter: setIndex, suffix: 'index' }, { label: basketReturnLabel, value: basket, setter: setBasket, suffix: 'basket' }];
  const rows: [string, number][] = [
    [notionalLabel, notional], [basketValueLabel, data.basketValue], [swapValueLabel, data.swapValue],
    [feeLabel, -fee], [finalValueLabel, data.finalValue], [positiveClaimLabel, data.positiveClaim],
    [collateralLabel, collateral], [unsecuredClaimLabel, data.unsecuredClaim],
  ];
  const chartRows: [string, number][] = [[basketValueLabel, data.basketValue], [finalValueLabel, data.finalValue]];
  const maximum = Math.max(notional * 1.5, ...chartRows.map(([, value]) => Math.abs(value)), 1);
  const clean = (value: number) => Math.abs(value) < 1e-9 ? 0 : value;
  return (
    <section className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {controls.map(({ label, value, setter, suffix }) =>
          <label key={String(suffix)} htmlFor={id + '-' + suffix} className="block text-sm font-medium text-ink-700">
            {String(label)}: {percent.format(Number(value))}
            <input id={id + '-' + suffix} type="range" min="-50" max="50" step="1" value={Number(value) * 100}
              onChange={(event) => setter(Number(event.target.value) / 100)}
              className="mt-2 block w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
          </label>)}
      </div>
      <div role="img" aria-label={chartLabel} className="mt-5 space-y-4">
        {chartRows.map(([label, value], row) => <div key={row}>
          <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm text-ink-800"><span>{label}</span><span className="font-mono">{money.format(clean(value))}</span></div>
          <div className="h-5 rounded-pill bg-surface-sunken"><div style={{ width: Math.abs(value) / maximum * 100 + '%' }} className={cx('h-full rounded-pill', row === 0 ? 'bg-brand-600' : 'bg-accent-600')} /></div>
        </div>)}
      </div>
      <p aria-live="polite" aria-atomic="true" className="mt-4 text-sm font-semibold text-ink-900">{swapValueLabel}: {money.format(clean(data.swapValue))}; {unsecuredClaimLabel}: {money.format(clean(data.unsecuredClaim))}</p>
      <p className="mt-3 text-sm text-ink-600">{scopeLabel}</p>
      <div className="mt-4">
        <table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <thead><tr><th scope="col" className="px-3 py-2">{itemLabel}</th><th scope="col" className="px-3 py-2">{valueLabel}</th></tr></thead>
          <tbody>{rows.map(([label, value], row) => <tr key={row}><th scope="row" className="px-3 py-2 font-medium">{label}</th><td className="px-3 py-2 font-mono">{money.format(clean(value))}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
