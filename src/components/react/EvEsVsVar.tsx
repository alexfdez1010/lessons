import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvEsVsVarProps {
  /** Heading above the chart. */
  title?: string;
  /** Slider label for the confidence level. */
  confLabel?: string;
  /** Label for the VaR marker. */
  varLabel?: string;
  /** Label for the ES marker. */
  esLabel?: string;
  /** Readout label for VaR. */
  varReadout?: string;
  /** Readout label for ES. */
  esReadout?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const num = (value: number, digits = 2): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

const normPdf = (x: number): number => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);

// Inverse normal CDF (Acklam approximation) for the VaR quantile.
const normInv = (p: number): number => {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
};

/**
 * Loss-distribution picture contrasting Value-at-Risk (the quantile, a single
 * cut line) with Expected Shortfall (the average loss in the shaded tail beyond
 * that cut). Slide the confidence level and watch VaR step out while ES — the
 * centroid of the tail — sits further out still, because it averages the whole
 * tail including the monsters VaR ignores. For a standard normal the readouts
 * use the closed forms VaR = z and ES = φ(z)/(1−c).
 */
export function EvEsVsVar({
  title = 'VaR draws a line; ES averages what lies beyond it',
  confLabel = 'Confidence level',
  varLabel = 'VaR (the cut-off)',
  esLabel = 'ES (tail average)',
  varReadout = 'VaR (σ units)',
  esReadout = 'ES (σ units)',
  caption = 'VaR is just the line where the worst (1 − c) of outcomes begin — it tells you the threshold but says nothing about how bad things get past it. Expected Shortfall is the average of that shaded tail, so it always sits further out than VaR. Two books can share a VaR yet have wildly different ES; the gap is exactly the tail risk VaR is blind to.',
  className,
}: EvEsVsVarProps) {
  const id = useId();
  const [conf, setConf] = useState(0.95);

  const W = 540;
  const H = 250;
  const padX = 14;
  const padT = 16;
  const padB = 28;

  const xMin = -4;
  const xMax = 4;
  const SAMPLES = 240;

  const x = (v: number) => padX + ((v - xMin) / (xMax - xMin)) * (W - padX * 2);
  const yBase = H - padB;
  const yTop = padT;

  const grid: { v: number; p: number }[] = [];
  let pMax = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const v = xMin + (i / SAMPLES) * (xMax - xMin);
    const p = normPdf(v);
    if (p > pMax) pMax = p;
    grid.push({ v, p });
  }
  const y = (p: number) => yBase - (pMax > 0 ? p / pMax : 0) * (yBase - yTop);

  const curvePath = grid
    .map((g, i) => `${i === 0 ? 'M' : 'L'} ${num(x(g.v), 2)} ${num(y(g.p), 2)}`)
    .join(' ');

  // VaR quantile on the loss side: z = Φ^{-1}(conf).
  const z = normInv(conf);
  const es = normPdf(z) / (1 - conf);

  // Shaded tail beyond VaR (v > z).
  const tailPts = grid.filter((g) => g.v >= z);
  let shadePath = '';
  if (tailPts.length > 0) {
    const first = tailPts[0];
    const last = tailPts[tailPts.length - 1];
    shadePath =
      `M ${num(x(first.v), 2)} ${num(yBase, 2)} ` +
      tailPts.map((g) => `L ${num(x(g.v), 2)} ${num(y(g.p), 2)}`).join(' ') +
      ` L ${num(x(last.v), 2)} ${num(yBase, 2)} Z`;
  }

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
          {num(conf * 100, 0)}%
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-600" aria-hidden="true" />
          {varLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {esLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. At ${num(conf * 100, 0)} percent confidence, VaR is ${num(z, 2)} sigma and ES is ${num(es, 2)} sigma — ES lies further into the tail.`}
      >
        <line x1={padX} y1={yBase} x2={W - padX} y2={yBase} stroke="var(--color-ink-200)" />

        {shadePath && <path d={shadePath} fill="var(--color-brand-500)" opacity={0.18} />}

        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-ink-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* VaR line */}
        <line
          x1={x(z)}
          y1={yTop}
          x2={x(z)}
          y2={yBase}
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
        />
        {/* ES line */}
        <line
          x1={x(es)}
          y1={yTop}
          x2={x(es)}
          y2={yBase}
          stroke="var(--color-accent-500)"
          strokeWidth={2.5}
          strokeDasharray="5 4"
        />
      </svg>

      <div className="mt-4">
        <label
          htmlFor={`${id}-conf`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{confLabel}</span>
          <span className="font-mono text-ink-900">{num(conf * 100, 1)}%</span>
        </label>
        <input
          id={`${id}-conf`}
          type="range"
          min={90}
          max={99.5}
          step={0.5}
          value={conf * 100}
          onChange={(e) => setConf(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{varReadout}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(z, 2)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{esReadout}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(es, 2)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvEsVsVar;
