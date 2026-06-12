import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface DispersionBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the low-correlation (calm) regime toggle. */
  lowCorrLabel?: string;
  /** Label for the high-correlation (crisis) regime toggle. */
  highCorrLabel?: string;
  /** Label for the weighted-average single-name implied-vol reference line. */
  avgSingleVolLabel?: string;
  /** Label for the index implied-vol bar. */
  indexVolLabel?: string;
  /** Label for the computed implied-correlation stat. */
  impliedCorrLabel?: string;
  /** Label for the y-axis (implied volatility). */
  volAxisLabel?: string;
  /** Initial aria-live note. Defaults to `lowCorrNote`. */
  note?: string;
  /** Explanation shown in the low-correlation regime. */
  lowCorrNote?: string;
  /** Explanation shown in the high-correlation regime. */
  highCorrNote?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const LOW_CORR_NOTE =
  'An index option only has to cover the index’s move, and because the constituent stocks zig and zag partly independently, the index moves LESS than the average stock — so index implied vol sits well below the average single-name implied vol. That gap implies a LOW correlation. A dispersion trade sells the (expensive, over-correlated) index vol and buys the cheaper single-name vol, winning if stocks realize even more independently than priced.';

const HIGH_CORR_NOTE =
  'In a crisis everything sells off together — correlation jumps toward 1 — so the diversification benefit evaporates and index vol rises almost to the average single-name vol. The gap collapses and implied correlation approaches 1. A short-correlation (dispersion) book gets crushed exactly here: this is the tail risk of selling index vol against single names.';

/**
 * Dispersion / correlation-trading visual. Each constituent stock has its own
 * single-name implied vol; the equal-weighted average of those is drawn as a
 * dashed reference line. The **index** implied vol is always lower, because the
 * stocks don't all move together (diversification). The size of that gap reveals
 * the market's **implied correlation** via the standard equal-weight proxy
 * ρ ≈ σ_index² / σ_avg² (index variance over average single-name variance).
 *
 * Toggling the regime keeps the single-name vols fixed and only changes the
 * index vol: in the calm/low-correlation regime the index vol sits well below
 * the average (big gap → low ρ ≈ 0.35); in the crisis/high-correlation regime
 * the index vol rises almost to the average (small gap → high ρ ≈ 0.85). A
 * dispersion trade sells index vol and buys single-name vol, profiting when
 * realized correlation comes in below the implied correlation. Bars re-grow on
 * toggle via a re-keyed CSS transition that honours `motion-reduce`.
 */
