import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CostOfCarryStackProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the spot-price base segment. */
  spotLabel?: string;
  /** Label for the financing (interest) segment. */
  financingLabel?: string;
  /** Label for the storage / insurance segment. */
  storageLabel?: string;
  /** Label for the convenience-yield segment (subtracted). */
  convenienceLabel?: string;
  /** Label for the resulting fair forward price. */
  forwardLabel?: string;
  /** Label for the financing-rate slider. */
  rateSliderLabel?: string;
  /** Label for the storage-cost slider. */
  storageSliderLabel?: string;
  /** Label for the convenience-yield slider. */
  convenienceSliderLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const money = (prefix: string, value: number): string => {
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))}`;
};

const pct = (frac: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(frac * 100)}%`;

/**
 * Cost-of-carry decomposition. The fair forward price is the spot price plus the
 * cost of carrying the asset to delivery — financing (interest on the cash tied
 * up) and storage/insurance — minus any convenience yield (the benefit of
 * holding the physical asset now). This stacked bar shows each piece building
 * up from spot to the forward price; sliders move the financing rate, storage
 * cost and convenience yield so the learner sees contango (forward above spot)
 * flip to backwardation (forward below spot) as convenience yield grows. No
 * animation loop; bar segments use a CSS tween that honours `motion-reduce`.
 */
export function CostOfCarryStack({
  title = 'Building the forward price, one carry cost at a time',
  spotLabel = 'Spot price',
  financingLabel = 'Financing (interest)',
  storageLabel = 'Storage + insurance',
  convenienceLabel = 'Convenience yield',
  forwardLabel = 'Fair forward price',
  rateSliderLabel = 'Financing rate (per year)',
  storageSliderLabel = 'Storage cost (per year)',
  convenienceSliderLabel = 'Convenience yield (per year)',
  caption = 'Forward = spot + financing + storage − convenience yield, all over the time to delivery. Push convenience yield high enough and the forward drops below spot — that is exactly when an upward (contango) curve flips to a downward (backwardation) one.',
  currencyPrefix = '$',
  className,
}: CostOfCarryStackProps) {
  const id = useId();

  const spot = 100;
  const years = 1; // one-year horizon keeps the arithmetic clean.

  // Annual fractions, stored as integer tenths-of-a-percent for clean sliders.
  const [rateTenths, setRateTenths] = useState(50); // 5.0%
  const [storageTenths, setStorageTenths] = useState(20); // 2.0%
  const [convTenths, setConvTenths] = useState(10); // 1.0%

  const rate = rateTenths / 1000;
  const storage = storageTenths / 1000;
  const conv = convTenths / 1000;

  const financingAmt = spot * rate * years;
  const storageAmt = spot * storage * years;
  const convAmt = spot * conv * years;
  const forward = spot + financingAmt + storageAmt - convAmt;

  // Bar geometry: scale against a fixed ceiling so segments are comparable.
  const ceiling = spot * 1.2;
  const w = (v: number) => Math.max(0, Math.min(100, (v / ceiling) * 100));

  const Slider = ({
    labelId,
    label,
    value,
    onChange,
    valueText,
    max,
  }: {
    labelId: string;
    label: string;
    value: number;
    onChange: (v: number) => void;
    valueText: string;
    max: number;
  }) => (
    <div>
      <label
        htmlFor={labelId}
        className="flex items-center justify-between text-sm text-ink-700"
      >
        <span>{label}</span>
        <span className="font-mono text-ink-900">{valueText}</span>
      </label>
      <input
        id={labelId}
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        className="mt-1 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      />
    </div>
  );

  const isBackwardation = forward < spot;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className="rounded-pill px-3 py-1 text-sm font-medium text-white"
          style={{
            background: isBackwardation
              ? 'var(--color-accent-500)'
              : 'var(--color-brand-600)',
          }}
        >
          {money(currencyPrefix, forward)}
        </span>
      </figcaption>

      {/* Stacked bar */}
      <div
        className="mt-5 flex h-12 w-full overflow-hidden rounded-card border border-ink-100 bg-surface-sunken/40"
        aria-hidden="true"
      >
        <div
          className="h-full transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${w(spot - convAmt)}%`, background: 'var(--color-ink-300)' }}
        />
        <div
          className="h-full transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${w(financingAmt)}%`, background: 'var(--color-brand-500)' }}
        />
        <div
          className="h-full transition-all duration-300 motion-reduce:transition-none"
          style={{ width: `${w(storageAmt)}%`, background: 'var(--color-brand-300)' }}
        />
      </div>

      {/* Component breakdown */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 px-3 py-2">
          <dt className="text-ink-500">{spotLabel}</dt>
          <dd className="font-mono font-semibold text-ink-900">
            {money(currencyPrefix, spot)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 px-3 py-2">
          <dt className="text-ink-500">+ {financingLabel}</dt>
          <dd className="font-mono font-semibold text-brand-700">
            {money(currencyPrefix, financingAmt)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 px-3 py-2">
          <dt className="text-ink-500">+ {storageLabel}</dt>
          <dd className="font-mono font-semibold text-brand-700">
            {money(currencyPrefix, storageAmt)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 px-3 py-2">
          <dt className="text-ink-500">− {convenienceLabel}</dt>
          <dd className="font-mono font-semibold text-accent-600">
            {money(currencyPrefix, convAmt)}
          </dd>
        </div>
        <div className="col-span-2 rounded-card border border-brand-100 bg-brand-50 px-3 py-2">
          <dt className="text-brand-700">= {forwardLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {money(currencyPrefix, forward)}
          </dd>
        </div>
      </dl>

      {/* Sliders */}
      <div className="mt-4 space-y-3">
        <Slider
          labelId={`${id}-rate`}
          label={rateSliderLabel}
          value={rateTenths}
          onChange={setRateTenths}
          valueText={pct(rate)}
          max={120}
        />
        <Slider
          labelId={`${id}-storage`}
          label={storageSliderLabel}
          value={storageTenths}
          onChange={setStorageTenths}
          valueText={pct(storage)}
          max={80}
        />
        <Slider
          labelId={`${id}-conv`}
          label={convenienceSliderLabel}
          value={convTenths}
          onChange={setConvTenths}
          valueText={pct(conv)}
          max={150}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CostOfCarryStack;
