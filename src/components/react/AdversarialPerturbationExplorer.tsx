import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

type Attack = 'fgsm' | 'noise';

export interface AdversarialPerturbationExplorerProps {
  /** Heading above the explorer. */
  title?: string;
  /** Label for the "FGSM (sign of gradient)" attack button. */
  fgsmLabel?: string;
  /** Label for the "random noise" attack button. */
  noiseLabel?: string;
  /** Label for the epsilon (perturbation budget) slider. */
  epsilonLabel?: string;
  /** Feature names shown as bars, in order (length sets the vector size). */
  featureLabels?: string[];
  /** Label for the original-value series in the legend. */
  originalLabel?: string;
  /** Label for the perturbed-value series in the legend. */
  perturbedLabel?: string;
  /** Label for the model-score readout chip. */
  scoreLabel?: string;
  /** Label for the perturbation-magnitude readout chip. */
  magnitudeLabel?: string;
  /** Label preceding the decision verdict (e.g. "Decision:"). */
  decisionLabel?: string;
  /** Verdict shown when the score is at or above the boundary. */
  longLabel?: string;
  /** Verdict shown when the score is below the boundary. */
  shortLabel?: string;
  /** Chip text flagging that the decision was flipped by the perturbation. */
  flippedLabel?: string;
  /** Caption for the score / decision-boundary axis. */
  boundaryAxisLabel?: string;
  /** One-line takeaway under the visualization. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A toy linear trading model: score(x) = w · x. The sign of the score is the
// trade direction — score ≥ boundary → LONG, otherwise → SHORT. Features are
// pre-scaled to roughly [-1, 1], so the L∞ epsilon budget is directly comparable
// across features. The fixed weight vector is the model's learned sensitivity.
const WEIGHTS = [0.9, -0.7, -0.5, 0.4, 0.6];
const BASE_FEATURES = [0.55, 0.2, 0.35, 0.5, 0.45];
const BOUNDARY = 0.6;

// FGSM perturbs each feature by ε·sign(∂score/∂xᵢ) = ε·sign(wᵢ). For a linear
// model the gradient of the score w.r.t. the input IS the weight vector, so this
// is the worst-case L∞ step: it moves every feature in the score-decreasing (or
// increasing) direction at once. Here we push the score DOWN, toward a SHORT flip.
// Pseudo-random but deterministic noise of the same per-feature magnitude ε, so
// the L∞ budget is identical — yet, lacking the gradient's alignment, it usually
// fails to move the score across the boundary.
const NOISE_SIGNS = [1, -1, 1, 1, -1, -1, 1, -1, 1, 1];

const clamp01 = (v: number): number => Math.max(-1, Math.min(1, v));

const perturb = (base: number[], attack: Attack, eps: number): number[] =>
  base.map((x, i) => {
    if (attack === 'fgsm') {
      // Push the score down: subtract ε along sign(wᵢ).
      const g = WEIGHTS[i] >= 0 ? 1 : -1;
      return clamp01(x - eps * g);
    }
    return clamp01(x + eps * NOISE_SIGNS[i % NOISE_SIGNS.length]);
  });

const score = (x: number[]): number =>
  x.reduce((acc, xi, i) => acc + xi * WEIGHTS[i], 0);

// L∞ (max absolute per-feature change) — the budget the attacker actually spends.
const lInf = (a: number[], b: number[]): number =>
  a.reduce((m, ai, i) => Math.max(m, Math.abs(ai - b[i])), 0);

/**
 * Adversarial examples, reframed for a trading model. A tiny, deliberately crafted
 * tweak to the input feature vector — far too small to matter economically — drags
 * the model's score across its decision boundary and flips the trade from LONG to
 * SHORT. The model here is a linear scorer, score(x) = w · x, with a fixed boundary;
 * its decision is the sign of (score − boundary).
 *
 * The toggle is the lesson: FGSM (the Fast Gradient Sign Method) spends the entire
 * ε budget intelligently — it nudges every feature by ε·sign(wᵢ), perfectly aligned
 * with the model's own sensitivity, so a minuscule L∞ step collapses the score.
 * Random noise of the *identical* per-feature size spends the same budget blindly
 * and, lacking that alignment, almost never crosses the boundary. The magnitude
 * readout makes the asymmetry concrete: same tiny perturbation size, wildly
 * different effect. The ε sweep animates on mount/change, respecting
 * `prefers-reduced-motion`.
 */
export function AdversarialPerturbationExplorer({
  title = 'Adversarial examples: a tiny nudge that flips the trade',
  fgsmLabel = 'FGSM (sign of gradient)',
  noiseLabel = 'Random noise',
  epsilonLabel = 'Perturbation budget (ε)',
  featureLabels = ['Momentum', 'Volatility', 'Spread', 'Volume', 'RSI'],
  originalLabel = 'Original',
  perturbedLabel = 'Perturbed',
  scoreLabel = 'Model score',
  magnitudeLabel = 'Perturbation size (L∞)',
  decisionLabel = 'Decision:',
  longLabel = 'LONG',
  shortLabel = 'SHORT',
  flippedLabel = 'flipped by the attack',
  boundaryAxisLabel = 'Score vs. decision boundary',
  caption = 'A linear trading model scores the feature vector with score(x) = w·x and goes LONG when the score clears its boundary. Crank up ε and watch FGSM — which nudges each feature by ε·sign(wᵢ), exactly along the model’s own sensitivity — drag the score below the line and flip the call to SHORT, while the bars barely move. Switch to random noise of the identical size (same L∞ budget) and the decision usually survives: the danger isn’t the magnitude of the change, it’s that an attacker aims it down the model’s gradient.',
  className,
}: AdversarialPerturbationExplorerProps) {
  const id = useId();
  const [attack, setAttack] = useState<Attack>('fgsm');
  const [epsilon, setEpsilon] = useState(0.15);
  const [progress, setProgress] = useState(1); // 0 → 1 sweep reveal of ε
  const rafRef = useRef<number | null>(null);

  const features = featureLabels.length ? featureLabels : ['x'];
  const n = features.length;

  // Animate the applied ε from 0 up to the slider value on change.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 600;
    let startTs: number | null = null;
    const stepFn = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [attack, epsilon]);

