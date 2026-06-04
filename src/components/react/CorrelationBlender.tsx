import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CorrelationBlenderProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the correlation (ρ) slider. Defaults to `'Correlation (ρ)'`. */
  correlationLabel?: string;
  /** Label for the weight-in-Asset-A slider. Defaults to `'Weight in Asset A'`. */
  weightLabel?: string;
  /** Label for the portfolio-volatility readout. Defaults to `'Portfolio volatility'`. */
  portfolioVolLabel?: string;
  /** Label for the naive weighted-average readout (the ρ=+1 benchmark). Defaults to `'Naive weighted average (no diversification)'`. */
  weightedAvgLabel?: string;
  /** Label for the diversification-benefit readout. Defaults to `'Diversification benefit'`. */
  benefitLabel?: string;
  /** Name of the first risky asset. Defaults to `'Asset A'`. */
  assetALabel?: string;
  /** Name of the second risky asset. Defaults to `'Asset B'`. */
  assetBLabel?: string;
  /** Volatility of Asset A, in percent. Defaults to `30`. */
  volA?: number;
  /** Volatility of Asset B, in percent. Defaults to `20`. */
  volB?: number;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (v: number, digits = 1): string =>
  `${v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

/**
 * Interactive Modern-Portfolio-Theory explainer for how *correlation* blends
 * two risky assets' volatilities. Mixing weight `w` of Asset A (and `1−w` of
 * Asset B), the intuitive guess for the blend's risk is the weighted average
 * of the two volatilities — but that's only true at ρ=+1. For every ρ < 1 the
 * real portfolio volatility sits *below* that benchmark, and the gap (the
 * "diversification benefit") grows as ρ falls toward −1, where a hedged mix can
 * approach near-zero volatility. The learner drags ρ (−1…+1) and the weight
 * (0…1) and watches a solid brand bar (true σ_p) shrink away from a faint
 * reference tick (the naive weighted average), with the green benefit gap
 * opening up. A small σ_p-vs-ρ curve (at the current weight) carries a marker
 * that tweens to the current ρ. `prefers-reduced-motion` snaps instead of
 * tweening. Locale-agnostic via props.
 *
 * Math (exact):
 *   σ_p          = sqrt(w²·volA² + (1−w)²·volB² + 2·w·(1−w)·ρ·volA·volB)
 *   weightedAvg  = w·volA + (1−w)·volB        (the ρ=+1 benchmark)
 *   benefit      = weightedAvg − σ_p          (always ≥ 0)
 */
export function CorrelationBlender({
  title = 'How correlation blends two volatilities',
  correlationLabel = 'Correlation (ρ)',
  weightLabel = 'Weight in Asset A',
  portfolioVolLabel = 'Portfolio volatility',
  weightedAvgLabel = 'Naive weighted average (no diversification)',
  benefitLabel = 'Diversification benefit',
  assetALabel = 'Asset A',
  assetBLabel = 'Asset B',
  volA = 30,
  volB = 20,
  caption = 'The naive guess for a blend’s risk is the weighted average of its parts. But whenever the two assets aren’t perfectly correlated (ρ < 1), the real portfolio volatility drops below that line — and the closer ρ gets to −1, the more risk simply cancels out.',
  className,
}: CorrelationBlenderProps) {
  const id = useId();
  const [rho, setRho] = useState(0.2);
  const [w, setW] = useState(0.5);
  // Animated rho the curve marker renders against.
  const [shownRho, setShownRho] = useState(0.2);
  const rafRef = useRef<number | null>(null);

  /** Portfolio volatility for weight `ww` in A and correlation `r`. */
  const sigmaP = (ww: number, r: number): number =>
    Math.sqrt(
      ww * ww * volA * volA +
        (1 - ww) * (1 - ww) * volB * volB +
        2 * ww * (1 - ww) * r * volA * volB,
    );

  const weightedAvg = w * volA + (1 - w) * volB;
  const portfolioVol = sigmaP(w, rho);
  const benefit = Math.max(0, weightedAvg - portfolioVol);

  // Bar/axis range: 0 .. max single-asset vol, padded.
  const axisMax = useMemo(() => {
    const top = Math.max(volA, volB);
    return Math.ceil((top * 1.05) / 5) * 5 || 5;
  }, [volA, volB]);

  // ----- Bar chart geometry (the main visual) -----
  const W = 520;
  const H = 150;
  const padL = 110;
  const padR = 24;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const barAvgY = padT + 6;
  const barAvgH = 22;
  const barVolY = padT + 48;
  const barVolH = 22;

  const toBarW = (v: number): number => (v / axisMax) * plotW;
  const avgW = toBarW(weightedAvg);
  const volW = toBarW(portfolioVol);

  // ----- σ_p-vs-ρ curve geometry -----
  const cW = 520;
  const cH = 190;
  const cPadL = 44;
  const cPadR = 16;
  const cPadT = 14;
  const cPadB = 34;
  const cPlotW = cW - cPadL - cPadR;
  const cPlotH = cH - cPadT - cPadB;

  const toPlotX = (r: number): number => cPadL + ((r + 1) / 2) * cPlotW;
  const toPlotY = (v: number): number => cPadT + cPlotH - (v / axisMax) * cPlotH;

  // σ_p vs ρ at the current weight.
  const curvePath = useMemo(() => {
    const pts: string[] = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const r = -1 + (i / n) * 2;
      const px = toPlotX(r);
      const py = toPlotY(sigmaP(w, r));
      pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    return pts.join(' ');
    // sigmaP closes over volA/volB; w changes the whole curve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, axisMax, volA, volB]);

  // Tween the curve marker toward the new rho.
  useEffect(() => {
    const target = rho;
    if (prefersReducedMotion()) {
      setShownRho(target);
      return;
    }
    const start = shownRho;
    const delta = target - start;
    if (Math.abs(delta) < 0.002) {
      setShownRho(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownRho(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownRho omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rho]);

  const markerX = toPlotX(shownRho);
  const markerY = toPlotY(sigmaP(w, shownRho));

  // Curve axis ticks.
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = axisMax / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [axisMax]);

  const ariaLabel = `${title}. ${weightLabel}: ${pct(w * 100, 0)}. ${correlationLabel}: ${rho.toFixed(
    2,
  )}. ${portfolioVolLabel}: ${pct(portfolioVol)}. ${weightedAvgLabel}: ${pct(
    weightedAvg,
  )}. ${benefitLabel}: ${pct(benefit)}.`;

  const hasBenefit = benefit > 0.05;

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            hasBenefit ? 'bg-success' : 'bg-brand-600',
          )}
        >
          {pct(portfolioVol)}
        </span>
      </figcaption>

      {/* Main visual: weighted-average reference vs. true portfolio vol */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Track for the naive weighted-average bar */}
        <rect
          x={padL}
          y={barAvgY}
          width={plotW}
          height={barAvgH}
          rx={5}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />
        {/* Naive weighted-average (faint reference) bar */}
        <rect
          x={padL}
          y={barAvgY}
          width={Math.max(0, avgW)}
          height={barAvgH}
          rx={5}
          fill="var(--color-ink-400)"
          opacity={0.35}
        />
        {/* Reference tick at the weighted-average level */}
        <line
          x1={padL + avgW}
          y1={barAvgY - 4}
          x2={padL + avgW}
          y2={barVolY + barVolH + 4}
          stroke="var(--color-ink-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <text
          x={padL - 8}
          y={barAvgY + barAvgH / 2 + 3}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {weightedAvgLabel.split(' (')[0]}
        </text>

        {/* Track for the true portfolio-vol bar */}
        <rect
          x={padL}
          y={barVolY}
          width={plotW}
          height={barVolH}
          rx={5}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />
        {/* True portfolio-volatility (solid brand) bar */}
        <rect
          x={padL}
          y={barVolY}
          width={Math.max(0, volW)}
          height={barVolH}
          rx={5}
          fill="var(--color-brand-600)"
        />
        <text
          x={padL - 8}
          y={barVolY + barVolH / 2 + 3}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {portfolioVolLabel}
        </text>

        {/* Diversification-benefit gap, drawn in success color */}
        {hasBenefit && (
          <g>
            <rect
              x={padL + volW}
              y={barVolY}
              width={Math.max(0, avgW - volW)}
              height={barVolH}
              rx={3}
              fill="var(--color-success)"
              opacity={0.18}
            />
            <text
              x={padL + (volW + avgW) / 2}
              y={barVolY + barVolH + 16}
              textAnchor="middle"
              fontSize="10"
              fontWeight={600}
              fill="var(--color-success)"
            >
              {`${benefitLabel}: ${pct(benefit)}`}
            </text>
          </g>
        )}
      </svg>

      {/* σ_p vs ρ curve */}
      <svg
        viewBox={`0 0 ${cW} ${cH}`}
        className="mt-2 w-full"
        role="img"
        aria-label={`${portfolioVolLabel} vs ${correlationLabel}`}
      >
        {/* Plot background */}
        <rect
          x={cPadL}
          y={cPadT}
          width={cPlotW}
          height={cPlotH}
          rx={6}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />

        {/* Y gridlines + tick labels */}
        {yTicks.map((t) => {
          const gy = toPlotY(t);
          return (
            <g key={`y-${t}`}>
              <line
                x1={cPadL}
                y1={gy}
                x2={cW - cPadR}
                y2={gy}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={cPadL - 6}
                y={gy + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {`${t.toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* The σ_p curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Drop line from marker to X axis */}
        <line
          x1={markerX}
          y1={markerY}
          x2={markerX}
          y2={cPadT + cPlotH}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.7}
        />

        {/* Current-ρ marker */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-accent-500)" />
        <circle
          cx={markerX}
          cy={markerY}
          r={9}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          opacity={0.5}
        />

        {/* X axis labels */}
        <text x={cPadL} y={cH - 8} fontSize="10" fill="var(--color-ink-400)">
          {'−1'}
        </text>
        <text
          x={cPadL + cPlotW / 2}
          y={cH - 8}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {correlationLabel}
        </text>
        <text x={cW - cPadR} y={cH - 8} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
          +1
        </text>

        {/* Y axis title */}
        <text
          x={12}
          y={cPadT + cPlotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${cPadT + cPlotH / 2})`}
        >
          {portfolioVolLabel}
        </text>
      </svg>

      {/* Correlation slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-rho`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{correlationLabel}</span>
          <span className="font-mono text-ink-900">{rho.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-rho`}
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={rho}
          onChange={(e) => setRho(Number(e.target.value))}
          aria-label={correlationLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Weight slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-w`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{weightLabel}</span>
          <span className="font-mono text-ink-900">
            {pct(w * 100, 0)} {assetALabel} · {pct((1 - w) * 100, 0)} {assetBLabel}
          </span>
        </label>
        <input
          id={`${id}-w`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={w}
          onChange={(e) => setW(Number(e.target.value))}
          aria-label={weightLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{portfolioVolLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(portfolioVol)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{weightedAvgLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(weightedAvg)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{benefitLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              hasBenefit ? 'text-success' : 'text-ink-900',
            )}
          >
            {pct(benefit)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CorrelationBlender;
