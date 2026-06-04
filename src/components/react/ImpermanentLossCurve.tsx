import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface ImpermanentLossCurveProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the price-change slider (the volatile asset's move). */
  priceChangeLabel?: string;
  /** Label for the price-ratio readout. Defaults to `'Price ratio (r)'`. */
  ratioLabel?: string;
  /** Label for the impermanent-loss readout. Defaults to `'Impermanent loss'`. */
  ilLabel?: string;
  /** Label for the HODL-value readout. Defaults to `'HODL value'`. */
  hodlLabel?: string;
  /** Label for the LP-value readout. Defaults to `'LP value'`. */
  lpLabel?: string;
  /** Label for the dollar-gap (HODL − LP) readout. */
  gapLabel?: string;
  /** Label for the fees-earned slider / readout. */
  feesLabel?: string;
  /** Label for the net (IL + fees) readout. */
  netLabel?: string;
  /** Verdict shown when fees ≥ |IL|. Defaults to `'Fees cover the impermanent loss'`. */
  feesCoverLabel?: string;
  /** Verdict shown when |IL| > fees. Defaults to `'Impermanent loss wins'`. */
  ilWinsLabel?: string;
  /** Starting 50/50 deposit value (in `currencyPrefix`). Defaults to `10000`. */
  depositValue?: number;
  /** Lowest price ratio on the x-axis / slider. Defaults to `0.1`. */
  minRatio?: number;
  /** Highest price ratio on the x-axis / slider. Defaults to `10`. */
  maxRatio?: number;
  /** Initial price ratio the marker starts at. Defaults to `2`. */
  initialRatio?: number;
  /** Trading fees earned, as a percent of position (e.g. `5` = 5%). Defaults to `0`. */
  feesEarnedPct?: number;
  /** Slider step (in percent of price change). Defaults to `1`. */
  step?: number;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Currency symbol prefixed to money values. Defaults to `'$'`. */
  currencyPrefix?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const money = (prefix: string, value: number, digits = 0): string =>
  `${value < 0 ? '-' : ''}${prefix}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

/** Impermanent loss for a 50/50 constant-product pool at price ratio r. ≤ 0. */
const ilFraction = (r: number): number => (2 * Math.sqrt(r)) / (1 + r) - 1;

/**
 * Interactive impermanent-loss explainer for a 50/50 constant-product LP.
 *
 * When one pooled asset's price moves relative to the other, arbitrageurs
 * rebalance the pool — buying the loser, selling the winner — so the LP ends up
 * with LESS value than simply HODLing the two tokens. The shortfall is the
 * closed-form impermanent loss `IL(r) = 2·√r/(1+r) − 1`, zero at `r = 1` and
 * negative on either side (≈ −5.72% at r=2 or r=0.5, −20% at r=4).
 *
 * The learner drags a slider for the volatile asset's price change (mapped to a
 * ratio `r`); the chart plots IL% across a log-spaced ratio axis with an
 * animated marker on the current `r`, and a `<dl>` reads out r, IL%, the HODL
 * vs LP dollar values for a configurable 50/50 deposit, and their gap. An
 * optional fees-earned slider shows trading fees offsetting IL with a verdict.
 * `prefers-reduced-motion` snaps the marker; all strings are locale-agnostic
 * props.
 */
export function ImpermanentLossCurve({
  title = 'Impermanent loss vs. price change',
  priceChangeLabel = 'Volatile-asset price change',
  ratioLabel = 'Price ratio (r)',
  ilLabel = 'Impermanent loss',
  hodlLabel = 'HODL value',
  lpLabel = 'LP value',
  gapLabel = 'Gap vs. HODL',
  feesLabel = 'Fees earned',
  netLabel = 'Net vs. HODL',
  feesCoverLabel = 'Fees cover the impermanent loss',
  ilWinsLabel = 'Impermanent loss wins',
  depositValue = 10000,
  minRatio = 0.1,
  maxRatio = 10,
  initialRatio = 2,
  feesEarnedPct = 0,
  step = 1,
  caption =
    "Impermanent loss is the cost of being the AMM's counterparty during a price move: flat or mean-reverting prices mean tiny IL, big one-way moves mean large IL, and trading fees are what compensate LPs for bearing it.",
  currencyPrefix = '$',
  className,
}: ImpermanentLossCurveProps) {
  const id = useId();

  // Work in log-space so the slider/x-axis treat 0.1× and 10× symmetrically.
  const logMin = Math.log(minRatio);
  const logMax = Math.log(maxRatio);
  const clampRatio = (r: number): number => Math.min(maxRatio, Math.max(minRatio, r));

  // Slider value is "percent price change" of the volatile asset (r − 1) × 100.
  const ratioToPct = (r: number): number => (r - 1) * 100;
  const pctToRatio = (pct: number): number => 1 + pct / 100;
  const minPct = ratioToPct(minRatio);
  const maxPct = ratioToPct(maxRatio);

  const [pct, setPct] = useState(ratioToPct(clampRatio(initialRatio)));
  const ratio = clampRatio(pctToRatio(pct));

  const [fees, setFees] = useState(Math.max(0, feesEarnedPct));

  // Animated ratio (in log-space) the marker renders against.
  const [shownLog, setShownLog] = useState(Math.log(ratio));
  const rafRef = useRef<number | null>(null);

  const W = 540;
  const H = 220;
  const padL = 46;
  const padR = 18;
  const padT = 16;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Lowest IL across the visible range sets the y-axis floor (most negative).
  const ilFloor = Math.min(ilFraction(minRatio), ilFraction(maxRatio));
  const yFloor = Math.min(-0.05, ilFloor); // always show some depth

  const logToX = (lr: number): number =>
    padL + ((lr - logMin) / (logMax - logMin)) * plotW;
  const ilToY = (il: number): number => padT + (il / yFloor) * plotH; // il ≤ 0, yFloor < 0

  // IL curve polyline.
  const SAMPLES = 80;
  const curvePoints: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const lr = logMin + ((logMax - logMin) * i) / SAMPLES;
    const r = Math.exp(lr);
    curvePoints.push(`${logToX(lr).toFixed(2)},${ilToY(ilFraction(r)).toFixed(2)}`);
  }
  const curveD = curvePoints.join(' ');

  // Animate the marker toward the new ratio whenever it changes.
  useEffect(() => {
    const target = Math.log(ratio);
    if (prefersReducedMotion()) {
      setShownLog(target);
      return;
    }
    let startTs: number | null = null;
    const start = shownLog;
    const delta = target - start;
    if (Math.abs(delta) < 1e-4) {
      setShownLog(target);
      return;
    }
    const duration = 420;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShownLog(start + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownLog intentionally omitted so frames don't restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratio]);

  // ---- The dollar math (must be exact) ----------------------------------
  // Start: 50/50 deposit. Half the value buys the stable asset, half the
  // volatile asset, both worth depositValue/2 at the start (price = 1 unit).
  const half = depositValue / 2;
  // HODL: just keep both bags. The stable half is unchanged; the volatile
  // half scales with the price ratio r.
  const hodlValue = half + half * ratio;
  // LP: constant-product rebalancing leaves you with HODL × (1 + IL).
  const il = ilFraction(ratio); // ≤ 0
  const lpValue = hodlValue * (1 + il);
  const gap = hodlValue - lpValue; // ≥ 0, the dollars IL costs you
  const ilPct = il * 100;

  // Fees offset IL (earned as % of the LP position).
  const feesDollars = lpValue * (fees / 100);
  const netPct = ilPct + fees;
  const feesCover = fees >= Math.abs(ilPct);

  const markerLR = shownLog;
  const markerX = logToX(markerLR);
  const markerY = ilToY(ilFraction(Math.exp(markerLR)));

  const fmtPct = (v: number, digits = 2): string =>
    `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`;

  const fmtRatio = (r: number): string => `${r.toFixed(2)}×`;

  // Gridline ratios for the x-axis.
  const gridRatios = [minRatio, 0.5, 1, 2, 4, maxRatio].filter(
    (r) => r >= minRatio && r <= maxRatio,
  );

  const ariaLabel = `${title}. ${ratioLabel}: ${fmtRatio(ratio)}. ${ilLabel}: ${fmtPct(
    ilPct,
  )}. ${hodlLabel}: ${money(currencyPrefix, hodlValue)}. ${lpLabel}: ${money(
    currencyPrefix,
    lpValue,
  )}.`;

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            Math.abs(ilPct) < 0.005 ? 'bg-success' : 'bg-warning',
          )}
        >
          {fmtPct(ilPct)}
        </span>
      </figcaption>

      {/* IL curve */}
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={ariaLabel}>
        {/* y gridlines (0% at top, floor at bottom) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const il = yFloor * t;
          const y = ilToY(il);
          return (
            <g key={`y-${t}`}>
              <line
                x1={padL}
                y1={y}
                x2={W - padR}
                y2={y}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-400)">
                {`${(il * 100).toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* x gridlines + ratio ticks */}
        {gridRatios.map((r) => {
          const x = logToX(Math.log(r));
          const atOne = Math.abs(r - 1) < 1e-9;
          return (
            <g key={`x-${r}`}>
              <line
                x1={x}
                y1={padT}
                x2={x}
                y2={padT + plotH}
                stroke={atOne ? 'var(--color-success)' : 'var(--color-ink-100)'}
                strokeWidth={atOne ? 2 : 1}
                strokeDasharray={atOne ? '4 3' : undefined}
              />
              <text
                x={x}
                y={H - 10}
                textAnchor="middle"
                fontSize="10"
                fontWeight={atOne ? 600 : 400}
                fill={atOne ? 'var(--color-success)' : 'var(--color-ink-400)'}
              >
                {fmtRatio(r)}
              </text>
            </g>
          );
        })}

        {/* IL curve */}
        <polyline
          points={curveD}
          fill="none"
          stroke="var(--color-warning)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* drop line from marker to the IL=0 axis */}
        <line
          x1={markerX}
          y1={padT}
          x2={markerX}
          y2={markerY}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={0.7}
        />

        {/* current marker */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-accent-500)" />
        <text
          x={markerX}
          y={markerY - 10}
          textAnchor="middle"
          fontSize="11"
          fontWeight={600}
          className="font-mono"
          fill="var(--color-ink-900)"
        >
          {fmtPct(ilFraction(Math.exp(markerLR)) * 100, 1)}
        </text>
      </svg>

      {/* Price-change slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-pct`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{priceChangeLabel}</span>
          <span className="font-mono text-ink-900">{fmtPct(pct, 0)}</span>
        </label>
        <input
          id={`${id}-pct`}
          type="range"
          min={minPct}
          max={maxPct}
          step={step}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          aria-label={priceChangeLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Fees slider */}
      <div className="mt-3">
        <label
          htmlFor={`${id}-fees`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{feesLabel}</span>
          <span className="font-mono text-ink-900">{`+${fees.toFixed(1)}%`}</span>
        </label>
        <input
          id={`${id}-fees`}
          type="range"
          min={0}
          max={50}
          step={0.5}
          value={fees}
          onChange={(e) => setFees(Number(e.target.value))}
          aria-label={feesLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ratioLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{fmtRatio(ratio)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ilLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              Math.abs(ilPct) < 0.005 ? 'text-success' : 'text-warning',
            )}
          >
            {fmtPct(ilPct)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{hodlLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, hodlValue)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{lpLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {money(currencyPrefix, lpValue)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{gapLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-warning">
            {money(currencyPrefix, gap)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{feesLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {`+${money(currencyPrefix, feesDollars)}`}
          </dd>
        </div>
        <div className="col-span-2 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{netLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              netPct >= 0 ? 'text-success' : 'text-warning',
            )}
          >
            {fmtPct(netPct)}
          </dd>
        </div>
      </dl>

      {/* Verdict panel */}
      <div
        className={cx(
          'mt-4 rounded-card border px-4 py-3',
          feesCover ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10',
        )}
        aria-live="polite"
      >
        <p
          className={cx(
            'text-sm font-semibold',
            feesCover ? 'text-success' : 'text-warning',
          )}
        >
          {feesCover ? feesCoverLabel : ilWinsLabel}
        </p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default ImpermanentLossCurve;
