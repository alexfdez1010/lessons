import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RepaymentStructureInputs {
  principal: number;
  /** Direct periodic rate, not a regulatory APR. Basis-point precision, 0–5% monthly. */
  monthlyRate: number;
  months: number;
  customPayment: number;
  capitalizeUnpaidInterest: boolean;
}
export interface RepaymentStructureRow {
  month: number;
  openingCents: number;
  interestCents: number;
  paymentCents: number;
  principalReductionCents: number;
  closingCents: number;
}
export interface RepaymentStructurePlan {
  rows: RepaymentStructureRow[];
  regularPaymentCents: number;
  interestCents: number;
  scheduledPaymentsCents: number;
  balloonCents: number;
  maturityDueCents: number;
  totalWithBalloonCents: number;
}

const wholeCents = (value: number) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
function validate(inputs: RepaymentStructureInputs) {
  const { principal, monthlyRate, months, customPayment, capitalizeUnpaidInterest } = inputs;
  if (!wholeCents(principal) || principal < 1 || principal > 1_000_000 || !Number.isFinite(monthlyRate) || monthlyRate < 0 || monthlyRate > 0.05 || Math.abs(monthlyRate * 10_000 - Math.round(monthlyRate * 10_000)) > 1e-8 || !Number.isInteger(months) || months < 1 || months > 60 || !wholeCents(customPayment) || customPayment < 0 || customPayment > 1_000_000 || typeof capitalizeUnpaidInterest !== 'boolean') {
    throw new Error('RepaymentStructures: principal must be 1–1,000,000 in cents, monthlyRate 0–0.05 in basis-point steps, months an integer 1–60, customPayment 0–1,000,000 in cents, and capitalization permission a boolean.');
  }
}

/** Monthly interest rounds half up to cents; the final amortizing payment clears the exact due amount. */
export function simulateRepaymentStructures(inputs: RepaymentStructureInputs) {
  validate(inputs);
  const { principal, monthlyRate, months, customPayment, capitalizeUnpaidInterest } = inputs;
  const original = Math.round(principal * 100);
  const bp = Math.round(monthlyRate * 10_000);
  const level = Math.round(monthlyRate === 0 ? original / months : original * monthlyRate / (1 - (1 + monthlyRate) ** -months));
  const build = (kind: 'amortizing' | 'interestOnly' | 'custom'): RepaymentStructurePlan | null => {
    let balance = original;
    const rows: RepaymentStructureRow[] = [];
    for (let month = 1; month <= months; month++) {
      const openingCents = balance;
      // Integer basis points and integer cents keep half-cent rounding deterministic.
      const interestCents = Math.floor((openingCents * bp + 5000) / 10_000);
      const due = openingCents + interestCents;
      const proposed = kind === 'amortizing' ? (month === months ? due : level) : kind === 'interestOnly' ? interestCents : Math.round(customPayment * 100);
      const paymentCents = Math.min(proposed, due);
      if (kind === 'custom' && paymentCents < interestCents && !capitalizeUnpaidInterest) return null;
      balance = due - paymentCents;
      rows.push({ month, openingCents, interestCents, paymentCents, principalReductionCents: paymentCents - interestCents, closingCents: balance });
    }
    const interestCents = rows.reduce((sum, row) => sum + row.interestCents, 0);
    const scheduledPaymentsCents = rows.reduce((sum, row) => sum + row.paymentCents, 0);
    return { rows, regularPaymentCents: kind === 'amortizing' ? level : kind === 'custom' ? Math.round(customPayment * 100) : Math.floor((original * bp + 5000) / 10_000), interestCents, scheduledPaymentsCents, balloonCents: balance, maturityDueCents: rows[rows.length - 1].paymentCents + balance, totalWithBalloonCents: scheduledPaymentsCents + balance };
  };
  return { amortizing: build('amortizing')!, interestOnly: build('interestOnly')!, custom: build('custom') };
}

export interface RepaymentStructuresProps extends Partial<RepaymentStructureInputs> {
  title?: string;
  principalLabel?: string;
  monthlyRateLabel?: string;
  monthsLabel?: string;
  customPaymentLabel?: string;
  capitalizationLabel?: string;
  settlementLabel?: string;
  amortizingLabel?: string;
  interestOnlyLabel?: string;
  customLabel?: string;
  interestLabel?: string;
  balloonLabel?: string;
  maturityDueLabel?: string;
  totalPaidLabel?: string;
  unsupportedLabel?: string;
  chartBeforeLabel?: string;
  chartAfterLabel?: string;
  balanceAxisLabel?: string;
  tableLabel?: string;
  /** Month, opening, interest, scheduled payment, principal reduction, before-balloon balance, balloon. */
  tableHeaders?: string[];
  caption?: string;
  locale?: string;
  currency?: string;
  className?: string;
}

