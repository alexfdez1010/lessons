import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface HealthFactorMeterProps {
  /** Heading above the gauge. */
  title?: string;
  /** One-line takeaway shown under the gauge. */
  caption?: string;
  /** Label for the collateral-price slider (drives the whole gauge). */
  priceLabel?: string;
  /** Readout label for the computed health factor. */
  healthFactorLabel?: string;
  /** Readout label for the computed collateral value. */
  collateralValueLabel?: string;
  /** Zone label / readout for HF ≥ 1.5. */
  safeLabel?: string;
  /** Zone label / readout for 1 ≤ HF < 1.5. */
  riskyLabel?: string;
  /** Zone label / readout for HF < 1. */
  liquidationLabel?: string;
  /** Banner shown when HF < 1. */
  liquidationBannerLabel?: string;
  /** Label for the fixed liquidation-threshold figure. */
  liqThresholdLabel?: string;
  /** Currency unit prefix for values. Defaults to `'$'`. */
  unit?: string;
  /** Units of collateral the borrower holds. Defaults to `10`. */
  collateralUnits?: number;
  /** Starting price of one collateral unit. Defaults to `2000`. */
  startPrice?: number;
  /** Outstanding debt owed against the collateral. Defaults to `12000`. */
  debt?: number;
  /** Liquidation threshold as a fraction (e.g. 0.825). Defaults to `0.825`. */
  liqThreshold?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Top of the gauge scale — HF readings above this clamp to the right edge. */
const HF_MAX = 2.5;
/** Liquidation boundary. */
const HF_LIQ = 1;
/** Safe boundary. */
const HF_SAFE = 1.5;

const moneyFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const hfFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

type Zone = 'liquidation' | 'risky' | 'safe';

const zoneOf = (hf: number): Zone => {
  if (hf < HF_LIQ) return 'liquidation';
  if (hf < HF_SAFE) return 'risky';
  return 'safe';
};

/**
 * Interactive health-factor gauge for DeFi over-collateralised lending. The
 * learner drags the collateral price (as a percentage of its starting price);
 * the borrowed debt and collateral units are fixed by props. The gauge maps the
 * resulting health factor — `(collateral value × liquidation threshold) / debt`
 * — onto a three-zone meter: below 1 the position is liquidatable (danger), 1
 * to 1.5 is at risk, and 1.5+ is safe. A needle rides to the current HF, a bold
 * line marks the 1.0 liquidation boundary, and a banner fires once HF drops
 * under 1. Readouts (collateral value, HF, zone) are announced via aria-live.
 * Respects `prefers-reduced-motion` by snapping the needle instead of gliding.
 */
export function HealthFactorMeter({
  title = 'Health factor and liquidation',
  caption = 'Your health factor is the collateral value (after the liquidation threshold haircut) divided by the debt you owe. Drag the collateral price: as it falls, the health factor slides toward 1. Cross below 1 and the position is liquidatable — anyone can repay part of your debt and seize your collateral at a discount.',
  priceLabel = 'Collateral price',
  healthFactorLabel = 'Health factor',
  collateralValueLabel = 'Collateral value',
  safeLabel = 'Safe',
  riskyLabel = 'At risk',
  liquidationLabel = 'Liquidation',
  liquidationBannerLabel = 'Liquidation triggered — your collateral can be sold to repay the debt',
  liqThresholdLabel = 'Liquidation threshold',
  unit = '$',
  collateralUnits = 10,
  startPrice = 2000,
  debt = 12000,
  liqThreshold = 0.825,
  className,
}: HealthFactorMeterProps) {
  const id = useId();
  // Collateral price as a percentage of the starting price (30% → 150%).
  const [pricePct, setPricePct] = useState(100);
  // Animated needle position 0 → 1 toward the target HF fraction.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const price = startPrice * (pricePct / 100);
  const collateralValue = collateralUnits * price;
  const hf = debt > 0 ? (collateralValue * liqThreshold) / debt : HF_MAX;
  const zone = zoneOf(hf);

  // Gauge geometry.
  const W = 520;
  const H = 96;
  const padX = 16;
  const trackY = 46;
  const trackH = 18;
  const innerW = W - padX * 2;

  // Map an HF value (0 → HF_MAX) to an x pixel on the track.
  const xOf = (value: number) =>
    padX + (Math.max(0, Math.min(value, HF_MAX)) / HF_MAX) * innerW;

  const liqX = xOf(HF_LIQ);
  const safeX = xOf(HF_SAFE);
  const needleTargetX = xOf(hf);

  // Animate the needle from the left toward the current HF on each change.
  useEffect(() => {
    if (prefersReducedMotion()) {
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
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [pricePct]);

  const needleX = padX + (needleTargetX - padX) * progress;

  const zoneLabel =
    zone === 'liquidation' ? liquidationLabel : zone === 'risky' ? riskyLabel : safeLabel;

  const hfText = hf >= HF_MAX ? `${hfFmt.format(HF_MAX)}+` : hfFmt.format(hf);

  const gaugeAria = `${healthFactorLabel}: ${hfText}. ${zoneLabel}.`;

  const badgeClass =
    zone === 'liquidation'
      ? 'bg-red-600'
      : zone === 'risky'
        ? 'bg-brand-600'
        : 'bg-accent-600';

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
            badgeClass,
          )}
        >
          {healthFactorLabel}: {hfText}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-red-500" aria-hidden="true" />
          {liquidationLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {riskyLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-accent-500" aria-hidden="true" />
          {safeLabel}
        </span>
      </div>

      {/* Gauge */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={gaugeAria}
      >
        {/* Liquidation zone (0 → 1) */}
        <rect
          x={padX}
          y={trackY}
          width={liqX - padX}
          height={trackH}
          rx={4}
          fill="var(--color-danger)"
        />
        {/* At-risk zone (1 → 1.5) */}
        <rect
          x={liqX}
          y={trackY}
          width={safeX - liqX}
          height={trackH}
          fill="var(--color-brand-500)"
        />
        {/* Safe zone (1.5 → max) */}
        <rect
          x={safeX}
          y={trackY}
          width={padX + innerW - safeX}
          height={trackH}
          rx={4}
          fill="var(--color-accent-500)"
        />

        {/* Bold liquidation line at HF = 1.0 */}
        <line
          x1={liqX}
          y1={trackY - 12}
          x2={liqX}
          y2={trackY + trackH + 12}
          stroke="var(--color-danger)"
          strokeWidth={3}
        />
        <text
          x={liqX}
          y={trackY - 16}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="var(--color-danger)"
        >
          1.0
        </text>

        {/* Scale ticks */}
        <text
          x={safeX}
          y={trackY + trackH + 26}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          1.5
        </text>

        {/* Needle / marker at the current HF */}
        <g>
          <line
            x1={needleX}
            y1={trackY - 6}
            x2={needleX}
            y2={trackY + trackH + 6}
            stroke="var(--color-ink-900)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx={needleX}
            cy={trackY - 8}
            r={6}
            fill="var(--color-surface)"
            stroke="var(--color-ink-900)"
            strokeWidth={2.5}
          />
        </g>
      </svg>

      {/* Liquidation banner */}
      <div aria-live="polite">
        {zone === 'liquidation' && (
          <p className="mt-3 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {liquidationBannerLabel}
          </p>
        )}
      </div>

      {/* Slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-price`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{priceLabel}</span>
          <span className="font-mono text-ink-900">
            {unit}
            {moneyFmt.format(price)}{' '}
            <span className="text-ink-500">({pctFmt.format(pricePct)}%)</span>
          </span>
        </label>
        <input
          id={`${id}-price`}
          type="range"
          min={30}
          max={150}
          step={1}
          value={pricePct}
          onChange={(e) => setPricePct(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <p className="mt-1 text-xs text-ink-500">
          {liqThresholdLabel}: {pctFmt.format(liqThreshold * 100)}% · {collateralUnits} ×{' '}
          {unit}
          {moneyFmt.format(startPrice)} · {healthFactorLabel.toLowerCase()} vs {unit}
          {moneyFmt.format(debt)}
        </p>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{collateralValueLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {unit}
            {moneyFmt.format(collateralValue)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{healthFactorLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              zone === 'liquidation'
                ? 'text-red-600'
                : zone === 'risky'
                  ? 'text-brand-700'
                  : 'text-accent-600',
            )}
          >
            {hfText}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{healthFactorLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              zone === 'liquidation'
                ? 'text-red-600'
                : zone === 'risky'
                  ? 'text-brand-700'
                  : 'text-accent-600',
            )}
          >
            {zoneLabel}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default HealthFactorMeter;
