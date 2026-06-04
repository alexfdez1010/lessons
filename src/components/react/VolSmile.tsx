import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface VolSmileProps {
  /** Heading above the chart. */
  title?: string;
  /** Initial at-the-money implied volatility (as a fraction, e.g. `0.2` = 20%). Defaults to `0.2`. */
  atmVol?: number;
  /** Initial skew / slope term. Negative tilts the curve into an equity smirk. Defaults to `-0.12`. */
  skew?: number;
  /** Initial curvature term. Positive bows the wings up into a smile. Defaults to `0.18`. */
  curvature?: number;
  /** Initial moneyness (K/S) marker position. Defaults to `1`. */
  moneyness?: number;
  /** Slider label for the ATM vol. */
  atmVolLabel?: string;
  /** Slider label for the skew term. */
  skewLabel?: string;
  /** Slider label for the curvature term. */
  curvatureLabel?: string;
  /** Slider / x-axis label for the moneyness marker. */
  moneynessLabel?: string;
  /** Readout label for the implied vol at the marker strike. */
  impliedVolLabel?: string;
  /** Preset button label — flat (Black–Scholes ideal). */
  flatPresetLabel?: string;
  /** Preset button label — equity index skew/smirk. */
  equitySkewPresetLabel?: string;
  /** Preset button label — symmetric FX smile. */
  fxSmilePresetLabel?: string;
  /** Legend label for the dashed flat Black–Scholes reference. */
  flatReferenceLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const pct = (value: number, digits = 1): string =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

// Moneyness span on the x-axis: out-of-the-money puts (left) → calls (right).
const M_MIN = 0.7;
const M_MAX = 1.3;
// Implied vol can never go negative; floor it so the curve stays sane.
const IV_FLOOR = 0.02;

interface Shape {
  atm: number;
  skew: number;
  curv: number;
}

const FLAT: Shape = { atm: 0.2, skew: 0, curv: 0 };
const EQUITY: Shape = { atm: 0.2, skew: -0.18, curv: 0.06 };
const FX: Shape = { atm: 0.12, skew: 0, curv: 0.45 };

/**
 * Interactive volatility-smile chart. Black–Scholes assumes a *single* constant
 * volatility for every strike, yet real option markets quote a different implied
 * volatility at each one — the "volatility smile / skew." This island plots
 * implied vol (y-axis) against moneyness K/S (x-axis, ~0.7 → 1.3 with ATM = 1.0
 * centered) using the tunable shape
 *   iv(m) = atmVol + skew·(1 − m) + curvature·(m − 1)²,
 * floored at a small positive value. The `skew` term tilts the line (negative →
 * the equity-index smirk, with downside puts bid up by crash fear) and the
 * `curvature` term bows both wings up into the symmetric smile typical of FX.
 *
 * Sliders expose atmVol, skew and curvature; preset buttons snap them to the
 * three canonical regimes (Flat, Equity skew, FX smile) and the curve animates
 * smoothly between them. A dashed horizontal line marks the flat Black–Scholes
 * vol so deviations are obvious, a vertical guide marks ATM (moneyness = 1.0),
 * and a draggable marker reads out the implied vol at any strike. Respects
 * `prefers-reduced-motion` (the curve snaps instead of morphing).
 */
export function VolSmile({
  title = 'One model, many volatilities',
  atmVol = 0.2,
  skew = -0.12,
  curvature = 0.18,
  moneyness = 1,
  atmVolLabel = 'At-the-money volatility',
  skewLabel = 'Skew (slope)',
  curvatureLabel = 'Curvature (smile)',
  moneynessLabel = 'Strike moneyness (K / S)',
  impliedVolLabel = 'Implied vol at this strike',
  flatPresetLabel = 'Flat',
  equitySkewPresetLabel = 'Equity skew',
  fxSmilePresetLabel = 'FX smile',
  flatReferenceLabel = 'Flat Black–Scholes vol',
  caption = 'Black–Scholes assumes one volatility for every strike — the dashed flat line. Markets disagree: equity indices bid up downside-put vol into a left-leaning smirk (crash insurance), while FX bows both wings up into a symmetric smile. Each strike trades on its own implied vol.',
  className,
}: VolSmileProps) {
  const id = useId();

  // Clamp helpers keep the live values inside the slider ranges.
  const clampAtm = (v: number) => Math.min(0.4, Math.max(0.1, v));
  const clampSkew = (v: number) => Math.min(0.4, Math.max(-0.4, v));
  const clampCurv = (v: number) => Math.min(0.6, Math.max(0, v));
  const clampM = (v: number) => Math.min(M_MAX, Math.max(M_MIN, v));

  const [atm, setAtm] = useState(() => clampAtm(atmVol));
  const [skw, setSkw] = useState(() => clampSkew(skew));
  const [curv, setCurv] = useState(() => clampCurv(curvature));
  const [m, setM] = useState(() => clampM(moneyness));

  // Animated shape that eases toward the live (atm, skw, curv) target.
  const [shape, setShape] = useState<Shape>(() => ({
    atm: clampAtm(atmVol),
    skew: clampSkew(skew),
    curv: clampCurv(curvature),
  }));
  const fromRef = useRef<Shape>(shape);
  const rafRef = useRef<number | null>(null);

  const target: Shape = { atm, skew: skw, curv };

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = target;
      setShape(target);
      return;
    }
    const from = fromRef.current;
    const to = target;
    const duration = 450;
    let startTs: number | null = null;
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const e = ease(p);
      setShape({
        atm: from.atm + (to.atm - from.atm) * e,
        skew: from.skew + (to.skew - from.skew) * e,
        curv: from.curv + (to.curv - from.curv) * e,
      });
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atm, skw, curv]);

  const W = 520;
  const H = 240;
  const padX = 36;
  const padY = 20;

  // The shape function: implied vol as a function of moneyness, floored.
  const iv = (s: Shape, mm: number) =>
    Math.max(IV_FLOOR, s.atm + s.skew * (1 - mm) + s.curv * (mm - 1) * (mm - 1));

  // y-axis spans 0 → vMax, picked from the extremes so the curve always fits.
  const vMax = (() => {
    const candidates = [
      iv(shape, M_MIN),
      iv(shape, M_MAX),
      iv(target, M_MIN),
      iv(target, M_MAX),
      shape.atm,
      0.45,
    ];
    return Math.max(...candidates) * 1.12;
  })();

  const x = (mm: number) => padX + ((mm - M_MIN) / (M_MAX - M_MIN)) * (W - padX * 2);
  const y = (v: number) => padY + (1 - v / vMax) * (H - padY * 2);

  const SAMPLES = 80;
  const buildPath = (s: Shape) => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const mm = M_MIN + (i / SAMPLES) * (M_MAX - M_MIN);
      d += `${i === 0 ? 'M' : 'L'} ${x(mm)} ${y(iv(s, mm))}`;
    }
    return d;
  };

  const curvePath = buildPath(shape);

  const atmX = x(1);
  const flatY = y(shape.atm); // dashed Black–Scholes reference at the ATM vol

  const markerIv = iv(shape, m);
  const markerX = x(m);
  const markerY = y(markerIv);

  // y-axis ticks at a few volatility levels for orientation.
  const yTicks = (() => {
    const ticks: number[] = [];
    const stepSize = vMax > 0.4 ? 0.1 : 0.05;
    for (let v = 0; v <= vMax; v += stepSize) ticks.push(v);
    return ticks;
  })();

  const applyPreset = (p: Shape) => {
    fromRef.current = shape;
    setAtm(p.atm);
    setSkw(p.skew);
    setCurv(p.curv);
  };

  const presetActive = (p: Shape) =>
    Math.abs(atm - p.atm) < 1e-6 &&
    Math.abs(skw - p.skew) < 1e-6 &&
    Math.abs(curv - p.curv) < 1e-6;

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
          {impliedVolLabel}: {pct(markerIv)}
        </span>
      </figcaption>

      {/* Preset buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            [flatPresetLabel, FLAT],
            [equitySkewPresetLabel, EQUITY],
            [fxSmilePresetLabel, FX],
          ] as const
        ).map(([label, preset]) => (
          <button
            key={label}
            type="button"
            onClick={() => applyPreset(preset)}
            aria-pressed={presetActive(preset)}
            className={cx(
              'rounded-pill border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              presetActive(preset)
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-200 bg-surface text-ink-700 hover:border-brand-500 hover:text-brand-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. The implied-volatility curve plotted against strike moneyness from ${num(
          M_MIN,
        )} to ${num(
          M_MAX,
        )}. At-the-money implied vol is ${pct(shape.atm)}, and at moneyness ${num(
          m,
        )} the implied vol reads ${pct(
          markerIv,
        )}. The dashed horizontal line marks the flat Black–Scholes volatility for comparison.`}
      >
        {/* y-axis gridlines + tick labels */}
        {yTicks.map((v) => (
          <g key={`yt-${v}`}>
            <line
              x1={padX}
              y1={y(v)}
              x2={W - padX}
              y2={y(v)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={padX - 6}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="var(--color-ink-400)"
            >
              {pct(v, 0)}
            </text>
          </g>
        ))}

        {/* x-axis tick labels at key moneyness points */}
        {[M_MIN, 0.85, 1, 1.15, M_MAX].map((mm) => (
          <text
            key={`xt-${mm}`}
            x={x(mm)}
            y={H - 4}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-ink-400)"
          >
            {num(mm)}
          </text>
        ))}

        {/* Dashed flat Black–Scholes reference at the ATM vol */}
        <line
          x1={padX}
          y1={flatY}
          x2={W - padX}
          y2={flatY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />

        {/* Vertical ATM guide at moneyness = 1.0 */}
        <line
          x1={atmX}
          y1={padY}
          x2={atmX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeDasharray="4 4"
        />

        {/* Vertical guide at the marker strike */}
        <line
          x1={markerX}
          y1={padY}
          x2={markerX}
          y2={H - padY}
          stroke="var(--color-accent-500)"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.7}
        />

        {/* The implied-vol curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Marker riding the curve at the chosen strike */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-accent-500)" />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-atm`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{atmVolLabel}</span>
            <span className="font-mono text-ink-900">{pct(atm)}</span>
          </label>
          <input
            id={`${id}-atm`}
            type="range"
            min={0.1}
            max={0.4}
            step={0.005}
            value={atm}
            onChange={(e) => {
              fromRef.current = shape;
              setAtm(clampAtm(Number(e.target.value)));
            }}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-skew`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{skewLabel}</span>
            <span className="font-mono text-ink-900">{num(skw)}</span>
          </label>
          <input
            id={`${id}-skew`}
            type="range"
            min={-0.4}
            max={0.4}
            step={0.01}
            value={skw}
            onChange={(e) => {
              fromRef.current = shape;
              setSkw(clampSkew(Number(e.target.value)));
            }}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-curv`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{curvatureLabel}</span>
            <span className="font-mono text-ink-900">{num(curv)}</span>
          </label>
          <input
            id={`${id}-curv`}
            type="range"
            min={0}
            max={0.6}
            step={0.01}
            value={curv}
            onChange={(e) => {
              fromRef.current = shape;
              setCurv(clampCurv(Number(e.target.value)));
            }}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>

        <div>
          <label
            htmlFor={`${id}-m`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{moneynessLabel}</span>
            <span className="font-mono text-ink-900">{num(m)}</span>
          </label>
          <input
            id={`${id}-m`}
            type="range"
            min={M_MIN}
            max={M_MAX}
            step={0.01}
            value={m}
            onChange={(e) => setM(clampM(Number(e.target.value)))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{impliedVolLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{pct(markerIv)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="flex items-center gap-2 text-ink-500">
            <span
              className="inline-block h-0 w-5 border-t-2 border-dashed border-ink-400"
              aria-hidden="true"
            />
            {flatReferenceLabel}
          </dt>
          <dd className="font-mono text-lg font-semibold text-ink-700">{pct(shape.atm)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default VolSmile;
