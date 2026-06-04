import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TwoAssetFrontierProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the weight slider (weight in Asset A). */
  weightLabel?: string;
  /** Label for the X axis (volatility / risk). */
  riskLabel?: string;
  /** Label for the Y axis (expected return). */
  returnLabel?: string;
  /** Name of the higher-risk asset (plotted at w = 1). Defaults to `'Asset A'`. */
  assetALabel?: string;
  /** Name of the lower-risk asset (plotted at w = 0). Defaults to `'Asset B'`. */
  assetBLabel?: string;
  /** Label for the minimum-variance portfolio dot. */
  minVarLabel?: string;
  /** Asset A expected return, in percent. Defaults to `12`. */
  retA?: number;
  /** Asset B expected return, in percent. Defaults to `6`. */
  retB?: number;
  /** Asset A volatility, in percent. Defaults to `28`. */
  volA?: number;
  /** Asset B volatility, in percent. Defaults to `14`. */
  volB?: number;
  /** Correlation ρ between A and B. Defaults to `0.2`. */
  correlation?: number;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Interactive two-asset efficient-frontier explainer for Modern Portfolio
 * Theory. Mixing two assets does *not* trace a straight line in risk–return
 * space: expected return moves linearly with the weight, but volatility bows
 * *inward* whenever correlation < 1 (diversification), carving out a curved
 * "bullet". The leftmost tip of that bullet is the Minimum-Variance Portfolio
 * — the lowest-risk mix you can build from the pair — and the arc *above* it
 * is the efficient frontier (more return for the same risk than its mirror
 * below). The learner drags a weight slider from 100% B to 100% A and watches
 * a marker travel the curve, with the efficient upper arc drawn in a strong
 * brand color and the inefficient lower arc muted. Readouts spell out the
 * current weights, expected return and volatility. `prefers-reduced-motion`
 * snaps the marker instead of tweening. Locale-agnostic via props.
 *
 * Math (exact, weight w in A, 1−w in B):
 *   Er(w)    = w·retA + (1−w)·retB
 *   var(w)   = w²·volA² + (1−w)²·volB² + 2·w·(1−w)·ρ·volA·volB
 *   sigma(w) = √var(w)
 *   covAB    = ρ·volA·volB
 *   wmin     = (volB² − covAB) / (volA² + volB² − 2·covAB)   (clamped to [0,1])
 */
