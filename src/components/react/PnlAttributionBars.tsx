import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

type OptionKind = 'call' | 'put';

export interface PnlAttributionBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Option type — `'call'` or `'put'`. Defaults to `'call'`. */
  type?: OptionKind;
  /** Number of contracts (each contract covers 100 shares). Defaults to `10`. */
  quantity?: number;
  /** Strike price K. Defaults to `100`. */
  strike?: number;
  /** Spot price S. Defaults to `100`. */
  spot?: number;
  /** Volatility σ (annual, e.g. `0.25` = 25%). Defaults to `0.25`. */
  vol?: number;
  /** Time to expiry T in years. Defaults to `0.5`. */
  time?: number;
  /** Risk-free rate r (annual). Defaults to `0.03`. */
  rate?: number;
  /** Bar label for the delta term. */
  deltaLabel?: string;
  /** Bar label for the gamma term. */
  gammaLabel?: string;
  /** Bar label for the theta term. */
  thetaLabel?: string;
  /** Bar label for the vega term. */
  vegaLabel?: string;
  /** Bar label for the rho term. */
  rhoLabel?: string;
  /** Label for the summed total. */
  totalLabel?: string;
  /** Label for the unexplained residual (full reprice − sum of Greeks). */
  residualLabel?: string;
  /** Slider label for the stock move dS. */
  dsLabel?: string;
  /** Slider label for the vol change dσ (in percentage points). */
  dVolLabel?: string;
  /** Slider label for elapsed days dt. */
  dtLabel?: string;
  /** Slider label for the rate change dr (in percentage points). */
  drLabel?: string;
  /** Toggle label for a call. */
  callLabel?: string;
  /** Toggle label for a put. */
  putLabel?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Format a dollar amount with a sign and thousands separators (en-US).
