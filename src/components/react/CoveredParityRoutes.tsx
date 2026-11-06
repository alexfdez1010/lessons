import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CoveredParityInputs {
  amount: number; spot: number; domesticRate: number; foreignRate: number;
  spotBid: number; spotAsk: number; domesticDepositRate: number; domesticBorrowRate: number;
  foreignDepositRate: number; foreignBorrowRate: number; forwardBid: number; forwardSpread: number;
}
export interface CoveredParityResult {
  parityForward: number; domesticEnding: number; foreignInitial: number; foreignEnding: number; coveredEnding: number;
  lowerBound: number; upperBound: number; forwardAsk: number;
  domesticFundedForeignInitial: number; domesticFundedForeignEnding: number; domesticFundedProceeds: number; domesticFundedRepayment: number; domesticFundedProfit: number;
  foreignFundedBorrowing: number; foreignFundedRepayment: number; foreignFundedDomesticEnding: number; foreignFundedForwardCost: number; foreignFundedProfit: number;
}
/** One matched funding period, rates are simple returns OVER that period.
 * Quotes are domestic currency per foreign unit. Execution uses the side the
 * customer can trade, with deposit rates no higher than borrowing rates. */
export function calculateCoveredParity(i: CoveredParityInputs): CoveredParityResult {
  if (!Number.isFinite(i.amount) || i.amount <= 0 || i.amount > 1e12) throw new Error('CoveredParityRoutes: amount must be positive and at most 1e12.');
  for (const key of ['spot','spotBid','spotAsk','forwardBid'] as const) if (!Number.isFinite(i[key]) || i[key] < .01 || i[key] > 1000) throw new Error(`CoveredParityRoutes: ${key} must be finite from 0.01 to 1000.`);
  for (const key of ['domesticRate','foreignRate','domesticDepositRate','domesticBorrowRate','foreignDepositRate','foreignBorrowRate'] as const) if (!Number.isFinite(i[key]) || i[key] < -.02 || i[key] > .25) throw new Error(`CoveredParityRoutes: ${key} must be from -0.02 to 0.25.`);
  if (i.spotBid > i.spotAsk) throw new Error('CoveredParityRoutes: spotBid must not exceed spotAsk.');
  if (i.domesticDepositRate > i.domesticBorrowRate || i.foreignDepositRate > i.foreignBorrowRate) throw new Error('CoveredParityRoutes: a deposit rate must not exceed the corresponding borrowing rate.');
  if (!Number.isFinite(i.forwardSpread) || i.forwardSpread < 0 || i.forwardSpread > .1) throw new Error('CoveredParityRoutes: forwardSpread must be from zero to 0.10.');
  const Gd = 1 + i.domesticRate, Gf = 1 + i.foreignRate, Dd = 1 + i.domesticDepositRate, Bd = 1 + i.domesticBorrowRate, Df = 1 + i.foreignDepositRate, Bf = 1 + i.foreignBorrowRate;
  const parityForward = i.spot * Gd / Gf, foreignInitial = i.amount / i.spot, foreignEnding = foreignInitial * Gf;
  const lowerBound = i.spotBid * Dd / Bf, upperBound = i.spotAsk * Bd / Df, forwardAsk = i.forwardBid + i.forwardSpread;
  const domesticFundedForeignInitial = i.amount / i.spotAsk, domesticFundedForeignEnding = domesticFundedForeignInitial * Df;
  const domesticFundedProceeds = domesticFundedForeignEnding * i.forwardBid, domesticFundedRepayment = i.amount * Bd;
  // Normalize the other direction to the same domestic cash proceeds at spot.
  const foreignFundedBorrowing = i.amount / i.spotBid, foreignFundedRepayment = foreignFundedBorrowing * Bf;
  const foreignFundedDomesticEnding = i.amount * Dd, foreignFundedForwardCost = foreignFundedRepayment * forwardAsk;
  return { parityForward, foreignInitial, foreignEnding, domesticEnding: i.amount * Gd, coveredEnding: foreignEnding * parityForward,
    lowerBound, upperBound, forwardAsk, domesticFundedForeignInitial, domesticFundedForeignEnding, domesticFundedProceeds, domesticFundedRepayment,
    domesticFundedProfit: domesticFundedProceeds - domesticFundedRepayment, foreignFundedBorrowing, foreignFundedRepayment, foreignFundedDomesticEnding, foreignFundedForwardCost,
    foreignFundedProfit: foreignFundedDomesticEnding - foreignFundedForwardCost };
}
export interface CoveredParityRoutesProps extends Partial<CoveredParityInputs> {
  mode?: 'ideal' | 'execution'; domesticCurrency?: string; foreignCurrency?: string; locale?: string;
  title?: string; spotLabel?: string; domesticRateLabel?: string; foreignRateLabel?: string; forwardBidLabel?: string;
  quoteMessage?: string; idealMessage?: string; executionMessage?: string; parityLabel?: string;
  domesticPathLabel?: string; foreignPathLabel?: string; lowerLabel?: string; upperLabel?: string; forwardAskLabel?: string;
  domesticFundedLabel?: string; foreignFundedLabel?: string; profitLabel?: string; positiveLabel?: string; noPositiveLabel?: string;
  assumptionsLabel?: string; spotBidLabel?: string; spotAskLabel?: string; domesticDepositLabel?: string; domesticBorrowLabel?: string; foreignDepositLabel?: string; foreignBorrowLabel?: string;
  tableLabel?: string; routeLabel?: string; actionLabel?: string; initialLabel?: string; terminalLabel?: string; depositDomesticLabel?: string;
  buyForeignLabel?: string; depositForeignLabel?: string; sellForeignForwardLabel?: string; borrowDomesticLabel?: string; borrowForeignLabel?: string; sellForeignSpotLabel?: string; buyForeignForwardLabel?: string;
  netDomesticBorrowLabel?: string; netForeignBorrowLabel?: string; contractLabel?: string;
  idealChartLabel?: string; bandChartLabel?: string; bandLabel?: string; caption?: string; className?: string;
}
const defaults: CoveredParityInputs = { amount: 1200, spot: 1.2, domesticRate: .05, foreignRate: .03, spotBid: 1.199, spotAsk: 1.201,
  domesticDepositRate: .04, domesticBorrowRate: .06, foreignDepositRate: .02, foreignBorrowRate: .04, forwardBid: 1.23, forwardSpread: .002 };
