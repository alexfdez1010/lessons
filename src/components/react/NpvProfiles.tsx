import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';
import { valueCashFlowStream, type TimelineCashFlow } from '@/components/react/CashFlowValuationTimeline';

/** A signed, dated project from one consistent investor viewpoint. */
export interface NpvProfile {
  label: string;
  flows: TimelineCashFlow[];
}

export interface NpvProfilesProps {
  /** One to three projects, each with one to twelve finite dated payments. */
  profiles: NpvProfile[];
  /** Effective per-period rate domain, strictly above -100%, up to 300%. */
  minRate?: number;
  maxRate?: number;
  /** Initial selected rate within that domain. */
  rate?: number;
  /** Up to ten exact rates shown beside the selected rate in the data table. */
  tableRates?: number[];
  title?: string;
  rateLabel?: string;
  rateAxisLabel?: string;
  valueAxisLabel?: string;
  selectedLabel?: string;
  tableLabel?: string;
  tableCaption?: string;
  /** Accessible chart name, with {min}, {max}, {rate} placeholders. */
  chartLabel?: string;
  /** Explicitly states the sampled plot's limits; the chart is not a root solver. */
  scopeLabel?: string;
  currency?: string;
  locale?: string;
  className?: string;
}

function validateProfiles(profiles: NpvProfile[]) {
  if (!Array.isArray(profiles) || profiles.length < 1 || profiles.length > 3) {
    throw new Error('NpvProfiles: provide one to three projects.');
  }
  if (profiles.some((profile) => !profile || typeof profile.label !== 'string' || !profile.label.trim() ||
    !Array.isArray(profile.flows) || profile.flows.length < 1 || profile.flows.length > 12 ||
    profile.flows.some((flow) => !flow || typeof flow.label !== 'string' || !flow.label.trim() ||
      !Number.isInteger(flow.time) || flow.time < 0 || flow.time > 50 ||
      !Number.isFinite(flow.amount) || Math.abs(flow.amount) > 1e12))) {
    throw new Error('NpvProfiles: each project needs a label and one to twelve labeled finite flows at integer dates from zero to fifty.');
  }
}

/** Exact date-zero values at the supplied rates, using the shared dated-flow helper. */
export function calculateNpvProfiles(profiles: NpvProfile[], rates: number[]): number[][] {
  validateProfiles(profiles);
  if (!Array.isArray(rates) || rates.length < 1 || rates.some((rate) => !Number.isFinite(rate) || rate <= -1)) {
    throw new Error('NpvProfiles: rates must be finite and strictly above -100%.');
  }
  return rates.map((rate) => profiles.map((profile) => valueCashFlowStream(profile.flows, 0, rate)));
}

/** A sampled NPV profile and exact numerical fallback, with no inferred roots.
 * The selected opportunity-cost rate changes the date-zero value of fixed flows.
 * Line patterns supplement colors. There is no autoplay or essential animation.
 * The table itself is focusable because lesson CSS can make it the scroll surface.
 */
