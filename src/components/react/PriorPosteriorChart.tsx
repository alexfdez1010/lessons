import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface PriorPosteriorChartProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the prior-mean slider. */
  priorMeanLabel?: string;
  /** Label for the prior-confidence slider (1/σ0). */
  priorConfidenceLabel?: string;
  /** Label for the likelihood-mean slider ("Data says"). */
  dataMeanLabel?: string;
  /** Label for the data-strength slider (1/σL, sample size). */
  dataStrengthLabel?: string;
  /** Legend label for the prior curve. */
  priorLabel?: string;
  /** Legend label for the likelihood curve. */
  likelihoodLabel?: string;
  /** Legend label for the posterior curve. */
  posteriorLabel?: string;
  /** Readout label for the posterior mean. */
  posteriorMeanReadoutLabel?: string;
  /** Readout label for the posterior standard deviation. */
  posteriorSigmaReadoutLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  /** Initial prior mean μ0 (in axis units). Defaults to `-0.3`. */
  priorMean?: number;
  /** Initial prior confidence 1/σ0 (1–6). Defaults to `2`. */
  priorConfidence?: number;
  /** Initial likelihood mean μL (in axis units). Defaults to `0.4`. */
  dataMean?: number;
  /** Initial data strength 1/σL (1–6). Defaults to `2`. */
  dataStrength?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (value: number): string => value.toFixed(2);

/**
 * Interactive Normal–Normal Bayesian-updating chart. It plots three Gaussian
 * densities over a 1-D parameter axis (e.g. an asset's true mean return or a
 * true win rate): the prior N(μ0, σ0²), the likelihood from new data
 * N(μL, σL²), and the conjugate posterior. The posterior is Normal with
 * precision-weighted mean: τ = 1/σ0² + 1/σL², mean = (μ0/σ0² + μL/σL²)/τ,
 * variance = 1/τ. Curves are true densities (the posterior is genuinely taller
 * and narrower), so the teaching point is visible: the posterior sits between
 * prior and likelihood, pulled toward whichever is more confident, and is
 * sharper than either. When the data or confidence changes the posterior curve
 * morphs from its old to its new shape; respects `prefers-reduced-motion`
 * (jumps straight to the final curve).
 */