export function TwoAssetFrontier({
  title = 'Two assets trace a curved frontier',
  weightLabel = 'Weight in Asset A',
  riskLabel = 'Risk (volatility)',
  returnLabel = 'Expected return',
  assetALabel = 'Asset A',
  assetBLabel = 'Asset B',
  minVarLabel = 'Minimum-variance portfolio',
  retA = 12,
  retB = 6,
  volA = 28,
  volB = 14,
  correlation = 0.2,
  caption = 'Because the two assets are not perfectly correlated, mixing them bends the line inward — you get less risk than a straight average would suggest. The leftmost tip is the minimum-variance portfolio; only the arc above it is worth holding.',
  className,
}: TwoAssetFrontierProps) {
  const id = useId();
  // Weight in Asset A, 0..1.
  const [w, setW] = useState(0.5);
  // Animated weight the marker renders against.
  const [shownW, setShownW] = useState(0.5);
  const rafRef = useRef<number | null>(null);

  // --- Portfolio math --------------------------------------------------------
  const erAt = (weight: number): number => weight * retA + (1 - weight) * retB;
  const varAt = (weight: number): number =>
    weight * weight * volA * volA +
    (1 - weight) * (1 - weight) * volB * volB +
    2 * weight * (1 - weight) * correlation * volA * volB;
  const sigmaAt = (weight: number): number => Math.sqrt(Math.max(0, varAt(weight)));

  const covAB = correlation * volA * volB;
  const wminRaw = (volB * volB - covAB) / (volA * volA + volB * volB - 2 * covAB);
  const wmin = clamp01(Number.isFinite(wminRaw) ? wminRaw : 0.5);

  const er = erAt(w);
  const sigma = sigmaAt(w);

  // --- Chart geometry --------------------------------------------------------
  const W = 520;
  const H = 300;
  const padL = 48;
  const padR = 18;
  const padT = 18;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Axis ranges (with a little padding so dots aren't clipped).
  const N = 60;
  const samples = useMemo(() => {
    const pts: Array<{ w: number; sigma: number; er: number }> = [];
    for (let i = 0; i <= N; i++) {
      const ww = i / N;
      pts.push({ w: ww, sigma: sigmaAt(ww), er: erAt(ww) });
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retA, retB, volA, volB, correlation]);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    const sigmas = samples.map((p) => p.sigma);
    const ers = samples.map((p) => p.er);
    const sLo = Math.min(...sigmas);
    const sHi = Math.max(...sigmas);
    const rLo = Math.min(...ers);
    const rHi = Math.max(...ers);
    const sPad = Math.max(1, (sHi - sLo) * 0.12);
    const rPad = Math.max(0.5, (rHi - rLo) * 0.12);
    return {
      xMin: Math.max(0, sLo - sPad),
      xMax: sHi + sPad,
      yMin: rLo - rPad,
      yMax: rHi + rPad,
    };
  }, [samples]);

  const toPlotX = (s: number): number =>
    padL + ((s - xMin) / (xMax - xMin)) * plotW;
  const toPlotY = (r: number): number =>
    padT + plotH - ((r - yMin) / (yMax - yMin)) * plotH;

  // Split the curve at the minimum-variance weight into efficient (w >= wmin,
  // the upper arc) and inefficient (w <= wmin, the lower arc) halves.
  const { effPath, ineffPath } = useMemo(() => {
    const seg = (pred: (ww: number) => boolean): string => {
      const pts: string[] = [];
      let started = false;
      for (const p of samples) {
        if (!pred(p.w)) continue;
        const px = toPlotX(p.sigma);
        const py = toPlotY(p.er);
        pts.push(`${started ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`);
        started = true;
      }
      // Stitch the exact min-var point onto both halves so they meet cleanly.
      const mx = toPlotX(sigmaAt(wmin));
      const my = toPlotY(erAt(wmin));
      pts.push(`L${mx.toFixed(1)} ${my.toFixed(1)}`);
      return pts.join(' ');
    };
    return {
      effPath: seg((ww) => ww >= wmin),
      ineffPath: seg((ww) => ww <= wmin),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, wmin, xMin, xMax, yMin, yMax]);

  // --- Marker tween ----------------------------------------------------------
  useEffect(() => {
    const target = w;
    if (prefersReducedMotion()) {
      setShownW(target);
      return;
    }
    const start = shownW;
    const delta = target - start;
    if (Math.abs(delta) < 0.0005) {
      setShownW(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownW(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownW intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  const markerX = toPlotX(sigmaAt(shownW));
  const markerY = toPlotY(erAt(shownW));

  // --- Formatting ------------------------------------------------------------
  const pct = (v: number, digits = 1): string =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
  const pct0 = (v: number): string =>
    `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`;

  // Axis ticks.
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(xMin + (i / 4) * (xMax - xMin));
    return ticks;
  }, [xMin, xMax]);
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(yMin + (i / 4) * (yMax - yMin));
    return ticks;
  }, [yMin, yMax]);

  // Endpoint + min-var coordinates.
  const aX = toPlotX(sigmaAt(1));
  const aY = toPlotY(erAt(1));
  const bX = toPlotX(sigmaAt(0));
  const bY = toPlotY(erAt(0));
  const mX = toPlotX(sigmaAt(wmin));
  const mY = toPlotY(erAt(wmin));

  const ariaLabel = `${title}. ${weightLabel}: ${pct0(w * 100)} in ${assetALabel}, ${pct0(
    (1 - w) * 100,
  )} in ${assetBLabel}. ${returnLabel}: ${pct(er)}. ${riskLabel}: ${pct(
    sigma,
  )}. ${minVarLabel} at ${pct0(wmin * 100)} in ${assetALabel}.`;

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
          {pct(er)} · {pct(sigma)}
        </span>
      </figcaption>

      {/* Risk–return frontier */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot background */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          rx={6}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />

        {/* Y gridlines + tick labels */}
        {yTicks.map((t, i) => {
          const gy = toPlotY(t);
          return (
            <g key={`y-${i}`}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={gy + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {pct0(t)}
              </text>
            </g>
          );
        })}

        {/* X tick labels */}
        {xTicks.map((t, i) => {
          const gx = toPlotX(t);
          return (
            <text
              key={`x-${i}`}
              x={gx}
              y={padT + plotH + 14}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-ink-400)"
            >
              {pct0(t)}
            </text>
          );
        })}

        {/* Inefficient lower arc (muted) */}
        <path
          d={ineffPath}
          fill="none"
          stroke="var(--color-ink-300)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />

        {/* Efficient upper arc (strong brand) */}
        <path
          d={effPath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Endpoint asset B (w = 0) */}
        <circle cx={bX} cy={bY} r={5} fill="var(--color-ink-500)" />
        <text
          x={bX + 8}
          y={bY + 3}
          fontSize="10"
          fontWeight={600}
          fill="var(--color-ink-600)"
        >
          {assetBLabel}
        </text>

        {/* Endpoint asset A (w = 1) */}
        <circle cx={aX} cy={aY} r={5} fill="var(--color-brand-700)" />
        <text
          x={aX - 8}
          y={aY + 3}
          textAnchor="end"
          fontSize="10"
          fontWeight={600}
          fill="var(--color-brand-700)"
        >
          {assetALabel}
        </text>

        {/* Minimum-variance portfolio */}
        <circle cx={mX} cy={mY} r={5.5} fill="var(--color-success)" />
        <circle
          cx={mX}
          cy={mY}
          r={9}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={1.5}
          opacity={0.5}
        />
        <text
          x={mX + 10}
          y={mY + 3}
          fontSize="10"
          fontWeight={600}
          fill="var(--color-success)"
        >
          {minVarLabel}
        </text>

        {/* Current-portfolio marker */}
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

        {/* X axis title */}
        <text
          x={padL + plotW / 2}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {riskLabel}
        </text>

        {/* Y axis title */}
        <text
          x={12}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padT + plotH / 2})`}
        >
          {returnLabel}
        </text>
      </svg>

      {/* Weight slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-weight`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{weightLabel}</span>
          <span className="font-mono text-ink-900">
            {pct0(w * 100)} {assetALabel} · {pct0((1 - w) * 100)} {assetBLabel}
          </span>
        </label>
        <input
          id={`${id}-weight`}
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
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{weightLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct0(w * 100)} / {pct0((1 - w) * 100)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{returnLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(er)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(sigma)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default TwoAssetFrontier;
