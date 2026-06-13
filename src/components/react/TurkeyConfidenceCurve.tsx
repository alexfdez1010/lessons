import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TurkeyConfidenceCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the "days fed so far" slider. */
  daysLabel?: string;
  /** Readout label for the turkey's subjective confidence it's safe. */
  confidenceLabel?: string;
  /** Readout label for the real (hidden) risk on the current day. */
  hazardLabel?: string;
  /** Legend label for the rising confidence curve. */
  confidenceCurveLabel?: string;
  /** Legend label for the hidden true-hazard curve. */
  hazardCurveLabel?: string;
  /** Toggle-button label that reveals the hidden hazard line. */
  revealHazardLabel?: string;
  /** Toggle-button label shown once the hazard line is revealed. */
  hideHazardLabel?: string;
  /** Annotation pinned to the final day (the slaughter event). */
  slaughterLabel?: string;
  /** Announcement read aloud when the slaughter event fires. */
  slaughterAnnouncement?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial slider value (days fed so far). Defaults to `1000`. */
  days?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** Total days of feeding before the (in)evitable. The drop fires on day 1001. */
const FED_DAYS = 1000;
const SLAUGHTER_DAY = FED_DAYS + 1; // day 1001

/**
 * Interactive "Turkey Problem" chart (Taleb's retelling of Hume's problem of
 * induction). A turkey is fed every morning; each safe day nudges its naive
 * confidence that "humans love me, I'll be fed tomorrow" upward — confidence ≈
 * 1 − 1/days — climbing toward ~99.9% the day before Thanksgiving. A hidden TRUE
 * hazard line rises in lockstep: more days fed means closer to the holiday, so
 * the real risk of slaughter quietly grows too. Both peak on the same day. On
 * day 1001 the confidence curve crashes to zero — the slaughter event — and an
 * `aria-live` region announces it. A toggle reveals the hidden hazard line so
 * learners see that absence of evidence (no slaughter yet) was mistaken for
 * evidence of absence. Drag the slider through the turkey's life; readouts for
 * its confidence and the real risk update live. Respects
 * `prefers-reduced-motion` (transitions are dropped, values jump instantly).
 */
