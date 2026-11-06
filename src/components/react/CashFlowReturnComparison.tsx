import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CashFlowReturnComparisonProps {
  /** Heading identifying the fixed two-year market path. */
  title?: string;
  /** Initial deposit, positive and finite. Defaults to 1000. */
  principal?: number;
  /** Initial contribution at the year-one boundary, from zero to three times principal. */
  contribution?: number;
  /** Locale for all number formatting. */
  locale?: string;
  /** Currency symbol used before the amounts. */
  currencyPrefix?: string;
  /** Label for the contribution slider. */
  contributionLabel?: string;
  /** Four labels: start, before contribution, after contribution, end. */
  stageLabels?: [string, string, string, string];
  /** Accessible description of the balance chart. */
  chartLabel?: string;
  /** Horizontal time-axis label. */
  chartAxisLabel?: string;
  /** Label for investment gain after separating deposits. */
  gainLabel?: string;
  /** Label for total time-weighted return across both years. */
  totalTwrLabel?: string;
  /** Label for annualized time-weighted return. */
  annualTwrLabel?: string;
  /** Label for the annual money-weighted internal rate of return. */
  mwrLabel?: string;
  /** Assumptions and the meaning of moving the slider. */
  caption?: string;
  className?: string;
}

/** Exact two-year illustration. A +10% year, an external contribution, then a
 * −10% year. The positive quadratic root is unique: contributions are nonnegative
 * and the terminal value is positive, so the polynomial has opposite-sign roots. */
export function calculateCashFlowReturns(principal: number, contribution: number) {
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(4.1 * principal) ||
      !Number.isFinite(contribution) || contribution < 0 || contribution > 3 * principal) {
    throw new Error('CashFlowReturnComparison requires positive finite principal and contribution between zero and three times principal.');
  }
  const beforeContribution = principal * 1.1;
  const afterContribution = beforeContribution + contribution;
  const finalValue = afterContribution * 0.9;
  // Rationalized quadratic root avoids subtracting nearly equal numbers.
  const flowRatio = contribution / principal;
  const terminalFactor = (1.1 + flowRatio) * 0.9;
  const growthFactor = (2 * terminalFactor) /
    (flowRatio + Math.sqrt(flowRatio ** 2 + 4 * terminalFactor));
  return {
    beforeContribution,
    afterContribution,
    finalValue,
    gain: finalValue - principal - contribution,
    totalTwr: 1.1 * 0.9 - 1,
    annualTwr: Math.sqrt(1.1 * 0.9) - 1,
    annualMwr: growthFactor - 1,
  };
}

/** Moving the contribution changes the money exposed to the losing year while
 * keeping each year's investment return fixed. All data remain visible without
 * motion; the native range input supports pointer and keyboard interaction. */
export function CashFlowReturnComparison({
  title = 'Same market path, different cash exposure',
  principal = 1000,
  contribution = 1000,
  locale = 'en-US',
  currencyPrefix = '€',
  contributionLabel = 'Contribution after year one',
  stageLabels = ['Start', 'Year one before deposit', 'Year one after deposit', 'End of year two'],
  chartLabel = 'Portfolio balances at the start, just before and after the contribution, and after the second year. Year one earns 10%; year two loses 10%.',
  chartAxisLabel = 'Years',
  gainLabel = 'Investment gain over two years',
  totalTwrLabel = 'TWR over two years',
  annualTwrLabel = 'Annualized TWR',
  mwrLabel = 'MWR per year',
  caption = 'Two one-year periods, +10% then −10%; the contribution arrives between them. No fees, taxes, withdrawals or separate distributions. The vertical jump is the contribution. Lines join valuation points, without assuming an intra-year price path. Move the contribution while keeping market returns fixed.',
  className,
}: CashFlowReturnComparisonProps) {
  calculateCashFlowReturns(principal, contribution);
  if (!Array.isArray(stageLabels) || stageLabels.length !== 4 || stageLabels.some((label) => !label.trim())) {
    throw new Error('CashFlowReturnComparison requires four non-empty stageLabels.');
  }
  const id = useId();
  const [flow, setFlow] = useState(contribution);
  const result = calculateCashFlowReturns(principal, flow);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const money = (value: number) => `${value < 0 ? '−' : ''}${currencyPrefix}${number.format(Math.abs(value))}`;
  const percent = (value: number) => `${value < 0 ? '−' : ''}${number.format(Math.abs(value) * 100)}%`;
  const balances = [principal, result.beforeContribution, result.afterContribution, result.finalValue];
  const maxBalance = 4.1 * principal;
  const points = balances.map((value, index) => ({ x: [35, 247.5, 247.5, 460][index], y: 190 - value / maxBalance * 160 }));
  return (
    <figure className={cx('not-prose my-6 rounded-card bg-surface-sunken/50 p-5', className)}>
      <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
      <div className="mt-4">
        <label htmlFor={`${id}-flow`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-700">
          <span>{contributionLabel}</span>
          <output htmlFor={`${id}-flow`} className="font-mono font-semibold text-ink-900">{money(flow)}</output>
        </label>
        <input id={`${id}-flow`} type="range" min={0} max={3 * principal} step={principal / 100}
          value={flow} onChange={(event) => setFlow(Number(event.target.value))}
          className="mt-3 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          aria-valuetext={money(flow)} />
      </div>
      <svg viewBox="0 0 495 245" role="img" aria-labelledby={`${id}-chart`} className="mt-4 w-full">
        <title id={`${id}-chart`}>{chartLabel}</title>
        <path d="M 25 190 H 475" stroke="var(--color-ink-200)" fill="none" />
        <path d={`M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} M ${points[2].x} ${points[2].y} L ${points[3].x} ${points[3].y}`}
          stroke="var(--color-brand-600)" strokeWidth={3} fill="none" />
        <path d={`M ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y}`}
          stroke="var(--color-accent-600)" strokeWidth={3} strokeDasharray="5 4" fill="none" />
        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={5} fill="var(--color-brand-600)" />

          </g>
        ))}
        {[0, 1, 2].map((year) => <text key={year} x={35 + year * 212.5} y={208} textAnchor="middle" className="fill-ink-600 text-xs">{year}</text>)}
        <text x={247.5} y={234} textAnchor="middle" className="fill-ink-600 text-xs">{chartAxisLabel}</text>
      </svg>
      <ol className="mt-1 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {stageLabels.map((label, index) => <li key={index} className="min-w-0">
          <span className="block text-ink-600">{label}</span>
          <span className="font-mono font-semibold text-ink-900">{money(balances[index])}</span>
        </li>)}
      </ol>
      <dl aria-live="polite" aria-atomic="true" className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {[[gainLabel, money(result.gain)], [totalTwrLabel, percent(result.totalTwr)],
          [annualTwrLabel, percent(result.annualTwr)], [mwrLabel, percent(result.annualMwr)]].map(([label, value]) =>
          <div key={label}><dt className="text-ink-600">{label}</dt><dd className="mt-1 font-mono font-semibold text-ink-900">{value}</dd></div>)}
      </dl>
      <p className="mt-4 text-sm text-ink-600">{caption}</p>
    </figure>
  );
}

export default CashFlowReturnComparison;
