import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CrossDexArbProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the cheaper pool (where the searcher buys). */
  poolALabel?: string;
  /** Label for the dearer pool (where the searcher sells). */
  poolBLabel?: string;
  /** ETH reserve of the cheap pool A. Defaults to `100`. */
  initialXA?: number;
  /** USDC reserve of the cheap pool A. Defaults to `190000` (price 1900). */
  initialYA?: number;
  /** ETH reserve of the dear pool B. Defaults to `100`. */
  initialXB?: number;
  /** USDC reserve of the dear pool B. Defaults to `210000` (price 2100). */
  initialYB?: number;
  /** Largest amount of ETH the searcher may arbitrage. Defaults to `20`. */
  maxQ?: number;
  /** Slider label. */
  sliderLabel?: string;
  /** Readout label for pool A's spot price. */
  priceALabel?: string;
  /** Readout label for pool B's spot price. */
  priceBLabel?: string;
  /** Readout label for the USDC spent buying on A. */
  spentLabel?: string;
  /** Readout label for the USDC received selling on B. */
  receivedLabel?: string;
  /** Readout label for net profit. */
  profitLabel?: string;
  /** Label for the "optimal size" annotation. */
  optimalLabel?: string;
  /** Title of the converging-prices panel. */
  pricesPanelLabel?: string;
  /** Title of the profit-curve panel. */
  profitPanelLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (value: number, digits = 2): string => {
  const abs = Math.abs(value);
  const d = abs >= 1000 ? 0 : abs >= 1 ? digits : 4;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
};

/**
 * Cross-DEX arbitrage explainer. Two constant-product pools hold ETH/USDC at
 * different prices: pool A is cheap, pool B is dear. The searcher buys `q` ETH
 * from A (sending USDC in, paying yA·q/(xA−q)) and sells the same q ETH into B
 * (receiving yB·q/(xB+q) USDC). Net profit = received − spent, which is
 * HUMP-SHAPED in q: small trades wring out little of the spread, oversized
 * trades push the two pools' prices past each other and lose money. The learner
 * drags q; the top panel shows pool A's spot price RISING and pool B's FALLING
 * toward each other (the act that captures the spread is the act that closes it),
 * and the bottom panel plots profit vs q with the live point and the optimum
 * marked. Locale-agnostic via props; `prefers-reduced-motion` snaps the marker.
 */
