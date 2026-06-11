import { useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SeasonalityCommodity {
  /** Stable key used for the toggle button. */
  key: string;
  /** Button label, e.g. "Natural gas". */
  label: string;
  /** 12 relative price levels, one per month (Jan..Dec), ~100 = average. */
  levels: number[];
  /** One-line explanation of why this commodity moves with the seasons. */
  note: string;
}

export interface SeasonalityWaveProps {
  /** Heading above the chart. */
  title?: string;
  /** Twelve month abbreviations, Jan..Dec. Override for localisation. */
  monthLabels?: string[];
  /** The commodities to toggle between. Sensible finance defaults provided. */
  commodities?: SeasonalityCommodity[];
  /** Label for the y-axis (relative price). */
  priceLabel?: string;
  /** Label prefix for the animated "current month" readout. */
  peakLabel?: string;
  /** Label prefix for the seasonal-low readout. */
  troughLabel?: string;
  className?: string;
}

const DEFAULT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DEFAULT_COMMODITIES: SeasonalityCommodity[] = [
  {
    key: 'natgas',
    label: 'Natural gas',
    // Winter heating demand peaks Dec–Feb; mild shoulder months sag.
    levels: [118, 115, 104, 94, 88, 86, 90, 92, 95, 100, 108, 116],
    note: 'Natural gas peaks in winter: homes and power plants burn it for heat when it is cold, so demand — and price — climbs from late autumn, tops out in January, then collapses through the mild spring "shoulder" months when nobody needs heating.',
  },
  {
    key: 'gasoline',
    label: 'Gasoline',
    // US "summer driving season" demand + summer-blend switch lift Apr–Aug.
    levels: [90, 91, 96, 103, 109, 112, 111, 106, 99, 94, 91, 90],
    note: 'Gasoline peaks in summer: the US "driving season" plus the switch to costlier summer-blend fuel lifts demand from spring into August, then prices ease as cooler months and cheaper winter blend arrive.',
  },
  {
    key: 'corn',
    label: 'Corn (harvest)',
    // Pre-harvest scarcity lifts summer; harvest glut bottoms in autumn.
    levels: [104, 106, 108, 110, 112, 113, 110, 102, 94, 90, 92, 98],
    note: 'Grains like corn bottom at harvest: old-crop supplies are tightest just before the autumn harvest (prices high in summer), then the flood of newly harvested grain in September–October swamps the market and prices fall to a seasonal low.',
  },
];

/**
 * Seasonality wave. Many commodities follow a calendar: demand or supply swings
 * with the weather and the growing year, so their price traces a repeating
 * annual shape rather than a random walk. This island plots a commodity's
 * average price level across the twelve months and sweeps an animated marker
 * around the year so the learner *sees* the cycle — winter for natural gas,
 * the summer driving peak for gasoline, the autumn harvest low for grain.
 * Toggle between commodities to compare their seasonal signatures. The marker
 * sweep is a pure CSS keyframe that honours `motion-reduce` (it parks at the
 * seasonal peak when motion is reduced).
 */
export function SeasonalityWave({
  title = 'Seasonality: prices that follow the calendar',
  monthLabels = DEFAULT_MONTHS,
  commodities = DEFAULT_COMMODITIES,
  priceLabel = 'Relative price',
  peakLabel = 'Seasonal peak',
  troughLabel = 'Seasonal low',
  className,
}: SeasonalityWaveProps) {
  const [activeKey, setActiveKey] = useState(commodities[0].key);
  const active =
    commodities.find((c) => c.key === activeKey) ?? commodities[0];
  const levels = active.levels;

  const peakIdx = levels.indexOf(Math.max(...levels));
  const troughIdx = levels.indexOf(Math.min(...levels));

  const W = 540;
  const H = 250;
  const padX = 38;
  const padY = 26;
  const minV = 82;
  const maxV = 122;

  const x = (m: number) => padX + (m / 11) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  // Smooth-ish closed-ish polyline through the 12 monthly points.
  const linePath = levels
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  // Area fill under the line.
  const areaPath = `${linePath} L ${x(11).toFixed(1)} ${(H - padY).toFixed(1)} L ${x(0).toFixed(1)} ${(H - padY).toFixed(1)} Z`;

  // SVG <animateMotion> needs an explicit path for the marker to ride.
  const motionPath = linePath;

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
          className="inline-flex flex-wrap rounded-pill border border-ink-200 p-0.5"
          role="group"
        >
          {commodities.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveKey(c.key)}
              aria-pressed={activeKey === c.key}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition motion-reduce:transition-none',
                activeKey === c.key
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-600 hover:text-ink-900',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: ${active.label} relative price across the year peaks in ${monthLabels[peakIdx]} and bottoms in ${monthLabels[troughIdx]}.`}
      >
        {/* Average reference line at 100 */}
        <line
          x1={padX}
          y1={y(100)}
          x2={W - padX}
          y2={y(100)}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <text
          x={W - padX}
          y={y(100) - 6}
          textAnchor="end"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          avg
        </text>

        {/* Area + line, re-keyed on commodity so the transition restarts. */}
        <path
          key={`area-${active.key}`}
          d={areaPath}
          fill="var(--color-brand-500)"
          opacity={0.1}
        />
        <path
          key={`line-${active.key}`}
          d={linePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="transition-all duration-500 motion-reduce:transition-none"
        />

        {/* Peak + trough emphasis dots */}
        <circle cx={x(peakIdx)} cy={y(levels[peakIdx])} r={5} fill="var(--color-accent-500)" stroke="white" strokeWidth={1.5} />
        <circle cx={x(troughIdx)} cy={y(levels[troughIdx])} r={5} fill="var(--color-brand-600)" stroke="white" strokeWidth={1.5} />

        {/* Animated marker sweeping the year. Parks at the peak under motion-reduce. */}
        <circle
          r={6}
          fill="var(--color-brand-600)"
          stroke="white"
          strokeWidth={2}
          className="motion-reduce:hidden"
        >
          <animateMotion
            key={`motion-${active.key}`}
            dur="6s"
            repeatCount="indefinite"
            rotate="0"
            path={motionPath}
          />
        </circle>
        {/* Static fallback marker for reduced motion: sits on the seasonal peak. */}
        <circle
          cx={x(peakIdx)}
          cy={y(levels[peakIdx])}
          r={6}
          fill="var(--color-brand-600)"
          stroke="white"
          strokeWidth={2}
          className="hidden motion-reduce:block"
        />

        {/* Month ticks */}
        {monthLabels.map((label, i) => (
          <text
            key={label + i}
            x={x(i)}
            y={H - padY + 14}
            textAnchor="middle"
            fontSize={9}
            fill="var(--color-ink-500)"
          >
            {label}
          </text>
        ))}

        {/* Y-axis label */}
        <text x={padX - 8} y={padY - 10} fontSize={11} fill="var(--color-ink-500)">
          {priceLabel}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-ink-600">
          {peakLabel}:{' '}
          <span className="font-medium text-accent-600">
            {monthLabels[peakIdx]}
          </span>
        </span>
        <span className="text-ink-600">
          {troughLabel}:{' '}
          <span className="font-medium text-brand-600">
            {monthLabels[troughIdx]}
          </span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {active.note}
      </p>
    </figure>
  );
}

export default SeasonalityWave;