/** Separate maturity settlement occurs at the SAME month as the final scheduled payment. No automatic motion. */
export function RepaymentStructures({
  principal = 1000, monthlyRate = 0.01, months = 3, customPayment = 5, capitalizeUnpaidInterest = true,
  title = 'Same rate, different repayment promises',
  principalLabel = 'Initial amount borrowed', monthlyRateLabel = 'Direct monthly interest rate', monthsLabel = 'Maturity month', customPaymentLabel = 'Custom scheduled monthly payment',
  capitalizationLabel = 'Illustrative contract permits capitalizing unpaid interest', settlementLabel = 'Show the separate remaining balance being paid at maturity',
  amortizingLabel = 'Fully amortizing', interestOnlyLabel = 'Interest only', customLabel = 'Custom payment', interestLabel = 'Total interest charged', balloonLabel = 'Separate balance repayment at maturity', maturityDueLabel = 'Total due on maturity date', totalPaidLabel = 'Total paid including balloon',
  unsupportedLabel = 'No valid custom schedule calculated: the payment does not cover interest and capitalization permission is off. A real short payment can create arrears or default; this panel does not model them.',
  chartBeforeLabel = 'Monthly balances after scheduled payments, before the separate maturity balance repayment. Exact amounts are available in the tables.',
  chartAfterLabel = 'Monthly balances with the separate contractual remaining balance paid at maturity, at the same time coordinate as the last scheduled payment. Exact amounts are available in the tables.',
  balanceAxisLabel = 'Outstanding balance', tableLabel = 'Monthly calculation',
  tableHeaders = ['Month', 'Opening balance', 'Interest', 'Scheduled payment', 'Principal reduction', 'Balance before final settlement', 'Separate maturity repayment'],
  caption = 'Invented contracts, same initial amount and constant direct monthly rate. Interest rounds half up to cents each month; the final amortizing payment clears the exact balance plus interest. All remaining principal is contractually due immediately after the last scheduled payment, without another interest period. No fees, taxes, insurance, new borrowing or rate changes. Settlement shows an assumed payment, not proof it is affordable.',
  locale = 'en-US', currency = 'EUR', className,
}: RepaymentStructuresProps) {
  validate({ principal, monthlyRate, months, customPayment, capitalizeUnpaidInterest });
  if (!Array.isArray(tableHeaders) || tableHeaders.length !== 7 || tableHeaders.some((text) => typeof text !== 'string' || !text.trim())) throw new Error('RepaymentStructures: tableHeaders requires seven non-empty labels.');
  const id = useId();
  const [inputs, setInputs] = useState({ principal, monthlyRate, months, customPayment, capitalizeUnpaidInterest });
  const [settled, setSettled] = useState(false);
  const result = simulateRepaymentStructures(inputs);
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, useGrouping: true }).format(cents / 100);
  const percent = (rate: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(rate);
  const number = new Intl.NumberFormat(locale);
  const plans = [
    { key: 'amortizing', label: amortizingLabel, plan: result.amortizing, color: 'var(--color-brand-600)', dash: undefined },
    { key: 'interestOnly', label: interestOnlyLabel, plan: result.interestOnly, color: 'var(--color-accent-600)', dash: '8 4' },
    { key: 'custom', label: customLabel, plan: result.custom, color: 'var(--color-danger)', dash: '2 4' },
  ];
  const max = Math.max(Math.round(inputs.principal * 100), ...plans.flatMap(({ plan }) => plan?.rows.map((row) => row.closingCents) ?? []));
  const x = (month: number) => 66 + month / inputs.months * 446;
  const y = (balance: number) => 210 - balance / max * 170;
  const path = (plan: RepaymentStructurePlan) => `M ${x(0)} ${y(Math.round(inputs.principal * 100))}` + plan.rows.map((row) => ` L ${x(row.month)} ${y(row.closingCents)}`).join('') + (settled && plan.balloonCents > 0 ? ` L ${x(inputs.months)} ${y(0)}` : '');
  const controls = [
    { key: 'principal' as const, label: principalLabel, min: Math.min(100, principal), max: Math.max(5000, principal), step: 0.01, format: (value: number) => money(Math.round(value * 100)) },
    { key: 'monthlyRate' as const, label: monthlyRateLabel, min: 0, max: 0.05, step: 0.0001, format: percent },
    { key: 'months' as const, label: monthsLabel, min: 1, max: 60, step: 1, format: (value: number) => number.format(value) },
    { key: 'customPayment' as const, label: customPaymentLabel, min: 0, max: Math.max(500, customPayment), step: 0.01, format: (value: number) => money(Math.round(value * 100)) },
  ];
  return <figure className={cx('not-prose my-6 min-w-0 rounded-card bg-surface-sunken/50 p-5', className)}>
    <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {controls.map((control) => <div key={control.key} className="min-w-0">
        <label htmlFor={`${id}-${control.key}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-700"><span>{control.label}</span><output htmlFor={`${id}-${control.key}`} className="font-mono font-semibold text-ink-900">{control.format(inputs[control.key])}</output></label>
        <input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={inputs[control.key]} onChange={(event) => setInputs((old) => ({ ...old, [control.key]: Number(event.target.value) }))} aria-valuetext={control.format(inputs[control.key])} className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" />
      </div>)}
    </div>
    <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink-700"><input type="checkbox" checked={inputs.capitalizeUnpaidInterest} onChange={(event) => setInputs((old) => ({ ...old, capitalizeUnpaidInterest: event.target.checked }))} className="mt-1 h-4 w-4 shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /><span>{capitalizationLabel}</span></label>
    <svg viewBox="0 0 550 260" role="img" aria-label={settled ? chartAfterLabel : chartBeforeLabel} className="mt-3 block w-full">
      <path d="M 66 35 V 210 H 512" fill="none" stroke="var(--color-ink-300)" />
      {plans.map(({ key, plan, color, dash }) => plan && <path key={key} d={path(plan)} fill="none" stroke={color} strokeWidth={3} strokeDasharray={dash} />)}
      <text x={66} y={20} fontSize={12} fill="var(--color-ink-700)">{balanceAxisLabel}: {money(max)}</text>
      <text x={56} y={214} fontSize={12} textAnchor="end" fill="var(--color-ink-600)">0</text>
      {[0, Math.floor(inputs.months / 2), inputs.months].filter((month, index, arr) => arr.indexOf(month) === index).map((month) => <text key={month} x={x(month)} y={230} textAnchor="middle" fontSize={12} fill="var(--color-ink-600)">{number.format(month)}</text>)}
      <text x={289} y={254} fontSize={12} textAnchor="middle" fill="var(--color-ink-700)">{monthsLabel}</text>
    </svg>
    <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink-700"><input type="checkbox" checked={settled} onChange={(event) => setSettled(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" /><span>{settlementLabel}</span></label>
    <div className="mt-4 grid gap-5 lg:grid-cols-3">
      {plans.map(({ key, label, plan, color, dash }) => <section key={key} className="min-w-0" data-plan={key}>
        <h3 className="flex items-start gap-2 font-semibold text-ink-900"><svg width={24} height={18} aria-hidden="true" className="shrink-0"><path d="M0 9H24" stroke={color} strokeWidth={3} strokeDasharray={dash} /></svg>{label}</h3>
        {!plan ? <p className="mt-3 text-sm text-ink-700" role="status">{unsupportedLabel}</p> : <>
          <dl className="mt-3 space-y-2 text-sm" aria-live="polite" aria-atomic="true">
            {[[interestLabel, plan.interestCents], [balloonLabel, plan.balloonCents], [maturityDueLabel, plan.maturityDueCents], [totalPaidLabel, plan.totalWithBalloonCents]].map(([labelText, amount], index) => <div key={index}><dt className="text-ink-600">{labelText}</dt><dd className="font-mono font-semibold text-ink-900">{money(amount as number)}</dd></div>)}
          </dl>
          <details className="mt-3 text-sm"><summary className="w-fit cursor-pointer rounded-sm font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{tableLabel}</summary>
            <div className="mt-3 min-w-0">
              <table tabIndex={0} aria-label={`${label}: ${tableLabel}`} className="block w-full max-w-full overflow-x-auto text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><thead><tr>{tableHeaders.map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold text-ink-700">{heading}</th>)}</tr></thead><tbody>{plan.rows.map((row) => <tr key={row.month}><th scope="row" className="px-2 py-2 font-medium text-ink-700">{number.format(row.month)}</th>{[row.openingCents, row.interestCents, row.paymentCents, row.principalReductionCents, row.closingCents, row.month === inputs.months ? plan.balloonCents : 0].map((value, index) => <td key={index} className="whitespace-nowrap px-2 py-2 font-mono text-ink-800">{money(value)}</td>)}</tr>)}</tbody></table>
            </div>
          </details>
        </>}
      </section>)}
    </div>
    <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
  </figure>;
}
export default RepaymentStructures;
