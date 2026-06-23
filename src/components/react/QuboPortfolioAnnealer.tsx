import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface QuboPortfolioAnnealerProps {
  /** Heading above the figure. */
  title?: string;
  /**
   * Display names for the asset qubits. Defaults to generic "Asset A".."Asset F"
   * so Spanish twins can override (e.g. ["Activo A", …]) without leaking English.
   * The component uses as many assets as `assetNames.length` (expects 6).
   */
  assetNames?: string[];
  /** Label for the cardinality (choose-exactly-K) selector. */
  cardinalityLabel?: string;
  /** Label for the run-annealer button. */
  runLabel?: string;
  /** Label for the reset button. */
  resetLabel?: string;
  /** Readout label for the current selection's energy. */
  energyLabel?: string;
  /** Readout label for the best energy found so far. */
  bestEnergyLabel?: string;
  /** Readout label for the annealer temperature. */
  temperatureLabel?: string;
  /** Chip text shown when the cardinality constraint is satisfied. */
  constraintMetLabel?: string;
  /** Chip text shown when the cardinality constraint is violated. */
  constraintUnmetLabel?: string;
  /** Word for an asset that is in the portfolio (used in aria text). */
  includedLabel?: string;
  /** Word for an asset that is out of the portfolio (used in aria text). */
  excludedLabel?: string;
  /** One-line takeaway shown under the figure. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Seeded PRNG — deterministic across renders; advanced only inside the anneal loop. */
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

// ---------------------------------------------------------------------------
// The QUBO model (all illustrative, locale-agnostic, hardcoded numbers).
//
// Each asset i is a binary variable x_i ∈ {0,1}: 1 = in the portfolio (a "qubit"
// that is on), 0 = out. A selection is the bit-string x.
//
// We minimise an ENERGY (lower = better portfolio):
//
//   E(x) = -λ_ret · Σ_i r_i x_i                      (return reward, want it big)
//          + λ_risk · Σ_i Σ_j σ_ij x_i x_j           (risk penalty, quadratic)
//          + λ_card · ( Σ_i x_i − K )²               (cardinality penalty: choose exactly K)
//
// The risk term Σ σ_ij x_i x_j is the Markowitz quadratic: diagonal σ_ii is an
// asset's own variance, off-diagonal σ_ij its covariance with another — pairs
// that move together add MORE risk than pairs that diversify. Expanding the
// cardinality square ( Σx − K )² = Σx_i² − 2K Σx_i + K² gives linear + quadratic
// (x_i x_j) bit-interaction terms, so the whole objective is a genuine QUBO —
// exactly the form a quantum annealer (D-Wave) or QAOA would embed.
// ---------------------------------------------------------------------------

const N = 6;

// Illustrative annualised expected returns per asset (fractions). Spread out so
// the optimiser has a real return/risk trade-off to make.
const RETURNS: number[] = [0.07, 0.11, 0.09, 0.15, 0.06, 0.12];

// Illustrative symmetric covariance matrix (σ_ij). Diagonal = variance; some
// pairs are strongly correlated (bad to hold together), others diversify well.
const COV: number[][] = [
  [0.040, 0.012, 0.006, 0.002, 0.030, 0.004],
  [0.012, 0.090, 0.010, 0.020, 0.008, 0.060],
  [0.006, 0.010, 0.050, 0.005, 0.004, 0.012],
  [0.002, 0.020, 0.005, 0.120, 0.001, 0.040],
  [0.030, 0.008, 0.004, 0.001, 0.035, 0.003],
  [0.004, 0.060, 0.012, 0.040, 0.003, 0.100],
];

const LAMBDA_RET = 6.0; // weight on the return reward
const LAMBDA_RISK = 8.0; // weight on the quadratic risk penalty
const LAMBDA_CARD = 4.0; // weight on the cardinality constraint penalty

/** QUBO energy of a boolean selection. Lower is better. */
const energyOf = (sel: boolean[], K: number): number => {
  let ret = 0;
  let risk = 0;
  let count = 0;
  for (let i = 0; i < N; i++) {
    if (!sel[i]) continue;
    count += 1;
    ret += RETURNS[i];
    for (let j = 0; j < N; j++) {
      if (sel[j]) risk += COV[i][j];
    }
  }
  const dev = count - K;
  return -LAMBDA_RET * ret + LAMBDA_RISK * risk + LAMBDA_CARD * dev * dev;
};

const countOf = (sel: boolean[]): number =>
  sel.reduce((n, on) => n + (on ? 1 : 0), 0);

/** Brute-force the global optimum over all 2^N selections of exactly K assets. */
const bestForK = (K: number): { sel: boolean[]; energy: number } => {
  let best: boolean[] = new Array<boolean>(N).fill(false);
  let bestE = Infinity;
  for (let mask = 0; mask < 1 << N; mask++) {
    const sel = Array.from({ length: N }, (_, i) => (mask & (1 << i)) !== 0);
    if (countOf(sel) !== K) continue;
    const e = energyOf(sel, K);
    if (e < bestE) {
      bestE = e;
      best = sel;
    }
  }
  return { sel: best, energy: bestE };
};

const ANNEAL_STEPS = 120; // sweeps in one annealer run
const T_HOT = 2.5; // starting temperature (accepts many bad moves)
const T_COLD = 0.02; // ending temperature (greedy)

/** Geometric cooling schedule T(t), t ∈ [0, ANNEAL_STEPS-1]. */
const temperatureAt = (step: number): number => {
  const frac = step / Math.max(1, ANNEAL_STEPS - 1);
  return T_HOT * Math.pow(T_COLD / T_HOT, frac);
};

interface TracePoint {
  energy: number;
  temp: number;
  uphill: boolean; // accepted a worse move (a "hot" exploration jump)
}

interface RunResult {
  trace: TracePoint[];
  bestSel: boolean[];
  bestEnergy: number;
}

/** Run a full simulated-annealing search; returns the per-step energy trace. */
const runAnneal = (
  startSel: boolean[],
  K: number,
  rng: () => number,
): RunResult => {
  let cur = startSel.slice();
  let curE = energyOf(cur, K);
  let bestSel = cur.slice();
  let bestE = curE;
  const trace: TracePoint[] = [];

  for (let step = 0; step < ANNEAL_STEPS; step++) {
    const temp = temperatureAt(step);
    // Propose a neighbour: flip one random bit, OR swap an in/out pair (keeps
    // the move local but lets the chain travel across cardinalities).
    const next = cur.slice();
    if (rng() < 0.5) {
      const flip = Math.floor(rng() * N);
      next[flip] = !next[flip];
    } else {
      const ins: number[] = [];
      const outs: number[] = [];
      for (let i = 0; i < N; i++) (next[i] ? ins : outs).push(i);
      if (ins.length && outs.length) {
        const a = ins[Math.floor(rng() * ins.length)];
        const b = outs[Math.floor(rng() * outs.length)];
        next[a] = false;
        next[b] = true;
      } else {
        const flip = Math.floor(rng() * N);
        next[flip] = !next[flip];
      }
    }

    const nextE = energyOf(next, K);
    const dE = nextE - curE;
    // Metropolis acceptance: always take improvements; take worse moves with
    // probability exp(-ΔE / T) — high when hot, vanishing when cold.
    let uphill = false;
    if (dE <= 0 || rng() < Math.exp(-dE / temp)) {
      if (dE > 0) uphill = true;
      cur = next;
      curE = nextE;
      if (curE < bestE) {
        bestE = curE;
        bestSel = cur.slice();
      }
    }
    trace.push({ energy: curE, temp, uphill });
  }

  return { trace, bestSel, bestEnergy: bestE };
};

/**
 * Portfolio optimisation as a QUBO, solved by simulated annealing — the mental
 * model behind quantum annealing (D-Wave) and QAOA. Each asset is one binary
 * variable / "qubit": in or out of the portfolio. The energy trades expected
 * return against a quadratic risk (covariance) penalty plus a penalty for not
 * holding exactly K assets; lower energy = better portfolio. Learners toggle
 * assets by hand and read off the energy and whether the "choose exactly K"
 * constraint is met, set K, then press Run to watch the annealer search the
 * energy landscape: it starts HOT (accepting worse moves to escape local
 * minima) and COOLS toward the optimum, the energy-vs-step line descending in a
 * jagged path with occasional uphill jumps. Respects `prefers-reduced-motion`
 * (snaps straight to the found optimum, no per-step animation). The PRNG is
 * seeded; timers/raf are cleaned up on unmount.
 */
export function QuboPortfolioAnnealer({
  title = 'Portfolio choice as a QUBO, solved by annealing',
  assetNames = ['Asset A', 'Asset B', 'Asset C', 'Asset D', 'Asset E', 'Asset F'],
  cardinalityLabel = 'Choose exactly K assets',
  runLabel = 'Run annealer',
  resetLabel = 'Reset',
  energyLabel = 'Current energy',
  bestEnergyLabel = 'Best energy found',
  temperatureLabel = 'Temperature',
  constraintMetLabel = 'Constraint met',
  constraintUnmetLabel = 'Constraint not met',
  includedLabel = 'in',
  excludedLabel = 'out',
  caption = 'Every asset is one binary qubit: in or out. The energy rewards expected return, penalises risk (a quadratic covariance term — assets that move together cost extra), and penalises holding anything other than exactly K. Press Run: the annealer starts hot, accepting worse portfolios to escape local minima, then cools and commits to the lowest-energy basin — the optimal portfolio.',
  className,
}: QuboPortfolioAnnealerProps) {
  const id = useId();
  const names = assetNames.length >= N ? assetNames.slice(0, N) : assetNames;

  const [K, setK] = useState(3);
  // Initial illustrative selection: a sub-optimal set so Run has work to do.
  const [sel, setSel] = useState<boolean[]>(() => [true, true, false, false, true, false]);
  const [bestSel, setBestSel] = useState<boolean[]>(() => [true, true, false, false, true, false]);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const [animStep, setAnimStep] = useState(0); // how many trace points are revealed
  const [running, setRunning] = useState(false);

  const rngRef = useRef<() => number>(mulberry32(0xc0ffee));
  const rafRef = useRef<number | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  // Clean up any in-flight animation on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const curEnergy = energyOf(sel, K);
  const curCount = countOf(sel);
  const constraintMet = curCount === K;

  // Best energy found by the most recent run (falls back to current selection).
  const bestEnergy = useMemo(() => energyOf(bestSel, K), [bestSel, K]);

  // The annealer's current temperature for the readout: live while running,
  // otherwise the cold end-of-schedule value.
  const liveTemp =
    running && trace.length > 0 && animStep > 0
      ? trace[Math.min(animStep, trace.length) - 1].temp
      : T_COLD;
  // While animating, the displayed energy follows the trace.
  const displayEnergy =
    running && trace.length > 0 && animStep > 0
      ? trace[Math.min(animStep, trace.length) - 1].energy
      : curEnergy;

  const toggleAsset = (i: number): void => {
    if (running) return;
    setSel((prev) => {
      const next = prev.slice();
      next[i] = !next[i];
      return next;
    });
  };

  const changeK = (value: number): void => {
    if (running) return;
    setK(value);
  };

  const finishRun = (result: RunResult): void => {
    setSel(result.bestSel);
    setBestSel(result.bestSel);
    setRunning(false);
  };

  const handleRun = (): void => {
    if (running) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const result = runAnneal(sel, K, rngRef.current);
    setTrace(result.trace);

    if (reduced.current) {
      // Reduced motion: skip the per-step animation, snap to the optimum.
      setAnimStep(result.trace.length);
      finishRun(result);
      return;
    }

    setRunning(true);
    setAnimStep(0);
    const total = result.trace.length;
    const durationMs = 2600;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const frac = Math.min(1, (ts - startTs) / durationMs);
      const revealed = Math.round(frac * total);
      setAnimStep(revealed);
      if (frac < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        finishRun(result);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const handleReset = (): void => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rngRef.current = mulberry32(0xc0ffee);
    setRunning(false);
    setTrace([]);
    setAnimStep(0);
    const start = [true, true, false, false, true, false];
    setSel(start);
    setBestSel(start);
  };

  // ---- Geometry for the energy-over-steps chart ----
  const W = 520;
  const H = 180;
  const padX = 30;
  const padTop = 14;
  const padBottom = 24;

  // Energy axis bounds: span the realistic range so the curve fills the panel.
  const { eMin, eMax } = useMemo(() => {
    // Optimum (global min for this K) and worst realistic energy bound it.
    const opt = bestForK(K).energy;
    // Empty / over-full sets blow up the cardinality penalty; clamp a sensible top.
    const lo = Math.min(opt, energyOf([false, false, false, false, false, false], K));
    const hi = Math.max(
      energyOf([true, true, true, true, true, true], K),
      energyOf([false, false, false, false, false, false], K),
    );
    return { eMin: lo - 0.5, eMax: hi + 0.5 };
  }, [K]);

  const revealed = trace.slice(0, Math.max(0, animStep));
  const stepToPx = (i: number): number =>
    padX + (i / Math.max(1, ANNEAL_STEPS - 1)) * (W - padX * 2);
  const energyToPx = (e: number): number => {
    const span = eMax - eMin || 1;
    const clamped = Math.max(eMin, Math.min(eMax, e));
    return padTop + ((clamped - eMin) / span) * (H - padTop - padBottom);
  };

  const linePath =
    revealed.length > 1
      ? revealed
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${stepToPx(i).toFixed(1)} ${energyToPx(p.energy).toFixed(1)}`)
          .join(' ')
      : '';

  const optY = energyToPx(bestForK(K).energy);

  // ---- aria summary reflecting current state ----
  const selectionAria = names
    .map((n, i) => `${n} ${sel[i] ? includedLabel : excludedLabel}`)
    .join(', ');
  const ariaLabel = `${title}. ${selectionAria}. ${curCount} of ${K} assets selected, ${
    constraintMet ? constraintMetLabel : constraintUnmetLabel
  }. ${energyLabel} ${displayEnergy.toFixed(2)}, ${bestEnergyLabel} ${bestEnergy.toFixed(2)}.`;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            constraintMet ? 'bg-brand-600' : 'bg-ink-400',
          )}
        >
          {constraintMet ? constraintMetLabel : constraintUnmetLabel}
        </span>
      </figcaption>

      {/* Asset qubit toggles */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={cardinalityLabel}
      >
        {names.map((name, i) => {
          const on = sel[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleAsset(i)}
              aria-pressed={on}
              disabled={running}
              className={cx(
                'inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                on
                  ? 'border-brand-500 bg-brand-500 text-white shadow-soft'
                  : 'border-ink-200 bg-surface text-ink-600 hover:bg-surface-sunken/60',
                running && 'cursor-not-allowed opacity-70',
              )}
            >
              <span
                className={cx(
                  'h-2.5 w-2.5 rounded-full',
                  on ? 'bg-white' : 'bg-ink-300',
                )}
                aria-hidden="true"
              />
              {name}
            </button>
          );
        })}
      </div>

      {/* Energy-over-anneal-steps chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Frame baseline + top */}
        <line x1={padX} y1={padTop} x2={padX} y2={H - padBottom} stroke="var(--color-ink-200)" />
        <line
          x1={padX}
          y1={H - padBottom}
          x2={W - padX}
          y2={H - padBottom}
          stroke="var(--color-ink-200)"
        />

        {/* Global-optimum reference line (lowest possible energy for this K) */}
        <line
          x1={padX}
          y1={optY}
          x2={W - padX}
          y2={optY}
          stroke="var(--color-accent-500)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.7}
        />
        <text x={W - padX} y={optY - 4} fontSize={9} fill="var(--color-accent-600)" textAnchor="end">
          optimum
        </text>

        {/* Axis hints */}
        <text x={padX - 6} y={padTop + 6} fontSize={9} fill="var(--color-ink-400)" textAnchor="end">
          worse
        </text>
        <text x={padX - 6} y={H - padBottom} fontSize={9} fill="var(--color-ink-400)" textAnchor="end">
          better
        </text>

        {/* The descending jagged annealing trace */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Uphill (hot exploration) jumps marked as small open dots */}
        {revealed.map((p, i) =>
          p.uphill ? (
            <circle
              key={`up-${i}`}
              cx={stepToPx(i)}
              cy={energyToPx(p.energy)}
              r={2.6}
              fill="var(--color-surface, #fff)"
              stroke="var(--color-ink-400)"
              strokeWidth={1.2}
            />
          ) : null,
        )}

        {/* Current head of the trace */}
        {revealed.length > 0 && (
          <circle
            cx={stepToPx(revealed.length - 1)}
            cy={energyToPx(revealed[revealed.length - 1].energy)}
            r={4}
            fill="var(--color-brand-600)"
            stroke="var(--color-surface, #fff)"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          energy per step
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full border-2 border-ink-400 bg-surface"
            aria-hidden="true"
          />
          uphill jump (hot)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          optimum
        </span>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          aria-pressed={running}
          className={cx(
            'rounded-pill bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
            running && 'cursor-not-allowed opacity-70',
          )}
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-800 transition hover:bg-surface-sunken/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      {/* Cardinality slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-k`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{cardinalityLabel}</span>
          <span className="font-mono text-ink-900" aria-hidden="true">
            {K}
          </span>
        </label>
        <input
          id={`${id}-k`}
          type="range"
          min={2}
          max={4}
          step={1}
          value={K}
          disabled={running}
          onChange={(e) => changeK(Number(e.target.value))}
          aria-valuetext={`choose exactly ${K} assets; currently ${curCount} selected, ${
            constraintMet ? constraintMetLabel : constraintUnmetLabel
          }`}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{energyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-ink-900">
            {displayEnergy.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bestEnergyLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">
            {bestEnergy.toFixed(2)}
          </dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{temperatureLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">
            {liveTemp.toFixed(2)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default QuboPortfolioAnnealer;
