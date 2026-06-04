import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export type DriverEffect = 'up' | 'down';

export interface OptionDriver {
  /** Driver label, e.g. 'Underlying price ↑'. */
  label: string;
  /** What happens to a call's premium when this input rises. */
  callEffect: DriverEffect;
  /** What happens to a put's premium when this input rises. */
  putEffect: DriverEffect;
  /** One-sentence explanation shown in the detail area. */
  note: string;
}

export interface OptionDriversBarsProps {
  /** Heading above the grid. */
  title?: string;
  /** Column header over the driver labels. */
  driverColLabel?: string;
  /** Column header over the call-effect cells. */
  callLabel?: string;
  /** Column header over the put-effect cells. */
  putLabel?: string;
  /** Word shown next to an upward arrow. */
  riseLabel?: string;
  /** Word shown next to a downward arrow. */
  fallLabel?: string;
  /** The six driver rows. Defaults to the standard vanilla-option drivers (English). */
  drivers?: OptionDriver[];
  /** One-line takeaway shown under the grid. */
  caption?: string;
  className?: string;
}

const DEFAULT_DRIVERS: OptionDriver[] = [
  {
    label: 'Underlying price ↑',
    callEffect: 'up',
    putEffect: 'down',
    note: 'A higher spot price makes the right to buy at a fixed strike more valuable and the right to sell less valuable.',
  },
  {
    label: 'Strike price ↑',
    callEffect: 'down',
    putEffect: 'up',
    note: 'A higher strike means a call buys in at a worse price (cheaper call) while a put sells out at a better price (pricier put).',
  },
  {
    label: 'Time to expiry ↑',
    callEffect: 'up',
    putEffect: 'up',
    note: 'More time means more chances to finish in the money, so both calls and puts are worth more — this is time value.',
  },
  {
    label: 'Volatility ↑',
    callEffect: 'up',
    putEffect: 'up',
    note: 'Bigger swings widen the upside without adding downside (the loss is capped at the premium), so more volatility lifts both calls and puts.',
  },
  {
    label: 'Interest rate ↑',
    callEffect: 'up',
    putEffect: 'down',
    note: 'Higher rates make deferring payment for the stock (a call) more attractive and make the cash from selling later (a put) worth less today.',
  },
  {
    label: 'Dividends ↑',
    callEffect: 'down',
    putEffect: 'up',
    note: 'Expected dividends pull the share price down on the ex-date, which hurts calls and helps puts.',
  },
];

/**
 * Interactive cheat-sheet for the six inputs that drive a vanilla option's
 * premium. Each row is a keyboard-operable `<button>` showing — for a *rise* in
 * that input, all else equal — which way the **call** and **put** premiums move:
 * a green ▲ ({riseLabel}) or a red ▼ ({fallLabel}). Selecting a row highlights
 * it and reveals its one-sentence explanation in the live detail area below.
 * The first row is selected by default. Fully locale-agnostic: every string is a
 * prop, and the Spanish twin overrides the `drivers` array.
 */
export function OptionDriversBars({
  title = 'What moves an option’s premium',
  driverColLabel = 'If this input rises…',
  callLabel = 'Call premium',
  putLabel = 'Put premium',
  riseLabel = 'rises',
  fallLabel = 'falls',
  drivers = DEFAULT_DRIVERS,
  caption,
  className,
}: OptionDriversBarsProps) {
  const id = useId();
  const [selected, setSelected] = useState(0);

  const active = drivers[selected] ?? drivers[0];

  const EffectCell = ({ effect }: { effect: DriverEffect }) => {
    const isUp = effect === 'up';
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 font-medium"
        style={{
          color: isUp ? 'var(--color-brand-600)' : 'var(--color-accent-600)',
        }}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {isUp ? '▲' : '▼'}
        </span>
        {isUp ? riseLabel : fallLabel}
      </span>
    );
  };

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          C &amp; P
        </span>
      </figcaption>

      {/* Column headers */}
      <div
        className="mt-4 grid grid-cols-[1.6fr_1fr_1fr] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink-500"
        aria-hidden="true"
      >
        <span>{driverColLabel}</span>
        <span className="text-center">{callLabel}</span>
        <span className="text-center">{putLabel}</span>
      </div>

      {/* Driver rows */}
      <ul className="mt-2 flex flex-col gap-1.5">
        {drivers.map((driver, i) => {
          const isSelected = i === selected;
          return (
            <li key={driver.label}>
              <button
                type="button"
                aria-pressed={isSelected}
                aria-describedby={isSelected ? `${id}-note` : undefined}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                className={cx(
                  'grid w-full grid-cols-[1.6fr_1fr_1fr] items-center gap-2 rounded-card border px-3 py-2.5 text-left text-sm transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  isSelected
                    ? 'border-brand-200 bg-brand-50'
                    : 'border-ink-100 bg-surface hover:bg-surface-sunken/40',
                )}
              >
                <span className="font-medium text-ink-900">{driver.label}</span>
                <span className="flex justify-center text-center">
                  <span className="sr-only">
                    {callLabel}: {driver.callEffect === 'up' ? riseLabel : fallLabel}.
                  </span>
                  <EffectCell effect={driver.callEffect} />
                </span>
                <span className="flex justify-center text-center">
                  <span className="sr-only">
                    {putLabel}: {driver.putEffect === 'up' ? riseLabel : fallLabel}.
                  </span>
                  <EffectCell effect={driver.putEffect} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Detail / note for the selected row */}
      <dl className="mt-4" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3">
          <dt className="text-sm font-semibold text-ink-900">{active.label}</dt>
          <dd id={`${id}-note`} className="mt-1 text-sm leading-relaxed text-ink-600">
            {active.note}
          </dd>
        </div>
      </dl>

      {caption ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
      ) : null}
    </figure>
  );
}

export default OptionDriversBars;