export function CoveredParityRoutes({ mode = 'ideal', domesticCurrency = 'USD', foreignCurrency = 'EUR', locale = 'en-US',
  amount = defaults.amount, spot = defaults.spot, domesticRate = defaults.domesticRate, foreignRate = defaults.foreignRate,
  spotBid = defaults.spotBid, spotAsk = defaults.spotAsk, domesticDepositRate = defaults.domesticDepositRate, domesticBorrowRate = defaults.domesticBorrowRate,
  foreignDepositRate = defaults.foreignDepositRate, foreignBorrowRate = defaults.foreignBorrowRate, forwardBid = defaults.forwardBid, forwardSpread = defaults.forwardSpread,
  title = 'Follow both currencies through the covered routes', spotLabel = 'Spot in the stated quote', domesticRateLabel = 'Domestic one-period rate', foreignRateLabel = 'Foreign one-period rate', forwardBidLabel = 'Forward bid, sell foreign currency',
  quoteMessage = 'All spot and forward quotes are {domestic} per one {foreign}. Initial value date and terminal date match across every leg. Initial domestic amount {amount}.',
  idealMessage = 'Idealized one-year model: one fixed rate for borrowing and depositing in each currency, one spot/forward price, no transaction costs or upfront forward premium, identical relevant credit and collateral assumptions, and full performance of all contracts. The computed F makes the two specified terminal domestic amounts equal.',
  executionMessage = 'Separate invented one-year execution example: borrow and deposit rates differ; customer buys foreign at spot ask, sells at spot bid, sells forward at forward bid and buys forward at forward ask. Both funded directions start with zero net listed currency cash flow. The foreign borrowing is sized to produce the same domestic spot proceeds. The forward has no upfront premium. Remainders exclude any unlisted collateral, fees, funding-access, credit, settlement or balance-sheet costs.',
  parityLabel = 'Ideal single-rate forward', domesticPathLabel = 'Domestic deposit at maturity', foreignPathLabel = 'Foreign deposit sold forward at maturity', lowerLabel = 'Lower executable ask threshold', upperLabel = 'Upper executable bid threshold', forwardAskLabel = 'Forward ask, buy foreign currency',
  domesticFundedLabel = 'Borrow domestic, deposit foreign, sell forward', foreignFundedLabel = 'Borrow foreign, deposit domestic, buy forward', profitLabel = 'Terminal domestic remainder before unlisted costs', positiveLabel = 'Positive listed-cash-flow remainder', noPositiveLabel = 'No positive listed-cash-flow remainder', assumptionsLabel = 'Execution inputs for this example',
  spotBidLabel = 'Spot bid', spotAskLabel = 'Spot ask', domesticDepositLabel = 'Domestic deposit return', domesticBorrowLabel = 'Domestic borrowing cost', foreignDepositLabel = 'Foreign deposit return', foreignBorrowLabel = 'Foreign borrowing cost',
  routeLabel = 'Route', tableLabel = 'Dated currency cash flows for the covered routes, scroll horizontally if needed', actionLabel = 'Leg', initialLabel = 'Initial value date', terminalLabel = 'Terminal date', depositDomesticLabel = 'Deposit domestic currency', buyForeignLabel = 'Buy foreign at spot', depositForeignLabel = 'Deposit foreign currency', sellForeignForwardLabel = 'Sell foreign proceeds forward', borrowDomesticLabel = 'Borrow domestic currency', borrowForeignLabel = 'Borrow foreign currency', sellForeignSpotLabel = 'Sell borrowed foreign at spot', buyForeignForwardLabel = 'Buy foreign repayment forward', netDomesticBorrowLabel = 'Net, domestic-funded direction', netForeignBorrowLabel = 'Net, foreign-funded direction', contractLabel = 'Forward contracted at the outset',
  bandLabel = 'Interval between the two funded-route thresholds',
  idealChartLabel = 'Ideal single-rate forward {forward}. Domestic route ends at {home}; covered foreign route ends at {covered}. The forward exchange is fixed at inception under the stated full-performance assumptions.',
  bandChartLabel = 'Lower threshold {lower}, upper threshold {upper}, forward bid {bid}, forward ask {ask}. Domestic-funded remainder {domesticprofit}; foreign-funded remainder {foreignprofit}, before unlisted costs.',
  caption = 'Invented matched-date illustration, no forecast of future spot. A forward hedges the specified terminal exchange amount if the contracts perform; it does not remove all credit, liquidity or settlement risks. A midquote difference from a single-rate benchmark is insufficient to establish an executable arbitrage. Thresholds only test the two listed funded directions at the supplied prices and funding rates.', className,
}: CoveredParityRoutesProps) {
  const authored = { amount, spot, domesticRate, foreignRate, spotBid, spotAsk, domesticDepositRate, domesticBorrowRate, foreignDepositRate, foreignBorrowRate, forwardBid, forwardSpread }; calculateCoveredParity(authored);
  if (!['ideal', 'execution'].includes(mode)) throw new Error('CoveredParityRoutes: mode must be ideal or execution.');
  if (!/^[A-Z]{3}$/.test(domesticCurrency) || !/^[A-Z]{3}$/.test(foreignCurrency) || domesticCurrency === foreignCurrency) throw new Error('CoveredParityRoutes: currency codes must be distinct three-letter uppercase codes.');
  const labels = { title, spotLabel, domesticRateLabel, foreignRateLabel, forwardBidLabel, quoteMessage, idealMessage, executionMessage, parityLabel, domesticPathLabel, foreignPathLabel, lowerLabel, upperLabel, forwardAskLabel, domesticFundedLabel, foreignFundedLabel, profitLabel, positiveLabel, noPositiveLabel, assumptionsLabel, spotBidLabel, spotAskLabel, domesticDepositLabel, domesticBorrowLabel, foreignDepositLabel, foreignBorrowLabel, tableLabel, routeLabel, actionLabel, initialLabel, terminalLabel, depositDomesticLabel, buyForeignLabel, depositForeignLabel, sellForeignForwardLabel, borrowDomesticLabel, borrowForeignLabel, sellForeignSpotLabel, buyForeignForwardLabel, netDomesticBorrowLabel, netForeignBorrowLabel, contractLabel, idealChartLabel, bandChartLabel, bandLabel, caption };
  for (const [name, value] of Object.entries(labels)) if (typeof value !== 'string' || !value.trim()) throw new Error(`CoveredParityRoutes: ${name} must be nonempty.`);
  const id = useId(), [S, setS] = useState(spot), [rd, setRd] = useState(domesticRate), [rf, setRf] = useState(foreignRate), [bid, setBid] = useState(forwardBid);
  const model = calculateCoveredParity({ ...authored, spot: S, domesticRate: rd, foreignRate: rf, forwardBid: bid });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }), percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(value);
  const D = (value: number) => money(value, domesticCurrency), F = (value: number) => money(value, foreignCurrency);
  const exchange = (domestic: number, foreign: number) => `${D(domestic)} / ${F(foreign)}`;
  const substitute = (template: string, values: Record<string, string>) => template.replace(/\{([a-z]+)\}/g, (whole, key: string) => values[key] ?? whole);
  const quote = `${domesticCurrency}/${foreignCurrency}`;
  const variables = { domestic: domesticCurrency, foreign: foreignCurrency, amount: D(amount), forward: `${number.format(model.parityForward)} ${quote}`, home: D(model.domesticEnding), covered: D(model.coveredEnding), lower: `${number.format(model.lowerBound)} ${quote}`, upper: `${number.format(model.upperBound)} ${quote}`, bid: `${number.format(bid)} ${quote}`, ask: `${number.format(model.forwardAsk)} ${quote}`, domesticprofit: D(model.domesticFundedProfit), foreignprofit: D(model.foreignFundedProfit) };
  const rows = mode === 'ideal' ? [
    [depositDomesticLabel, D(-amount), D(model.domesticEnding)],
    [buyForeignLabel, exchange(-amount, model.foreignInitial), '—'],
    [depositForeignLabel, F(-model.foreignInitial), F(model.foreignEnding)],
    [sellForeignForwardLabel, contractLabel, exchange(model.coveredEnding, -model.foreignEnding)],
  ] : [
    [borrowDomesticLabel, D(amount), D(-model.domesticFundedRepayment)],
    [buyForeignLabel, exchange(-amount, model.domesticFundedForeignInitial), '—'],
    [depositForeignLabel, F(-model.domesticFundedForeignInitial), F(model.domesticFundedForeignEnding)],
    [sellForeignForwardLabel, contractLabel, exchange(model.domesticFundedProceeds, -model.domesticFundedForeignEnding)],
    [netDomesticBorrowLabel, exchange(0, 0), exchange(model.domesticFundedProfit, 0)],
    [borrowForeignLabel, F(model.foreignFundedBorrowing), F(-model.foreignFundedRepayment)],
    [sellForeignSpotLabel, exchange(amount, -model.foreignFundedBorrowing), '—'],
    [depositDomesticLabel, D(-amount), D(model.foreignFundedDomesticEnding)],
    [buyForeignForwardLabel, contractLabel, exchange(-model.foreignFundedForwardCost, model.foreignFundedRepayment)],
    [netForeignBorrowLabel, exchange(0, 0), exchange(model.foreignFundedProfit, 0)],
  ];
  const W = 640, H = 160, min = Math.min(model.lowerBound, bid) - .01, max = Math.max(model.upperBound, model.forwardAsk) + .01, x = (v: number) => 35 + (v - min) / (max - min) * 570;
  const bidMinimum = Math.max(.01, Math.floor(Math.min(spotBid, forwardBid) * .95 * 1000) / 1000);
  const bidMaximum = Math.min(1000, Math.ceil(Math.max(spotAsk, forwardBid) * 1.1 * 1000) / 1000);
  const spotMinimum = Math.max(.01, Math.floor(Math.min(.5, spot) * 100) / 100);
  const spotMaximum = Math.min(1000, Math.ceil(Math.max(2, spot) * 100) / 100);
  const controls = mode === 'ideal' ? [
    { key: 'spot', label: spotLabel, value: S, min: spotMinimum, max: spotMaximum, step: .01, set: setS, output: `${number.format(S)} ${quote}` },
    { key: 'rd', label: domesticRateLabel, value: rd, min: -.02, max: .25, step: .005, set: setRd, output: percent.format(rd) },
    { key: 'rf', label: foreignRateLabel, value: rf, min: -.02, max: .25, step: .005, set: setRf, output: percent.format(rf) },
  ] : [{ key: 'bid', label: forwardBidLabel, value: bid, min: bidMinimum, max: bidMaximum, step: .001, set: setBid, output: `${number.format(bid)} ${quote}` }];
  const idealHeight = model.domesticEnding / (amount * 1.3) * 160;
  const coveredHeight = model.coveredEnding / (amount * 1.3) * 160;
  const diagnostic = (value: number) => value > 1e-12 * amount ? positiveLabel : noPositiveLabel;
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-sm">{substitute(quoteMessage, variables)}</p><p className="mt-3 text-xs leading-relaxed text-ink-600">{mode === 'ideal' ? idealMessage : executionMessage}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{controls.map(control => <label key={control.key} htmlFor={`${id}-${control.key}`} className="min-w-0 text-sm font-medium">{control.label}: <output className="font-mono">{control.output}</output><input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={e => control.set(Number(e.target.value))} className="mt-3 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"/></label>)}</div>
    {mode === 'ideal' ? <>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[parityLabel, variables.forward], [domesticPathLabel, D(model.domesticEnding)], [foreignPathLabel, D(model.coveredEnding)]].map(([label, value]) => <div key={label} className="rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
      <div className="mt-4 flex flex-wrap gap-3 text-xs"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-brand-600" aria-hidden="true"/>A · {domesticPathLabel}</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-accent-600" aria-hidden="true"/>B · {foreignPathLabel}</span></div>
      <svg viewBox="0 0 640 220" role="img" aria-label={substitute(idealChartLabel, variables)} className="mt-4 w-full"><line x1={50} x2={590} y1={195} y2={195} stroke="var(--color-ink-400)"/><rect x={160} y={195 - idealHeight} width={100} height={idealHeight} fill="var(--color-brand-600)"/><rect x={380} y={195 - coveredHeight} width={100} height={coveredHeight} fill="var(--color-accent-600)"/><line x1={50} x2={590} y1={195 - idealHeight} y2={195 - idealHeight} stroke="var(--color-ink-400)" strokeDasharray="6 5"/></svg>
    </> : <>
      <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">{assumptionsLabel}</summary><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{[[spotBidLabel, `${number.format(spotBid)} ${quote}`], [spotAskLabel, `${number.format(spotAsk)} ${quote}`], [domesticDepositLabel, percent.format(domesticDepositRate)], [domesticBorrowLabel, percent.format(domesticBorrowRate)], [foreignDepositLabel, percent.format(foreignDepositRate)], [foreignBorrowLabel, percent.format(foreignBorrowRate)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="font-mono">{value}</dd></div>)}</dl></details>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{[[lowerLabel, variables.lower], [upperLabel, variables.upper], [forwardBidLabel, variables.bid], [forwardAskLabel, variables.ask]].map(([label, value]) => <div key={label} className="rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={substitute(bandChartLabel, variables)} className="mt-4 w-full"><line x1={35} x2={605} y1={80} y2={80} stroke="var(--color-ink-400)"/><rect x={x(model.lowerBound)} y={55} width={Math.max(0, x(model.upperBound) - x(model.lowerBound))} height={50} fill="var(--color-ink-200)"/>{[model.lowerBound, model.upperBound].map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1={35} y2={125} stroke="var(--color-ink-700)" strokeDasharray="5 4"/>)}<circle cx={x(bid)} cy={67} r={8} fill="var(--color-brand-600)"/><rect x={x(model.forwardAsk)-7} y={86} width={14} height={14} fill="var(--color-accent-600)"/></svg>
      <p className="mt-2 text-xs text-ink-600">{bandLabel}</p><div className="mt-2 flex flex-wrap gap-3 text-xs"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-brand-600" aria-hidden="true"/>{forwardBidLabel}</span><span className="inline-flex items-center gap-2"><span className="h-3 w-3 bg-accent-600" aria-hidden="true"/>{forwardAskLabel}</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite">{[[domesticFundedLabel, model.domesticFundedProfit], [foreignFundedLabel, model.foreignFundedProfit]].map(([label, value]) => <section key={String(label)} className="rounded-lg bg-surface p-3"><h3 className="text-sm font-semibold" style={{margin:0}}>{label}</h3><p className="mt-2 text-xs">{profitLabel}</p><p className="mt-2 break-words font-mono font-semibold">{D(Number(value))}</p><p className="mt-2 text-xs">{diagnostic(Number(value))}</p></section>)}</div>
    </>}
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><caption className="sr-only">{tableLabel}</caption><thead><tr>{[routeLabel, actionLabel, initialLabel, terminalLabel].map(label => <th key={label} scope="col" className="p-2 font-semibold">{label}</th>)}</tr></thead><tbody>{rows.map(([label, initial, terminal], i) => <tr key={i} className="odd:bg-surface"><td className="p-2 font-mono">{mode === 'ideal' ? i === 0 ? 'A' : 'B' : i < 5 ? 'A' : 'B'}</td><th scope="row" className="p-2 font-medium">{label}</th><td className="p-2 font-mono">{initial}</td><td className="p-2 font-mono">{terminal}</td></tr>)}</tbody></table></div>
    <p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default CoveredParityRoutes;