export function DispersionBars({
  title = 'Dispersion: index vol vs single-name vol reveals implied correlation',
  lowCorrLabel = 'Calm: low correlation',
  highCorrLabel = 'Crisis: high correlation',
  avgSingleVolLabel = 'Weighted-avg single-name implied vol',
  indexVolLabel = 'Index implied vol',
  impliedCorrLabel = 'Implied correlation',
  volAxisLabel = 'Implied volatility',
  note,
  lowCorrNote = LOW_CORR_NOTE,
  highCorrNote = HIGH_CORR_NOTE,
  percentSuffix = '%',
  className,
}: DispersionBarsProps) {
  const [mode, setMode] = useState<'low' | 'high'>('low');

  // Equal-weighted basket of five constituents. Single-name implied vols are
  // fixed; only the index vol (and thus implied correlation) changes by regime.
  const singleVols = [28, 35, 22, 40, 30];
  const stockLabels = ['A', 'B', 'C', 'D', 'E'];
  const avgVol = singleVols.reduce((s, v) => s + v, 0) / singleVols.length; // 31

  // Index vols chosen so ρ ≈ σ_index² / σ_avg² lands near the stated targets.
  // Low: 18.3² / 31² ≈ 0.35.  High: 28.6² / 31² ≈ 0.85.
  const indexVolLow = 18.3;
  const indexVolHigh = 28.6;
  const indexVol = mode === 'low' ? indexVolLow : indexVolHigh;

  // Implied correlation under the equal-weight proxy ρ ≈ σ_index² / σ_avg².
  const impliedCorr = (indexVol * indexVol) / (avgVol * avgVol);

  const W = 520;
  const H = 260;
  const padX = 40;
  const padTop = 20;
  const baseY = H - 46; // chart baseline (room for x-labels)
  const maxV = 50; // y-axis top, in vol points

  const plotW = W - padX * 2;
  const y = (v: number) => baseY - (v / maxV) * (baseY - padTop);

  // Column layout: five single-name bars, then the index bar in its own slot.
  const cols = singleVols.length + 1;
  const slot = plotW / cols;
  const barW = slot * 0.56;
  const colX = (i: number) => padX + slot * i + (slot - barW) / 2;
  const indexCol = singleVols.length;

  const avgY = y(avgVol);
  const indexBarColor =
    mode === 'low' ? 'var(--color-brand-600)' : 'var(--color-accent-600)';

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
            onClick={() => setMode('low')}
            aria-pressed={mode === 'low'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'low'
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {lowCorrLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('high')}
            aria-pressed={mode === 'high'}
            className={cx(
              'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
              mode === 'high'
                ? 'bg-accent-500 text-white'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {highCorrLabel}
          </button>
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}. Single-name implied vols (equal-weighted): ${singleVols
          .map((v, i) => `${stockLabels[i]} ${v}${percentSuffix}`)
          .join(', ')}. ${avgSingleVolLabel}: ${avgVol.toFixed(
          1,
        )}${percentSuffix}. ${indexVolLabel}: ${indexVol.toFixed(
          1,
        )}${percentSuffix}. The gap implies a correlation of ${impliedCorr.toFixed(
          2,
        )}.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={baseY}
          x2={W - padX}
          y2={baseY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
        />

        {/* Single-name bars (fixed across regimes). Equal weights assumed. */}
        {singleVols.map((v, i) => (
          <g key={stockLabels[i]}>
            <rect
              x={colX(i)}
              y={y(v)}
              width={barW}
              height={baseY - y(v)}
              rx={3}
              fill="var(--color-ink-300)"
              className="transition-all duration-500 motion-reduce:transition-none"
            />
            <text
              x={colX(i) + barW / 2}
              y={y(v) - 5}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="var(--color-ink-600)"
            >
              {v}
              {percentSuffix}
            </text>
            <text
              x={colX(i) + barW / 2}
              y={baseY + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-500)"
            >
              {stockLabels[i]}
            </text>
          </g>
        ))}

        {/* Index implied-vol bar — contrasting color so the gap to the dashed
            average line is obvious. Re-keyed on mode so it re-grows on toggle. */}
        <rect
          key={`index-${mode}`}
          x={colX(indexCol)}
          y={y(indexVol)}
          width={barW}
          height={baseY - y(indexVol)}
          rx={3}
          fill={indexBarColor}
          className="transition-all duration-500 motion-reduce:transition-none"
        />
        <text
          x={colX(indexCol) + barW / 2}
          y={y(indexVol) - 5}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={indexBarColor}
        >
          {indexVol.toFixed(1)}
          {percentSuffix}
        </text>
        <text
          x={colX(indexCol) + barW / 2}
          y={baseY + 14}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill={indexBarColor}
        >
          Index
        </text>

        {/* Dashed weighted-average reference line across the whole chart. */}
        <line
          x1={padX}
          y1={avgY}
          x2={W - padX}
          y2={avgY}
          stroke="var(--color-brand-500)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text
          x={padX + 2}
          y={avgY - 5}
          fontSize={10}
          fontWeight={600}
          fill="var(--color-brand-600)"
        >
          {avgSingleVolLabel}: {avgVol.toFixed(1)}
          {percentSuffix}
        </text>

        {/* Gap bracket between the average line and the index bar top. */}
        <line
          key={`gap-${mode}`}
          x1={colX(indexCol) + barW / 2}
          y1={avgY}
          x2={colX(indexCol) + barW / 2}
          y2={y(indexVol)}
          stroke="var(--color-ink-500)"
          strokeWidth={1.25}
          strokeDasharray="2 3"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Axis label */}
        <text
          x={padX - 8}
          y={padTop - 4}
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {volAxisLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {indexVolLabel}:{' '}
          <span className="font-medium text-ink-900">
            {indexVol.toFixed(1)}
            {percentSuffix}
          </span>
        </span>
        <span className="text-ink-600">
          {impliedCorrLabel}:{' '}
          <span
            className={cx(
              'font-medium',
              mode === 'low' ? 'text-brand-600' : 'text-accent-600',
            )}
          >
            {impliedCorr.toFixed(2)}
          </span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {mode === 'low' ? note ?? lowCorrNote : highCorrNote}
      </p>
    </figure>
  );
}

export default DispersionBars;
