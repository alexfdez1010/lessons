import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type Shape = 'normal' | 'flat' | 'inverted';
const DEFAULT_TICKS = ['3m', '1y', '2y', '5y', '10y', '30y'];
const YIELDS: Record<Shape, number[]> = {
  normal: [3.6, 4, 4.3, 4.7, 5, 5.3],
  flat: [4.5, 4.5, 4.55, 4.5, 4.5, 4.55],
  inverted: [5.4, 5.1, 4.8, 4.4, 4.1, 3.9],
};

/** Hypothetical selected tenors; yields and spread are measured in percentage points. */
export function calculateIllustrativeYieldCurve(shape: Shape) {
  if (!Object.hasOwn(YIELDS, shape)) throw new Error('YieldCurveShapes: shape must be normal, flat or inverted.');
  const values = [...YIELDS[shape]];
  return { values, shortRate: values[0], longRate: values[4], spread: values[4] - values[0] };
}

export interface YieldCurveShapesProps {
  title?: string;
  normalLabel?: string;
  flatLabel?: string;
  invertedLabel?: string;
  maturityAxisLabel?: string;
  yieldAxisLabel?: string;
  spreadLabel?: string;
  shortLabel?: string;
  longLabel?: string;
  caption?: string;
  normalInterpretation?: string;
  flatInterpretation?: string;
  invertedInterpretation?: string;
  /** Translate these six fixed tenors: 3 months, 1 year, 2 years, 5 years, 10 years, 30 years. */
  maturityTicks?: string[];
  shape?: Shape;
  locale?: string;
  /** Unit of the difference between two percentage yields. */
  spreadUnitLabel?: string;
  /** Accessible description with {short}, {long}, {spread}, {interpretation} tokens. */
  chartLabel?: string;
  tableLabel?: string;
  tableMaturityLabel?: string;
  tableYieldLabel?: string;
  className?: string;
}

/** User-selected illustrative rate snapshots with exact numerical fallback.
 * Horizontal categories have equal spacing; these are not elapsed-time coordinates.
 * Straight segments guide the eye and do not estimate an unobserved pricing curve.
 * No recession probability, expected-rate path or term premium is inferred.
 * There is no autoplay or essential animation; all data also render without hydration.
 */
export function YieldCurveShapes({
  title = 'Three illustrative yield-curve snapshots', normalLabel = 'Upward', flatLabel = 'Flat', invertedLabel = 'Inverted',
  maturityAxisLabel = 'Selected maturities, equally spaced categories', yieldAxisLabel = 'Illustrative annual yield',
  spreadLabel = '10y minus 3m spread', shortLabel = 'Three-month model yield', longLabel = 'Ten-year model yield',
  caption = 'Invented annual yields at selected maturities. Categories are equally spaced; lines guide the eye. No calibrated pricing curve, expected-rate path or recession forecast is estimated.',
  normalInterpretation = 'The selected longer-maturity yields are higher. That shape alone does not identify expectations or term premia.',
  flatInterpretation = 'The selected yields are close. Flatness alone does not establish a transition or a growth forecast.',
  invertedInterpretation = 'The ten-year model yield is below the three-month yield. The spread is a description, not a guaranteed recession.',
  maturityTicks = DEFAULT_TICKS, shape = 'normal', locale = 'en-US', spreadUnitLabel = 'pp',
  chartLabel = 'Illustrative yields: short {short}, long {long}, difference {spread}. {interpretation} Exact selected values are in the table.',
  tableLabel = 'Exact hypothetical yields at the six selected maturities', tableMaturityLabel = 'Maturity', tableYieldLabel = 'Annual yield', className,
}: YieldCurveShapesProps) {
  calculateIllustrativeYieldCurve(shape);
  if (!Array.isArray(maturityTicks) || maturityTicks.length !== 6 || maturityTicks.some((tick) => typeof tick !== 'string' || !tick.trim())) throw new Error('YieldCurveShapes: provide six nonempty labels for the fixed model maturities.');
  const id = useId();const [selected, setSelected] = useState<Shape>(shape);
  const { values, shortRate, longRate, spread } = calculateIllustrativeYieldCurve(selected);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const difference = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const pct = (value: number) => percent.format(value / 100);
  const signed = difference.format(Math.abs(spread) < 1e-10 ? 0 : spread) + ' ' + spreadUnitLabel;
  const interpretation = selected === 'normal' ? normalInterpretation : selected === 'flat' ? flatInterpretation : invertedInterpretation;
  const description = chartLabel.replaceAll('{short}', pct(shortRate)).replaceAll('{long}', pct(longRate)).replaceAll('{spread}', signed).replaceAll('{interpretation}', interpretation);
  const x = (index: number) => 78 + index / 5 * 422;
  const y = (value: number) => 200 - (value - 3) / 3 * 154;
  const labels: [Shape, string][] = [['normal', normalLabel], ['flat', flatLabel], ['inverted', invertedLabel]];
  return <figure className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
    <figcaption className="font-display text-lg font-semibold text-ink-900">{title}</figcaption>
    <div role="group" aria-label={title} className="mt-4 flex flex-wrap gap-2">{labels.map(([key, label]) => <button key={key} type="button" aria-pressed={selected === key} onClick={() => setSelected(key)} className={cx('rounded-pill px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600', selected === key ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-ink-800')}>{label}</button>)}</div>
    <p className="mt-4 text-xs text-ink-600">{yieldAxisLabel}</p>
    <svg role="img" aria-labelledby={id + '-chart'} viewBox="0 0 540 252" className="mt-1 block h-auto w-full">
      <title id={id + '-chart'}>{description}</title>
      {[3, 4, 5, 6].map((tick) => <g key={tick}><line x1="78" x2="500" y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-ink-200" /><text x="70" y={y(tick) + 4} textAnchor="end" className="fill-ink-600 text-[20px] sm:text-[11px]">{pct(tick)}</text></g>)}
      <path d={values.map((value, index) => (index ? 'L' : 'M') + x(index) + ',' + y(value)).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand-600" />
      {values.map((value, index) => <g key={index}><circle cx={x(index)} cy={y(value)} r="4" fill="currentColor" className="text-accent-600" /><text x={x(index)} y="232" textAnchor="middle" className="fill-ink-700 text-[20px] sm:text-[11px]">{maturityTicks[index]}</text></g>)}
    </svg>
    <p className="mt-1 text-xs text-ink-600">{maturityAxisLabel}</p>
    <dl aria-live="polite" aria-atomic="true" className="mt-3 grid gap-3 text-sm text-ink-800 sm:grid-cols-3">{[[shortLabel, pct(shortRate)], [longLabel, pct(longRate)], [spreadLabel, signed]].map(([label, value], index) => <div key={index}><dt>{label}</dt><dd className="font-mono font-semibold">{value}</dd></div>)}</dl>
    <p className="mt-3 text-sm text-ink-700">{interpretation}</p><p className="mt-2 text-sm text-ink-600">{caption}</p>
    <table tabIndex={0} aria-label={tableLabel} className="mt-4 block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr><th scope="col" className="px-3 py-2">{tableMaturityLabel}</th><th scope="col" className="px-3 py-2">{tableYieldLabel}</th></tr></thead><tbody>{values.map((value, index) => <tr key={index}><th scope="row" className="px-3 py-2 font-medium">{maturityTicks[index]}</th><td className="px-3 py-2 font-mono">{pct(value)}</td></tr>)}</tbody></table>
  </figure>;
}
export default YieldCurveShapes;