  const appliedEps = epsilon * progress;
  const original = BASE_FEATURES.slice(0, n);
  const perturbed = perturb(original, attack, appliedEps);

  const scoreOrig = score(original);
  const scorePert = score(perturbed);
  const mag = lInf(original, perturbed);

  const decisionOrig = scoreOrig >= BOUNDARY ? longLabel : shortLabel;
  const decisionPert = scorePert >= BOUNDARY ? longLabel : shortLabel;
  const flipped = decisionOrig !== decisionPert;
  const pertIsLong = scorePert >= BOUNDARY;

  const scoreText = scorePert.toFixed(2);
  const magText = mag.toFixed(3);
  const epsText = epsilon.toFixed(2);

  // ---- Layout ----
  const W = 520;
  const H = 250;
  const padL = 80;
  const padR = 18;
  const chartTop = 40;
  const chartBottom = 150;
  const plotW = W - padL - padR;
  const rowH = (chartBottom - chartTop) / n;
  const barH = Math.min(12, rowH * 0.34);
  // Feature values live in [-1, 1]; map to the bar area.
  const featX = (v: number) => padL + ((v + 1) / 2) * plotW;
  const zeroX = featX(0);

  // Score gauge band (bottom).
  const gaugeY = 196;
  const gaugeMin = -1.6;
  const gaugeMax = 1.6;
  const gaugeX = (s: number) =>
    padL + ((s - gaugeMin) / (gaugeMax - gaugeMin)) * plotW;

