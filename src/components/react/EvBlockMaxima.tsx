import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface EvBlockMaximaProps {
  /** Heading above the chart. */
  title?: string;
  /** Slider label for the block size. */
  blockLabel?: string;
  /** Label for the raw-data series. */
  rawLabel?: string;
  /** Label for the block maxima markers. */
  maxLabel?: string;
  /** Readout label for the number of blocks/maxima. */
  blocksLabel?: string;
  /** Caption under the chart. */
  caption?: string;
  className?: string;
}

const num = (value: number, digits = 0): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

const makeSeed = (s: number) => {
  let seed = s;
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
};

/**
 * Block-maxima visual for Extreme Value Theory. A long series of daily losses is
 * chopped into equal blocks (e.g. months or years); within each block only the
 * single maximum is kept (the highlighted dot). Those block maxima are the data
 * that the Generalized Extreme Value distribution is fitted to. The slider sets
 * the block size and the readout shows how many maxima you end up with — the
 * same bias/variance trade-off as threshold choice: big blocks give a cleaner
 * GEV limit but fewer points to fit.
 */
export function EvBlockMaxima({
  title = 'Block maxima: keep only each block’s worst day',
  blockLabel = 'Block size (days)',
  rawLabel = 'Daily losses',
  maxLabel = 'Block maximum',
  blocksLabel = 'Number of block maxima to fit',
  caption = 'Slice the history into equal blocks and throw away everything except each block’s single worst day. Those survivors — the highlighted peaks — are what the Generalized Extreme Value distribution describes. Widen the blocks and each maximum is more genuinely "extreme" (the GEV limit holds better), but you are left with fewer of them to fit: the same bias-versus-variance tug-of-war as choosing a threshold.',
  className,
}: EvBlockMaximaProps) {
  const id = useId();
  const [block, setBlock] = useState(20);

  const N = 200;
  const data = useMemo(() => {
    const rand = makeSeed(424242);
    const out: number[] = [];
    for (let i = 0; i < N; i++) {
      const u1 = Math.max(1e-9, rand());
      const u2 = rand();
      let v = Math.abs(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
      if (rand() > 0.9) v += rand() * 3;
      out.push(v);
    }
    return out;
  }, []);

  const W = 540;
  const H = 230;
  const padX = 14;
  const padT = 14;
  const padB = 22;

  const vMax = Math.max(...data) * 1.05;
  const x = (i: number) => padX + (i / (N - 1)) * (W - padX * 2);
  const yBase = H - padB;
  const yTop = padT;
  const y = (v: number) => yBase - (v / vMax) * (yBase - yTop);

  // Compute block maxima indices.
  const maxIdx = useMemo(() => {
    const idxs: number[] = [];
    for (let start = 0; start < N; start += block) {
      let bestI = start;
      let bestV = -Infinity;
      for (let j = start; j < Math.min(N, start + block); j++) {
        if (data[j] > bestV) {
          bestV = data[j];
          bestI = j;
        }
      }
      idxs.push(bestI);
    }
    return idxs;
  }, [data, block]);

  const maxSet = new Set(maxIdx);
  const blockEdges: number[] = [];
  for (let s = block; s < N; s += block) blockEdges.push(s);

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
          {num(maxIdx.length, 0)} maxima
        </span>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2 w-2 rounded-full bg-ink-300" aria-hidden="true" />
          {rawLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />
          {maxLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title}. With a block size of ${num(block, 0)} days the series yields ${num(maxIdx.length, 0)} block maxima for the GEV fit.`}
      >
        <line x1={padX} y1={yBase} x2={W - padX} y2={yBase} stroke="var(--color-ink-200)" />

        {/* block dividers */}
        {blockEdges.map((e, i) => (
          <line
            key={i}
            x1={x(e - 0.5)}
            y1={yTop}
            x2={x(e - 0.5)}
            y2={yBase}
            stroke="var(--color-ink-100)"
          />
        ))}

        {/* stems */}
        {data.map((v, i) => {
          const isMax = maxSet.has(i);
          return (
            <line
              key={i}
              x1={x(i)}
              y1={yBase}
              x2={x(i)}
              y2={y(v)}
              stroke={isMax ? 'var(--color-accent-500)' : 'var(--color-ink-300)'}
              strokeWidth={isMax ? 2 : 1}
              opacity={isMax ? 0.95 : 0.4}
            />
          );
        })}
        {/* max dots */}
        {maxIdx.map((i) => (
          <circle key={i} cx={x(i)} cy={y(data[i])} r={3.5} fill="var(--color-accent-500)" />
        ))}
      </svg>

      <div className="mt-4">
        <label
          htmlFor={`${id}-block`}
          className="flex items-center justify-between text-sm text-ink-700"
        >
          <span>{blockLabel}</span>
          <span className="font-mono text-ink-900">{num(block, 0)}</span>
        </label>
        <input
          id={`${id}-block`}
          type="range"
          min={5}
          max={50}
          step={1}
          value={block}
          onChange={(e) => setBlock(Number(e.target.value))}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{blocksLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(maxIdx.length, 0)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default EvBlockMaxima;
