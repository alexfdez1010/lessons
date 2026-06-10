import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LeverageLiquidationMeterProps {
  /** Heading above the meter. */
  title?: string;
  /** One-line takeaway under the meter. */
  caption?: string;
  /** Label for the leverage slider. */
  leverageLabel?: string;
  /** Label for the side toggle — long option. */
  longLabel?: string;
  /** Label for the side toggle — short option. */
  shortLabel?: string;
  /** Readout label for the liquidation price. */
  liqPriceLabel?: string;
  /** Readout label for the distance-to-liquidation (% move). */
  bufferLabel?: string;
  /** Readout label for the position's notional size. */
  notionalLabel?: string;
  /** Banner shown when the buffer is dangerously thin. */
  dangerLabel?: string;
  /** Label for the entry-price marker. */
  entryLabel?: string;
  /** Currency prefix. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Margin the trader posts (collateral). Defaults to `1000`. */
  margin?: number;
  /** Entry price of the asset. Defaults to `30000`. */
  entryPrice?: number;
  /** Maintenance-margin fraction (e.g. 0.005 = 0.5%). Defaults to `0.005`. */
  maintenanceMargin?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Interactive leverage / liquidation-price meter. The trader posts a fixed
 * margin and picks a leverage multiple and a side (long or short). The widget
 * computes the position's notional and the price at which the position is
 * liquidated — for a long, the price has to fall by roughly (1/leverage minus
 * maintenance) before the loss eats the margin; for a short it has to rise.
 * A horizontal price scale shows the entry, the liquidation price, and the
 * survivable buffer between them, which visibly shrinks as leverage climbs.
 * All math derives from props; nothing numeric is hardcoded into the figure.
 */
export function LeverageLiquidationMeter({
  title = 'Leverage decides how far price can move before you are liquidated',
  caption = 'Liquidation price is where your losses have eaten your margin down to the maintenance minimum. Higher leverage means a bigger position on the same collateral, so a smaller adverse move wipes you out. Drag the leverage up and watch the survivable buffer collapse.',
  leverageLabel = 'Leverage',
  longLabel = 'Long',
  shortLabel = 'Short',
  liqPriceLabel = 'Liquidation price',
  bufferLabel = 'Move to liquidation',
  notionalLabel = 'Position size',
  dangerLabel = 'Thin buffer — a small wick liquidates this position',
  entryLabel = 'Entry',
  currencyPrefix = '$',
  margin = 1000,
  entryPrice = 30000,
  maintenanceMargin = 0.005,
  className,
}: LeverageLiquidationMeterProps) {
  const id = useId();
  const [leverage, setLeverage] = useState(5);
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);

  const notional = margin * leverage;
  // Fractional adverse move that liquidates: 1/leverage minus maintenance.
  const liqMoveFrac = Math.max(0.0005, 1 / leverage - maintenanceMargin);
  const liqPrice =
    side === 'long'
      ? entryPrice * (1 - liqMoveFrac)
      : entryPrice * (1 + liqMoveFrac);

  // Danger if the survivable move is under 4%.
  const danger = liqMoveFrac < 0.04;

  // Geometry — a horizontal price band centred on entry.
  const W = 520;
  const Hsvg = 90;
  const padX = 20;
  const trackY = 40;
  const trackH = 16;
  const innerW = W - padX * 2;
  // Show a +/- 25% window around entry.
  const window = 0.25;
  const pLow = entryPrice * (1 - window);
  const pHigh = entryPrice * (1 + window);
  const xOf = (price: number) =>
    padX + ((Math.max(pLow, Math.min(price, pHigh)) - pLow) / (pHigh - pLow)) * innerW;

  const entryX = xOf(entryPrice);
  const liqX = xOf(liqPrice);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 400;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [leverage, side]);

  const animLiqX = entryX + (liqX - entryX) * progress;

  const money = (v: number) =>
    `${currencyPrefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;
  const pct = (f: number) => `${(f * 100).toFixed(2)}%`;

  const aria = `${notionalLabel} ${money(notional)}, ${leverageLabel} ${leverage}x ${side === 'long' ? longLabel : shortLabel}. ${liqPriceLabel} ${money(liqPrice)}, ${bufferLabel} ${pct(liqMoveFrac)}.`;

  const buttonBase =
    'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white tabular-nums',
            danger ? 'bg-red-600' : 'bg-brand-600',
          )}
        >
          {bufferLabel}: {pct(liqMoveFrac)}
        </span>
      </figcaption>

      {/* Side toggle */}
      <div className="mt-4 inline-flex rounded-pill border border-ink-200 p-0.5" role="group">
        <button
          type="button"
          onClick={() => setSide('long')}
          className={cx(
            'rounded-pill px-4 py-1 text-sm font-medium transition',
            side === 'long' ? 'bg-accent-600 text-white' : 'text-ink-600',
          )}
          aria-pressed={side === 'long'}
        >
          {longLabel}
        </button>
        <button
          type="button"
          onClick={() => setSide('short')}
          className={cx(
            'rounded-pill px-4 py-1 text-sm font-medium transition',
            side === 'short' ? 'bg-accent-600 text-white' : 'text-ink-600',
          )}
          aria-pressed={side === 'short'}
        >
          {shortLabel}
        </button>
      </div>

      {/* Price band */}
      <svg viewBox={`0 0 ${W} ${Hsvg}`} className="mt-3 w-full" role="img" aria-label={aria}>
        {/* Survivable zone (entry → liq) */}
        <rect
          x={Math.min(entryX, animLiqX)}
          y={trackY}
          width={Math.abs(animLiqX - entryX)}
          height={trackH}
          fill={danger ? 'var(--color-danger)' : 'var(--color-accent-500)'}
          opacity={0.35}
        />
        {/* Base track */}
        <rect
          x={padX}
          y={trackY}
          width={innerW}
          height={trackH}
          rx={4}
          fill="none"
          stroke="var(--color-ink-200)"
        />
        {/* Entry marker */}
        <line x1={entryX} y1={trackY - 10} x2={entryX} y2={trackY + trackH + 10} stroke="var(--color-ink-900)" strokeWidth={2.5} />
        <text x={entryX} y={trackY - 14} textAnchor="middle" fontSize="10" fontWeight={700} fill="var(--color-ink-900)">
          {entryLabel}
        </text>
        {/* Liquidation marker */}
        <line x1={animLiqX} y1={trackY - 10} x2={animLiqX} y2={trackY + trackH + 10} stroke="var(--color-danger)" strokeWidth={3} />
        <text x={animLiqX} y={trackY + trackH + 24} textAnchor="middle" fontSize="10" fontWeight={700} fill="var(--color-danger)">
          {money(liqPrice)}
        </text>
      </svg>

      <div aria-live="polite">
        {danger && (
          <p className="mt-2 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {dangerLabel}
          </p>
        )}
      </div>

      {/* Slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-lev`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{leverageLabel}</span>
          <span className="font-mono text-ink-900 tabular-nums">{leverage}×</span>
        </label>
        <input
          id={`${id}-lev`}
          type="range"
          min={1}
          max={100}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{notionalLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900 tabular-nums">{money(notional)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{liqPriceLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold tabular-nums', danger ? 'text-red-600' : 'text-brand-700')}>
            {money(liqPrice)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bufferLabel}</dt>
          <dd className={cx('font-mono text-lg font-semibold tabular-nums', danger ? 'text-red-600' : 'text-accent-600')}>
            {pct(liqMoveFrac)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LeverageLiquidationMeter;