export function PriorPosteriorChart({
  title = 'Bayesian updating: prior × data → posterior',
  priorMeanLabel = 'Prior mean μ0',
  priorConfidenceLabel = 'Prior confidence',
  dataMeanLabel = 'Data says',
  dataStrengthLabel = 'Data strength / sample size',
  priorLabel = 'Prior belief',
  likelihoodLabel = 'Likelihood (data)',
  posteriorLabel = 'Posterior belief',
  posteriorMeanReadoutLabel = 'Posterior mean',
  posteriorSigmaReadoutLabel = 'Posterior σ',
  caption = 'The posterior lands between your prior and the data, dragged toward whichever speaks more confidently (the narrower curve). Pour in more data and the posterior collapses onto the likelihood; hold a stubborn prior and it barely moves. Either way the posterior ends up sharper than both — combining evidence shrinks your uncertainty.',
  priorMean = -0.3,
  priorConfidence = 2,
  dataMean = 0.4,
  dataStrength = 2,
  className,
}: PriorPosteriorChartProps) {
  const id = useId();
  const [priorMeanState, setPriorMeanState] = useState(priorMean);
  const [priorConfState, setPriorConfState] = useState(priorConfidence);
  const [dataMeanState, setDataMeanState] = useState(dataMean);
  const [dataStrengthState, setDataStrengthState] = useState(dataStrength);
  // Morph progress 0 → 1 for the posterior curve.
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number | null>(null);
  // The posterior parameters we are animating *from*.
  const fromRef = useRef<{ mean: number; sigma: number } | null>(null);

  const W = 520;
  const H = 220;
  const padX = 14;
  const padY = 16;

  // Parameter axis range.
  const X_MIN = -1;
  const X_MAX = 1;

  // Confidence sliders map 1..6 to a standard deviation. Higher confidence /
  // strength → smaller σ (narrower, taller curve).
  const sigmaFrom = (conf: number): number => 0.5 / conf;

  const sigma0 = sigmaFrom(priorConfState);
  const sigmaL = sigmaFrom(dataStrengthState);

  // Conjugate Normal–Normal posterior (precision-weighted).
  const prec0 = 1 / (sigma0 * sigma0);
  const precL = 1 / (sigmaL * sigmaL);
  const tau = prec0 + precL;
  const postMean = (priorMeanState * prec0 + dataMeanState * precL) / tau;
  const postVar = 1 / tau;
  const postSigma = Math.sqrt(postVar);

  // True Gaussian density.
  const density = (xVal: number, mu: number, sigma: number): number =>
    Math.exp(-((xVal - mu) * (xVal - mu)) / (2 * sigma * sigma)) /
    (sigma * Math.sqrt(2 * Math.PI));

  // Shared vertical scale so the three curves are comparable. The posterior is
  // always the tallest (smallest σ), so scale to its peak with headroom.
  const yMax = density(0, 0, postSigma) * 1.08;

  const x = (xVal: number) =>
    padX + ((xVal - X_MIN) / (X_MAX - X_MIN)) * (W - padX * 2);
  const y = (value: number) =>
    padY + (1 - value / yMax) * (H - padY * 2);

  const SAMPLES = 120;
  const curvePath = (mu: number, sigma: number): string => {
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const xVal = X_MIN + (i / SAMPLES) * (X_MAX - X_MIN);
      const py = y(density(xVal, mu, sigma));
      d += `${i === 0 ? 'M' : 'L'} ${x(xVal).toFixed(2)} ${py.toFixed(2)}`;
      if (i < SAMPLES) d += ' ';
    }
    return d;
  };

  // The posterior we actually draw: interpolate from the previous posterior to
  // the current one over the morph progress.
  const drawnPostMean =
    fromRef.current && progress < 1
      ? fromRef.current.mean + (postMean - fromRef.current.mean) * progress
      : postMean;
  const drawnPostSigma =
    fromRef.current && progress < 1
      ? fromRef.current.sigma + (postSigma - fromRef.current.sigma) * progress
      : postSigma;

  // Animate the posterior morph whenever any input changes.
  const depsKey = `${priorMeanState}|${priorConfState}|${dataMeanState}|${dataStrengthState}`;
  const prevPostRef = useRef<{ mean: number; sigma: number }>({
    mean: postMean,
    sigma: postSigma,
  });
  useEffect(() => {
    const from = prevPostRef.current;
    prevPostRef.current = { mean: postMean, sigma: postSigma };

    if (prefersReducedMotion()) {
      fromRef.current = null;
      setProgress(1);
      return;
    }
    fromRef.current = from;
    setProgress(0);
    const duration = 700;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      // Ease-out cubic for a settled feel.
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  // X-axis ticks at sensible round values.
  const ticks = [-1, -0.5, 0, 0.5, 1];

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
          {posteriorMeanReadoutLabel}: {fmt(postMean)}
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {posteriorLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {priorLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />
          {likelihoodLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. The prior is centred at ${fmt(
          priorMeanState,
        )} and the data at ${fmt(
          dataMeanState,
        )}; combining them gives a posterior centred at ${fmt(
          postMean,
        )} with standard deviation ${fmt(
          postSigma,
        )} — narrower than either input.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={H - padY}
          x2={W - padX}
          y2={H - padY}
          stroke="var(--color-ink-200)"
        />
        {/* X-axis ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={H - padY}
              x2={x(t)}
              y2={H - padY + 4}
              stroke="var(--color-ink-300)"
            />
            <text
              x={x(t)}
              y={H - padY + 15}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-500)"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Prior curve (accent) */}
        <path
          d={curvePath(priorMeanState, sigma0)}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* Likelihood curve (muted ink) */}
        <path
          d={curvePath(dataMeanState, sigmaL)}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* Posterior curve (brand, thickest) — morphs on change */}
        <path
          d={curvePath(drawnPostMean, drawnPostSigma)}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Posterior mean marker */}
        <line
          x1={x(drawnPostMean)}
          y1={y(density(drawnPostMean, drawnPostMean, drawnPostSigma))}
          x2={x(drawnPostMean)}
          y2={H - padY}
          stroke="var(--color-brand-500)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          opacity={0.6}
        />
        <circle
          cx={x(drawnPostMean)}
          cy={y(density(drawnPostMean, drawnPostMean, drawnPostSigma))}
          r={5}
          fill="var(--color-brand-500)"
          stroke="var(--color-surface, #fff)"
          strokeWidth={2}
        />
      </svg>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${id}-prior-mean`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{priorMeanLabel}</span>
            <span className="font-mono text-ink-900">{fmt(priorMeanState)}</span>
          </label>
          <input
            id={`${id}-prior-mean`}
            type="range"
            min={-100}
            max={100}
            step={1}
            value={Math.round(priorMeanState * 100)}
            onChange={(e) => setPriorMeanState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-prior-conf`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{priorConfidenceLabel}</span>
            <span className="font-mono text-ink-900">{priorConfState}</span>
          </label>
          <input
            id={`${id}-prior-conf`}
            type="range"
            min={1}
            max={6}
            step={1}
            value={priorConfState}
            onChange={(e) => setPriorConfState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-data-mean`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{dataMeanLabel}</span>
            <span className="font-mono text-ink-900">{fmt(dataMeanState)}</span>
          </label>
          <input
            id={`${id}-data-mean`}
            type="range"
            min={-100}
            max={100}
            step={1}
            value={Math.round(dataMeanState * 100)}
            onChange={(e) => setDataMeanState(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-data-strength`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{dataStrengthLabel}</span>
            <span className="font-mono text-ink-900">{dataStrengthState}</span>
          </label>
          <input
            id={`${id}-data-strength`}
            type="range"
            min={1}
            max={6}
            step={1}
            value={dataStrengthState}
            onChange={(e) => setDataStrengthState(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{posteriorMeanReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {fmt(postMean)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{posteriorSigmaReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {fmt(postSigma)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default PriorPosteriorChart;
