import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface InventoryDriftProps {
  /** Heading above the visualization. */
  title?: string;
  /** Button label to run the simulation. */
  runLabel?: string;
  /** Button label shown while running. */
  runningLabel?: string;
  /** Button label to reset. */
  resetLabel?: string;
  /** Label for the skew control group (how aggressively the maker re-centres). */
  skewLabel?: string;
  /** Label for the no-skew preset (quotes symmetric, lets inventory wander). */
  noSkewLabel?: string;
  /** Label for the gentle-skew preset. */
  gentleLabel?: string;
  /** Label for the aggressive-skew preset. */
  aggressiveLabel?: string;
  /** Label for the current-inventory readout. */
  inventoryLabel?: string;
  /** Label for the inventory-limit reference lines. */
  limitLabel?: string;
  /** Label for the bid-skew readout (how far the bid is shaded). */
  bidSkewLabel?: string;
  /** Label for the ask-skew readout. */
  askSkewLabel?: string;
  /** Label for the breach badge when inventory hits a limit. */
  breachLabel?: string;
  /** Axis label for the zero / flat-inventory line. */
  flatLabel?: string;
  /** Long-position side label. */
  longLabel?: string;
  /** Short-position side label. */
  shortLabel?: string;
  /** Static caption shown under reduced motion. */
  reducedMotionCaption?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Skew = 'none' | 'gentle' | 'aggressive';
const SKEW_K: Record<Skew, number> = { none: 0, gentle: 0.25, aggressive: 0.6 };

const STEPS = 60;
const LIMIT = 100; // inventory limit (shares, ±)

/**
 * Market-maker inventory-drift simulator. A maker quotes both sides; random
 * order flow leaves it accumulating a long or short position. With no skew it
 * lets inventory random-walk and risks slamming into its ±limit (a forced,
 * costly unwind). When it *skews* its quotes — shading the bid down and the ask
 * up as it gets long, to attract sells and discourage buys — the inventory path
 * is pulled back toward flat (mean-reverting), trading a little spread capture
 * for much less position risk. The learner picks a skew strength and watches a
 * fresh random inventory path animate level by level, with limit lines and a
 * live skew readout. Under reduced motion the full path is drawn instantly with
 * no animation. Locale-agnostic via props; no hardcoded prose numbers.
 */
export function InventoryDrift({
  title = 'A market maker fighting its inventory',
  runLabel = 'Run a trading session',
  runningLabel = 'Running…',
  resetLabel = 'Reset',
  skewLabel = 'Quote skew strength',
  noSkewLabel = 'No skew',
  gentleLabel = 'Gentle',
  aggressiveLabel = 'Aggressive',
  inventoryLabel = 'Inventory',
  limitLabel = 'Inventory limit',
  bidSkewLabel = 'Bid shaded by',
  askSkewLabel = 'Ask shaded by',
  breachLabel = 'Limit breached — forced unwind',
  flatLabel = 'Flat',
  longLabel = 'Long',
  shortLabel = 'Short',
  reducedMotionCaption = 'Animation is disabled because your system prefers reduced motion, so the whole inventory path is drawn at once. Skew still bends the path back toward flat.',
  caption = 'Each trade pushes the maker long or short. Without skew, inventory wanders freely and can smash into its risk limit. Skewing the quotes — leaning against the position — pulls inventory back toward flat, the maker’s real job between trades.',
  className,
}: InventoryDriftProps) {
  const id = useId();
  const [reduced, setReduced] = useState(false);
  const [skew, setSkew] = useState<Skew>('gentle');
  const [path, setPath] = useState<number[]>([0]);
  const [running, setRunning] = useState(false);
  const [breached, setBreached] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // Generate a full inventory path for the current skew.
  const generate = (): number[] => {
    const k = SKEW_K[skew];
    const pts = [0];
    let inv = 0;
    let hit = false;
    for (let i = 0; i < STEPS; i++) {
      // Random net flow ±, biased back toward flat by the skew term.
      const flow = (Math.random() - 0.5) * 40;
      const pull = -k * inv;
      inv = inv + flow + pull;
      if (inv > LIMIT) {
        inv = LIMIT;
        hit = true;
      }
      if (inv < -LIMIT) {
        inv = -LIMIT;
        hit = true;
      }
      pts.push(inv);
    }
    setBreached(hit);
    return pts;
  };

  const run = () => {
    const full = generate();
    if (reduced) {
      setPath(full);
      return;
    }
    setRunning(true);
    setPath([0]);
    let i = 1;
    const tick = () => {
      setPath(full.slice(0, i + 1));
      i++;
      if (i <= full.length) {
        rafRef.current = window.setTimeout(() => requestAnimationFrame(tick), 40) as unknown as number;
      } else {
        setRunning(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    if (rafRef.current !== null) clearTimeout(rafRef.current);
    setPath([0]);
    setBreached(false);
    setRunning(false);
  };

  useEffect(
    () => () => {
      if (rafRef.current !== null) clearTimeout(rafRef.current);
    },
    [],
  );

  const inv = path[path.length - 1];
  const k = SKEW_K[skew];
  // Skew readout: how far the quotes lean given current inventory (cents).
  const shade = Math.abs(k * inv) / 20; // arbitrary cents scale for display
  const bidShade = inv > 0 ? shade : 0;
  const askShade = inv < 0 ? shade : 0;

  // Chart geometry.
  const W = 520;
  const H = 220;
  const padL = 40;
  const padR = 16;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const toX = (i: number) => padL + (i / STEPS) * plotW;
  const toY = (v: number) => padT + plotH / 2 - (v / LIMIT) * (plotH / 2);

  const linePath = path.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ');

  const skewButtons: Array<{ value: Skew; label: string }> = [
    { value: 'none', label: noSkewLabel },
    { value: 'gentle', label: gentleLabel },
    { value: 'aggressive', label: aggressiveLabel },
  ];

  const invColor = breached
    ? 'var(--color-warning)'
    : inv > 0
      ? 'var(--color-brand-600)'
      : inv < 0
        ? 'var(--color-accent-600)'
        : 'var(--color-ink-500)';

  const ariaLabel = `${title}. ${inventoryLabel}: ${Math.round(inv)}. ${breached ? breachLabel : ''}`;

  return (
    <figure className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className="rounded-pill px-3 py-1 text-sm font-medium text-white"
          style={{ backgroundColor: invColor }}
          aria-live="polite"
        >
          {inventoryLabel}: {inv >= 0 ? '+' : ''}
          {Math.round(inv)}
        </span>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={ariaLabel}>
        <rect x={padL} y={padT} width={plotW} height={plotH} rx={6} fill="var(--color-surface-sunken)" opacity={0.4} />

        {/* Flat (zero) line */}
        <line x1={padL} y1={toY(0)} x2={W - padR} y2={toY(0)} stroke="var(--color-ink-300)" strokeWidth={1} />
        <text x={padL - 4} y={toY(0) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-400)">
          {flatLabel}
        </text>

        {/* Limit lines */}
        {[LIMIT, -LIMIT].map((lim) => (
          <g key={lim}>
            <line
              x1={padL}
              y1={toY(lim)}
              x2={W - padR}
              y2={toY(lim)}
              stroke="var(--color-warning)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.7}
            />
            <text x={padL + 2} y={toY(lim) + (lim > 0 ? 12 : -4)} fontSize="9" fill="var(--color-warning)">
              {limitLabel} {lim > 0 ? `+${LIMIT}` : `-${LIMIT}`}
            </text>
          </g>
        ))}

        {/* Long / short side labels */}
        <text x={W - padR} y={toY(LIMIT * 0.6)} textAnchor="end" fontSize="9" fill="var(--color-brand-600)">
          {longLabel}
        </text>
        <text x={W - padR} y={toY(-LIMIT * 0.6)} textAnchor="end" fontSize="9" fill="var(--color-accent-600)">
          {shortLabel}
        </text>

        {/* Inventory path */}
        <path d={linePath} fill="none" stroke={invColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {path.length > 1 ? <circle cx={toX(path.length - 1)} cy={toY(inv)} r={4} fill={invColor} /> : null}
      </svg>

      {/* Skew presets */}
      <div className="mt-3">
        <p className="text-sm text-ink-700" id={`${id}-skew`}>
          {skewLabel}
        </p>
        <div className="mt-2 inline-flex gap-2" role="group" aria-labelledby={`${id}-skew`}>
          {skewButtons.map((b) => {
            const active = skew === b.value;
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => {
                  setSkew(b.value);
                  reset();
                }}
                aria-pressed={active}
                className={cx(
                  'rounded-pill px-4 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
                  active ? 'bg-brand-600 text-white' : 'bg-surface-sunken/40 text-ink-700 hover:bg-ink-100',
                )}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skew readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{bidSkewLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{bidShade.toFixed(1)}¢</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{askSkewLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-700">{askShade.toFixed(1)}¢</dd>
        </div>
      </dl>

      {breached ? (
        <div className="mt-4 rounded-card border border-warning/40 bg-warning/10 px-4 py-3" aria-live="polite">
          <p className="text-sm font-semibold text-warning">⚠ {breachLabel}</p>
        </div>
      ) : null}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {running ? runningLabel : runLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-pill border border-ink-200 bg-surface px-4 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-600">{reduced ? reducedMotionCaption : caption}</p>
    </figure>
  );
}

export default InventoryDrift;
