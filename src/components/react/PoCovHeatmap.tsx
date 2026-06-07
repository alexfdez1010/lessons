import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PoCovHeatmapProps {
  /** Heading above the chart. */
  title?: string;
  /** Asset names labelling the rows and columns. */
  assetLabels?: string[];
  /** Label for the correlation slider. */
  corrLabel?: string;
  /** Toggle button label to switch to the covariance view. */
  covViewLabel?: string;
  /** Toggle button label to switch to the correlation view. */
  corrViewLabel?: string;
  /** Caption text. */
  caption?: string;
  /** Volatilities (decimal, e.g. 0.2 = 20%) per asset — sets the diagonal scale in covariance view. */
  vols?: number[];
  className?: string;
}

/**
 * A heatmap of the covariance / correlation matrix. The diagonal holds each
 * asset's variance (covariance view) or 1 (correlation view); off-diagonals
 * hold pairwise co-movement, tinted blue for positive and warm for negative.
 * A single slider scales the **average off-diagonal correlation** so learners
 * watch a near-identity matrix (independent assets) fill in as correlations
 * rise toward 1 — the regime where diversification quietly dies. A toggle
 * switches between the unit-free correlation view and the variance-scaled
 * covariance view. The matrix is always symmetric. Locale-agnostic.
 */
export function PoCovHeatmap({
  title = 'The covariance matrix, lit up',
  assetLabels = ['A', 'B', 'C', 'D'],
  corrLabel = 'Average correlation',
  covViewLabel = 'Show covariance (σᵢσⱼρ)',
  corrViewLabel = 'Show correlation (ρ)',
  caption = 'The diagonal is each asset’s own variance; everything off it is co-movement. Crank the average correlation and the whole grid floods blue — that is diversification evaporating, because correlated assets fall together. The matrix is always symmetric: the cell row-i,col-j equals col-j,row-i.',
  vols = [0.2, 0.25, 0.18, 0.3],
  className,
}: PoCovHeatmapProps) {
  const id = useId();
  const n = assetLabels.length;
  const [rho, setRho] = useState(0.3);
  const [showCov, setShowCov] = useState(false);

  // Build a symmetric correlation matrix: diagonal 1, off-diagonals a smooth
  // spread around the chosen average rho (deterministic, no randomness).
  const corr = useMemo(() => {
    const m: number[][] = [];
    for (let i = 0; i < n; i++) {
      m[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) m[i][j] = 1;
        else {
          // Deterministic variation so not every off-diagonal is identical.
          const spread = 0.18 * Math.cos((i + 1) * (j + 1) * 1.3);
          m[i][j] = Math.max(-0.95, Math.min(0.99, rho + spread));
        }
      }
    }
    // Enforce symmetry exactly.
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) m[i][j] = m[j][i];
    return m;
  }, [rho, n]);

  // Covariance view: σᵢ σⱼ ρᵢⱼ.
  const value = (i: number, j: number): number =>
    showCov ? vols[i % vols.length] * vols[j % vols.length] * corr[i][j] : corr[i][j];

  // Color scale: map [-1,1] (corr) or normalized cov to a blue/warm tint.
  const cellFill = (i: number, j: number): string => {
    const v = corr[i][j]; // tint always by correlation sign/strength for legibility
    if (v >= 0) {
      const a = 0.12 + 0.78 * Math.min(1, v);
      return `color-mix(in srgb, var(--color-brand-600) ${(a * 100).toFixed(0)}%, var(--color-surface))`;
    }
    const a = 0.12 + 0.78 * Math.min(1, -v);
    return `color-mix(in srgb, var(--color-accent-500) ${(a * 100).toFixed(0)}%, var(--color-surface))`;
  };

  const W = 460;
  const cell = 70;
  const labelPad = 56;
  const gridW = cell * n;
  const H = labelPad + gridW + 10;
  const totalW = labelPad + gridW + 10;

  const fmt = (i: number, j: number): string =>
    showCov ? value(i, j).toFixed(3) : value(i, j).toFixed(2);

  const ariaLabel = `${title}. A ${n} by ${n} ${
    showCov ? 'covariance' : 'correlation'
  } matrix with average off-diagonal correlation ${rho.toFixed(2)}.`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          ρ̄ {rho.toFixed(2)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${Math.max(W, totalW)} ${H}`}
        className="mt-3 w-full max-w-md"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Column labels */}
        {assetLabels.map((a, j) => (
          <text
            key={`col-${j}`}
            x={labelPad + cell * (j + 0.5)}
            y={labelPad - 10}
            textAnchor="middle"
            fontSize="12"
            fontWeight={600}
            fill="var(--color-ink-600)"
          >
            {a}
          </text>
        ))}
        {/* Row labels */}
        {assetLabels.map((a, i) => (
          <text
            key={`row-${i}`}
            x={labelPad - 10}
            y={labelPad + cell * (i + 0.5) + 4}
            textAnchor="end"
            fontSize="12"
            fontWeight={600}
            fill="var(--color-ink-600)"
          >
            {a}
          </text>
        ))}
        {/* Cells */}
        {corr.map((rowArr, i) =>
          rowArr.map((_, j) => {
            const x = labelPad + cell * j;
            const y = labelPad + cell * i;
            const diag = i === j;
            return (
              <g key={`c-${i}-${j}`}>
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={cell - 4}
                  height={cell - 4}
                  rx={6}
                  fill={cellFill(i, j)}
                  stroke={diag ? 'var(--color-brand-700)' : 'var(--color-ink-100)'}
                  strokeWidth={diag ? 2 : 1}
                />
                <text
                  x={x + cell / 2}
                  y={y + cell / 2 + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight={diag ? 700 : 500}
                  fill="var(--color-ink-900)"
                >
                  {fmt(i, j)}
                </text>
              </g>
            );
          }),
        )}
      </svg>

      {/* Controls */}
      <div className="mt-3">
        <label htmlFor={`${id}-rho`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{corrLabel}</span>
          <span className="font-mono text-ink-900">{rho.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-rho`}
          type="range"
          min={-0.3}
          max={0.95}
          step={0.01}
          value={rho}
          onChange={(e) => setRho(Number(e.target.value))}
          aria-label={corrLabel}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowCov((s) => !s)}
        className="mt-3 rounded-pill border border-ink-200 bg-surface px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        aria-pressed={showCov}
      >
        {showCov ? corrViewLabel : covViewLabel}
      </button>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PoCovHeatmap;
