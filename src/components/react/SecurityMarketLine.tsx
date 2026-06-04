import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single example asset plotted against the Security Market Line. */
export interface SmlAsset {
  /** Short label shown next to the dot (e.g. a ticker or descriptor). */
  label: string;
  /** Systematic risk (beta) — the asset's X position. */
  beta: number;
  /** The asset's (assumed/forecast) expected return, in percent — the Y position. */
  expectedReturn: number;
}

export interface SecurityMarketLineProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the X axis (beta / systematic risk). */
  betaLabel?: string;
  /** Label for the Y axis (expected return). */
  returnLabel?: string;
  /** Label for the Security Market Line itself. */
  smlLabel?: string;
  /** Label for the risk-free anchor point at β = 0. */
  riskFreeLabel?: string;
  /** Label for the market anchor point at β = 1. */
  marketLabel?: string;
  /** Label describing a fairly-priced asset (one that sits on the line). */
  fairLabel?: string;
  /** Label for the alpha (mispricing) connectors. */
  alphaLabel?: string;
  /** Risk-free return, in percent (the intercept of the SML at β = 0). Defaults to `3`. */
  riskFree?: number;
  /** Market expected return, in percent (the SML value at β = 1). Defaults to `10`. */
  marketReturn?: number;
  /** Example assets to plot as dots, each with a label, beta and expected return. */
  assets?: SmlAsset[];
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DEFAULT_ASSETS: SmlAsset[] = [
  // Defensive stock, on the line (β≈0.5 → 3 + 0.5·7 = 6.5%).
  { label: 'Defensive', beta: 0.5, expectedReturn: 6.5 },
  // Underpriced grower above the line (β≈0.8 → fair 8.6%, forecast 11% → +α).
  { label: 'Underpriced', beta: 0.8, expectedReturn: 11 },
  // Aggressive stock below the line (β≈1.6 → fair 14.2%, forecast 11.5% → −α).
  { label: 'Overpriced', beta: 1.6, expectedReturn: 11.5 },
];

/**
 * Interactive Security Market Line (SML) explainer for the Capital Asset
 * Pricing Model (CAPM). CAPM says an asset's *fair* expected return is the
 * risk-free rate plus its beta times the market risk premium:
 *
 *   E[r] = riskFree + beta · (marketReturn − riskFree)
 *
 * Plotted with beta on the X axis and expected return on the Y axis, this is a
 * straight line — the SML. The β = 0 point sits at the risk-free rate; the
 * β = 1 point sits at the market return. An asset plotted *above* the line is
 * underpriced (positive alpha — more return than its systematic risk deserves);
 * an asset *below* the line is overpriced (negative alpha). Alpha is the
 * vertical distance between an asset's dot and the line directly beneath/above
 * it.
 *
 * The learner drags a beta slider (0..2) that drives a marker along the SML,
 * with readouts spelling out the chosen beta and the CAPM fair expected return
 * there. Example `assets` are plotted as dots, each with a thin connector to
 * the line showing its alpha — green when above (positive), amber when below
 * (negative). `prefers-reduced-motion` snaps the marker instead of tweening.
 * Locale-agnostic via props.
 */