  const attackButtons: { key: Attack; label: string }[] = [
    { key: 'fgsm', label: fgsmLabel },
    { key: 'noise', label: noiseLabel },
  ];

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Attack toggle */}
      <div
        className="mt-4 inline-flex flex-wrap rounded-pill border border-ink-100 bg-surface-50 p-1 text-sm"
        role="group"
        aria-label="attack type"
      >
        {attackButtons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setAttack(b.key)}
            aria-pressed={attack === b.key}
            className={cx(
              'rounded-pill px-3 py-1 font-medium transition',
              attack === b.key ? 'bg-brand-500 text-white shadow-soft' : 'text-ink-600',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`Bar chart of ${n} trading features, ${original
          .map((_, i) => features[i])
          .join(', ')}, comparing original values to values after a ${
          attack === 'fgsm' ? 'FGSM gradient-sign' : 'random-noise'
        } perturbation of size ${magText} (L-infinity). The model score moves from ${scoreOrig.toFixed(
          2,
        )} to ${scoreText} against a decision boundary of ${BOUNDARY.toFixed(
          2,
        )}. The decision is ${decisionPert}${flipped ? `, flipped from ${decisionOrig}` : ', unchanged'}.`}
      >
        {/* Zero reference line for features */}
        <line
          x1={zeroX}
          y1={chartTop - 6}
          x2={zeroX}
          y2={chartBottom}
          stroke="var(--color-ink-200)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />

        {features.map((label, i) => {
          const y = chartTop + i * rowH + rowH / 2;
          const o = original[i];
          const p = perturbed[i];
          const oX = featX(o);
          const pX = featX(p);
          return (
            <g key={`feat-${i}`}>
              <text
                x={padL - 10}
                y={y + 3}
                fontSize={10}
                fill="var(--color-ink-700)"
                textAnchor="end"
              >
                {label}
              </text>
              {/* Original bar */}
              <rect
                x={Math.min(zeroX, oX)}
                y={y - barH - 2}
                width={Math.abs(oX - zeroX)}
                height={barH}
                rx={2}
                fill="var(--color-ink-500)"
                fillOpacity={0.45}
              />
              {/* Perturbed bar */}
              <rect
                x={Math.min(zeroX, pX)}
                y={y + 2}
                width={Math.abs(pX - zeroX)}
                height={barH}
                rx={2}
                fill={pertIsLong ? 'var(--color-brand-500)' : 'var(--color-accent-500)'}
                fillOpacity={0.85}
              />
              {/* Perturbation delta marker */}
              {Math.abs(pX - oX) > 0.6 && (
                <line
                  x1={oX}
                  y1={y + 2 + barH / 2}
                  x2={pX}
                  y2={y + 2 + barH / 2}
                  stroke="var(--color-ink-900)"
                  strokeWidth={1.2}
                  markerEnd="url(#ape-arrow)"
                />
              )}
            </g>
          );
        })}

        <defs>
          <marker
            id="ape-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--color-ink-900)" />
          </marker>
        </defs>

        {/* Score gauge track */}
        <line
          x1={padL}
          y1={gaugeY}
          x2={padL + plotW}
          y2={gaugeY}
          stroke="var(--color-ink-200)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Decision boundary */}
        <line
          x1={gaugeX(BOUNDARY)}
          y1={gaugeY - 16}
          x2={gaugeX(BOUNDARY)}
          y2={gaugeY + 16}
          stroke="var(--color-ink-700)"
          strokeWidth={1.6}
          strokeDasharray="4 3"
        />
        <text
          x={gaugeX(BOUNDARY)}
          y={gaugeY + 30}
          fontSize={9}
          fill="var(--color-ink-600)"
          textAnchor="middle"
        >
          {boundaryAxisLabel}
        </text>
        {/* Original score marker (hollow) */}
        <circle
          cx={gaugeX(scoreOrig)}
          cy={gaugeY}
          r={5}
          fill="var(--color-surface)"
          stroke="var(--color-ink-500)"
          strokeWidth={1.6}
        />
        {/* Perturbed score marker (filled, colored by decision) */}
        <circle
          cx={gaugeX(scorePert)}
          cy={gaugeY}
          r={6}
          fill={pertIsLong ? 'var(--color-brand-500)' : 'var(--color-accent-500)'}
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
      </svg>

      {/* Legend */}
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-ink-500/45" aria-hidden="true" />
          {originalLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cx(
              'inline-block h-2.5 w-2.5 rounded-sm',
              pertIsLong ? 'bg-brand-500' : 'bg-accent-500',
            )}
            aria-hidden="true"
          />
          {perturbedLabel}
        </span>
      </div>

      {/* Readout chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{scoreLabel}</span>
          <span className="font-mono font-semibold text-ink-900">{scoreText}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-pill border border-ink-100 bg-surface-50 px-3 py-1 text-sm">
          <span className="text-ink-600">{magnitudeLabel}</span>
          <span className="font-mono font-semibold text-ink-900">{magText}</span>
        </span>
        <span
          className={cx(
            'inline-flex items-center gap-2 rounded-pill px-3 py-1 text-sm font-semibold',
            pertIsLong
              ? 'bg-brand-500/12 text-brand-600'
              : 'bg-accent-500/12 text-accent-600',
          )}
        >
          <span className="font-normal text-ink-600">{decisionLabel}</span>
          {decisionPert}
        </span>
        {flipped && (
          <span className="inline-flex items-center rounded-pill border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-600">
            {flippedLabel}
          </span>
        )}
      </div>

      {/* Epsilon slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-eps`}
          className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700"
        >
          <span>{epsilonLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {epsText}
          </span>
        </label>
        <input
          id={`${id}-eps`}
          type="range"
          min={0}
          max={0.4}
          step={0.01}
          value={epsilon}
          onChange={(e) => setEpsilon(Number(e.target.value))}
          aria-valuetext={`perturbation budget ${epsText}; ${
            attack === 'fgsm' ? 'FGSM gradient-sign attack' : 'random noise'
          } of L-infinity size ${magText} moves the score to ${scoreText}; decision ${decisionPert}${
            flipped ? ', flipped' : ''
          }`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default AdversarialPerturbationExplorer;