export function NpvProfiles({
  profiles, minRate = 0, maxRate = 0.6, rate = 0.1, tableRates = [0, 0.1, 0.2, 0.3, 0.4, 0.6],
  title = 'Value the same projects at different assumed rates',
  rateLabel = 'Assumed effective rate per period', rateAxisLabel = 'Assumed rate',
  valueAxisLabel = 'Net present value', selectedLabel = 'At the selected rate',
  tableLabel = 'Exact net present values at selected rates',
  tableCaption = 'Each row discounts the original signed payments to date zero.',
  chartLabel = 'Sampled net-present-value profiles from {min} to {max}. The selected rate is {rate}.',
  scopeLabel = 'Lines join sampled values within the displayed rate range. Use the exact table and algebra to check crossings; the plot does not establish how many roots exist outside its range.',
  currency = 'USD', locale = 'en-US', className,
}: NpvProfilesProps) {
  validateProfiles(profiles);
  if (![minRate, maxRate, rate].every(Number.isFinite) || minRate < -0.9 || maxRate > 3 ||
      maxRate <= minRate || rate < minRate || rate > maxRate) {
    throw new Error('NpvProfiles: use an increasing rate domain from at least -90% to at most 300%, with the selected rate inside.');
  }
  if (!Array.isArray(tableRates) || tableRates.length > 10 || tableRates.some((item) =>
      !Number.isFinite(item) || item < minRate || item > maxRate)) {
    throw new Error('NpvProfiles: table rates must be finite, within the domain, with at most ten entries.');
  }
  const id = useId();
  const [selectedRate, setSelectedRate] = useState(rate);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 4 });
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const axisMoney = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 });
  const clean = (value: number) => Math.abs(value) < 1e-9 ? 0 : value;
  const sampledRates = Array.from({ length: 161 }, (_, index) => minRate + (maxRate - minRate) * index / 160);
  const sampledValues = calculateNpvProfiles(profiles, sampledRates);
  const values = sampledValues.flat();
  const bottom = Math.min(0, ...values);
  const top = Math.max(0, ...values);
  const margin = Math.max((top - bottom) * 0.08, 0.01);
  const lower = bottom - margin;
  const upper = top + margin;
  const x = (item: number) => 74 + (item - minRate) / (maxRate - minRate) * 528;
  const y = (item: number) => 270 - (item - lower) / (upper - lower) * 224;
  const exactRates = [...new Set([...tableRates, selectedRate])].sort((a, b) => a - b);
  const exactValues = calculateNpvProfiles(profiles, exactRates);
  const selectedValues = calculateNpvProfiles(profiles, [selectedRate])[0];
  const classes = ['text-brand-600', 'text-accent-600', 'text-ink-800'];
  const dashes = [undefined, '9 5', '2 4'];
  const description = chartLabel.replaceAll('{min}', percent.format(minRate))
    .replaceAll('{max}', percent.format(maxRate)).replaceAll('{rate}', percent.format(selectedRate));

  return (
    <section className={cx('not-prose my-6 rounded-card bg-surface p-4 shadow-soft sm:p-6', className)}>
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <label htmlFor={id + '-rate'} className="mt-4 block text-sm font-medium text-ink-700">
        {rateLabel}: {percent.format(selectedRate)}
        <input id={id + '-rate'} type="range" min={minRate * 100} max={maxRate * 100} step="0.5"
          value={selectedRate * 100} onChange={(event) => setSelectedRate(Number(event.target.value) / 100)}
          className="mt-2 block w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
      </label>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-hidden="true">
        {profiles.map((profile, index) => <span key={index} className={cx('flex items-center gap-2', classes[index])}>
          <svg width="30" height="8"><line x1="0" x2="30" y1="4" y2="4" stroke="currentColor" strokeWidth="3" strokeDasharray={dashes[index]} /></svg>
          {profile.label}
        </span>)}
      </div>
      <svg viewBox="0 0 640 320" role="img" aria-labelledby={id + '-chart'} className="mt-2 block h-auto w-full text-ink-700">
        <title id={id + '-chart'}>{description}</title>
        {[lower + (upper - lower) * 0.2, lower + (upper - lower) * 0.5, lower + (upper - lower) * 0.8].map((tick, index) =>
          <g key={index} className="text-ink-200"><line x1="74" x2="602" y1={y(tick)} y2={y(tick)} stroke="currentColor" /><text x="66" y={y(tick) + 4} textAnchor="end" className="fill-ink-600 text-[11px]">{axisMoney.format(tick)}</text></g>)}
        <line x1="74" x2="602" y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth="1.5" />
        <text x="66" y={y(0) + 4} textAnchor="end" className="fill-ink-700 text-[11px]">0</text>
        {profiles.map((profile, index) => <path key={index} aria-hidden="true"
          d={sampledRates.map((item, point) => (point ? 'L' : 'M') + x(item) + ',' + y(sampledValues[point][index])).join(' ')}
          fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={dashes[index]} className={classes[index]} />)}
        <line x1={x(selectedRate)} x2={x(selectedRate)} y1="46" y2="270" stroke="currentColor" strokeDasharray="4 4" className="text-ink-400" />
        {selectedValues.map((item, index) => <circle key={index} cx={x(selectedRate)} cy={y(item)} r="4" fill="currentColor" className={classes[index]} />)}
        {[minRate, (minRate + maxRate) / 2, maxRate].map((item, index) => <text key={index} x={x(item)} y="289" textAnchor="middle" className="fill-ink-700 text-[11px]">{percent.format(item)}</text>)}
        <text x="338" y="311" textAnchor="middle" className="fill-ink-700 text-[12px]">{rateAxisLabel}</text>
        <text x="74" y="27" className="fill-ink-700 text-[12px]">{valueAxisLabel} · {currency}</text>
      </svg>
      <div aria-live="polite" aria-atomic="true" className="mt-2 rounded-card bg-surface-sunken p-3 text-sm text-ink-800">
        <p className="font-semibold">{selectedLabel} {percent.format(selectedRate)}</p>
        <ul className="mt-1 space-y-1">{profiles.map((profile, index) => <li key={index}>{profile.label}: {money.format(clean(selectedValues[index]))}</li>)}</ul>
      </div>
      <p className="mt-3 text-sm text-ink-600">{scopeLabel}</p>
      <div className="mt-4">
        <table tabIndex={0} aria-label={tableLabel} className="block w-full max-w-full overflow-x-auto text-left text-sm text-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <caption className="mb-2 text-left text-sm text-ink-600">{tableCaption}</caption>
          <thead><tr><th scope="col" className="px-3 py-2">{rateAxisLabel}</th>{profiles.map((profile, index) => <th key={index} scope="col" className="px-3 py-2">{profile.label}</th>)}</tr></thead>
          <tbody>{exactRates.map((item, row) => <tr key={item} className="border-t border-ink-200">
            <th scope="row" className="px-3 py-2 font-medium">{percent.format(item)}</th>
            {exactValues[row].map((value, column) => <td key={column} className="px-3 py-2 font-mono">{money.format(clean(value))}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
