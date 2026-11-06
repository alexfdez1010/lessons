import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RevolvingCreditInputs {
  principal: number;
  monthlyRate: number;
  fixedPayment: number;
  monthlySpending: number;
  months: number;
}

export interface RevolvingCreditRow {
  month: number;
  opening: number;
  interest: number;
  spending: number;
  payment: number;
  closing: number;
}

/** Compare fixed payments with an explicitly invented minimum:
 * max(25 euros, monthly interest + 1% of opening balance), capped at amount due.
 * Interest and the 1% component round separately to the nearest cent, half up.
 * The monthly rate is supplied directly in increments of one basis point. */
export function simulateRevolvingCredit(inputs: RevolvingCreditInputs) {
  const { principal, monthlyRate, fixedPayment, monthlySpending, months } = inputs;
  const moneyValues = [principal, fixedPayment, monthlySpending];
  if (moneyValues.some((value) => !Number.isFinite(value) || value < 0 || value > 1_000_000 ||
      Math.abs(Math.round(value * 100) - value * 100) > 1e-6) || principal <= 0 || fixedPayment <= 0 ||
      !Number.isFinite(monthlyRate) || monthlyRate < 0 || monthlyRate > 0.05 ||
      Math.abs(monthlyRate * 10000 - Math.round(monthlyRate * 10000)) > 1e-8 ||
      !Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error('RevolvingCreditBalance requires cent amounts from zero to one million, positive principal and fixed payment, a monthly rate from zero to 5% in basis-point increments, and an integer horizon from one to 120 months.');
  }
  const rateBps = Math.round(monthlyRate * 10000);
  const spendingCents = Math.round(monthlySpending * 100);
  const fixedCents = Math.round(fixedPayment * 100);
  const run = (mode: 'fixed' | 'minimum') => {
    let balance = Math.round(principal * 100);
    let interestTotal = 0;
    let paymentTotal = 0;
    let belowMinimumMonths = 0;
    let payoffMonth: number | null = null;
    const rows: RevolvingCreditRow[] = [];
    for (let month = 1; month <= months; month++) {
      const opening = balance;
      const interest = Math.floor((opening * rateBps + 5000) / 10000);
      const due = opening + interest + spendingCents;
      const principalComponent = Math.floor((opening + 50) / 100);
      const required = Math.min(due, Math.max(2500, interest + principalComponent));
      const payment = Math.min(due, mode === 'fixed' ? fixedCents : required);
      if (mode === 'fixed' && payment < required) belowMinimumMonths++;
      balance = due - payment;
      interestTotal += interest;
      paymentTotal += payment;
      rows.push({ month, opening: opening / 100, interest: interest / 100, spending: monthlySpending, payment: payment / 100, closing: balance / 100 });
      if (balance === 0 && spendingCents === 0) {
        payoffMonth = month;
        break;
      }
    }
    return { rows, closingBalance: balance / 100, totalInterest: interestTotal / 100,
      totalPayments: paymentTotal / 100, payoffMonth, belowMinimumMonths };
  };
  return { fixed: run('fixed'), minimum: run('minimum') };
}

export interface RevolvingCreditBalanceProps extends Partial<RevolvingCreditInputs> {
  /** Heading and labels are authored in the lesson's locale. */
  title?: string;
  principalLabel?: string;
  monthlyRateLabel?: string;
  fixedPaymentLabel?: string;
  spendingLabel?: string;
  monthsLabel?: string;
  fixedLabel?: string;
  minimumLabel?: string;
  balanceLabel?: string;
  interestLabel?: string;
  paymentsLabel?: string;
  payoffLabel?: string;
  unresolvedLabel?: string;
  shortfallLabel?: string;
  tableLabel?: string;
  /** Six table headers: month, opening, interest, purchases, payment, closing. */
  tableHeaders?: [string, string, string, string, string, string];
  chartLabel?: string;
  caption?: string;
  locale?: string;
  currencyPrefix?: string;
  className?: string;
}

/** Finite-horizon balance paths with accessible monthly ledgers. There is no
 * automatic animation; each control immediately updates the complete data. */
