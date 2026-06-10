import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** One index constituent: a name plus its market cap (arbitrary units). */
export interface IndexCompany {
  /** Company name shown next to its bar. Comes from the lesson, so it stays locale-aware. */
  name: string;
  /** Market capitalisation in arbitrary units (relative size is what matters). */
  marketCap: number;
}

export interface IndexWeightsProps {
  /** Heading above the chart. */
  title?: string;
  /** The fictional index members. Defaults to 8 made-up companies spanning 3000 → 50. */
  companies?: IndexCompany[];
  /** Label for the cap-weighted toggle button. */
  capWeightedLabel?: string;
  /** Label for the equal-weighted toggle button. */
  equalWeightedLabel?: string;
  /** Accessible label for the weighting-scheme toggle group. */
  schemeGroupLabel?: string;
  /** Label for the highlighted top-3 summary stat. */
  topThreeLabel?: string;
  /** Label for the market-cap slider of the biggest company. `{name}` is replaced with its name. */
  sliderLabel?: string;
  /** Short label for the market-cap readout next to the slider, e.g. 'Market cap'. */
  marketCapLabel?: string;
  /** Legend label for the three biggest companies (highlighted bars). */
  topThreeLegendLabel?: string;
  /** Legend label for the remaining companies. */
  othersLegendLabel?: string;
  /** Note shown while the slider is usable but the index is equal-weighted. */
  equalWeightNote?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const DEFAULT_COMPANIES: IndexCompany[] = [
  { name: 'MegaCorp', marketCap: 3000 },
  { name: 'BigSoft', marketCap: 2400 },
  { name: 'Fruitful Inc.', marketCap: 1900 },
  { name: 'RiverRetail', marketCap: 800 },
  { name: 'OilWell Co.', marketCap: 550 },
  { name: 'BankTrust', marketCap: 320 },
  { name: 'RailRoad Ltd.', marketCap: 130 },
  { name: 'TinyBots', marketCap: 50 },
];

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Format a 0–1 weight as a percentage string with one decimal. */
const formatPct = (weight: number): string => `${(weight * 100).toFixed(1)}%`;

/**
 * Interactive anatomy of a stock index. Eight fictional companies (one giant,
 * one minnow, the rest in between) are shown as horizontal weight bars. A
 * toggle flips the index between **cap-weighted** (weight = your market cap ÷
 * everyone's market cap) and **equal-weighted** (everyone gets the same slice),
 * and the bars tween between the two states so the redistribution is visible.
 *
 * Two things make the concentration lesson visceral:
 * 1. A highlighted "Top 3 weight" stat (aria-live) that collapses from ~74% to
 *    37.5% when you switch schemes.
 * 2. A slider that inflates or deflates the biggest company's market cap and
 *    live-updates the cap weights — one giant stock visibly drags the whole
 *    index around, while the equal-weighted bars don't budge.
 *
 * Locale-agnostic (every user-facing string is a prop with an English default)
 * and respects `prefers-reduced-motion` by jumping straight to the new state.
 */
export function IndexWeights({
  title = 'Same companies, two very different indices',
  companies = DEFAULT_COMPANIES,
  capWeightedLabel = 'Cap-weighted',
  equalWeightedLabel = 'Equal-weighted',
  schemeGroupLabel = 'Weighting scheme',
  topThreeLabel = 'Top 3 weight',
  sliderLabel = 'Market cap of {name}',
  marketCapLabel = 'Market cap',
  topThreeLegendLabel = 'Top 3 companies',
  othersLegendLabel = 'Everyone else',
  equalWeightNote = 'Equal weighting ignores market cap — move the slider and nothing changes.',
  caption,
  className,
}: IndexWeightsProps) {
  if (companies.length < 2) {
    throw new Error('IndexWeights needs at least 2 companies.');
  }

  const id = useId();
  const rafRef = useRef<number | null>(null);

  // Companies sorted big → small; the biggest one is driven by the slider.
  const sorted = useMemo(
    () => [...companies].sort((a, b) => b.marketCap - a.marketCap),
    [companies],
  );
  const giant = sorted[0];
  const sliderMin = Math.round(giant.marketCap / 6);
  const sliderMax = Math.round(giant.marketCap * 3);
  const sliderStep = Math.max(1, Math.round(giant.marketCap / 60));

  const [scheme, setScheme] = useState<'cap' | 'equal'>('cap');
  const [giantCap, setGiantCap] = useState(giant.marketCap);

  // Target weights (0–1) under the active scheme, with the slider applied.
  const targetWeights = useMemo(() => {
    if (scheme === 'equal') return sorted.map(() => 1 / sorted.length);
    const caps = sorted.map((c, i) => (i === 0 ? giantCap : c.marketCap));
    const total = caps.reduce((sum, cap) => sum + cap, 0);
    return caps.map((cap) => cap / total);
  }, [scheme, sorted, giantCap]);

  // Displayed weights tween toward the target when the *scheme* flips; slider
  // moves apply instantly (the drag itself is the animation).
  const [displayWeights, setDisplayWeights] = useState(targetWeights);
  const displayRef = useRef(displayWeights);
  displayRef.current = displayWeights;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayWeights(targetWeights);
      return;
    }
    if (prefersReducedMotion()) {
      setDisplayWeights(targetWeights);
      return;
    }
    const from = displayRef.current;
    const to = targetWeights;
    // Slider drags re-target every few ms — tween fast so it feels live.
    const duration = scheme === 'equal' || from.length !== to.length ? 600 : 240;
    let startTs: number | null = null;
    const step = (ts: number): void => {
      if (startTs === null) startTs = ts;
      const p = easeOutCubic(Math.min(1, (ts - startTs) / duration));
      setDisplayWeights(to.map((t, i) => (from[i] ?? t) + (t - (from[i] ?? t)) * p));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWeights]);

  const topThree = targetWeights.slice(0, 3).reduce((sum, w) => sum + w, 0);
  const giantSliderLabel = sliderLabel.replace('{name}', giant.name);

  // Geometry.
  const W = 520;
  const rowH = 26;
  const rowGap = 12;
  const padX = 10;
  const padTop = 6;
  const labelW = 132; // left gutter for company names
  const valueW = 58; // right gutter for the percentage readout
  const trackW = W - padX * 2 - labelW - valueW;
  const maxWeight = Math.max(0.5, ...targetWeights, ...displayWeights);
  const H = padTop * 2 + sorted.length * rowH + (sorted.length - 1) * rowGap;

  const summary = sorted
    .map((c, i) => `${c.name}: ${formatPct(targetWeights[i])}`)
    .join('; ');
  const activeSchemeLabel = scheme === 'cap' ? capWeightedLabel : equalWeightedLabel;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      {/* Scheme toggle */}
      <div
        className="mt-4 inline-flex flex-wrap gap-1 rounded-pill bg-surface-sunken/60 p-1"
        role="group"
        aria-label={schemeGroupLabel}
      >
        {(
          [
            ['cap', capWeightedLabel],
            ['equal', equalWeightedLabel],
          ] as const
        ).map(([key, label]) => {
          const isActive = scheme === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setScheme(key)}
              className={cx(
                'rounded-pill px-3 py-1 text-sm font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                isActive ? 'bg-brand-600 text-white shadow-soft' : 'text-ink-700 hover:bg-surface',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {topThreeLegendLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-400" aria-hidden="true" />
          {othersLegendLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title} (${activeSchemeLabel}). ${summary}.`}
      >
        {sorted.map((company, i) => {
          const y = padTop + i * (rowH + rowGap);
          const cy = y + rowH / 2;
          const w = Math.max(0, ((displayWeights[i] ?? 0) / maxWeight) * trackW);
          const isTopThree = i < 3;
          return (
            <g key={company.name}>
              {/* Company name */}
              <text
                x={padX}
                y={cy}
                dominantBaseline="middle"
                fontSize={13}
                fill="var(--color-ink-700)"
              >
                {company.name}
              </text>
              {/* Track */}
              <rect
                x={padX + labelW}
                y={y}
                width={trackW}
                height={rowH}
                rx={6}
                fill="var(--color-surface-sunken)"
              />
              {/* Weight bar */}
              <rect
                x={padX + labelW}
                y={y}
                width={w}
                height={rowH}
                rx={6}
                fill={isTopThree ? 'var(--color-brand-500)' : 'var(--color-accent-400)'}
              />
              {/* Percentage readout (tracks the animated bar) */}
              <text
                x={padX + labelW + trackW + 8}
                y={cy}
                dominantBaseline="middle"
                fontSize={13}
                fontFamily="var(--font-mono, monospace)"
                fontWeight={600}
                fill={isTopThree ? 'var(--color-brand-700)' : 'var(--color-ink-600)'}
              >
                {formatPct(displayWeights[i] ?? 0)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Text mirror of the bars for screen readers. */}
      <ul className="sr-only">
        {sorted.map((company, i) => (
          <li key={company.name}>
            {company.name}: {formatPct(targetWeights[i])}
          </li>
        ))}
      </ul>

      {/* Top-3 concentration stat */}
      <div
        className="mt-4 flex items-baseline justify-between gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3"
        aria-live="polite"
      >
        <span className="text-sm font-medium text-ink-700">
          {topThreeLabel}{' '}
          <span className="text-ink-500">({activeSchemeLabel})</span>
        </span>
        <span className="font-mono text-2xl font-semibold text-brand-700">
          {formatPct(topThree)}
        </span>
      </div>

      {/* Giant-company market-cap slider */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-giant-cap`} className="text-sm font-medium text-ink-700">
            {giantSliderLabel}
          </label>
          <span className="font-mono text-sm font-semibold text-ink-900">
            <span className="sr-only">{marketCapLabel}: </span>
            {giantCap.toLocaleString()}
          </span>
        </div>
        <input
          id={`${id}-giant-cap`}
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={giantCap}
          onChange={(event) => setGiantCap(Number(event.target.value))}
          className="mt-2 w-full accent-brand-600"
          aria-valuetext={`${giantCap.toLocaleString()}`}
        />
        {scheme === 'equal' ? (
          <p className="mt-1 text-sm text-ink-500">{equalWeightNote}</p>
        ) : null}
      </div>

      {caption ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
      ) : null}
    </figure>
  );
}

export default IndexWeights;
