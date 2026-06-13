import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface CorrelationTrancheLossProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the default-correlation (ρ) slider + readout. */
  correlationLabel?: string;
  /** Label for the equity (0–5%) tranche. */
  equityLabel?: string;
  /** Label for the mezzanine (5–15%) tranche. */
  mezzLabel?: string;
  /** Label for the senior (15–100%) tranche. */
  seniorLabel?: string;
  /** Label for the per-tranche expected-loss readouts / bars. */
  expectedLossLabel?: string;
  /** One-line dynamic note shown in the aria-live readout. */
  noteLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number, suffix: string): string =>
  `${value.toFixed(1)}${suffix}`;

// --- Normal-distribution helpers ------------------------------------------

/** Φ — standard normal CDF via Abramowitz & Stegun 7.1.26 erf approximation. */
const normCdf = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
};

/** Φ⁻¹ — inverse standard normal (Acklam's algorithm). */
const normInv = (p: number): number => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
};

// --- Deterministic PRNG (Math.random is banned) ----------------------------

/** mulberry32 — fast, seedless-stable PRNG so SSR output is deterministic. */
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

/** Box–Muller standard normal draw from a uniform generator. */
const stdNormal = (rng: () => number): number => {
  let u = rng();
  if (u < 1e-12) u = 1e-12;
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// --- Model parameters ------------------------------------------------------

const N_NAMES = 100; // pool of ~100 names
const P_DEFAULT = 0.1; // individual default probability
const RECOVERY = 0.4; // recovery rate → loss-given-default 60%
const LGD = 1 - RECOVERY;
const SCENARIOS = 4000; // Monte-Carlo paths
const SEED = 0x9e3779b9; // constant seed → deterministic, SSR-stable

// Tranche attachment bands (as fractions of pool notional).
const TRANCHES = [
  { key: 'equity', lo: 0.0, hi: 0.05 },
  { key: 'mezz', lo: 0.05, hi: 0.15 },
  { key: 'senior', lo: 0.15, hi: 1.0 },
] as const;

const HIST_BINS = 40;

interface ModelResult {
  /** Expected loss of each tranche as a % of that tranche's own notional. */
  trancheLoss: [number, number, number];
  /** Normalised portfolio-loss histogram (peak = 1) over [0,1] loss fraction. */
  hist: number[];
}

/**
 * Single-factor Gaussian-copula CDO loss model. Name i defaults when its latent
 * `sqrt(ρ)·Z_market + sqrt(1−ρ)·ε_i` falls below `Φ⁻¹(p)`. A shared market
 * factor Z couples every name, so higher ρ makes defaults clump: either almost
 * none happen or a huge wave hits at once. Run for a given ρ, deterministically.
 */
const runModel = (rho: number): ModelResult => {
  const rng = mulberry32(SEED);
  const sqrtRho = Math.sqrt(rho);
  const sqrtOneMinus = Math.sqrt(1 - rho);
  const threshold = normInv(P_DEFAULT);

  const trancheWidth = TRANCHES.map((t) => t.hi - t.lo);
  const trancheLossAcc: [number, number, number] = [0, 0, 0];
  const hist = new Array<number>(HIST_BINS).fill(0);

  for (let s = 0; s < SCENARIOS; s++) {
    const z = stdNormal(rng); // common market factor
    let defaults = 0;
    for (let i = 0; i < N_NAMES; i++) {
      const eps = stdNormal(rng);
      const latent = sqrtRho * z + sqrtOneMinus * eps;
      if (latent < threshold) defaults++;
    }
    // Portfolio loss fraction = (defaults / N) × loss-given-default.
    const loss = (defaults / N_NAMES) * LGD;

    // Histogram of portfolio loss.
    const bin = Math.min(HIST_BINS - 1, Math.floor(loss * HIST_BINS));
    hist[bin] += 1;

    // Each tranche absorbs the slice of loss inside its [lo, hi] band.
    for (let k = 0; k < TRANCHES.length; k++) {
      const { lo, hi } = TRANCHES[k];
      const absorbed = Math.min(Math.max(loss - lo, 0), hi - lo);
      trancheLossAcc[k] += absorbed / trancheWidth[k];
    }
  }

  const trancheLoss = trancheLossAcc.map(
    (acc) => (acc / SCENARIOS) * 100,
  ) as [number, number, number];

  const peak = Math.max(...hist, 1);
  return { trancheLoss, hist: hist.map((h) => h / peak) };
};

/**
 * Correlation → tranche-loss explainer for a synthetic CDO. The expected pool
 * loss is held fixed (p, recovery constant); only **default correlation ρ**
 * moves. As ρ rises, a single-factor Gaussian copula makes defaults clump — so
 * the portfolio-loss distribution turns bimodal/fat-tailed, risk drains OUT of
 * the equity tranche and floods INTO the "safe" senior tranche. Bars animate on
 * change; respects `prefers-reduced-motion`. Deterministic Monte-Carlo (fixed
 * mulberry32 seed) keyed on ρ, so SSR and client agree.
 */
export function CorrelationTrancheLoss({
  title = 'Why correlation is the CDO killer',
  correlationLabel = 'Default correlation (ρ)',
  equityLabel = 'Equity 0–5%',
  mezzLabel = 'Mezzanine 5–15%',
  seniorLabel = 'Senior 15–100%',
  expectedLossLabel = 'Expected loss',
  noteLabel = 'Senior risk rises with correlation',
  caption = "A senior/AAA tranche only loses money if a huge fraction of the pool defaults at once — and that can only happen if defaults are highly correlated. So mis-estimating correlation (assuming it stays low) is exactly how 'safe' senior tranches blew up in 2008.",
  percentSuffix = '%',
  className,
}: CorrelationTrancheLossProps) {
  const id = useId();
  const [rho, setRho] = useState(0.25);
  const [progress, setProgress] = useState(1); // 0 → 1 (bars rise-in)
  const rafRef = useRef<number | null>(null);

  // Deterministic, memoised model run — keyed on ρ.
  const model = useMemo(() => runModel(rho), [rho]);
  const [equityLoss, mezzLoss, seniorLoss] = model.trancheLoss;

  // Animate bars rising whenever ρ changes.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 600;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [rho]);

  // --- Chart geometry -------------------------------------------------------
  const W = 520;
  const H = 280;
  const padX = 40;
  const padTop = 18;
  const padBottom = 46;
  const plotH = H - padTop - padBottom;
  const baseline = padTop + plotH;

  const bars = [
    { label: equityLabel, value: equityLoss, fill: 'var(--color-accent-500)' },
    { label: mezzLabel, value: mezzLoss, fill: 'var(--color-accent-400)' },
    { label: seniorLabel, value: seniorLoss, fill: 'var(--color-brand-500)' },
  ];

  const valMax = Math.max(...bars.map((b) => b.value), 1);
  // Round the axis ceiling up to a tidy gridline.
  const axisMax = Math.ceil(valMax / 20) * 20 || 20;
  const barH = (v: number) => (v / axisMax) * plotH;

  const slots = bars.length;
  const slotW = (W - padX - 14) / slots;
  const barW = Math.min(slotW * 0.5, 64);
  const slotX = (i: number) => padX + slotW * i + slotW / 2;

  // Gridlines at 0, 25, 50, 75, 100% of the axis.
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: baseline - plotH * f,
    label: Math.round(axisMax * f),
  }));

  // Histogram geometry (faint, drawn across the full plot width as a backdrop).
  const histBins = model.hist;
  const histStepW = (W - padX - 14) / histBins.length;

  const ariaLabel =
    `${title}: with default correlation ρ = ${rho.toFixed(2)}, expected loss is ` +
    `${pct(equityLoss, percentSuffix)} for the ${equityLabel} tranche, ` +
    `${pct(mezzLoss, percentSuffix)} for the ${mezzLabel} tranche, and ` +
    `${pct(seniorLoss, percentSuffix)} for the ${seniorLabel} tranche. ` +
    `As correlation rises, loss shifts out of the equity tranche and into the senior tranche.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-500"
            aria-hidden="true"
          />
          {equityLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-accent-400"
            aria-hidden="true"
          />
          {mezzLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-pill bg-brand-500"
            aria-hidden="true"
          />
          {seniorLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Faint portfolio-loss histogram backdrop: concentrated at low ρ,
            bimodal / fat-tailed at high ρ. */}
        <g opacity={0.16}>
          {histBins.map((h, i) => {
            const hH = h * plotH * progress;
            if (hH <= 0) return null;
            return (
              <rect
                key={`hist-${i}`}
                x={padX + histStepW * i}
                y={baseline - hH}
                width={Math.max(1, histStepW - 1)}
                height={hH}
                fill="var(--color-ink-400)"
              />
            );
          })}
        </g>

        {/* Gridlines + y-axis ticks (expected loss %). */}
        {gridLines.map((g, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={padX}
              y1={g.y}
              x2={W - 14}
              y2={g.y}
              stroke="var(--color-ink-200)"
              strokeWidth={i === 0 ? 1.5 : 1}
            />
            <text
              x={padX - 6}
              y={g.y + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-500)"
              fontFamily="var(--font-mono)"
            >
              {g.label}
              {percentSuffix}
            </text>
          </g>
        ))}

        {/* Tranche bars. */}
        {bars.map((b, i) => {
          const cx0 = slotX(i);
          const x0 = cx0 - barW / 2;
          const h = barH(b.value) * progress;
          return (
            <g key={`bar-${i}`}>
              {h > 0 && (
                <rect
                  x={x0}
                  y={baseline - h}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={b.fill}
                />
              )}
              <text
                x={cx0}
                y={baseline - h - 5}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-ink-700)"
                fontFamily="var(--font-mono)"
              >
                {pct(b.value, percentSuffix)}
              </text>
              <text
                x={cx0}
                y={baseline + 16}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-ink-500)"
              >
                {b.label}
              </text>
            </g>
          );
        })}

        <text
          x={padX}
          y={H - 6}
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {expectedLossLabel} — ρ = {rho.toFixed(2)}
        </text>
      </svg>

      {/* Correlation slider */}
      <div className="mt-4">
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
          min={0}
          max={0.95}
          step={0.05}
          value={rho}
          onChange={(e) => setRho(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{correlationLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {rho.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {equityLabel} · {expectedLossLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {pct(equityLoss, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {mezzLabel} · {expectedLossLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-accent-500">
            {pct(mezzLoss, percentSuffix)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {seniorLabel} · {expectedLossLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {pct(seniorLoss, percentSuffix)}
          </dd>
        </div>
      </dl>

      <p
        className="mt-3 text-sm font-medium text-ink-700"
        aria-live="polite"
        aria-atomic="true"
      >
        {noteLabel}
        {': '}
        {equityLabel} {pct(equityLoss, percentSuffix)} ↓ ·{' '}
        {seniorLabel} {pct(seniorLoss, percentSuffix)} ↑
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default CorrelationTrancheLoss;
