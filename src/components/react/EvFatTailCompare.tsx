import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvFatTailCompareProps {
  /** Heading above the chart. */
  title?: string;
  /** Slider label for the tail-heaviness control. */
  tailLabel?: string;
  /** Label for the normal (Gaussian) curve. */
  normalLabel?: string;
  /** Label for the fat-tailed curve. */
  fatLabel?: string;
  /** Label for the readout of how much more likely an extreme move is. */
  ratioLabel?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const num = (value: number, digits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

// Standard normal density.
const normPdf = (x: number): number => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);

// Student-t density (unscaled, location 0), normalised so the body roughly matches.
const tPdf = (x: number, nu: number): number => {
  const g1 = gammaLn((nu + 1) / 2);
  const g2 = gammaLn(nu / 2);
  const c = Math.exp(g1 - g2) / Math.sqrt(nu * Math.PI);
  return c * Math.pow(1 + (x * x) / nu, -(nu + 1) / 2);
};

// Lanczos log-gamma.
const gammaLn = (z: number): number => {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - gammaLn(1 - z);
  }
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

/**
 * Side-by-side comparison of a Gaussian density and a fat-tailed (Student-t)
 * density with the same centre. The slider lowers the degrees of freedom ν,
 * fattening the tails. A linear-then-log toggle reveals how the tail mass — tiny
 * on a linear axis — towers over the normal once you look in log scale. The
 * readout reports how many times more likely a 4σ move is under the fat tail.
 * Respects prefers-reduced-motion implicitly (no looping animation, only CSS
 * transitions on the curves).
 */
export function EvFatTailCompare({
  title = 'Same middle, very different tails',
  tailLabel = 'Tail heaviness (lower ν = fatter)',
  normalLabel = 'Normal (Gaussian)',
  fatLabel = 'Fat-tailed (Student-t)',
  ratioLabel = 'A 4σ move is this many times more likely',
  caption = 'Both curves look almost identical in the middle, where 99% of days live. But slide ν down and the fat-tailed curve refuses to hug the axis out in the tails — and the readout shows a 4-sigma crash going from a once-in-a-lifetime fluke under the normal to a regular visitor under fat tails.',
  className,
}: EvFatTailCompareProps) {
  const id = useId();
  const [nu, setNu] = useState(3);
  const [logScale, setLogScale] = useState(false);

  const W = 540;
  const H = 260;
  const padX = 14;
  const padY = 14;
  const padBottom = 26;

  const xMin = -6;
  const xMax = 6;
  const SAMPLES = 260;

  const x = (v: number) => padX + ((v - xMin) / (xMax - xMin)) * (W - padX * 2);
  const yBase = H - padBottom;
  const yTop = padY;

  // Build grids.
  const normGrid: { v: number; p: number }[] = [];
  const fatGrid: { v: number; p: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const v = xMin + (i / SAMPLES) * (xMax - xMin);
    normGrid.push({ v, p: normPdf(v) });
    fatGrid.push({ v, p: tPdf(v, nu) });
  }

  const transform = (p: number): number => {
    if (!logScale) return p;
    // Map density to log scale; floor tiny values.
    const floor = 1e-5;
    const lp = Math.log10(Math.max(p, floor));
    const lmin = Math.log10(floor); // -5
    const lmax = Math.log10(0.45); // ~ peak
    return (lp - lmin) / (lmax - lmin);
  };

  let yMax = 0;
  for (const g of normGrid) yMax = Math.max(yMax, transform(g.p));
  for (const g of fatGrid) yMax = Math.max(yMax, transform(g.p));
  const y = (p: number) => yBase - (yMax > 0 ? transform(p) / yMax : 0) * (yBase - yTop);

  const pathOf = (grid: { v: number; p: number }[]) =>
    grid.map((g, i) => `${i === 0 ? 'M' : 'L'} ${num(x(g.v), 2)} ${num(y(g.p), 2)}`).join(' ');

  const ratio = tPdf(4, nu) / normPdf(4);

  const ticks = [-4, -2, 0, 2, 4];

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
          ν {num(nu, 1)}
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />
          {normalLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {fatLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. A 4 sigma move is about ${num(ratio, 0)} times more likely under the fat-tailed curve than under the normal one.`}
      >
        <line x1={padX} y1={yBase} x2={W - padX} y2={yBase} stroke="var(--color-ink-200)" />
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={x(tk)} y1={yBase} x2={x(tk)} y2={yBase + 4} stroke="var(--color-ink-200)" />
            <text
              x={x(tk)}
              y={yBase + 17}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-400)"
            >
              {num(tk, 0)}σ
            </text>
          </g>
        ))}

        <path
          d={pathOf(normGrid)}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'd 300ms ease' }}
        />
        <path
          d={pathOf(fatGrid)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ transition: 'd 300ms ease' }}
        />
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[12rem]">
          <label
            htmlFor={`${id}-nu`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{tailLabel}</span>
            <span className="font-mono text-ink-900">{num(nu, 1)}</span>
          </label>
          <input
            id={`${id}-nu`}
            type="range"
            min={2.5}
            max={30}
            step={0.5}
            value={nu}
            onChange={(e) => setNu(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <button
          type="button"
          aria-pressed={logScale}
          onClick={() => setLogScale((s) => !s)}
          className={cx(
            'rounded-pill border border-ink-100 px-4 py-2 text-sm font-medium transition-colors',
            logScale ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {logScale ? 'log y-axis' : 'linear y-axis'}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{ratioLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{num(ratio, 0)}×</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvFatTailCompare;
