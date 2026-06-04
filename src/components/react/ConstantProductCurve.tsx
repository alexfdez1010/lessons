import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ConstantProductCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Axis / readout label for the X token reserve (horizontal axis). */
  xLabel?: string;
  /** Axis / readout label for the Y token reserve (vertical axis). */
  yLabel?: string;
  /** Starting reserve of token X. Defaults to `100`. */
  initialX?: number;
  /** Starting reserve of token Y. Defaults to `200000` (price starts at 2000). */
  initialY?: number;
  /** Label for the "amount of X sold into the pool" readout. */
  sellLabel?: string;
  /** Label for the "amount of Y received out" readout. */
  receiveLabel?: string;
  /** Label for the old spot-price readout. */
  oldPriceLabel?: string;
  /** Label for the new spot-price readout. */
  newPriceLabel?: string;
  /** Label for the constant-product (k) readout. Defaults to `'Constant product k'`. */
  invariantLabel?: string;
  /** Label for the trade-size slider. */
  sliderLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Largest fraction of the current X reserve the trader may sell. Defaults to `0.9`. */
  maxSellFraction?: number;
  /** Slider step as a fraction of the current X reserve. Defaults to `0.01`. */
  step?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Compact number formatting with thousands separators and adaptive precision. */
const fmt = (value: number, digits = 2): string => {
  const abs = Math.abs(value);
  const d = abs >= 1000 ? 0 : abs >= 1 ? digits : 4;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

/**
 * Interactive constant-product AMM explainer. A liquidity pool holds two token
 * reserves x and y; their product k = x·y is held constant by every swap, so the
 * pool state always lives on the hyperbola y = k/x. The spot price of x in terms
 * of y is price = y / x. The learner drags a slider to choose how much of token X
 * to sell into the pool (Δx); the pool then pays out Δy = y − k/(x+Δx) of token Y,
 * and the pool point slides ALONG the curve from (x, y) to (x', y'). Readouts show
 * the amount in, amount out, the old vs. new spot price, and that k is unchanged.
 * The pool point tweens along the curve (ease-out cubic) when the slider changes;
 * `prefers-reduced-motion` snaps instead. Locale-agnostic via props.
 */
export function ConstantProductCurve({
  title = 'Constant product: x · y = k',
  xLabel = 'ETH reserve (x)',
  yLabel = 'USDC reserve (y)',
  initialX = 100,
  initialY = 200000,
  sellLabel = 'X sold in',
  receiveLabel = 'Y received out',
  oldPriceLabel = 'Old spot price',
  newPriceLabel = 'New spot price',
  invariantLabel = 'Constant product k',
  sliderLabel = 'X sold into the pool',
  caption =
    'A swap walks the pool along the curve x · y = k. The bigger your single trade, the steeper the curve gets ahead of you — so each extra unit of X buys less Y, and your average price gets worse. That worsening is slippage.',
  maxSellFraction = 0.9,
  step = 0.01,
  className,
}: ConstantProductCurveProps) {
  const id = useId();

  const x0 = initialX;
  const y0 = initialY;
  const k = x0 * y0;
  const oldPrice = y0 / x0;
  const maxSell = x0 * maxSellFraction;
  const sliderStep = Math.max(x0 * step, 1e-9);

  // Δx the trader sells into the pool.
  const [deltaX, setDeltaX] = useState(0);
  // Animated Δx the pool point renders against.
  const [shownDeltaX, setShownDeltaX] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Resulting pool state after selling deltaX of X (live readout values).
  const xNew = x0 + deltaX;
  const yNew = k / xNew;
  const deltaYOut = y0 - yNew;
  const newPrice = yNew / xNew;
  const kAfter = xNew * yNew; // identical to k by construction.

  // Animate the pool point along the curve when the target Δx changes.
  useEffect(() => {
    const target = deltaX;
    if (prefersReducedMotion()) {
      setShownDeltaX(target);
      return;
    }
    const start = shownDeltaX;
    const delta = target - start;
    if (Math.abs(delta) < maxSell * 0.001) {
      setShownDeltaX(target);
      return;
    }
    const duration = 420;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownDeltaX(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownDeltaX intentionally omitted: re-running each frame would restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deltaX]);

  // --- Geometry --------------------------------------------------------------
  const W = 520;
  const H = 320;
  const padL = 48;
  const padR = 20;
  const padT = 18;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Domain: show enough of the curve around the active range.
  // x spans from a little below x0 up to x0 + maxSell (with headroom).
  const xMin = x0 * 0.45;
  const xMax = (x0 + maxSell) * 1.08;
  // y spans from the lowest reachable reserve up to a bit above y0.
  const yMin = (k / xMax) * 0.9;
  const yMax = (k / xMin) * 1.02;

  const toPx = (xv: number): number =>
    padL + ((xv - xMin) / (xMax - xMin)) * plotW;
  const toPy = (yv: number): number =>
    padT + (1 - (yv - yMin) / (yMax - yMin)) * plotH;

  // Sample the hyperbola y = k/x across the domain for the path.
  const curvePath = useMemo(() => {
    const samples = 80;
    let d = '';
    for (let i = 0; i <= samples; i += 1) {
      const xv = xMin + ((xMax - xMin) * i) / samples;
      const yv = k / xv;
      const px = toPx(xv);
      const py = toPy(yv);
      d += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)} `;
    }
    return d.trim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, xMin, xMax, yMin, yMax]);

  // Animated point position.
  const shownXNew = x0 + shownDeltaX;
  const shownYNew = k / shownXNew;
  const startPx = toPx(x0);
  const startPy = toPy(y0);
  const curPx = toPx(shownXNew);
  const curPy = toPy(shownYNew);

  const hasTrade = deltaX > maxSell * 0.001;

  // Built only from localized props so screen readers get the active locale.
  const ariaLabel =
    `${title}. ${invariantLabel}: ${fmt(k)}. ${xLabel}: ${fmt(xNew)}. ` +
    `${yLabel}: ${fmt(yNew)}. ${sellLabel}: ${fmt(deltaX)}. ` +
    `${receiveLabel}: ${fmt(deltaYOut)}. ${oldPriceLabel}: ${fmt(oldPrice)}. ` +
    `${newPriceLabel}: ${fmt(newPrice)}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 font-mono text-sm font-medium text-white">
          x · y = {fmt(k)}
        </span>
      </figcaption>

      {/* Curve */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot frame */}
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + plotH}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={padT + plotH}
          x2={padL + plotW}
          y2={padT + plotH}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />

        {/* Axis labels */}
        <text
          x={padL + plotW}
          y={H - 8}
          textAnchor="end"
          fontSize="11"
          fontWeight={600}
          fill="var(--color-ink-500)"
        >
          {xLabel}
        </text>
        <text
          x={padL - 6}
          y={padT + 4}
          textAnchor="start"
          fontSize="11"
          fontWeight={600}
          fill="var(--color-ink-500)"
          transform={`rotate(-90 ${padL - 6} ${padT + 4})`}
        >
          {yLabel}
        </text>

        {/* The hyperbola x·y = k */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Guide lines from the current point to each axis */}
        <line
          x1={curPx}
          y1={curPy}
          x2={curPx}
          y2={padT + plotH}
          stroke="var(--color-accent-500)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <line
          x1={padL}
          y1={curPy}
          x2={curPx}
          y2={curPy}
          stroke="var(--color-accent-500)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.7}
        />

        {/* Travel arc along the curve from old to new point */}
        {hasTrade && (
          <>
            <line
              x1={startPx}
              y1={startPy}
              x2={startPx}
              y2={curPy}
              stroke="var(--color-success)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              opacity={0.55}
            />
            <line
              x1={startPx}
              y1={curPy}
              x2={curPx}
              y2={curPy}
              stroke="var(--color-warning)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              opacity={0.55}
            />
          </>
        )}

        {/* Starting pool point (x0, y0) */}
        <circle
          cx={startPx}
          cy={startPy}
          r={5}
          fill="var(--color-surface)"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
        />

        {/* Current (animated) pool point */}
        <circle cx={curPx} cy={curPy} r={7} fill="var(--color-accent-500)" />
      </svg>

      {/* Slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-sell`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{sliderLabel}</span>
          <span className="font-mono text-ink-900">{fmt(deltaX)}</span>
        </label>
        <input
          id={`${id}-sell`}
          type="range"
          min={0}
          max={maxSell}
          step={sliderStep}
          value={deltaX}
          onChange={(e) => setDeltaX(Number(e.target.value))}
          aria-label={sliderLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{sellLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmt(deltaX)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{receiveLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(deltaYOut)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{oldPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmt(oldPrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{newPriceLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              hasTrade ? 'text-warning' : 'text-ink-900',
            )}
          >
            {fmt(newPrice)}
          </dd>
        </div>
      </dl>

      {/* Invariant confirmation: k before == k after */}
      <div
        className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-card border border-success/40 bg-success/10 px-4 py-3"
        aria-live="polite"
      >
        <span className="text-sm font-semibold text-success">
          {invariantLabel}
        </span>
        <span className="font-mono text-sm text-ink-700">
          {fmt(x0)} × {fmt(y0)} = {fmt(k)}
          <span className="mx-2 text-ink-400">→</span>
          {fmt(xNew)} × {fmt(yNew)} = {fmt(kAfter)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ConstantProductCurve;
