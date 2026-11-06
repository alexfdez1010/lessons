import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/** Historical all-observation downside RMS and arithmetic Sortino convention. */
export function calculateDownsideRms(returns: readonly number[], target: number) {
  if (!Array.isArray(returns) || returns.length < 2 || returns.length > 100 ||
      returns.some((value) => !Number.isFinite(value) || value < -1 || value > 10) ||
      !Number.isFinite(target) || target <= -1 || target > 10) {
    throw new Error('DownsideTargetRms requires two to 100 finite returns from -100% to 1000% and a finite target above -100% and at most 1000%.');
  }
  const count = returns.length;
  const mean = returns.reduce((sum, value) => sum + value, 0) / count;
  const shortfalls = returns.map((value) => Math.max(0, target - value));
  const squares = shortfalls.map((value) => value ** 2);
  const downside = Math.sqrt(squares.reduce((sum, value) => sum + value, 0) / count);
  return { count, mean, shortfalls, squares, downside, numerator: mean - target,
    sortino: downside === 0 ? null : (mean - target) / downside };
}

export interface DownsideTargetRmsProps {
  /** Annual returns as decimal fractions; all observations enter the denominator. */
  returns?: number[];
  /** Annual target as a decimal fraction. Defaults to zero. */
  target?: number;
  title?: string;
  targetLabel?: string;
  meanLabel?: string;
  numeratorLabel?: string;
  denominatorCountLabel?: string;
  downsideLabel?: string;
  sortinoLabel?: string;
  undefinedLabel?: string;
  /** Four headers: year, return, shortfall, squared shortfall in percentage points squared. */
  tableHeaders?: [string, string, string, string];
  /** Description template: {title}, {target}, {mean}, {count}, {downside}, {sortino}. */
  chartLabel?: string;
  caption?: string;
  locale?: string;
  className?: string;
}

/** Changing the target changes BOTH the arithmetic excess-return numerator and
 * every shortfall, while keeping the return observations and N fixed. */
export function DownsideTargetRms({
  returns = [-0.02, 0.01, 0.03, 0.06], target = 0,
  title = 'Move the target, keep all four observations',
  targetLabel = 'Annual target', meanLabel = 'Arithmetic annual mean',
  numeratorLabel = 'Mean minus target', denominatorCountLabel = 'Observations in the denominator',
  downsideLabel = 'Annual downside RMS', sortinoLabel = 'Annual-observation Sortino',
  undefinedLabel = 'Undefined with zero downside RMS',
  tableHeaders = ['Year', 'Return', 'Shortfall below target', 'Squared shortfall in percentage points squared'],
  chartLabel = '{title}: target {target}, mean {mean}, {count} observations, downside RMS {downside}, Sortino {sortino}. The dashed line is the target; vertical gaps below it are shortfalls.',
  caption = 'Annual observations; every year enters the RMS denominator, including years at or above target. Squared shortfalls in the table use percentage points squared. This is a historical description, not a forecast of future downside risk.',
  locale = 'en-US', className,
}: DownsideTargetRmsProps) {
  calculateDownsideRms(returns, target);
  if (!Array.isArray(tableHeaders) || tableHeaders.length !== 4 || tableHeaders.some((label) => !label.trim())) {
    throw new Error('DownsideTargetRms requires four non-empty tableHeaders.');
  }
  const id = useId();
  const [selectedTarget, setTarget] = useState(target);
  const result = calculateDownsideRms(returns, selectedTarget);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  const pct = (value: number) => `${number.format(value * 100)}%`;
  const ratio = result.sortino === null ? undefinedLabel : number.format(result.sortino);
  const minTarget = Math.max(-1 + Number.EPSILON, Math.min(-0.02, ...returns, target) - 0.01);
  const maxTarget = Math.min(10, Math.max(0.04, ...returns, target) + 0.01);
  const minY = Math.min(0, ...returns, minTarget);
  const maxY = Math.max(...returns, maxTarget);
  const y = (value: number) => 190 - (value - minY) / (maxY - minY) * 160;
  const x = (index: number) => 45 + index / (returns.length - 1) * 420;
  const values = { title, target: pct(selectedTarget), mean: pct(result.mean), count: String(result.count), downside: pct(result.downside), sortino: ratio };
  const description = chartLabel.replace(/\{(title|target|mean|count|downside|sortino)\}/g, (_, key: keyof typeof values) => values[key]);
  return <figure className={cx('not-prose my-6 rounded-card bg-surface-sunken/50 p-5', className)}>
    <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
    <label htmlFor={`${id}-target`} className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-700">
      <span>{targetLabel}</span><output htmlFor={`${id}-target`} className="font-mono font-semibold text-ink-900">{pct(selectedTarget)}</output>
    </label>
    <input id={`${id}-target`} type="range" min={minTarget} max={maxTarget} step={0.0005} value={selectedTarget}
      onChange={(event) => setTarget(Number(event.target.value))} aria-valuetext={pct(selectedTarget)}
      className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600" />
    <svg viewBox="0 0 510 230" role="img" aria-labelledby={`${id}-chart`} className="mt-4 w-full">
      <title id={`${id}-chart`}>{description}</title>
      <path d={`M 25 ${y(0)} H 485`} stroke="var(--color-ink-300)" fill="none" />
      <path d={`M 25 ${y(selectedTarget)} H 485`} stroke="var(--color-ink-700)" strokeDasharray="5 4" fill="none" />
      {returns.map((value, index) => <g key={index}>
        <path d={`M ${x(index)} ${y(0)} V ${y(value)}`} stroke="var(--color-brand-600)" strokeWidth={8} />
        {value < selectedTarget && <path d={`M ${x(index) + 10} ${y(selectedTarget)} V ${y(value)}`} stroke="var(--color-accent-600)" strokeWidth={3} />}
        <circle cx={x(index)} cy={y(value)} r={5} fill="var(--color-brand-600)" />
        <text x={x(index)} y={212} textAnchor="middle" className="fill-ink-600 text-xs">{index + 1}</text>
      </g>)}
      <text x={25} y={18} className="fill-ink-700 text-xs">{targetLabel}: {pct(selectedTarget)}</text>
    </svg>
    <div>
      <table tabIndex={0} aria-label={title} className="block w-full max-w-full overflow-x-auto text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
        <thead><tr>{tableHeaders.map((header) => <th key={header} scope="col" className="px-2 py-2 font-semibold text-ink-900">{header}</th>)}</tr></thead>
        <tbody>{returns.map((value, index) => <tr key={index} className="even:bg-surface">
          <th scope="row" className="px-2 py-2 font-mono font-normal text-ink-700">{index + 1}</th>
          <td className="whitespace-nowrap px-2 py-2 font-mono text-ink-700">{pct(value)}</td>
          <td className="whitespace-nowrap px-2 py-2 font-mono text-ink-700">{pct(result.shortfalls[index])}</td>
          <td className="px-2 py-2 font-mono text-ink-700">{number.format(result.squares[index] * 10000)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2" aria-live="polite" aria-atomic="true">
      {[[meanLabel, pct(result.mean)], [numeratorLabel, pct(result.numerator)], [denominatorCountLabel, String(result.count)],
        [downsideLabel, pct(result.downside)], [sortinoLabel, ratio]].map(([label, value]) => <div key={label} className="min-w-0">
        <dt className="text-ink-600">{label}</dt><dd className="mt-1 font-mono font-semibold text-ink-900">{value}</dd>
      </div>)}
    </dl>
    <p className="mt-4 text-sm text-ink-600">{caption}</p>
  </figure>;
}

export default DownsideTargetRms;
