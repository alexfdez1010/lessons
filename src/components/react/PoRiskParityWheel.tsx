import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PoRiskParityWheelProps {
  /** Heading above the chart. */
  title?: string;
  /** Asset names. */
  assetLabels?: string[];
  /** Per-asset volatilities (decimal). Drives the gap between capital and risk shares. */
  vols?: number[];
  /** Toggle button: switch to the equal-weight (60/40-style) allocation. */
  equalWeightLabel?: string;
  /** Toggle button: switch to the risk-parity allocation. */
  riskParityLabel?: string;
  /** Heading for the left donut (capital shares). */
  capitalHeading?: string;
  /** Heading for the right donut (risk contributions). */
  riskHeading?: string;
  /** Caption text. */
  caption?: string;
  className?: string;
}

const COLORS = [
  'var(--color-brand-600)',
  'var(--color-accent-500)',
  'var(--color-brand-400)',
  'var(--color-accent-400)',
  'var(--color-ink-400)',
];

/**
 * Two side-by-side donuts contrast **capital allocation** with **risk
 * contribution**. Under equal weighting, capital looks balanced but the
 * riskiest asset hogs the risk donut — a 60/40 portfolio is really a ~90% equity
 * risk bet. Toggle to **risk parity** and the right donut equalizes (every slice
 * the same), while the left donut tilts hard toward the low-volatility asset.
 * The lesson: equalizing dollars is not equalizing risk. Slices use a simple
 * proportional model (risk share ∝ weight × vol). Locale-agnostic.
 */
export function PoRiskParityWheel({
  title = 'Equal dollars ≠ equal risk',
  assetLabels = ['Stocks', 'Bonds', 'Commodities'],
  vols = [0.18, 0.05, 0.15],
  equalWeightLabel = 'Equal weight',
  riskParityLabel = 'Risk parity',
  capitalHeading = 'Capital share',
  riskHeading = 'Risk contribution',
  caption = 'Left donut: how the money is split. Right donut: how the risk is split. With equal dollars, the volatile asset quietly dominates the risk — your “balanced” fund is anything but. Switch to risk parity and the risk donut evens out, at the cost of piling capital (and often leverage) into the calm asset.',
  className,
}: PoRiskParityWheelProps) {
  const id = useId();
  const n = assetLabels.length;
  const [parity, setParity] = useState(false);

  // Capital weights.
  const weights = useMemo(() => {
    if (!parity) return Array.from({ length: n }, () => 1 / n);
    // Risk parity (simple inverse-vol proxy): w_i ∝ 1/σ_i.
    const inv = vols.map((v) => 1 / v);
    const s = inv.reduce((a, b) => a + b, 0);
    return inv.map((x) => x / s);
  }, [parity, n, vols]);

  // Risk contribution ∝ w_i · σ_i (proportional proxy).
  const riskRaw = weights.map((w, i) => w * vols[i % vols.length]);
  const riskSum = riskRaw.reduce((a, b) => a + b, 0);
  const riskShares = riskRaw.map((r) => r / riskSum);

  const donut = (shares: number[], cx0: number, cy: number, r: number, rInner: number) => {
    let acc = 0;
    return shares.map((sh, i) => {
      const a0 = acc * 2 * Math.PI - Math.PI / 2;
      acc += sh;
      const a1 = acc * 2 * Math.PI - Math.PI / 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx0 + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx0 + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const xi1 = cx0 + rInner * Math.cos(a1);
      const yi1 = cy + rInner * Math.sin(a1);
      const xi0 = cx0 + rInner * Math.cos(a0);
      const yi0 = cy + rInner * Math.sin(a0);
      const d = `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(
        1,
      )} L${xi1.toFixed(1)} ${yi1.toFixed(1)} A${rInner} ${rInner} 0 ${large} 0 ${xi0.toFixed(1)} ${yi0.toFixed(
        1,
      )} Z`;
      return <path key={`s-${i}`} d={d} fill={COLORS[i % COLORS.length]} opacity={0.92} />;
    });
  };

  const W = 460;
  const H = 240;
  const r = 70;
  const rInner = 40;

  const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
  const ariaLabel = `${title}. ${parity ? riskParityLabel : equalWeightLabel} allocation. ${assetLabels
    .map((a, i) => `${a}: ${capitalHeading} ${pct(weights[i])}, ${riskHeading} ${pct(riskShares[i])}`)
    .join('. ')}.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          {parity ? riskParityLabel : equalWeightLabel}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        <text x={120} y={20} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--color-ink-700)">
          {capitalHeading}
        </text>
        <text x={340} y={20} textAnchor="middle" fontSize="12" fontWeight={600} fill="var(--color-ink-700)">
          {riskHeading}
        </text>
        {donut(weights, 120, 130, r, rInner)}
        {donut(riskShares, 340, 130, r, rInner)}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
        {assetLabels.map((a, i) => (
          <span key={`lg-${i}`} className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden="true">
              <rect width="12" height="12" rx="2" fill={COLORS[i % COLORS.length]} />
            </svg>
            {a}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setParity((p) => !p)}
        className="mt-3 rounded-pill border border-ink-200 bg-surface px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        aria-pressed={parity}
        id={`${id}-toggle`}
      >
        {parity ? equalWeightLabel : riskParityLabel}
      </button>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PoRiskParityWheel;
