import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface SyntheticVsRealPathsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the slider that controls how much the generator memorizes. */
  memorizationLabel?: string;
  /** Caption under the "novel" end of the slider. */
  novelLabel?: string;
  /** Caption under the "copy" end of the slider. */
  copyLabel?: string;
  /** Label for the nearest-neighbour-distance readout. */
  distanceLabel?: string;
  /** Label for the verdict line. */
  verdictLabel?: string;
  /** Verdict shown when the generator is healthy (novel paths). */
  healthyVerdict?: string;
  /** Verdict shown when the generator is memorizing (copying training paths). */
  memorizedVerdict?: string;
  /** Label for the resimulate button. */
  resimulateLabel?: string;
  /** Legend label for the real / training paths. */
  realLabel?: string;
  /** Legend label for the synthetic paths. */
  syntheticLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STEPS = 64;
const N_REAL = 5;
const N_SYNTH = 5;

const boxMuller = (): number => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

type Path = number[];

const makePath = (vol: number): Path => {
  const p: Path = [100];
  let level = 100;
  for (let t = 0; t < STEPS; t++) {
    level += vol * boxMuller();
    p.push(level);
  }
  return p;
};

/**
 * A teaching island for the central trap of synthetic data: a generator that
 * *copies* its training set looks brilliant on every distribution test yet is
 * worthless (and leaks the future into any backtest). The learner drags a
 * "memorization" slider: at the novel end the synthetic paths (accent) share the
 * statistics of the real training paths (ink) but visibly differ; at the copy
 * end they collapse onto the nearest real path. A nearest-neighbour distance
 * readout falls toward zero as memorization rises — the actual test you run to
 * catch a memorizing GAN.
 */
export function SyntheticVsRealPaths({
  title = 'Healthy generator vs a memorizing one',
  memorizationLabel = 'Generator memorization',
  novelLabel = 'Novel (healthy)',
  copyLabel = 'Copying (leaks)',
  distanceLabel = 'Nearest-neighbour distance',
  verdictLabel = 'Verdict',
  healthyVerdict = 'Synthetic paths share the real statistics but stay distinct — safe to train on.',
  memorizedVerdict = 'Synthetic paths hug the training set — your backtest is just reading back the future it memorized.',
  resimulateLabel = 'Resimulate',
  realLabel = 'Real (training)',
  syntheticLabel = 'Synthetic',
  caption = 'Drag the slider. As the generator memorizes, the synthetic paths collapse onto the real training paths and the nearest-neighbour distance crashes toward zero — that is exactly the "did it just copy?" test you run before trusting any generator.',
  className,
}: SyntheticVsRealPathsProps) {
  const [mem, setMem] = useState(0);
  const [seed, setSeed] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const W = 520;
  const H = 250;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 22;

  // Real training paths and the "novel" synthetic draws are fixed per seed; the
  // slider only blends each synthetic path toward its nearest real neighbour.
  const { real, novel } = useMemo(() => {
    const real = Array.from({ length: N_REAL }, () => makePath(1));
    const novel = Array.from({ length: N_SYNTH }, () => makePath(1));
    return { real, novel };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // For each novel synthetic path, find its nearest real path (by endpoint) once.
  const nearestIdx = useMemo(
    () =>
      novel.map((s) => {
        let best = 0;
        let bestD = Infinity;
        real.forEach((r, j) => {
          const d = Math.abs(r[STEPS] - s[STEPS]);
          if (d < bestD) {
            bestD = d;
            best = j;
          }
        });
        return best;
      }),
    [novel, real],
  );

  // Blend each synthetic path toward its nearest real path by the memorization amount.
  const synth = useMemo(
    () =>
      novel.map((s, i) => {
        const r = real[nearestIdx[i]];
        return s.map((v, t) => v * (1 - mem) + r[t] * mem);
      }),
    [novel, real, nearestIdx, mem],
  );

  // Mean nearest-neighbour distance (average absolute gap to nearest real path),
  // normalised so the novel end reads ~1.00 and the copy end reads ~0.00.
  const nnDistance = useMemo(() => {
    let total = 0;
    synth.forEach((s, i) => {
      const r = real[nearestIdx[i]];
      let acc = 0;
      for (let t = 0; t <= STEPS; t++) acc += Math.abs(s[t] - r[t]);
      total += acc / (STEPS + 1);
    });
    const raw = total / synth.length;
    // Baseline distance at mem=0 for normalisation.
    let base = 0;
    novel.forEach((s, i) => {
      const r = real[nearestIdx[i]];
      let acc = 0;
      for (let t = 0; t <= STEPS; t++) acc += Math.abs(s[t] - r[t]);
      base += acc / (STEPS + 1);
    });
    base = base / novel.length || 1;
    return raw / base;
  }, [synth, novel, real, nearestIdx]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 720;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      setProgress(1 - (1 - t) * (1 - t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [seed]);

  const all = [...real, ...synth];
  let yMax = -Infinity;
  let yMin = Infinity;
  all.forEach((p) => {
    p.forEach((v) => {
      if (v > yMax) yMax = v;
      if (v < yMin) yMin = v;
    });
  });
  const ySpan = yMax - yMin || 1;
  yMax += ySpan * 0.06;
  yMin -= ySpan * 0.06;

  const xToPx = (i: number) => padLeft + (i / STEPS) * (W - padLeft - padRight);
  const yToPx = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);

  const drawn = Math.max(1, Math.round(STEPS * progress));
  const toD = (p: Path): string => {
    let d = '';
    const last = Math.min(drawn, STEPS);
    for (let i = 0; i <= last; i++) {
      d += `${i === 0 ? 'M' : 'L'} ${xToPx(i).toFixed(2)} ${yToPx(p[i]).toFixed(2)} `;
    }
    return d.trim();
  };

  const memPct = Math.round(mem * 100);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />
          {realLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {syntheticLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Five real training price paths and five synthetic paths. As the memorization slider rises, the synthetic paths collapse onto the real ones."
      >
        {real.map((p, i) => (
          <path
            key={`r-${i}`}
            d={toD(p)}
            fill="none"
            stroke="var(--color-ink-400)"
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.55}
          />
        ))}
        {synth.map((p, i) => (
          <path
            key={`s-${i}`}
            d={toD(p)}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth={1.9}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <div className="mt-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-700">
          <span className="flex items-center justify-between">
            <span>{memorizationLabel}</span>
            <span className="font-mono text-ink-900">{memPct}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={memPct}
            onChange={(e) => setMem(Number(e.target.value) / 100)}
            className="w-full accent-accent-500"
            aria-valuetext={`${memPct}% memorization`}
          />
          <span className="flex justify-between text-xs font-normal text-ink-500">
            <span>{novelLabel}</span>
            <span>{copyLabel}</span>
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3">
          <p className="text-xs text-ink-600">{distanceLabel}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink-900">
            {nnDistance.toFixed(2)}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
            <div
              className={cx(
                'h-full rounded-pill transition-all',
                nnDistance < 0.35 ? 'bg-accent-500' : 'bg-brand-500',
              )}
              style={{ width: `${Math.max(2, Math.min(100, nnDistance * 100))}%` }}
            />
          </div>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-50 p-3">
          <p className="text-xs text-ink-600">{verdictLabel}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-800">
            {mem > 0.6 ? memorizedVerdict : healthyVerdict}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-pill border border-ink-100 bg-surface-50 px-4 py-1.5 text-sm font-medium text-ink-800 shadow-soft transition hover:bg-surface-100"
        >
          {resimulateLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default SyntheticVsRealPaths;
