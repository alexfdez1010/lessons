import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DiversificationDecayProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the holdings slider and the chart's X axis. Defaults to `'Number of holdings'`. */
  holdingsLabel?: string;
  /** Label for the portfolio-volatility readout and the curve's Y axis. Defaults to `'Portfolio volatility'`. */
  riskLabel?: string;
  /** Legend label for the undiversifiable floor region. Defaults to `'Systematic risk (undiversifiable floor)'`. */
  systematicLabel?: string;
  /** Legend label for the company-specific risk that diversification removes. Defaults to `'Diversifiable risk (company-specific)'`. */
  idiosyncraticLabel?: string;
  /** Volatility (in %) of a single stock, i.e. the curve's value at N=1. Defaults to `40`. */
  singleStockVol?: number;
  /** Volatility floor (in %) the portfolio decays toward as N→∞. Defaults to `20`. */
  systematicFloor?: number;
  /** Largest number of holdings the slider reaches. Defaults to `30`. */
  maxHoldings?: number;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Interactive Modern-Portfolio-Theory diversification explainer. As a learner
 * adds equally-weighted stocks to a portfolio, total volatility falls fast at
 * first then flattens onto a floor it can never cross. The drop is the
 * *diversifiable* (idiosyncratic, company-specific) risk; the floor is the
 * *systematic* (market) risk that no amount of diversification removes. The
 * learner drags a "number of holdings" slider (N) and watches the volatility
 * curve, with a marker tracking the current N that tweens as N changes.
 * Readouts spell out N, the portfolio volatility, and the diversifiable risk
 * still remaining (σ_p(N) − floor). `prefers-reduced-motion` snaps the marker
 * instead of tweening. Locale-agnostic via props.
 *
 * Math (exact, equally-weighted): for N holdings with single-stock vol `s`
 * and floor `f`,
 *   σ_p(N) = sqrt( s² / N + f² · (1 − 1/N) )
 * which equals `s` at N=1 and decays asymptotically toward `f` as N grows.
 * (Guard: if f > s, clamp f = s.)
 */
