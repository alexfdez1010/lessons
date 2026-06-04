import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CapitalMarketLineProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the X axis (volatility). Defaults to `'Risk (volatility)'`. */
  riskLabel?: string;
  /** Label for the Y axis (expected return). Defaults to `'Expected return'`. */
  returnLabel?: string;
  /** Label for the allocation slider (fraction in the market portfolio). Defaults to `'Allocation to the market portfolio'`. */
  allocationLabel?: string;
  /** Label for the straight Capital Market Line. Defaults to `'Capital Market Line'`. */
  cmlLabel?: string;
  /** Label for the curved risky-only efficient frontier. Defaults to `'Efficient frontier (risky only)'`. */
  frontierLabel?: string;
  /** Label for the risk-free point on the Y axis. Defaults to `'Risk-free asset'`. */
  riskFreeLabel?: string;
  /** Label for the market / tangency portfolio dot. Defaults to `'Market (tangency) portfolio'`. */
  marketLabel?: string;
  /** Label for the Sharpe-ratio (slope) readout. Defaults to `'Sharpe ratio (slope)'`. */
  sharpeLabel?: string;
  /** Regime label when m < 1 (some money in the risk-free asset). Defaults to `'Lending'`. */
  lendingLabel?: string;
  /** Regime label when m > 1 (leveraged via borrowing). Defaults to `'Borrowing (leverage)'`. */
  borrowingLabel?: string;
  /** Risk-free return, in percent. Defaults to `3`. */
  riskFree?: number;
  /** Tangency portfolio expected return, in percent. Defaults to `10`. */
  marketReturn?: number;
  /** Tangency portfolio volatility, in percent. Defaults to `16`. */
  marketVol?: number;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MAX_M = 1.6;
const MIN_M = 0;

/**
 * Interactive explainer for the Capital Market Line (CML) from Modern Portfolio
 * Theory. Once a risk-free asset exists, the best risky bundle to hold is the
 * single TANGENCY (market) portfolio — the point where a straight line drawn
 * from the risk-free rate just kisses the curved efficient frontier. Every mix
 * of "risk-free + market portfolio" lies on that straight line, the CML, which
 * sits ABOVE the old curved frontier everywhere except at the tangency point,
 * so it dominates the risky-only frontier. The line's slope is the market's
 * Sharpe ratio. The learner drags an allocation slider `m` (fraction in the
 * market portfolio): m < 1 means LENDING (parking some money risk-free, left of
 * tangency); m > 1 means BORROWING / leverage (right of tangency, holding more
 * than 100% market). A marker tweens along the CML to the chosen mix, and
 * readouts spell out the split, the portfolio's expected return and volatility,
 * and the Sharpe ratio. `prefers-reduced-motion` snaps the marker instead of
 * tweening. Locale-agnostic via props.
 *
 * Math:
 *   sharpe        = (marketReturn − riskFree) / marketVol
 *   CML:  Er(σ)   = riskFree + sharpe · σ
 *   portfolio with fraction m in the market (1−m risk-free):
 *     σ_p         = m · marketVol
 *     Er_p        = riskFree + m · (marketReturn − riskFree)   (lies on the CML)
 *   risky-only frontier (visual hyperbola, tangent near the market point):
 *     σ(Er)       = sqrt( a·(Er − Er0)² + sMin² )
 *     with Er0 = riskFree + (marketReturn − riskFree)·0.45, sMin = marketVol·0.7.
 */