export function RevolvingCreditBalance({
  title = 'A payment can leave most of the balance behind',
  principal = 1000, monthlyRate = 0.02, fixedPayment = 50, monthlySpending = 0, months = 84,
  principalLabel = 'Opening balance', monthlyRateLabel = 'Interest rate per month',
  fixedPaymentLabel = 'Fixed payment each month', spendingLabel = 'New purchases each month',
  monthsLabel = 'Months shown', fixedLabel = 'Fixed payment', minimumLabel = 'Invented minimum rule',
  balanceLabel = 'Balance at the end of the shown period', interestLabel = 'Interest charged within the shown period',
  paymentsLabel = 'Payments within the shown period', payoffLabel = 'Months to clear with no new spending',
  unresolvedLabel = 'No payoff established within the shown period',
  shortfallLabel = 'Months below the illustrative minimum', tableLabel = 'Monthly calculations',
  tableHeaders = ['Month', 'Opening', 'Interest', 'Purchases', 'Payment', 'Closing'],
  chartLabel = 'Outstanding balance against months. The solid line is the fixed payment; the dashed line is the invented minimum rule. Exact values are available in the monthly calculation tables.',
  caption = 'Invented minimum: the larger of €25 or monthly interest plus 1% of opening balance, capped at the amount due. Interest and the 1% part each round to cents. Purchases arrive after interest and before payment. No fees, grace period or rate changes; no claim to reproduce a card agreement.',
  locale = 'en-US', currencyPrefix = '€', className,
}: RevolvingCreditBalanceProps) {
  simulateRevolvingCredit({ principal, monthlyRate, fixedPayment, monthlySpending, months });
  if (!Array.isArray(tableHeaders) || tableHeaders.length !== 6 || tableHeaders.some((label) => !label.trim())) {
    throw new Error('RevolvingCreditBalance requires six non-empty tableHeaders.');
  }
  const id = useId();
  const [inputs, setInputs] = useState({ principal, monthlyRate, fixedPayment, monthlySpending, months });
  const result = simulateRevolvingCredit(inputs);
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (value: number) => `${currencyPrefix}${number.format(value)}`;
  const controls = [
    { key: 'principal' as const, label: principalLabel, min: Math.min(100, principal), max: Math.max(5000, principal), step: 100, format: money },
    { key: 'monthlyRate' as const, label: monthlyRateLabel, min: 0, max: 0.05, step: 0.0001, format: (v: number) => `${number.format(v * 100)}%` },
    { key: 'fixedPayment' as const, label: fixedPaymentLabel, min: Math.min(5, fixedPayment), max: Math.max(500, fixedPayment), step: 5, format: money },
    { key: 'monthlySpending' as const, label: spendingLabel, min: 0, max: Math.max(500, monthlySpending), step: 10, format: money },
    { key: 'months' as const, label: monthsLabel, min: 1, max: 120, step: 1, format: (v: number) => String(v) },
  ];
  const plans = [{ label: fixedLabel, plan: result.fixed, dashed: false }, { label: minimumLabel, plan: result.minimum, dashed: true }];
  const maxBalance = Math.max(inputs.principal, ...plans.flatMap(({ plan }) => plan.rows.map((row) => row.closing)), 1);
  const x = (month: number) => 45 + month / inputs.months * 430;
  const y = (balance: number) => 200 - balance / maxBalance * 165;
  const path = (rows: RevolvingCreditRow[]) => {
    let line = `M ${x(0)} ${y(inputs.principal)}`;
    for (const row of rows) line += ` L ${x(row.month)} ${y(row.closing)}`;
    if (rows.length < inputs.months) line += ` L ${x(inputs.months)} ${y(0)}`;
    return line;
  };
  return <figure className={cx('not-prose my-6 rounded-card bg-surface-sunken/50 p-5', className)}>
    <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {controls.map((control) => <div key={control.key}>
        <label htmlFor={`${id}-${control.key}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-700">
          <span>{control.label}</span><output htmlFor={`${id}-${control.key}`} className="font-mono font-semibold text-ink-900">{control.format(inputs[control.key])}</output>
        </label>
        <input id={`${id}-${control.key}`} type="range" min={control.min} max={control.max} step={control.step}
          value={inputs[control.key]} onChange={(event) => setInputs((previous) => ({ ...previous, [control.key]: Number(event.target.value) }))}
          aria-valuetext={control.format(inputs[control.key])}
          className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600" />
      </div>)}
    </div>
    <svg viewBox="0 0 510 250" role="img" aria-labelledby={`${id}-chart`} className="mt-4 w-full">
      <title id={`${id}-chart`}>{chartLabel}</title>
      <path d="M 45 25 V 200 H 475" fill="none" stroke="var(--color-ink-300)" />
      {plans.map(({ label, plan, dashed }) => <path key={label} d={path(plan.rows)} fill="none"
        stroke={dashed ? 'var(--color-accent-600)' : 'var(--color-brand-600)'} strokeWidth={3} strokeDasharray={dashed ? '6 4' : undefined} />)}
      <text x={45} y={18} className="fill-ink-700 text-xs">{money(maxBalance)}</text>
      <text x={32} y={204} textAnchor="end" className="fill-ink-600 text-xs">0</text>
      {[0, Math.round(inputs.months / 2), inputs.months].filter((month, index, values) => values.indexOf(month) === index).map((month) =>
        <text key={month} x={x(month)} y={220} textAnchor="middle" className="fill-ink-600 text-xs">{month}</text>)}
      <text x={260} y={243} textAnchor="middle" className="fill-ink-600 text-xs">{monthsLabel}</text>
    </svg>
    <div className="mt-3 grid gap-5 sm:grid-cols-2">
      {plans.map(({ label, plan, dashed }) => <section key={label} className="min-w-0">
        <h3 className="flex items-center gap-2 font-semibold text-ink-900">
          <svg width={24} height={10} aria-hidden="true"><path d="M 0 5 H 24" stroke={dashed ? 'var(--color-accent-600)' : 'var(--color-brand-600)'} strokeWidth={3} strokeDasharray={dashed ? '5 3' : undefined} /></svg>{label}
        </h3>
        <dl className="mt-3 space-y-2 text-sm" aria-live="polite" aria-atomic="true">
          {[[balanceLabel, money(plan.closingBalance)], [interestLabel, money(plan.totalInterest)], [paymentsLabel, money(plan.totalPayments)]].map(([term, value]) =>
            <div key={term}><dt className="text-ink-600">{term}</dt><dd className="font-mono font-semibold text-ink-900">{value}</dd></div>)}
          {plan.payoffMonth !== null ? <div><dt className="text-ink-600">{payoffLabel}</dt><dd className="font-mono font-semibold text-ink-900">{plan.payoffMonth}</dd></div> : <div><dt className="text-ink-700">{unresolvedLabel}</dt></div>}
          {plan.belowMinimumMonths > 0 && <div><dt className="text-ink-700">{shortfallLabel}</dt><dd className="font-mono font-semibold text-ink-900">{plan.belowMinimumMonths}</dd></div>}
        </dl>
        <details className="mt-3 text-sm">
          <summary className="w-fit cursor-pointer rounded-sm font-semibold text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600">{tableLabel}</summary>
          <div className="mt-3 overflow-x-auto">
            <table tabIndex={0} aria-label={`${label}: ${tableLabel}`} className="w-full text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              <thead><tr>{tableHeaders.map((header) => <th key={header} scope="col" className="px-2 py-2 font-semibold text-ink-900">{header}</th>)}</tr></thead>
              <tbody>{plan.rows.map((row) => <tr key={row.month} className="even:bg-surface">
                {[String(row.month), money(row.opening), money(row.interest), money(row.spending), money(row.payment), money(row.closing)].map((value, index) => <td key={index} className="whitespace-nowrap px-2 py-2 font-mono text-ink-700">{value}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>)}
    </div>
    <p className="mt-4 text-sm text-ink-600">{caption}</p>
  </figure>;
}

export default RevolvingCreditBalance;
