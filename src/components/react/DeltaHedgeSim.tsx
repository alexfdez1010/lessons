import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DeltaHedgeSimProps {
  /** Heading above the chart. */
  title?: string;
  /** Strike price K of the short call. Defaults to `100`. */
  strike?: number;
  /** Volatility σ (annual, e.g. `0.25` = 25%). Defaults to `0.25`. */
  vol?: number;
  /** Time to expiry T in years. Defaults to `0.25`. */
  time?: number;
  /** Risk-free rate r (annual). Defaults to `0.03`. */
  rate?: number;
  /** Annual drift μ of the simulated stock path. Defaults to `0.08`. */
  drift?: number;
  /** Starting spot price S₀. Defaults to the strike. */
  spot?: number;
  /** Seed for the deterministic GBM path. Defaults to `12345`. */
  seed?: number;
  /** Number of rebalances along the path the slider starts at. Defaults to `12`. */
  rebalances?: number;
  /** Label for the stock-price chart. */
  stockChartLabel?: string;
  /** Label for the P&L chart. */
  pnlChartLabel?: string;
  /** Legend/readout label for the delta-hedged book. */
  hedgedLabel?: string;
  /** Legend/readout label for the unhedged short call. */
  unhedgedLabel?: string;
  /** Label for the "new path" button. */
  newPathLabel?: string;
  /** Label for the rebalances-per-path slider. */
  rebalancesLabel?: string;
  /** Readout label for final P&L. */
  finalPnlLabel?: string;
  /** Label for the time axis. */
  timeAxisLabel?: string;
  /** Label for the stock-price axis / spot. */
  spotAxisLabel?: string;
  /** Label for the zero-P&L reference line. */
  zeroLineLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

const signed = (value: number, digits = 2): string =>
  `${value >= 0 ? '+' : ''}${num(value, digits)}`;

// Abramowitz & Stegun 7.1.26 erf approximation → standard normal CDF.
const erf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
};

const normCdf = (x: number): number => 0.5 * (1 + erf(x / Math.SQRT2));

