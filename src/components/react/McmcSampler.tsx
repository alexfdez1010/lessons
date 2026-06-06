import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface McmcSamplerProps {
  /** Heading above the figure. */
  title?: string;
  /** Label for the play button. */
  playLabel?: string;
  /** Label for the pause button. */
  pauseLabel?: string;
  /** Label for the single-step button. */
  stepLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Label for the proposal step-size slider. */
  stepSizeLabel?: string;
  /** Readout label for the number of samples drawn. */
  samplesReadoutLabel?: string;
  /** Readout label for the acceptance rate. */
  acceptanceReadoutLabel?: string;
  /** Legend / panel label for the target posterior curve. */
  targetLabel?: string;
  /** Legend / panel label for the sample histogram. */
  histogramLabel?: string;
  /** Label for the burn-in toggle. */
  burnInLabel?: string;
  /** Label shown on rejected-proposal flashes (for the legend). */
  rejectLabel?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Seeded PRNG — deterministic across renders; advanced only inside the loop. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Domain of the target on the x-axis.
const X_MIN = -6;
const X_MAX = 8;
const X_SPAN = X_MAX - X_MIN;

// Fixed, visibly non-trivial target: a mixture of two Gaussians (bimodal,
// slightly asymmetric). Unnormalised density is fine for the Metropolis ratio,
// but we keep it normalised-ish for a clean curve.
const gaussian = (x: number, mu: number, sigma: number): number =>
  Math.exp(-((x - mu) * (x - mu)) / (2 * sigma * sigma)) /
  (sigma * Math.sqrt(2 * Math.PI));

const target = (x: number): number =>
  0.6 * gaussian(x, -1.5, 0.9) + 0.4 * gaussian(x, 3, 1.4);

const PEAK = 0.6 * gaussian(-1.5, -1.5, 0.9) + 0.0007; // approx max density for scaling

// Box–Muller standard-normal draw from a uniform PRNG.
const stdNormal = (rng: () => number): number => {
  let u = rng();
  let v = rng();
  if (u < 1e-12) u = 1e-12;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const BINS = 40;
const BURN_IN = 30; // first K samples shaded when burn-in is on
const STEPS_PER_FRAME = 3;

interface ChainState {
  x: number;
  samples: number; // total proposals (== steps taken)
  accepts: number;
  counts: number[]; // histogram, indexed by bin
  total: number; // total samples binned (post burn-in if toggled)
  lastRejectedX: number | null; // x' of the most recent rejected proposal
  traceX: number[]; // recent positions for the faint trace
}

const binOf = (x: number): number => {
  const idx = Math.floor(((x - X_MIN) / X_SPAN) * BINS);
  return Math.max(0, Math.min(BINS - 1, idx));
};

/**
 * Markov-chain Monte Carlo, at a glance. A Metropolis random walk explores a
 * fixed bimodal target posterior (left panel: smooth curve + a current-position
 * marker and a faint recent trace; rejected proposals flash and bounce back).
 * The right panel is a histogram that fills in as accepted/visited samples
 * accumulate, gradually matching the target's shape. The proposal step size
 * lets learners feel the trade-off: too small mixes slowly, too big gets
 * rejected a lot. A burn-in toggle grays the first K samples. The PRNG is
 * seeded and only advanced inside the animation loop, so renders stay
 * deterministic and `prefers-reduced-motion` disables auto-play.
 */
export function McmcSampler({
  title = 'MCMC: a random walk that draws the posterior',
  playLabel = 'Play',
  pauseLabel = 'Pause',
  stepLabel = 'Step',
  resetLabel = 'Reset',
  stepSizeLabel = 'Proposal step size',
  samplesReadoutLabel = 'Samples drawn',
  acceptanceReadoutLabel = 'Acceptance rate',
  targetLabel = 'Target posterior',
  histogramLabel = 'Sample histogram',
  burnInLabel = 'Discard burn-in',
  rejectLabel = 'Rejected proposal',
  caption = 'When a posterior has no closed form, MCMC walks through it: propose a nearby move, accept it in proportion to how much more probable it is, and tally where you land. The histogram of those dependent samples converges to the posterior — once you throw away the early burn-in.',
  className,
}: McmcSamplerProps) {
  const id = useId();

  const [playing, setPlaying] = useState(false);
  const [stepSize, setStepSize] = useState(1.0);
  const [discardBurnIn, setDiscardBurnIn] = useState(true);
  // Snapshot mirrored into React state so the SVG re-renders.
  const [view, setView] = useState<ChainState>(() => initialChain());

  const reduced = useRef(false);
  const rngRef = useRef<() => number>(mulberry32(0x9e3779b9));
  const chainRef = useRef<ChainState>(view);
  const stepSizeRef = useRef(stepSize);
  const discardRef = useRef(discardBurnIn);
  const rafRef = useRef<number | null>(null);

  function initialChain(): ChainState {
    return {
      x: 0,
      samples: 0,
      accepts: 0,
      counts: new Array<number>(BINS).fill(0),
      total: 0,
      lastRejectedX: null,
      traceX: [0],
    };
  }

  // Seed the PRNG and read reduced-motion only in the browser (post-mount).
  useEffect(() => {
    reduced.current = prefersReducedMotion();
    rngRef.current = mulberry32(0x1234abcd);
  }, []);

  useEffect(() => {
    stepSizeRef.current = stepSize;
  }, [stepSize]);
  useEffect(() => {
    discardRef.current = discardBurnIn;
  }, [discardBurnIn]);

  // One Metropolis transition, mutating the ref-held chain in place.
  const advance = (): void => {
    const rng = rngRef.current;
    const c = chainRef.current;
    const xCur = c.x;
    const xProp = xCur + stepSizeRef.current * stdNormal(rng);
    const pCur = target(xCur);
    const pProp = target(xProp);
    const ratio = pCur > 0 ? pProp / pCur : 1;
    const accept = ratio >= 1 || rng() < ratio;

    c.samples += 1;
    if (accept) {
      c.x = xProp;
      c.accepts += 1;
      c.lastRejectedX = null;
    } else {
      c.lastRejectedX = xProp; // flash this; chain stays at xCur
    }

    // Tally the current position (after the accept/reject decision).
    const counted = !discardRef.current || c.samples > BURN_IN;
    if (counted) {
      c.counts[binOf(c.x)] += 1;
      c.total += 1;
    }

    c.traceX.push(c.x);
    if (c.traceX.length > 24) c.traceX.shift();
  };

  const publish = (): void => {
    const c = chainRef.current;
    setView({
      x: c.x,
      samples: c.samples,
      accepts: c.accepts,
      counts: c.counts.slice(),
      total: c.total,
      lastRejectedX: c.lastRejectedX,
      traceX: c.traceX.slice(),
    });
  };

  // Animation loop while playing.
  useEffect(() => {
    if (!playing) return;
    const loop = () => {
      for (let i = 0; i < STEPS_PER_FRAME; i++) advance();
      publish();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const handleStep = (): void => {
    advance();
    publish();
  };

  const handleReset = (): void => {
    setPlaying(false);
    rngRef.current = mulberry32(0x1234abcd);
    chainRef.current = initialChain();
    publish();
  };

  const togglePlay = (): void => {
    if (reduced.current) {
      // No auto-play under reduced motion — fall back to a single step.
      handleStep();
      return;
    }
    setPlaying((p) => !p);
  };

  // ---- Geometry ----
  const W = 520;
  const H = 240;
  const padX = 16;
  const padTop = 14;
  const padBottom = 22;

  const xToPx = (x: number): number =>
    padX + ((x - X_MIN) / X_SPAN) * (W - padX * 2);

  // Left panel density → y (curve). Right panel reuses the same x mapping.
  const densMax = PEAK * 1.08;
  const densToPx = (d: number): number =>
    padTop + (1 - d / densMax) * (H - padTop - padBottom);

  // Target curve path.
  const CURVE_SAMPLES = 120;
  const curvePath = (() => {
    let d = `M ${xToPx(X_MIN)} ${densToPx(target(X_MIN))}`;
    for (let i = 1; i <= CURVE_SAMPLES; i++) {
      const x = X_MIN + (i / CURVE_SAMPLES) * X_SPAN;
      d += ` L ${xToPx(x)} ${densToPx(target(x))}`;
    }
    return d;
  })();

  const baselineY = densToPx(0);

  // Histogram bars (normalised to a density-like height so it overlays the curve).
  const binWidthX = X_SPAN / BINS;
  const maxCount = Math.max(1, ...view.counts);
  const bars = view.counts.map((count, i) => {
    const x0 = X_MIN + i * binWidthX;
    const px = xToPx(x0);
    const pw = xToPx(x0 + binWidthX) - px;
    // Scale so the modal bin reaches near the curve's peak.
    const h = (count / maxCount) * (H - padTop - padBottom) * 0.94;
    return { px, pw: Math.max(0, pw - 1), h, count };
  });

  const acceptanceRate =
    view.samples > 0 ? view.accepts / view.samples : 0;
  const acceptancePct = Math.round(acceptanceRate * 100);

  // Recent trace as a thin polyline along the baseline neighbourhood.
  const tracePoints = view.traceX
    .map((tx, i) => {
      const frac = view.traceX.length > 1 ? i / (view.traceX.length - 1) : 0;
      const ty = baselineY - 6 - frac * 4;
      return `${xToPx(tx).toFixed(1)},${ty.toFixed(1)}`;
    })
    .join(' ');

  const curMarkerX = xToPx(view.x);
  const curMarkerY = densToPx(target(view.x));
  const rejected = view.lastRejectedX;
  const rejInRange =
    rejected !== null && rejected >= X_MIN && rejected <= X_MAX;

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
          {acceptanceReadoutLabel}: {acceptancePct}%
        </span>
      </figcaption>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {targetLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded-sm bg-brand-500/70" aria-hidden="true" />
          {histogramLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-full bg-brand-600"
            aria-hidden="true"
          />
          {targetLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span
            className="h-3 w-3 rounded-full bg-ink-300 ring-2 ring-ink-400"
            aria-hidden="true"
          />
          {rejectLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. ${targetLabel}: a fixed bimodal posterior. ${samplesReadoutLabel}: ${view.samples}. ${acceptanceReadoutLabel}: ${acceptancePct}%. The ${histogramLabel} of accepted positions is approaching the target curve.`}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={baselineY}
          x2={W - padX}
          y2={baselineY}
          stroke="var(--color-ink-200)"
        />

        {/* Histogram bars (drawn first, behind the curve) */}
        {bars.map((b, i) =>
          b.count > 0 ? (
            <rect
              key={i}
              x={b.px}
              y={baselineY - b.h}
              width={b.pw}
              height={b.h}
              fill="var(--color-brand-500)"
              opacity={0.7}
            />
          ) : null,
        )}

        {/* Target posterior curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Faint recent trace near the baseline */}
        {view.traceX.length > 1 && (
          <polyline
            points={tracePoints}
            fill="none"
            stroke="var(--color-brand-400)"
            strokeWidth={1.5}
            opacity={0.45}
          />
        )}

        {/* Rejected-proposal flash: hollow marker at x', dashed bounce-back */}
        {rejInRange && (
          <g>
            <line
              x1={xToPx(rejected)}
              y1={baselineY}
              x2={curMarkerX}
              y2={curMarkerY}
              stroke="var(--color-ink-400)"
              strokeWidth={1.25}
              strokeDasharray="3 3"
            />
            <circle
              cx={xToPx(rejected)}
              cy={densToPx(target(rejected))}
              r={5}
              fill="var(--color-surface, #fff)"
              stroke="var(--color-ink-400)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Current chain position on the curve */}
        <line
          x1={curMarkerX}
          y1={curMarkerY}
          x2={curMarkerX}
          y2={baselineY}
          stroke="var(--color-brand-600)"
          strokeWidth={1.25}
          strokeDasharray="2 3"
          opacity={0.6}
        />
        <circle
          cx={curMarkerX}
          cy={curMarkerY}
          r={6}
          fill="var(--color-brand-600)"
          stroke="var(--color-surface, #fff)"
          strokeWidth={2}
        />
      </svg>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={playing}
          className="rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {playing ? pauseLabel : playLabel}
        </button>
        <button
          type="button"
          onClick={handleStep}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-800 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-800 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>

        <label className="ml-auto inline-flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={discardBurnIn}
            onChange={(e) => setDiscardBurnIn(e.target.checked)}
            className="accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
          <span>{burnInLabel}</span>
        </label>
      </div>

      {/* Step-size slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-step`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{stepSizeLabel}</span>
          <span className="font-mono text-ink-900">{stepSize.toFixed(2)}</span>
        </label>
        <input
          id={`${id}-step`}
          type="range"
          min={0.1}
          max={4}
          step={0.1}
          value={stepSize}
          onChange={(e) => setStepSize(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl
        className="mt-4 grid grid-cols-2 gap-3 text-sm"
        aria-live="polite"
      >
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{samplesReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {view.samples}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{acceptanceReadoutLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {acceptancePct}%
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default McmcSampler;
