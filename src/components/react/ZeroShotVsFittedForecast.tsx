import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

type Regime = 'stationary' | 'financial';

export interface ZeroShotVsFittedForecastProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the "seasonal / near-stationary" regime button. */
  stationaryLabel?: string;
  /** Label for the "financial returns" regime button. */
  financialLabel?: string;
  /** Legend label for the realized future path. */
  actualLabel?: string;
  /** Legend label for the zero-shot foundation-model forecast. */
  zeroShotLabel?: string;
  /** Legend label for the fitted / local-model forecast. */
  fittedLabel?: string;
  /** Legend / readout label for the naive baseline. */
  naiveLabel?: string;
  /** Label for the error readout block. */
  errorLabel?: string;
  /** One-line takeaway under the chart. */
  caption?: string;
  className?: string;
}

// ── Deterministic, SSR-stable synthetic data ──────────────────────────────
// A tiny seeded LCG (numerical-recipes constants) gives reproducible "noise"
// without Math.random, so server and client render byte-identical series.
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296; // → [0, 1)
  };
}
// Box-Muller-ish symmetric noise in roughly [-1, 1] from two uniforms.
function noise(rng: () => number): number {
  return rng() + rng() - 1;
}

const HISTORY = 32; // history points (solid)
const FUTURE = 16; // forecast horizon
const N = HISTORY + FUTURE;

interface Series {
  history: number[]; // length HISTORY
  actual: number[]; // length FUTURE — realized future
  zeroShot: number[]; // length FUTURE
  fitted: number[]; // length FUTURE
}

// Seasonal / near-stationary: clean sine + small noise. A zero-shot model that
// has seen a million periodic series locks straight onto the cycle; a fitted
// local model recovers it too. Both track the realized future closely.
function buildStationary(): Series {
  const rng = lcg(20240131);
  const period = 12;
  const wave = (t: number) => Math.sin((2 * Math.PI * t) / period);

  const history: number[] = [];
  for (let t = 0; t < HISTORY; t++) history.push(wave(t) + 0.18 * noise(rng));

  const actual: number[] = [];
  const zeroShot: number[] = [];
  const fitted: number[] = [];
  for (let k = 0; k < FUTURE; k++) {
    const t = HISTORY + k;
    actual.push(wave(t) + 0.18 * noise(rng));
    // Forecasts know the cycle → near-perfect, tiny lag/amplitude error only.
    zeroShot.push(wave(t) * 0.99);
    fitted.push(wave(t - 0.15) * 0.97);
  }
  return { history, actual, zeroShot, fitted };
}

// Financial returns: a drifting random walk with a volatility regime change
// partway through the future. No periodicity, no mean to revert to fast — so
// every forecaster collapses onto "tomorrow ≈ today / recent average" and the
// realized path wanders away from all of them. This is the adversarial case.
function buildFinancial(): Series {
  const rng = lcg(815);
  let level = 0;
  const history: number[] = [];
  for (let t = 0; t < HISTORY; t++) {
    level += 0.02 + 0.55 * noise(rng); // small drift + fat-ish shocks
    history.push(level);
  }
  const lastLevel = level;

  // The realized future: drift flips and volatility roughly doubles — a regime
  // shift no model could have read off the history.
  const actual: number[] = [];
  let f = lastLevel;
  for (let k = 0; k < FUTURE; k++) {
    const vol = k < FUTURE / 2 ? 0.7 : 1.3;
    f += -0.08 + vol * noise(rng);
    actual.push(f);
  }

  // Zero-shot: best guess on a random walk is the last value, flat-lined (with
  // a hair of imagined mean-pull). Fitted: an AR/local model extrapolates the
  // recent slope a touch — neither is anywhere near the realized wander.
  const recentSlope =
    (history[HISTORY - 1] - history[HISTORY - 6]) / 5; // last-5 average step
  const zeroShot: number[] = [];
  const fitted: number[] = [];
  for (let k = 0; k < FUTURE; k++) {
    zeroShot.push(lastLevel + 0.04 * (k + 1)); // ~flat persistence forecast
    fitted.push(lastLevel + recentSlope * (k + 1) * 0.6); // damped local trend
  }
  return { history, actual, zeroShot, fitted };
}

// ── Illustrative, baked-in error scores (MASE-style, naive = 1.0) ─────────
// On the clean series the foundation model crushes the naive baseline; on the
// market series every model lands a whisker away from naive — no edge.
const STATIONARY_ERR = { zeroShot: 0.3, fitted: 0.34, naive: 1.0 } as const;
const FINANCIAL_ERR = { zeroShot: 0.97, fitted: 0.95, naive: 1.0 } as const;