const money = (value: number, digits = 0): string => {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value))}`;
};

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

// Black–Scholes option price (per share).
const bsPrice = (
  optType: OptionKind,
  s: number,
  K: number,
  sigma: number,
  T: number,
  r: number,
): number => {
  if (s <= 0) return optType === 'call' ? 0 : Math.max(0, K * Math.exp(-r * T));
  if (T <= 0 || sigma <= 0) {
    const intrinsic = optType === 'call' ? Math.max(0, s - K) : Math.max(0, K - s);
    return intrinsic;
  }
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(s / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return optType === 'call'
    ? s * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
    : K * Math.exp(-r * T) * normCdf(-d2) - s * normCdf(-d1);
};

interface Greeks {
  delta: number; // per $1 of spot, per share
  gamma: number; // per $1 of spot, per share
  theta: number; // per 1 year, per share (divide by 365 for per-day)
  vega: number; // per 1.00 change in σ (i.e. 100 vol points), per share
  rho: number; // per 1.00 change in r (i.e. 100% rate move), per share
}

// Black–Scholes Greeks (per share). Vega/Rho returned per *full unit* of σ/r
// (not per 1%); we scale them to the slider's percentage-point units below.
const greeksAt = (
  optType: OptionKind,
  s: number,
  K: number,
  sigma: number,
  T: number,
  r: number,
): Greeks => {
  const sqrtT = Math.sqrt(T);
  const denom = sigma * sqrtT;
  if (denom <= 0 || s <= 0 || T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }
  const d1 = (Math.log(s / K) + (r + (sigma * sigma) / 2) * T) / denom;
  const d2 = d1 - denom;
  const nd1 = normPdf(d1);
  const disc = K * Math.exp(-r * T);
  const delta = optType === 'call' ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = nd1 / (s * sigma * sqrtT);
  const vega = s * nd1 * sqrtT; // per 1.00 of σ
  const theta =
    optType === 'call'
      ? -(s * nd1 * sigma) / (2 * sqrtT) - r * disc * normCdf(d2)
      : -(s * nd1 * sigma) / (2 * sqrtT) + r * disc * normCdf(-d2); // per 1 year
  const rho =
    optType === 'call' ? disc * T * normCdf(d2) : -disc * T * normCdf(-d2); // per 1.00 of r
  return { delta, gamma, theta, vega, rho };
};

interface Bar {
  key: string;
  label: string;
  value: number;
}

/**
 * P&L attribution waterfall. For an option position held over one trading
 * period, the change in value is decomposed via its second-order Taylor
 * expansion in the Greeks:
 *
 *   ΔV ≈ Δ·dS + ½·Γ·dS² + Θ·dt + Vega·dσ + Rho·dr
 *
 * Drag the sliders for the period's moves — the stock move dS, the vol change
 * dσ (in percentage points), the days elapsed dt, and the rate change dr (in
 * percentage points) — and each signed bar grows or shrinks while the summed
 * total updates live. A final "residual" bar shows the gap between the exact
 * full reprice (Black–Scholes at the new inputs) and the Greek sum: the
 * second-order error the decomposition misses, which blows up on large moves.
 *
 * Unit bookkeeping (all per share, then × 100 shares × quantity contracts):
 *   Delta P&L = Δ · dS
 *   Gamma P&L = ½ · Γ · dS²
 *   Theta P&L = Θ_year · (days/365)
 *   Vega  P&L = Vega_per_unit · (dσ_points / 100)   — slider is vol points
 *   Rho   P&L = Rho_per_unit  · (dr_points / 100)    — slider is rate points
 *
 * All user-facing strings are props (English defaults). Respects
 * `prefers-reduced-motion` (bars snap instead of animating their height).
 */
export function PnlAttributionBars({
  title = 'Where the day’s P&L came from',
  caption =
    'A day’s option P&L breaks into its Greeks: delta P&L from the stock’s move, gamma P&L from the move squared (always helping a long position), theta bleeding time value, vega from the vol change, and rho from rates. Sum them and you nearly recover the full reprice — the leftover residual is the higher-order error the linear-plus-gamma sketch misses, and it grows fast on big moves.',
  type = 'call',
  quantity = 10,
  strike = 100,
  spot = 100,
  vol = 0.25,
  time = 0.5,
  rate = 0.03,
  deltaLabel = 'Delta P&L',
  gammaLabel = 'Gamma P&L',
  thetaLabel = 'Theta P&L',
  vegaLabel = 'Vega P&L',
  rhoLabel = 'Rho P&L',
  totalLabel = 'Greek total',
  residualLabel = 'Residual (reprice − Greeks)',
  dsLabel = 'Stock move dS ($)',
  dVolLabel = 'Vol change dσ (pts)',
  dtLabel = 'Days passed',
  drLabel = 'Rate change dr (pts)',
  callLabel = 'Call',
  putLabel = 'Put',
  className,
}: PnlAttributionBarsProps) {
  const id = useId();
  const K = Math.max(1, strike);
  const S = Math.max(1, spot);
  const sigma = Math.max(0.01, vol);
  const T = Math.max(0.01, time);
  const r = rate;
  const qty = Math.max(1, Math.round(quantity));
  const shares = qty * 100; // multiplier from per-share to position units

  const [typeState, setTypeState] = useState<OptionKind>(type);
  const [dS, setDS] = useState(5);
  const [dVolPts, setDVolPts] = useState(0); // percentage points of σ
  const [dtDays, setDtDays] = useState(1);
  const [drPts, setDrPts] = useState(0); // percentage points of r

  const g = greeksAt(typeState, S, K, sigma, T, r);

  // --- Greek-by-Greek P&L (signed, position units). ---
  const deltaPnl = g.delta * dS * shares;
  const gammaPnl = 0.5 * g.gamma * dS * dS * shares;
  const thetaPnl = g.theta * (dtDays / 365) * shares;
  const vegaPnl = g.vega * (dVolPts / 100) * shares; // dσ in vol points → decimal
  const rhoPnl = g.rho * (drPts / 100) * shares; // dr in rate points → decimal

  const greekTotal = deltaPnl + gammaPnl + thetaPnl + vegaPnl + rhoPnl;

  // --- Exact full reprice for the residual (second-order error). ---
  const priceNow = bsPrice(typeState, S, K, sigma, T, r);
  const priceLater = bsPrice(
    typeState,
    S + dS,
    K,
    sigma + dVolPts / 100,
    Math.max(0, T - dtDays / 365),
    r + drPts / 100,
  );
  const fullReprice = (priceLater - priceNow) * shares;
  const residual = fullReprice - greekTotal;

  const bars: Bar[] = [
    { key: 'delta', label: deltaLabel, value: deltaPnl },
    { key: 'gamma', label: gammaLabel, value: gammaPnl },
    { key: 'theta', label: thetaLabel, value: thetaPnl },
    { key: 'vega', label: vegaLabel, value: vegaPnl },
    { key: 'rho', label: rhoLabel, value: rhoPnl },
    { key: 'residual', label: residualLabel, value: residual },
  ];

  // Symmetric vertical scale around the zero baseline.
  const maxMag =
    Math.max(
      ...bars.map((b) => Math.abs(b.value)),
      Math.abs(greekTotal),
      1,
    ) * 1.1;

  // SVG geometry.
  const W = 520;
  const H = 240;
  const padX = 14;
  const padTop = 12;
  const padBottom = 28; // room for the x-axis labels
  const plotH = H - padTop - padBottom;
  const zeroY = padTop + plotH / 2;
  const slotW = (W - padX * 2) / bars.length;
  const barW = slotW * 0.56;

  const reduced = prefersReducedMotion();
  const transition = reduced ? undefined : 'height 350ms ease-out, y 350ms ease-out';

  const summary = `${bars
    .map((b) => `${b.label} ${money(b.value)}`)
    .join(', ')}. ${totalLabel} ${money(greekTotal)}.`;

  const typeLabel = typeState === 'call' ? callLabel : putLabel;
  const totalIsNeg = greekTotal < 0;

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
            totalIsNeg ? 'bg-accent-600' : 'bg-brand-600',
          )}
        >
          {totalLabel}: {money(greekTotal)}
        </span>
      </figcaption>

      {/* Call / put toggle */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={`${callLabel} / ${putLabel}`}
      >
        {(['call', 'put'] as OptionKind[]).map((k) => {
          const active = k === typeState;
          const label = k === 'call' ? callLabel : putLabel;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => setTypeState(k)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-accent-500 text-white'
                  : 'border border-ink-200 bg-surface text-ink-700 hover:border-accent-400',
              )}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto self-center font-mono text-xs text-ink-500">
          {qty} × {typeLabel} · K {num(K, 0)} · S {num(S, 0)}
        </span>
      </div>

      {/* Signed bar chart (waterfall of Greek contributions). */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. ${summary}`}
      >
        {/* Zero baseline */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
        />
        {bars.map((b, i) => {
          const cxBar = padX + slotW * (i + 0.5);
          const barX = cxBar - barW / 2;
          const h = (Math.abs(b.value) / maxMag) * (plotH / 2);
          const positive = b.value >= 0;
          const barY = positive ? zeroY - h : zeroY;
          const fill = positive
            ? 'var(--color-brand-500)'
            : 'var(--color-accent-500)';
          const labelY = positive ? barY - 5 : barY + h + 13;
          return (
            <g key={b.key}>
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={h}
                rx={3}
                fill={fill}
                style={transition ? { transition } : undefined}
              />
              {/* dollar value above/below the bar */}
              <text
                x={cxBar}
                y={labelY}
                fontSize={10}
                textAnchor="middle"
                fill={positive ? 'var(--color-brand-700)' : 'var(--color-accent-700)'}
                fontFamily="var(--font-mono)"
              >
                {money(b.value)}
              </text>
              {/* x-axis category label */}
              <text
                x={cxBar}
                y={H - 6}
                fontSize={9}
                textAnchor="middle"
                fill="var(--color-ink-500)"
              >
                {b.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Sliders for the period's market moves. */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-ds`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{dsLabel}</span>
            <span className="font-mono text-ink-900">{num(dS, 1)}</span>
          </label>
          <input
            id={`${id}-ds`}
            type="range"
            min={-10}
            max={10}
            step={0.5}
            value={dS}
            onChange={(e) => setDS(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-dvol`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{dVolLabel}</span>
            <span className="font-mono text-ink-900">{num(dVolPts, 1)}</span>
          </label>
          <input
            id={`${id}-dvol`}
            type="range"
            min={-10}
            max={10}
            step={0.5}
            value={dVolPts}
            onChange={(e) => setDVolPts(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-dt`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{dtLabel}</span>
            <span className="font-mono text-ink-900">{num(dtDays, 0)}</span>
          </label>
          <input
            id={`${id}-dt`}
            type="range"
            min={0}
            max={30}
            step={1}
            value={dtDays}
            onChange={(e) => setDtDays(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-dr`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{drLabel}</span>
            <span className="font-mono text-ink-900">{num(drPts, 2)}</span>
          </label>
          <input
            id={`${id}-dr`}
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={drPts}
            onChange={(e) => setDrPts(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Per-bar readouts + totals. */}
      <ul className="mt-4 flex flex-col gap-2">
        {bars.map((b) => (
          <li
            key={`${b.key}-row`}
            className={cx(
              'flex items-baseline justify-between gap-3',
              b.key === 'residual' && 'mt-1 border-t border-ink-100 pt-2',
            )}
          >
            <span className="flex items-center gap-2 text-sm text-ink-700">
              <span
                className="h-3 w-3 shrink-0 rounded-pill"
                style={{
                  background:
                    b.value >= 0
                      ? 'var(--color-brand-500)'
                      : 'var(--color-accent-500)',
                }}
                aria-hidden="true"
              />
              <span className={cx(b.key === 'residual' && 'font-medium text-ink-900')}>
                {b.label}
              </span>
            </span>
            <span
              className={cx(
                'font-mono text-sm font-semibold',
                b.value < 0 ? 'text-accent-700' : 'text-brand-700',
              )}
            >
              {money(b.value)}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-2">
          <span className="text-sm font-medium text-ink-900">{totalLabel}</span>
          <span
            className={cx(
              'font-mono text-base font-bold',
              totalIsNeg ? 'text-accent-700' : 'text-brand-700',
            )}
          >
            {money(greekTotal)}
          </span>
        </li>
      </ul>

      {/* Screen-reader live region for the running breakdown. */}
      <p className="sr-only" aria-live="polite">
        {summary}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PnlAttributionBars;
