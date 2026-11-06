import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AprApyDialProps {
  /** Heading above the dial. */
  title?: string;
  /** One-line takeaway shown under the dial. */
  caption?: string;
  /** Label for the APR bar/readout. */
  aprLabel?: string;
  /** Label for the APY bar/readout. */
  apyLabel?: string;
  /** Label for the compounding-periods slider. */
  periodsLabel?: string;
  /** Label for the quoted-APR slider. */
  rateLabel?: string;
  /** Names for the 6 compounding-frequency stops (Annual…Daily). For i18n. */
  periodNames?: string[];
  /** Initial nominal annual rate before fees (0–0.30). Defaults to `0.12`. */
  apr?: number;
  /** Initial compounding periods per year. Snaps to a discrete stop. Defaults to `12`. */
  periods?: number;
  /** Label for the APY − APR gap readout. */
  gapLabel?: string;
  /** Number formatting locale. */
  locale?: string;
  /** Accessible description with {rate}, {period}, {periods}, {effective}, {gap}. */
  chartLabel?: string;
  className?: string;
}

const pct = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/** Discrete compounding stops the periods slider snaps to. */
const PERIOD_STOPS = [1, 2, 4, 12, 52, 365];
const PERIOD_NAMES = ['Annual', 'Semiannual', 'Quarterly', 'Monthly', 'Weekly', 'Daily'];

/** Index of the slider stop whose period count is closest to `n`. */
const stopIndexFor = (n: number): number => {
  let best = 0;
  for (let i = 1; i < PERIOD_STOPS.length; i += 1) {
    if (Math.abs(PERIOD_STOPS[i] - n) < Math.abs(PERIOD_STOPS[best] - n)) best = i;
  }
  return best;
};

/**
 * Compare a nominal annual interest rate with its effective annual yield.
 * The public `apr` prop is retained for existing authored lessons; it represents
 * the nominal rate before fees, not an arbitrary regulatory loan APR. The full
 * calculation remains visible while either control changes.
 */
export function AprApyDial({
  title = 'Nominal and effective annual rates',
  caption = 'The calculation holds the rate fixed and reinvests interest, with no fees or taxes.',
  aprLabel = 'Nominal annual rate',
  apyLabel = 'Effective annual yield',
  periodsLabel = 'Compounding periods per year',
  rateLabel = 'Nominal annual rate',
  periodNames = PERIOD_NAMES,
  apr = 0.12,
  periods = 12,
  gapLabel = 'Difference in percentage points',
  locale = 'en-US',
  chartLabel = 'At a nominal rate of {rate}, compounding {period} ({periods} periods per year), the effective annual yield is {effective}. The difference is {gap} percentage points.',
  className,
}: AprApyDialProps) {
  const id = useId();
  const [aprState, setAprState] = useState(apr);
  const [stop, setStop] = useState(stopIndexFor(periods));

  const n = PERIOD_STOPS[stop];
  const apyValue = Math.pow(1 + aprState / n, n) - 1;
  const gap = apyValue - aprState;

  // Bar heights scale to the largest APY reachable at the current APR (daily
  // compounding) so the APR bar stays put and the APY bar visibly climbs.
  const maxApy = Math.pow(1 + aprState / 365, 365) - 1;
  const scale = Math.max(maxApy, aprState, 0.0001);
  const aprFrac = aprState / scale;
  const apyFrac = apyValue / scale;

  const aprPctLabel = Math.round(aprState * 100);
  const periodName = periodNames[stop] ?? PERIOD_NAMES[stop];

  const W = 360;
  const H = 220;
  const padY = 18;
  const trackH = H - padY * 2;
  const aprBarH = aprFrac * trackH;
  const apyBarH = apyFrac * trackH;
  const barW = 96;
  const aprX = W / 2 - barW - 18;
  const apyX = W / 2 + 18;
  const baseY = H - padY;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {periodName}: {new Intl.NumberFormat(locale).format(n)}×
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-pill bg-ink-200" aria-hidden="true" />
          {aprLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-pill bg-brand-500" aria-hidden="true" />
          {apyLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={chartLabel.replace(/\{(rate|period|periods|effective|gap)\}/g, (_, key: string) => ({
          rate: pct(aprState, locale),
          period: periodName.toLowerCase(),
          periods: new Intl.NumberFormat(locale).format(n),
          effective: pct(apyValue, locale),
          gap: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(gap * 100),
        })[key] ?? key)}
      >
        {/* Baseline */}
        <line
          x1={10}
          y1={baseY}
          x2={W - 10}
          y2={baseY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* APR bar — fixed, never moves with frequency */}
        <rect
          x={aprX}
          y={baseY - aprBarH}
          width={barW}
          height={aprBarH}
          rx={6}
          fill="var(--color-ink-200)"
        />
        {/* APR top guide so it's obvious the APY bar climbs above it */}
        <line
          x1={aprX}
          y1={baseY - aprBarH}
          x2={apyX + barW}
          y2={baseY - aprBarH}
          stroke="var(--color-ink-200)"
          strokeDasharray="3 3"
        />
        {/* APY bar — grows with compounding frequency */}
        <rect
          x={apyX}
          y={baseY - apyBarH}
          width={barW}
          height={apyBarH}
          rx={6}
          fill="var(--color-brand-500)"
        />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-apr`}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-ink-700"
          >
            <span>{rateLabel}</span>
            <span className="font-mono text-ink-900">{aprPctLabel}%</span>
          </label>
          <input
            id={`${id}-apr`}
            type="range"
            min={0}
            max={30}
            step={1}
            value={aprPctLabel}
            onChange={(e) => setAprState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-periods`}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-ink-700"
          >
            <span>{periodsLabel}</span>
            <span className="font-mono text-ink-900">
              {periodName} ({new Intl.NumberFormat(locale).format(n)}×)
            </span>
          </label>
          <input
            id={`${id}-periods`}
            type="range"
            min={0}
            max={PERIOD_STOPS.length - 1}
            step={1}
            value={stop}
            onChange={(e) => setStop(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{aprLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-ink-900">{pct(aprState, locale)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{apyLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-brand-700">{pct(apyValue, locale)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gapLabel}</dt>
          <dd className="m-0 font-mono text-lg font-semibold text-accent-500">
            +{new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(gap * 100)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AprApyDial;
