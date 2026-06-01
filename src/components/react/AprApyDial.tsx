import { useEffect, useId, useRef, useState } from 'react';
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
  /** Initial quoted APR as a fraction (0–0.30). Defaults to `0.12`. */
  apr?: number;
  /** Initial compounding periods per year. Snaps to a discrete stop. Defaults to `12`. */
  periods?: number;
  /** Label for the APY − APR gap readout. */
  gapLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value * 100)}%`;

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
 * Interactive APR vs APY dial. APR (the quoted/nominal rate) is fixed by the
 * rate slider; APY (the effective rate you actually earn) is APR compounded `n`
 * times a year — `(1 + apr/n)^n − 1`. Two bars sit side by side: the APR bar
 * never moves when you change the compounding frequency, while the APY bar grows
 * taller as periods increase, making the "compounding bonus" (APY − APR) visible.
 * Drag either slider and the bars plus the font-mono readouts update live; the
 * APY bar animates to its new height. Respects `prefers-reduced-motion` (jumps
 * straight to the final height).
 */
export function AprApyDial({
  title = 'APR vs APY',
  caption = 'APR is the rate they quote you. APY is what you actually get once interest compounds — and the more often it compounds, the wider the gap.',
  aprLabel = 'APR — the quoted rate',
  apyLabel = 'APY — what you actually get',
  periodsLabel = 'Compounding periods per year',
  rateLabel = 'Quoted APR',
  apr = 0.12,
  periods = 12,
  gapLabel = 'Compounding bonus',
  className,
}: AprApyDialProps) {
  const id = useId();
  const [aprState, setAprState] = useState(apr);
  const [stop, setStop] = useState(stopIndexFor(periods));
  const [anim, setAnim] = useState(1); // 0 → 1 (APY bar grow-in)
  const rafRef = useRef<number | null>(null);

  const n = PERIOD_STOPS[stop];
  const apyValue = Math.pow(1 + aprState / n, n) - 1;
  const gap = apyValue - aprState;

  // Bar heights scale to the largest APY reachable at the current APR (daily
  // compounding) so the APR bar stays put and the APY bar visibly climbs.
  const maxApy = Math.pow(1 + aprState / 365, 365) - 1;
  const scale = Math.max(maxApy, aprState, 0.0001);
  const aprFrac = aprState / scale;
  const apyFrac = apyValue / scale;

  // Animate the APY bar to its new height whenever the APR or frequency changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setAnim(1);
      return;
    }
    setAnim(0);
    const duration = 600;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setAnim(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [aprState, stop]);

  const aprPctLabel = Math.round(aprState * 100);
  const periodName = PERIOD_NAMES[stop];

  const W = 360;
  const H = 220;
  const padY = 18;
  const trackH = H - padY * 2;
  const aprBarH = aprFrac * trackH;
  const apyBarH = apyFrac * trackH * anim;
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
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {periodName}: {new Intl.NumberFormat('en-US').format(n)}×
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
        aria-label={`At a quoted APR of ${pct(aprState)} compounding ${periodName.toLowerCase()} (${new Intl.NumberFormat(
          'en-US',
        ).format(n)} times a year), the APY rises to ${pct(apyValue)} — a compounding bonus of ${pct(gap)}.`}
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
            className="flex items-center justify-between text-sm text-ink-700"
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
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{periodsLabel}</span>
            <span className="font-mono text-ink-900">
              {periodName} ({new Intl.NumberFormat('en-US').format(n)}×)
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
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{aprLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(aprState)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{apyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(apyValue)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gapLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">+{pct(gap)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AprApyDial;
