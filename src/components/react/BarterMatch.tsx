import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface Trader {
  /** Display name (locale-agnostic; English default supplied internally). */
  name: string;
  /** Emoji for the good this trader HAS to offer. */
  hasIcon: string;
  /** Emoji for the good this trader WANTS in return. */
  wantsIcon: string;
}

export interface BarterMatchProps {
  /** Heading above the diagram. */
  title?: string;
  /** Toggle label for barter mode. */
  barterLabel?: string;
  /** Toggle label for money mode. */
  moneyLabel?: string;
  /** Caption shown under the diagram in barter mode. */
  barterCaption?: string;
  /** Caption shown under the diagram in money mode. */
  moneyCaption?: string;
  /** Small word for what each trader HAS. */
  hasLabel?: string;
  /** Small word for what each trader WANTS. */
  wantsLabel?: string;
  /** Accessible label for the mode toggle group. */
  groupLabel?: string;
  /**
   * Ring of traders, each with a good they HAVE and a good they WANT. Defaults
   * to a 5-trader ring engineered so that NO two traders directly want each
   * other's good — the classic double-coincidence deadlock. Money breaks it.
   */
  traders?: Trader[];
  /** Word for the emoji coin sitting in the middle in money mode. */
  moneyIcon?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Default 5-trader ring tuned so the WANT of each trader is NOT the good HELD
 * by the one trader who wants what they have — i.e. there is no direct
 * double-coincidence of wants anywhere in the ring. Each trader wants the good
 * held *two seats over*, so a barter chain would need a third party; money
 * dissolves the problem entirely.
 *
 *   Goods cycle: 🍞 🥚 🪓 🧶 🐟
 *   has[i]   = goods[i]
 *   wants[i] = goods[i+2]  → never the holder of what wants my good.
 */
const DEFAULT_TRADERS: Trader[] = [
  { name: 'Baker', hasIcon: '🍞', wantsIcon: '🪓' },
  { name: 'Farmer', hasIcon: '🥚', wantsIcon: '🧶' },
  { name: 'Woodcutter', hasIcon: '🪓', wantsIcon: '🐟' },
  { name: 'Weaver', hasIcon: '🧶', wantsIcon: '🍞' },
  { name: 'Fisher', hasIcon: '🐟', wantsIcon: '🥚' },
];

/**
 * Teaches the **double coincidence of wants**. A ring of traders each HAS one
 * good and WANTS another. In *barter* mode the component searches for any pair
 * where A wants B's good *and* B wants A's good — in the default ring there are
 * none, so no direct swap is possible and the ring deadlocks (every desire-arrow
 * points at someone who can't reciprocate). Toggle to *money* mode and a coin
 * appears in the middle: now anyone sells to / buys from the pool, so every want
 * is reachable. The arrows redraw to show wants flowing through money instead of
 * stalling between people.
 *
 * Animation is gated behind `prefers-reduced-motion`; the static fallback still
 * shows both layouts correctly (arrows drawn, no pulsing). All user-facing text
 * is an optional prop with an English default, and trader goods are emoji so the
 * component is locale-agnostic.
 */
export function BarterMatch({
  title = 'The double coincidence of wants',
  barterLabel = 'Barter',
  moneyLabel = 'Money',
  barterCaption = 'Each arrow points to the good a trader wants. For a direct swap to work, two arrows must point back at each other — and here none do. Nobody can trade, so the ring is stuck.',
  moneyCaption = 'Drop money in the middle and the chains break apart. Anyone can sell their good for money and buy what they want from anyone else — every want becomes reachable.',
  hasLabel = 'has',
  wantsLabel = 'wants',
  groupLabel = 'Trade mode',
  traders = DEFAULT_TRADERS,
  moneyIcon = '🪙',
  className,
}: BarterMatchProps) {
  const id = useId();
  const [mode, setMode] = useState<'barter' | 'money'>('barter');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  const W = 360;
  const H = 360;
  const cx0 = W / 2;
  const cy0 = H / 2;
  const radius = 132;
  const n = traders.length;

  // Place traders evenly around a circle, first node at top.
  const points = useMemo(
    () =>
      traders.map((t, i) => {
        const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
        return {
          ...t,
          x: cx0 + radius * Math.cos(angle),
          y: cy0 + radius * Math.sin(angle),
        };
      }),
    [traders, n],
  );

  // In barter mode, trader i WANTS the good held by whichever trader HAS
  // its wantsIcon. Arrow points from i → that holder.
  const wantArrows = useMemo(
    () =>
      points.map((p, i) => {
        const target = points.findIndex((q) => q.hasIcon === p.wantsIcon);
        return { from: i, to: target };
      }),
    [points],
  );

  // A direct swap exists when i wants j's good AND j wants i's good.
  const directSwaps = useMemo(() => {
    const found: Array<[number, number]> = [];
    wantArrows.forEach(({ from, to }) => {
      if (to < 0) return;
      const back = wantArrows[to];
      if (back && back.to === from && from < to) found.push([from, to]);
    });
    return found;
  }, [wantArrows]);

  // Shorten an arrow so it stops short of the node circles at both ends.
  const trim = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    pad: number,
  ) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: ax + ux * pad,
      y1: ay + uy * pad,
      x2: bx - ux * pad,
      y2: by - uy * pad,
    };
  };

  const nodeR = 30;

  const statusText =
    mode === 'barter'
      ? directSwaps.length === 0
        ? 'No direct swap is possible — the ring is deadlocked.'
        : `${directSwaps.length} direct swap(s) possible.`
      : 'Money in the middle makes every want satisfiable.';

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>

        {/* Mode toggle */}
        <div
          role="radiogroup"
          aria-label={groupLabel}
          className="inline-flex rounded-pill border border-ink-100 bg-surface-sunken/40 p-1"
        >
          {(['barter', 'money'] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m)}
                className={cx(
                  'rounded-pill px-4 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active
                    ? 'bg-brand-600 text-white shadow-soft'
                    : 'text-ink-600 hover:text-ink-900',
                )}
              >
                {m === 'barter' ? barterLabel : moneyLabel}
              </button>
            );
          })}
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto mt-4 w-full max-w-[360px]"
        role="img"
        aria-label={`${title}. ${
          mode === 'barter' ? barterLabel : moneyLabel
        } mode: ${statusText}`}
      >
        <defs>
          <marker
            id={`${id}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent-500)" />
          </marker>
          <marker
            id={`${id}-arrow-money`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand-500)" />
          </marker>
        </defs>

        {/* BARTER: want-arrows between traders (no reciprocation = deadlock) */}
        {mode === 'barter' &&
          wantArrows.map(({ from, to }) => {
            if (to < 0) return null;
            const a = points[from];
            const b = points[to];
            const seg = trim(a.x, a.y, b.x, b.y, nodeR + 4);
            return (
              <line
                key={`want-${from}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="var(--color-accent-500)"
                strokeWidth={2}
                strokeDasharray="5 5"
                markerEnd={`url(#${id}-arrow)`}
                className={reduced ? undefined : 'barter-want-flow'}
              />
            );
          })}

        {/* MONEY: a hub in the middle; each trader links to the pool both ways */}
        {mode === 'money' &&
          points.map((p, i) => {
            const seg = trim(p.x, p.y, cx0, cy0, nodeR + 4);
            return (
              <line
                key={`hub-${i}`}
                x1={seg.x1}
                y1={seg.y1}
                x2={seg.x2}
                y2={seg.y2}
                stroke="var(--color-brand-500)"
                strokeWidth={2}
                markerStart={`url(#${id}-arrow-money)`}
                markerEnd={`url(#${id}-arrow-money)`}
                className={reduced ? undefined : 'money-hub-flow'}
              />
            );
          })}

        {/* Money hub in the centre */}
        {mode === 'money' && (
          <g className={reduced ? undefined : 'animate-float'}>
            <circle
              cx={cx0}
              cy={cy0}
              r={26}
              fill="var(--color-brand-50)"
              stroke="var(--color-brand-500)"
              strokeWidth={2}
            />
            <text
              x={cx0}
              y={cy0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="26"
              role="presentation"
            >
              {moneyIcon}
            </text>
          </g>
        )}

        {/* Trader nodes */}
        {points.map((p, i) => (
          <g key={`node-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={nodeR}
              fill="var(--color-surface)"
              stroke="var(--color-ink-200)"
              strokeWidth={1.5}
            />
            <text
              x={p.x}
              y={p.y - 4}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="22"
              role="presentation"
            >
              {p.hasIcon}
            </text>
            <text
              x={p.x}
              y={p.y + nodeR + 13}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-ink-600)"
            >
              {p.name}
            </text>
          </g>
        ))}
      </svg>

      {/* Per-trader legend: what each HAS and WANTS */}
      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {traders.map((t) => (
          <li
            key={t.name}
            className="flex items-center gap-2 rounded-card border border-ink-100 bg-surface-sunken/30 px-3 py-2"
          >
            <span className="text-base" aria-hidden="true">
              {t.hasIcon}
            </span>
            <span className="text-ink-700">
              <span className="font-medium text-ink-900">{t.name}</span>{' '}
              <span className="text-ink-500">
                {hasLabel} {t.hasIcon}, {wantsLabel} {t.wantsIcon}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p
        className="mt-4 text-sm leading-relaxed text-ink-600"
        aria-live="polite"
      >
        {mode === 'barter' ? barterCaption : moneyCaption}
      </p>

      {/* Component-scoped keyframes (Tailwind v4 doesn't scan these strings,
          so the rules live here, gated behind prefers-reduced-motion). */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .barter-want-flow {
            animation: barter-want-dash 1.1s linear infinite;
          }
          .money-hub-flow {
            animation: money-hub-pulse 2s ease-in-out infinite;
          }
        }
        @keyframes barter-want-dash {
          to { stroke-dashoffset: -20; }
        }
        @keyframes money-hub-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>
    </figure>
  );
}

export default BarterMatch;