export function SecurityMarketLine({
  title = 'The Security Market Line (CAPM)',
  betaLabel = 'Beta (β) — systematic risk',
  returnLabel = 'Expected return',
  smlLabel = 'Security Market Line',
  riskFreeLabel = 'Risk-free rate (β = 0)',
  marketLabel = 'Market (β = 1)',
  fairLabel = 'Fairly priced (on the line)',
  alphaLabel = 'Alpha (mispricing)',
  riskFree = 3,
  marketReturn = 10,
  assets = DEFAULT_ASSETS,
  caption = 'CAPM turns risk into a fair price: every beta has one "right" return on the line. Dots above the line are bargains (positive alpha); dots below are overpriced (negative alpha).',
  className,
}: SecurityMarketLineProps) {
  const id = useId();
  // The market risk premium — the slope of the SML.
  const premium = marketReturn - riskFree;

  /** CAPM fair expected return (%) for a given beta. */
  const fairReturn = (beta: number): number => riskFree + beta * premium;

  // Slider-driven beta and the animated beta the marker renders against.
  const [beta, setBeta] = useState(1);
  const [shownBeta, setShownBeta] = useState(1);
  const rafRef = useRef<number | null>(null);

  // Chart geometry.
  const W = 520;
  const H = 320;
  const padL = 48;
  const padR = 80;
  const padT = 16;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const BETA_MAX = 2;

  // Y axis spans from 0 up to a little above the worst of {SML at βmax, assets}.
  const axisMax = useMemo(() => {
    const candidates = [
      fairReturn(BETA_MAX),
      ...assets.map((a) => a.expectedReturn),
      ...assets.map((a) => fairReturn(a.beta)),
      marketReturn,
    ];
    const top = Math.max(...candidates, 1);
    return Math.ceil((top * 1.1) / 5) * 5 || 5;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskFree, marketReturn, assets]);

  const toPlotX = (b: number): number => padL + (b / BETA_MAX) * plotW;
  const toPlotY = (r: number): number => padT + plotH - (r / axisMax) * plotH;

  // Animate the marker toward the new beta whenever it changes.
  useEffect(() => {
    const target = beta;
    if (prefersReducedMotion()) {
      setShownBeta(target);
      return;
    }
    const start = shownBeta;
    const delta = target - start;
    if (Math.abs(delta) < 0.001) {
      setShownBeta(target);
      return;
    }
    const duration = 380;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShownBeta(start + delta * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(stepFn);
      }
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shownBeta intentionally omitted: re-running each tween frame would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beta]);

  const fair = fairReturn(beta);
  const markerX = toPlotX(shownBeta);
  const markerY = toPlotY(fairReturn(shownBeta));

  // SML endpoints: (0, riskFree) → (βmax, fairReturn(βmax)).
  const smlX1 = toPlotX(0);
  const smlY1 = toPlotY(riskFree);
  const smlX2 = toPlotX(BETA_MAX);
  const smlY2 = toPlotY(fairReturn(BETA_MAX));

  const pct = (v: number, digits = 1): string =>
    `${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

  const num = (v: number, digits = 2): string =>
    v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

  // Y-axis gridlines / ticks.
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const stepT = axisMax / 4;
    for (let i = 0; i <= 4; i++) ticks.push(i * stepT);
    return ticks;
  }, [axisMax]);

  const betaTicks = [0, 0.5, 1, 1.5, 2];

  const ariaLabel = `${title}. ${betaLabel}: ${num(beta)}. CAPM ${returnLabel.toLowerCase()} at that beta: ${pct(
    fair,
  )}. ${riskFreeLabel}: ${pct(riskFree)}. ${marketLabel}: ${pct(marketReturn)}.`;

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
          {pct(fair)}
        </span>
      </figcaption>

      {/* SML chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Plot background */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          rx={6}
          fill="var(--color-surface-sunken)"
          opacity={0.4}
        />

        {/* Y gridlines + tick labels */}
        {yTicks.map((t) => {
          const gy = toPlotY(t);
          return (
            <g key={`y-${t}`}>
              <line
                x1={padL}
                y1={gy}
                x2={W - padR}
                y2={gy}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={gy + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {`${t.toFixed(0)}%`}
              </text>
            </g>
          );
        })}

        {/* X gridlines + beta tick labels */}
        {betaTicks.map((b) => {
          const gx = toPlotX(b);
          return (
            <g key={`x-${b}`}>
              <line
                x1={gx}
                y1={padT}
                x2={gx}
                y2={padT + plotH}
                stroke="var(--color-ink-100)"
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={gx}
                y={padT + plotH + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {b.toFixed(b % 1 === 0 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        {/* The Security Market Line */}
        <line
          x1={smlX1}
          y1={smlY1}
          x2={smlX2}
          y2={smlY2}
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <text
          x={smlX2 + 4}
          y={smlY2 - 6}
          fontSize="10"
          fontWeight={600}
          fill="var(--color-brand-700)"
        >
          {smlLabel}
        </text>

        {/* Alpha connectors + asset dots */}
        {assets.map((a, i) => {
          const ax = toPlotX(a.beta);
          const ay = toPlotY(a.expectedReturn);
          const lineY = toPlotY(fairReturn(a.beta));
          const above = a.expectedReturn > fairReturn(a.beta);
          const onLine = Math.abs(a.expectedReturn - fairReturn(a.beta)) < 0.05;
          const connectorColor = above ? 'var(--color-success)' : 'var(--color-warning)';
          return (
            <g key={`asset-${i}`}>
              {!onLine && (
                <line
                  x1={ax}
                  y1={ay}
                  x2={ax}
                  y2={lineY}
                  stroke={connectorColor}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  opacity={0.85}
                />
              )}
              <circle
                cx={ax}
                cy={ay}
                r={5}
                fill={onLine ? 'var(--color-brand-600)' : connectorColor}
                stroke="var(--color-surface)"
                strokeWidth={1.5}
              />
              <text
                x={ax}
                y={ay - 9}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight={600}
                fill="var(--color-ink-700)"
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {/* Risk-free anchor point at β = 0 */}
        <circle
          cx={toPlotX(0)}
          cy={toPlotY(riskFree)}
          r={5}
          fill="var(--color-brand-600)"
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />

        {/* Market anchor point at β = 1 */}
        <circle
          cx={toPlotX(1)}
          cy={toPlotY(marketReturn)}
          r={6}
          fill="var(--color-accent-500)"
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
        <text
          x={toPlotX(1) + 8}
          y={toPlotY(marketReturn) - 8}
          fontSize="9.5"
          fontWeight={600}
          fill="var(--color-accent-500)"
        >
          {marketLabel}
        </text>

        {/* Drop line from the driven marker to the X axis */}
        <line
          x1={markerX}
          y1={markerY}
          x2={markerX}
          y2={padT + plotH}
          stroke="var(--color-ink-400)"
          strokeWidth={1.5}
          strokeDasharray="3 4"
          opacity={0.6}
        />

        {/* The beta-driven marker on the SML */}
        <circle cx={markerX} cy={markerY} r={6} fill="var(--color-ink-900)" />
        <circle
          cx={markerX}
          cy={markerY}
          r={9}
          fill="none"
          stroke="var(--color-ink-900)"
          strokeWidth={1.5}
          opacity={0.4}
        />

        {/* X axis title */}
        <text
          x={padL + plotW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-ink-500)"
        >
          {betaLabel}
        </text>

        {/* Y axis title */}
        <text
          x={12}
          y={padT + plotH / 2}
          fontSize="10"
          fill="var(--color-ink-500)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padT + plotH / 2})`}
        >
          {returnLabel}
        </text>
      </svg>

      {/* Legend */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-600" aria-hidden="true" />
          {riskFreeLabel}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-500" aria-hidden="true" />
          {marketLabel}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
          {alphaLabel} ({fairLabel})
        </li>
      </ul>

      {/* Beta slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-beta`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{betaLabel}</span>
          <span className="font-mono text-ink-900">β = {num(beta)}</span>
        </label>
        <input
          id={`${id}-beta`}
          type="range"
          min={0}
          max={BETA_MAX}
          step={0.05}
          value={beta}
          onChange={(e) => setBeta(Number(e.target.value))}
          aria-label={betaLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{betaLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">{num(beta)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">CAPM {returnLabel.toLowerCase()}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(fair)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SecurityMarketLine;