/**
 * ZeroShotVsFittedForecast — the skeptic's exhibit for "Foundation Models for
 * Financial Time Series".
 *
 * Teaching point: a zero-shot time-series foundation model (one that forecasts a
 * brand-new series it was never fitted to, off pretraining alone) genuinely
 * shines on clean, near-stationary data — a seasonal, weather-like signal where
 * the future rhymes with the past. Flip to a noisy, non-stationary FINANCIAL
 * return series — a drifting random walk with a regime/volatility shift — and
 * the magic evaporates: the zero-shot model, a fitted local model, AND the naive
 * "tomorrow = today" baseline all post nearly identical error. A leaderboard win
 * on benign benchmarks does not transfer to a tradeable edge, because there is
 * almost no exploitable structure to forecast in returns. Benchmark MASE is not
 * PnL.
 *
 * The chart shows a solid HISTORY segment, the dashed realized ACTUAL future, and
 * two forecast lines (zero-shot, fitted). The error readout reports MASE-style
 * scores (naive baseline ≡ 1.0) for both regimes so the collapse is legible: on
 * stationary data zero-shot ≈ 0.30 vs naive 1.0; on financial data zero-shot ≈
 * 0.97 vs naive 1.0.
 *
 * Deterministic by construction (seeded LCG, no Math.random / Date.now) so it is
 * SSR-stable. All user-facing strings are props with English defaults; colors are
 * design tokens; motion is none, so prefers-reduced-motion is a no-op.
 */
