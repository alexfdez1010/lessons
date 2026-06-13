import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface HormesisCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the dose / stressor slider. */
  doseLabel?: string;
  /** Y-axis / curve legend label: benefit relative to baseline. */
  benefitLabel?: string;
  /** Region label for zero/low dose: deprivation → atrophy. */
  deprivationLabel?: string;
  /** Region label for the moderate dose: hormetic → stronger. */
  hormeticLabel?: string;
  /** Region label for high dose: overdose → damage. */
  overdoseLabel?: string;
  /** Readout prefix, e.g. "Right now". */
  statusLabel?: string;
  /** Readout label for the benefit value. */
  benefitReadoutLabel?: string;
  /** Status text when the dose sits in the deprivation zone. */
  weakenedLabel?: string;
  /** Status text when the dose sits in the hormetic zone. */
  strengthenedLabel?: string;
  /** Status text when the dose sits in the overdose zone. */
  damagedLabel?: string;
  /** Annotation for the baseline (benefit = 0) line. */
  baselineLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial dose on a 0–100 scale. Defaults to `45` (the hormetic peak region). */
  dose?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Zone = 'deprivation' | 'hormetic' | 'overdose';

/**
 * Interactive hormesis (dose–response) chart — the antifragility curve from
 * Taleb's *Antifragile*. It plots BENEFIT relative to a baseline of 0 against
 * DOSE / stressor on a 0–100 scale. The curve sits **below** baseline at zero
 * dose (deprivation → atrophy: removing all stressors makes a system fragile,
 * not safe), rises into a positive hump through the moderate "hormetic" zone
 * where small stressors strengthen via overcompensation (muscle, bone, immune
 * response), peaks, then falls back below baseline into harm at high dose
 * (overdose → damage).
 *
 * A draggable dose marker rides the curve; the three regions are shaded and
 * annotated, and an `aria-live` readout classifies the current dose as
 * WEAKENED / STRENGTHENED / DAMAGED with the signed benefit value. The curve
 * animates in on mount; respects `prefers-reduced-motion` (jumps straight to
 * the final curve).
 */
