import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface MoneyTimelineEvent {
  /** Year (or short year label) shown on the axis, e.g. 1944 or "~700 BCE". */
  year: string;
  /** Short headline for the milestone. */
  title: string;
  /** One- or two-sentence explanation revealed when the milestone is active. */
  body: string;
}

export interface MoneyTimelineProps {
  /** Heading above the timeline. */
  title?: string;
  /** One-line takeaway under the timeline. */
  caption?: string;
  /** Ordered milestones, earliest first. */
  events: MoneyTimelineEvent[];
  /** Label for the "previous" control. */
  prevLabel?: string;
  /** Label for the "next" control. */
  nextLabel?: string;
  /** Accessible label for the milestone counter, e.g. "Milestone". */
  stepLabel?: string;
  /** Word joining counter, e.g. "of" → "Milestone 2 of 6". */
  ofLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A steppable, animated horizontal timeline of milestones. Each milestone is a
 * dot on a single axis; clicking a dot (or the prev/next controls) advances an
 * animated travelling marker to it and reveals that milestone's headline + body
 * below. Locale-agnostic: all strings (years, titles, bodies, control labels)
 * arrive as props so the Spanish twin just passes Spanish copy. The marker glides
 * between dots; `prefers-reduced-motion` jumps it instantly.
 */
export function MoneyTimeline({
  title = 'The story of money',
  caption,
  events,
  prevLabel = 'Back',
  nextLabel = 'Next',
  stepLabel = 'Milestone',
  ofLabel = 'of',
  className,
}: MoneyTimelineProps) {
  const [active, setActive] = useState(0);
  const [markerX, setMarkerX] = useState(0);
  const rafRef = useRef<number | null>(null);
  const fromXRef = useRef(0);

  const W = 560;
  const H = 70;
  const padX = 26;
  const n = Math.max(events.length, 1);

  const dotX = (i: number) =>
    n === 1 ? W / 2 : padX + (i / (n - 1)) * (W - padX * 2);
  const axisY = H / 2;

  // Animate the travelling marker from its current x to the active dot.
  useEffect(() => {
    const target = dotX(active);
    if (prefersReducedMotion()) {
      setMarkerX(target);
      return;
    }
    const from = fromXRef.current;
    const duration = 480;
    let startTs: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const xNow = from + (target - from) * ease(p);
      setMarkerX(xNow);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromXRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, n]);

  const current = events[active];

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
          {stepLabel} {active + 1} {ofLabel} {n}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: ${current?.year} — ${current?.title}`}
      >
        {/* Axis */}
        <line
          x1={padX}
          y1={axisY}
          x2={W - padX}
          y2={axisY}
          stroke="var(--color-ink-200)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Progress fill up to active dot */}
        <line
          x1={padX}
          y1={axisY}
          x2={dotX(active)}
          y2={axisY}
          stroke="var(--color-brand-400)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {events.map((e, i) => (
          <g key={i}>
            <circle
              cx={dotX(i)}
              cy={axisY}
              r={i === active ? 7 : 5}
              fill={i <= active ? 'var(--color-brand-500)' : 'var(--color-surface)'}
              stroke={i <= active ? 'var(--color-brand-600)' : 'var(--color-ink-300)'}
              strokeWidth={2}
            />
            <text
              x={dotX(i)}
              y={axisY - 14}
              textAnchor="middle"
              className="font-mono"
              fontSize={9}
              fill={i === active ? 'var(--color-brand-700)' : 'var(--color-ink-500)'}
            >
              {e.year}
            </text>
          </g>
        ))}
        {/* Travelling marker */}
        <circle
          cx={markerX}
          cy={axisY}
          r={10}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={2}
        />
      </svg>

      {/* Active milestone card */}
      <div
        className="mt-2 rounded-card border border-ink-100 bg-surface-sunken/40 px-4 py-3"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-brand-700">
          <span className="font-mono">{current?.year}</span> · {current?.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{current?.body}</p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          disabled={active === 0}
          className="rounded-pill border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          ← {prevLabel}
        </button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {events.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${stepLabel} ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={cx(
                'h-2.5 w-2.5 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                i === active ? 'bg-brand-600' : 'bg-ink-200 hover:bg-ink-300',
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setActive((a) => Math.min(n - 1, a + 1))}
          disabled={active === n - 1}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {nextLabel} →
        </button>
      </div>

      {caption && <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>}
    </figure>
  );
}

export default MoneyTimeline;