export function ZeroShotVsFittedForecast({
  title = 'Zero-shot vs fitted: when forecasting actually pays',
  stationaryLabel = 'Seasonal / near-stationary',
  financialLabel = 'Financial returns',
  actualLabel = 'Actual (realized future)',
  zeroShotLabel = 'Zero-shot foundation model',
  fittedLabel = 'Fitted local model',
  naiveLabel = 'Naive baseline',
  errorLabel = 'Forecast error (MASE-style, ↓ better)',
  caption = 'On near-stationary, seasonal data the zero-shot foundation model transfers beautifully — it crushes the naive baseline without ever being fitted to this series. On adversarial, non-stationary markets it collapses toward the naive baseline: the zero-shot model, a fitted local model and "tomorrow = today" all post nearly identical error, because there is almost no exploitable structure in returns. A leaderboard win is not a tradeable edge — benchmark MASE is not PnL.',
  className,
}: ZeroShotVsFittedForecastProps) {
  const id = useId();
  const [regime, setRegime] = useState<Regime>('stationary');

  const stationary = useMemo(buildStationary, []);
  const financial = useMemo(buildFinancial, []);
  const series = regime === 'stationary' ? stationary : financial;
  const err = regime === 'stationary' ? STATIONARY_ERR : FINANCIAL_ERR;

  // ── Layout & scaling ────────────────────────────────────────────────────
  const W = 560;
  const H = 300;
  const padL = 40;
  const padR = 14;
  const padT = 18;
  const padB = 44;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Full y-range across every line so nothing clips.
  const all = [
    ...series.history,
    ...series.actual,
    ...series.zeroShot,
    ...series.fitted,
  ];
  const yMin = Math.min(...all);
  const yMax = Math.max(...all);
  const yPad = (yMax - yMin) * 0.08 || 1;
  const lo = yMin - yPad;
  const hi = yMax + yPad;

  const xAt = (i: number) => padL + (i / (N - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * plotH;

  // Build SVG path strings. Forecast lines start at the last history point so
  // they visibly fork from the same anchor.
  const toPath = (pts: { i: number; v: number }[]) =>
    pts
      .map((p, k) => `${k === 0 ? 'M' : 'L'} ${xAt(p.i).toFixed(1)} ${yAt(p.v).toFixed(1)}`)
      .join(' ');

  const lastHistI = HISTORY - 1;
  const lastHistV = series.history[lastHistI];

  const historyPath = toPath(series.history.map((v, i) => ({ i, v })));
  const anchor = { i: lastHistI, v: lastHistV };
  const actualPath = toPath([
    anchor,
    ...series.actual.map((v, k) => ({ i: HISTORY + k, v })),
  ]);
  const zeroShotPath = toPath([
    anchor,
    ...series.zeroShot.map((v, k) => ({ i: HISTORY + k, v })),
  ]);
  const fittedPath = toPath([
    anchor,
    ...series.fitted.map((v, k) => ({ i: HISTORY + k, v })),
  ]);

  const forecastX = xAt(HISTORY - 1);

  const fmt = (n: number) => n.toFixed(2);
  const regimeName = regime === 'stationary' ? stationaryLabel : financialLabel;
  const liveLabel =
    `Forecast comparison on the ${regimeName} regime. ` +
    `${errorLabel}: ${zeroShotLabel} ${fmt(err.zeroShot)}, ` +
    `${fittedLabel} ${fmt(err.fitted)}, ${naiveLabel} ${fmt(err.naive)}.`;

  const regimeButtons: { key: Regime; label: string }[] = [
    { key: 'stationary', label: stationaryLabel },
    { key: 'financial', label: financialLabel },
  ];

  const COLORS = {
    history: 'var(--color-ink-900)',
    actual: 'var(--color-ink-500)',
    zeroShot: 'var(--color-brand-500)',
    fitted: 'var(--color-accent-500)',
    naive: 'var(--color-ink-500)',
  } as const;

  const errorRows: {
    key: keyof typeof err;
    label: string;
    color: string;
    value: number;
  }[] = [
    { key: 'zeroShot', label: zeroShotLabel, color: COLORS.zeroShot, value: err.zeroShot },
    { key: 'fitted', label: fittedLabel, color: COLORS.fitted, value: err.fitted },
    { key: 'naive', label: naiveLabel, color: COLORS.naive, value: err.naive },
  ];

  // Best (lowest) score, for highlighting.
  const best = Math.min(err.zeroShot, err.fitted, err.naive);

  const legend: { label: string; color: string; dashed?: boolean }[] = [
    { label: actualLabel, color: COLORS.actual, dashed: true },
    { label: zeroShotLabel, color: COLORS.zeroShot },
    { label: fittedLabel, color: COLORS.fitted },
  ];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Regime toggle */}
      <div
        className="mt-4 inline-flex flex-wrap rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="forecasting regime"
      >
        {regimeButtons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setRegime(b.key)}
            aria-pressed={regime === b.key}
            className={cx(
              'rounded-pill px-3 py-1 font-medium transition',
              regime === b.key ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={liveLabel}
      >
        {/* Forecast cutoff: a faint band marking the future region. */}
        <rect
          x={forecastX}
          y={padT}
          width={W - padR - forecastX}
          height={plotH}
          fill="var(--color-surface-50)"
        />
        <line
          x1={forecastX}
          y1={padT}
          x2={forecastX}
          y2={padT + plotH}
          stroke="var(--color-ink-100)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text
          x={forecastX + 4}
          y={padT + 12}
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          forecast →
        </text>

        {/* Baseline axis */}
        <line
          x1={padL}
          y1={padT + plotH}
          x2={W - padR}
          y2={padT + plotH}
          stroke="var(--color-ink-100)"
          strokeWidth={1}
        />

        {/* History (solid) */}
        <path
          d={historyPath}
          fill="none"
          stroke={COLORS.history}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Actual future (dashed) */}
        <path
          d={actualPath}
          fill="none"
          stroke={COLORS.actual}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Fitted forecast */}
        <path
          d={fittedPath}
          fill="none"
          stroke={COLORS.fitted}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Zero-shot forecast */}
        <path
          d={zeroShotPath}
          fill="none"
          stroke={COLORS.zeroShot}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Anchor dot where forecasts fork from history */}
        <circle cx={forecastX} cy={yAt(lastHistV)} r={3} fill={COLORS.history} />

        <text x={padL} y={H - 8} fontSize={10} fill="var(--color-ink-500)">
          time →
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-700">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <svg width={20} height={8} aria-hidden="true">
              <line
                x1={0}
                y1={4}
                x2={20}
                y2={4}
                stroke={l.color}
                strokeWidth={2}
                strokeDasharray={l.dashed ? '4 3' : undefined}
              />
            </svg>
            {l.label}
          </span>
        ))}
      </div>

      {/* Error readout */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-50 p-3">
        <div className="text-sm font-medium text-ink-700">{errorLabel}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {errorRows.map((r) => {
            const isBest = r.value === best;
            return (
              <span
                key={r.key}
                className={cx(
                  'inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-sm',
                  isBest
                    ? 'border-brand-200 bg-surface'
                    : 'border-ink-100 bg-surface',
                )}
              >
                <span
                  className="inline-block h-2 w-2 rounded-pill"
                  style={{ backgroundColor: r.color }}
                  aria-hidden="true"
                />
                <span className="text-ink-600">{r.label}</span>
                <span
                  className={cx(
                    'font-mono font-semibold',
                    isBest ? 'text-brand-600' : 'text-ink-700',
                  )}
                >
                  {fmt(r.value)}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <p
        className="mt-3 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
        id={`${id}-caption`}
      >
        {caption}
      </p>
    </figure>
  );
}

export default ZeroShotVsFittedForecast;
