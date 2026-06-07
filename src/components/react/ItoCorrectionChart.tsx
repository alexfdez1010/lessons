import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ItoCorrectionChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the volatility (sigma) slider. */
  volLabel?: string;
  /** Label for the constant price-drift (mu) line. */
  priceDriftLabel?: string;
  /** Label for the log-price-drift (mu − ½σ²) line. */
  logDriftLabel?: string;
  /** Label for the shaded ½σ² correction wedge. */
  correctionLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MU = 0.08; // fixed annual price drift, mu = 8%
const SIGMA_MIN = 0; // percent
const SIGMA_MAX = 60; // percent

/**
 * Itô-correction explainer. Under Geometric Brownian Motion the price S has
 * drift μ, but log(S) drifts at μ − ½σ², not μ. The gap is the "Itô
 * correction" — born from Brownian motion's non-zero quadratic variation (the
 * random wiggle does not average out under the concave log). μ is held fixed at
 * 8%; the σ slider widens the shaded wedge between the flat price-drift line and
 * the sinking log-drift line, and the wedge grows quadratically with σ. A
 * companion ½σ²-vs-σ curve makes that quadratic growth explicit. Transitions
 * tween smoothly unless `prefers-reduced-motion` is set, in which case they snap.
 */
export function ItoCorrectionChart({
  title = "Itô's correction: log-price drifts at μ − ½σ²",
  volLabel = 'Volatility σ (annual)',
  priceDriftLabel = 'Price drift μ',
  logDriftLabel = 'Log-price drift μ − ½σ²',
  correctionLabel = 'Itô correction ½σ²',
  caption = 'The price grows with drift μ, but the log of the price grows more slowly — at μ − ½σ². That missing ½σ² is the Itô correction: random volatility, seen through the curved log, drags the average down. Drag σ and watch the gap widen quadratically — it is zero with no volatility and balloons as volatility climbs.',
  className,
}: ItoCorrectionChartProps) {
  const id = useId();
  const [sigmaPct, setSigmaPct] = useState(25); // target annual volatility, percent
  const [animSigma, setAnimSigma] = useState(25); // tweened value actually drawn
  const rafRef = useRef<number | null>(null);

  // Tween the drawn sigma toward the slider target (snap if reduced motion).
  useEffect(() => {
    if (prefersReducedMotion()) {
      setAnimSigma(sigmaPct);
      return;
    }
    const from = animSigma;
    const to = sigmaPct;
    if (from === to) return;
    const duration = 350;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOutQuad
      setAnimSigma(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigmaPct]);

  const sigma = animSigma / 100; // drawn volatility (decimal)
  const correction = 0.5 * sigma * sigma; // ½σ² (decimal)
  const logDrift = MU - correction; // μ − ½σ² (decimal)

  // Live readout uses the committed slider value, not the in-flight tween.
  const sigmaTarget = sigmaPct / 100;
  const correctionTarget = 0.5 * sigmaTarget * sigmaTarget;
  const logDriftTarget = MU - correctionTarget;

  const sigmaText = `${sigmaPct.toFixed(0)}%`;
  const muText = `${(MU * 100).toFixed(1)}%`;
  const correctionText = `${(correctionTarget * 100).toFixed(2)}%`;
  const logDriftText = `${(logDriftTarget * 100).toFixed(2)}%`;

  // ---- Main chart geometry ---------------------------------------------------
  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 18;
  const padBottom = 28;

  // Rate (decimal) → pixel. Worst case correction at SIGMA_MAX sets the floor.
  const sigmaMaxDec = SIGMA_MAX / 100;
  const rateMin = MU - 0.5 * sigmaMaxDec * sigmaMaxDec - 0.01; // headroom below
  const rateMax = MU + 0.015; // headroom above the μ line
  const yToPx = (rate: number) =>
    padTop + (1 - (rate - rateMin) / (rateMax - rateMin)) * (H - padTop - padBottom);

  const muY = yToPx(MU);
  const logY = yToPx(logDrift);
  const xStart = padLeft;
  const xEnd = W - padRight;

  // Rate gridlines.
  const gridRates = [rateMax, MU, (MU + rateMin) / 2, rateMin];

  // ---- Companion ½σ²-vs-σ curve geometry ------------------------------------
  const cW = 520;
  const cH = 96;
  const cPadLeft = 40;
  const cPadRight = 14;
  const cPadTop = 12;
  const cPadBottom = 22;
  const corrMax = 0.5 * sigmaMaxDec * sigmaMaxDec; // ½σ² at σ_max
  const cx2 = (sPct: number) =>
    cPadLeft + (sPct / SIGMA_MAX) * (cW - cPadLeft - cPadRight);
  const cy = (corr: number) =>
    cPadTop + (1 - corr / corrMax) * (cH - cPadTop - cPadBottom);

  // Sample the parabola ½σ² across σ.
  let curveD = '';
  for (let p = SIGMA_MIN; p <= SIGMA_MAX; p += 2) {
    const d = p / 100;
    const corr = 0.5 * d * d;
    curveD += `${p === SIGMA_MIN ? 'M' : 'L'} ${cx2(p).toFixed(2)} ${cy(corr).toFixed(2)} `;
  }
  const dotX = cx2(animSigma);
  const dotY = cy(correction);

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
          {priceDriftLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {logDriftLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-4 rounded-sm"
            style={{ backgroundColor: 'var(--color-accent-500)', opacity: 0.18 }}
            aria-hidden="true"
          />
          {correctionLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`A chart with annual price drift μ fixed at ${muText} drawn as a flat reference line. The log-price drift μ − ½σ² sits below it; at volatility ${sigmaText} the gap between them — the Itô correction ½σ² — equals ${correctionText}, leaving a log-price drift of ${logDriftText}. The shaded wedge between the two lines widens as volatility increases.`}
      >
        {/* Rate gridlines and labels */}
        {gridRates.map((g, i) => {
          const gy = yToPx(g);
          return (
            <g key={`grid-${i}`}>
              <line
                x1={padLeft}
                y1={gy}
                x2={W - padRight}
                y2={gy}
                stroke="var(--color-ink-100)"
              />
              <text
                x={padLeft - 6}
                y={gy + 3}
                fontSize={10}
                fill="var(--color-ink-700)"
                textAnchor="end"
              >
                {`${(g * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* The Itô-correction wedge: shaded gap between μ and μ − ½σ² */}
        <rect
          x={xStart}
          y={muY}
          width={xEnd - xStart}
          height={Math.max(0, logY - muY)}
          fill="var(--color-accent-500)"
          fillOpacity={0.18}
        />

        {/* Price-drift μ line (flat reference, brand) */}
        <line
          x1={xStart}
          y1={muY}
          x2={xEnd}
          y2={muY}
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
        />
        <text
          x={xStart + 4}
          y={muY - 5}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-brand-600)"
        >
          {priceDriftLabel}
        </text>

        {/* Log-price-drift line (accent) */}
        <line
          x1={xStart}
          y1={logY}
          x2={xEnd}
          y2={logY}
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
        />
        <text
          x={xStart + 4}
          y={logY + 13}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-accent-600)"
        >
          {logDriftLabel}
        </text>

        {/* Correction annotation: a brace-ish marker + label on the right */}
        {logY - muY > 10 && (
          <g>
            <line
              x1={xEnd - 60}
              y1={muY}
              x2={xEnd - 60}
              y2={logY}
              stroke="var(--color-accent-600)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={xEnd - 56}
              y={(muY + logY) / 2 + 3}
              fontSize={10}
              fontWeight={600}
              fill="var(--color-accent-600)"
              textAnchor="start"
            >
              {correctionLabel}
            </text>
          </g>
        )}
      </svg>

      {/* Readout chips */}
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{volLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{sigmaText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{priceDriftLabel}</span>
          <span className="font-mono font-semibold text-brand-600">{muText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{correctionLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{correctionText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{logDriftLabel}</span>
          <span className="font-mono font-semibold text-accent-600">{logDriftText}</span>
        </span>
      </div>

      {/* Volatility slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-sigma`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{volLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {sigmaText}
          </span>
        </label>
        <input
          id={`${id}-sigma`}
          type="range"
          min={SIGMA_MIN}
          max={SIGMA_MAX}
          step={1}
          value={sigmaPct}
          onChange={(e) => setSigmaPct(Number(e.target.value))}
          aria-valuetext={`${sigmaText} annual volatility, Itô correction ${correctionText}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Companion: ½σ² grows quadratically with σ */}
      <svg
        viewBox={`0 0 ${cW} ${cH}`}
        className="mt-5 w-full"
        role="img"
        aria-label={`A companion curve showing the Itô correction ½σ² rising quadratically as volatility σ increases from 0 to ${SIGMA_MAX} percent. A dot marks the current ½σ² of ${correctionText} at σ = ${sigmaText}.`}
      >
        {/* Baseline (σ axis) */}
        <line
          x1={cPadLeft}
          y1={cH - cPadBottom}
          x2={cW - cPadRight}
          y2={cH - cPadBottom}
          stroke="var(--color-ink-200)"
        />
        {/* y-axis tick: ½σ² at σ_max */}
        <text
          x={cPadLeft - 6}
          y={cy(corrMax) + 3}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          {`${(corrMax * 100).toFixed(0)}%`}
        </text>
        <text
          x={cPadLeft - 6}
          y={cH - cPadBottom + 3}
          fontSize={10}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          0%
        </text>

        {/* Quadratic ½σ² curve */}
        <path
          d={curveD.trim()}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current-value marker */}
        <line
          x1={dotX}
          y1={cy(0)}
          x2={dotX}
          y2={dotY}
          stroke="var(--color-accent-500)"
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeOpacity={0.6}
        />
        <circle cx={dotX} cy={dotY} r={4} fill="var(--color-accent-500)" />

        {/* σ-axis labels */}
        <text
          x={cPadLeft}
          y={cH - 6}
          fontSize={11}
          fill="var(--color-ink-900)"
          textAnchor="start"
        >
          0%
        </text>
        <text
          x={cW - cPadRight}
          y={cH - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          {`${SIGMA_MAX}%`}
        </text>
        <text
          x={(cPadLeft + cW - cPadRight) / 2}
          y={cH - 6}
          fontSize={10}
          fill="var(--color-ink-600)"
          textAnchor="middle"
        >
          {correctionLabel}
        </text>
      </svg>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ItoCorrectionChart;
