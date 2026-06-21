import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

/**
 * The canonical "stylized facts" of financial returns. Each kind drives a small
 * hand-built SVG that contrasts what a naive Gaussian random walk (GBM) produces
 * with what real markets show — so the learner sees *why* a generator that only
 * matches the mean and variance still fails.
 */
export type StylizedFactKind =
  | 'fat-tails'
  | 'vol-clustering'
  | 'abs-acf'
  | 'leverage'
  | 'gaussianity'
  | 'gain-loss';

export interface StylizedFact {
  /** Drives the built-in mini visual. */
  kind: StylizedFactKind;
  /** Short name shown in the list (locale string). */
  name: string;
  /** One-line plain-language definition (locale string). */
  definition: string;
  /** What the real market actually shows (locale string). */
  real: string;
  /** Whether a plain Gaussian random walk (GBM) reproduces this fact. */
  gbmReproduces: boolean;
  /** Why GBM passes/fails this fact (locale string). */
  verdict: string;
}

export interface StylizedFactsChecklistProps {
  /** Heading above the checklist. */
  title?: string;
  /** The facts to audit. Defaults to the canonical six (English). */
  facts?: StylizedFact[];
  /** Label for the "reproduced by a Gaussian random walk" pass badge. */
  passLabel?: string;
  /** Label for the fail badge. */
  failLabel?: string;
  /** Small header above the verdict column / scorecard line. */
  scorecardLabel?: string;
  /** Caption under the whole island. */
  caption?: string;
  className?: string;
}

const DEFAULT_FACTS: StylizedFact[] = [
  {
    kind: 'fat-tails',
    name: 'Fat (heavy) tails',
    definition: 'Extreme moves happen far more often than a normal bell curve predicts.',
    real: 'Daily returns have excess kurtosis; ±5σ days that "should" never occur show up every few years.',
    gbmReproduces: false,
    verdict:
      'A Gaussian random walk draws shocks from a normal distribution, so its tails are thin by construction — it under-counts crashes.',
  },
  {
    kind: 'vol-clustering',
    name: 'Volatility clustering',
    definition: 'Big moves are followed by big moves, calm by calm — volatility comes in bursts.',
    real: 'Squared/absolute returns are strongly autocorrelated; turbulent weeks cluster together.',
    gbmReproduces: false,
    verdict:
      'GBM uses constant volatility and independent shocks, so its turbulence is sprinkled uniformly — no clustering at all.',
  },
  {
    kind: 'abs-acf',
    name: 'Slow decay of |return| autocorrelation',
    definition: 'Returns themselves look uncorrelated, but their magnitudes stay correlated for weeks.',
    real: 'The autocorrelation of absolute returns decays slowly (long memory), even when raw-return ACF is ~0.',
    gbmReproduces: false,
    verdict:
      'In GBM the magnitudes are i.i.d., so the absolute-return ACF is flat at zero — it has no long memory.',
  },
  {
    kind: 'leverage',
    name: 'Leverage effect',
    definition: 'Volatility rises more after price falls than after equal-sized rises — fear is asymmetric.',
    real: 'Negative returns predict higher future volatility than positive returns of the same size.',
    gbmReproduces: false,
    verdict:
      'GBM treats up and down shocks symmetrically, so a drop and a rally raise future volatility identically — they do not.',
  },
  {
    kind: 'gaussianity',
    name: 'Aggregational Gaussianity',
    definition: 'As you sum returns over longer windows, the distribution drifts back toward normal.',
    real: 'Monthly returns look far more bell-shaped than the wild, fat-tailed daily returns.',
    gbmReproduces: true,
    verdict:
      'GBM is already Gaussian at every horizon, so it trivially "passes" this one — but only because it was never fat-tailed to begin with.',
  },
  {
    kind: 'gain-loss',
    name: 'Gain/loss asymmetry',
    definition: 'Prices fall faster and sharper than they climb — drawdowns are abrupt, rallies grind.',
    real: 'Large drawdowns happen over shorter spans than equally large run-ups.',
    gbmReproduces: false,
    verdict:
      'A symmetric Gaussian walk makes up-runs and down-runs mirror images, erasing the crash-fast/grind-up asymmetry.',
  },
];

