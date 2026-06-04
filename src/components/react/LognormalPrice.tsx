import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LognormalPriceProps {
  /** Heading above the chart. */
  title?: string;
  /** Spot price S0. Defaults to `100`. */
  spot?: number;
  /** Volatility σ as a decimal (0.25 = 25%). Defaults to `0.25`. */
  vol?: number;
  /** Time to expiry T in years. Defaults to `1`. */
  time?: number;
  /** Strike K. Defaults to `110`. */
  strike?: number;
  /** Option type — flips which side of K is shaded. Defaults to `'call'`. */
  type?: 'call' | 'put';
  /** Slider label for volatility. */
  volLabel?: string;
  /** Slider label for time to expiry. */
  timeLabel?: string;
  /** Slider label for the strike. */
  strikeLabel?: string;
  /** Toggle label for a call. */
  callLabel?: string;
  /** Toggle label for a put. */
  putLabel?: string;
  /** Readout label for the in-the-money probability. */
  probItmLabel?: string;
  /** Readout label for the median terminal price. */
  medianPriceLabel?: string;
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

const pct = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value * 100);

// Standard normal CDF via the Abramowitz–Stegun erf approximation (max error ~1e-7).
const normCdf = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
};

/**
 * Lognormal terminal-price distribution under Black–Scholes / geometric Brownian
 * motion. The risk-free rate `r` is fixed at 0 here so the median terminal price
 * stays anchored near spot and the picture stays about *dispersion*, not drift.
 *
 * Given spot S0, volatility σ and time T, ln(S_T) is normal with
 *   mean m = ln(S0) + (r − σ²/2)·T  and  sd = σ·√T,
 * so S_T is lognormal. The curve plots that density across the price axis; the
 * shaded mass on the in-the-money side of strike K equals the risk-neutral
 * probability of finishing ITM — exactly N(d2) for a call. Raising σ or T fattens
 * the right tail and spreads the distribution, moving that probability around.
 * Respects `prefers-reduced-motion` (the curve snaps instead of morphing).
 */