export function CrossDexArb({
  title = 'Cross-DEX arbitrage: buy cheap, sell dear',
  poolALabel = 'Pool A (cheap — buy here)',
  poolBLabel = 'Pool B (dear — sell here)',
  initialXA = 100,
  initialYA = 190000,
  initialXB = 100,
  initialYB = 210000,
  maxQ = 20,
  sliderLabel = 'ETH arbitraged (q)',
  priceALabel = 'Pool A price',
  priceBLabel = 'Pool B price',
  spentLabel = 'USDC spent on A',
  receivedLabel = 'USDC from B',
  profitLabel = 'Net profit',
  optimalLabel = 'optimum',
  pricesPanelLabel = 'Prices converge as you trade',
  profitPanelLabel = 'Profit is hump-shaped in trade size',
  caption =
    'The same trade that captures the spread is the trade that closes it. Pool A’s price climbs and pool B’s falls until they meet — and right where they meet, the profit peaks and then rolls over. Trade too big and you push the prices past each other and give the spread back.',
  className,
}: CrossDexArbProps) {
  const id = useId();

  const kA = initialXA * initialYA;
  const kB = initialXB * initialYB;

  // USDC spent to buy q ETH out of pool A (constant product, no fee).
  const usdcSpent = (q: number): number =>
    q <= 0 || q >= initialXA ? (q <= 0 ? 0 : Infinity) : kA / (initialXA - q) - initialYA;
  // USDC received for selling q ETH into pool B.
  const usdcReceived = (q: number): number =>
    q <= 0 ? 0 : initialYB - kB / (initialXB + q);
  const profitAt = (q: number): number => usdcReceived(q) - usdcSpent(q);
  // Pool A spot price after buying q ETH (reserves shrink in ETH, grow in USDC).
  const priceAAt = (q: number): number => {
    const x = initialXA - q;
    return x <= 0 ? Infinity : (initialYA + usdcSpent(q)) / x;
  };
  // Pool B spot price after selling q ETH.
  const priceBAt = (q: number): number => (initialYB - usdcReceived(q)) / (initialXB + q);

  // Find the profit-maximising q by a coarse-then-fine scan.
  const optimalQ = useMemo(() => {
    let best = 0;
    let bestP = 0;
    for (let i = 1; i <= 2000; i += 1) {
      const q = (maxQ * i) / 2000;
      const p = profitAt(q);
      if (p > bestP) {
        bestP = p;
        best = q;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxQ, initialXA, initialYA, initialXB, initialYB]);

  const [q, setQ] = useState(() => Math.round(optimalQ * 10) / 10);
  const [shownQ, setShownQ] = useState(q);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = q;
    if (prefersReducedMotion()) {
      setShownQ(target);
      return;
    }
    const start = shownQ;
    const delta = target - start;
    if (Math.abs(delta) < maxQ * 0.001) {
      setShownQ(target);
      return;
    }
    const duration = 360;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShownQ(start + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const spent = usdcSpent(q);
  const received = usdcReceived(q);
  const profit = profitAt(q);
  const pA = priceAAt(q);
  const pB = priceBAt(q);

  // --- Geometry --------------------------------------------------------------
  const W = 520;
  const padL = 52;
  const padR = 16;
  const plotW = W - padL - padR;

  // Sample curves over q for both panels.
  const samples = 120;
  const qs = useMemo(
    () => Array.from({ length: samples + 1 }, (_, i) => (maxQ * i) / samples),
    [maxQ],
  );

  const priceSeries = useMemo(
    () => qs.map((qq) => ({ q: qq, a: priceAAt(qq), b: priceBAt(qq) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qs],
  );
  const profitSeries = useMemo(
    () => qs.map((qq) => ({ q: qq, p: profitAt(qq) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qs],
  );

  // Price-panel domain.
  const allPrices = priceSeries.flatMap((d) => [d.a, d.b]).filter((v) => Number.isFinite(v));
  const pMin = Math.min(...allPrices);
  const pMax = Math.max(...allPrices);

  // Profit-panel domain.
  const profits = profitSeries.map((d) => d.p).filter((v) => Number.isFinite(v));
  const profMin = Math.min(0, ...profits);
  const profMax = Math.max(...profits) * 1.08;

  const priceTop = 16;
  const priceH = 110;
  const profTop = priceTop + priceH + 54;
  const profH = 120;
  const H = profTop + profH + 26;

  const toPx = (qq: number): number => padL + (qq / maxQ) * plotW;
  const toPyPrice = (v: number): number =>
    priceTop + (1 - (v - pMin) / (pMax - pMin || 1)) * priceH;
  const toPyProf = (v: number): number =>
    profTop + (1 - (v - profMin) / (profMax - profMin || 1)) * profH;

  const linePath = (pts: Array<{ x: number; y: number }>): string =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

  const pathA = linePath(
    priceSeries
      .filter((d) => Number.isFinite(d.a))
      .map((d) => ({ x: toPx(d.q), y: toPyPrice(d.a) })),
  );
  const pathB = linePath(
    priceSeries
      .filter((d) => Number.isFinite(d.b))
      .map((d) => ({ x: toPx(d.q), y: toPyPrice(d.b) })),
  );
  const pathProfit = linePath(
    profitSeries
      .filter((d) => Number.isFinite(d.p))
      .map((d) => ({ x: toPx(d.q), y: toPyProf(d.p) })),
  );

  const markX = toPx(shownQ);
  const profitable = profit > 0;

  const ariaLabel =
    `${title}. ${sliderLabel}: ${fmt(q)} ETH. ${priceALabel}: ${fmt(pA)}. ` +
    `${priceBLabel}: ${fmt(pB)}. ${spentLabel}: ${fmt(spent)}. ` +
    `${receivedLabel}: ${fmt(received)}. ${profitLabel}: ${fmt(profit)}. ` +
    `${optimalLabel}: ${fmt(optimalQ)} ETH.`;

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
            'rounded-pill px-3 py-1 font-mono text-sm font-medium',
            profitable ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
          )}
        >
          {profitLabel}: {fmt(profit)}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={ariaLabel}>
        {/* Prices panel */}
        <text x={padL} y={priceTop - 4} fontSize="11" fontWeight={600} fill="var(--color-ink-500)">
          {pricesPanelLabel}
        </text>
        <line
          x1={padL}
          y1={priceTop + priceH}
          x2={padL + plotW}
          y2={priceTop + priceH}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
        />
        <path d={pathA} fill="none" stroke="var(--color-brand-500)" strokeWidth={2.5} />
        <path d={pathB} fill="none" stroke="var(--color-accent-500)" strokeWidth={2.5} />
        <text x={padL + plotW} y={toPyPrice(priceSeries[0].b) - 6} textAnchor="end" fontSize="10" fontWeight={600} fill="var(--color-accent-600)">
          {poolBLabel}
        </text>
        <text x={padL + plotW} y={toPyPrice(priceSeries[0].a) + 14} textAnchor="end" fontSize="10" fontWeight={600} fill="var(--color-brand-600)">
          {poolALabel}
        </text>

        {/* Profit panel */}
        <text x={padL} y={profTop - 4} fontSize="11" fontWeight={600} fill="var(--color-ink-500)">
          {profitPanelLabel}
        </text>
        {/* zero baseline */}
        <line
          x1={padL}
          y1={toPyProf(0)}
          x2={padL + plotW}
          y2={toPyProf(0)}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <path d={pathProfit} fill="none" stroke="var(--color-success)" strokeWidth={2.5} />
        {/* optimum marker */}
        <line
          x1={toPx(optimalQ)}
          y1={profTop}
          x2={toPx(optimalQ)}
          y2={profTop + profH}
          stroke="var(--color-ink-300)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text
          x={toPx(optimalQ)}
          y={profTop + 10}
          textAnchor="middle"
          fontSize="9"
          fontWeight={700}
          fill="var(--color-ink-500)"
        >
          {optimalLabel}
        </text>

        {/* Shared draggable marker across both panels */}
        <line
          x1={markX}
          y1={priceTop}
          x2={markX}
          y2={profTop + profH}
          stroke="var(--color-warning)"
          strokeWidth={1.5}
        />
        {Number.isFinite(pA) && (
          <circle cx={markX} cy={toPyPrice(pA)} r={5} fill="var(--color-brand-600)" />
        )}
        {Number.isFinite(pB) && (
          <circle cx={markX} cy={toPyPrice(pB)} r={5} fill="var(--color-accent-500)" />
        )}
        {Number.isFinite(profit) && (
          <circle cx={markX} cy={toPyProf(profit)} r={5} fill="var(--color-success)" />
        )}
      </svg>

      {/* Slider */}
      <div className="mt-2">
        <label
          htmlFor={`${id}-q`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{sliderLabel}</span>
          <span className="font-mono text-ink-900">{fmt(q)} ETH</span>
        </label>
        <input
          id={`${id}-q`}
          type="range"
          min={0}
          max={maxQ}
          step={maxQ / 200}
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          aria-label={sliderLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{priceALabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{fmt(pA)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{priceBLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{fmt(pB)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{profitLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              profitable ? 'text-success' : 'text-warning',
            )}
          >
            {fmt(profit)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spentLabel}</dt>
          <dd className="font-mono text-base font-semibold text-ink-900">{fmt(spent)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{receivedLabel}</dt>
          <dd className="font-mono text-base font-semibold text-ink-900">{fmt(received)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{optimalLabel}</dt>
          <dd className="font-mono text-base font-semibold text-ink-900">{fmt(optimalQ)} ETH</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CrossDexArb;