export function HormesisCurve({
  title = 'The hormetic curve — what doesn’t kill you',
  doseLabel = 'Dose / stressor',
  benefitLabel = 'Benefit vs baseline',
  deprivationLabel = 'Deprivation → atrophy',
  hormeticLabel = 'Hormetic zone → stronger',
  overdoseLabel = 'Overdose → damage',
  statusLabel = 'Right now',
  benefitReadoutLabel = 'Benefit vs baseline',
  weakenedLabel = 'Weakened (deprivation)',
  strengthenedLabel = 'Strengthened (hormesis)',
  damagedLabel = 'Damaged (overdose)',
  baselineLabel = 'baseline',
  caption = 'Zero stress is not safety — it is atrophy. A moderate dose of a stressor strengthens a living system above its baseline through overcompensation, but the benefit peaks and then turns to harm. Remove all volatility and you do not get a robust system; you get a fragile one.',
  dose = 45,
  className,
}: HormesisCurveProps) {
  const id = useId();
  const [doseState, setDoseState] = useState(dose);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 16;
  const padY = 18;

  const DOSE_MAX = 100;

  // Hormetic benefit b(d): starts negative (deprivation), rises into a positive
  // hump (hormesis), peaks, then falls back below baseline (overdose). A scaled
  // cubic gives the classic non-monotonic shape, normalised to a tidy range.
  // d ∈ [0, 100] → t ∈ [0, 1].
  const benefit = (d: number): number => {
    const t = d / DOSE_MAX;
    // Cubic with a negative start, positive hump, negative tail.
    const raw = -7 * (t - 0.08) * (t - 0.5) * (t - 0.92);
    // Scale so the peak sits near +1 and the deprivation/overdose floors dip below 0.
    return raw * 2.1;
  };

  // Zone boundaries (where the curve crosses baseline = 0). Derived from the
  // benefit roots above: rises through baseline near t≈0.08, falls back near
  // t≈0.92. Kept as constants so the shading and classification agree.
  const RISE = 0.08 * DOSE_MAX; // 8 — deprivation → hormetic
  const FALL = 0.92 * DOSE_MAX; // 92 — hormetic → overdose

  const zoneOf = (d: number): Zone => {
    if (d <= RISE) return 'deprivation';
    if (d >= FALL) return 'overdose';
    return 'hormetic';
  };

  const x = (d: number): number => padX + (d / DOSE_MAX) * (W - padX * 2);

  // Y range: cover the full benefit excursion with a little headroom.
  const SAMPLES = 90;
  let bMax = 0;
  let bMin = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const v = benefit((i / SAMPLES) * DOSE_MAX);
    if (v > bMax) bMax = v;
    if (v < bMin) bMin = v;
  }
  const yTop = bMax * 1.12;
  const yBottom = bMin * 1.12;
  const y = (v: number): number =>
    padY + (1 - (v - yBottom) / (yTop - yBottom)) * (H - padY * 2);

  // Curve sampled finely, revealed left-to-right up to `progress`.
  const curvePath = (): string => {
    const upto = progress * DOSE_MAX;
    let d = `M ${x(0)} ${y(benefit(0))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const dose_ = (i / SAMPLES) * DOSE_MAX;
      if (dose_ > upto) {
        d += ` L ${x(upto)} ${y(benefit(upto))}`;
        break;
      }
      d += ` L ${x(dose_)} ${y(benefit(dose_))}`;
    }
    return d;
  };

  // Animate the curve drawing in on mount.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 900;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const currentBenefit = benefit(doseState);
  const zone = zoneOf(doseState);
  const baselineY = y(0);

  const statusText =
    zone === 'deprivation'
      ? weakenedLabel
      : zone === 'hormetic'
        ? strengthenedLabel
        : damagedLabel;

  // Region tint per zone for the badge + readout accent.
  const statusColor =
    zone === 'hormetic'
      ? 'text-success'
      : zone === 'overdose'
        ? 'text-danger'
        : 'text-warning';
  const statusBg =
    zone === 'hormetic'
      ? 'bg-success'
      : zone === 'overdose'
        ? 'bg-danger'
        : 'bg-warning';

  const fmt = (v: number): string =>
    `${v >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v)}`;

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
            statusBg,
          )}
        >
          {statusText}
        </span>
      </figcaption>

      {/* Legend — the three regions of the dose–response. */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded-sm bg-warning/25" aria-hidden="true" />
          {deprivationLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded-sm bg-success/25" aria-hidden="true" />
          {hormeticLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded-sm bg-danger/25" aria-hidden="true" />
          {overdoseLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {benefitLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. At a dose of ${Math.round(
          doseState,
        )} on a 0 to 100 scale, the system is ${statusText.toLowerCase()}, with a benefit of ${fmt(
          currentBenefit,
        )} relative to baseline.`}
      >
        {/* Region shading: deprivation, hormetic, overdose. */}
        <rect
          x={x(0)}
          y={padY}
          width={x(RISE) - x(0)}
          height={H - padY * 2}
          fill="var(--color-warning)"
          opacity={0.1}
        />
        <rect
          x={x(RISE)}
          y={padY}
          width={x(FALL) - x(RISE)}
          height={H - padY * 2}
          fill="var(--color-success)"
          opacity={0.1}
        />
        <rect
          x={x(FALL)}
          y={padY}
          width={x(DOSE_MAX) - x(FALL)}
          height={H - padY * 2}
          fill="var(--color-danger)"
          opacity={0.1}
        />

        {/* Baseline (benefit = 0). */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--color-ink-300)"
          strokeDasharray="4 4"
        />
        <text
          x={W - padX}
          y={baselineY - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {baselineLabel}
        </text>

        {/* The hormetic curve, animated reveal. */}
        <path
          d={curvePath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Vertical drop line from baseline to the current benefit. */}
        <line
          x1={x(doseState)}
          y1={baselineY}
          x2={x(doseState)}
          y2={y(currentBenefit)}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />

        {/* Current-dose marker on the curve. */}
        <circle
          cx={x(doseState)}
          cy={y(currentBenefit)}
          r={6}
          fill="var(--color-brand-600)"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-dose`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{doseLabel}</span>
          <span className="font-mono text-ink-900">{Math.round(doseState)}</span>
        </label>
        <input
          id={`${id}-dose`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(doseState)}
          onChange={(e) => setDoseState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{doseLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {Math.round(doseState)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{statusLabel}</dt>
          <dd className={cx('text-lg font-semibold', statusColor)}>{statusText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{benefitReadoutLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold', statusColor)}>
            {fmt(currentBenefit)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default HormesisCurve;
