import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PoShrinkageSliderProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the shrinkage-intensity slider (0 = sample, 1 = target). */
  intensityLabel?: string;
  /** Caption under the slider for the 0 end (raw sample estimate). */
  sampleEndLabel?: string;
  /** Caption under the slider for the 1 end (structured target). */
  targetEndLabel?: string;
  /** Asset names labelling the bars. */
  assetLabels?: string[];
  /** Legend label for the noisy sample estimate. */
  sampleLabel?: string;
  /** Legend label for the shrinkage target. */
  targetTermLabel?: string;
  /** Legend label for the blended (shrunk) estimate. */
  shrunkLabel?: string;
  /** Readout label for out-of-sample error. */
  errorLabel?: string;
  /** Caption text. */
  caption?: string;
  className?: string;
}

/**
 * Ledoit–Wolf shrinkage in one picture. Each bar group shows three estimates of
 * an asset's (co)variance contribution: the noisy **sample** estimate (jagged,
 * over-fit), a structured **target** (everything pulled toward a common value),
 * and the **shrunk** blend δ·target + (1−δ)·sample. A slider sets the shrinkage
 * intensity δ. A small out-of-sample error gauge is U-shaped in δ: zero
 * shrinkage over-fits, full shrinkage over-smooths, and the sweet spot sits in
 * between — exactly the bias–variance trade-off Ledoit–Wolf solves for in
 * closed form. Locale-agnostic.
 */
export function PoShrinkageSlider({
  title = 'Shrinkage: blend the noisy sample toward structure',
  intensityLabel = 'Shrinkage intensity δ',
  sampleEndLabel = 'δ = 0: raw sample (over-fit)',
  targetEndLabel = 'δ = 1: target (over-smoothed)',
  assetLabels = ['A', 'B', 'C', 'D', 'E'],
  sampleLabel = 'Sample estimate (noisy)',
  targetTermLabel = 'Target (structured)',
  shrunkLabel = 'Shrunk blend',
  errorLabel = 'Out-of-sample error',
  caption = 'The raw sample estimate is jagged — it has fit the noise. The target pulls every value toward a sensible common anchor. Shrinkage takes a weighted average of the two; slide δ and watch the blend smooth out. The error gauge is U-shaped: too little shrinkage over-fits, too much throws away signal, and Ledoit–Wolf computes the optimal δ in between for you.',
  className,
}: PoShrinkageSliderProps) {
  const id = useId();
  const n = assetLabels.length;
  const [delta, setDelta] = useState(0.4);

  // Deterministic "noisy sample" values and a common target (their average).
  const sample = useMemo(() => {
    const base = [0.85, 0.25, 0.6, 1.05, 0.4];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  }, [n]);
  const target = useMemo(() => {
    const avg = sample.reduce((a, b) => a + b, 0) / n;
    return Array.from({ length: n }, () => avg);
  }, [sample, n]);
  const shrunk = sample.map((s, i) => delta * target[i] + (1 - delta) * s);

  // U-shaped out-of-sample error: min near δ* ≈ 0.45.
  const dStar = 0.45;
  const error = 0.25 + 1.9 * (delta - dStar) * (delta - dStar);

  const W = 540;
  const H = 280;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const vMax = 1.3;
  const toY = (v: number): number => padT + plotH - (v / vMax) * plotH;
  const slot = plotW / n;
  const bw = slot / 4.2;

  const ariaLabel = `${title}. Shrinkage intensity δ is ${delta.toFixed(
    2,
  )}. The ${errorLabel.toLowerCase()} is lowest near δ = ${dStar}.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          δ {delta.toFixed(2)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <rect width="12" height="12" rx="2" fill="var(--color-ink-300)" />
          </svg>
          {sampleLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <rect width="12" height="12" rx="2" fill="var(--color-accent-400)" />
          </svg>
          {targetTermLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12" aria-hidden="true">
            <rect width="12" height="12" rx="2" fill="var(--color-brand-600)" />
          </svg>
          {shrunkLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
        <line x1={padL} y1={toY(0)} x2={W - padR} y2={toY(0)} stroke="var(--color-ink-300)" strokeWidth={1.5} />
        {sample.map((s, i) => {
          const cx0 = padL + slot * (i + 0.5);
          return (
            <g key={`g-${i}`}>
              <rect x={cx0 - bw * 1.6} y={toY(s)} width={bw} height={toY(0) - toY(s)} rx={2} fill="var(--color-ink-300)" />
              <rect x={cx0 - bw * 0.5} y={toY(target[i])} width={bw} height={toY(0) - toY(target[i])} rx={2} fill="var(--color-accent-400)" />
              <rect x={cx0 + bw * 0.6} y={toY(shrunk[i])} width={bw} height={toY(0) - toY(shrunk[i])} rx={2} fill="var(--color-brand-600)" />
              <text x={cx0} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
                {assetLabels[i]}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2">
        <label htmlFor={`${id}-d`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{intensityLabel}</span>
          <span className="font-mono text-ink-900">{delta.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-d`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
          aria-label={intensityLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{sampleEndLabel}</span>
          <span>{targetEndLabel}</span>
        </div>
      </div>

      {/* Error gauge */}
      <div className="mt-4 rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-500">{errorLabel}</span>
          <span className="font-mono font-semibold text-ink-900">{error.toFixed(2)}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-ink-100">
          <div
            className="h-full rounded-pill bg-accent-500 transition-[width] duration-200"
            style={{ width: `${Math.min(100, error * 45)}%` }}
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PoShrinkageSlider;
