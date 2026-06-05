import { useEffect, useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VarBacktestTimelineProps {
  title?: string;
  confidenceLabel?: string;
  thresholdLabel?: string;
  exceptionLabel?: string;
  expectedLabel?: string;
  zoneGreenLabel?: string;
  zoneYellowLabel?: string;
  zoneRedLabel?: string;
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Deterministic ~60-day daily P&L series in percent. Mostly small ±1–2% noise
 * with a handful of sharp negative spikes (around -3% to -5%) that breach a
 * 99% VaR loss limit. Hardcoded — no Math.random (banned in this project) so
 * the exception counts below are stable and reproducible.
 */
// prettier-ignore
const PNL: readonly number[] = [
   0.6, -0.4,  1.1,  0.3, -0.9,  0.8, -1.2,  0.5,  1.4, -0.7,
   0.2, -3.6,  0.9,  1.0, -0.5,  0.7, -1.5,  1.2,  0.4, -0.8,
  -2.1,  0.6,  1.3, -0.3,  0.9, -1.1,  0.5, -4.2,  0.8,  1.1,
  -0.6,  0.4, -1.4,  1.0,  0.7, -2.6,  0.3, -0.9,  1.2,  0.6,
  -1.0,  0.8, -3.1,  0.5,  1.3, -0.7,  0.9, -1.8,  0.4,  1.1,
  -0.5,  0.7, -4.8,  1.0, -0.8,  0.6,  1.2, -2.3,  0.9, -0.4,
];

/**
 * VaR loss limits (magnitude, in % of P&L) per confidence level, picked to fit
 * the hardcoded series above:
 *   - 99% → 3.0%  → breached by days at -3.6, -4.2, -3.1, -4.8 → 4 exceptions
 *   - 95% → 2.0%  → also breached by -2.1, -2.6, -2.3         → 7 exceptions
 * A stricter (99%) VaR sets a deeper limit, so fewer days punch through it.
 */
const THRESHOLDS: Record<99 | 95, number> = { 99: 3.0, 95: 2.0 };

/**
 * Basel "traffic-light" zone cutoffs. The official thresholds are calibrated for
 * a ~250-day window (0–4 green, 5–9 yellow, 10+ red). For this ~60-day demo we
 * scale them down to illustrative cutoffs (the caption says so):
 *   - 0–2 exceptions → green
 *   - 3–5 exceptions → yellow
 *   - 6+  exceptions → red
 */
type Zone = 'green' | 'yellow' | 'red';
const zoneFor = (exceptions: number): Zone => {
  if (exceptions <= 2) return 'green';
  if (exceptions <= 5) return 'yellow';
  return 'red';
};

const ZONE_COLOR: Record<Zone, string> = {
  green: 'var(--color-success)',
  yellow: 'var(--color-warning)',
  red: 'var(--color-danger)',
};

/**
 * Teaches **VaR backtesting**. A ~60-day timeline of daily P&L is drawn as bars
 * along a zero baseline (gains up, losses down). A dashed horizontal **VaR limit**
 * line sits in the loss region; any day whose loss punches through it is an
 * **exception** — highlighted in danger color with a triangle marker above the
 * bar. A confidence slider (95% / 99%) moves the limit and recounts exceptions
 * live, so a stricter VaR visibly yields fewer breaches. A summary row reports
 * the exception count, the statistically expected count `(1−c)·N`, and a Basel
 * traffic-light zone badge (green / yellow / red). Bars reveal left→right on
 * mount; respects `prefers-reduced-motion`.
 */
export function VarBacktestTimeline({
  title = 'Backtesting VaR: counting the breaches',
  confidenceLabel = 'Confidence level',
  thresholdLabel = 'VaR limit',
  exceptionLabel = 'Exceptions (breaches)',
  expectedLabel = 'Expected',
  zoneGreenLabel = 'Green zone',
  zoneYellowLabel = 'Yellow zone',
  zoneRedLabel = 'Red zone',
  caption = 'Each bar is one day’s P&L; the dashed line is the VaR loss limit. A loss that punches through the limit is an exception. A stricter 99% VaR sets a deeper limit, so fewer days breach it. The Basel traffic-light zones here are scaled-down and illustrative — the official 0–4 / 5–9 / 10+ cutoffs are calibrated for a ~250-day window.',
  className,
}: VarBacktestTimelineProps) {
  const id = useId();
  const [confidence, setConfidence] = useState<99 | 95>(99);
  const [revealed, setRevealed] = useState(false);

  // Reveal bars left→right on mount (or jump straight to final if reduced motion).
  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(true);
      return;
    }
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const n = PNL.length;
  const threshold = THRESHOLDS[confidence];

  const exceptionFlags = PNL.map((v) => v < -threshold);
  const exceptions = exceptionFlags.filter(Boolean).length;
  const expected = (1 - confidence / 100) * n; // (1 − c) · N
  const zone = zoneFor(exceptions);

  const zoneLabel: Record<Zone, string> = {
    green: zoneGreenLabel,
    yellow: zoneYellowLabel,
    red: zoneRedLabel,
  };

  // --- Geometry ------------------------------------------------------------
  const W = 560;
  const H = 240;
  const padX = 14;
  const padTop = 24; // room for exception markers above the tallest gain
  const padBottom = 14;
  const plotH = H - padTop - padBottom;

  const maxAbs = Math.max(...PNL.map((v) => Math.abs(v)), threshold) * 1.08;
  const zeroY = padTop + (maxAbs / (2 * maxAbs)) * plotH; // == centre
  const slot = (W - padX * 2) / n;
  const barW = slot * 0.62;

  // value (%) → y pixel (positive up, negative down) from the zero baseline.
  const valueToLen = (v: number) => (Math.abs(v) / (2 * maxAbs)) * plotH;
  const thresholdY = zeroY + valueToLen(threshold);

  const barX = (i: number) => padX + slot * i + (slot - barW) / 2;

  const transitionDelay = (i: number) =>
    prefersReducedMotion() ? '0ms' : `${Math.round((i / n) * 600)}ms`;

  const ariaLabel = `${title}: at ${confidence}% confidence over ${n} days, ${exceptions} exception${
    exceptions === 1 ? '' : 's'
  } (days whose loss exceeded the ${threshold.toFixed(
    1,
  )}% VaR limit) versus ${expected.toFixed(1)} expected — ${zoneLabel[zone]}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className="rounded-pill px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: ZONE_COLOR[zone] }}
        >
          {zoneLabel[zone]}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" aria-hidden="true" />
          Gain
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-400" aria-hidden="true" />
          Loss
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: 'var(--color-danger)' }}
            aria-hidden="true"
          />
          {exceptionLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
        />

        {/* VaR threshold line (dashed, accent) sitting in the loss region */}
        <line
          x1={padX}
          y1={thresholdY}
          x2={W - padX}
          y2={thresholdY}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="transition-all duration-500"
        />
        <text
          x={W - padX}
          y={thresholdY - 5}
          textAnchor="end"
          fontSize="11"
          fontWeight="600"
          fill="var(--color-accent-600)"
        >
          {`${thresholdLabel} −${threshold.toFixed(1)}%`}
        </text>

        {/* P&L bars */}
        {PNL.map((v, i) => {
          const isLoss = v < 0;
          const isException = exceptionFlags[i];
          const len = valueToLen(v);
          const yTop = isLoss ? zeroY : zeroY - len;
          const x = barX(i);
          const fill = isException
            ? 'var(--color-danger)'
            : isLoss
              ? 'var(--color-ink-400)'
              : 'var(--color-brand-500)';
          return (
            <g key={i}>
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={Math.max(len, 0.5)}
                rx={1.5}
                fill={fill}
                className="transition-opacity duration-300"
                style={{
                  opacity: revealed ? (isException ? 1 : 0.95) : 0,
                  transitionDelay: transitionDelay(i),
                }}
              />
              {/* Exception marker: a small triangle above the gain area */}
              {isException && (
                <polygon
                  points={`${x + barW / 2 - 4},${padTop - 6} ${x + barW / 2 + 4},${
                    padTop - 6
                  } ${x + barW / 2},${padTop}`}
                  fill="var(--color-danger)"
                  className="transition-opacity duration-300"
                  style={{
                    opacity: revealed ? 1 : 0,
                    transitionDelay: transitionDelay(i),
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Confidence segmented control */}
      <div className="mt-4">
        <span className="text-sm text-ink-700">{confidenceLabel}</span>
        <div
          className="mt-2 inline-flex flex-wrap gap-2"
          role="group"
          aria-label={confidenceLabel}
        >
          {([95, 99] as const).map((c) => {
            const selected = confidence === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                onClick={() => setConfidence(c)}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  selected
                    ? 'bg-brand-600 text-white'
                    : 'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
                )}
              >
                {`${c}%`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary readouts */}
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{exceptionLabel}</dt>
          <dd
            className="font-mono text-lg font-semibold"
            style={{ color: ZONE_COLOR[zone] }}
          >
            {exceptions}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{expectedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {expected.toFixed(1)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{thresholdLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {`−${threshold.toFixed(1)}%`}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600" id={`${id}-caption`}>
        {caption}
      </p>
    </figure>
  );
}

export default VarBacktestTimeline;