export function DiversificationDecay({
  title = 'Diversification: risk falls, then hits a floor',
  holdingsLabel = 'Number of holdings',
  riskLabel = 'Portfolio volatility',
  systematicLabel = 'Systematic risk (undiversifiable floor)',
  idiosyncraticLabel = 'Diversifiable risk (company-specific)',
  singleStockVol = 40,
  systematicFloor = 20,
  maxHoldings = 30,
  caption = 'Adding stocks cancels out company-specific surprises fast, but every stock still rides the whole market — so volatility falls steeply at first, then flattens onto a floor you can never diversify below.',
  className,
}: DiversificationDecayProps) {
  const id = useId();

  // Single-stock vol; floor clamped so it can never exceed it.
  const s = singleStockVol;
  const f = Math.min(systematicFloor, singleStockVol);

  const [n, setN] = useState(1);
  // Animated N the marker renders against.
  const [shownN, setShownN] = useState(1);
  const rafRef = useRef<number | null>(null);

  /** Equally-weighted portfolio volatility at N holdings. */
  const volAt = (count: number): number => {
    const N = Math.max(1, count);
    return Math.sqrt((s * s) / N + f * f * (1 - 1 / N));
  };

  const vol = volAt(n);
  const diversifiableRemaining = vol - f;

  // Chart geometry.
  const W = 520;
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Y axis runs 0 → a sensible round max above the single-stock vol.
  const axisMax = Math.max(Math.ceil(singleStockVol / 10) * 10, 10);

  const toPlotX = (count: number): number =>
    padL + ((count - 1) / Math.max(1, maxHoldings - 1)) * plotW;
  const toPlotY = (v: number): number => padT + plotH - (v / axisMax) * plotH;

  const floorY = toPlotY(f);
  const baseY = padT + plotH;

  // Build the volatility curve path (sampled at every integer N).
  const curvePath = useMemo(() => {
    const pts: string[] = [];
    for (let count = 1; count <= maxHoldings; count++) {
      const px = toPlotX(count);
      const py = toPlotY(volAt(count));
      pts.push(`${count === 1 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    return pts.join(' ');
    // volAt closes over s/f/axisMax; recompute when those or maxHoldings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, f, maxHoldings, axisMax]);

  // Filled band between the curve and the floor = diversifiable risk.
  const diversifiableArea = useMemo(() => {
    const top: string[] = [];
    for (let count = 1; count <= maxHoldings; count++) {
      const px = toPlotX(count);
      const py = toPlotY(volAt(count));
      top.push(`${count === 1 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    // Walk back along the floor line to close the band.
    return `${top.join(' ')} L${toPlotX(maxHoldings).toFixed(1)} ${floorY.toFixed(
      1,
    )} L${toPlotX(1).toFixed(1)} ${floorY.toFixed(1)} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, f, maxHoldings, axisMax]);

  // Animate the marker toward the new N whenever it changes.
  useEffect(() => {
    const target = n;
    if (prefersReducedMotion()) {
      setShownN(target);
      return;
    }
    const start = shownN;
    const delta = target - start;
    if (Math.abs(delta) < 0.01) {
      setShownN(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownN(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownN intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const markerX = toPlotX(shownN);
  const markerY = toPlotY(volAt(shownN));

  const pct = (v: number, digits = 1): string =>
    `${v.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}%`;

  // Y-axis gridlines / ticks.
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = axisMax / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [axisMax]);

  const ariaLabel = `${title}. ${holdingsLabel}: ${n}. ${riskLabel}: ${pct(
    vol,
  )}. ${idiosyncraticLabel}: ${pct(diversifiableRemaining)} remaining above the ${pct(
    f,
  )} ${systematicLabel}.`;

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
          {pct(vol)}
        </span>
      </figcaption>

      {/* Volatility-decay curve */}
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

        {/* Systematic-risk region: everything below the floor line. */}
        <rect
          x={padL}
          y={floorY}
          width={plotW}
          height={baseY - floorY}
          fill="var(--color-brand-600)"
          opacity={0.12}
        />

        {/* Diversifiable-risk band: between the curve and the floor. */}
        <path d={diversifiableArea} fill="var(--color-accent-500)" opacity={0.16} />

        {/* Floor (systematic-risk) dashed line */}
        <line
          x1={padL}
          y1={floorY}
          x2={W - padR}
          y2={floorY}
          stroke="var(--color-brand-600)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.85}
        />
        <text
          x={W - padR}
          y={floorY - 4}
          textAnchor="end"
          fontSize="10"
          fontWeight={600}
          fill="var(--color-brand-700)"
        >
          {`${systematicLabel} ${pct(f, f % 1 === 0 ? 0 : 1)}`}
        </text>

        {/* The volatility curve */}
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
          y2={baseY}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.7}
        />

        {/* Current-holdings marker */}
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
        <text x={padL} y={H - 8} fontSize="10" fill="var(--color-ink-400)">
          1
        </text>
        <text
          x={padL + plotW / 2}
          y={H - 8}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {holdingsLabel}
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
          {maxHoldings}
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
          {riskLabel}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ background: 'var(--color-accent-500)', opacity: 0.4 }}
            aria-hidden="true"
          />
          {idiosyncraticLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ background: 'var(--color-brand-600)', opacity: 0.4 }}
            aria-hidden="true"
          />
          {systematicLabel}
        </span>
      </div>

      {/* Holdings slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-holdings`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{holdingsLabel}</span>
          <span className="font-mono text-ink-900">{n}</span>
        </label>
        <input
          id={`${id}-holdings`}
          type="range"
          min={1}
          max={maxHoldings}
          step={1}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-label={holdingsLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{holdingsLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{n}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{riskLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(vol)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{idiosyncraticLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {pct(diversifiableRemaining)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DiversificationDecay;
