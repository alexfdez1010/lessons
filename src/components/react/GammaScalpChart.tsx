import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface GammaScalpChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Strike price K. Defaults to `100`. */
  strike?: number;
  /** Initial spot price S0. Defaults to the strike. */
  spot?: number;
  /** Time to expiry T in years used for the Greeks. Defaults to `0.25`. */
  time?: number;
  /** Risk-free rate r (annual). Defaults to `0.03`. */
  rate?: number;
  /** Realized (actual) volatility the path will exhibit. Defaults to `0.30`. */
  realizedVol?: number;
  /** Implied volatility paid for (drives theta bleed). Defaults to `0.20`. */
  impliedVol?: number;
  /** Seed for the deterministic price path. Defaults to `1`. */
  seed?: number;
  /** Slider label for realized volatility. */
  realizedVolLabel?: string;
  /** Slider label for implied volatility. */
  impliedVolLabel?: string;
  /** Legend / readout label for the gamma-scalp gains line. */
  scalpLabel?: string;
  /** Legend / readout label for the theta-decay line. */
  thetaLabel?: string;
  /** Legend / readout label for the net P&L line. */
  netLabel?: string;
  /** Button label that draws a fresh random path. */
  newPathLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

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
const normPdf = (x: number): number => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);

const d1Of = (s: number, K: number, sigma: number, T: number, r: number): number => {
  const denom = sigma * Math.sqrt(T);
  if (denom <= 0 || s <= 0) return 0;
  return (Math.log(s / K) + (r + (sigma * sigma) / 2) * T) / denom;
};

// Black–Scholes gamma (same for call & put).
const bsGamma = (s: number, K: number, sigma: number, T: number, r: number): number => {
  const denom = s * sigma * Math.sqrt(T);
  if (denom <= 0) return 0;
  return normPdf(d1Of(s, K, sigma, T, r)) / denom;
};

