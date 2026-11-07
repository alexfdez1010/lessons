import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
export interface RealExchangeInputs {
  initialSpot: number; marketSpot: number; domesticPrice: number; foreignPrice: number;
  domesticInflation: number; foreignInflation: number; foreignIndexBase: number; deliveryCost: number;
}
/** Quote: domestic currency per foreign unit. Inflation is the simple price change
 * over one matched interval. A rebased CPI supplies changes, not comparable price levels.
 * Level outputs use the supplied comparable prices at their stated date; the
 * separate change outputs use own-base growth factors and do not infer absolute levels. */
export function calculateRealExchange(i: RealExchangeInputs) {
  for (const key of ['initialSpot', 'marketSpot'] as const) if (!Number.isFinite(i[key]) || i[key] < .1 || i[key] > 5) throw new Error(`RealExchangeRateBasket: ${key} must be from 0.1 to 5 in this bounded quote viewer.`);
  for (const key of ['domesticPrice', 'foreignPrice'] as const) if (!Number.isFinite(i[key]) || i[key] < 10 || i[key] > 500) throw new Error(`RealExchangeRateBasket: ${key} must be from 10 to 500 local currency units.`);
  for (const key of ['domesticInflation', 'foreignInflation'] as const) if (!Number.isFinite(i[key]) || i[key] < -.2 || i[key] > .5) throw new Error(`RealExchangeRateBasket: ${key} must be from -20% to 50% over the stated interval.`);
  if (![100, 200].includes(i.foreignIndexBase)) throw new Error('RealExchangeRateBasket: the foreign index base must be 100 or 200.');
  if (!Number.isFinite(i.deliveryCost) || i.deliveryCost < 0 || i.deliveryCost > 100) throw new Error('RealExchangeRateBasket: supplied one-way delivery cost must be from zero to 100 domestic currency units.');
  const domesticGrowth = 1 + i.domesticInflation, foreignGrowth = 1 + i.foreignInflation;
  const absoluteBenchmark = i.domesticPrice / i.foreignPrice, convertedForeignPrice = i.marketSpot * i.foreignPrice;
  const realRatio = convertedForeignPrice / i.domesticPrice, nominalFactor = i.marketSpot / i.initialSpot, relativePriceFactor = foreignGrowth / domesticGrowth;
  const realFactor = nominalFactor * relativePriceFactor, relativePPPSpot = i.initialSpot * domesticGrowth / foreignGrowth;
  return { absoluteBenchmark, convertedForeignPrice, realRatio, foreignQuoteGap: i.marketSpot / absoluteBenchmark - 1,
    reciprocalQuoteGap: absoluteBenchmark / i.marketSpot - 1, landedForeignPrice: convertedForeignPrice + i.deliveryCost,
    domesticMinusLanded: i.domesticPrice - convertedForeignPrice - i.deliveryCost, nominalFactor, relativePriceFactor, realFactor,
    realIndex: 100 * realFactor, nominalIndex: 100 * nominalFactor, relativePriceIndex: 100 * relativePriceFactor, relativePPPSpot,
    exactPPPChange: domesticGrowth / foreignGrowth - 1, inflationGapApproximation: i.domesticInflation - i.foreignInflation,
    domesticIndexStart: 100, domesticIndexEnd: 100 * domesticGrowth, foreignIndexStart: i.foreignIndexBase, foreignIndexEnd: i.foreignIndexBase * foreignGrowth };
}
export interface RealExchangeRateBasketProps extends Partial<RealExchangeInputs> {
  mode?: 'level' | 'change'; showDeliveryControl?: boolean; locale?: string; domesticCurrency?: string; foreignCurrency?: string;
  title?: string; levelMessage?: string; changeMessage?: string; spotLabel?: string; domesticPriceLabel?: string; foreignPriceLabel?: string;
  domesticInflationLabel?: string; foreignInflationLabel?: string; indexBaseLabel?: string; deliveryLabel?: string;
  benchmarkLabel?: string; ratioLabel?: string; foreignGapLabel?: string; reciprocalGapLabel?: string; landedLabel?: string; costGapLabel?: string;
  relativePPPLabel?: string; nominalChangeLabel?: string; realChangeLabel?: string; realIndexLabel?: string; priceFactorLabel?: string;
  domesticBarLabel?: string; foreignBarLabel?: string; landedBarLabel?: string; nominalBarLabel?: string; priceBarLabel?: string; realBarLabel?: string;
  currencyAxisLabel?: string; indexAxisLabel?: string; levelChartLabel?: string; changeChartLabel?: string;
  tableLabel?: string; quantityHeading?: string; valueHeading?: string; startHeading?: string; endHeading?: string;
  spotRowLabel?: string; domesticIndexLabel?: string; foreignIndexLabel?: string; caption?: string; className?: string;
}
const defaults: RealExchangeInputs = { initialSpot: 1.2, marketSpot: 1.1, domesticPrice: 120, foreignPrice: 100, domesticInflation: .05, foreignInflation: .02, foreignIndexBase: 100, deliveryCost: 0 };
export function RealExchangeRateBasket({ mode = 'level', showDeliveryControl = false, locale = 'en-GB', domesticCurrency = 'USD', foreignCurrency = 'EUR',
  initialSpot = defaults.initialSpot, marketSpot = defaults.marketSpot, domesticPrice = defaults.domesticPrice, foreignPrice = defaults.foreignPrice,
  domesticInflation = defaults.domesticInflation, foreignInflation = defaults.foreignInflation, foreignIndexBase = defaults.foreignIndexBase, deliveryCost = defaults.deliveryCost,
  title = 'Compare currency prices and purchasing-power measures',
  levelMessage = 'Invented comparable-price example. All exchange quotes are {domestic} per one {foreign}; the domestic price is in {domestic} and the foreign price in {foreign}. The basket benchmark and real ratio exclude the separately supplied delivery cost. A cost comparison alone does not establish executable arbitrage.',
  changeMessage = 'One matched interval, with initial exchange quote {initial}. The price changes are supplied scenarios. All three plotted factor indices start at 100. Rebasing the foreign CPI changes its displayed numbers, not its growth or the normalized real change. These CPI index levels do not establish absolute purchasing-power parity.',
  spotLabel = 'Selected market exchange quote', domesticPriceLabel = 'Comparable domestic price', foreignPriceLabel = 'Comparable foreign price', domesticInflationLabel = 'Domestic price change over the interval', foreignInflationLabel = 'Foreign price change over the interval', indexBaseLabel = 'Foreign CPI starting index', deliveryLabel = 'Supplied one-way delivery cost in domestic currency',
  benchmarkLabel = 'Comparable-price PPP benchmark, domestic per foreign', ratioLabel = 'Converted foreign price divided by domestic price', foreignGapLabel = 'Foreign-currency price gap relative to the basket benchmark', reciprocalGapLabel = 'Reciprocal domestic-currency value gap relative to the benchmark', landedLabel = 'Foreign price converted and delivered, domestic currency', costGapLabel = 'Domestic price minus supplied landed foreign cost',
  relativePPPLabel = 'Nominal quote required to keep the real ratio unchanged', nominalChangeLabel = 'Selected nominal quote change', realChangeLabel = 'Real ratio change under the stated convention', realIndexLabel = 'Normalized real exchange-rate index', priceFactorLabel = 'Foreign/domestic price-growth factor',
  domesticBarLabel = 'Domestic comparable price', foreignBarLabel = 'Foreign comparable price converted', landedBarLabel = 'Foreign converted price plus supplied delivery cost', nominalBarLabel = 'Nominal quote factor, indexed', priceBarLabel = 'Foreign/domestic price factor, indexed', realBarLabel = 'Product: real exchange-rate factor, indexed',
  currencyAxisLabel = 'Cost in domestic currency', indexAxisLabel = 'Index points, initial value 100', levelChartLabel = 'Comparable domestic price and converted foreign price, with a separately supplied landed-cost bar when positive. Costs are in domestic currency and exact values are in the table.', changeChartLabel = 'Terminal indices for nominal quote change, relative price change and their product. These are endpoint factors, not an estimated intraperiod path. The initial reference is 100.',
  tableLabel = 'Comparable prices or normalized real-rate changes; scroll horizontally if needed', quantityHeading = 'Quantity', valueHeading = 'Value at the stated date', startHeading = 'Initial date', endHeading = 'Terminal date', spotRowLabel = 'Exchange quote, domestic per foreign', domesticIndexLabel = 'Domestic CPI with its own base', foreignIndexLabel = 'Foreign CPI with its own base',
  caption = 'All values are invented. The level comparison assumes comparable volume and quality; the change comparison uses each index relative to its own starting value. The selected quote and price scenarios are not market forecasts. A PPP benchmark does not guarantee convergence, timing or a profitable currency position.', className,
}: RealExchangeRateBasketProps) {
  calculateRealExchange({ initialSpot, marketSpot, domesticPrice, foreignPrice, domesticInflation, foreignInflation, foreignIndexBase, deliveryCost });
  if (!['level', 'change'].includes(mode)) throw new Error('RealExchangeRateBasket: mode must be level or change.');
  if (!/^[A-Z]{3}$/.test(domesticCurrency) || !/^[A-Z]{3}$/.test(foreignCurrency) || domesticCurrency === foreignCurrency) throw new Error('RealExchangeRateBasket: provide two distinct uppercase ISO currency codes.');
  const labels = { title, levelMessage, changeMessage, spotLabel, domesticPriceLabel, foreignPriceLabel, domesticInflationLabel, foreignInflationLabel, indexBaseLabel, deliveryLabel, benchmarkLabel, ratioLabel, foreignGapLabel, reciprocalGapLabel, landedLabel, costGapLabel, relativePPPLabel, nominalChangeLabel, realChangeLabel, realIndexLabel, priceFactorLabel, domesticBarLabel, foreignBarLabel, landedBarLabel, nominalBarLabel, priceBarLabel, realBarLabel, currencyAxisLabel, indexAxisLabel, levelChartLabel, changeChartLabel, tableLabel, quantityHeading, valueHeading, startHeading, endHeading, spotRowLabel, domesticIndexLabel, foreignIndexLabel, caption };
  for (const [key, value] of Object.entries(labels)) if (typeof value !== 'string' || !value.trim()) throw new Error(`RealExchangeRateBasket: ${key} must be nonempty.`);
  new Intl.NumberFormat(locale);
  const id = useId(), [spot, setSpot] = useState(marketSpot), [homePrice, setHomePrice] = useState(domesticPrice), [abroadPrice, setAbroadPrice] = useState(foreignPrice), [homeInflation, setHomeInflation] = useState(domesticInflation), [abroadInflation, setAbroadInflation] = useState(foreignInflation), [base, setBase] = useState(foreignIndexBase), [delivery, setDelivery] = useState(deliveryCost);
  const r = calculateRealExchange({ initialSpot, marketSpot: spot, domesticPrice: homePrice, foreignPrice: abroadPrice, domesticInflation: homeInflation, foreignInflation: abroadInflation, foreignIndexBase: base, deliveryCost: delivery });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }), percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 6 });
  const money = (value: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 4 }).format(value);
  const quote = (value: number) => `${number.format(value)} ${domesticCurrency}/${foreignCurrency}`;
  const message = (mode === 'level' ? levelMessage : changeMessage).replace(/\{(domestic|foreign|initial)\}/g, (_, key: string) => ({ domestic: domesticCurrency, foreign: foreignCurrency, initial: quote(initialSpot) })[key]!);
  const controls = [{ key: 'spot', label: `${spotLabel} (${domesticCurrency}/${foreignCurrency})`, value: spot, min: .1, max: 5, step: 'any', set: setSpot, display: quote(spot) }, ...(mode === 'level' ? [
    { key: 'home', label: `${domesticPriceLabel} (${domesticCurrency})`, value: homePrice, min: 10, max: 500, step: 1, set: setHomePrice, display: money(homePrice, domesticCurrency) },
    { key: 'foreign', label: `${foreignPriceLabel} (${foreignCurrency})`, value: abroadPrice, min: 10, max: 500, step: 1, set: setAbroadPrice, display: money(abroadPrice, foreignCurrency) },
    ...(showDeliveryControl ? [{ key: 'delivery', label: deliveryLabel, value: delivery, min: 0, max: 100, step: 1, set: setDelivery, display: money(delivery, domesticCurrency) }] : []),
  ] : [
    { key: 'home-inflation', label: domesticInflationLabel, value: homeInflation * 100, min: -20, max: 50, step: .5, set: (v: number) => setHomeInflation(v / 100), display: percent.format(homeInflation) },
    { key: 'foreign-inflation', label: foreignInflationLabel, value: abroadInflation * 100, min: -20, max: 50, step: .5, set: (v: number) => setAbroadInflation(v / 100), display: percent.format(abroadInflation) },
  ])];
  const levelStats = [[benchmarkLabel, quote(r.absoluteBenchmark)], [ratioLabel, number.format(r.realRatio)], [foreignGapLabel, percent.format(r.foreignQuoteGap)], [reciprocalGapLabel, percent.format(r.reciprocalQuoteGap)], ...(delivery > 0 || showDeliveryControl ? [[landedLabel, money(r.landedForeignPrice, domesticCurrency)], [costGapLabel, money(r.domesticMinusLanded, domesticCurrency)]] : [])];
  const changeStats = [[relativePPPLabel, quote(r.relativePPPSpot)], [nominalChangeLabel, percent.format(r.nominalFactor - 1)], [realChangeLabel, percent.format(r.realFactor - 1)], [realIndexLabel, number.format(r.realIndex)], [priceFactorLabel, number.format(r.relativePriceFactor)]];
  const bars = mode === 'level' ? [{ label: domesticBarLabel, value: homePrice }, { label: foreignBarLabel, value: r.convertedForeignPrice }, ...(delivery > 0 ? [{ label: landedBarLabel, value: r.landedForeignPrice }] : [])] : [{ label: nominalBarLabel, value: r.nominalIndex }, { label: priceBarLabel, value: r.relativePriceIndex }, { label: realBarLabel, value: r.realIndex }];
  const coordinate = (value: number) => Number(value.toFixed(3));
  const maximum = Math.max(1, ...bars.map(bar => bar.value)) * 1.12, y = (value: number) => coordinate(210 - value / maximum * 175);
  const axis = (value: number) => new Intl.NumberFormat(locale, { maximumSignificantDigits: 3, ...(value >= 1e4 ? { notation: 'scientific' as const } : {}) }).format(value);
  const focus = 'block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';
  const levelRows = [[domesticPriceLabel, money(homePrice, domesticCurrency)], [foreignPriceLabel, money(abroadPrice, foreignCurrency)], [foreignBarLabel, money(r.convertedForeignPrice, domesticCurrency)], [benchmarkLabel, quote(r.absoluteBenchmark)], [ratioLabel, number.format(r.realRatio)], ...(delivery > 0 || showDeliveryControl ? [[deliveryLabel, money(delivery, domesticCurrency)], [landedLabel, money(r.landedForeignPrice, domesticCurrency)], [costGapLabel, money(r.domesticMinusLanded, domesticCurrency)]] : [])];
  const changeRows = [[spotRowLabel, quote(initialSpot), quote(spot)], [domesticIndexLabel, number.format(r.domesticIndexStart), number.format(r.domesticIndexEnd)], [foreignIndexLabel, number.format(r.foreignIndexStart), number.format(r.foreignIndexEnd)], [nominalBarLabel, '100', number.format(r.nominalIndex)], [priceBarLabel, '100', number.format(r.relativePriceIndex)], [realIndexLabel, '100', number.format(r.realIndex)]];
  return <figure className={cx('not-prose my-8 rounded-card bg-surface-sunken p-4 text-ink-800 sm:p-6', className)} aria-labelledby={`${id}-title`}>
    <figcaption id={`${id}-title`} className="font-display text-lg font-semibold text-ink-900">{title}</figcaption><p className="mt-3 text-sm leading-relaxed">{message}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{controls.map(control => <label key={control.key} htmlFor={`${id}-${control.key}`} className="min-w-0 text-sm font-medium">{control.label}: <output className="font-mono">{control.display}</output><input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={control.value} onChange={event => control.set(Number(event.target.value))} className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600" /></label>)}{mode === 'change' && <div><label htmlFor={`${id}-base`} className="text-sm font-medium">{indexBaseLabel}</label><select id={`${id}-base`} value={base} onChange={event => setBase(Number(event.target.value))} className="mt-2 block w-full rounded-lg border border-ink-300 bg-surface p-2 text-sm focus-visible:outline-2 focus-visible:outline-brand-600">{[100, 200].map(value => <option key={value} value={value}>{value}</option>)}</select></div>}</div>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2" aria-live="polite" aria-atomic="true">{(mode === 'level' ? levelStats : changeStats).map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-surface p-3"><dt className="text-sm">{label}</dt><dd className="mt-2 break-words font-mono font-semibold">{value}</dd></div>)}</dl>
    <p className="mt-5 text-sm">{mode === 'level' ? `${currencyAxisLabel} (${domesticCurrency})` : indexAxisLabel}</p>
    <svg role="img" aria-label={mode === 'level' ? levelChartLabel : changeChartLabel} viewBox="0 0 640 275" className="mt-2 w-full">
      {[0, maximum / 2, maximum].map(value => <g key={value}><line x1={160} x2={530} y1={y(value)} y2={y(value)} stroke="var(--color-ink-200)" /><text x={145} y={y(value) + 10} textAnchor="end" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{axis(value)}</text></g>)}
      {mode === 'change' && <line x1={160} x2={530} y1={y(100)} y2={y(100)} stroke="var(--color-ink-600)" strokeDasharray="7 5" />}
      {bars.map((bar, index) => { const x = coordinate(160 + (index + .5) / bars.length * 370); return <g key={index}><rect x={coordinate(x - 30)} y={y(bar.value)} width={60} height={coordinate(210 - y(bar.value))} fill={['var(--color-brand-600)', 'var(--color-accent-600)', 'var(--color-ink-600)'][index]} /><text x={x} y={255} textAnchor="middle" className="text-[35px] sm:text-[15px]" fill="var(--color-ink-700)">{String.fromCharCode(65 + index)}</text></g>; })}
    </svg><ul className="mt-3 space-y-2 text-sm">{bars.map((bar, index) => <li key={index}><span className="font-mono font-semibold">{String.fromCharCode(65 + index)}</span> · {bar.label}: <span className="font-mono">{mode === 'level' ? money(bar.value, domesticCurrency) : number.format(bar.value)}</span></li>)}</ul>
    <div className="mt-5"><table tabIndex={0} aria-label={tableLabel} className={focus}><caption className="sr-only">{tableLabel}</caption><thead><tr>{(mode === 'level' ? [quantityHeading, valueHeading] : [quantityHeading, startHeading, endHeading]).map(label => <th key={label} scope="col" className="p-2">{label}</th>)}</tr></thead><tbody>{(mode === 'level' ? levelRows : changeRows).map(([label, ...values], index) => <tr key={index} className="border-t border-ink-200"><th scope="row" className="p-2 font-medium">{label}</th>{values.map((value, j) => <td key={j} className="whitespace-nowrap p-2 font-mono">{value}</td>)}</tr>)}</tbody></table></div><p className="mt-4 text-xs leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
