import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface AmplitudeEstimationConvergenceProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend + chip label for the classical Monte Carlo curve. */
  classicalLabel?: string;
  /** Legend + chip label for the Quantum Amplitude Estimation curve. */
  quantumLabel?: string;
  /** Label for the target-error slider. */
  targetErrorLabel?: string;
  /** Label for the classical sample-count readout chip. */
  classicalCountLabel?: string;
  /** Label for the quantum query-count readout chip. */
  quantumCountLabel?: string;
  /** Label for the speedup readout chip. */
  speedupLabel?: string;
  /** Label for the animate / sweep toggle. */
  animateLabel?: string;
  /** Caption under the x-axis (samples / oracle queries N). */
  xAxisLabel?: string;
  /** Caption beside the y-axis (estimation error). */
  yAxisLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- The two convergence laws (kept here, never rendered as equations) -------
//   Classical Monte Carlo: the estimation error shrinks like the inverse SQUARE
//   ROOT of the sample count — error ≈ C / sqrt(N), i.e. slope −1/2 on a log-log
//   plot. To hit a target error ε you therefore need N ∝ 1/ε² samples.
//   Quantum Amplitude Estimation (QAE): amplitude amplification buys a quadratic
//   speedup, so the error shrinks like the inverse of the query count —
//   error ≈ C / N, i.e. slope −1 on a log-log plot. To hit ε you need only
//   N ∝ 1/ε oracle queries. Hence N_classical / N_quantum ≈ 1/ε: the quantum
//   query count is the SQUARE ROOT of the classical sample count. That widening
//   vertical gap between the two lines is exactly the speedup.
const N_MIN = 10; // smallest sample / query count on the x-axis
const N_MAX = 1_000_000; // largest sample / query count on the x-axis
const ERR_CONST = 1; // shared leading constant so both curves start together

const classicalError = (n: number): number => ERR_CONST / Math.sqrt(n); // ∝ N^(-1/2)
const quantumError = (n: number): number => ERR_CONST / n; // ∝ N^(-1)

// Sample / query counts needed to reach a target error ε (rounded, illustrative).
const classicalSamplesFor = (eps: number): number =>
  Math.round(Math.pow(ERR_CONST / eps, 2)); // N ∝ 1/ε²
const quantumQueriesFor = (eps: number): number =>
  Math.round(ERR_CONST / eps); // N ∝ 1/ε

// Compact human-readable integer (e.g. 1.0M, 320K, 4.5K, 18).
const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 9_500_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 9_500 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
};

/**
 * The quadratic quantum speedup, made visible. On a log-log plot we draw two
 * convergence curves for estimating an unknown probability/expectation: the
 * classical Monte Carlo error falls with slope −1/2 (error ∝ 1/sqrt(N)), while
 * Quantum Amplitude Estimation falls with slope −1 (error ∝ 1/N). Because the
 * axes are logarithmic, the two laws are straight lines of different slope, and
 * the vertical gap between them grows without bound as N increases — that gap is
 * the speedup.
 *
 * Drag the target-error slider to drop a horizontal line at ε and read off how
 * many samples each approach needs to get there: classical N ∝ 1/ε² versus
 * quantum N ∝ 1/ε, with a speedup chip equal to their ratio (≈ 1/ε — the quantum
 * count is the square root of the classical one). The animate toggle sweeps N
 * growing left-to-right so the curves draw on; `prefers-reduced-motion` is
 * respected (both curves render fully drawn at once).
 */
