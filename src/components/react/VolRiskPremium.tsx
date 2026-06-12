import { cx } from '@/components/react/cx';

export interface VolRiskPremiumProps {
  /** Heading above the chart. */
  title?: string;
  /** Legend label for the implied-volatility line. */
  impliedLabel?: string;
  /** Legend label for the realized-volatility line. */
  realizedLabel?: string;
  /** Legend label for the green premium band (implied above realized). */
  premiumLabel?: string;
  /** Legend label for the red loss band (realized above implied). */
  lossLabel?: string;
  /** Label for the x-axis (time). */
  timeLabel?: string;
  /** Label for the y-axis (annualized volatility). */
  volLabel?: string;
  /** Label for the computed average-premium stat. */
  avgPremiumLabel?: string;
  /** Explanatory sentence shown in the aria-live note. */
  note?: string;
  /** Suffix appended to percentage values. Defaults to `'%'`. */
  percentSuffix?: string;
  className?: string;
}

const pct = (value: number, suffix: string, signed = false): string =>
  `${signed && value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`;

// 24 monthly observations of annualized volatility (%). Implied sits a few
// points above realized through the calm stretches — the premium a vol seller
// harvests. The crisis episode (points 14–16) flips that: realized gaps far
// above implied as a crash hits, and the short-vol position takes a sudden,
// large loss before the market re-calms.
const IMPLIED = [
  16, 15, 17, 16, 18, 17, 15, 16, 18, 17, 19, 18, 17, 20, 38, 40, 36, 24, 21,
  19, 18, 17, 16, 17,
];
const REALIZED = [
  12, 13, 12, 13, 14, 13, 12, 13, 14, 13, 15, 14, 13, 22, 55, 52, 30, 18, 16,
  15, 14, 13, 12, 13,
];

/**
 * Volatility risk premium. Implied volatility — the vol baked into option
 * prices — is what buyers PAY for protection, and it embeds a risk premium, so
 * it sits **above** the volatility that subsequently materialises most of the
 * time. Selling options, straddles or variance swaps harvests that gap: the
 * green band between the curves where implied > realized. But the premium is
 * compensation for tail risk. The chart shows one crisis episode where realized
 * vol gaps **above** implied (the red band) — the moment a short-vol seller
 * takes a large, sudden loss. Both lines draw in on mount via stroke-dashoffset,
 * gated by `motion-reduce`.
 */
export function VolRiskPremium({
  title = 'The volatility risk premium: implied vs realized',
  impliedLabel = 'Implied volatility',
  realizedLabel = 'Realized volatility',
  premiumLabel = 'Premium harvested (implied − realized)',
  lossLabel = 'Short-vol loss (realized > implied)',
  timeLabel = 'Time',
  volLabel = 'Annualized volatility',
  avgPremiumLabel = 'Average monthly premium',
  note = 'Implied volatility is what option buyers pay for protection, and that price embeds a risk premium — so on average it exceeds the volatility that actually materializes. Selling options, straddles or variance swaps harvests that gap (the green band). But the premium is compensation for tail risk: in a crash realized volatility gaps above implied (the red band) and the short-vol seller takes a large, sudden loss. Selling volatility is picking up pennies in front of a steamroller.',
  percentSuffix = '%',
  className,
}: VolRiskPremiumProps) {
  const n = IMPLIED.length;

  const avgPremium =
    IMPLIED.reduce((sum, v, i) => sum + (v - REALIZED[i]), 0) / n;

  const W = 560;
  const H = 280;
  const padX = 40;
  const padY = 28;
  const minV = 0;
  const maxV = 60;

  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) =>
    padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);

  const linePath = (series: number[]) =>
    series
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ');

  const impliedPath = linePath(IMPLIED);
  const realizedPath = linePath(REALIZED);

  // Approximate total line length so the dash-draw animation covers the whole
  // curve regardless of exact geometry.
  const lineLen = W * 1.8;

  // Per-segment quadrilaterals between the two curves, colored by which line is
  // on top across that segment (premium = green/brand, loss = red/accent).
  const bands = Array.from({ length: n - 1 }, (_, i) => {
    const x0 = x(i);
    const x1 = x(i + 1);
    const premiumHere =
      IMPLIED[i] >= REALIZED[i] && IMPLIED[i + 1] >= REALIZED[i + 1];
    const d = `M ${x0.toFixed(1)} ${y(IMPLIED[i]).toFixed(1)} L ${x1.toFixed(
      1,
    )} ${y(IMPLIED[i + 1]).toFixed(1)} L ${x1.toFixed(1)} ${y(
      REALIZED[i + 1],
    ).toFixed(1)} L ${x0.toFixed(1)} ${y(REALIZED[i]).toFixed(1)} Z`;
    return { d, premium: premiumHere, key: i };
  });

  const yTicks = [0, 20, 40, 60];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-brand-600)' }}
            aria-hidden="true"
          />
          {impliedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'var(--color-accent-600)' }}
            aria-hidden="true"
          />
          {realizedLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              backgroundColor: 'var(--color-brand-500)',
              opacity: 0.3,
            }}
            aria-hidden="true"
          />
          {premiumLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              backgroundColor: 'var(--color-accent-500)',
              opacity: 0.3,
            }}
            aria-hidden="true"
          />
          {lossLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`${title}: implied volatility (${impliedLabel}) sits above realized volatility (${realizedLabel}) through most of the period — the harvested premium averages ${pct(
          avgPremium,
          percentSuffix,
          true,
        )} per month — but during the crisis episode realized volatility gaps above implied and the short-vol position takes a large loss.`}
      >
        <style>{`
          @keyframes vrp-draw { to { stroke-dashoffset: 0; } }
          .vrp-line {
            stroke-dasharray: ${lineLen};
            stroke-dashoffset: ${lineLen};
            animation: vrp-draw 1.8s ease-out forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .vrp-line {
              stroke-dasharray: none;
              stroke-dashoffset: 0;
              animation: none;
            }
          }
        `}</style>

        {/* Horizontal gridlines + y-axis ticks */}
        {yTicks.map((v) => (
          <g key={v}>
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
              y={y(v) + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-500)"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Shaded bands between the curves */}
        {bands.map((b) => (
          <path
            key={b.key}
            d={b.d}
            fill={
              b.premium
                ? 'var(--color-brand-500)'
                : 'var(--color-accent-500)'
            }
            fillOpacity={0.15}
            stroke="none"
          />
        ))}

        {/* Realized volatility line (accent) */}
        <path
          d={realizedPath}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="vrp-line"
        />

        {/* Implied volatility line (brand) */}
        <path
          d={impliedPath}
          fill="none"
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="vrp-line"
        />

        {/* X-axis baseline */}
        <line
          x1={padX}
          y1={H - padY}
          x2={W - padX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
          strokeWidth={1.5}
        />

        {/* Axis labels */}
        <text
          x={W / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {timeLabel}
        </text>
        <text
          x={padX - 6}
          y={padY - 12}
          fontSize={11}
          fill="var(--color-ink-500)"
        >
          {volLabel}
        </text>
      </svg>

      <div className="mt-3 text-sm">
        <span className="text-ink-600">
          {avgPremiumLabel}:{' '}
          <span
            className={cx(
              'font-medium',
              avgPremium >= 0 ? 'text-brand-600' : 'text-accent-600',
            )}
          >
            {pct(avgPremium, percentSuffix, true)}
          </span>
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-600" aria-live="polite">
        {note}
      </p>
    </figure>
  );
}

export default VolRiskPremium;
