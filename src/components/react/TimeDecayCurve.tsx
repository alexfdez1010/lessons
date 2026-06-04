import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TimeDecayCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Total days spanned on the x-axis. Defaults to `90`. */
  totalDays?: number;
  /** ATM time value at `totalDays` (its V0). Defaults to `10`. */
  atmTimeValue?: number;
  /** ITM time value at `totalDays` (its V0). Defaults to `6`. */
  itmTimeValue?: number;
  /** OTM time value at `totalDays` (its V0). Defaults to `4`. */
  otmTimeValue?: number;
  /** Initial days-to-expiry marker position. Defaults to `90`. */
  days?: number;
  /** Slider / x-axis label. */
  dayLabel?: string;
  /** Readout label for the remaining ATM time value. */
  timeValueLabel?: string;
  /** Readout label for today's per-day decay (theta). */
  thetaLabel?: string;
  /** Legend label for the at-the-money curve. */
  atmLabel?: string;
  /** Legend label for the in-the-money curve. */
  itmLabel?: string;
  /** Legend label for the out-of-the-money curve. */
  otmLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

/**
 * Interactive theta-decay chart. An option's *time* (extrinsic) value erodes as
 * expiration approaches — and the loss **accelerates** in the final days. Three
 * curves plot time value against days-to-expiry for an at-the-money, an
 * in-the-money and an out-of-the-money option, each shaped by the standard
 * square-root-of-time approximation TV(t) = V0·√(t / totalDays). Because the
 * slope d(TV)/dt grows like 1/√t, the per-day loss (theta) gets steeper as
 * t → 0. The x-axis runs left → right toward expiry (t = totalDays on the left,
 * t = 0 on the right), so every curve slopes down to zero at the right edge.
 *
 * Drag the slider and a marker rides the ATM curve at the chosen day-count while
 * the readouts give the remaining ATM time value and *today's* decay —
 * TV(t) − TV(t − 1), the value lost over the next day — which visibly grows as
 * expiry nears. Respects `prefers-reduced-motion` (the marker jumps instead of
 * sliding).
 */
export function TimeDecayCurve({
  title = 'Time value melts toward expiry',
  totalDays = 90,
  atmTimeValue = 10,
  itmTimeValue = 6,
  otmTimeValue = 4,
  days = 90,
  dayLabel = 'Days to expiry',
  timeValueLabel = 'Time value left',
  thetaLabel = "Today's decay (per day)",
  atmLabel = 'At the money',
  itmLabel = 'In the money',
  otmLabel = 'Out of the money',
  caption = 'Time value follows a √time curve, so it bleeds away slowly at first and then plunges. The daily loss — theta — accelerates as expiry nears, hitting the at-the-money option hardest. That cliff in the final days is why traders watch the clock.',
  className,
}: TimeDecayCurveProps) {
  const id = useId();
  const span = Math.max(2, Math.round(totalDays));
  const initialDays = Math.min(span, Math.max(1, Math.round(days)));
  const [dayState, setDayState] = useState(initialDays);
  // Animated marker position 0 → 1 toward the chosen day-count.
  const [progress, setProgress] = useState(1);
  const prevDayRef = useRef(initialDays);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 12;
  const padY = 16;

  // Time value as a function of days remaining t: V0 · √(t / span).
  const tv = (v0: number, t: number) => v0 * Math.sqrt(Math.max(0, t) / span);

  // x maps days-to-expiry t ∈ [0, span] to pixels; expiry (t = 0) sits on the
  // RIGHT, t = span on the LEFT, so time runs left → right toward expiry.
  const x = (t: number) => padX + (1 - t / span) * (W - padX * 2);

  const vMax = Math.max(atmTimeValue, itmTimeValue, otmTimeValue);
  const y = (v: number) => padY + (1 - v / vMax) * (H - padY * 2);

  const SAMPLES = 90;
  const buildPath = (v0: number) => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const t = span - (i / SAMPLES) * span; // left (span) → right (0)
      d += `${i === 0 ? 'M' : 'L'} ${x(t)} ${y(tv(v0, t))}`;
    }
    return d;
  };

  const atmPath = buildPath(atmTimeValue);
  const itmPath = buildPath(itmTimeValue);
  const otmPath = buildPath(otmTimeValue);

  // Animate the marker from the previous day-count to the chosen one.
  useEffect(() => {
    if (prefersReducedMotion()) {
      prevDayRef.current = dayState;
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 500;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevDayRef.current = dayState;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [dayState]);

  const animDay = prevDayRef.current + (dayState - prevDayRef.current) * progress;
  const markerX = x(animDay);
  const markerY = y(tv(atmTimeValue, animDay));

  // Remaining ATM time value and today's decay = TV(t) − TV(t − 1).
  const remaining = tv(atmTimeValue, dayState);
  const tomorrow = tv(atmTimeValue, dayState - 1);
  const todaysDecay = Math.max(0, remaining - tomorrow);

  // Already-decayed area: shade from the marker's day to expiry, under the ATM
  // curve, so the slice the option has yet to lose is highlighted.
  const decayedArea = (() => {
    let d = `M ${x(animDay)} ${y(0)}`;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = animDay - (i / steps) * animDay; // animDay → 0
      d += ` L ${x(t)} ${y(tv(atmTimeValue, t))}`;
    }
    d += ` L ${x(0)} ${y(0)} Z`;
    return d;
  })();

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
          {dayState} {dayState === 1 ? 'day' : 'days'}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {atmLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {itmLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />
          {otmLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. With ${dayState} ${
          dayState === 1 ? 'day' : 'days'
        } to expiry, the at-the-money option has ${num(
          remaining,
        )} of time value left and loses about ${num(
          todaysDecay,
        )} over the next day. Time value follows a square-root-of-time curve, so the daily decay accelerates toward expiry.`}
      >
        {/* Already-decayed shading under the ATM curve, marker → expiry */}
        <path d={decayedArea} fill="var(--color-brand-500)" opacity={0.12} />
        {/* Zero-value baseline */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* Vertical guide at the marker's day-count */}
        <line
          x1={markerX}
          y1={padY}
          x2={markerX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* OTM curve (thinnest, ink) */}
        <path
          d={otmPath}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* ITM curve (medium, accent) */}
        <path
          d={itmPath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* ATM curve (thickest, brand) */}
        <path
          d={atmPath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Marker riding the ATM curve */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-brand-600)" />
      </svg>

      {/* Slider — runs from totalDays down to 1 (toward expiry on the right) */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-day`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{dayLabel}</span>
          <span className="font-mono text-ink-900">{dayState}</span>
        </label>
        <input
          id={`${id}-day`}
          type="range"
          min={1}
          max={span}
          step={1}
          value={dayState}
          onChange={(e) => setDayState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{timeValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(remaining)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{thetaLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">−{num(todaysDecay)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TimeDecayCurve;
