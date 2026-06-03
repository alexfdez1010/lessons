import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

/** A single asset slice inside a reserve profile's $1-of-backing bar. */
export interface ReserveSlice {
  /** Human-readable asset name, e.g. "T-bills" or "Commercial paper". */
  label: string;
  /** Share of the $1 backing this asset represents, 0–1 (e.g. 0.8 = 80%). */
  share: number;
  /** Risk tone driving the slice color. */
  tone: 'safe' | 'cash' | 'risky' | 'danger';
}

/** A named reserve composition the learner can switch between. */
export interface ReserveProfile {
  /** Button + heading label, e.g. "Conservative". */
  name: string;
  /** Ordered asset slices. Their shares may sum to < 1 (under-backed). */
  slices: ReserveSlice[];
  /** Status line summarising liquidity / credit risk and backing. */
  status: string;
  /** One-line "why it matters" caption under the bar. */
  caption: string;
  /** Overall health of the profile, driving the status badge + colors. */
  health: 'good' | 'caution' | 'bad';
}

export interface ReserveCompositionProps {
  /** Heading above the diagram. */
  title?: string;
  /** Badge text for the "$1 of reserves per coin" readout. */
  perCoinLabel?: string;
  /** Reserve profiles the learner can toggle between. */
  profiles?: ReserveProfile[];
  /** Index of the profile shown first. Defaults to `0`. */
  initialProfile?: number;
  /** Label for the leftover/unbacked portion of an under-backed bar. */
  unbackedLabel?: string;
  /** Accessible prefix announcing the active profile (before its name). */
  selectLabel?: string;
  /** Badge text for a fully-backed, healthy profile. */
  goodBadge?: string;
  /** Badge text for a fully-backed but risky profile. */
  cautionBadge?: string;
  /** Badge text for an under-backed profile. */
  badBadge?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TONE_FILL: Record<ReserveSlice['tone'], string> = {
  safe: 'var(--color-brand-500)',
  cash: 'var(--color-success)',
  risky: 'var(--color-accent-500)',
  danger: 'var(--color-warning)',
};

const HEALTH_BADGE: Record<ReserveProfile['health'], string> = {
  good: 'bg-success',
  caution: 'bg-warning',
  bad: 'bg-warning',
};

const HEALTH_STATUS: Record<ReserveProfile['health'], string> = {
  good: 'border-success/40 bg-success/10 text-success',
  caution: 'border-warning/40 bg-warning/10 text-warning',
  bad: 'border-warning/50 bg-warning/15 text-warning',
};

const pct = (share: number): number => Math.round(share * 100);

const DEFAULT_PROFILES: ReserveProfile[] = [
  {
    name: 'Conservative',
    health: 'good',
    slices: [
      { label: 'Short-dated T-bills', share: 0.8, tone: 'safe' },
      { label: 'Cash & bank deposits', share: 0.15, tone: 'cash' },
      { label: 'Overnight repos', share: 0.05, tone: 'safe' },
    ],
    status:
      'Fully backed, highly liquid, low risk — sellable for cash overnight, so redemptions at $1 hold up even under stress.',
    caption:
      'GENIUS-Act-style reserves: cash and government debt that maturing in days can be turned into dollars fast, with almost no credit risk.',
  },
  {
    name: 'Risky / opaque',
    health: 'caution',
    slices: [
      { label: 'Commercial paper', share: 0.4, tone: 'risky' },
      { label: 'Corporate bonds', share: 0.25, tone: 'risky' },
      { label: 'Secured loans', share: 0.2, tone: 'danger' },
      { label: 'Other crypto', share: 0.1, tone: 'danger' },
      { label: 'Cash', share: 0.05, tone: 'cash' },
    ],
    status:
      'Backed on paper, but illiquid and credit-exposed — in a panic these assets sell at a loss, so the peg can break below $1.',
    caption:
      'It adds up to $1 today, but quality matters: corporate IOUs and crypto can lose value or freeze exactly when everyone wants out.',
  },
  {
    name: 'Under-backed',
    health: 'bad',
    slices: [
      { label: 'T-bills', share: 0.6, tone: 'safe' },
      { label: 'Corporate bonds', share: 0.22, tone: 'risky' },
      { label: 'Cash', share: 0.1, tone: 'cash' },
    ],
    status:
      'Not fully backed: only $0.92 of assets sit behind each $1 coin. Even a calm redemption can leave the last holders short.',
    caption:
      'The slices do not reach 100% — the gap is a promise with nothing behind it. "1 coin = $1" is simply not true here.',
  },
];

/**
 * Reserve-composition explainer for fiat-backed stablecoins. A 100%-wide
 * stacked bar stands for the $1 of reserves backing each coin, split into named
 * asset slices. The learner toggles between reserve PROFILES (conservative,
 * risky/opaque, under-backed) and the slice widths animate to the new mix —
 * safe assets (T-bills, cash) render in calm brand/success tones, risky ones
 * (commercial paper, bonds, crypto) in accent/warning tones, and any shortfall
 * shows as a dashed "unbacked" gap. A live status line summarises liquidity,
 * credit risk and whether the coin is fully backed; a caption says why it
 * matters. `prefers-reduced-motion` snaps to the target with no tween. Fully
 * locale-agnostic: every string (including the profiles) is a prop.
 */
export function ReserveComposition({
  title = 'What backs the coin? Reserve composition',
  perCoinLabel = '$1 of reserves per coin',
  profiles = DEFAULT_PROFILES,
  initialProfile = 0,
  unbackedLabel = 'unbacked',
  selectLabel = 'Reserve profile',
  goodBadge = 'Fully backed',
  cautionBadge = 'Backed, but risky',
  badBadge = 'Under-backed',
  className,
}: ReserveCompositionProps) {
  const id = useId();
  const safeInitial = Math.min(Math.max(initialProfile, 0), profiles.length - 1);
  const [active, setActive] = useState(safeInitial);
  const profile = profiles[active];

  const backed = profile.slices.reduce((sum, s) => sum + s.share, 0);
  const gap = Math.max(0, 1 - backed);

  // Animated shares the bar renders against (one tween value per slice + gap).
  const targets = [...profile.slices.map((s) => s.share), gap];
  const [shown, setShown] = useState<number[]>(targets);
  const rafRef = useRef<number | null>(null);

  // Animate slice widths whenever the active profile changes.
  useEffect(() => {
    const next = [...profile.slices.map((s) => s.share), gap];
    if (prefersReducedMotion()) {
      setShown(next);
      return;
    }
    const start = next.map((_, i) => shown[i] ?? 0);
    const duration = 480;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setShown(next.map((t, i) => start[i] + (t - start[i]) * eased));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // shown intentionally omitted: re-running each frame would restart the tween.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const W = 520;
  const H = 96;
  const padX = 10;
  const barY = 30;
  const barH = 34;
  const barW = W - padX * 2;

  const dashId = `${id}-unbacked`;
  const shownGap = shown[profile.slices.length] ?? 0;

  const summary =
    profile.slices.map((s) => `${s.label} ${pct(s.share)}%`).join(', ') +
    (gap > 0.0005 ? `, ${pct(gap)}% ${unbackedLabel}` : '');

  const badge =
    profile.health === 'good'
      ? goodBadge
      : profile.health === 'caution'
        ? cautionBadge
        : badBadge;

  // Build cumulative slice geometry against the animated shares.
  let cursor = padX;
  const sliceRects = profile.slices.map((s, i) => {
    const w = barW * (shown[i] ?? 0);
    const x = cursor;
    cursor += w;
    return { x, w, slice: s, key: i };
  });
  const gapX = cursor;
  const gapW = barW * shownGap;

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
          {perCoinLabel}
        </span>
      </figcaption>

      {/* Profile switcher */}
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={selectLabel}
      >
        {profiles.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === active}
            onClick={() => setActive(i)}
            className={cx(
              'rounded-pill px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              i === active
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'border border-ink-200 bg-surface text-ink-700 hover:bg-surface-sunken/60',
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {profile.slices.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-ink-700">
            <span
              className="h-3 w-3 rounded-pill"
              style={{ backgroundColor: TONE_FILL[s.tone] }}
              aria-hidden="true"
            />
            {s.label} {pct(s.share)}%
          </span>
        ))}
        {gap > 0.0005 && (
          <span className="inline-flex items-center gap-2 text-ink-500">
            <span
              className="h-3 w-3 rounded-pill border border-ink-300"
              style={{ backgroundColor: 'var(--color-ink-100)' }}
              aria-hidden="true"
            />
            {unbackedLabel} {pct(gap)}%
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${selectLabel}: ${profile.name}. ${perCoinLabel} — ${summary}. ${profile.status}`}
      >
        <defs>
          <pattern
            id={dashId}
            width={8}
            height={8}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={8} height={8} fill="var(--color-ink-100)" />
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={8}
              stroke="var(--color-ink-400)"
              strokeWidth={2}
            />
          </pattern>
        </defs>

        {/* Track for the full $1 of backing */}
        <rect
          x={padX}
          y={barY}
          width={barW}
          height={barH}
          rx={6}
          fill="var(--color-ink-100)"
        />

        {/* Asset slices */}
        {sliceRects.map(({ x, w, slice, key }) => (
          <rect
            key={key}
            x={x}
            y={barY}
            width={Math.max(0, w)}
            height={barH}
            fill={TONE_FILL[slice.tone]}
          />
        ))}

        {/* Unbacked gap — dashed muted fill */}
        {gap > 0.0005 && (
          <g>
            <rect
              x={gapX}
              y={barY}
              width={Math.max(0, gapW)}
              height={barH}
              fill={`url(#${dashId})`}
            />
            <rect
              x={gapX}
              y={barY}
              width={Math.max(0, gapW)}
              height={barH}
              fill="none"
              stroke="var(--color-ink-400)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </g>
        )}

        {/* Rounded outline over the whole bar so the ends stay crisp */}
        <rect
          x={padX}
          y={barY}
          width={barW}
          height={barH}
          rx={6}
          fill="none"
          stroke="var(--color-ink-200)"
        />

        {/* Baseline scale labels */}
        <text x={padX} y={H - 6} fontSize="10" fill="var(--color-ink-400)">
          $0.00
        </text>
        <text
          x={W - padX}
          y={H - 6}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-ink-400)"
        >
          $1.00 of backing
        </text>
        <text
          x={W / 2}
          y={barY - 10}
          textAnchor="middle"
          fontSize="11"
          fontWeight={600}
          fill="var(--color-ink-600)"
        >
          {profile.name}
        </text>
      </svg>

      {/* Status line */}
      <p
        aria-live="polite"
        className={cx(
          'mt-3 rounded-card border px-3 py-2 text-sm font-medium',
          HEALTH_STATUS[profile.health],
        )}
      >
        <span
          className={cx(
            'mr-2 inline-block rounded-pill px-2 py-0.5 text-xs font-semibold text-white',
            HEALTH_BADGE[profile.health],
          )}
        >
          {badge}
        </span>
        {profile.status}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        {profile.caption}
      </p>
    </figure>
  );
}

export default ReserveComposition;