/** A tiny inline visual for each stylized fact: real (accent) vs Gaussian (ink). */
function FactVisual({ kind }: { kind: StylizedFactKind }) {
  const W = 300;
  const H = 92;
  const real = 'var(--color-accent-500)';
  const gbm = 'var(--color-ink-400)';

  if (kind === 'fat-tails' || kind === 'gaussianity') {
    // Two density curves: thin Gaussian vs fat-tailed (peaked + heavy tails).
    const cx0 = W / 2;
    const xs = Array.from({ length: 61 }, (_, i) => (i / 60) * W);
    const gauss = (x: number) => {
      const z = (x - cx0) / 38;
      return Math.exp(-0.5 * z * z);
    };
    // Student-t-like: taller peak, heavier tails.
    const fat = (x: number) => {
      const z = (x - cx0) / 30;
      return Math.pow(1 + (z * z) / 3, -2);
    };
    const base = H - 14;
    const amp = H - 26;
    const path = (f: (x: number) => number) =>
      xs
        .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${(base - amp * f(x)).toFixed(1)}`)
        .join(' ');
    const showFat = kind === 'fat-tails';
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Return distribution: a thin Gaussian bell versus a fat-tailed distribution with a higher peak and heavier tails.">
        <line x1={0} y1={base} x2={W} y2={base} stroke="var(--color-ink-100)" />
        <path d={path(gauss)} fill="none" stroke={gbm} strokeWidth={1.75} strokeDasharray="4 3" />
        {showFat && <path d={path(fat)} fill="none" stroke={real} strokeWidth={2} />}
        {showFat && (
          <>
            <circle cx={W - 14} cy={base - amp * fat(W - 14)} r={2.5} fill={real} />
            <circle cx={14} cy={base - amp * fat(14)} r={2.5} fill={real} />
          </>
        )}
      </svg>
    );
  }

  if (kind === 'vol-clustering') {
    // Two return strips: GBM uniform noise vs clustered bursts.
    const n = 80;
    const seedNoise = (i: number, s: number) =>
      (Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1;
    const mid = H / 2;
    const gbmBars = Array.from({ length: n }, (_, i) => {
      const v = seedNoise(i, 1);
      return (v - 0.5) * (H * 0.4);
    });
    const clusterEnv = (i: number) => {
      const t = i / n;
      return 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2.2)), 4);
    };
    const realBars = Array.from({ length: n }, (_, i) => {
      const v = seedNoise(i, 2);
      return (v - 0.5) * (H * 0.62) * clusterEnv(i);
    });
    const bw = W / n;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Two return strips: uniform Gaussian noise versus real returns whose large moves cluster into bursts.">
        <line x1={0} y1={mid} x2={W} y2={mid} stroke="var(--color-ink-100)" />
        {realBars.map((b, i) => (
          <rect key={`r${i}`} x={i * bw} y={Math.min(mid, mid - b)} width={Math.max(0.6, bw - 0.6)} height={Math.abs(b)} fill={real} opacity={0.85} />
        ))}
        {gbmBars.map((b, i) => (
          <rect key={`g${i}`} x={i * bw} y={Math.min(mid, mid - b) - 0} width={Math.max(0.6, bw - 0.6)} height={Math.abs(b)} fill={gbm} opacity={0.32} />
        ))}
      </svg>
    );
  }

  if (kind === 'abs-acf') {
    // ACF bars: real |returns| decay slowly; GBM is flat at zero.
    const lags = 14;
    const bw = W / (lags + 1);
    const realAcf = (k: number) => 0.55 * Math.exp(-k / 9);
    const base = H - 14;
    const amp = H - 24;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Autocorrelation of absolute returns: real markets decay slowly above zero, a Gaussian walk sits flat at zero.">
        <line x1={0} y1={base} x2={W} y2={base} stroke="var(--color-ink-100)" />
        {Array.from({ length: lags }, (_, i) => i + 1).map((k) => {
          const h = amp * realAcf(k);
          return (
            <g key={k}>
              <rect x={k * bw - 3} y={base - h} width={6} height={h} fill={real} opacity={0.85} />
              <circle cx={k * bw} cy={base - amp * 0.0} r={1.6} fill={gbm} />
            </g>
          );
        })}
      </svg>
    );
  }

  if (kind === 'leverage') {
    // Scatter: today's return (x) vs next-day volatility (y). Down days → higher vol.
    const pts = Array.from({ length: 46 }, (_, i) => {
      const r = (((Math.sin(i * 7.1) + Math.cos(i * 2.3)) / 2));
      const x = W / 2 + r * (W * 0.42);
      const vol = 0.5 - r * 0.42 + 0.12 * Math.abs(Math.sin(i * 3.7)); // negative r ⇒ higher vol
      const y = H - 12 - vol * (H - 26);
      return { x, y, neg: r < 0 };
    });
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scatter of today's return against next-day volatility: negative returns line up with higher future volatility.">
        <line x1={W / 2} y1={6} x2={W / 2} y2={H - 10} stroke="var(--color-ink-100)" />
        <line x1={0} y1={H - 12} x2={W} y2={H - 12} stroke="var(--color-ink-100)" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.6} fill={p.neg ? real : gbm} opacity={0.8} />
        ))}
      </svg>
    );
  }

  // gain-loss: an equity curve that grinds up then crashes fast.
  const n = 90;
  const ys = Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const grind = t * 0.7;
    const crash = t > 0.62 ? -Math.pow((t - 0.62) / 0.38, 1.4) * 0.9 : 0;
    return grind + crash;
  });
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const span = yMax - yMin || 1;
  const px = (i: number) => (i / (n - 1)) * W;
  const py = (v: number) => H - 8 - ((v - yMin) / span) * (H - 18);
  const d = ys.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="An equity curve that grinds slowly upward and then falls sharply — the gain/loss asymmetry.">
      <path d={d} fill="none" stroke={real} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * An interactive "scorecard" of the stylized facts a synthetic-data generator
 * must reproduce. The learner clicks a fact to expand its definition, a
 * built-in mini visual contrasting real markets (accent) with a plain Gaussian
 * random walk (dashed ink), and a verdict on whether GBM reproduces it. The
 * running tally at the top drives home the core lesson: a naive simulator that
 * only matches mean and variance fails almost the entire checklist.
 */
export function StylizedFactsChecklist({
  title = 'The stylized-facts scorecard',
  facts = DEFAULT_FACTS,
  passLabel = 'GBM reproduces it',
  failLabel = 'GBM misses it',
  scorecardLabel = 'Gaussian random walk score',
  caption = 'Click any fact to see what real markets show versus a plain Gaussian random walk. A useful generator must tick these boxes — and the naive baseline ticks almost none of them.',
  className,
}: StylizedFactsChecklistProps) {
  const id = useId();
  const [open, setOpen] = useState<number | null>(0);
  const passed = facts.filter((f) => f.gbmReproduces).length;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="text-sm text-ink-600">
          {scorecardLabel}:{' '}
          <span className="font-mono font-semibold text-ink-900">
            {passed}/{facts.length}
          </span>
        </span>
      </figcaption>

      <ul className="mt-4 flex flex-col gap-2">
        {facts.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.kind} className="rounded-card border border-ink-100 bg-surface-50">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={cx(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-sm font-semibold',
                    f.gbmReproduces
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-accent-100 text-accent-700',
                  )}
                  aria-hidden="true"
                >
                  {f.gbmReproduces ? '✓' : '✗'}
                </span>
                <span className="flex-1 font-medium text-ink-900">{f.name}</span>
                <span className="text-ink-400" aria-hidden="true">
                  {isOpen ? '–' : '+'}
                </span>
              </button>

              {isOpen && (
                <div id={`${id}-panel-${i}`} className="border-t border-ink-100 px-4 py-4">
                  <p className="text-sm leading-relaxed text-ink-700">{f.definition}</p>
                  <div className="mt-3 rounded-card border border-ink-100 bg-surface p-3">
                    <FactVisual kind={f.kind} />
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1 w-4 rounded-pill bg-accent-500" aria-hidden="true" />
                        real market
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-0 w-4 border-t border-dashed border-ink-400" aria-hidden="true" />
                        Gaussian walk
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-700">{f.real}</p>
                  <p
                    className={cx(
                      'mt-2 inline-flex items-center gap-2 rounded-pill px-3 py-1 text-xs font-semibold',
                      f.gbmReproduces
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-accent-100 text-accent-700',
                    )}
                  >
                    {f.gbmReproduces ? passLabel : failLabel}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.verdict}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default StylizedFactsChecklist;