export function CapitalMarketLine({
  title = 'The Capital Market Line',
  riskLabel = 'Risk (volatility)',
  returnLabel = 'Expected return',
  allocationLabel = 'Allocation to the market portfolio',
  cmlLabel = 'Capital Market Line',
  frontierLabel = 'Efficient frontier (risky only)',
  riskFreeLabel = 'Risk-free asset',
  marketLabel = 'Market (tangency) portfolio',
  sharpeLabel = 'Sharpe ratio (slope)',
  lendingLabel = 'Lending',
  borrowingLabel = 'Borrowing (leverage)',
  riskFree = 3,
  marketReturn = 10,
  marketVol = 16,
  caption = 'Add a risk-free asset and the curved frontier loses: every good portfolio is now a straight-line blend of the risk-free asset and the one tangency (market) portfolio. Left of the market dot you lend; right of it you borrow to lever up — and the line’s slope is the market’s Sharpe ratio.',
  className,
}: CapitalMarketLineProps) {
  const id = useId();
  // Allocation to the market portfolio (fraction). m=1 → exactly the market.
  const [m, setM] = useState(0.6);
  // Animated allocation the marker renders against.
  const [shownM, setShownM] = useState(0.6);
  const shownMRef = useRef(0.6);
  const rafRef = useRef<number | null>(null);

  const updateShownM = (v: number) => {
    shownMRef.current = v;
    setShownM(v);
  };

  const sharpe = (marketReturn - riskFree) / marketVol;

  // Portfolio at the *set* allocation (used for readouts).
  const sigmaP = m * marketVol;
  const erP = riskFree + m * (marketReturn - riskFree);
  const isBorrowing = m > 1.0000001;

  // Risky-only frontier (visual hyperbola tangent near the market point).
  const er0 = riskFree + (marketReturn - riskFree) * 0.45;
  const sMin = marketVol * 0.7;
  // Pick `a` so the curve passes through the market point (marketVol, marketReturn).
  const a = useMemo(() => {
    const dEr = marketReturn - er0;
    if (dEr === 0) return 0;
    return (marketVol * marketVol - sMin * sMin) / (dEr * dEr);
  }, [marketReturn, er0, marketVol, sMin]);
  const frontierSigma = (er: number): number =>
    Math.sqrt(Math.max(0, a * (er - er0) * (er - er0) + sMin * sMin));

  // Chart geometry.
  const W = 520;
  const H = 300;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 38;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Axis maxima: cover the whole CML out to MAX_M with a little headroom.
  const maxSigma = useMemo(() => {
    const m1 = MAX_M * marketVol;
    return Math.ceil((m1 * 1.05) / 4) * 4 || 4;
  }, [marketVol]);
  const maxReturn = useMemo(() => {
    const r1 = riskFree + MAX_M * (marketReturn - riskFree);
    return Math.ceil((r1 * 1.05) / 4) * 4 || 4;
  }, [riskFree, marketReturn]);

  const toPlotX = (sigma: number): number => padL + (sigma / maxSigma) * plotW;
  const toPlotY = (er: number): number => padT + plotH - (er / maxReturn) * plotH;

  // Risky-only frontier path (curved). Sweep over expected return, draw the
  // upper (efficient) branch from the global min-variance point upward.
  const frontierPath = useMemo(() => {
    const pts: string[] = [];
    const n = 60;
    const erLo = er0; // min-variance point sits at er0
    const erHi = maxReturn;
    for (let i = 0; i <= n; i++) {
      const er = erLo + (i / n) * (erHi - erLo);
      const sig = frontierSigma(er);
      if (sig > maxSigma) break;
      const px = toPlotX(sig);
      const py = toPlotY(er);
      pts.push(`${pts.length === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    return pts.join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, er0, sMin, maxSigma, maxReturn]);

  // CML endpoints. Split at the tangency (market) point into lending vs borrowing.
  const rfX = toPlotX(0);
  const rfY = toPlotY(riskFree);
  const mktX = toPlotX(marketVol);
  const mktY = toPlotY(marketReturn);
  // Far end at MAX_M.
  const endSigma = MAX_M * marketVol;
  const endEr = riskFree + MAX_M * (marketReturn - riskFree);
  const endX = toPlotX(endSigma);
  const endY = toPlotY(endEr);

  // Animate the marker toward the new allocation whenever it changes.
  useEffect(() => {
    const target = m;
    if (prefersReducedMotion()) {
      updateShownM(target);
      return;
    }
    const begin = shownMRef.current;
    const delta = target - begin;
    if (Math.abs(delta) < 0.001) {
      updateShownM(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      updateShownM(begin + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownM intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m]);

  const markerSigma = shownM * marketVol;
  const markerEr = riskFree + shownM * (marketReturn - riskFree);
  const markerX = toPlotX(markerSigma);
  const markerY = toPlotY(markerEr);
  const markerColor = isBorrowing ? 'var(--color-warning)' : 'var(--color-brand-600)';
  const regimeLabel = isBorrowing ? borrowingLabel : lendingLabel;

  const pct = (v: number, digits = 1): string =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
  const num = (v: number, digits = 2): string =>
    v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  // Split of capital.
  const marketPctText = pct(m * 100, 0);
  const riskFreePct = (1 - m) * 100;
  const riskFreeText = isBorrowing
    ? `${borrowingLabel} ${pct(Math.abs(riskFreePct), 0)}`
    : pct(riskFreePct, 0);

  // Axis ticks.
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = maxSigma / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [maxSigma]);
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = maxReturn / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [maxReturn]);

  const ariaLabel = `${title}. ${allocationLabel}: ${marketPctText} in the market portfolio (${regimeLabel}). ${returnLabel}: ${pct(
    erP,
  )}. ${riskLabel}: ${pct(sigmaP)}. ${sharpeLabel}: ${num(sharpe)}. The ${cmlLabel} is the straight line from the ${riskFreeLabel} through the ${marketLabel}, sitting above the ${frontierLabel}.`;

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
            isBorrowing ? 'bg-warning' : 'bg-brand-600',
          )}
        >
          {regimeLabel}
        </span>
      </figcaption>

      {/* CML vs frontier chart */}
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
        {yTicks.map((t) => {
          const gy = toPlotY(t);
          return (
            <g key={`y-${t}`}>
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
                {`${t.toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* X gridlines + tick labels */}
        {xTicks.map((t) => {
          const gx = toPlotX(t);
          return (
            <g key={`x-${t}`}>
              <line
                x1={gx}
                y1={padT}
                x2={gx}
                y2={padT + plotH}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={gx}
                y={padT + plotH + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {`${t.toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* Risky-only efficient frontier (muted, curved) */}
        <path
          d={frontierPath}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />

        {/* CML — lending segment (risk-free → market), strong brand */}
        <line
          x1={rfX}
          y1={rfY}
          x2={mktX}
          y2={mktY}
          stroke="var(--color-brand-600)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* CML — borrowing segment (market → leveraged end), accent */}
        <line
          x1={mktX}
          y1={mktY}
          x2={endX}
          y2={endY}
          stroke="var(--color-accent-500)"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Risk-free dot on the Y axis */}
        <circle cx={rfX} cy={rfY} r={5} fill="var(--color-success)" />
        <text
          x={rfX + 8}
          y={rfY + 3}
          fontSize="10"
          fontWeight={600}
          fill="var(--color-success)"
        >
          {riskFreeLabel}
        </text>

        {/* Market / tangency dot */}
        <circle cx={mktX} cy={mktY} r={6} fill="var(--color-accent-500)" />
        <circle
          cx={mktX}
          cy={mktY}
          r={9}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          opacity={0.5}
        />
        <text
          x={mktX}
          y={mktY - 14}
          textAnchor="middle"
          fontSize="10"
          fontWeight={600}
          fill="var(--color-accent-600)"
        >
          {marketLabel}
        </text>

        {/* Drop line from current marker to X axis */}
        <line
          x1={markerX}
          y1={markerY}
          x2={markerX}
          y2={padT + plotH}
          stroke={markerColor}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.7}
        />

        {/* Current-allocation marker */}
        <circle cx={markerX} cy={markerY} r={6} fill={markerColor} />
        <circle
          cx={markerX}
          cy={markerY}
          r={9}
          fill="none"
          stroke={markerColor}
          strokeWidth={1.5}
          opacity={0.5}
        />

        {/* X axis title */}
        <text
          x={padL + plotW / 2}
          y={H - 6}
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

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-brand-600" />
          {cmlLabel} · {lendingLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-accent-500" />
          {borrowingLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-ink-400" />
          {frontierLabel}
        </span>
      </div>

      {/* Allocation slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-alloc`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{allocationLabel}</span>
          <span className="font-mono text-ink-900">{marketPctText}</span>
        </label>
        <input
          id={`${id}-alloc`}
          type="range"
          min={MIN_M}
          max={MAX_M}
          step={0.05}
          value={m}
          onChange={(e) => setM(Number(e.target.value))}
          aria-label={allocationLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{marketLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{marketPctText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskFreeLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              isBorrowing ? 'text-warning' : 'text-ink-900',
            )}
          >
            {riskFreeText}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{returnLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(erP)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{pct(sigmaP)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{sharpeLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{num(sharpe)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{allocationLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              isBorrowing ? 'text-warning' : 'text-brand-700',
            )}
          >
            {regimeLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CapitalMarketLine;
