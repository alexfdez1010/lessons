import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
export interface BondOutcomeInputs {
  price: number;
  face: number;
  /** Actual interest received, all at period end in this one-period example. */
  interest: number;
  /** Actual final redemption, sale proceeds or recovery, excluding the interest above. */
  terminalCash: number;
  /** Home-currency units per one foreign-currency unit at purchase. */
  initialFx: number;
  /** Final exchange rate divided by the initial exchange rate. */
  endingFxFactor: number;
  /** Effective price inflation over this same period. */
  inflation: number;
}
export function calculateBondOutcome(input: BondOutcomeInputs) {
  const { price, face, interest, terminalCash, initialFx, endingFxFactor, inflation } = input;
  if (![price, face, initialFx].every((x) => Number.isFinite(x) && x > 0 && x <= 1e12) ||
      !Number.isFinite(interest) || interest < 0 || interest > face ||
      !Number.isFinite(terminalCash) || terminalCash < 0 || terminalCash > 1.5 * face ||
      !Number.isFinite(endingFxFactor) || endingFxFactor < 0.5 || endingFxFactor > 1.5 ||
      !Number.isFinite(inflation) || inflation < -0.05 || inflation > 0.2) {
    throw new Error('BondOutcomeExplorer: finite positive price/face/initial FX, nonnegative interest up to face, terminal cash up to 150% of face, FX factor 0.5–1.5 and inflation −5% to 20% required.');
  }
  const endingFx = initialFx * endingFxFactor;
  const initialHome = price * initialFx;
  const finalForeign = interest + terminalCash;
  const finalHome = finalForeign * endingFx;
  const realHome = finalHome / (1 + inflation);
  const nominalReturn = finalHome / initialHome - 1;
  const realReturn = realHome / initialHome - 1;
  if (![endingFx, initialHome, finalForeign, finalHome, realHome, nominalReturn, realReturn].every(Number.isFinite)) throw new Error('BondOutcomeExplorer: derived values must be finite.');
  return { endingFx, initialHome, finalForeign, finalHome, realHome, nominalReturn, realReturn };
}
export interface BondOutcomeExplorerProps extends Partial<BondOutcomeInputs> {
  title?: string; terminalLabel?: string; fxControlLabel?: string; inflationLabel?: string;
  priceLabel?: string; interestLabel?: string; initialFxLabel?: string; endingFxLabel?: string;
  initialHomeLabel?: string; finalForeignLabel?: string; finalHomeLabel?: string; realHomeLabel?: string;
  nominalReturnLabel?: string; realReturnLabel?: string; itemLabel?: string; valueLabel?: string;
  tableLabel?: string; chartLabel?: string; scopeLabel?: string; sameCurrencyLabel?: string;
  homeCurrency?: string; foreignCurrency?: string; locale?: string; className?: string;
}
/** One-period actual cash outcome; no coupon reinvestment or promised yield inferred.
 * The control changes final cash, not what the issuer contractually owes.
 * All comparison bars use home-currency amounts; the real amount is in start-date purchasing power.
 */