export function AmplitudeEstimationConvergence({
  title = 'The quantum speedup, made visible: 1/√N versus 1/N',
  classicalLabel = 'Classical Monte Carlo',
  quantumLabel = 'Quantum Amplitude Estimation',
  targetErrorLabel = 'Target error (ε)',
  classicalCountLabel = 'Classical samples',
  quantumCountLabel = 'Quantum queries',
  speedupLabel = 'Speedup',
  animateLabel = 'Sweep N',
  xAxisLabel = 'Samples / oracle queries N',
  yAxisLabel = 'Estimation error',
  caption = 'Both methods start equally lost, but they learn at different rates. Classical sampling halves its error only after quadrupling the work — slope −1/2 on this log-log plot. Quantum Amplitude Estimation halves its error every time it doubles the work — slope −1. The widening gap between the two lines is the quadratic speedup: to reach a target error the classical method needs about 1/ε² samples, while the quantum method needs only about 1/ε queries — the square root of the classical count.',
  className,
}: AmplitudeEstimationConvergenceProps) {
  const id = useId();
  // Target error on a log slider: from a coarse 1e-1 down to a fine 1e-4.
  const [logEps, setLogEps] = useState(-2); // ε = 10^logEps, default 1e-2
  const [animate, setAnimate] = useState(false);
  const [progress, setProgress] = useState(1); // 0 → 1 sweep reveal (1 = fully drawn)
  const rafRef = useRef<number | null>(null);

  const eps = Math.pow(10, logEps);

  // Layout.
  const W = 520;
  const H = 300;
  const padLeft = 46;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 40;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // Log-log scales. x: N from N_MIN..N_MAX. y: error from ERR_MIN..ERR_MAX.
  const logXMin = Math.log10(N_MIN);
  const logXMax = Math.log10(N_MAX);
  // Error range covers both curves across the full N range, with a little margin.
  const ERR_MAX = classicalError(N_MIN); // largest error shown (top of plot)
  const ERR_MIN = quantumError(N_MAX) / 2; // smallest error shown (bottom of plot)
  const logYMin = Math.log10(ERR_MIN);
  const logYMax = Math.log10(ERR_MAX);

  const xToPx = (n: number) =>
    padLeft + ((Math.log10(n) - logXMin) / (logXMax - logXMin)) * plotW;
  const yToPx = (err: number) =>
    padTop + (1 - (Math.log10(err) - logYMin) / (logYMax - logYMin)) * plotH;

  // Sweep animation: advance progress 0 → 1 when the toggle turns on.
  useEffect(() => {
    if (!animate) {
      setProgress(1);
      return;
    }
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 1500;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  // The current right edge of N being revealed by the sweep (log-interpolated).
  const nRevealed = Math.pow(10, logXMin + progress * (logXMax - logXMin));

  // Build a polyline path for an error law up to the revealed N.
  const STEPS = 120;
  const curvePath = (errOf: (n: number) => number): string => {
    let d = '';
    let started = false;
    for (let i = 0; i <= STEPS; i++) {
      const frac = i / STEPS;
      const logN = logXMin + frac * (logXMax - logXMin);
      const n = Math.pow(10, logN);
      if (n > nRevealed + 1e-9) break;
      const px = xToPx(n);
      const py = yToPx(errOf(n));
      d += `${started ? 'L' : 'M'} ${px.toFixed(2)} ${py.toFixed(2)} `;
      started = true;
    }
    return d.trim();
  };

  // Target line + the N where each curve crosses ε (for the marker dots).
  const targetY = yToPx(eps);
  const nClassical = classicalSamplesFor(eps);
  const nQuantum = quantumQueriesFor(eps);
  const speedup = nClassical / Math.max(1, nQuantum); // ≈ 1/ε

  const epsText = eps >= 0.01 ? eps.toFixed(2) : eps.toExponential(0);
  const speedupText = speedup >= 1000 ? `${formatCount(speedup)}×` : `${Math.round(speedup)}×`;

  // Decade ticks for both axes.
  const xTicks = [10, 100, 1_000, 10_000, 100_000, 1_000_000];
  const yTickDecades: number[] = [];
  for (let p = Math.ceil(logYMin); p <= Math.floor(logYMax); p++) {
    yTickDecades.push(p);
  }

  const decadeLabel = (p: number): string => {
    if (p >= 0) return `${Math.pow(10, p)}`;
    return `1e${p}`; // e.g. 1e-3 — plain text, not math
  };
  const xTickLabel = (n: number): string =>
    n >= 1_000_000 ? '1M' : n >= 1_000 ? `${n / 1_000}K` : `${n}`;

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
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {classicalLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {quantumLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Log-log plot of estimation error against the number of samples or oracle queries N. The ${classicalLabel} line falls with slope minus one half (error proportional to one over the square root of N); the ${quantumLabel} line falls with slope minus one (error proportional to one over N), so the gap between them widens as N grows. To reach a target error of ${epsText}, the classical method needs about ${formatCount(nClassical)} samples while the quantum method needs only about ${formatCount(nQuantum)} queries — a speedup of about ${speedupText}.`}
      >
        {/* Y-axis decade gridlines + ticks */}
        {yTickDecades.map((p) => {
          const yy = yToPx(Math.pow(10, p));
          return (
            <g key={`y-${p}`}>
              <line
                x1={padLeft}
                y1={yy}
                x2={W - padRight}
                y2={yy}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={padLeft - 6}
                y={yy + 4}
                fontSize={10}
                fill="var(--color-ink-400)"
                textAnchor="end"
              >
                {decadeLabel(p)}
              </text>
            </g>
          );
        })}

        {/* X-axis decade gridlines + ticks */}
        {xTicks.map((n) => {
          const xx = xToPx(n);
          return (
            <g key={`x-${n}`}>
              <line
                x1={xx}
                y1={padTop}
                x2={xx}
                y2={H - padBottom}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={xx}
                y={H - padBottom + 14}
                fontSize={10}
                fill="var(--color-ink-500)"
                textAnchor={n === N_MIN ? 'start' : n === N_MAX ? 'end' : 'middle'}
              >
                {xTickLabel(n)}
              </text>
            </g>
          );
        })}

        {/* Axis frame (left + bottom) */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={H - padBottom}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
        />
        <line
          x1={padLeft}
          y1={H - padBottom}
          x2={W - padRight}
          y2={H - padBottom}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
        />

        {/* Target-error horizontal line (dashed) */}
        <line
          x1={padLeft}
          y1={targetY}
          x2={W - padRight}
          y2={targetY}
          stroke="var(--color-ink-500)"
          strokeWidth={1.4}
          strokeDasharray="5 4"
        />
        <text
          x={W - padRight}
          y={targetY - 5}
          fontSize={10}
          fill="var(--color-ink-600)"
          textAnchor="end"
        >
          {`${targetErrorLabel}: ${epsText}`}
        </text>

        {/* Classical curve (slope −1/2, brand) */}
        <path
          d={curvePath(classicalError)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Quantum curve (slope −1, accent) */}
        <path
          d={curvePath(quantumError)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crossing markers where each curve meets the target error ε.
            Only draw when the crossing N is within the revealed sweep + axis. */}
        {nClassical >= N_MIN && nClassical <= N_MAX && nClassical <= nRevealed + 1e-9 && (
          <circle
            cx={xToPx(nClassical)}
            cy={targetY}
            r={4}
            fill="var(--color-brand-500)"
            stroke="var(--color-surface)"
            strokeWidth={1.5}
          />
        )}
        {nQuantum >= N_MIN && nQuantum <= N_MAX && nQuantum <= nRevealed + 1e-9 && (
          <circle
            cx={xToPx(nQuantum)}
            cy={targetY}
            r={4}
            fill="var(--color-accent-500)"
            stroke="var(--color-surface)"
            strokeWidth={1.5}
          />
        )}

        {/* X-axis label */}
        <text
          x={padLeft + plotW / 2}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {xAxisLabel}
        </text>
        {/* Y-axis label (rotated) */}
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {yAxisLabel}
        </text>
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{classicalCountLabel}</span>
          <span className="font-mono font-semibold text-brand-600">
            {formatCount(nClassical)}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{quantumCountLabel}</span>
          <span className="font-mono font-semibold text-accent-600">
            {formatCount(nQuantum)}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{speedupLabel}</span>
          <span className="font-mono font-semibold text-ink-900">{speedupText}</span>
        </span>
      </div>

      {/* Target-error slider (log scale) */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-eps`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{targetErrorLabel}</span>
          <span className="font-mono text-ink-600" aria-hidden="true">
            {epsText}
          </span>
        </label>
        <input
          id={`${id}-eps`}
          type="range"
          min={-4}
          max={-1}
          step={0.1}
          value={logEps}
          onChange={(e) => setLogEps(Number(e.target.value))}
          aria-valuetext={`target error ${epsText}; classical needs about ${formatCount(
            nClassical,
          )} samples, quantum needs about ${formatCount(
            nQuantum,
          )} queries, a speedup of about ${speedupText}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Animate / sweep toggle */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setAnimate((a) => !a)}
          aria-pressed={animate}
          className={cx(
            'rounded-pill border px-4 py-1.5 text-sm font-medium transition',
            animate
              ? 'border-brand-500 bg-brand-500 text-white shadow-soft'
              : 'border-ink-100 bg-surface-50 text-ink-700 hover:bg-surface',
          )}
        >
          {animateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>

      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        {`${targetErrorLabel}: ${epsText}. ${classicalCountLabel}: ${formatCount(
          nClassical,
        )}. ${quantumCountLabel}: ${formatCount(nQuantum)}. ${speedupLabel}: ${speedupText}.`}
      </span>
    </figure>
  );
}

export default AmplitudeEstimationConvergence;
