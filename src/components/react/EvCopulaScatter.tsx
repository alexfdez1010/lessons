import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvCopulaScatterProps {
  /** Heading above the chart. */
  title?: string;
  /** Slider label for the correlation. */
  corrLabel?: string;
  /** Label for the Gaussian-copula toggle option. */
  gaussianLabel?: string;
  /** Label for the t-copula toggle option. */
  tLabel?: string;
  /** Readout label for the count of joint-crash points. */
  jointCrashLabel?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const num = (value: number, digits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

// Deterministic Gaussian pair generator with given correlation, seeded.
const makeSeed = (s: number) => {
  let seed = s;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
};

const boxMuller = (rand: () => number): [number, number] => {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  const r = Math.sqrt(-2 * Math.log(u1));
  return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
};

/**
 * Scatter of two asset returns drawn from the SAME correlation under two
 * different copulas: the Gaussian copula (no tail dependence) and the Student-t
 * copula (strong tail dependence). With identical ρ the clouds look similar in
 * the calm centre, but the t copula clumps points into the bottom-left corner —
 * the "everything crashes together" cluster a Gaussian copula structurally
 * cannot produce. The readout counts joint-crash points (both legs in their
 * worst decile) to quantify the difference.
 */
export function EvCopulaScatter({
  title = 'Same correlation, different crash clustering',
  corrLabel = 'Correlation ρ',
  gaussianLabel = 'Gaussian copula',
  tLabel = 't copula (tail dependence)',
  jointCrashLabel = 'Points where BOTH assets crash together',
  caption = 'Both panels share the exact same correlation, yet they behave nothing alike in a crisis. The Gaussian copula scatters its extremes independently; the t copula yanks them into the bottom-left corner — both assets tanking at once. Correlation alone never sees this. Tail dependence is why diversification quietly evaporates exactly when you need it.',
  className,
}: EvCopulaScatterProps) {
  const id = useId();
  const [rho, setRho] = useState(0.4);
  const [copula, setCopula] = useState<'gaussian' | 't'>('t');

  const W = 360;
  const H = 360;
  const pad = 20;
  const N = 320;
  const nu = 3; // t copula degrees of freedom

  const points = useMemo(() => {
    const rand = makeSeed(987654);
    const pts: { x: number; y: number; crash: boolean }[] = [];
    for (let i = 0; i < N; i++) {
      const [z1, z2raw] = boxMuller(rand);
      // Correlate: z2 = rho*z1 + sqrt(1-rho^2)*z2raw.
      let a = z1;
      let b = rho * z1 + Math.sqrt(1 - rho * rho) * z2raw;
      if (copula === 't') {
        // Scale both by a common chi-based factor -> Student-t -> tail dependence.
        // Approximate sqrt(nu / chi2_nu) via averaging squared normals.
        let chi = 0;
        for (let k = 0; k < nu; k++) {
          const [g] = boxMuller(rand);
          chi += g * g;
        }
        const factor = Math.sqrt(nu / Math.max(chi, 1e-6));
        a *= factor;
        b *= factor;
      }
      pts.push({ x: a, y: b, crash: false });
    }
    // Mark joint-crash points: both in worst (lowest) decile.
    const xs = pts.map((p) => p.x).sort((m, n) => m - n);
    const ys = pts.map((p) => p.y).sort((m, n) => m - n);
    const xCut = xs[Math.floor(0.1 * N)];
    const yCut = ys[Math.floor(0.1 * N)];
    for (const p of pts) p.crash = p.x <= xCut && p.y <= yCut;
    return pts;
  }, [rho, copula]);

  const range = 5;
  const sx = (v: number) => pad + ((v + range) / (2 * range)) * (W - pad * 2);
  const sy = (v: number) => H - pad - ((v + range) / (2 * range)) * (H - pad * 2);

  const jointCrashes = points.filter((p) => p.crash).length;

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
          ρ {num(rho * 100, 0)}%
        </span>
      </figcaption>

      <div className="mt-4 inline-flex rounded-pill border border-ink-100 p-1" role="group">
        <button
          type="button"
          aria-pressed={copula === 'gaussian'}
          onClick={() => setCopula('gaussian')}
          className={cx(
            'rounded-pill px-4 py-1 text-sm font-medium transition-colors',
            copula === 'gaussian' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {gaussianLabel}
        </button>
        <button
          type="button"
          aria-pressed={copula === 't'}
          onClick={() => setCopula('t')}
          className={cx(
            'rounded-pill px-4 py-1 text-sm font-medium transition-colors',
            copula === 't' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {tLabel}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto mt-3 block w-full max-w-sm"
        role="img"
        aria-label={`${title}. Under the ${copula === 't' ? 't' : 'Gaussian'} copula with correlation ${num(rho * 100, 0)} percent, ${num(jointCrashes, 0)} of ${N} points show both assets crashing together.`}
      >
        {/* quadrant guides */}
        <line x1={sx(0)} y1={pad} x2={sx(0)} y2={H - pad} stroke="var(--color-ink-100)" />
        <line x1={pad} y1={sy(0)} x2={W - pad} y2={sy(0)} stroke="var(--color-ink-100)" />
        {/* bottom-left crash zone highlight */}
        <rect
          x={pad}
          y={sy(0)}
          width={sx(0) - pad}
          height={H - pad - sy(0)}
          fill="var(--color-brand-500)"
          opacity={0.06}
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={sx(Math.max(-range, Math.min(range, p.x)))}
            cy={sy(Math.max(-range, Math.min(range, p.y)))}
            r={p.crash ? 3 : 2}
            fill={p.crash ? 'var(--color-accent-500)' : 'var(--color-brand-500)'}
            opacity={p.crash ? 0.9 : 0.45}
          />
        ))}
      </svg>

      <div className="mt-4">
        <label
          htmlFor={`${id}-rho`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{corrLabel}</span>
          <span className="font-mono text-ink-900">{num(rho * 100, 0)}%</span>
        </label>
        <input
          id={`${id}-rho`}
          type="range"
          min={0}
          max={90}
          step={5}
          value={rho * 100}
          onChange={(e) => setRho(Number(e.target.value) / 100)}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{jointCrashLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(jointCrashes, 0)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvCopulaScatter;