export function TurkeyConfidenceCurve({
  title = "The turkey's confidence",
  daysLabel = 'Days fed so far',
  confidenceLabel = "Turkey's confidence it's safe",
  hazardLabel = 'Real risk today',
  confidenceCurveLabel = "Turkey's confidence",
  hazardCurveLabel = 'Hidden true hazard',
  revealHazardLabel = 'Reveal the hidden hazard line',
  hideHazardLabel = 'Hide the hidden hazard line',
  slaughterLabel = 'Thanksgiving',
  slaughterAnnouncement = 'Day 1001: the turkey is slaughtered. Its confidence — at an all-time high — collapses to zero. Maximum confidence met maximum danger.',
  caption = 'Every fed day pushes the turkey’s confidence up — and pushes it closer to the holiday. Confidence and danger peak on the very same morning. “No slaughter yet” was never evidence that none was coming.',
  days = FED_DAYS,
  className,
}: TurkeyConfidenceCurveProps) {
  const id = useId();
  const clampInitial = Math.min(SLAUGHTER_DAY, Math.max(1, Math.round(days)));
  const [day, setDay] = useState(clampInitial);
  const [showHazard, setShowHazard] = useState(false);
  const reduced = useMemo(prefersReducedMotion, []);

  const W = 520;
  const H = 220;
  const padX = 14;
  const padY = 18;

  const slaughtered = day >= SLAUGHTER_DAY;

  // Subjective confidence: rises monotonically toward ~1 as fed days accrue,
  // then collapses to 0 the moment the slaughter fires.
  const confidenceAt = (d: number): number =>
    d >= SLAUGHTER_DAY ? 0 : 1 - 1 / (d + 1);
  // True hazard: also climbs monotonically (each day is closer to the holiday),
  // ramping steeply near the end and topping out at certainty on the last day.
  const hazardAt = (d: number): number => {
    const t = Math.min(1, d / SLAUGHTER_DAY);
    return Math.pow(t, 3); // gentle early, steep near Thanksgiving
  };

  const confidence = slaughtered ? 0 : confidenceAt(day);
  const hazard = hazardAt(Math.min(day, SLAUGHTER_DAY));

  // Axes: x = day (1 → 1001), y = probability (0 → 1).
  const x = (d: number) => padX + (d / SLAUGHTER_DAY) * (W - padX * 2);
  const y = (p: number) => padY + (1 - p) * (H - padY * 2);

  const SAMPLES = 120;
  // The turkey's confidence curve, sampled across the full fed period (it has
  // no idea about the cliff, so the curve it "believes in" rises to the end).
  const confidencePath = useMemo(() => {
    let d = `M ${x(1)} ${y(confidenceAt(1))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const dd = 1 + (i / SAMPLES) * (FED_DAYS - 1);
      d += ` L ${x(dd)} ${y(confidenceAt(dd))}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hazardPath = useMemo(() => {
    let d = `M ${x(0)} ${y(hazardAt(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const dd = (i / SAMPLES) * SLAUGHTER_DAY;
      d += ` L ${x(dd)} ${y(hazardAt(dd))}`;
    }
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markerX = x(Math.min(day, FED_DAYS));
  const slaughterX = x(SLAUGHTER_DAY);
  const transition = reduced ? undefined : 'cx 220ms ease-out, cy 220ms ease-out';

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
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            slaughtered ? 'bg-danger' : 'bg-brand-600',
          )}
        >
          {confidenceLabel}: {pct(confidence)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {confidenceCurveLabel}
        </span>
        <span
          className={cx(
            'inline-flex items-center gap-2',
            showHazard ? 'text-ink-700' : 'text-ink-400',
          )}
        >
          <span
            className={cx(
              'h-1 w-5 rounded-pill',
              showHazard ? 'bg-danger' : 'bg-ink-300',
            )}
            aria-hidden="true"
          />
          {hazardCurveLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}: after ${Math.min(
          day,
          FED_DAYS,
        )} fed days the turkey is ${pct(
          confidence,
        )} confident it is safe, while the real risk that day is ${pct(
          hazard,
        )}. On day ${SLAUGHTER_DAY} the slaughter fires and confidence collapses to 0%.`}
      >
        {/* Baseline (zero probability) */}
        <line
          x1={padX}
          y1={y(0)}
          x2={W - padX}
          y2={y(0)}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Hidden true-hazard curve — only painted once revealed */}
        {showHazard && (
          <path
            d={hazardPath}
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* The turkey's rising confidence curve */}
        <path
          d={confidencePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Slaughter cliff: a sharp drop to zero on the final day */}
        {slaughtered && (
          <path
            d={`M ${x(FED_DAYS)} ${y(confidenceAt(FED_DAYS))} L ${slaughterX} ${y(0)}`}
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Slaughter-day vertical marker + annotation */}
        <line
          x1={slaughterX}
          y1={padY}
          x2={slaughterX}
          y2={y(0)}
          stroke="var(--color-danger)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
          opacity={0.6}
        />
        <text
          x={slaughterX}
          y={padY - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-danger)"
        >
          {slaughterLabel}
        </text>

        {/* Live confidence marker tracking the slider */}
        {!slaughtered ? (
          <circle
            cx={markerX}
            cy={y(confidence)}
            r={5}
            fill="var(--color-brand-500)"
            stroke="var(--color-surface, #fff)"
            strokeWidth={2}
            style={{ transition }}
          />
        ) : (
          <circle
            cx={slaughterX}
            cy={y(0)}
            r={6}
            fill="var(--color-danger)"
            stroke="var(--color-surface, #fff)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* aria-live announcement for the slaughter event */}
      <p className="sr-only" role="status" aria-live="assertive">
        {slaughtered ? slaughterAnnouncement : ''}
      </p>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-days`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{daysLabel}</span>
          <span className="font-mono text-ink-900">
            {day >= SLAUGHTER_DAY ? `${SLAUGHTER_DAY} ⚑` : day}
          </span>
        </label>
        <input
          id={`${id}-days`}
          type="range"
          min={1}
          max={SLAUGHTER_DAY}
          step={1}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Reveal-hazard toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowHazard((v) => !v)}
          aria-pressed={showHazard}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:border-danger hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {showHazard ? hideHazardLabel : revealHazardLabel}
        </button>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{confidenceLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              slaughtered ? 'text-danger' : 'text-brand-700',
            )}
          >
            {pct(confidence)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{hazardLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-danger">{pct(hazard)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TurkeyConfidenceCurve;
