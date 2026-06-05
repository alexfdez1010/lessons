import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VarHorizonScalingProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the horizon (days) slider. */
  horizonLabel?: string;
  /** Legend + readout label for the √t-scaled (correct) curve. */
  sqrtLabel?: string;
  /** Legend + readout label for the linear (overstated) curve. */
  linearLabel?: string;
  /** Label for the fixed 1-day base VaR badge. */
  baseVarLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const H_MIN = 1;
const H_MAX = 30;
// Y axis is measured in *multiples* of the 1-day VaR. The teaching contrast
// (√t grows far slower than linear) is sharpest in the 1–10 day range, so we
// cap the visible Y axis at 8× and clip the linear line where it runs off the
// top. The "off the chart" note flags that linear keeps climbing to 30×.
const Y_CAP = 8;

/**
 * Interactive √t-rule chart for scaling Value-at-Risk across horizons. Over a
 * 1–30 day horizon axis it draws two curves in multiples of the fixed 1-day
 * VaR: the correct `√h` scaling (hero, brand) and the naive linear `h` scaling
 * (cautionary, dashed accent). A slider sets the horizon h; marker dots and
 * mono readout chips show the √t multiple vs the linear multiple at that h, so
 * the learner sees the 10-day VaR is ~3.16× the 1-day, not 10×. The visible Y
 * axis is capped at 8× and the linear line is clipped where it runs off the
 * top. The curves animate in on mount (respects `prefers-reduced-motion`).
 */
export function VarHorizonScaling({
  title = 'Scaling VaR across time: the √t rule',
  horizonLabel = 'Horizon (days)',
  sqrtLabel = '√t-scaled VaR (correct)',
  linearLabel = 'Linear scaling (overstated)',
  baseVarLabel = '1-day VaR',
  caption = 'Risk scales with the square root of time, not time itself. Over 10 days VaR grows ~3.16×, not 10× — multiplying by the horizon wildly overstates the loss.',
  className,
}: VarHorizonScalingProps) {
  const id = useId();
  const [h, setH] = useState(10);
  const [progress, setProgress] = useState(1); // 0 → 1 (curve draw-in)
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 26;

  const sqrtMult = (d: number) => Math.sqrt(d);
  const linearMult = (d: number) => d;

  const x = (d: number) =>
    padL + ((d - H_MIN) / (H_MAX - H_MIN)) * (W - padL - padR);
  // Y measured in multiples, clamped to the visible cap.
  const y = (mult: number) =>
    padT + (1 - Math.min(mult, Y_CAP) / Y_CAP) * (H - padT - padB);

  // √t curve — smooth, fully on-chart (sqrt(30) ≈ 5.48 < 8).
  const SAMPLES = 90;
  const sqrtPath = () => {
    const upto = H_MIN + progress * (H_MAX - H_MIN);
    let d = `M ${x(H_MIN)} ${y(sqrtMult(H_MIN))}`;
    for (let i = 1; i <= SAMPLES; i++) {
      const day = H_MIN + (i / SAMPLES) * (H_MAX - H_MIN);
      if (day > upto) {
        d += ` L ${x(upto)} ${y(sqrtMult(upto))}`;
        break;
      }
      d += ` L ${x(day)} ${y(sqrtMult(day))}`;
    }
    return d;
  };

  // Linear line — clipped where it crosses the Y cap (linear hits 8× at h=8).
  const linearPath = () => {
    const hitCap = Math.min(Y_CAP, H_MAX); // day where mult == Y_CAP
    const end = Math.min(hitCap, H_MIN + progress * (H_MAX - H_MIN));
    return `M ${x(H_MIN)} ${y(linearMult(H_MIN))} L ${x(end)} ${y(linearMult(end))}`;
  };
  const linearOffChart = progress >= 1; // linear leaves the top edge at h=8

  // Y gridlines / ticks at clean multiples.
  const yTicks = [1, 2, 4, 6, 8];
  const xTicks = [1, 10, 20, 30];

  // Animate the curves drawing in on mount.
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

  const sqrtNow = sqrtMult(h);
  const linearNow = linearMult(h);
  const fmt = (v: number) => v.toFixed(2);

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
          {baseVarLabel}: 1.00×
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {sqrtLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-0 w-5 border-t-2 border-dashed border-accent-500"
            aria-hidden="true"
          />
          {linearLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. At a ${h}-day horizon the correct √t-scaled VaR is ${fmt(
          sqrtNow,
        )} times the 1-day VaR, while naive linear scaling overstates it at ${fmt(
          linearNow,
        )} times.`}
      >
        {/* Y gridlines + ticks (multiples of the 1-day VaR) */}
        {yTicks.map((m) => (
          <g key={`y-${m}`}>
            <line
              x1={padL}
              y1={y(m)}
              x2={W - padR}
              y2={y(m)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={y(m) + 4}
              fontSize={11}
              fill="var(--color-ink-500)"
              textAnchor="end"
            >
              {m}×
            </text>
          </g>
        ))}

        {/* X axis ticks */}
        {xTicks.map((d) => (
          <text
            key={`x-${d}`}
            x={x(d)}
            y={H - 6}
            fontSize={11}
            fill="var(--color-ink-700)"
            textAnchor={d === H_MIN ? 'start' : d === H_MAX ? 'end' : 'middle'}
          >
            {d}
          </text>
        ))}

        {/* Linear (overstated) — dashed, clipped at the Y cap */}
        <path
          d={linearPath()}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="6 5"
          strokeLinecap="round"
        />
        {linearOffChart && (
          <text
            x={x(Math.min(Y_CAP, H_MAX)) + 6}
            y={padT + 12}
            fontSize={10}
            fill="var(--color-accent-600)"
            textAnchor="start"
          >
            off the chart →
          </text>
        )}

        {/* √t curve (hero) */}
        <path
          d={sqrtPath()}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current-horizon vertical guide */}
        <line
          x1={x(h)}
          y1={padT}
          x2={x(h)}
          y2={H - padB}
          stroke="var(--color-ink-200)"
          strokeDasharray="3 4"
        />

        {/* Marker dots at the current horizon */}
        {linearNow <= Y_CAP && (
          <circle
            cx={x(h)}
            cy={y(linearNow)}
            r={4.5}
            fill="var(--color-accent-500)"
            stroke="var(--color-surface)"
            strokeWidth={2}
          />
        )}
        <circle
          cx={x(h)}
          cy={y(sqrtNow)}
          r={5}
          fill="var(--color-brand-500)"
          stroke="var(--color-surface)"
          strokeWidth={2}
        />
      </svg>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-h`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{horizonLabel}</span>
          <span className="font-mono text-ink-900">{h}</span>
        </label>
        <input
          id={`${id}-h`}
          type="range"
          min={H_MIN}
          max={H_MAX}
          step={1}
          value={h}
          onChange={(e) => setH(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{sqrtLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(sqrtNow)}×
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{linearLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {fmt(linearNow)}×
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default VarHorizonScaling;
