import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvGpdThresholdProps {
  /** Heading above the chart. */
  title?: string;
  /** Slider label for the threshold u. */
  thresholdLabel?: string;
  /** Slider label for the shape parameter ξ. */
  shapeLabel?: string;
  /** Label for the bars below threshold. */
  bodyLabel?: string;
  /** Label for the exceedances above threshold. */
  tailLabel?: string;
  /** Readout label for the count of exceedances. */
  countLabel?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const num = (value: number, digits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

// Deterministic pseudo-random losses (so the picture is stable across renders).
const makeLosses = (n: number): number[] => {
  const out: number[] = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < n; i++) {
    // Mix a body (normal-ish) with an occasional fat draw.
    const u1 = rand();
    const u2 = rand();
    const g = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2);
    let v = 2.5 + g * 1.0;
    if (rand() > 0.93) v += rand() * 6; // fat tail spikes
    out.push(Math.max(0, v));
  }
  return out;
};

/**
 * Peaks-over-threshold visual. A histogram of losses is split at a movable
 * threshold u: everything below is the calm "body", everything above is an
 * exceedance whose overshoot (loss − u) is what the Generalized Pareto
 * Distribution models. A GPD density curve is drawn over the exceedance region,
 * reshaped by the shape parameter ξ — ξ &gt; 0 gives a heavy power-law tail,
 * ξ = 0 an exponential one, ξ &lt; 0 a bounded tail. The readout counts how many
 * exceedances feed the fit, the central trade-off of threshold choice.
 */
export function EvGpdThreshold({
  title = 'Peaks over threshold: model only the overshoots',
  thresholdLabel = 'Threshold u',
  shapeLabel = 'Shape ξ',
  bodyLabel = 'Body (ignored)',
  tailLabel = 'Exceedances (modelled by GPD)',
  countLabel = 'Exceedances above the threshold',
  caption = 'Drag the threshold up and the calm body greys out — only the overshoots past u are kept, and the Generalized Pareto curve is fitted to those. Raise ξ and the fitted tail fattens into a power law; push it negative and the tail acquires a hard ceiling. Set u too high and almost no exceedances remain to fit (high variance); too low and the GPD approximation breaks (bias). That tension is the whole art of POT.',
  className,
}: EvGpdThresholdProps) {
  const id = useId();
  const [u, setU] = useState(5);
  const [xi, setXi] = useState(0.2);

  const losses = makeLosses(400);
  const lossMax = 12;

  const W = 540;
  const H = 250;
  const padL = 14;
  const padR = 14;
  const padT = 14;
  const padB = 28;

  const BINS = 40;
  const counts = new Array(BINS).fill(0);
  for (const v of losses) {
    const b = Math.min(BINS - 1, Math.floor((v / lossMax) * BINS));
    counts[b] += 1;
  }
  const maxCount = Math.max(...counts);

  const binWidth = (W - padL - padR) / BINS;
  const x = (v: number) => padL + (v / lossMax) * (W - padL - padR);
  const yBase = H - padB;
  const yTop = padT;
  const barH = (c: number) => (maxCount > 0 ? (c / maxCount) * (yBase - yTop) : 0);

  const exceedances = losses.filter((v) => v > u).length;

  // GPD density on the exceedance region (overshoot y = v - u >= 0).
  // f(y) = (1/sigma)(1 + xi*y/sigma)^(-1/xi - 1), sigma fixed scale.
  const sigma = 1.5;
  const gpdPts: { v: number; p: number }[] = [];
  const SAMPLES = 80;
  for (let i = 0; i <= SAMPLES; i++) {
    const v = u + (i / SAMPLES) * (lossMax - u);
    const yv = v - u;
    let p: number;
    if (Math.abs(xi) < 1e-6) {
      p = (1 / sigma) * Math.exp(-yv / sigma);
    } else {
      const base = 1 + (xi * yv) / sigma;
      p = base > 0 ? (1 / sigma) * Math.pow(base, -1 / xi - 1) : 0;
    }
    gpdPts.push({ v, p });
  }
  const gpdMax = Math.max(...gpdPts.map((p) => p.p), 1e-9);
  // Scale GPD curve to occupy upper portion of the plot for visibility.
  const gpdScale = (yBase - yTop) * 0.7;
  const gy = (p: number) => yBase - (p / gpdMax) * gpdScale;
  const gpdPath = gpdPts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${num(x(p.v), 2)} ${num(gy(p.p), 2)}`)
    .join(' ');

  const uX = x(u);

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
          u {num(u, 1)} · ξ {num(xi, 2)}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-ink-200" aria-hidden="true" />
          {bodyLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden="true" />
          {tailLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. With the threshold at ${num(u, 1)} there are ${num(exceedances, 0)} exceedances, fitted by a Generalized Pareto curve with shape ${num(xi, 2)}.`}
      >
        <line x1={padL} y1={yBase} x2={W - padR} y2={yBase} stroke="var(--color-ink-200)" />
        {counts.map((c, i) => {
          const binCenter = ((i + 0.5) / BINS) * lossMax;
          const above = binCenter > u;
          return (
            <rect
              key={i}
              x={padL + i * binWidth + 0.5}
              y={yBase - barH(c)}
              width={Math.max(0.5, binWidth - 1)}
              height={barH(c)}
              fill={above ? 'var(--color-brand-500)' : 'var(--color-ink-200)'}
              opacity={above ? 0.85 : 0.5}
            />
          );
        })}

        {/* threshold line */}
        <line
          x1={uX}
          y1={yTop}
          x2={uX}
          y2={yBase}
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeDasharray="5 4"
        />
        <text x={uX + 4} y={yTop + 12} fontSize={11} fontWeight={600} fill="var(--color-accent-600)">
          u
        </text>

        {/* GPD curve over exceedances */}
        <path
          d={gpdPath}
          fill="none"
          stroke="var(--color-accent-600)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'd 200ms ease' }}
        />
      </svg>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-u`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{thresholdLabel}</span>
            <span className="font-mono text-ink-900">{num(u, 1)}</span>
          </label>
          <input
            id={`${id}-u`}
            type="range"
            min={2}
            max={9}
            step={0.1}
            value={u}
            onChange={(e) => setU(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-xi`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{shapeLabel}</span>
            <span className="font-mono text-ink-900">{num(xi, 2)}</span>
          </label>
          <input
            id={`${id}-xi`}
            type="range"
            min={-0.4}
            max={0.6}
            step={0.02}
            value={xi}
            onChange={(e) => setXi(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{countLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(exceedances, 0)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvGpdThreshold;
