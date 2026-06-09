import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SurvivorshipFunnelProps {
  /** Heading above the figure. */
  title?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  /** Total funds the cohort started with. Defaults to `100`. */
  startCount?: number;
  /** How many survived to today (the rest "died"). Defaults to `64`. */
  survivorCount?: number;
  /** Flattering average return of the survivors, in `unit`. Defaults to `9`. */
  survivorAvg?: number;
  /** True average once the dead funds are counted, in `unit`. Defaults to `5`. */
  trueAvg?: number;
  /** Unit suffix shown after the averages. Defaults to `'%'`. */
  unit?: string;
  /** Label on the toggle button. Defaults to `'Bring back the funds that died'`. */
  toggleLabel?: string;
  /** Label for the surviving cohort. Defaults to `'Funds still around'`. */
  survivorsLabel?: string;
  /** Label for the dead cohort. Defaults to `'Funds that closed'`. */
  deadLabel?: string;
  /** Label for the survivor (brochure) average. Defaults to `'Average you see in the brochure'`. */
  shownAvgLabel?: string;
  /** Label for the true average. Defaults to `'Average once you count the dead'`. */
  trueAvgLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Survivorship-bias funnel for a behavioural-finance lesson. A cohort of
 * `startCount` funds is drawn as an icon-array grid. By default the learner sees
 * only the `survivorCount` survivors (shaded as the live cohort) and their
 * flattering `survivorAvg` — the number a brochure would print. A toggle "brings
 * back the funds that died": the dead cells fade/scale in, shaded differently,
 * and the displayed headline average drops from `survivorAvg` down to `trueAvg`,
 * with both averages always shown as side-by-side bars so the gap is visible.
 *
 * Locale-agnostic (every user-facing string is a prop) and SSR-safe (the
 * survivor/dead split is deterministic — the first `survivorCount` cells are
 * survivors). Respects `prefers-reduced-motion` (dead cells and the average bar
 * jump straight to their final state with no animation). The toggle is a
 * keyboard-operable button with `aria-pressed`, and the live headline average is
 * announced via `aria-live`.
 */
export function SurvivorshipFunnel({
  title = 'Survivorship bias: the funds that vanished',
  caption = "The dead funds did not just stop reporting — they drag the real average down. Count only the survivors and the track record looks great; count everyone who started and the shine comes off.",
  startCount = 100,
  survivorCount = 64,
  survivorAvg = 9,
  trueAvg = 5,
  unit = '%',
  toggleLabel = 'Bring back the funds that died',
  survivorsLabel = 'Funds still around',
  deadLabel = 'Funds that closed',
  shownAvgLabel = 'Average you see in the brochure',
  trueAvgLabel = 'Average once you count the dead',
  className,
}: SurvivorshipFunnelProps) {
  const id = useId();
  const reduced = prefersReducedMotion();
  const [showDead, setShowDead] = useState(false);
  // Drives the animation: 0 = dead hidden, 1 = dead fully shown.
  const [reveal, setReveal] = useState(0);
  const rafRef = useRef<number | null>(null);

  const total = Math.max(0, Math.round(startCount));
  const survivors = Math.min(total, Math.max(0, Math.round(survivorCount)));
  const dead = total - survivors;

  // Animate the reveal value toward its target (1 when showing the dead, else 0).
  useEffect(() => {
    const target = showDead ? 1 : 0;
    if (reduced) {
      setReveal(target);
      return;
    }
    const duration = 700;
    const from = reveal;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setReveal(from + (target - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDead, reduced]);

  // The headline average interpolates from the flattering survivor average down
  // to the true average as the dead funds come back into view.
  const headlineAvg = survivorAvg + (trueAvg - survivorAvg) * reveal;

  // Bar widths are scaled against the larger of the two averages so both fit.
  const barMax = Math.max(Math.abs(survivorAvg), Math.abs(trueAvg), 0.0001);
  const survivorBarPct = (Math.abs(survivorAvg) / barMax) * 100;
  // The true-average bar grows in as the dead funds are revealed.
  const trueBarPct = (Math.abs(trueAvg) / barMax) * 100 * reveal;

  const fmt = (v: number): string =>
    `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}${unit}`;

  const cells = Array.from({ length: total }, (_, i) => i < survivors);

  const toggle = () => setShowDead((s) => !s);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm bg-brand-500"
            aria-hidden="true"
          />
          {survivorsLabel} ({survivors})
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ background: 'var(--color-danger)' }}
            aria-hidden="true"
          />
          {deadLabel} ({dead})
        </span>
      </div>

      {/* Icon-array grid */}
      <div
        className="mt-4 grid gap-1.5"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(0.85rem, 1fr))',
        }}
        role="img"
        aria-label={`${total} funds: ${survivors} ${survivorsLabel.toLowerCase()}, ${dead} ${deadLabel.toLowerCase()}.${
          showDead ? '' : ` Only the ${survivors} survivors are shown.`
        }`}
      >
        {cells.map((isSurvivor, i) => {
          if (isSurvivor) {
            return (
              <span
                key={`cell-${i}`}
                className="aspect-square rounded-[3px] bg-brand-500"
                aria-hidden="true"
              />
            );
          }
          // Dead cell: fades + scales in with the reveal value.
          return (
            <span
              key={`cell-${i}`}
              className="aspect-square rounded-[3px]"
              style={{
                background: 'var(--color-danger)',
                opacity: 0.15 + 0.7 * reveal,
                transform: `scale(${0.4 + 0.6 * reveal})`,
                visibility: reveal <= 0.001 ? 'hidden' : 'visible',
              }}
              aria-hidden="true"
            />
          );
        })}
      </div>

      {/* Average bars */}
      <div className="mt-6 flex flex-col gap-3">
        {/* Survivor (brochure) average */}
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-900">{shownAvgLabel}</span>
            <span className="font-mono font-semibold text-brand-700">
              {fmt(survivorAvg)}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-pill bg-surface-sunken/60">
            <div
              className="h-full rounded-pill bg-brand-500"
              style={{ width: `${survivorBarPct}%` }}
            />
          </div>
        </div>

        {/* True average (incl. dead) — grows in with the reveal */}
        <div>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-900">{trueAvgLabel}</span>
            <span
              className="font-mono font-semibold"
              style={{ color: 'var(--color-danger)' }}
            >
              {fmt(trueAvg)}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-pill bg-surface-sunken/60">
            <div
              className="h-full rounded-pill transition-none"
              style={{
                width: `${trueBarPct}%`,
                background: 'var(--color-danger)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Live headline average + toggle */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div
          className="flex items-baseline gap-2"
          aria-live="polite"
        >
          <span className="text-sm text-ink-500">
            {showDead ? trueAvgLabel : shownAvgLabel}
          </span>
          <span
            className="font-display text-3xl font-semibold"
            style={{
              color: showDead
                ? 'var(--color-danger)'
                : 'var(--color-brand-700)',
            }}
          >
            {fmt(headlineAvg)}
          </span>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-pressed={showDead}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {toggleLabel}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>

      <span className="sr-only" id={`${id}-status`} aria-live="polite">
        {showDead
          ? `${deadLabel} shown. ${trueAvgLabel}: ${fmt(trueAvg)}.`
          : `${survivorsLabel} only. ${shownAvgLabel}: ${fmt(survivorAvg)}.`}
      </span>
    </figure>
  );
}

export default SurvivorshipFunnel;
