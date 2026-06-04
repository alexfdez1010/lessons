import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

type GreekKind = 'delta' | 'gamma' | 'theta' | 'vega';
type OptionKind = 'call' | 'put';

export interface GreeksCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Strike price K. Defaults to `100`. */
  strike?: number;
  /** Volatility σ (annual, e.g. `0.25` = 25%). Defaults to `0.25`. */
  vol?: number;
  /** Time to expiry T in years. Defaults to `0.5`. */
  time?: number;
  /** Risk-free rate r (annual). Defaults to `0.03`. */
  rate?: number;
  /** Initial spot-price marker. Defaults to the strike. */
  spot?: number;
  /** Option type — `'call'` or `'put'`. Defaults to `'call'`. */
  type?: OptionKind;
  /** Which Greek to plot first. Defaults to `'delta'`. */
  greek?: GreekKind;
  /** Button label for Delta. */
  deltaLabel?: string;
  /** Button label for Gamma. */
  gammaLabel?: string;
  /** Button label for Theta. */
  thetaLabel?: string;
  /** Button label for Vega. */
  vegaLabel?: string;
  /** Toggle label for a call. */
  callLabel?: string;
  /** Toggle label for a put. */
  putLabel?: string;
  /** Spot slider / readout label. */
  spotLabel?: string;
  /** Volatility slider label. */
  volLabel?: string;
  /** Time slider label. */
  timeLabel?: string;
  /** Readout label for the selected Greek's value at the marker. */
  valueLabel?: string;
  /** Label for the vertical strike guide line. */
  strikeMarkerLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const num = (value: number, digits = 3): string =>
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

/**
 * Interactive Black–Scholes Greeks explorer. Pick one Greek (Delta, Gamma,
 * Theta, Vega) for a call or put and watch how it varies with the underlying
 * spot price S across a range around the strike K. A marker rides the curve as
 * you drag the spot slider, reading out the Greek's value, while the σ and T
 * sliders reshape the whole curve. A dashed vertical guide marks the strike so
 * "at the money" is always visible.
 *
 * Closed forms (with d1 = (ln(s/K) + (r + σ²/2)T)/(σ√T), d2 = d1 − σ√T):
 *   Δ_call = N(d1), Δ_put = N(d1) − 1
 *   Γ = n(d1) / (s·σ·√T)            (same for call & put)
 *   Vega = s·n(d1)·√T              (shown per 1% move in σ, i.e. /100)
 *   Θ_call = −s·n(d1)·σ/(2√T) − r·K·e^{−rT}·N(d2)
 *   Θ_put  = −s·n(d1)·σ/(2√T) + r·K·e^{−rT}·N(−d2)
 *
 * Respects `prefers-reduced-motion` (the marker snaps instead of sliding).
 */
