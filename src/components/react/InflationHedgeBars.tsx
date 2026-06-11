import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface InflationAsset {
  /** Asset-class label, e.g. "Cash". */
  label: string;
  /** Approximate real (inflation-adjusted) return in a normal regime, %. */
  normal: number;
  /** Approximate real return during a high-inflation regime, %. */
  highInflation: number;
}

export interface InflationHedgeBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the normal-regime toggle. */
  normalLabel?: string;
  /** Label for the high-inflation-regime toggle. */
  highInflationLabel?: string;
  /** Label for the y-axis (real return). */
  realReturnLabel?: string;
  /** The asset classes to chart. Finance defaults provided. */
  assets?: InflationAsset[];
  /** Explanation shown under the normal regime. */
  normalNote?: string;
  /** Explanation shown under the high-inflation regime. */
  highInflationNote?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const DEFAULT_ASSETS: InflationAsset[] = [
  { label: 'Cash', normal: 0.5, highInflation: -6 },
  { label: 'Nominal bonds', normal: 2, highInflation: -8 },
  { label: 'Stocks', normal: 6, highInflation: -2 },
  { label: 'Gold', normal: 1, highInflation: 7 },
  { label: 'Commodities', normal: 1.5, highInflation: 9 },
  { label: 'TIPS', normal: 1.5, highInflation: 2 },
  { label: 'REITs / real estate', normal: 4, highInflation: 3 },
];

const pct = (value: number, suffix: string): string =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;

/**
 * Inflation-hedge bars. A "real asset" is one whose value tends to rise with the
 * general price level, so it preserves purchasing power when inflation bites.
 * This island charts the **real** (inflation-adjusted) return of several asset
 * classes and toggles between a calm regime and a high-inflation shock. Bars
 * above the zero line keep pace with or beat inflation; bars below it lose
 * purchasing power. The point lands visually: in the high-inflation regime,
 * cash and nominal bonds plunge deep red while commodities, gold and inflation-
 * linked assets stay green — the textbook signature of a real-asset hedge. Bar
 * heights tween via CSS and the transition honours `motion-reduce`.
 */
export function InflationHedgeBars({
  title = 'Real returns when inflation strikes',
  normalLabel = 'Normal inflation',
  highInflationLabel = 'High-inflation shock',
  realReturnLabel = 'Real return',
  assets = DEFAULT_ASSETS,
  normalNote = 'In a calm, low-inflation world almost everything earns a positive real return, and the riskier growth assets (stocks, real estate) lead. Inflation is quietly eroding cash, but slowly enough that you barely notice.',
  highInflationNote = 'In a high-inflation shock the ranking flips. Cash and nominal bonds — fixed claims on future money — get gutted as that future money buys less. The winners are real assets whose prices ride the inflation wave: commodities, gold, and explicitly inflation-linked bonds (TIPS).',
  percentSuffix = '%',
  className,
}: InflationHedgeBarsProps) {
  const [regime, setRegime] = useState<'normal' | 'high'>('high');

  const values = assets.map((a) =>
    regime === 'normal' ? a.normal : a.highInflation,
  );

  const W = 560;
  const H = 280;
  const padX = 40;
  const padTop = 24;
  const padBottom = 54;
  const minV = -10;
  const maxV = 10;

  const plotH = H - padTop - padBottom;
  const y = (v: number) => padTop + (1 - (v - minV) / (maxV - minV)) * plotH;
  const zeroY = y(0);

  const n = assets.length;
  const slot = (W - padX * 2) / n;
  const barW = slot * 0.58;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <div
          className="inline-flex rounded-pill border border-ink-200 p-0.5"
          role="group"
        >
          <button
            type="button"
            onClick={() => setRegime('normal')}
            aria-pressed={regime === 'normal'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              regime === 'normal'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {normalLabel}
          </button>
          <button
            type="button"
            onClick={() => setRegime('high')}
            aria-pressed={regime === 'high'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              regime === 'high'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {highInflationLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: real returns by asset class in the ${regime === 'normal' ? normalLabel : highInflationLabel} regime. Bars above zero keep pace with inflation; bars below zero lose purchasing power.`}
      >
        {/* Zero reference line */}
        <line
          x1={padX}
          y1={zeroY}
          x2={W - padX}
          y2={zeroY}
          stroke="var(--color-ink-300)"
          strokeWidth={1.5}
        />
        <text
          x={padX - 6}
          y={zeroY + 3}
          textAnchor="end"
          fontSize={10}
          fill="var(--color-ink-500)"
        >
          0{percentSuffix}
        </text>

        {assets.map((a, i) => {
          const v = values[i];
          const cx0 = padX + slot * i + slot / 2;
          const top = v >= 0 ? y(v) : zeroY;
          const h = Math.abs(y(v) - zeroY);
          const positive = v >= 0;
          return (
            <g key={a.label}>
              <rect
                x={cx0 - barW / 2}
                y={top}
                width={barW}
                height={Math.max(h, 0.5)}
                rx={3}
                fill={
                  positive
                    ? 'var(--color-brand-500)'
                    : 'var(--color-accent-500)'
                }
                className="transition-all duration-500 motion-reduce:transition-none"
              />
              {/* Value label */}
              <text
                x={cx0}
                y={positive ? top - 5 : top + h + 12}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill={positive ? 'var(--color-brand-600)' : 'var(--color-accent-600)'}
                className="transition-all duration-500 motion-reduce:transition-none"
              >
                {pct(v, percentSuffix)}
              </text>
              {/* Asset label, rotated for fit */}
              <text
                x={cx0}
                y={H - padBottom + 16}
                textAnchor="end"
                fontSize={9}
                fill="var(--color-ink-600)"
                transform={`rotate(-30 ${cx0} ${H - padBottom + 16})`}
              >
                {a.label}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={padX - 6} y={padTop - 8} fontSize={11} fill="var(--color-ink-500)">
          {realReturnLabel}
        </text>
      </svg>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {regime === 'normal' ? normalNote : highInflationNote}
      </p>
    </figure>
  );
}

export default InflationHedgeBars;
