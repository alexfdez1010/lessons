import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
export interface YieldDecompositionInputs { currentShort: number; expectedAverage: number; termPremium: number }
/** Schematic annual-rate decomposition, not a calibrated model or exact pricing identity. */
export function calculateYieldDecomposition({ currentShort, expectedAverage, termPremium }: YieldDecompositionInputs) {
  if (![currentShort, expectedAverage].every((x) => Number.isFinite(x) && x >= 0 && x <= 0.1) || !Number.isFinite(termPremium) || termPremium < -0.03 || termPremium > 0.03) throw new Error('YieldDecomposition: current/expected annual rates must be within 0–10% and premium within −3 to 3 percentage points.');
  const longYield = expectedAverage + termPremium;
  const expectationGap = expectedAverage - currentShort;
  const spread = longYield - currentShort;
  return { longYield, expectationGap, spread };
}
export interface YieldDecompositionProps extends Partial<YieldDecompositionInputs> {
  title?: string; expectedLabel?: string; premiumLabel?: string; currentLabel?: string; longLabel?: string;
  expectationGapLabel?: string; spreadLabel?: string; itemLabel?: string; valueLabel?: string;
  pointUnitLabel?: string; tableLabel?: string; chartLabel?: string; scopeLabel?: string; locale?: string; className?: string;
}
/** Change assumed components while observing the same-rate-unit spread arithmetic.
 * All signed bars use a common zero and scale. No expectations are extracted from the curve.
 * Native controls and exact fallback remain usable without motion; bars have no autoplay.
 */
export function YieldDecomposition({
  currentShort = 0.05, expectedAverage = 0.05, termPremium = -0.01,
  title = 'Different components can produce the same long yield', expectedLabel = 'Assumed average future short rate',
  premiumLabel = 'Assumed term premium', currentLabel = 'Current short rate', longLabel = 'Schematic long yield',
  expectationGapLabel = 'Expected-average rate minus current short rate', spreadLabel = 'Long-minus-short spread',
  itemLabel = 'Quantity', valueLabel = 'Rate or difference', pointUnitLabel = 'pp',
  tableLabel = 'Exact assumed components of the schematic long yield',
  chartLabel = 'Signed schematic spread components: expected-rate gap and term premium, compared with their sum. Exact values are in the table.',
  scopeLabel = 'Invented annual-rate inputs. Long yield is approximated by expected average short rate plus term premium; convexity and other adjustments are omitted. Inputs are assumptions, not estimates extracted from observed yields or forecasts of actual returns.',
  locale = 'en-US', className,
}: YieldDecompositionProps) {
  calculateYieldDecomposition({ currentShort, expectedAverage, termPremium });
  const id = useId();const [average, setAverage] = useState(expectedAverage);const [premium, setPremium] = useState(termPremium);
  const data = calculateYieldDecomposition({ currentShort, expectedAverage: average, termPremium: premium });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  const points = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const pp = (x: number) => points.format(Math.abs(x) < 1e-10 ? 0 : x * 100) + ' ' + pointUnitLabel;
  const rows = [[currentLabel, percent.format(currentShort)], [expectedLabel, percent.format(average)], [premiumLabel, pp(premium)], [longLabel, percent.format(data.longYield)], [expectationGapLabel, pp(data.expectationGap)], [spreadLabel, pp(data.spread)]];
  const bars = [{ label: expectationGapLabel, value: data.expectationGap }, { label: premiumLabel, value: premium }, { label: spreadLabel, value: data.spread }];
  const scale = Math.max(0.01, ...bars.map((bar) => Math.abs(bar.value)));
  return <section className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
    <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3><p className="mt-2 text-sm text-ink-600">{scopeLabel}</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label htmlFor={id + '-expected'} className="text-sm font-medium text-ink-800">{expectedLabel}: {percent.format(average)}<input id={id + '-expected'} type="range" min="0" max="10" step="0.1" value={average * 100} onChange={(e) => setAverage(Number(e.target.value) / 100)} className="mt-2 block h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>
      <label htmlFor={id + '-premium'} className="text-sm font-medium text-ink-800">{premiumLabel}: {pp(premium)}<input id={id + '-premium'} type="range" min="-3" max="3" step="0.1" value={premium * 100} onChange={(e) => setPremium(Number(e.target.value) / 100)} className="mt-2 block h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /></label>
    </div>
    <div role="img" aria-label={chartLabel} className="mt-5 space-y-4">{bars.map((bar, index) => <div key={index}><div className="mb-1 flex flex-wrap justify-between gap-2 text-sm text-ink-800"><span>{bar.label}</span><span className="font-mono">{pp(bar.value)}</span></div><div className="relative h-5 rounded-pill bg-surface-sunken" aria-hidden="true"><span className="absolute left-1/2 top-0 h-full w-0.5 bg-ink-700" /><div style={{ left: bar.value < 0 ? 50 - Math.abs(bar.value) / scale * 50 + '%' : '50%', width: Math.abs(bar.value) / scale * 50 + '%' }} className={cx('absolute top-0 h-full rounded-pill', index === 0 ? 'bg-brand-600' : index === 1 ? 'bg-accent-600' : 'bg-ink-600')} /></div></div>)}</div>
    <dl aria-live="polite" aria-atomic="true" className="mt-4 grid gap-3 rounded-card bg-surface-sunken p-4 text-sm text-ink-800 sm:grid-cols-2"><div><dt>{longLabel}</dt><dd className="font-mono font-semibold">{percent.format(data.longYield)}</dd></div><div><dt>{spreadLabel}</dt><dd className="font-mono font-semibold">{pp(data.spread)}</dd></div></dl>
    <table tabIndex={0} aria-label={tableLabel} className="mt-4 block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr><th scope="col" className="px-3 py-2">{itemLabel}</th><th scope="col" className="px-3 py-2">{valueLabel}</th></tr></thead><tbody>{rows.map(([label, value], index) => <tr key={index}><th scope="row" className="px-3 py-2 font-medium">{label}</th><td className="px-3 py-2 font-mono">{value}</td></tr>)}</tbody></table>
  </section>;
}