export function GreeksCurve({
  title = 'How the Greeks bend with spot',
  strike = 100,
  vol = 0.25,
  time = 0.5,
  rate = 0.03,
  spot,
  type = 'call',
  greek = 'delta',
  deltaLabel = 'Delta',
  gammaLabel = 'Gamma',
  thetaLabel = 'Theta',
  vegaLabel = 'Vega',
  callLabel = 'Call',
  putLabel = 'Put',
  spotLabel = 'Spot price',
  volLabel = 'Volatility σ',
  timeLabel = 'Time to expiry (yrs)',
  valueLabel = 'Greek value here',
  strikeMarkerLabel = 'Strike',
  caption = 'Delta sweeps an S-shape from 0 to 1 (calls) or −1 to 0 (puts), passing the midpoint at the money. Gamma and Vega are bell-shaped, peaking near the strike — that ATM zone is where an option is most sensitive. Theta is usually negative for long options and bites hardest at the money. Shorten T or raise σ and watch every curve reshape.',
  className,
}: GreeksCurveProps) {
  const id = useId();
  const K = Math.max(1, strike);

  const [greekState, setGreekState] = useState<GreekKind>(greek);
  const [typeState, setTypeState] = useState<OptionKind>(type);
  const initialSpot = Math.min(1.6 * K, Math.max(0.4 * K, spot ?? K));
  const [spotState, setSpotState] = useState(initialSpot);
  const [volState, setVolState] = useState(Math.max(0.01, vol));
  const [timeState, setTimeState] = useState(Math.max(0.01, time));

  // Animated marker progress 0 → 1 toward the chosen spot.
  const [progress, setProgress] = useState(1);
  const prevSpotRef = useRef(initialSpot);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 240;
  const padX = 12;
  const padY = 20;

  const sMin = 0.4 * K;
  const sMax = 1.6 * K;

  // --- Black–Scholes Greek as a function of spot s. ---
  const greekAt = (kind: GreekKind, optType: OptionKind, s: number): number => {
    const sigma = volState;
    const T = timeState;
    const r = rate;
    const sqrtT = Math.sqrt(T);
    const denom = sigma * sqrtT;
    if (denom <= 0 || s <= 0) return 0;
    const d1 = (Math.log(s / K) + (r + (sigma * sigma) / 2) * T) / denom;
    const d2 = d1 - denom;
    const nd1 = normPdf(d1);
    switch (kind) {
      case 'delta':
        return optType === 'call' ? normCdf(d1) : normCdf(d1) - 1;
      case 'gamma':
        return nd1 / (s * sigma * sqrtT);
      case 'vega':
        // per 1% change in σ.
        return (s * nd1 * sqrtT) / 100;
      case 'theta': {
        const term1 = -(s * nd1 * sigma) / (2 * sqrtT);
        return optType === 'call'
          ? term1 - r * K * Math.exp(-r * T) * normCdf(d2)
          : term1 + r * K * Math.exp(-r * T) * normCdf(-d2);
      }
      default:
        return 0;
    }
  };

  // Sample the curve across the spot range to find its vertical extent.
  const SAMPLES = 120;
  const samples: { s: number; v: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const s = sMin + (i / SAMPLES) * (sMax - sMin);
    samples.push({ s, v: greekAt(greekState, typeState, s) });
  }

  let vLo = Math.min(...samples.map((p) => p.v));
  let vHi = Math.max(...samples.map((p) => p.v));
  // Pad the range a touch and guard against a flat line.
  if (vHi - vLo < 1e-9) {
    vHi += 0.5;
    vLo -= 0.5;
  } else {
    const pad = (vHi - vLo) * 0.08;
    vHi += pad;
    vLo -= pad;
  }
  // Always keep zero on screen when the curve straddles or sits near it.
  if (vLo > 0) vLo = 0;
  if (vHi < 0) vHi = 0;

  const x = (s: number) => padX + ((s - sMin) / (sMax - sMin)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - (v - vLo) / (vHi - vLo)) * (H - padY * 2);

  const curvePath = (() => {
    let d = '';
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      d += `${i === 0 ? 'M' : 'L'} ${x(p.s)} ${y(p.v)}`;
    }
    return d;
  })();

  // Animate the marker from the previous spot to the chosen one.
  useEffect(() => {
    if (prefersReducedMotion()) {
      prevSpotRef.current = spotState;
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 450;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevSpotRef.current = spotState;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // Re-run when the spot OR the curve shape changes so the marker re-seats.
  }, [spotState, greekState, typeState, volState, timeState]);

  const animSpot = prevSpotRef.current + (spotState - prevSpotRef.current) * progress;
  const markerValueAnim = greekAt(greekState, typeState, animSpot);
  const markerX = x(animSpot);
  const markerY = y(markerValueAnim);

  // Exact readout value at the (non-animated) chosen spot.
  const markerValue = greekAt(greekState, typeState, spotState);

  const greekButtons: { kind: GreekKind; label: string }[] = [
    { kind: 'delta', label: deltaLabel },
    { kind: 'gamma', label: gammaLabel },
    { kind: 'theta', label: thetaLabel },
    { kind: 'vega', label: vegaLabel },
  ];

  const activeGreekLabel = greekButtons.find((g) => g.kind === greekState)?.label ?? deltaLabel;
  const typeLabel = typeState === 'call' ? callLabel : putLabel;
  const strikeX = x(K);
  const zeroY = y(0);
  const showZeroLine = vLo < 0 && vHi > 0;

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
          {activeGreekLabel} · {typeLabel}
        </span>
      </figcaption>

      {/* Greek selector */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={title}>
        {greekButtons.map((g) => {
          const active = g.kind === greekState;
          return (
            <button
              key={g.kind}
              type="button"
              aria-pressed={active}
              onClick={() => setGreekState(g.kind)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                active
                  ? 'bg-brand-600 text-white'
                  : 'border border-ink-200 bg-surface text-ink-700 hover:border-brand-400',
              )}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Call / put toggle */}
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${callLabel} / ${putLabel}`}>
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
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. ${activeGreekLabel} of a ${typeLabel.toLowerCase()} option plotted against spot price. At a spot of ${num(
          spotState,
          2,
        )} (strike ${num(K, 2)}), ${activeGreekLabel} is ${num(
          markerValue,
        )}. The dashed vertical line marks the strike, where the option is at the money.`}
      >
        {/* Zero baseline (only when the curve crosses zero) */}
        {showZeroLine && (
          <line
            x1={padX}
            y1={zeroY}
            x2={W - padX}
            y2={zeroY}
            stroke="var(--color-ink-200)"
            strokeDasharray="4 4"
          />
        )}
        {/* Strike guide line (ATM) */}
        <line
          x1={strikeX}
          y1={padY}
          x2={strikeX}
          y2={H - padY}
          stroke="var(--color-ink-400)"
          strokeDasharray="5 4"
          opacity={0.7}
        />
        <text
          x={strikeX + 4}
          y={padY + 4}
          fontSize={11}
          fill="var(--color-ink-400)"
          dominantBaseline="hanging"
        >
          {strikeMarkerLabel} {num(K, 0)}
        </text>
        {/* Vertical guide at the marker's spot */}
        <line
          x1={markerX}
          y1={padY}
          x2={markerX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />
        {/* The Greek curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Marker riding the curve */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-brand-600)" />
      </svg>

      {/* Spot slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-spot`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{spotLabel}</span>
          <span className="font-mono text-ink-900">{num(spotState, 2)}</span>
        </label>
        <input
          id={`${id}-spot`}
          type="range"
          min={sMin}
          max={sMax}
          step={(sMax - sMin) / 200}
          value={spotState}
          onChange={(e) => setSpotState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* σ and T sliders */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            min={0.05}
            max={0.8}
            step={0.01}
            value={volState}
            onChange={(e) => setVolState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-time`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{timeLabel}</span>
            <span className="font-mono text-ink-900">{num(timeState, 2)}</span>
          </label>
          <input
            id={`${id}-time`}
            type="range"
            min={0.05}
            max={2}
            step={0.05}
            value={timeState}
            onChange={(e) => setTimeState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{spotLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(spotState, 2)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">
            {valueLabel} ({activeGreekLabel})
          </dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              markerValue < 0 ? 'text-accent-600' : 'text-brand-700',
            )}
          >
            {num(markerValue)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default GreeksCurve;
