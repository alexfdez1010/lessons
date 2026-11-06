import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DaysOfCashCycleProps {
  /** Figure heading. */
  title?: string;
  /** Initial inventory days, from 0 to 180. */
  inventoryDays?: number;
  /** Initial customer collection delay after sale, from 0 to 180 days. */
  receivableDays?: number;
  /** Initial supplier payment delay after purchase, from 0 to 180 days. */
  payableDays?: number;
  /** Labels for the three native range controls. */
  inventoryLabel?: string;
  receivableLabel?: string;
  payableLabel?: string;
  /** Labels for the four event positions. */
  purchaseLabel?: string;
  saleLabel?: string;
  collectionLabel?: string;
  paymentLabel?: string;
  /** Labels for the axis and signed cycle result. */
  dayLabel?: string;
  cycleLabel?: string;
  /** Interpretation for positive, negative and zero cycle cases. */
  positiveLabel?: string;
  negativeLabel?: string;
  zeroLabel?: string;
  /** Accessible chart description; values are also available in the event list. */
  chartLabel?: string;
  /** Qualifications about the ratio-based timeline. */
  caption?: string;
  /** Locale used to format day counts. */
  locale?: string;
  className?: string;
}

/** Convert average-duration inputs to a representative operating timeline.
 * It is a teaching model, not a forecast of individual invoices or cash balances. */
export function calculateCashCycle(inventoryDays: number, receivableDays: number, payableDays: number) {
  if ([inventoryDays, receivableDays, payableDays].some((value) =>
    !Number.isFinite(value) || value < 0 || value > 180)) {
    throw new Error('DaysOfCashCycle requires finite day counts between zero and 180.');
  }
  const collectionDay = inventoryDays + receivableDays;
  return { saleDay: inventoryDays, collectionDay, paymentDay: payableDays, cycleDays: collectionDay - payableDays };
}

/** Native sliders expose why inventory and collection delays add to the cash
 * cycle, while supplier credit subtracts from it. The gap can cross zero without
 * clipping or being reinterpreted as a guarantee of liquidity. */
