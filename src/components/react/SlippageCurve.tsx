import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SlippageCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the trade-size slider (Δx as a fraction of the X reserve). */
  tradeSizeLabel?: string;
  /** Label for the price-impact readout and the curve's Y axis. Defaults to `'Price impact'`. */
  priceImpactLabel?: string;
  /** Label for the spot-price readout. */
  spotPriceLabel?: string;
  /** Label for the average-execution-price readout. */
  execPriceLabel?: string;
  /** Label for the amount-received readout. */
  receivedLabel?: string;
  /** Label for the minimum-received (after slippage tolerance) readout. */
  minReceivedLabel?: string;
  /** Label for the slippage-tolerance readout. */
  toleranceLabel?: string;
  /** Label for the pool-depth control group. */
  depthLabel?: string;
  /** Label for the shallow-pool preset (reserves ×0.25). Defaults to `'Shallow'`. */
  shallowLabel?: string;
  /** Label for the normal-pool preset (reserves ×1). Defaults to `'Normal'`. */
  normalLabel?: string;
  /** Label for the deep-pool preset (reserves ×4). Defaults to `'Deep'`. */
  deepLabel?: string;
  /** Warning shown when the trade would fill worse than the slippage tolerance allows. Defaults to `'Exceeds slippage tolerance — trade would revert'`. */
  exceedsToleranceLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to Y-token money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Ticker shown for the X token being sold. Defaults to `'X'`. */
  baseSymbol?: string;
  /** Base reserve of token X at "Normal" depth. Defaults to `100`. */
  baseX?: number;
  /** Base reserve of token Y at "Normal" depth. Defaults to `200000`. */
  baseY?: number;
  /** Slippage tolerance, in percent. Defaults to `0.5`. */
  slippageTolerancePct?: number;
  /** Largest trade size, as a fraction of the X reserve. Defaults to `0.5` (50%). */
  maxTradeFraction?: number;
  /** Slider step, as a fraction of the X reserve. Defaults to `0.005`. */
  step?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 2): string =>
  `${value < 0 ? '-' : ''}${prefix}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

type Depth = 'shallow' | 'normal' | 'deep';
const DEPTH_SCALE: Record<Depth, number> = { shallow: 0.25, normal: 1, deep: 4 };

/**
 * Interactive price-impact / slippage explainer for a constant-product AMM
 * (x·y=k). Selling Δx of token X walks the pool along the invariant: the
 * pool starts at spot price `y/x`, but the *average* price you actually fill
 * a large order at gets progressively worse, because each marginal unit moves
 * the reserves further. The learner drags a trade-size slider (Δx as a
 * fraction of the X reserve) and watches a curve of price-impact% vs trade
 * size, with a marker tracking the current trade. Readouts spell out the spot
 * price, the average execution price, the amount of Y received, the price
 * impact %, and the minimum received under a slippage-tolerance guardrail —
 * flagging when a trade would "revert" for filling too far from quote. Three
 * depth presets (×0.25 / ×1 / ×4 reserves) let the learner feel the same
 * trade size hurt far more in a shallow pool. `prefers-reduced-motion` snaps
 * the marker instead of tweening. Locale-agnostic via props.
 *
 * Math (exact, x·y=k):
 *   spotPrice      = y / x
 *   Δy_out         = y − k/(x + Δx)             with k = x·y
 *   execPrice(avg) = Δy_out / Δx
 *   priceImpact%   = (spotPrice − execPrice) / spotPrice × 100
 */
export function SlippageCurve({
  title = 'Price impact & slippage on an AMM',
  tradeSizeLabel = 'Trade size (share of pool)',
  priceImpactLabel = 'Price impact',
  spotPriceLabel = 'Spot price',
  execPriceLabel = 'Avg execution price',
  receivedLabel = 'You receive',
  minReceivedLabel = 'Minimum received',
  toleranceLabel = 'Slippage tolerance',
  depthLabel = 'Pool depth',
  shallowLabel = 'Shallow',
  normalLabel = 'Normal',
  deepLabel = 'Deep',
  exceedsToleranceLabel = 'Exceeds slippage tolerance — trade would revert',
  caption = 'Small trades barely move the price; large trades eat the curve. A deeper pool is your friend — the same order hurts far less. The slippage tolerance is the guardrail that cancels a trade that would fill too far from the quote.',
  currencyPrefix = '$',
  baseSymbol = 'X',
  baseX = 100,
  baseY = 200000,
  slippageTolerancePct = 0.5,
  maxTradeFraction = 0.5,
  step = 0.005,
  className,
}: SlippageCurveProps) {
  const id = useId();
  const [depth, setDepth] = useState<Depth>('normal');
  // Trade size as a fraction of the X reserve.
  const [frac, setFrac] = useState(0.1);
  // Animated fraction the marker renders against.
  const [shownFrac, setShownFrac] = useState(0.1);
  const rafRef = useRef<number | null>(null);

  const scale = DEPTH_SCALE[depth];
  const x = baseX * scale;
  const y = baseY * scale;
  const k = x * y;

  const spotPrice = y / x;

  /** Average execution price (Y per X) for selling `f` × x of token X. */
  const execPriceAt = (f: number): number => {
    if (f <= 0) return spotPrice;
    const dx = f * x;
    const dyOut = y - k / (x + dx);
    return dyOut / dx;
  };
  /** Price impact %, exact x·y=k. */
  const impactAt = (f: number): number => {
    const exec = execPriceAt(f);
    return ((spotPrice - exec) / spotPrice) * 100;
  };

  const dx = frac * x;
  const dyOut = frac > 0 ? y - k / (x + dx) : 0;
  const execPrice = execPriceAt(frac);
  const impact = impactAt(frac);
  // Slippage tolerance: revert if the fill is worse than spot × (1 − tol).
  const tol = slippageTolerancePct / 100;
  const minExecPrice = spotPrice * (1 - tol);
  const minReceived = dx * minExecPrice;
  const exceeds = impact > slippageTolerancePct;

  // Chart geometry.
  const W = 520;
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Y axis scales to the worst impact at the max trade size (depth-independent
  // for constant-product: impact at fraction f is f/(1+f), so the curve shape
  // is identical across depths — the lesson is that the SAME f hurts equally
  // in %, but in token terms the deep pool fills a far larger order). We keep
  // a fixed axis so the marker position reads cleanly.
  const maxImpact = (maxTradeFraction / (1 + maxTradeFraction)) * 100;
  const axisMax = Math.ceil(maxImpact / 5) * 5 || 5;

  const toPlotX = (f: number): number => padL + (f / maxTradeFraction) * plotW;
  const toPlotY = (imp: number): number => padT + plotH - (imp / axisMax) * plotH;

  // Build the impact curve path.
  const curvePath = useMemo(() => {
    const pts: string[] = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const f = (i / n) * maxTradeFraction;
      const px = toPlotX(f);
      const py = toPlotY(impactAt(f));
      pts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    return pts.join(' ');
    // depth changes x/y/k (impactAt closes over them); curve shape is constant
    // but we recompute so the path stays in sync if math ever depends on depth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, maxTradeFraction, axisMax]);

  // Animate the marker toward the new fraction whenever the set fraction changes.
  useEffect(() => {
    const target = frac;
    if (prefersReducedMotion()) {
      setShownFrac(target);
      return;
    }
    const start = shownFrac;
    const delta = target - start;
    if (Math.abs(delta) < 0.0005) {
      setShownFrac(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownFrac(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownFrac intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frac]);

  const markerX = toPlotX(shownFrac);
  const markerY = toPlotY(impactAt(shownFrac));
  const markerColor = exceeds ? 'var(--color-warning)' : 'var(--color-accent-500)';

  const pct = (v: number, digits = 2): string =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

  // Y-axis gridlines / ticks.
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = axisMax / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [axisMax]);

  const ariaLabel = `${title}. ${tradeSizeLabel}: ${pct(frac * 100, 1)} of the pool. ${priceImpactLabel}: ${pct(
    impact,
  )}. ${spotPriceLabel}: ${money(currencyPrefix, spotPrice)}. ${execPriceLabel}: ${money(
    currencyPrefix,
    execPrice,
  )}.${exceeds ? ` ${exceedsToleranceLabel}.` : ''}`;

  const depthButtons: Array<{ value: Depth; label: string }> = [
    { value: 'shallow', label: shallowLabel },
    { value: 'normal', label: normalLabel },
    { value: 'deep', label: deepLabel },
  ];

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
            exceeds ? 'bg-warning' : 'bg-brand-600',
          )}
        >
          {pct(impact)}
        </span>
      </figcaption>

      {/* Impact curve */}
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

        {/* Slippage-tolerance threshold line */}
        {slippageTolerancePct <= axisMax && (
          <g>
            <line
              x1={padL}
              y1={toPlotY(slippageTolerancePct)}
              x2={W - padR}
              y2={toPlotY(slippageTolerancePct)}
              stroke="var(--color-warning)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.8}
            />
            <text
              x={W - padR}
              y={toPlotY(slippageTolerancePct) - 4}
              textAnchor="end"
              fontSize="10"
              fontWeight={600}
              fill="var(--color-warning)"
            >
              {`${toleranceLabel} ${pct(slippageTolerancePct, slippageTolerancePct % 1 === 0 ? 0 : 1)}`}
            </text>
          </g>
        )}

        {/* The impact curve */}
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
          y2={padT + plotH}
          stroke={markerColor}
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.7}
        />

        {/* Current-trade marker */}
        <circle cx={markerX} cy={markerY} r={6} fill={markerColor} />
        <circle cx={markerX} cy={markerY} r={9} fill="none" stroke={markerColor} strokeWidth={1.5} opacity={0.5} />

        {/* X axis labels */}
        <text x={padL} y={H - 8} fontSize="10" fill="var(--color-ink-400)">
          0%
        </text>
        <text x={padL + plotW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
          {tradeSizeLabel}
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
          {`${(maxTradeFraction * 100).toFixed(0)}%`}
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
          {priceImpactLabel}
        </text>
      </svg>

      {/* Trade-size slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-trade`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{tradeSizeLabel}</span>
          <span className="font-mono text-ink-900">
            {pct(frac * 100, 1)} · {dx.toLocaleString('en-US', { maximumFractionDigits: 2 })} {baseSymbol}
          </span>
        </label>
        <input
          id={`${id}-trade`}
          type="range"
          min={0}
          max={maxTradeFraction}
          step={step}
          value={frac}
          onChange={(e) => setFrac(Number(e.target.value))}
          aria-label={tradeSizeLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Pool-depth presets */}
      <div className="mt-4">
        <p className="text-sm text-ink-700" id={`${id}-depth`}>
          {depthLabel}
        </p>
        <div className="mt-2 inline-flex gap-2" role="group" aria-labelledby={`${id}-depth`}>
          {depthButtons.map((b) => {
            const active = depth === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => setDepth(b.value)}
                aria-pressed={active}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-sunken/40 text-ink-700 hover:bg-ink-100',
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spotPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, spotPrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{execPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, execPrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{priceImpactLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              exceeds ? 'text-warning' : 'text-brand-700',
            )}
          >
            {pct(impact)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{receivedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, dyOut)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{minReceivedLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, minReceived)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{toleranceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {pct(slippageTolerancePct, slippageTolerancePct % 1 === 0 ? 0 : 1)}
          </dd>
        </div>
      </dl>

      {/* Tolerance warning */}
      {exceeds && (
        <div
          className="mt-4 rounded-card border border-warning/40 bg-warning/10 px-4 py-3"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-warning">⚠ {exceedsToleranceLabel}</p>
        </div>
      )}

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SlippageCurve;
