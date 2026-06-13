import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SigmaImprobabilityProps {
  /** Heading above the widget. */
  title?: string;
  /** Slider label for the sigma control. */
  sigmaLabel?: string;
  /** Readout label for the Gaussian tail probability. */
  probabilityLabel?: string;
  /** Readout label for the human-scale waiting time. */
  waitLabel?: string;
  /** Label preceding the punchline verdict (e.g. "Verdict"). */
  verdictLabel?: string;
  /** Punchline shown once sigma climbs into the absurd zone. */
  modelWrongText?: string;
  /** Annotation text for the pinned 25-sigma Viniar quote. */
  viniarQuoteLabel?: string;
  /** One-line takeaway shown under the widget. */
  caption?: string;
  /** Initial sigma (1–25). Defaults to `7`. */
  sigma?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SIGMA_MIN = 1;
const SIGMA_MAX = 25;
const TRADING_DAYS_PER_YEAR = 252;
const AGE_OF_UNIVERSE_YEARS = 1.38e10; // ~13.8 billion years

// Standard normal density φ(k).
const normPdf = (k: number): number => Math.exp(-(k * k) / 2) / Math.sqrt(2 * Math.PI);

/**
 * Upper-tail probability P(Z ≥ k) for the standard normal.
 *
 * For modest k we use a high-accuracy rational erfc approximation
 * (Abramowitz & Stegun 7.1.26 style). For large k that underflows to a
 * literal 0 in double precision, so we fall back to the asymptotic
 * expansion p ≈ φ(k)/k · (1 − 1/k² + 3/k⁴ − …) and return it as a
 * { mantissa, exponent } pair so we can format 10^N without ever forming
 * an Infinity/NaN. log10(p) is what actually drives every readout.
 */
const tailLog10 = (k: number): number => {
  if (k <= 0) return Math.log10(0.5);
  // Asymptotic upper tail: ln P ≈ ln φ(k) − ln k + ln(1 − 1/k² + 3/k⁴ − 15/k⁶ …)
  // valid and extremely accurate for the k ≥ 1 range this widget covers.
  const lnPhi = -(k * k) / 2 - 0.5 * Math.log(2 * Math.PI);
  const k2 = k * k;
  // Truncated asymptotic series for the Mills-ratio correction factor.
  const series = 1 - 1 / k2 + 3 / (k2 * k2) - 15 / (k2 * k2 * k2);
  const correction = series > 0 ? series : 1; // guard tiny-k overshoot
  const lnTail = lnPhi - Math.log(k) + Math.log(correction);
  return lnTail / Math.LN10;
};

interface ScaleNumber {
  /** Mantissa in [1, 10). */
  mantissa: number;
  /** Base-10 exponent. */
  exponent: number;
}

// Split a base-10 logarithm into a human mantissa × 10^exponent.
const fromLog10 = (log10: number): ScaleNumber => {
  const exponent = Math.floor(log10);
  const mantissa = Math.pow(10, log10 - exponent);
  return { mantissa, exponent };
};

const num = (value: number, digits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

/**
 * Format a {mantissa, exponent} as readable text. Small exponents become
 * ordinary numbers ("8,200"); huge ones become "1.4 × 10^18". Never emits
 * Infinity or NaN — the value is always a finite log split.
 */
const formatScale = (s: ScaleNumber): string => {
  const { mantissa, exponent } = s;
  if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) return '—';
  if (exponent < 0) {
    // Probability-like fractions: render as 1 in N instead.
    return '';
  }
  if (exponent <= 5) {
    return num(mantissa * Math.pow(10, exponent), 0);
  }
  const m = mantissa.toFixed(1);
  return `${m} × 10^${exponent}`;
};

// Format a probability from its log10 as "1 in N" with N as a scale number.
const formatProbability = (log10p: number): string => {
  // 1 / p ⇒ log10(1/p) = −log10(p).
  const inv = fromLog10(-log10p);
  if (inv.exponent <= 5) {
    return `1 in ${num(inv.mantissa * Math.pow(10, inv.exponent), 0)}`;
  }
  return `1 in ${inv.mantissa.toFixed(1)} × 10^${inv.exponent}`;
};

export function SigmaImprobability({
  title = 'The sigma absurdity',
  sigmaLabel = 'Size of the move (sigmas)',
  probabilityLabel = 'Gaussian probability of a move this big or bigger',
  waitLabel = 'How often a bell curve says it happens',
  verdictLabel = 'Verdict',
  modelWrongText =
    'A number this big is not bad luck — it is a confession that the bell curve is the wrong model. The market did not break the odds; the odds were never real.',
  viniarQuoteLabel =
    'August 2007 — Goldman Sachs CFO David Viniar: “We were seeing things that were 25-standard deviation moves, several days in a row.” Under a bell curve a single 25σ day should not occur in many trillions of lifetimes of the universe — let alone several in a row.',
  caption =
    'Drag σ upward and watch the bell curve fall off a cliff. Each extra standard deviation makes an event astronomically rarer — so when a banker calls a crash a “25-sigma event,” they are describing a broken model, not bad luck.',
  sigma = 7,
  className,
}: SigmaImprobabilityProps) {
  const id = useId();
  const clampInit = Math.min(SIGMA_MAX, Math.max(SIGMA_MIN, sigma));
  const [sigmaState, setSigmaState] = useState(clampInit);
  const rafRef = useRef<number | null>(null);

  // Animate an "odometer" sweep on every sigma change: the readouts roll from
  // the previous sigma to the new one. Reduced-motion jumps straight there.
  const prevSigmaRef = useRef(clampInit);
  const [displaySigma, setDisplaySigma] = useState(clampInit);

  useEffect(() => {
    const from = prevSigmaRef.current;
    const to = sigmaState;
    prevSigmaRef.current = to;

    if (prefersReducedMotion() || from === to) {
      setDisplaySigma(to);
      return;
    }
    const duration = 450;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setDisplaySigma(from + (to - from) * p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sigmaState]);

  // Everything is computed from the (possibly animating) display sigma.
  const k = displaySigma;
  const log10p = tailLog10(k); // log10 of the upper-tail probability
  const probabilityText = formatProbability(log10p);

  // Expected waiting time: one trial per trading day. Expected number of days
  // until a move ≥ kσ is ≈ 1/p, so years ≈ (1/p) / 252.
  //   log10(years) = −log10(p) − log10(252)
  const log10WaitYears = -log10p - Math.log10(TRADING_DAYS_PER_YEAR);
  const waitScale = fromLog10(log10WaitYears);

  // Human-scale wait phrasing.
  const universesText = (() => {
    if (log10WaitYears < -0.2) return 'multiple times a year';
    if (log10WaitYears < 0.5) return 'about once a year';
    const yearsText = formatScale(waitScale);
    // Compare to the age of the universe (~1.38 × 10^10 years).
    const log10Universes = log10WaitYears - Math.log10(AGE_OF_UNIVERSE_YEARS);
    if (log10Universes <= 0) {
      return `about once every ${yearsText} years`;
    }
    const u = fromLog10(log10Universes);
    const uText =
      u.exponent <= 5
        ? num(u.mantissa * Math.pow(10, u.exponent), 0)
        : `${u.mantissa.toFixed(1)} × 10^${u.exponent}`;
    return `once every ${yearsText} years — about ${uText}× the entire age of the universe`;
  })();

  // The verdict crosses into "model is wrong" territory once a single day's
  // odds exceed the age of the universe in waiting time (≈ 7σ and up).
  const modelIsWrong = log10WaitYears > Math.log10(AGE_OF_UNIVERSE_YEARS);
  const nearViniar = sigmaState >= SIGMA_MAX - 0.5;

  // ---- Mini Gaussian curve with the tail beyond k shaded to invisibility ----
  const W = 520;
  const H = 150;
  const padX = 16;
  const padY = 14;
  const padBottom = 24;

  const xMin = -4;
  const xMax = 4; // the curve frame; k can exceed this, then the marker pins at the edge
  const SAMPLES = 200;

  const xOf = (v: number) => padX + ((v - xMin) / (xMax - xMin)) * (W - padX * 2);
  const yBase = H - padBottom;
  const yTop = padY;
  const peak = normPdf(0);
  const yOf = (p: number) => yBase - (p / peak) * (yBase - yTop);

  const curveGrid: { v: number; p: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const v = xMin + (i / SAMPLES) * (xMax - xMin);
    curveGrid.push({ v, p: normPdf(v) });
  }
  const curvePath = curveGrid
    .map((g, i) => `${i === 0 ? 'M' : 'L'} ${xOf(g.v).toFixed(2)} ${yOf(g.p).toFixed(2)}`)
    .join(' ');

  // Shaded right tail beyond +k (visually collapses toward the axis). The
  // marker is pinned to the frame edge when k exceeds the drawn range.
  const kClampedToFrame = Math.min(k, xMax);
  const tailStart = xOf(kClampedToFrame);
  const tailGrid: { v: number; p: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const v = kClampedToFrame + (i / 40) * (xMax - kClampedToFrame);
    tailGrid.push({ v, p: normPdf(v) });
  }
  const tailArea =
    `M ${tailStart.toFixed(2)} ${yBase.toFixed(2)} ` +
    tailGrid.map((g) => `L ${xOf(g.v).toFixed(2)} ${yOf(g.p).toFixed(2)}`).join(' ') +
    ` L ${xOf(xMax).toFixed(2)} ${yBase.toFixed(2)} Z`;

  const sigmaRounded = sigmaState;
  const kOffFrame = k > xMax;

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
            'rounded-pill px-3 py-1 text-sm font-medium text-white transition-colors',
            modelIsWrong ? 'bg-danger' : 'bg-brand-600',
          )}
        >
          {num(sigmaRounded, 0)}σ
        </span>
      </figcaption>

      {/* Mini Gaussian with the tail beyond k shaded to near-invisibility */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`A standard normal bell curve. The shaded region beyond ${num(
          sigmaRounded,
          0,
        )} standard deviations is so thin it is invisible against the axis.`}
      >
        {/* Baseline */}
        <line x1={padX} y1={yBase} x2={W - padX} y2={yBase} stroke="var(--color-ink-200)" />
        {/* Integer-sigma ticks across the visible frame */}
        {[-3, -2, -1, 0, 1, 2, 3].map((tk) => (
          <g key={tk}>
            <line
              x1={xOf(tk)}
              y1={yBase}
              x2={xOf(tk)}
              y2={yBase + 4}
              stroke="var(--color-ink-200)"
            />
            <text
              x={xOf(tk)}
              y={yBase + 16}
              textAnchor="middle"
              fontSize={10}
              fill="var(--color-ink-400)"
            >
              {tk}σ
            </text>
          </g>
        ))}
        {/* Shaded right tail beyond k — vanishingly thin, that is the point */}
        <path d={tailArea} fill="var(--color-danger)" opacity={0.55} />
        {/* The bell curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Marker line at k (pinned to the frame edge when k runs off-frame) */}
        <line
          x1={tailStart}
          y1={yTop}
          x2={tailStart}
          y2={yBase}
          stroke="var(--color-danger)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        <text
          x={Math.min(tailStart + 6, W - padX - 4)}
          y={yTop + 10}
          textAnchor={tailStart > W - 80 ? 'end' : 'start'}
          fontSize={11}
          fill="var(--color-danger)"
          fontWeight={600}
        >
          {num(sigmaRounded, 0)}σ{kOffFrame ? ' →' : ''}
        </text>
      </svg>

      {/* Sigma slider */}
      <div className="mt-4">
        <label
          htmlFor={`${id}-sigma`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{sigmaLabel}</span>
          <span className="font-mono text-ink-900">{num(sigmaRounded, 0)}σ</span>
        </label>
        <input
          id={`${id}-sigma`}
          type="range"
          min={SIGMA_MIN}
          max={SIGMA_MAX}
          step={1}
          value={sigmaState}
          onChange={(e) => setSigmaState(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      {/* Odometer readouts */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{probabilityLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{probabilityText}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{waitLabel}</dt>
          <dd
            className={cx(
              'font-mono text-lg font-semibold',
              modelIsWrong ? 'text-danger' : 'text-ink-900',
            )}
          >
            {universesText}
          </dd>
        </div>
      </dl>

      {/* Verdict — the punchline, escalates into the danger zone */}
      {modelIsWrong && (
        <p
          className="mt-4 rounded-card border border-danger/30 bg-surface-sunken/40 px-4 py-3 text-sm leading-relaxed text-ink-700"
          aria-live="polite"
        >
          <span className="font-semibold text-danger">{verdictLabel}: </span>
          {modelWrongText}
        </p>
      )}

      {/* Pinned Viniar annotation at the top of the dial */}
      {nearViniar && (
        <blockquote className="mt-4 rounded-card border-l-4 border-accent-500 bg-accent-500/5 px-4 py-3 text-sm leading-relaxed text-ink-700">
          {viniarQuoteLabel}
        </blockquote>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SigmaImprobability;