export function DaysOfCashCycle({
  title = 'When cash leaves and returns',
  inventoryDays = 60,
  receivableDays = 45,
  payableDays = 40,
  inventoryLabel = 'Inventory days — DIO',
  receivableLabel = 'Collection days after sale — DSO',
  payableLabel = 'Payment days after purchase — DPO',
  purchaseLabel = 'Inventory arrives',
  saleLabel = 'Inventory sold',
  collectionLabel = 'Customer pays',
  paymentLabel = 'Supplier is paid',
  dayLabel = 'Days from inventory purchase',
  cycleLabel = 'Cash conversion cycle in days',
  positiveLabel = 'Supplier payment comes before customer collection.',
  negativeLabel = 'Customer collection comes before supplier payment.',
  zeroLabel = 'Customer collection and supplier payment coincide.',
  chartLabel = 'Three event lanes show inventory sale, customer collection and supplier payment on one time axis. The gap spans supplier payment and customer collection.',
  caption = 'A representative timeline built from average day ratios, not the dates of a specific batch. It excludes wages, tax, investment spending and other cash flows. Move each delay to see its effect on the signed gap.',
  locale = 'en-US',
  className,
}: DaysOfCashCycleProps) {
  calculateCashCycle(inventoryDays, receivableDays, payableDays);
  const id = useId();
  const [inventory, setInventory] = useState(inventoryDays);
  const [receivables, setReceivables] = useState(receivableDays);
  const [payables, setPayables] = useState(payableDays);
  const result = calculateCashCycle(inventory, receivables, payables);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const signedDays = `${result.cycleDays > 0 ? '+' : result.cycleDays < 0 ? '−' : ''}${number.format(Math.abs(result.cycleDays))}`;
  // The domain includes every control combination and stays fixed while scrubbing.
  const x = (day: number) => 30 + day / 360 * 450;
  const firstGapDay = Math.min(result.paymentDay, result.collectionDay);
  const lastGapDay = Math.max(result.paymentDay, result.collectionDay);
  const events = [
    { label: purchaseLabel, day: 0 },
    { label: saleLabel, day: result.saleDay },
    { label: collectionLabel, day: result.collectionDay },
    { label: paymentLabel, day: result.paymentDay },
  ];
  const interpretation = result.cycleDays > 0 ? positiveLabel : result.cycleDays < 0 ? negativeLabel : zeroLabel;
  return (
    <figure className={cx('not-prose my-6 rounded-card bg-surface-sunken/50 p-5', className)}>
      <figcaption className="font-display font-semibold text-ink-900">{title}</figcaption>
      <div className="mt-4 grid gap-4">
        {[
          { key: 'inventory', label: inventoryLabel, value: inventory, set: setInventory },
          { key: 'receivables', label: receivableLabel, value: receivables, set: setReceivables },
          { key: 'payables', label: payableLabel, value: payables, set: setPayables },
        ].map((control) => <div key={control.key}>
          <label htmlFor={`${id}-${control.key}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-700">
            <span>{control.label}</span><output htmlFor={`${id}-${control.key}`} className="font-mono font-semibold text-ink-900">{number.format(control.value)}</output>
          </label>
          <input id={`${id}-${control.key}`} type="range" min={0} max={180} step={1} value={control.value}
            onChange={(event) => control.set(Number(event.target.value))}
            className="mt-1 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600" />
        </div>)}
      </div>
      <svg viewBox="0 0 510 185" role="img" aria-labelledby={`${id}-chart`} className="mt-4 w-full">
        <title id={`${id}-chart`}>{chartLabel}</title>
        {[35, 70, 105].map((y) => <path key={y} d={`M 30 ${y} H 480`} stroke="var(--color-ink-200)" />)}
        {[inventoryLabel, receivableLabel, payableLabel].map((label, index) =>
          <text key={index} x={30} y={22 + index * 35} className="fill-ink-700 text-xs">{label}</text>)}
        <path d={`M ${x(0)} 35 H ${x(result.saleDay)}`} stroke="var(--color-brand-600)" strokeWidth={5} />
        <path d={`M ${x(result.saleDay)} 70 H ${x(result.collectionDay)}`} stroke="var(--color-brand-600)" strokeWidth={5} />
        <path d={`M ${x(0)} 105 H ${x(result.paymentDay)}`} stroke="var(--color-accent-600)" strokeWidth={5} strokeDasharray="6 4" />
        {[[result.saleDay, 35], [result.collectionDay, 70], [result.paymentDay, 105]].map(([day, y], index) =>
          <g key={index}>
            <circle cx={x(day)} cy={y} r={5} fill={index === 2 ? 'var(--color-accent-600)' : 'var(--color-brand-600)'} />

          </g>)}
        <path d={`M ${x(firstGapDay)} 120 V 130 H ${x(lastGapDay)} V 120`} stroke="var(--color-ink-700)" strokeWidth={2} fill="none" />
        {[0, 90, 180, 270, 360].map((day) => <text key={day} x={x(day)} y={151} textAnchor="middle" className="fill-ink-600 text-xs">{day}</text>)}
        <text x={255} y={178} textAnchor="middle" className="fill-ink-600 text-xs">{dayLabel}</text>
      </svg>
      <ol className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {events.map((event) => <li key={event.label} className="min-w-0"><span className="block text-ink-600">{event.label}</span><span className="font-mono font-semibold text-ink-900">{number.format(event.day)}</span></li>)}
      </ol>
      <div aria-live="polite" aria-atomic="true" className="mt-5">
        <p className="text-sm text-ink-600">{cycleLabel}</p>
        <p className="mt-1 font-mono text-xl font-semibold text-ink-900">{signedDays}</p>
        <p className="mt-1 text-sm text-ink-700">{interpretation}</p>
      </div>
      <p className="mt-4 text-sm text-ink-600">{caption}</p>
    </figure>
  );
}

export default DaysOfCashCycle;