// Deterministic PRNG — mulberry32. Seeded so the GBM path is reproducible and
// never touches Math.random (forbidden in the build sandbox).
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Box–Muller: two uniforms → one standard normal draw.
const gaussian = (rand: () => number): number => {
  let u = rand();
  let v = rand();
  if (u < 1e-12) u = 1e-12;
  if (v < 1e-12) v = 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Black–Scholes European call value and delta at spot s with τ years left.
const bsCall = (
  s: number,
  K: number,
  sigma: number,
  tau: number,
  r: number,
): { value: number; delta: number } => {
  if (tau <= 0 || sigma <= 0 || s <= 0) {
    const intrinsic = Math.max(s - K, 0);
    return { value: intrinsic, delta: s > K ? 1 : 0 };
  }
  const sqrtT = sigma * Math.sqrt(tau);
  const d1 = (Math.log(s / K) + (r + (sigma * sigma) / 2) * tau) / sqrtT;
  const d2 = d1 - sqrtT;
  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  return {
    value: s * Nd1 - K * Math.exp(-r * tau) * Nd2,
    delta: Nd1,
  };
};

const STEPS = 80; // resolution of the simulated stock path

interface SimResult {
  spots: number[]; // STEPS+1 spot prices
  unhedged: number[]; // cumulative P&L of the naked short call, per step
  hedged: number[]; // cumulative P&L of the delta-hedged book, per step
}

/**
 * Delta-hedging simulator for a SHORT 1 call. A single deterministic seeded
 * GBM stock path runs over a fixed grid; the position is short one European
 * call (strike K, vol σ, time T, rate r). Two outcomes are tracked step by
 * step:
 *
 *   • Unhedged — you simply hold the short call. Its mark-to-market P&L is
 *     (premium received) − (current call value), which swings wildly with S.
 *   • Delta-hedged — at each rebalance you hold +Δ shares (the short call has
 *     delta −Δ, so +Δ shares neutralise it), rebalancing on a coarser grid set
 *     by the "rebalances per path" slider. Cash financing is carried at r so
 *     signs stay correct. The hedged P&L hugs zero, leaving only the discrete
 *     hedging error (gamma slippage between rebalances).
 *
 * More rebalances ⇒ the hedged curve sits tighter to zero. The GBM path comes
 * from a deterministic mulberry32 PRNG (never Math.random); the "new path"
 * button bumps the seed so every render is reproducible. Static draw —
 * respects `prefers-reduced-motion` by simply not animating.
 */
export function DeltaHedgeSim({
  title = 'Delta-hedging a short call',
  strike = 100,
  vol = 0.25,
  time = 0.25,
  rate = 0.03,
  drift = 0.08,
  spot,
  seed = 12345,
  rebalances = 12,
  stockChartLabel = 'Stock price',
  pnlChartLabel = 'Cumulative P&L',
  hedgedLabel = 'Delta-hedged',
  unhedgedLabel = 'Unhedged short call',
  newPathLabel = 'New path',
  rebalancesLabel = 'Rebalances per path',
  finalPnlLabel = 'Final P&L',
  timeAxisLabel = 'Time',
  spotAxisLabel = 'Spot',
  zeroLineLabel = 'Break-even',
  caption = 'Hold a naked short call and your P&L lurches every time the stock moves — that orange line is your night ruined. Hold +delta shares against it and rebalance often, and the blue line flattens to near zero: you have neutralised the directional risk, leaving only the small hedging error from rebalancing in discrete jumps. Crank up the rebalances and watch that error shrink toward zero.',
  className,
}: DeltaHedgeSimProps) {
  const id = useId();
  const K = Math.max(1, strike);
  const sigma = Math.max(0.01, vol);
  const T = Math.max(0.01, time);
  const r = rate;
  const mu = drift;
  const S0 = spot && spot > 0 ? spot : K;

  const [seedBump, setSeedBump] = useState(0);
  const [rebal, setRebal] = useState(Math.min(50, Math.max(1, Math.round(rebalances))));

  const activeSeed = seed + seedBump * 7919; // large stride → visibly different paths

  // Build the single GBM path once per seed (independent of rebalancing).
  const spots = useMemo(() => {
    const rand = mulberry32(activeSeed >>> 0);
    const dt = T / STEPS;
    const path: number[] = [S0];
    let s = S0;
    for (let i = 0; i < STEPS; i++) {
      const z = gaussian(rand);
      s = s * Math.exp((mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * z);
      path.push(s);
    }
    return path;
  }, [activeSeed, S0, T, sigma, mu]);

  // Run both books over the path for the chosen rebalance frequency.
  const sim: SimResult = useMemo(() => {
    const dt = T / STEPS;
    // Premium collected for selling the call at t = 0.
    const premium = bsCall(spots[0], K, sigma, T, r).value;

    const unhedged: number[] = [];
    const hedged: number[] = [];

    // Delta-hedged book state: shares held, and a cash account that funds them.
    // Cash starts at the premium received. Buying shares spends cash; cash
    // accrues interest at r. P&L = cash·e^{financing} + shares·S − callValue.
    let shares = 0;
    let cash = premium;
    // Rebalance on a coarse grid: every `gap` steps hold +delta shares.
    const gap = Math.max(1, Math.round(STEPS / rebal));

    for (let i = 0; i <= STEPS; i++) {
      const s = spots[i];
      const tau = Math.max(0, T - i * dt);
      const { value, delta } = bsCall(s, K, sigma, tau, r);

      // Accrue interest on the cash balance over one step (skip step 0).
      if (i > 0) cash *= Math.exp(r * dt);

      // Naked short call: collected premium grown at r, less current value.
      const unhedgedPnl = premium * Math.exp(r * i * dt) - value;
      unhedged.push(unhedgedPnl);

      // Rebalance the hedge on the coarse grid (and always at the final step).
      const isRebalanceStep = i % gap === 0 || i === STEPS;
      if (isRebalanceStep) {
        const target = i === STEPS ? (s > K ? 1 : 0) : delta;
        const trade = target - shares; // +buy / −sell
        cash -= trade * s; // spend cash to buy shares
        shares = target;
      }

      // Hedged book P&L: financed cash + share inventory − short-call liability.
      const hedgedPnl = cash + shares * s - value;
      hedged.push(hedgedPnl);
    }

    return { spots, unhedged, hedged };
  }, [spots, K, sigma, T, r, rebal]);

  const finalUnhedged = sim.unhedged[sim.unhedged.length - 1];
  const finalHedged = sim.hedged[sim.hedged.length - 1];

  // --- Chart geometry (two stacked charts share the time axis width). ---
  const W = 560;
  const HS = 150; // stock chart height
  const HP = 200; // P&L chart height
  const padLeft = 44;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 26;

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);

  // Stock-price y-scale.
  const sLo = Math.min(...sim.spots);
  const sHi = Math.max(...sim.spots);
  const sPad = Math.max((sHi - sLo) * 0.08, 0.5);
  const sMin = sLo - sPad;
  const sMax = sHi + sPad;
  const sToPx = (v: number) =>
    padTop + (1 - (v - sMin) / (sMax - sMin)) * (HS - padTop - padBottom);

  // P&L y-scale (shared by both P&L curves, always keeps zero on screen).
  const allPnl = [...sim.unhedged, ...sim.hedged];
  let pLo = Math.min(...allPnl, 0);
  let pHi = Math.max(...allPnl, 0);
  const pPad = Math.max((pHi - pLo) * 0.1, 0.5);
  pLo -= pPad;
  pHi += pPad;
  const pToPx = (v: number) =>
    padTop + (1 - (v - pLo) / (pHi - pLo)) * (HP - padTop - padBottom);

  const buildPath = (vals: number[], yScale: (v: number) => number): string => {
    let d = '';
    for (let i = 0; i < vals.length; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yScale(vals[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  const stockPath = buildPath(sim.spots, sToPx);
  const unhedgedPath = buildPath(sim.unhedged, pToPx);
  const hedgedPath = buildPath(sim.hedged, pToPx);

  const strikeY = K >= sMin && K <= sMax ? sToPx(K) : null;
  const zeroPnlY = pToPx(0);
  const stockBaseY = HS - padBottom;
  const pnlBaseY = HP - padBottom;

  // Static component, but keep the reduced-motion check meaningful: we expose a
  // class hook so consumers can disable any future CSS transitions on the SVG.
  const noMotion = typeof window !== 'undefined' && prefersReducedMotion();

  const colorHedged = 'var(--color-brand-500)';
  const colorUnhedged = 'var(--color-accent-500)';

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
          {rebalancesLabel}: {rebal}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill"
            style={{ backgroundColor: colorHedged }}
            aria-hidden="true"
          />
          {hedgedLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-1 w-5 rounded-pill"
            style={{ backgroundColor: colorUnhedged }}
            aria-hidden="true"
          />
          {unhedgedLabel}
        </span>
      </div>

      {/* Stock-price chart */}
      <svg
        viewBox={`0 0 ${W} ${HS}`}
        className={cx('mt-3 w-full', noMotion && 'motion-reduce:transition-none')}
        role="img"
        aria-label={`${stockChartLabel}. A simulated stock path starting at ${num(
          S0,
        )} against a strike of ${num(K)}, ending at ${num(
          sim.spots[sim.spots.length - 1],
        )}.`}
      >
        <line
          x1={padLeft}
          y1={stockBaseY}
          x2={W - padRight}
          y2={stockBaseY}
          stroke="var(--color-ink-200)"
        />
        {strikeY !== null && (
          <>
            <line
              x1={padLeft}
              y1={strikeY}
              x2={W - padRight}
              y2={strikeY}
              stroke="var(--color-ink-300)"
              strokeWidth={1.25}
              strokeDasharray="5 4"
            />
            <text
              x={padLeft - 6}
              y={strikeY + 3}
              fontSize={10}
              fontWeight={600}
              fill="var(--color-ink-500)"
              textAnchor="end"
            >
              K {num(K, 0)}
            </text>
          </>
        )}
        <path
          d={stockPath}
          fill="none"
          stroke="var(--color-ink-700)"
          strokeWidth={2.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text
          x={padLeft - 6}
          y={padTop + 4}
          fontSize={11}
          fill="var(--color-ink-500)"
          textAnchor="end"
        >
          {spotAxisLabel}
        </text>
        <text
          x={padLeft}
          y={HS - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="start"
        >
          {timeAxisLabel}
        </text>
      </svg>

      {/* P&L chart */}
      <svg
        viewBox={`0 0 ${W} ${HP}`}
        className="mt-1 w-full"
        role="img"
        aria-label={`${pnlChartLabel}. The unhedged short call ends at a P&L of ${signed(
          finalUnhedged,
        )} while the delta-hedged book (rebalanced ${rebal} times) ends at ${signed(
          finalHedged,
        )}, much closer to zero.`}
      >
        {/* Zero-P&L baseline */}
        <line
          x1={padLeft}
          y1={zeroPnlY}
          x2={W - padRight}
          y2={zeroPnlY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
        <text
          x={padLeft - 6}
          y={zeroPnlY - 3}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-ink-500)"
          textAnchor="end"
        >
          {zeroLineLabel}
        </text>
        {/* Time axis baseline */}
        <line
          x1={padLeft}
          y1={pnlBaseY}
          x2={W - padRight}
          y2={pnlBaseY}
          stroke="var(--color-ink-200)"
        />
        {/* Unhedged curve (accent) */}
        <path
          d={unhedgedPath}
          fill="none"
          stroke={colorUnhedged}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Hedged curve (brand) — drawn last so it sits on top near zero */}
        <path
          d={hedgedPath}
          fill="none"
          stroke={colorHedged}
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text
          x={padLeft - 6}
          y={padTop + 4}
          fontSize={11}
          fill="var(--color-ink-500)"
          textAnchor="end"
        >
          P&L
        </text>
        <text
          x={padLeft}
          y={HP - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="start"
        >
          {timeAxisLabel}
        </text>
        <text
          x={W - padRight}
          y={HP - 6}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="end"
        >
          {num(T, 2)}
        </text>
      </svg>

      {/* Final-P&L readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="flex items-center gap-2 text-ink-500">
            <span
              className="h-2 w-2 rounded-pill"
              style={{ backgroundColor: colorUnhedged }}
              aria-hidden="true"
            />
            {finalPnlLabel} · {unhedgedLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold" style={{ color: colorUnhedged }}>
            {signed(finalUnhedged)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="flex items-center gap-2 text-ink-500">
            <span
              className="h-2 w-2 rounded-pill"
              style={{ backgroundColor: colorHedged }}
              aria-hidden="true"
            />
            {finalPnlLabel} · {hedgedLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold" style={{ color: colorHedged }}>
            {signed(finalHedged)}
          </dd>
        </div>
      </dl>

      {/* Rebalances slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-rebal`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{rebalancesLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {rebal}
          </span>
        </label>
        <input
          id={`${id}-rebal`}
          type="range"
          min={1}
          max={50}
          step={1}
          value={rebal}
          onChange={(e) => setRebal(Number(e.target.value))}
          aria-valuetext={`${rebal} rebalances per path`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* New-path button */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setSeedBump((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {newPathLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DeltaHedgeSim;