export function BondOutcomeExplorer({
  price = 1000, face = 1000, interest = 50, terminalCash = 1000, initialFx = 1, endingFxFactor = 0.9, inflation = 0.05,
  title = 'Contract cash, currency conversion and purchasing power are different quantities',
  terminalLabel = 'Actual final cash excluding interest', fxControlLabel = 'Final home-currency units per foreign unit',
  inflationLabel = 'Price inflation over the same period', priceLabel = 'Purchase outlay in the bond currency',
  interestLabel = 'Actual end-period interest in the bond currency', initialFxLabel = 'Initial home-currency units per foreign unit', endingFxLabel = 'Final home-currency units per foreign unit',
  initialHomeLabel = 'Initial outlay in home currency', finalForeignLabel = 'Total final cash in the bond currency',
  finalHomeLabel = 'Final cash converted to home currency', realHomeLabel = 'Final cash in start-date home purchasing power',
  nominalReturnLabel = 'Nominal home-currency period return', realReturnLabel = 'Real home-currency period return',
  itemLabel = 'Quantity', valueLabel = 'Value', tableLabel = 'One-period actual cash and currency reconciliation',
  chartLabel = 'Initial home outlay, final home cash and final purchasing-power equivalent. Exact values and units are in the table.',
  scopeLabel = 'Invented one-period outcome: all actual cash arrives at the end, no intermediate reinvestment, other flows, fees or taxes. Final cash may represent redemption, a sale or default recovery. The control does not change the original promise. The real result uses the stated home price index.',
  sameCurrencyLabel = 'Payment and home currency coincide; conversion is fixed at one.',
  homeCurrency = 'EUR', foreignCurrency = 'USD', locale = 'en-US', className,
}: BondOutcomeExplorerProps) {
  calculateBondOutcome({ price, face, interest, terminalCash, initialFx, endingFxFactor, inflation });
  const sameCurrency = homeCurrency === foreignCurrency;
  if (sameCurrency && (initialFx !== 1 || endingFxFactor !== 1)) throw new Error('BondOutcomeExplorer: identical currency codes require identity conversion rates.');
  const id = useId();const [cash, setCash] = useState(terminalCash);const [fxFactor, setFxFactor] = useState(endingFxFactor);const [prices, setPrices] = useState(inflation);
  const data = calculateBondOutcome({ price, face, interest, terminalCash: cash, initialFx, endingFxFactor: fxFactor, inflation: prices });
  const home = new Intl.NumberFormat(locale, { style: 'currency', currency: homeCurrency, maximumFractionDigits: 2 });
  const foreign = new Intl.NumberFormat(locale, { style: 'currency', currency: foreignCurrency, maximumFractionDigits: 2 });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const clean = (x: number) => Math.abs(x) < 1e-10 ? 0 : x;
  const rows = [[priceLabel, foreign.format(price)], [interestLabel, foreign.format(interest)], [terminalLabel, foreign.format(cash)], [initialFxLabel + ' (' + homeCurrency + '/' + foreignCurrency + ')', number.format(initialFx)], [endingFxLabel + ' (' + homeCurrency + '/' + foreignCurrency + ')', number.format(data.endingFx)], [initialHomeLabel, home.format(data.initialHome)], [finalForeignLabel, foreign.format(data.finalForeign)], [finalHomeLabel, home.format(data.finalHome)], [realHomeLabel, home.format(data.realHome)], [nominalReturnLabel, percent.format(clean(data.nominalReturn))], [realReturnLabel, percent.format(clean(data.realReturn))]];
  const bars = [{ label: initialHomeLabel, amount: data.initialHome }, { label: finalHomeLabel, amount: data.finalHome }, { label: realHomeLabel, amount: data.realHome }];const scale = Math.max(1, ...bars.map((bar) => bar.amount));
  return <section className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
    <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3><p className="mt-2 text-sm text-ink-600">{scopeLabel}</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label htmlFor={id + '-cash'} className="text-sm font-medium text-ink-800">{terminalLabel}: {foreign.format(cash)}<input id={id + '-cash'} type="range" min="0" max="150" step="1" value={cash / face * 100} onChange={(e) => setCash(Number(e.target.value) / 100 * face)} className="mt-2 block h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>
      <label htmlFor={id + '-fx'} className="text-sm font-medium text-ink-800">{fxControlLabel} ({homeCurrency}/{foreignCurrency}): {number.format(data.endingFx)}<input id={id + '-fx'} disabled={sameCurrency} type="range" min="50" max="150" step="1" value={fxFactor * 100} onChange={(e) => setFxFactor(Number(e.target.value) / 100)} className="mt-2 block h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />{sameCurrency && <span className="mt-1 block text-xs text-ink-600">{sameCurrencyLabel}</span>}</label>
      <label htmlFor={id + '-prices'} className="text-sm font-medium text-ink-800">{inflationLabel}: {percent.format(prices)}<input id={id + '-prices'} type="range" min="-5" max="20" step="1" value={prices * 100} onChange={(e) => setPrices(Number(e.target.value) / 100)} className="mt-2 block h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>
    </div>
    <div role="img" aria-label={chartLabel} className="mt-5 space-y-4">{bars.map((bar, index) => <div key={index}><div className="mb-1 flex flex-wrap justify-between gap-2 text-sm text-ink-800"><span>{bar.label}</span><span className="font-mono">{home.format(bar.amount)}</span></div><div className="h-4 rounded-pill bg-surface-sunken" aria-hidden="true"><div style={{ width: bar.amount / scale * 100 + '%' }} className={cx('h-full rounded-pill', index === 0 ? 'bg-ink-600' : index === 1 ? 'bg-brand-600' : 'bg-accent-600')} /></div></div>)}</div>
    <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-4 rounded-card bg-surface-sunken p-4 text-sm text-ink-800 sm:grid-cols-2"><div><dt>{nominalReturnLabel}</dt><dd className="font-mono font-semibold">{percent.format(clean(data.nominalReturn))}</dd></div><div><dt>{realReturnLabel}</dt><dd className="font-mono font-semibold">{percent.format(clean(data.realReturn))}</dd></div></dl>
    <table tabIndex={0} aria-label={tableLabel} className="mt-4 block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr><th scope="col" className="px-3 py-2">{itemLabel}</th><th scope="col" className="px-3 py-2">{valueLabel}</th></tr></thead><tbody>{rows.map(([name, value], index) => <tr key={index}><th scope="row" className="px-3 py-2 font-medium">{name}</th><td className="px-3 py-2 font-mono">{value}</td></tr>)}</tbody></table>
  </section>;
}