// Black–Scholes call theta (per year). Negative for a long option.
const bsCallTheta = (
  s: number,
  K: number,
  sigma: number,
  T: number,
  r: number,
): number => {
  const sqrtT = Math.sqrt(T);
  if (sqrtT <= 0 || s <= 0) return 0;
  const d1 = d1Of(s, K, sigma, T, r);
  const d2 = d1 - sigma * sqrtT;
  return -(s * normPdf(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCdf(d2);
};

// Deterministic PRNG so a given seed always reproduces the same path.
const mulberry32 = (a: number): (() => number) => {
  let t = a >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

// Box–Muller standard normal from a uniform generator.
const gaussian = (rand: () => number): number => {
  const u1 = Math.max(1e-12, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const STEPS = 60; // trading days simulated
const TRADING_DAYS = 252;

/**
 * Interactive gamma-scalping explorer. A long-gamma, delta-hedged book is
 * rebalanced every day along a seeded random price path: when the underlying
 * drops the hedge forces you to buy, when it rises you sell — "buy low, sell
 * high" banks a scalp of ≈ ½·Γ·(ΔS)² each step. Against that, theta bleeds the
 * option's value daily. The net daily P&L tracks ½·Γ·S²·(realized variance −
 * implied variance): you only come out ahead when realized volatility beats the
 * implied vol you paid for.
 *
 * Three cumulative curves are drawn: gamma-scalp gains (brand), theta cost
 * (accent, negative), and net (sum). Drag the realized-vol slider above the
 * implied-vol level and the net curve finishes positive; below it, negative.
 * Respects `prefers-reduced-motion` (curves appear fully drawn instead of
 * sweeping in).
 */
export function GammaScalpChart({
  title = 'Gamma scalping vs. theta bleed',
  strike = 100,
  spot,
  time = 0.25,
  rate = 0.03,
  realizedVol = 0.3,
  impliedVol = 0.2,
  seed = 1,
  realizedVolLabel = 'Realized volatility',
  impliedVolLabel = 'Implied volatility (paid)',
  scalpLabel = 'Gamma-scalp gains',
  thetaLabel = 'Theta cost',
  netLabel = 'Net P&L',
  newPathLabel = 'New path',
  caption = 'Each day the delta hedge forces you to buy the dip and sell the rip, banking a scalp of about ½·gamma·(price move)². Theta quietly bleeds value the whole time. Net profit only appears when realized volatility (how much the price actually wiggles) beats the implied volatility you paid — slide realized above implied and the net line lifts above zero.',
  className,
}: GammaScalpChartProps) {
  const id = useId();
  const K = Math.max(1, strike);
  const S0 = spot ?? K;

  const [seedState, setSeedState] = useState(seed);
  const [rVolState, setRVolState] = useState(Math.max(0.02, realizedVol));
  const [iVolState, setIVolState] = useState(Math.max(0.02, impliedVol));

  // Animated draw-in progress 0 → 1 across the curves.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 14;
  const padY = 22;

  // --- Build the seeded path and accumulate the three P&L curves. ---
  const dt = time / TRADING_DAYS > 0 ? 1 / TRADING_DAYS : 0;
  const rand = mulberry32(seedState * 0x9e3779b1 + 0x1234567);

  type Point = { scalp: number; theta: number; net: number };
  const series: Point[] = [{ scalp: 0, theta: 0, net: 0 }];

  let s = S0;
  let cumScalp = 0;
  let cumTheta = 0;
  // Time-to-expiry shrinks as we step forward so the Greeks stay realistic.
  let tau = Math.max(time, dt * STEPS + 1e-6);
  for (let i = 0; i < STEPS; i++) {
    const gamma = bsGamma(s, K, iVolState, tau, rate);
    // GBM-style daily move scaled by REALIZED vol.
    const z = gaussian(rand);
    const drift = -0.5 * rVolState * rVolState * dt;
    const ds = s * (Math.exp(drift + rVolState * Math.sqrt(dt) * z) - 1);

    // Gamma scalp captured this step: ½·Γ·(ΔS)² (always ≥ 0 for long gamma).
    const scalpGain = 0.5 * gamma * ds * ds;
    // Theta cost paid this step: |Θ|·dt, priced off IMPLIED vol.
    const thetaCost = -bsCallTheta(s, K, iVolState, tau, rate) * dt;

    cumScalp += scalpGain;
    cumTheta -= thetaCost; // accumulate as a negative drag
    s += ds;
    tau = Math.max(dt, tau - dt);

    series.push({ scalp: cumScalp, theta: cumTheta, net: cumScalp + cumTheta });
  }

  const finalScalp = series[series.length - 1].scalp;
  const finalTheta = series[series.length - 1].theta;
  const finalNet = series[series.length - 1].net;

  // Vertical extent across all three curves, with zero always on screen.
  let vLo = 0;
  let vHi = 0;
  for (const p of series) {
    vLo = Math.min(vLo, p.scalp, p.theta, p.net);
    vHi = Math.max(vHi, p.scalp, p.theta, p.net);
  }
  if (vHi - vLo < 1e-9) {
    vHi += 0.5;
    vLo -= 0.5;
  } else {
    const pad = (vHi - vLo) * 0.1;
    vHi += pad;
    vLo -= pad;
  }

  const x = (i: number) => padX + (i / STEPS) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - vLo) / (vHi - vLo)) * (H - padY * 2);

  const pathFor = (key: keyof Point, upTo: number) => {
    let d = '';
    for (let i = 0; i <= upTo; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(series[i][key])}`;
    }
    return d;
  };

  const drawn = Math.max(1, Math.round(progress * STEPS));

  // Sweep the curves in (skipped when reduced motion is preferred).
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 650;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [seedState, rVolState, iVolState]);

  const zeroY = y(0);
  const edge = rVolState - iVolState;
  const netPositive = finalNet >= 0;
  const netColor = netPositive ? 'var(--color-brand-700)' : 'var(--color-accent-600)';

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            edge >= 0 ? 'bg-brand-600' : 'bg-accent-500',
          )}
        >
          {netLabel}: {num(finalNet)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-pill"
            style={{ background: 'var(--color-brand-500)' }}
            aria-hidden="true"
          />
          <span className="text-ink-700">{scalpLabel}</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-pill"
            style={{ background: 'var(--color-accent-500)' }}
            aria-hidden="true"
          />
          <span className="text-ink-700">{thetaLabel}</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-pill"
            style={{ background: netColor }}
            aria-hidden="true"
          />
          <span className="text-ink-700">{netLabel}</span>
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. Cumulative profit and loss over ${STEPS} simulated days. With realized volatility ${num(
          rVolState * 100,
          0,
        )}% versus implied volatility ${num(
          iVolState * 100,
          0,
        )}%, gamma-scalp gains total ${num(finalScalp)}, theta cost totals ${num(
          finalTheta,
        )}, for a net of ${num(finalNet)}.`}
      >
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        <text
          x={padX + 2}
          y={zeroY - 4}
          fontSize={11}
          fill="var(--color-ink-400)"
          dominantBaseline="auto"
        >
          0
        </text>
        {/* Theta cost (negative drag) */}
        <path
          d={pathFor('theta', drawn)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* Gamma-scalp gains */}
        <path
          d={pathFor('scalp', drawn)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* Net P&L — colored by sign of the final value */}
        <path
          d={pathFor('net', drawn)}
          fill="none"
          stroke={netColor}
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* End-point marker on the net curve */}
        <circle cx={x(drawn)} cy={y(series[drawn].net)} r={5} fill={netColor} />
      </svg>

      {/* Volatility sliders */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-rvol`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{realizedVolLabel}</span>
            <span className="font-mono text-ink-900">{num(rVolState * 100, 0)}%</span>
          </label>
          <input
            id={`${id}-rvol`}
            type="range"
            min={0.05}
            max={0.8}
            step={0.01}
            value={rVolState}
            onChange={(e) => setRVolState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-ivol`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{impliedVolLabel}</span>
            <span className="font-mono text-ink-900">{num(iVolState * 100, 0)}%</span>
          </label>
          <input
            id={`${id}-ivol`}
            type="range"
            min={0.05}
            max={0.8}
            step={0.01}
            value={iVolState}
            onChange={(e) => setIVolState(Number(e.target.value))}
            className="mt-2 w-full accent-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          />
        </div>
      </div>

      {/* New path button */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setSeedState((v) => v + 1)}
          className="rounded-pill border border-ink-200 bg-surface px-3 py-1 text-sm font-medium text-ink-700 transition-colors hover:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {newPathLabel}
        </button>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{realizedVolLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {num(rVolState * 100, 0)}%
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{impliedVolLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {num(iVolState * 100, 0)}%
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{scalpLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(finalScalp)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{thetaLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(finalTheta)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{netLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              netPositive ? 'text-brand-700' : 'text-accent-600',
            )}
          >
            {num(finalNet)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default GammaScalpChart;
