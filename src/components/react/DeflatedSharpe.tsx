import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DeflatedSharpeProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the number-of-trials slider + N chip. */
  trialsLabel?: string;
  /** Label for the observed-Sharpe slider + observed line. */
  observedLabel?: string;
  /** Label for the rising luck-hurdle curve (expected max under the null). */
  hurdleLabel?: string;
  /** Label for the "deflated edge" chip (observed − hurdle). */
  deflatedLabel?: string;
  /** Label for the y-axis (Sharpe ratio). */
  sharpeAxisLabel?: string;
  /** Label for the optional trial-dispersion (σ_SR) slider. */
  dispersionLabel?: string;
  /** One-paragraph takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

/**
 * Inverse standard-normal CDF (probit / quantile function) via the Acklam
 * rational approximation (Beasley–Springer–Moro family). Accurate to ~1e-9
 * over the full open interval (0, 1). p is clamped to (1e-12, 1−1e-12).
 */
function invNormCdf(p: number): number {
  const pp = Math.min(Math.max(p, 1e-12), 1 - 1e-12);

  // Coefficients for the rational approximation.
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

  // Break-points defining the three regions of the approximation.
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (pp < pLow) {
    // Lower region.
    q = Math.sqrt(-2 * Math.log(pp));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (pp <= pHigh) {
    // Central region.
    q = pp - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  // Upper region.
  q = Math.sqrt(-2 * Math.log(1 - pp));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

const EULER_GAMMA = 0.5772156649015329;
const E = Math.E;

/**
 * Expected maximum Sharpe under the null (true Sharpe = 0) across N i.i.d.
 * trials, using the Bailey & López de Prado approximation:
 *
 *   E[max SR] ≈ σ_SR · [ (1−γ)·Z⁻¹(1 − 1/N) + γ·Z⁻¹(1 − 1/(N·e)) ]
 *
 * For N = 1 the expected maximum is 0 (a single draw has zero expected max
 * under the symmetric null); we floor at 0 to keep the curve sane.
 */
function expectedMaxSharpe(n: number, sigma: number): number {
  if (n <= 1) return 0;
  const term1 = (1 - EULER_GAMMA) * invNormCdf(1 - 1 / n);
  const term2 = EULER_GAMMA * invNormCdf(1 - 1 / (n * E));
  return Math.max(0, sigma * (term1 + term2));
}

// Slider maps [0,1] → N = round(10^(s·3)) ∈ [1, 1000].
const sliderToN = (s: number): number =>
  Math.max(1, Math.min(1000, Math.round(10 ** (s * 3))));
const nToSlider = (n: number): number => Math.log10(n) / 3;

/**
 * The Deflated Sharpe Ratio / backtest multiple-testing trap. Try N strategy
 * configurations on the same data and, even if none has true edge, the BEST
 * one's Sharpe is inflated by luck: under the null its expected maximum rises
 * with N. This island plots that rising "luck hurdle" E[max SR](N) on a log-N
 * axis against the learner's observed best Sharpe, and reports the deflated
 * edge (observed − hurdle). Pure SVG, design-token colors, CSS-eased
 * transitions; respects prefers-reduced-motion globally.
 */
export function DeflatedSharpe({
  title = 'The deflated Sharpe: how luck inflates your best backtest',
  trialsLabel = 'Strategy configurations tried (N)',
  observedLabel = 'Observed best Sharpe',
  hurdleLabel = 'Expected max Sharpe under the null (luck hurdle)',
  deflatedLabel = 'Deflated edge',
  sharpeAxisLabel = 'Sharpe ratio',
  dispersionLabel = 'Trial dispersion (σ of Sharpe estimates)',
  caption = 'Try enough configurations on the same history and one of them looks great by pure chance. Under the null (no real edge), the expected maximum Sharpe of N trials climbs with N — that rising accent curve is the luck hurdle. The deflated Sharpe haircuts your observed best Sharpe by this hurdle: only an observed Sharpe that clears the curve at your N is credible edge. If the deflated edge is zero or negative, your "winner" is indistinguishable from luck — overfitting, not alpha.',
  className,
}: DeflatedSharpeProps) {
  const id = useId();
  const [trialsSlider, setTrialsSlider] = useState(nToSlider(50));
  const [observed, setObserved] = useState(1.4);
  const [sigma, setSigma] = useState(0.5);

  const n = sliderToN(trialsSlider);
  const hurdle = expectedMaxSharpe(n, sigma);
  const deflated = observed - hurdle;
  const positiveEdge = deflated > 0;

  const W = 520;
  const H = 240;
  const padLeft = 44;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 38;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // Y-axis range adapts so both the hurdle at N=1000 and the observed line fit.
  const yMax = Math.max(
    3,
    Math.ceil(Math.max(observed, expectedMaxSharpe(1000, sigma)) * 1.15 * 2) / 2,
  );

  // X is log10(N) over [0, 3] (N from 1 to 1000).
  const logMax = 3;
  const xToPx = (logN: number) => padLeft + (logN / logMax) * plotW;
  const yToPx = (v: number) => padTop + (1 - v / yMax) * plotH;

  // Build the hurdle curve sampling across log-N.
  const STEPS = 60;
  let hurdleD = '';
  for (let i = 0; i <= STEPS; i++) {
    const logN = (i / STEPS) * logMax;
    const ni = 10 ** logN;
    const y = expectedMaxSharpe(ni, sigma);
    hurdleD += `${i === 0 ? 'M' : 'L'} ${xToPx(logN).toFixed(2)} ${yToPx(y).toFixed(2)} `;
  }
  hurdleD = hurdleD.trim();

  const curX = xToPx(Math.log10(n));
  const curHurdleY = yToPx(hurdle);
  const observedY = yToPx(Math.min(observed, yMax));

  // X-axis gridlines at decade boundaries 1, 10, 100, 1000.
  const decades = [
    { logN: 0, label: '1' },
    { logN: 1, label: '10' },
    { logN: 2, label: '100' },
    { logN: 3, label: '1000' },
  ];

  // Y-axis ticks every 0.5.
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax + 1e-9; v += 0.5) yTicks.push(Number(v.toFixed(2)));

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {hurdleLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {observedLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`The expected maximum Sharpe ratio under the null hypothesis rises as the number of strategy configurations N grows on a logarithmic axis. At N equal to ${n} the luck hurdle is ${hurdle.toFixed(2)} while the observed Sharpe is ${observed.toFixed(2)}, a deflated edge of ${deflated.toFixed(2)}.`}
      >
        {/* Y gridlines + ticks */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padLeft}
              y1={yToPx(v)}
              x2={W - padRight}
              y2={yToPx(v)}
              stroke="var(--color-ink-100)"
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={yToPx(v) + 3}
              fontSize={10}
              fill="var(--color-ink-700)"
              textAnchor="end"
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X axis baseline + decade ticks */}
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={W - padRight}
          y2={padTop + plotH}
          stroke="var(--color-ink-300)"
        />
        {decades.map((dch) => (
          <text
            key={`x-${dch.label}`}
            x={xToPx(dch.logN)}
            y={padTop + plotH + 14}
            fontSize={10}
            fill="var(--color-ink-700)"
            textAnchor="middle"
          >
            {dch.label}
          </text>
        ))}

        {/* Observed Sharpe horizontal line */}
        <line
          x1={padLeft}
          y1={observedY}
          x2={W - padRight}
          y2={observedY}
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          strokeDasharray="2 0"
          style={{ transition: 'all 250ms ease' }}
        />

        {/* Rising luck hurdle curve */}
        <path
          d={hurdleD}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'all 250ms ease' }}
        />

        {/* Vertical connector: gap between observed and hurdle at current N */}
        <line
          x1={curX}
          y1={observedY}
          x2={curX}
          y2={curHurdleY}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          style={{ transition: 'all 250ms ease' }}
        />

        {/* Marker on the hurdle curve at current N */}
        <circle
          cx={curX}
          cy={curHurdleY}
          r={4.5}
          fill="var(--color-accent-500)"
          style={{ transition: 'all 250ms ease' }}
        />
        {/* Marker where observed line sits at current N */}
        <circle
          cx={curX}
          cy={observedY}
          r={4.5}
          fill="var(--color-brand-500)"
          style={{ transition: 'all 250ms ease' }}
        />

        {/* Axis titles */}
        <text
          x={padLeft + plotW / 2}
          y={H - 4}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {trialsLabel}
        </text>
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {sharpeAxisLabel}
        </text>
      </svg>

      {/* Verdict chips */}
      <div className="mt-3 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">N</span>
          <span className="font-mono font-semibold text-ink-900">{n}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{hurdleLabel}</span>
          <span className="font-mono font-semibold text-accent-600">
            {hurdle.toFixed(2)}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{observedLabel}</span>
          <span className="font-mono font-semibold text-brand-600">
            {observed.toFixed(2)}
          </span>
        </span>
        <span
          className={cx(
            'inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-sm',
            positiveEdge
              ? 'border-success/30 bg-success/10'
              : 'border-warning/30 bg-warning/10',
          )}
        >
          <span className="text-ink-600">{deflatedLabel}</span>
          <span
            className={cx(
              'font-mono font-semibold',
              positiveEdge ? 'text-success' : 'text-warning',
            )}
          >
            {deflated >= 0 ? '+' : ''}
            {deflated.toFixed(2)}
          </span>
        </span>
      </div>

      {!positiveEdge && (
        <p className="mt-2 text-sm font-medium text-warning" aria-live="polite">
          Indistinguishable from luck — the observed Sharpe does not clear the
          hurdle.
        </p>
      )}

      {/* Sliders */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-trials`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{trialsLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {n}
          </span>
        </label>
        <input
          id={`${id}-trials`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={trialsSlider}
          onChange={(e) => setTrialsSlider(Number(e.target.value))}
          aria-valuetext={`${n} configurations tried`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${id}-observed`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{observedLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {observed.toFixed(2)}
          </span>
        </label>
        <input
          id={`${id}-observed`}
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={observed}
          onChange={(e) => setObserved(Number(e.target.value))}
          aria-valuetext={`observed Sharpe ${observed.toFixed(2)}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${id}-sigma`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{dispersionLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {sigma.toFixed(2)}
          </span>
        </label>
        <input
          id={`${id}-sigma`}
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={sigma}
          onChange={(e) => setSigma(Number(e.target.value))}
          aria-valuetext={`trial dispersion ${sigma.toFixed(2)}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default DeflatedSharpe;