export function LognormalPrice({
  title = 'Where might the price land?',
  spot = 100,
  vol = 0.25,
  time = 1,
  strike = 110,
  type = 'call',
  volLabel = 'Volatility σ',
  timeLabel = 'Time to expiry (years)',
  strikeLabel = 'Strike K',
  callLabel = 'Call',
  putLabel = 'Put',
  probItmLabel = 'Probability in the money',
  medianPriceLabel = 'Median terminal price',
  caption = 'Under geometric Brownian motion the terminal price is lognormally distributed — skewed right, since a stock can multiply but never fall below zero. The shaded mass past the strike is the risk-neutral chance of finishing in the money: that area is N(d₂) in Black–Scholes. Crank up volatility or time and the tail fattens, shifting the odds.',
  className,
}: LognormalPriceProps) {
  const id = useId();
  const r = 0; // risk-free drift, fixed for a dispersion-focused picture

  const S0 = Math.max(1, spot);
  const [volState, setVolState] = useState(Math.min(0.8, Math.max(0.05, vol)));
  const [timeState, setTimeState] = useState(Math.min(3, Math.max(0.1, time)));
  const [strikeState, setStrikeState] = useState(Math.max(1, strike));
  const [typeState, setTypeState] = useState<'call' | 'put'>(type);

  const W = 520;
  const H = 240;
  const padX = 12;
  const padY = 16;
  const padBottom = 28; // room for axis labels

  // Distribution parameters of ln(S_T).
  const sd = volState * Math.sqrt(timeState);
  const m = Math.log(S0) + (r - (volState * volState) / 2) * timeState;

  const pdf = (s: number): number => {
    if (s <= 0) return 0;
    const z = (Math.log(s) - m) / sd;
    return Math.exp(-(z * z) / 2) / (s * sd * Math.sqrt(2 * Math.PI));
  };

  // Price axis: span a generous range around spot that widens with σ√T.
  const sMax = Math.max(strikeState * 1.25, S0 * Math.exp(m - Math.log(S0) + 3.2 * sd));
  const xMax = Math.min(sMax, S0 * 8);
  const xMin = 0;

  const x = (s: number) => padX + ((s - xMin) / (xMax - xMin)) * (W - padX * 2);

  const SAMPLES = 240;
  const grid: { s: number; p: number }[] = [];
  let pMax = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const s = xMin + (i / SAMPLES) * (xMax - xMin);
    const p = pdf(s);
    if (p > pMax) pMax = p;
    grid.push({ s, p });
  }
  const yTop = padY;
  const yBase = H - padBottom;
  const y = (p: number) => yBase - (pMax > 0 ? p / pMax : 0) * (yBase - yTop);

  // Curve path.
  const curvePath = grid
    .map((g, i) => `${i === 0 ? 'M' : 'L'} ${num(x(g.s), 2)} ${num(y(g.p), 2)}`)
    .join(' ');

  // Shaded ITM region: for a call, S_T > K (right of strike); for a put, S_T < K.
  const isItm = (s: number) => (typeState === 'call' ? s > strikeState : s < strikeState);
  const shadedPoints = grid.filter((g) => isItm(g.s));
  let shadePath = '';
  if (shadedPoints.length > 0) {
    const first = shadedPoints[0];
    const last = shadedPoints[shadedPoints.length - 1];
    shadePath =
      `M ${num(x(first.s), 2)} ${num(yBase, 2)} ` +
      shadedPoints.map((g) => `L ${num(x(g.s), 2)} ${num(y(g.p), 2)}`).join(' ') +
      ` L ${num(x(last.s), 2)} ${num(yBase, 2)} Z`;
  }

  // ITM probability via the closed-form N(d2) — the exact, tail-robust integral
  // of the lognormal density above (call) or below (put) the strike.
  const d2 = (Math.log(S0 / strikeState) + (r - (volState * volState) / 2) * timeState) / sd;
  const probItm = typeState === 'call' ? normCdf(d2) : normCdf(-d2);

  // Median of a lognormal is exp(m); mean is exp(m + sd²/2).
  const median = Math.exp(m);

  // Strike / spot marker pixel positions.
  const strikeX = x(strikeState);
  const spotX = x(S0);

  // Smoothly morph the curve when σ or T change. We animate an opacity/scale-in
  // feel cheaply by transitioning a key off vol+time; respect reduced motion.
  const [morph, setMorph] = useState(1);
  const rafRef = useRef<number | null>(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (prefersReducedMotion()) {
      setMorph(1);
      return;
    }
    setMorph(0);
    const duration = 350;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setMorph(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [volState, timeState]);

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + f * (xMax - xMin));

  const itmSideLabel =
    typeState === 'call'
      ? `prices above the strike (${num(strikeState, 0)})`
      : `prices below the strike (${num(strikeState, 0)})`;

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
          σ {num(volState * 100, 0)}% · T {num(timeState, 1)}y
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {strikeLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {medianPriceLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. With volatility ${num(
          volState * 100,
          0,
        )} percent and ${num(
          timeState,
          1,
        )} years to expiry, the terminal price is lognormally distributed. The shaded mass over ${itmSideLabel} is about ${pct(
          probItm,
        )} percent — the risk-neutral probability of finishing in the money. The median terminal price is ${num(
          median,
        )}.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={yBase}
          x2={W - padX}
          y2={yBase}
          stroke="var(--color-ink-200)"
        />
        {/* Axis ticks */}
        {axisTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={x(tick)}
              y1={yBase}
              x2={x(tick)}
              y2={yBase + 4}
              stroke="var(--color-ink-200)"
            />
            <text
              x={x(tick)}
              y={yBase + 18}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-400)"
            >
              {num(tick, 0)}
            </text>
          </g>
        ))}

        {/* Shaded in-the-money probability mass */}
        {shadePath && (
          <path
            d={shadePath}
            fill="var(--color-brand-500)"
            opacity={0.15 * (0.4 + 0.6 * morph)}
          />
        )}

        {/* Density curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.5 + 0.5 * morph}
        />

        {/* Median (expected-ish center) marker — accent */}
        <line
          x1={x(median)}
          y1={yTop}
          x2={x(median)}
          y2={yBase}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />

        {/* Spot marker — faint */}
        <line
          x1={spotX}
          y1={yTop}
          x2={spotX}
          y2={yBase}
          stroke="var(--color-ink-400)"
          strokeDasharray="2 5"
        />

        {/* Strike marker — solid brand */}
        <line
          x1={strikeX}
          y1={yTop}
          x2={strikeX}
          y2={yBase}
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
        />
        <text
          x={Math.min(W - padX - 2, Math.max(padX + 12, strikeX))}
          y={yTop + 12}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill="var(--color-brand-700)"
        >
          K
        </text>
      </svg>

      {/* Call / put toggle */}
      <div className="mt-4 inline-flex rounded-pill border border-ink-100 p-1" role="group">
        <button
          type="button"
          aria-pressed={typeState === 'call'}
          onClick={() => setTypeState('call')}
          className={cx(
            'rounded-pill px-4 py-1 text-sm font-medium transition-colors',
            typeState === 'call'
              ? 'bg-brand-600 text-white'
              : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {callLabel}
        </button>
        <button
          type="button"
          aria-pressed={typeState === 'put'}
          onClick={() => setTypeState('put')}
          className={cx(
            'rounded-pill px-4 py-1 text-sm font-medium transition-colors',
            typeState === 'put'
              ? 'bg-brand-600 text-white'
              : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {putLabel}
        </button>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-vol`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{volLabel}</span>
            <span className="font-mono text-ink-900">{num(volState * 100, 0)}%</span>
          </label>
          <input
            id={`${id}-vol`}
            type="range"
            min={5}
            max={80}
            step={1}
            value={Math.round(volState * 100)}
            onChange={(e) => setVolState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-time`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{timeLabel}</span>
            <span className="font-mono text-ink-900">{num(timeState, 1)}</span>
          </label>
          <input
            id={`${id}-time`}
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={timeState}
            onChange={(e) => setTimeState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-strike`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{strikeLabel}</span>
            <span className="font-mono text-ink-900">{num(strikeState, 0)}</span>
          </label>
          <input
            id={`${id}-strike`}
            type="range"
            min={Math.round(S0 * 0.4)}
            max={Math.round(S0 * 2)}
            step={1}
            value={Math.round(strikeState)}
            onChange={(e) => setStrikeState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{probItmLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(probItm)}%</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{medianPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(median)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LognormalPrice;
